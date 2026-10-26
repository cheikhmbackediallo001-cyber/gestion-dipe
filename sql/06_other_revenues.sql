-- ==============================================================================
-- PLATEFORME DE GESTION DES ÉCOLES PRÉSCOLAIRES (GESTION DIPE)
-- SCRIPT 06 : TABLE AUTRES RENTRÉES (OTHER_REVENUES) & POLITIQUES RLS
-- Compatible Supabase / PostgreSQL 14+
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Création de la table `other_revenues` (Autres rentrées de l'école)
-- Concerne tous les encaissements hors inscriptions et cotisations mensuelles :
-- Dons, subventions, cantine scolaire, blouses/uniformes, kermesse, garderie, etc.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.other_revenues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    motif VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(150) NOT NULL DEFAULT 'Général',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
    payer_name VARCHAR(255),
    receipt_number VARCHAR(100),
    public_token UUID DEFAULT gen_random_uuid(),
    status payment_status NOT NULL DEFAULT 'valid',
    cancel_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES auth.users(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_other_revenue_amount_positive CHECK (amount >= 0),
    CONSTRAINT chk_other_revenue_motif_not_empty CHECK (char_length(trim(motif)) > 0)
);

-- Index pour des performances optimales et un cloisonnement par école
CREATE INDEX IF NOT EXISTS idx_other_revenues_school_date ON public.other_revenues(school_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_other_revenues_status ON public.other_revenues(school_id, status);
CREATE INDEX IF NOT EXISTS idx_other_revenues_token ON public.other_revenues(public_token);

-- ------------------------------------------------------------------------------
-- 2. Politiques de sécurité RLS (Row Level Security) étanches
-- ------------------------------------------------------------------------------
ALTER TABLE public.other_revenues ENABLE ROW LEVEL SECURITY;

-- Lecture : seuls les membres de l'école (ou superadmin) ont accès
DROP POLICY IF EXISTS "Users can view other revenues of their school" ON public.other_revenues;
CREATE POLICY "Users can view other revenues of their school"
ON public.other_revenues FOR SELECT
TO authenticated
USING (school_id = public.current_user_school_id() OR public.current_user_role() = 'superadmin');

-- Insertion : le personnel et la direction peuvent enregistrer une rentrée
DROP POLICY IF EXISTS "Staff and Directors can insert other revenues" ON public.other_revenues;
CREATE POLICY "Staff and Directors can insert other revenues"
ON public.other_revenues FOR INSERT
TO authenticated
WITH CHECK (school_id = public.current_user_school_id());

-- Modification : réservée au directeur
DROP POLICY IF EXISTS "Directors can update other revenues" ON public.other_revenues;
CREATE POLICY "Directors can update other revenues"
ON public.other_revenues FOR UPDATE
TO authenticated
USING (school_id = public.current_user_school_id() AND public.current_user_role() = 'director')
WITH CHECK (school_id = public.current_user_school_id() AND public.current_user_role() = 'director');

-- Suppression : réservée au directeur
DROP POLICY IF EXISTS "Directors can delete other revenues" ON public.other_revenues;
CREATE POLICY "Directors can delete other revenues"
ON public.other_revenues FOR DELETE
TO authenticated
USING (school_id = public.current_user_school_id() AND public.current_user_role() = 'director');

-- AUCUN accès anonyme : une politique USING (true) exposait toutes les rentrées de toutes les écoles.
DROP POLICY IF EXISTS "Public can verify other revenue receipt by token" ON public.other_revenues;
REVOKE ALL ON public.other_revenues FROM anon;
