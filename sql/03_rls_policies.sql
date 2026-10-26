-- ==============================================================================
-- PLATEFORME DE GESTION DES ÉCOLES PRÉSCOLAIRES (GESTION DIPE)
-- SCRIPT 03 : POLITIQUES ROW LEVEL SECURITY (RLS) - ISOLATION MULTI-ÉTABLISSEMENTS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Activation de RLS sur toutes les tables sensibles
-- ------------------------------------------------------------------------------
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_sequences ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. Fonctions utilitaires de sécurité pour les politiques
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS UUID AS $$
    SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 3. Politiques pour `schools`
-- ------------------------------------------------------------------------------
-- Un utilisateur voit uniquement son école
CREATE POLICY "Users can view their own school"
ON public.schools FOR SELECT
TO authenticated
USING (id = public.current_user_school_id() OR public.current_user_role() = 'superadmin');

-- Seul le directeur peut modifier les paramètres de son école
CREATE POLICY "Director can update their school"
ON public.schools FOR UPDATE
TO authenticated
USING (id = public.current_user_school_id() AND public.current_user_role() = 'director')
WITH CHECK (id = public.current_user_school_id() AND public.current_user_role() = 'director');

-- Création d'une école : uniquement via la fonction sécurisée register_school_atomically (script 05/07).
-- Aucune insertion directe n'est autorisée depuis l'API.

-- ------------------------------------------------------------------------------
-- 4. Politiques pour `profiles`
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view profiles of their school"
ON public.profiles FOR SELECT
TO authenticated
USING (school_id = public.current_user_school_id() OR id = auth.uid() OR public.current_user_role() = 'superadmin');

-- Un utilisateur ne peut créer que SON profil, sans école ni rôle privilégié
CREATE POLICY "Users can insert their initial profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() AND school_id IS NULL AND role = 'director');

-- Le directeur gère les profils de son école, sans jamais pouvoir créer de superadmin
CREATE POLICY "Directors can manage profiles of their school"
ON public.profiles FOR ALL
TO authenticated
USING (school_id = public.current_user_school_id() AND public.current_user_role() = 'director')
WITH CHECK (school_id = public.current_user_school_id() AND public.current_user_role() = 'director' AND role IN ('director', 'staff'));

-- ------------------------------------------------------------------------------
-- 5. Politiques pour `classes`
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view classes of their school"
ON public.classes FOR SELECT
TO authenticated
USING (school_id = public.current_user_school_id());

CREATE POLICY "Directors can modify classes"
ON public.classes FOR ALL
TO authenticated
USING (school_id = public.current_user_school_id() AND public.current_user_role() = 'director')
WITH CHECK (school_id = public.current_user_school_id() AND public.current_user_role() = 'director');

-- ------------------------------------------------------------------------------
-- 6. Politiques pour `school_months`
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view months of their school"
ON public.school_months FOR SELECT
TO authenticated
USING (school_id = public.current_user_school_id());

CREATE POLICY "Directors can modify school months"
ON public.school_months FOR ALL
TO authenticated
USING (school_id = public.current_user_school_id() AND public.current_user_role() = 'director')
WITH CHECK (school_id = public.current_user_school_id() AND public.current_user_role() = 'director');

-- ------------------------------------------------------------------------------
-- 7. Politiques pour `students`
-- ------------------------------------------------------------------------------
CREATE POLICY "Staff and Directors can view students of their school"
ON public.students FOR SELECT
TO authenticated
USING (school_id = public.current_user_school_id());

CREATE POLICY "Staff and Directors can insert/update students"
ON public.students FOR INSERT
TO authenticated
WITH CHECK (school_id = public.current_user_school_id());

CREATE POLICY "Staff and Directors can update students"
ON public.students FOR UPDATE
TO authenticated
USING (school_id = public.current_user_school_id())
WITH CHECK (school_id = public.current_user_school_id());

-- ------------------------------------------------------------------------------
-- 8. Politiques pour `payments`
-- ------------------------------------------------------------------------------
CREATE POLICY "School staff can view payments"
ON public.payments FOR SELECT
TO authenticated
USING (school_id = public.current_user_school_id());

CREATE POLICY "School staff can insert payments"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (school_id = public.current_user_school_id());

-- Seul le directeur peut mettre à jour un paiement (annulation)
CREATE POLICY "Only director can update payment (cancellation)"
ON public.payments FOR UPDATE
TO authenticated
USING (school_id = public.current_user_school_id() AND public.current_user_role() = 'director')
WITH CHECK (school_id = public.current_user_school_id() AND public.current_user_role() = 'director');

-- Interdiction stricte de supprimer définitivement un paiement
CREATE POLICY "No deletion of payments allowed"
ON public.payments FOR DELETE
TO authenticated
USING (false);

-- ------------------------------------------------------------------------------
-- 9. Politiques pour `receipts`
-- ------------------------------------------------------------------------------
-- Les membres de l'école peuvent voir tous les reçus de leur école
CREATE POLICY "Staff can view receipts of their school"
ON public.receipts FOR SELECT
TO authenticated
USING (school_id = public.current_user_school_id());

-- ACCÈS PUBLIC : AUCUNE lecture anonyme de la table (elle exposerait tous les jetons).
-- Les parents / tiers vérifient un reçu UNIQUEMENT via la fonction verify_receipt_public(jeton) ci-dessous.

-- ------------------------------------------------------------------------------
-- 10. Fonction publique de vérification sans exposition des données sensibles
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_receipt_public(p_token VARCHAR)
RETURNS TABLE (
    receipt_number VARCHAR,
    school_name VARCHAR,
    issued_at TIMESTAMPTZ,
    amount INTEGER,
    status payment_status
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.receipt_number,
        s.name AS school_name,
        r.issued_at,
        p.amount,
        r.status
    FROM public.receipts r
    JOIN public.schools s ON s.id = r.school_id
    JOIN public.payments p ON p.id = r.payment_id
    WHERE r.public_token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 11. Politiques pour `audit_log`
-- ------------------------------------------------------------------------------
CREATE POLICY "Only director can view audit logs"
ON public.audit_log FOR SELECT
TO authenticated
USING (school_id = public.current_user_school_id() AND public.current_user_role() = 'director');

CREATE POLICY "System and staff can insert audit log"
ON public.audit_log FOR INSERT
TO authenticated
WITH CHECK (school_id = public.current_user_school_id());
