-- ==============================================================================
-- PLATEFORME DE GESTION DES ÉCOLES PRÉSCOLAIRES (GESTION DIPE)
-- SCRIPT 05 : TABLE DÉPENSES (EXPENSES), PERSONNALISATION CACHET ET FONCTION D'INSCRIPTION ATOMIQUE
-- Compatible Supabase / PostgreSQL 14+
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Ajout de la couleur de cachet dans la table `schools`
-- ------------------------------------------------------------------------------
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS stamp_color VARCHAR(20) DEFAULT '#1E3A8A';

-- ------------------------------------------------------------------------------
-- 2. Création de la table `expenses` (Sorties de caisse & Dépenses de l'école)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    motif VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(150) NOT NULL DEFAULT 'Général',
    status payment_status NOT NULL DEFAULT 'valid',
    cancel_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES auth.users(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_expense_amount_positive CHECK (amount >= 0),
    CONSTRAINT chk_expense_motif_not_empty CHECK (char_length(trim(motif)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_expenses_school_date ON public.expenses(school_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(school_id, status);

-- ------------------------------------------------------------------------------
-- 3. Politiques RLS pour `expenses`
-- ------------------------------------------------------------------------------
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view expenses of their school" ON public.expenses;
CREATE POLICY "Users can view expenses of their school"
ON public.expenses FOR SELECT
TO authenticated
USING (school_id = public.current_user_school_id() OR public.current_user_role() = 'superadmin');

DROP POLICY IF EXISTS "Staff and Directors can insert expenses" ON public.expenses;
CREATE POLICY "Staff and Directors can insert expenses"
ON public.expenses FOR INSERT
TO authenticated
WITH CHECK (school_id = public.current_user_school_id());

DROP POLICY IF EXISTS "Directors can update expenses" ON public.expenses;
CREATE POLICY "Directors can update expenses"
ON public.expenses FOR UPDATE
TO authenticated
USING (school_id = public.current_user_school_id() AND public.current_user_role() = 'director')
WITH CHECK (school_id = public.current_user_school_id() AND public.current_user_role() = 'director');

DROP POLICY IF EXISTS "Directors can delete expenses" ON public.expenses;
CREATE POLICY "Directors can delete expenses"
ON public.expenses FOR DELETE
TO authenticated
USING (school_id = public.current_user_school_id() AND public.current_user_role() = 'director');

-- ------------------------------------------------------------------------------
-- 4. Fonction RPC pour l'inscription atomique complète d'une école
-- Exécutée par le directeur nouvellement connecté
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
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_school_id UUID;
    v_class RECORD;
    v_month RECORD;
    v_pos INTEGER := 1;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non authentifié.';
    END IF;

    -- Vérification si l'utilisateur a déjà une école
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND school_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Un établissement est déjà associé à ce compte.';
    END IF;

    -- Création de l'école
    INSERT INTO public.schools (
        name, director_name, director_phone, address, region, department, commune, school_year, stamp_color, status
    ) VALUES (
        p_school_name, p_director_name, p_director_phone, p_address, p_region, p_department, p_commune, p_school_year, '#1E3A8A', 'active'
    ) RETURNING id INTO v_school_id;

    -- Mise à jour ou création du profil directeur
    INSERT INTO public.profiles (id, school_id, role, full_name)
    VALUES (v_user_id, v_school_id, 'director', p_director_name)
    ON CONFLICT (id) DO UPDATE 
    SET school_id = v_school_id, role = 'director', full_name = p_director_name, updated_at = timezone('utc'::text, now());

    -- Insertion des classes configurées
    FOR v_class IN SELECT * FROM jsonb_to_recordset(p_classes) AS x(name TEXT, registration_fee INTEGER, monthly_fee INTEGER)
    LOOP
        INSERT INTO public.classes (school_id, name, registration_fee, monthly_fee, position)
        VALUES (v_school_id, v_class.name, v_class.registration_fee, v_class.monthly_fee, v_pos);
        v_pos := v_pos + 1;
    END LOOP;

    -- Initialisation des mois scolaires standard (Octobre -> Juin)
    INSERT INTO public.school_months (school_id, school_year, month_number, label, position) VALUES
    (v_school_id, p_school_year, 10, 'Octobre', 1),
    (v_school_id, p_school_year, 11, 'Novembre', 2),
    (v_school_id, p_school_year, 12, 'Décembre', 3),
    (v_school_id, p_school_year, 1,  'Janvier', 4),
    (v_school_id, p_school_year, 2,  'Février', 5),
    (v_school_id, p_school_year, 3,  'Mars', 6),
    (v_school_id, p_school_year, 4,  'Avril', 7),
    (v_school_id, p_school_year, 5,  'Mai', 8),
    (v_school_id, p_school_year, 6,  'Juin', 9);

    -- Initialisation du compteur de reçus à 0
    INSERT INTO public.receipt_sequences (school_id, school_year, last_val)
    VALUES (v_school_id, p_school_year, 0)
    ON CONFLICT (school_id, school_year) DO NOTHING;

    -- Journal d'audit
    INSERT INTO public.audit_log (school_id, user_id, action, details)
    VALUES (
        v_school_id,
        v_user_id,
        'SCHOOL_REGISTERED',
        jsonb_build_object('school_name', p_school_name, 'director_name', p_director_name, 'school_year', p_school_year)
    );

    RETURN jsonb_build_object(
        'success', true,
        'school_id', v_school_id,
        'school_name', p_school_name,
        'director_name', p_director_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
