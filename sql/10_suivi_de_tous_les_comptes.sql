-- ==============================================================================
-- PLATEFORME DE GESTION DES ÉCOLES PRÉSCOLAIRES (GESTION DIPE)
-- SCRIPT 10 : SUIVI DE TOUS LES COMPTES (y compris ceux utilisés uniquement sur téléphone)
--
-- Chaque téléphone où une école réelle est ouverte envoie un rapport d'activité
-- (au plus une fois toutes les 10 minutes) : e-mail du compte, fiche de l'école,
-- totaux (élèves, paiements, montants). Aucun nom d'enfant.
-- - device_reports : illisible et non modifiable depuis le site (aucune règle d'accès).
-- - report_device_activity(jsonb) : seule porte d'écriture, avec contrôles et limites.
-- - admin_overview() : renvoie aussi ces rapports (administrateur uniquement).
-- À exécuter APRÈS le script 09. Peut être relancé sans risque.
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.device_reports (
    device_id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255),
    director_name VARCHAR(150),
    school_name VARCHAR(255),
    school_phone VARCHAR(40),
    region VARCHAR(100),
    commune VARCHAR(100),
    school_year VARCHAR(20),
    students INTEGER NOT NULL DEFAULT 0,
    girls INTEGER NOT NULL DEFAULT 0,
    boys INTEGER NOT NULL DEFAULT 0,
    classes INTEGER NOT NULL DEFAULT 0,
    payments INTEGER NOT NULL DEFAULT 0,
    collected BIGINT NOT NULL DEFAULT 0,
    expenses BIGINT NOT NULL DEFAULT 0,
    online_backup BOOLEAN NOT NULL DEFAULT false,
    linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    app_version VARCHAR(30),
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_device_id CHECK (device_id ~ '^dev_[0-9a-f]{32}$')
);

CREATE INDEX IF NOT EXISTS idx_device_reports_email ON public.device_reports (lower(email));

ALTER TABLE public.device_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_reports FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- Réception d'un rapport (téléphone avec ou sans compte en ligne)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_device_activity(p_report JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_device TEXT := p_report->>'device_id';
    v_email TEXT := lower(trim(COALESCE(p_report->>'email', '')));
    v_last TIMESTAMPTZ;
    v_int_max CONSTANT INTEGER := 100000;
    v_amount_max CONSTANT BIGINT := 100000000000;
BEGIN
    IF v_device IS NULL OR v_device !~ '^dev_[0-9a-f]{32}$' THEN
        RETURN false;
    END IF;
    IF v_email !~ '^[^@\s]{1,100}@[^@\s]{1,100}\.[^@\s]{2,30}$' THEN
        v_email := NULL;
    END IF;

    SELECT last_seen_at INTO v_last FROM public.device_reports WHERE device_id = v_device;
    -- Au plus un rapport toutes les 10 minutes par téléphone
    IF v_last IS NOT NULL AND v_last > timezone('utc'::text, now()) - interval '10 minutes' THEN
        RETURN false;
    END IF;
    -- Protection contre l'envoi massif de faux téléphones
    IF v_last IS NULL AND (SELECT count(*) FROM public.device_reports
                            WHERE first_seen_at > timezone('utc'::text, now()) - interval '1 hour') >= 500 THEN
        RETURN false;
    END IF;

    INSERT INTO public.device_reports AS d (
        device_id, email, director_name, school_name, school_phone, region, commune, school_year,
        students, girls, boys, classes, payments, collected, expenses, online_backup, linked_user_id, app_version, last_seen_at
    ) VALUES (
        v_device,
        v_email,
        left(nullif(trim(p_report->>'director_name'), ''), 150),
        left(nullif(trim(p_report->>'school_name'), ''), 255),
        left(nullif(trim(p_report->>'school_phone'), ''), 40),
        left(nullif(trim(p_report->>'region'), ''), 100),
        left(nullif(trim(p_report->>'commune'), ''), 100),
        left(nullif(trim(p_report->>'school_year'), ''), 20),
        LEAST(GREATEST(COALESCE((CASE WHEN p_report->>'students' ~ '^[0-9]{1,9}$' THEN p_report->>'students' END)::int, 0), 0), v_int_max),
        LEAST(GREATEST(COALESCE((CASE WHEN p_report->>'girls' ~ '^[0-9]{1,9}$' THEN p_report->>'girls' END)::int, 0), 0), v_int_max),
        LEAST(GREATEST(COALESCE((CASE WHEN p_report->>'boys' ~ '^[0-9]{1,9}$' THEN p_report->>'boys' END)::int, 0), 0), v_int_max),
        LEAST(GREATEST(COALESCE((CASE WHEN p_report->>'classes' ~ '^[0-9]{1,9}$' THEN p_report->>'classes' END)::int, 0), 0), 1000),
        LEAST(GREATEST(COALESCE((CASE WHEN p_report->>'payments' ~ '^[0-9]{1,9}$' THEN p_report->>'payments' END)::int, 0), 0), v_int_max),
        LEAST(GREATEST(COALESCE((CASE WHEN p_report->>'collected' ~ '^[0-9]{1,15}$' THEN p_report->>'collected' END)::bigint, 0), 0), v_amount_max),
        LEAST(GREATEST(COALESCE((CASE WHEN p_report->>'expenses' ~ '^[0-9]{1,15}$' THEN p_report->>'expenses' END)::bigint, 0), 0), v_amount_max),
        auth.uid() IS NOT NULL,
        auth.uid(),
        left(nullif(trim(p_report->>'app_version'), ''), 30),
        timezone('utc'::text, now())
    )
    ON CONFLICT (device_id) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, d.email),
        director_name = COALESCE(EXCLUDED.director_name, d.director_name),
        school_name = COALESCE(EXCLUDED.school_name, d.school_name),
        school_phone = COALESCE(EXCLUDED.school_phone, d.school_phone),
        region = COALESCE(EXCLUDED.region, d.region),
        commune = COALESCE(EXCLUDED.commune, d.commune),
        school_year = COALESCE(EXCLUDED.school_year, d.school_year),
        students = EXCLUDED.students,
        girls = EXCLUDED.girls,
        boys = EXCLUDED.boys,
        classes = EXCLUDED.classes,
        payments = EXCLUDED.payments,
        collected = EXCLUDED.collected,
        expenses = EXCLUDED.expenses,
        online_backup = EXCLUDED.online_backup,
        linked_user_id = COALESCE(EXCLUDED.linked_user_id, d.linked_user_id),
        app_version = EXCLUDED.app_version,
        last_seen_at = EXCLUDED.last_seen_at;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.report_device_activity(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_device_activity(JSONB) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- Vue d'ensemble : comptes en ligne + téléphones (administrateur uniquement)
-- ------------------------------------------------------------------------------
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
