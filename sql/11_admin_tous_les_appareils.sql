-- ==============================================================================
-- PLATEFORME DE GESTION DES ÉCOLES PRÉSCOLAIRES (GESTION DIPE)
-- SCRIPT 11 : TABLEAU ADMINISTRATEUR — RAPPORTS DE TOUS LES APPAREILS D'UN COMPTE
--
-- Une même directrice peut utiliser plusieurs appareils (téléphone, ordinateur).
-- admin_overview() renvoie désormais les rapports de tous ses appareils, pour afficher
-- la source la plus complète. À exécuter APRÈS les scripts 09 et 10. Peut être relancé sans risque.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_directors JSONB;
    v_devices JSONB;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Accès réservé à l''administrateur de la plateforme.' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'created_at') DESC), '[]'::jsonb)
    INTO v_directors
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
                'collected', (SELECT COALESCE(sum(CASE WHEN (p->>'amount') ~ '^[0-9]+$' THEN (p->>'amount')::bigint ELSE 0 END), 0)
                              FROM jsonb_array_elements(COALESCE(b.data->'payments', '[]'::jsonb)) p
                              WHERE COALESCE(p->>'status', 'valid') = 'valid'),
                'other_revenues', (SELECT COALESCE(sum(CASE WHEN (o->>'amount') ~ '^[0-9]+$' THEN (o->>'amount')::bigint ELSE 0 END), 0)
                                   FROM jsonb_array_elements(COALESCE(b.data->'other_revenues', '[]'::jsonb)) o
                                   WHERE COALESCE(o->>'status', 'valid') = 'valid'),
                'expenses', (SELECT COALESCE(sum(CASE WHEN (x->>'amount') ~ '^[0-9]+$' THEN (x->>'amount')::bigint ELSE 0 END), 0)
                             FROM jsonb_array_elements(COALESCE(b.data->'expenses', '[]'::jsonb)) x
                             WHERE COALESCE(x->>'status', 'active') NOT IN ('cancelled', 'deleted')),
                'receipts_published', (SELECT count(*) FROM public.published_receipts r WHERE r.owner_id = u.id)
            ) END,
            -- Rapports de TOUS les appareils de ce compte (téléphone, ordinateur...)
            'devices', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                           'last_seen_at', d.last_seen_at,
                           'school_name', d.school_name, 'director_name', d.director_name, 'school_phone', d.school_phone,
                           'region', d.region, 'commune', d.commune, 'school_year', d.school_year,
                           'students', d.students, 'girls', d.girls, 'boys', d.boys, 'classes', d.classes,
                           'payments', d.payments, 'collected', d.collected, 'expenses', d.expenses)
                           ORDER BY d.students DESC, d.payments DESC, d.last_seen_at DESC), '[]'::jsonb)
                        FROM public.device_reports d
                        WHERE d.linked_user_id = u.id OR lower(d.email) = lower(u.email))
        ) AS row_data
        FROM auth.users u
        LEFT JOIN public.school_backups b ON b.owner_id = u.id
    ) t;

    -- Téléphones dont le compte n'existe pas en ligne (application utilisée sur le téléphone uniquement)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'device_id', d.device_id,
        'email', d.email,
        'director_name', d.director_name,
        'school_name', d.school_name,
        'school_phone', d.school_phone,
        'region', d.region,
        'commune', d.commune,
        'school_year', d.school_year,
        'students', d.students, 'girls', d.girls, 'boys', d.boys, 'classes', d.classes,
        'payments', d.payments, 'collected', d.collected, 'expenses', d.expenses,
        'first_seen_at', d.first_seen_at,
        'last_seen_at', d.last_seen_at
    ) ORDER BY d.last_seen_at DESC), '[]'::jsonb)
    INTO v_devices
    FROM public.device_reports d
    WHERE d.linked_user_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE d.email IS NOT NULL AND lower(u.email) = lower(d.email));

    RETURN jsonb_build_object('generated_at', timezone('utc'::text, now()), 'directors', v_directors, 'devices', v_devices);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated;

COMMIT;
