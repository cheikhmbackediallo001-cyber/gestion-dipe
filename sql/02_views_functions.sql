-- ==============================================================================
-- PLATEFORME DE GESTION DES ÉCOLES PRÉSCOLAIRES (GESTION DIPE)
-- SCRIPT 02 : FONCTIONS MÉTIER, SÉQUENCES DE REÇUS ET VUES DE TOTAUX
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Fonction de génération atomique du numéro de reçu (sans trou ni doublon)
-- Format : REC-[ANNEE_DEBUT]-[0001] (ex: REC-2026-0001)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_receipt_number(
    p_school_id UUID,
    p_school_year VARCHAR DEFAULT '2026-2027'
) RETURNS VARCHAR AS $$
DECLARE
    v_year_prefix VARCHAR(4);
    v_next_val INTEGER;
    v_receipt_number VARCHAR(50);
BEGIN
    -- Extraction des 4 premiers chiffres de l'année scolaire (ex: 2026)
    v_year_prefix := SUBSTRING(p_school_year FROM 1 FOR 4);
    IF v_year_prefix IS NULL OR LENGTH(v_year_prefix) < 4 THEN
        v_year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
    END IF;

    -- Incrémentation atomique avec verrouillage de ligne (évite les doublons en concurrence)
    INSERT INTO public.receipt_sequences (school_id, school_year, last_val)
    VALUES (p_school_id, p_school_year, 1)
    ON CONFLICT (school_id, school_year) 
    DO UPDATE SET last_val = public.receipt_sequences.last_val + 1
    RETURNING last_val INTO v_next_val;

    -- Formatage avec 4 chiffres minimaux (ex: REC-2026-0001)
    v_receipt_number := 'REC-' || v_year_prefix || '-' || LPAD(v_next_val::TEXT, 4, '0');
    RETURN v_receipt_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 2. Fonction RPC pour valider un paiement et générer le reçu automatiquement
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_payment_and_issue_receipt(
    p_school_id UUID,
    p_student_id UUID,
    p_kind payment_kind,
    p_amount INTEGER,
    p_method payment_method,
    p_month_id UUID DEFAULT NULL,
    p_reference VARCHAR DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_school_year VARCHAR(20);
    v_payment_id UUID;
    v_receipt_id UUID;
    v_receipt_num VARCHAR(50);
    v_public_token VARCHAR(64);
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Récupération de l'année scolaire courante de l'école
    SELECT school_year INTO v_school_year FROM public.schools WHERE id = p_school_id;
    IF v_school_year IS NULL THEN
        v_school_year := '2026-2027';
    END IF;

    -- Insertion du paiement
    INSERT INTO public.payments (
        school_id, student_id, kind, month_id, amount, method, reference, paid_at, status, created_by
    ) VALUES (
        p_school_id, p_student_id, p_kind, p_month_id, p_amount, p_method, p_reference, timezone('utc'::text, now()), 'valid', v_user_id
    ) RETURNING id INTO v_payment_id;

    -- Numéro de reçu séquentiel
    v_receipt_num := public.generate_receipt_number(p_school_id, v_school_year);

    -- Jeton public sécurisé non devinable (32 octets hexadécimaux = 64 caractères)
    v_public_token := encode(gen_random_bytes(32), 'hex');

    -- Insertion du reçu
    INSERT INTO public.receipts (
        school_id, payment_id, receipt_number, public_token, issued_at, status
    ) VALUES (
        p_school_id, v_payment_id, v_receipt_num, v_public_token, timezone('utc'::text, now()), 'valid'
    ) RETURNING id INTO v_receipt_id;

    -- Trace d'audit
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 3. Fonction RPC pour annuler un paiement (Directeur uniquement)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_payment(
    p_school_id UUID,
    p_payment_id UUID,
    p_cancel_reason TEXT
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_user_role user_role;
    v_receipt_num VARCHAR(50);
BEGIN
    v_user_id := auth.uid();

    -- Vérification du rôle Directeur
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id AND school_id = p_school_id;
    IF v_user_role IS NULL OR v_user_role != 'director' THEN
        RAISE EXCEPTION 'Seul le directeur de l''établissement est autorisé à annuler un paiement.';
    END IF;

    IF p_cancel_reason IS NULL OR TRIM(p_cancel_reason) = '' THEN
        RAISE EXCEPTION 'Un motif d''annulation explicite est obligatoire.';
    END IF;

    -- Mise à jour du statut du paiement
    UPDATE public.payments
    SET status = 'cancelled',
        cancel_reason = p_cancel_reason,
        cancelled_at = timezone('utc'::text, now()),
        cancelled_by = v_user_id
    WHERE id = p_payment_id AND school_id = p_school_id;

    -- Mise à jour du statut du reçu (le reçu n'est jamais supprimé, filigrane ANNULÉ)
    UPDATE public.receipts
    SET status = 'cancelled'
    WHERE payment_id = p_payment_id AND school_id = p_school_id
    RETURNING receipt_number INTO v_receipt_num;

    -- Enregistrement dans le journal d'audit
    INSERT INTO public.audit_log (school_id, user_id, action, details)
    VALUES (
        p_school_id,
        v_user_id,
        'PAYMENT_CANCELLED',
        jsonb_build_object(
            'payment_id', p_payment_id,
            'receipt_number', v_receipt_num,
            'cancel_reason', p_cancel_reason
        )
    );

    RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'receipt_number', v_receipt_num);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 4. Vue : Synthèse des Inscriptions par Classe
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_registration_summary_by_class AS
SELECT 
    c.school_id,
    c.id AS class_id,
    c.name AS class_name,
    c.registration_fee,
    c.position,
    COUNT(s.id) AS total_students,
    COUNT(p.id) AS paid_students,
    (COUNT(s.id) - COUNT(p.id)) AS unpaid_students,
    (COUNT(s.id) * c.registration_fee) AS expected_amount,
    COALESCE(SUM(p.amount), 0)::BIGINT AS collected_amount,
    ((COUNT(s.id) * c.registration_fee) - COALESCE(SUM(p.amount), 0))::BIGINT AS remaining_amount,
    CASE 
        WHEN COUNT(s.id) > 0 THEN 
            ROUND((COUNT(p.id)::NUMERIC / COUNT(s.id)::NUMERIC) * 100, 1)
        ELSE 0.0 
    END AS collection_rate_pct
FROM public.classes c
LEFT JOIN public.students s ON s.class_id = c.id AND s.active = true
LEFT JOIN public.payments p ON p.student_id = s.id AND p.kind = 'registration' AND p.status = 'valid'
GROUP BY c.school_id, c.id, c.name, c.registration_fee, c.position;

-- ------------------------------------------------------------------------------
-- 5. Vue : Total Global des Inscriptions de l'École
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_registration_school_total AS
SELECT 
    school_id,
    SUM(total_students)::BIGINT AS total_students,
    SUM(paid_students)::BIGINT AS paid_students,
    SUM(unpaid_students)::BIGINT AS unpaid_students,
    SUM(expected_amount)::BIGINT AS total_expected,
    SUM(collected_amount)::BIGINT AS total_collected,
    SUM(remaining_amount)::BIGINT AS total_remaining,
    CASE 
        WHEN SUM(total_students) > 0 THEN 
            ROUND((SUM(paid_students)::NUMERIC / SUM(total_students)::NUMERIC) * 100, 1)
        ELSE 0.0 
    END AS collection_rate_pct,
    CASE 
        WHEN SUM(expected_amount) > 0 THEN 
            ROUND((SUM(collected_amount)::NUMERIC / SUM(expected_amount)::NUMERIC) * 100, 1)
        ELSE 0.0 
    END AS collection_rate_val_pct
FROM public.view_registration_summary_by_class
GROUP BY school_id;

-- ------------------------------------------------------------------------------
-- 6. Vue : Bilan Mensuel de l'Année Scolaire (Récapitulatif par mois)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_monthly_summary_by_month AS
SELECT 
    m.school_id,
    m.id AS month_id,
    m.school_year,
    m.month_number,
    m.label AS month_label,
    m.position AS month_position,
    COUNT(s.id) AS total_active_students,
    COUNT(p.id) AS paid_students,
    (COUNT(s.id) - COUNT(p.id)) AS unpaid_students,
    COALESCE(SUM(c.monthly_fee), 0)::BIGINT AS expected_amount,
    COALESCE(SUM(p.amount), 0)::BIGINT AS collected_amount,
    (COALESCE(SUM(c.monthly_fee), 0) - COALESCE(SUM(p.amount), 0))::BIGINT AS remaining_amount,
    CASE 
        WHEN COUNT(s.id) > 0 THEN 
            ROUND((COUNT(p.id)::NUMERIC / COUNT(s.id)::NUMERIC) * 100, 1)
        ELSE 0.0 
    END AS collection_rate_pct,
    CASE 
        WHEN COALESCE(SUM(c.monthly_fee), 0) > 0 THEN 
            ROUND((COALESCE(SUM(p.amount), 0)::NUMERIC / SUM(c.monthly_fee)::NUMERIC) * 100, 1)
        ELSE 0.0 
    END AS collection_rate_val_pct
FROM public.school_months m
CROSS JOIN public.students s
JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.payments p ON p.student_id = s.id 
    AND p.kind = 'monthly' 
    AND p.month_id = m.id 
    AND p.status = 'valid'
WHERE s.school_id = m.school_id AND s.active = true
GROUP BY m.school_id, m.id, m.school_year, m.month_number, m.label, m.position;

-- ------------------------------------------------------------------------------
-- 7. Vue : État Mensuel par Classe (pour chaque mois et chaque classe)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_monthly_detail_by_class AS
SELECT 
    m.school_id,
    m.id AS month_id,
    m.label AS month_label,
    m.position AS month_position,
    c.id AS class_id,
    c.name AS class_name,
    c.monthly_fee,
    c.position AS class_position,
    COUNT(s.id) AS total_students,
    COUNT(p.id) AS paid_students,
    (COUNT(s.id) - COUNT(p.id)) AS unpaid_students,
    (COUNT(s.id) * c.monthly_fee)::BIGINT AS expected_amount,
    COALESCE(SUM(p.amount), 0)::BIGINT AS collected_amount,
    ((COUNT(s.id) * c.monthly_fee) - COALESCE(SUM(p.amount), 0))::BIGINT AS remaining_amount,
    CASE 
        WHEN COUNT(s.id) > 0 THEN 
            ROUND((COUNT(p.id)::NUMERIC / COUNT(s.id)::NUMERIC) * 100, 1)
        ELSE 0.0 
    END AS collection_rate_pct
FROM public.school_months m
CROSS JOIN public.classes c
LEFT JOIN public.students s ON s.class_id = c.id AND s.active = true AND s.school_id = m.school_id
LEFT JOIN public.payments p ON p.student_id = s.id 
    AND p.kind = 'monthly' 
    AND p.month_id = m.id 
    AND p.status = 'valid'
WHERE c.school_id = m.school_id
GROUP BY m.school_id, m.id, m.label, m.position, c.id, c.name, c.monthly_fee, c.position;
