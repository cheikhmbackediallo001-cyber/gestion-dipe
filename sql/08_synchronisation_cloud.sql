-- ==============================================================================
-- PLATEFORME DE GESTION DES ÉCOLES PRÉSCOLAIRES (GESTION DIPE)
-- SCRIPT 08 : SYNCHRONISATION CLOUD (SAUVEGARDE DES ÉCOLES + REÇUS VÉRIFIABLES)
-- À exécuter APRÈS le script 07. Idempotent : peut être relancé sans risque.
--
-- 1. school_backups     : sauvegarde automatique de toutes les données d'une école,
--                         visible UNIQUEMENT par le compte propriétaire (RLS).
-- 2. published_receipts : informations publiques minimales des reçus émis, pour que
--                         n'importe quel parent puisse vérifier un reçu par QR code.
--                         Aucune lecture directe : uniquement via verify_receipt_public(jeton).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Sauvegardes privées des écoles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_backups (
    owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    local_school_id VARCHAR(100) NOT NULL,
    school_name VARCHAR(255),
    data JSONB NOT NULL,
    client_saved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.school_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can read own backup" ON public.school_backups;
CREATE POLICY "Owner can read own backup"
ON public.school_backups FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner can create own backup" ON public.school_backups;
CREATE POLICY "Owner can create own backup"
ON public.school_backups FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner can update own backup" ON public.school_backups;
CREATE POLICY "Owner can update own backup"
ON public.school_backups FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner can delete own backup" ON public.school_backups;
CREATE POLICY "Owner can delete own backup"
ON public.school_backups FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

REVOKE ALL ON public.school_backups FROM anon;
REVOKE ALL ON public.school_backups FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_backups TO authenticated;

-- Horodatage serveur et taille maximale (20 Mo) de chaque sauvegarde
CREATE OR REPLACE FUNCTION public.school_backups_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF octet_length(NEW.data::text) > 20000000 THEN
        RAISE EXCEPTION 'Sauvegarde trop volumineuse (20 Mo maximum).' USING ERRCODE = '54000';
    END IF;
    IF jsonb_typeof(NEW.data) <> 'object' THEN
        RAISE EXCEPTION 'Format de sauvegarde invalide.' USING ERRCODE = '22023';
    END IF;
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_school_backups_before_write ON public.school_backups;
CREATE TRIGGER trg_school_backups_before_write
BEFORE INSERT OR UPDATE ON public.school_backups
FOR EACH ROW EXECUTE FUNCTION public.school_backups_before_write();

-- ------------------------------------------------------------------------------
-- 2. Reçus publiés pour la vérification publique par QR code
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.published_receipts (
    public_token VARCHAR(128) PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receipt_number VARCHAR(50) NOT NULL,
    school_name VARCHAR(255) NOT NULL,
    school_commune VARCHAR(100),
    object_label VARCHAR(255),
    amount INTEGER NOT NULL DEFAULT 0,
    method VARCHAR(30) NOT NULL DEFAULT 'cash',
    status payment_status NOT NULL DEFAULT 'valid',
    issued_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_published_amount CHECK (amount >= 0),
    CONSTRAINT chk_published_method CHECK (method IN ('cash', 'wave', 'orange_money', 'cheque', 'bank_transfer', 'other')),
    CONSTRAINT chk_published_token CHECK (public_token ~ '^[A-Za-z0-9_-]{16,128}$')
);

CREATE INDEX IF NOT EXISTS idx_published_receipts_owner ON public.published_receipts(owner_id);

ALTER TABLE public.published_receipts ENABLE ROW LEVEL SECURITY;

-- Le propriétaire peut relire ses reçus publiés ; aucune écriture directe (fonction publish_receipts)
DROP POLICY IF EXISTS "Owner can read own published receipts" ON public.published_receipts;
CREATE POLICY "Owner can read own published receipts"
ON public.published_receipts FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

REVOKE ALL ON public.published_receipts FROM anon;
REVOKE ALL ON public.published_receipts FROM authenticated;
GRANT SELECT ON public.published_receipts TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. Publication (ou annulation) d'un lot de reçus par le compte connecté
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_receipts(p_receipts JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_item JSONB;
    v_token TEXT;
    v_count INTEGER := 0;
    v_amount NUMERIC;
    v_issued TIMESTAMPTZ;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
    END IF;
    IF p_receipts IS NULL OR jsonb_typeof(p_receipts) <> 'array' THEN
        RAISE EXCEPTION 'Format invalide.' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_receipts) > 500 THEN
        RAISE EXCEPTION 'Trop de reçus en une seule fois (500 maximum).' USING ERRCODE = '22023';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_receipts)
    LOOP
        v_token := v_item->>'token';
        IF v_token IS NULL OR v_token !~ '^[A-Za-z0-9_-]{16,128}$' THEN
            CONTINUE;
        END IF;

        -- Reçu supprimé côté école : il reste visible mais marqué ANNULÉ
        IF COALESCE(v_item->>'revoke', 'false') = 'true' THEN
            UPDATE public.published_receipts
            SET status = 'cancelled', updated_at = timezone('utc'::text, now())
            WHERE public_token = v_token AND owner_id = v_uid;
            v_count := v_count + 1;
            CONTINUE;
        END IF;

        v_amount := CASE WHEN (v_item->>'amount') ~ '^\d{1,9}(\.\d+)?$' THEN (v_item->>'amount')::NUMERIC ELSE 0 END;
        BEGIN
            v_issued := (v_item->>'issued_at')::TIMESTAMPTZ;
        EXCEPTION WHEN others THEN
            v_issued := timezone('utc'::text, now());
        END;

        INSERT INTO public.published_receipts AS pr (
            public_token, owner_id, receipt_number, school_name, school_commune,
            object_label, amount, method, status, issued_at, updated_at
        ) VALUES (
            v_token,
            v_uid,
            LEFT(COALESCE(NULLIF(v_item->>'receipt_number', ''), '-'), 50),
            LEFT(COALESCE(NULLIF(v_item->>'school_name', ''), 'Établissement'), 255),
            LEFT(v_item->>'school_commune', 100),
            LEFT(v_item->>'object_label', 255),
            LEAST(ROUND(v_amount), 100000000)::INTEGER,
            CASE WHEN v_item->>'method' IN ('cash', 'wave', 'orange_money', 'cheque', 'bank_transfer', 'other')
                 THEN v_item->>'method' ELSE 'other' END,
            CASE WHEN v_item->>'status' = 'cancelled' THEN 'cancelled'::payment_status ELSE 'valid'::payment_status END,
            COALESCE(v_issued, timezone('utc'::text, now())),
            timezone('utc'::text, now())
        )
        ON CONFLICT (public_token) DO UPDATE
        SET receipt_number = EXCLUDED.receipt_number,
            school_name = EXCLUDED.school_name,
            school_commune = EXCLUDED.school_commune,
            object_label = EXCLUDED.object_label,
            amount = EXCLUDED.amount,
            method = EXCLUDED.method,
            status = EXCLUDED.status,
            issued_at = EXCLUDED.issued_at,
            updated_at = EXCLUDED.updated_at
        WHERE pr.owner_id = v_uid; -- impossible de modifier le reçu d'un autre compte

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Vérification publique : registre officiel (receipts) puis reçus publiés
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_receipt_public(p_token VARCHAR)
RETURNS TABLE (
    receipt_number VARCHAR,
    school_name VARCHAR,
    issued_at TIMESTAMPTZ,
    amount INTEGER,
    status payment_status,
    object_label TEXT,
    method payment_method
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
    IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{16,128}$' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        r.receipt_number,
        s.name,
        r.issued_at,
        p.amount,
        r.status,
        CASE
            WHEN p.kind = 'registration' THEN 'Frais d''inscription'::TEXT
            ELSE ('Cotisation ' || COALESCE(m.label, 'mensuelle'))::TEXT
        END,
        p.method
    FROM public.receipts r
    JOIN public.schools s ON s.id = r.school_id
    JOIN public.payments p ON p.id = r.payment_id
    LEFT JOIN public.school_months m ON m.id = p.month_id
    WHERE r.public_token = p_token
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            pr.receipt_number,
            pr.school_name,
            pr.issued_at,
            pr.amount,
            pr.status,
            pr.object_label::TEXT,
            pr.method::payment_method
        FROM public.published_receipts pr
        WHERE pr.public_token = p_token
        LIMIT 1;
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Droits d'exécution
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.publish_receipts(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_receipts(JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.verify_receipt_public(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_receipt_public(VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.school_backups_before_write() FROM PUBLIC, anon, authenticated;

COMMIT;
