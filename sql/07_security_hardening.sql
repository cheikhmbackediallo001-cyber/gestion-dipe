-- ==============================================================================
-- PLATEFORME DE GESTION DES ÉCOLES PRÉSCOLAIRES (GESTION DIPE)
-- SCRIPT 07 : DURCISSEMENT COMPLET DE LA SÉCURITÉ (RLS, PRIVILÈGES, FONCTIONS)
-- À exécuter dans le SQL Editor de Supabase APRÈS les scripts 01 à 06.
-- Le script est idempotent : il peut être relancé sans risque.
--
-- Failles corrigées :
--  1. Les reçus (avec leurs jetons secrets) étaient lisibles par tout visiteur anonyme.
--  2. Les vues de synthèse financière contournaient la RLS (lisibles par tous les comptes et anonymes).
--  3. Un utilisateur pouvait créer son profil avec le rôle « directeur » ou « superadmin »
--     d'une école qui n'est pas la sienne (prise de contrôle d'école / de la plateforme).
--  4. Un directeur pouvait promouvoir un compte en « superadmin » (accès à toutes les écoles).
--  5. La fonction d'encaissement acceptait un school_id arbitraire (écriture dans une autre école).
--  6. Les « autres rentrées » étaient lisibles par tout visiteur anonyme (USING (true)).
--  7. Fonctions SECURITY DEFINER sans search_path fixe (risque de détournement).
--  8. Écritures directes possibles dans payments / receipts / audit_log (journal falsifiable).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. Colonne utilisée par les fonctions (au cas où le script 05 n'a pas été exécuté)
-- ------------------------------------------------------------------------------
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS stamp_color VARCHAR(20) DEFAULT '#1E3A8A';

-- ------------------------------------------------------------------------------
-- 1. Fonctions utilitaires de sécurité (search_path verrouillé)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ------------------------------------------------------------------------------
-- 2. Aucun accès direct aux tables pour les visiteurs anonymes
--    (la vérification publique des reçus passe exclusivement par verify_receipt_public)
-- ------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- Privilèges dangereux inutiles pour l'API (TRUNCATE contourne la RLS)
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;

-- ------------------------------------------------------------------------------
-- 3. Reçus : suppression de l'accès anonyme à la table
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view receipt verification by token" ON public.receipts;

-- ------------------------------------------------------------------------------
-- 4. Vues de synthèse : exécution avec les droits de l'appelant (RLS appliquée)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_view TEXT;
BEGIN
    FOREACH v_view IN ARRAY ARRAY[
        'view_registration_summary_by_class',
        'view_registration_school_total',
        'view_monthly_summary_by_month',
        'view_monthly_detail_by_class'
    ]
    LOOP
        IF to_regclass('public.' || v_view) IS NOT NULL THEN
            BEGIN
                EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v_view);
            EXCEPTION WHEN others THEN
                -- PostgreSQL < 15 : impossible d'appliquer la RLS à la vue, on la ferme aux clients
                EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', v_view);
            END;
            EXECUTE format('REVOKE ALL ON public.%I FROM anon', v_view);
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 5. Profils : impossible de s'attribuer une école ou un rôle privilégié
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their initial profile" ON public.profiles;
CREATE POLICY "Users can insert their initial profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() AND school_id IS NULL AND role = 'director');

DROP POLICY IF EXISTS "Directors can manage profiles of their school" ON public.profiles;
CREATE POLICY "Directors can manage profiles of their school"
ON public.profiles FOR ALL
TO authenticated
USING (school_id = public.current_user_school_id() AND public.current_user_role() = 'director')
WITH CHECK (
    school_id = public.current_user_school_id()
    AND public.current_user_role() = 'director'
    AND role IN ('director', 'staff')
);

-- Garde-fou supplémentaire : seul un appel interne (fonction sécurisée) ou un superadmin
-- peut créer / promouvoir un superadmin ou changer l'école d'un profil existant.
-- IMPORTANT : pas de SECURITY DEFINER ici, afin que current_user reflète le rôle de l appelant.
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Les appels internes (fonctions SECURITY DEFINER exécutées en tant que postgres) et le service_role ne sont pas concernés
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    IF NEW.role = 'superadmin' AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'superadmin') THEN
        RAISE EXCEPTION 'Attribution du rôle superadmin interdite.' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.school_id IS DISTINCT FROM OLD.school_id THEN
        RAISE EXCEPTION 'Changement d''établissement interdit.' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Modification de l''identifiant interdite.' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- ------------------------------------------------------------------------------
-- 6. Écoles : création uniquement via register_school_atomically, colonnes sensibles protégées
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can create a school during onboarding" ON public.schools;
REVOKE INSERT, DELETE ON public.schools FROM authenticated;
REVOKE UPDATE ON public.schools FROM authenticated;
GRANT UPDATE (name, director_name, director_phone, address, region, department, commune, logo_url, school_year, stamp_color, updated_at)
    ON public.schools TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. Paiements, reçus, séquences et journal d'audit : écriture UNIQUEMENT via les fonctions
--    sécurisées (numérotation sans trou, audit infalsifiable, montants contrôlés)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "School staff can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Only director can update payment (cancellation)" ON public.payments;
DROP POLICY IF EXISTS "System and staff can insert audit log" ON public.audit_log;

REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.receipts FROM authenticated;
REVOKE ALL ON public.receipt_sequences FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated;

-- ------------------------------------------------------------------------------
-- 8. Cohérence multi-écoles : un élève ne peut appartenir qu'à une classe de SON école
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_student_class_school()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = NEW.class_id AND c.school_id = NEW.school_id) THEN
        RAISE EXCEPTION 'La classe choisie n''appartient pas à cet établissement.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_student_class_school ON public.students;
CREATE TRIGGER trg_enforce_student_class_school
BEFORE INSERT OR UPDATE OF class_id, school_id ON public.students
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_class_school();

-- ------------------------------------------------------------------------------
-- 9. Numérotation des reçus : fonction interne uniquement
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_receipt_number(
    p_school_id UUID,
    p_school_year VARCHAR DEFAULT '2026-2027'
) RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_year_prefix VARCHAR(4);
    v_next_val INTEGER;
BEGIN
    v_year_prefix := SUBSTRING(p_school_year FROM 1 FOR 4);
    IF v_year_prefix IS NULL OR v_year_prefix !~ '^\d{4}$' THEN
        v_year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
    END IF;

    INSERT INTO public.receipt_sequences (school_id, school_year, last_val)
    VALUES (p_school_id, p_school_year, 1)
    ON CONFLICT (school_id, school_year)
    DO UPDATE SET last_val = public.receipt_sequences.last_val + 1
    RETURNING last_val INTO v_next_val;

    RETURN 'REC-' || v_year_prefix || '-' || LPAD(v_next_val::TEXT, 4, '0');
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. Encaissement + reçu : contrôle de l'appartenance à l'école et des données
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_payment_and_issue_receipt(
    p_school_id UUID,
    p_student_id UUID,
    p_kind payment_kind,
    p_amount INTEGER,
    p_method payment_method,
    p_month_id UUID DEFAULT NULL,
    p_reference VARCHAR DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_school_year VARCHAR(20);
    v_payment_id UUID;
    v_receipt_id UUID;
    v_receipt_num VARCHAR(50);
    v_public_token VARCHAR(64);
    v_user_id UUID;
    v_month_id UUID := p_month_id;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
    END IF;

    IF p_school_id IS NULL OR public.current_user_school_id() IS DISTINCT FROM p_school_id THEN
        RAISE EXCEPTION 'Accès refusé : cet établissement ne vous est pas rattaché.' USING ERRCODE = '42501';
    END IF;

    IF p_amount IS NULL OR p_amount < 0 OR p_amount > 100000000 THEN
        RAISE EXCEPTION 'Montant invalide.' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = p_student_id AND s.school_id = p_school_id AND s.active = true
    ) THEN
        RAISE EXCEPTION 'Élève introuvable dans cet établissement.' USING ERRCODE = '22023';
    END IF;

    IF p_kind = 'monthly' THEN
        IF v_month_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.school_months m WHERE m.id = v_month_id AND m.school_id = p_school_id
        ) THEN
            RAISE EXCEPTION 'Mois scolaire invalide pour cet établissement.' USING ERRCODE = '22023';
        END IF;
    ELSE
        v_month_id := NULL;
    END IF;

    SELECT school_year INTO v_school_year FROM public.schools WHERE id = p_school_id;
    IF v_school_year IS NULL THEN
        v_school_year := '2026-2027';
    END IF;

    INSERT INTO public.payments (
        school_id, student_id, kind, month_id, amount, method, reference, paid_at, status, created_by
    ) VALUES (
        p_school_id, p_student_id, p_kind, v_month_id, p_amount, p_method, LEFT(p_reference, 100),
        timezone('utc'::text, now()), 'valid', v_user_id
    ) RETURNING id INTO v_payment_id;

    v_receipt_num := public.generate_receipt_number(p_school_id, v_school_year);
    v_public_token := encode(gen_random_bytes(32), 'hex');

    INSERT INTO public.receipts (
        school_id, payment_id, receipt_number, public_token, issued_at, status
    ) VALUES (
        p_school_id, v_payment_id, v_receipt_num, v_public_token, timezone('utc'::text, now()), 'valid'
    ) RETURNING id INTO v_receipt_id;

    INSERT INTO public.audit_log (school_id, user_id, action, details)
    VALUES (
        p_school_id,
        v_user_id,
        'PAYMENT_RECORDED',
        jsonb_build_object(
            'payment_id', v_payment_id,
            'receipt_id', v_receipt_id,
            'receipt_number', v_receipt_num,
            'amount', p_amount,
            'kind', p_kind,
            'student_id', p_student_id
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'receipt_id', v_receipt_id,
        'receipt_number', v_receipt_num,
        'public_token', v_public_token
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. Annulation : directeur de l'école uniquement, paiement valide de la même école
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_payment(
    p_school_id UUID,
    p_payment_id UUID,
    p_cancel_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_role user_role;
    v_receipt_num VARCHAR(50);
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
    END IF;

    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id AND school_id = p_school_id;
    IF v_user_role IS NULL OR v_user_role <> 'director' THEN
        RAISE EXCEPTION 'Seul le directeur de l''établissement est autorisé à annuler un paiement.' USING ERRCODE = '42501';
    END IF;

    IF p_cancel_reason IS NULL OR char_length(trim(p_cancel_reason)) < 5 THEN
        RAISE EXCEPTION 'Un motif d''annulation explicite (5 caractères minimum) est obligatoire.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.payments
    SET status = 'cancelled',
        cancel_reason = LEFT(trim(p_cancel_reason), 500),
        cancelled_at = timezone('utc'::text, now()),
        cancelled_by = v_user_id
    WHERE id = p_payment_id AND school_id = p_school_id AND status = 'valid';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paiement introuvable ou déjà annulé.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.receipts
    SET status = 'cancelled'
    WHERE payment_id = p_payment_id AND school_id = p_school_id
    RETURNING receipt_number INTO v_receipt_num;

    INSERT INTO public.audit_log (school_id, user_id, action, details)
    VALUES (
        p_school_id,
        v_user_id,
        'PAYMENT_CANCELLED',
        jsonb_build_object(
            'payment_id', p_payment_id,
            'receipt_number', v_receipt_num,
            'cancel_reason', LEFT(trim(p_cancel_reason), 500)
        )
    );

    RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'receipt_number', v_receipt_num);
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. Inscription atomique d'une école (validation des données)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_school_atomically(
    p_school_name VARCHAR,
    p_director_name VARCHAR,
    p_director_phone VARCHAR,
    p_region VARCHAR,
    p_department VARCHAR,
    p_commune VARCHAR,
    p_address TEXT,
    p_school_year VARCHAR,
    p_classes JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_school_id UUID;
    v_class RECORD;
    v_pos INTEGER := 1;
    v_year VARCHAR(20);
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND school_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Un établissement est déjà associé à ce compte.' USING ERRCODE = '23505';
    END IF;

    IF p_school_name IS NULL OR char_length(trim(p_school_name)) = 0 OR char_length(p_school_name) > 255
       OR p_director_name IS NULL OR char_length(trim(p_director_name)) = 0 OR char_length(p_director_name) > 255
       OR p_director_phone IS NULL OR char_length(p_director_phone) > 50
       OR char_length(COALESCE(p_region, '')) > 100 OR char_length(COALESCE(p_department, '')) > 100
       OR char_length(COALESCE(p_commune, '')) > 100 OR char_length(COALESCE(p_address, '')) > 500 THEN
        RAISE EXCEPTION 'Informations de l''établissement invalides.' USING ERRCODE = '22023';
    END IF;

    v_year := CASE WHEN p_school_year ~ '^\d{4}-\d{4}$' THEN p_school_year ELSE '2026-2027' END;

    IF p_classes IS NULL OR jsonb_typeof(p_classes) <> 'array' OR jsonb_array_length(p_classes) > 20 THEN
        RAISE EXCEPTION 'Liste des classes invalide.' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.schools (
        name, director_name, director_phone, address, region, department, commune, school_year, stamp_color, status
    ) VALUES (
        trim(p_school_name), trim(p_director_name), p_director_phone, p_address,
        COALESCE(NULLIF(p_region, ''), 'Dakar'), COALESCE(NULLIF(p_department, ''), 'Dakar'), COALESCE(NULLIF(p_commune, ''), 'Plateau'),
        v_year, '#1E3A8A', 'active'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.profiles (id, school_id, role, full_name)
    VALUES (v_user_id, v_school_id, 'director', trim(p_director_name))
    ON CONFLICT (id) DO UPDATE
    SET school_id = v_school_id, role = 'director', full_name = trim(p_director_name), updated_at = timezone('utc'::text, now());

    FOR v_class IN SELECT * FROM jsonb_to_recordset(p_classes) AS x(name TEXT, registration_fee INTEGER, monthly_fee INTEGER)
    LOOP
        IF v_class.name IS NULL OR char_length(trim(v_class.name)) = 0 OR char_length(v_class.name) > 100
           OR COALESCE(v_class.registration_fee, 0) < 0 OR COALESCE(v_class.monthly_fee, 0) < 0 THEN
            RAISE EXCEPTION 'Classe invalide : %', COALESCE(v_class.name, '(sans nom)') USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.classes (school_id, name, registration_fee, monthly_fee, position)
        VALUES (v_school_id, trim(v_class.name), COALESCE(v_class.registration_fee, 0), COALESCE(v_class.monthly_fee, 0), v_pos);
        v_pos := v_pos + 1;
    END LOOP;

    INSERT INTO public.school_months (school_id, school_year, month_number, label, position) VALUES
    (v_school_id, v_year, 10, 'Octobre', 1),
    (v_school_id, v_year, 11, 'Novembre', 2),
    (v_school_id, v_year, 12, 'Décembre', 3),
    (v_school_id, v_year, 1,  'Janvier', 4),
    (v_school_id, v_year, 2,  'Février', 5),
    (v_school_id, v_year, 3,  'Mars', 6),
    (v_school_id, v_year, 4,  'Avril', 7),
    (v_school_id, v_year, 5,  'Mai', 8),
    (v_school_id, v_year, 6,  'Juin', 9);

    INSERT INTO public.receipt_sequences (school_id, school_year, last_val)
    VALUES (v_school_id, v_year, 0)
    ON CONFLICT (school_id, school_year) DO NOTHING;

    INSERT INTO public.audit_log (school_id, user_id, action, details)
    VALUES (
        v_school_id,
        v_user_id,
        'SCHOOL_REGISTERED',
        jsonb_build_object('school_name', trim(p_school_name), 'director_name', trim(p_director_name), 'school_year', v_year)
    );

    RETURN jsonb_build_object(
        'success', true,
        'school_id', v_school_id,
        'school_name', trim(p_school_name),
        'director_name', trim(p_director_name)
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 13. Vérification publique d'un reçu : seule porte d'entrée anonyme,
--     renvoie uniquement les informations non sensibles d'UN reçu identifié par son jeton
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.verify_receipt_public(VARCHAR);
CREATE FUNCTION public.verify_receipt_public(p_token VARCHAR)
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
END;
$$;

-- ------------------------------------------------------------------------------
-- 14. Autres rentrées et dépenses (scripts 05/06) : fermeture de l'accès anonyme
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.other_revenues') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Public can verify other revenue receipt by token" ON public.other_revenues';
        EXECUTE 'REVOKE ALL ON public.other_revenues FROM anon';
    END IF;
    IF to_regclass('public.expenses') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON public.expenses FROM anon';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 15. Droits d'exécution des fonctions (principe du moindre privilège)
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.current_user_school_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_school_id() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.generate_receipt_number(UUID, VARCHAR) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.process_payment_and_issue_receipt(UUID, UUID, payment_kind, INTEGER, payment_method, UUID, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_payment_and_issue_receipt(UUID, UUID, payment_kind, INTEGER, payment_method, UUID, VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_payment(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_payment(UUID, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.register_school_atomically(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_school_atomically(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.verify_receipt_public(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_receipt_public(VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.protect_profile_privileges() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_student_class_school() FROM PUBLIC, anon, authenticated;

COMMIT;

-- ==============================================================================
-- CONTRÔLE APRÈS EXÉCUTION (à lancer séparément, doit renvoyer 0 ligne) :
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public' AND 'anon' = ANY(roles);
-- ==============================================================================
