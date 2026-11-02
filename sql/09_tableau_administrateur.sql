-- ==============================================================================
-- PLATEFORME DE GESTION DES ÉCOLES PRÉSCOLAIRES (GESTION DIPE)
-- SCRIPT 09 : TABLEAU DE BORD ADMINISTRATEUR (réservé au propriétaire de la plateforme)
--
-- - Table des administrateurs (adresse e-mail) : aucun accès depuis le site.
-- - is_platform_admin() : vrai uniquement pour un compte administrateur dont l'e-mail est CONFIRMÉ.
-- - admin_overview() : liste des directrices inscrites + informations fournies + niveau d'activité
--   (nombres d'élèves, paiements, montants...). Refusée (erreur 42501) à tout autre compte.
--   Aucun nom d'enfant n'est renvoyé : seulement des totaux.
-- Peut être relancé sans risque.
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_admins (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_platform_admin_email CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- Sécurité activée sans aucune règle d'accès : illisible et non modifiable depuis le site
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM PUBLIC, anon, authenticated;

-- Seule adresse administratrice : cheikhmbackediallo0@gmail.com (toute autre est retirée)
DELETE FROM public.platform_admins WHERE email <> 'cheikhmbackediallo0@gmail.com';
INSERT INTO public.platform_admins (email)
VALUES ('cheikhmbackediallo0@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- ------------------------------------------------------------------------------
-- Le compte connecté est-il administrateur ? (e-mail confirmé obligatoire)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM auth.users u
        JOIN public.platform_admins a ON a.email = lower(u.email)
        WHERE u.id = auth.uid()
          AND u.email_confirmed_at IS NOT NULL
    );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ------------------------------------------------------------------------------
-- Vue d'ensemble des directrices (administrateur uniquement)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Accès réservé à l''administrateur de la plateforme.' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'created_at') DESC), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'user_id', u.id,
            'email', u.email,
            'full_name', COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
            'created_at', u.created_at,
            'last_sign_in_at', u.last_sign_in_at,
            'email_confirmed', u.email_confirmed_at IS NOT NULL,
            'is_admin', EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.email = lower(u.email)),
            'has_backup', b.owner_id IS NOT NULL,
            'backup_saved_at', COALESCE(b.client_saved_at, b.updated_at),
            'school', CASE WHEN b.owner_id IS NULL THEN NULL ELSE jsonb_build_object(
                'name', COALESCE(b.data->'school'->>'name', b.school_name),
                'director_name', b.data->'school'->>'director_name',
                'director_phone', b.data->'school'->>'director_phone',
                'region', b.data->'school'->>'region',
                'department', b.data->'school'->>'department',
                'commune', b.data->'school'->>'commune',
                'address', b.data->'school'->>'address',
                'school_year', b.data->'school'->>'school_year'
            ) END,
            'stats', CASE WHEN b.owner_id IS NULL THEN NULL ELSE jsonb_build_object(
                'classes', (SELECT count(*) FROM jsonb_array_elements(COALESCE(b.data->'classes', '[]'::jsonb))),
                'students', (SELECT count(*) FROM jsonb_array_elements(COALESCE(b.data->'students', '[]'::jsonb)) s
                             WHERE COALESCE(s->>'active', 'true') <> 'false'),
                'girls', (SELECT count(*) FROM jsonb_array_elements(COALESCE(b.data->'students', '[]'::jsonb)) s
                          WHERE COALESCE(s->>'active', 'true') <> 'false' AND s->>'gender' = 'F'),
                'boys', (SELECT count(*) FROM jsonb_array_elements(COALESCE(b.data->'students', '[]'::jsonb)) s
                         WHERE COALESCE(s->>'active', 'true') <> 'false' AND COALESCE(s->>'gender', 'M') <> 'F'),
                'payments', (SELECT count(*) FROM jsonb_array_elements(COALESCE(b.data->'payments', '[]'::jsonb)) p
                             WHERE COALESCE(p->>'status', 'valid') = 'valid'),
                'registrations_paid', (SELECT count(*) FROM jsonb_array_elements(COALESCE(b.data->'payments', '[]'::jsonb)) p
                                       WHERE COALESCE(p->>'status', 'valid') = 'valid' AND p->>'kind' = 'registration'),
                'collected', (SELECT COALESCE(sum(CASE WHEN (p->>'amount') ~ '^[0-9]+$' THEN (p->>'amount')::bigint ELSE 0 END), 0)
                              FROM jsonb_array_elements(COALESCE(b.data->'payments', '[]'::jsonb)) p
                              WHERE COALESCE(p->>'status', 'valid') = 'valid'),
                'other_revenues', (SELECT COALESCE(sum(CASE WHEN (o->>'amount') ~ '^[0-9]+$' THEN (o->>'amount')::bigint ELSE 0 END), 0)
                                   FROM jsonb_array_elements(COALESCE(b.data->'other_revenues', '[]'::jsonb)) o
                                   WHERE COALESCE(o->>'status', 'valid') = 'valid'),
                'expenses', (SELECT COALESCE(sum(CASE WHEN (x->>'amount') ~ '^[0-9]+$' THEN (x->>'amount')::bigint ELSE 0 END), 0)
                             FROM jsonb_array_elements(COALESCE(b.data->'expenses', '[]'::jsonb)) x
                             WHERE COALESCE(x->>'status', 'active') NOT IN ('cancelled', 'deleted')),
                'receipts_published', (SELECT count(*) FROM public.published_receipts r WHERE r.owner_id = u.id),
                'last_activity_at', GREATEST(
                    (SELECT max((s->>'created_at')) FROM jsonb_array_elements(COALESCE(b.data->'students', '[]'::jsonb)) s),
                    (SELECT max((p->>'paid_at')) FROM jsonb_array_elements(COALESCE(b.data->'payments', '[]'::jsonb)) p)
                )
            ) END
        ) AS row_data
        FROM auth.users u
        LEFT JOIN public.school_backups b ON b.owner_id = u.id
    ) t;

    RETURN jsonb_build_object('generated_at', timezone('utc'::text, now()), 'directors', v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated;

COMMIT;
