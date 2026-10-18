-- ==============================================================================
-- PLATEFORME DE GESTION DES ÉCOLES PRÉSCOLAIRES (GESTION DIPE)
-- SCRIPT 04 : JEU DE DONNÉES DE DÉMONSTRATION (1 ÉCOLE, 3 CLASSES, 30 ÉLÈVES)
-- ==============================================================================

DO $$
DECLARE
    v_school_id UUID := '11111111-1111-1111-1111-111111111111';
    v_class_ps UUID := '22222222-1111-1111-1111-111111111111';
    v_class_ms UUID := '22222222-2222-1111-1111-111111111111';
    v_class_gs UUID := '22222222-3333-1111-1111-111111111111';

    v_m_oct UUID := '33333333-1000-1111-1111-111111111111';
    v_m_nov UUID := '33333333-1100-1111-1111-111111111111';
    v_m_dec UUID := '33333333-1200-1111-1111-111111111111';
    v_m_jan UUID := '33333333-0100-1111-1111-111111111111';
    v_m_fev UUID := '33333333-0200-1111-1111-111111111111';
    v_m_mar UUID := '33333333-0300-1111-1111-111111111111';
    v_m_avr UUID := '33333333-0400-1111-1111-111111111111';
    v_m_mai UUID := '33333333-0500-1111-1111-111111111111';
    v_m_jui UUID := '33333333-0600-1111-1111-111111111111';
    
    v_s_id UUID;
    v_p_id UUID;
BEGIN
    -- 1. Création de l'école de test
    INSERT INTO public.schools (
        id, name, director_name, director_phone, address, region, department, commune, school_year, status
    ) VALUES (
        v_school_id,
        'École Maternelle Les Papillons',
        'Mme Aïssatou Ba',
        '+221 77 543 21 00',
        '12 Rue Félix Faure, Dakar-Plateau',
        'Dakar',
        'Dakar',
        'Plateau',
        '2026-2027',
        'active'
    ) ON CONFLICT (id) DO NOTHING;

    -- 2. Création des classes
    INSERT INTO public.classes (id, school_id, name, registration_fee, monthly_fee, position) VALUES
    (v_class_ps, v_school_id, 'Petite section', 25000, 15000, 1),
    (v_class_ms, v_school_id, 'Moyenne section', 25000, 15000, 2),
    (v_class_gs, v_school_id, 'Grande section', 30000, 18000, 3)
    ON CONFLICT (id) DO NOTHING;

    -- 3. Configuration des mois scolaires (Octobre à Juin)
    INSERT INTO public.school_months (id, school_id, school_year, month_number, label, position) VALUES
    (v_m_oct, v_school_id, '2026-2027', 10, 'Octobre', 1),
    (v_m_nov, v_school_id, '2026-2027', 11, 'Novembre', 2),
    (v_m_dec, v_school_id, '2026-2027', 12, 'Décembre', 3),
    (v_m_jan, v_school_id, '2026-2027', 1, 'Janvier', 4),
    (v_m_fev, v_school_id, '2026-2027', 2, 'Février', 5),
    (v_m_mar, v_school_id, '2026-2027', 3, 'Mars', 6),
    (v_m_avr, v_school_id, '2026-2027', 4, 'Avril', 7),
    (v_m_mai, v_school_id, '2026-2027', 5, 'Mai', 8),
    (v_m_jui, v_school_id, '2026-2027', 6, 'Juin', 9)
    ON CONFLICT (id) DO NOTHING;

    -- 4. Initialisation de la séquence des reçus
    INSERT INTO public.receipt_sequences (school_id, school_year, last_val)
    VALUES (v_school_id, '2026-2027', 0)
    ON CONFLICT (school_id, school_year) DO NOTHING;

    -- 5. Insertion des 30 élèves
    -- Petite Section (10 élèves)
    INSERT INTO public.students (id, school_id, class_id, last_name, first_names, birth_date, parent_name, parent_phone, active) VALUES
    ('44444444-0001-1111-1111-111111111111', v_school_id, v_class_ps, 'DIOP', 'Mamadou', '2023-03-12', 'Ousmane Diop', '+221 77 123 45 67', true),
    ('44444444-0002-1111-1111-111111111111', v_school_id, v_class_ps, 'SOW', 'Fatou', '2023-05-24', 'Ibrahima Sow', '+221 78 234 56 78', true),
    ('44444444-0003-1111-1111-111111111111', v_school_id, v_class_ps, 'NDIAYE', 'Cheikh Tidiane', '2023-01-15', 'Mariama Diallo', '+221 76 345 67 89', true),
    ('44444444-0004-1111-1111-111111111111', v_school_id, v_class_ps, 'FALL', 'Aminata', '2023-07-09', 'Abdoulaye Fall', '+221 70 456 78 90', true),
    ('44444444-0005-1111-1111-111111111111', v_school_id, v_class_ps, 'GUEYE', 'Babacar', '2023-04-18', 'Khadija Seck', '+221 77 567 89 01', true),
    ('44444444-0006-1111-1111-111111111111', v_school_id, v_class_ps, 'BA', 'Seynabou', '2023-08-30', 'Amadou Ba', '+221 78 678 90 12', true),
    ('44444444-0007-1111-1111-111111111111', v_school_id, v_class_ps, 'CISSE', 'Mouhamed', '2023-02-14', 'Fatimata Cisse', '+221 76 789 01 23', true),
    ('44444444-0008-1111-1111-111111111111', v_school_id, v_class_ps, 'TOURE', 'Aïda', '2023-06-05', 'Moustapha Toure', '+221 77 890 12 34', true),
    ('44444444-0009-1111-1111-111111111111', v_school_id, v_class_ps, 'DIENG', 'El Hadji Malick', '2023-09-19', 'Ndeye Dieng', '+221 70 901 23 45', true),
    ('44444444-0010-1111-1111-111111111111', v_school_id, v_class_ps, 'SY', 'Mariama', '2023-11-02', 'Mansour Sy', '+221 78 012 34 56', true),

    -- Moyenne Section (10 élèves)
    ('44444444-0011-1111-1111-111111111111', v_school_id, v_class_ms, 'DIAGNE', 'Ibrahima', '2022-02-10', 'Souleymane Diagne', '+221 77 111 22 33', true),
    ('44444444-0012-1111-1111-111111111111', v_school_id, v_class_ms, 'KANE', 'Khadidiatou', '2022-04-14', 'Oumar Kane', '+221 78 222 33 44', true),
    ('44444444-0013-1111-1111-111111111111', v_school_id, v_class_ms, 'SECK', 'Pape Alassane', '2022-06-21', 'Awa Seck', '+221 76 333 44 55', true),
    ('44444444-0014-1111-1111-111111111111', v_school_id, v_class_ms, 'MBAYE', 'Rokhaya', '2022-01-29', 'Modou Mbaye', '+221 70 444 55 66', true),
    ('44444444-0015-1111-1111-111111111111', v_school_id, v_class_ms, 'THIAM', 'Alioune Badara', '2022-08-11', 'Astou Thiam', '+221 77 555 66 77', true),
    ('44444444-0016-1111-1111-111111111111', v_school_id, v_class_ms, 'TALL', 'Dieynaba', '2022-05-17', 'Cheikh Tall', '+221 78 666 77 88', true),
    ('44444444-0017-1111-1111-111111111111', v_school_id, v_class_ms, 'FAYE', 'Serigne Fallou', '2022-09-03', 'Bamba Faye', '+221 76 777 88 99', true),
    ('44444444-0018-1111-1111-111111111111', v_school_id, v_class_ms, 'WANE', 'Fama', '2022-03-25', 'Hamidou Wane', '+221 77 888 99 00', true),
    ('44444444-0019-1111-1111-111111111111', v_school_id, v_class_ms, 'LY', 'Moussa', '2022-07-08', 'Thierno Ly', '+221 70 999 00 11', true),
    ('44444444-0020-1111-1111-111111111111', v_school_id, v_class_ms, 'SARR', 'Anta', '2022-10-31', 'Maguette Sarr', '+221 78 120 34 56', true),

    -- Grande Section (10 élèves)
    ('44444444-0021-1111-1111-111111111111', v_school_id, v_class_gs, 'NDOYE', 'Assane', '2021-01-19', 'Lamine Ndoye', '+221 77 231 45 67', true),
    ('44444444-0022-1111-1111-111111111111', v_school_id, v_class_gs, 'LO', 'Coumba', '2021-03-28', 'Mor Lo', '+221 78 342 56 78', true),
    ('44444444-0023-1111-1111-111111111111', v_school_id, v_class_gs, 'SAMB', 'Djibril', '2021-06-15', 'Nafi Samb', '+221 76 453 67 89', true),
    ('44444444-0024-1111-1111-111111111111', v_school_id, v_class_gs, 'NIANG', 'Mame Diarra', '2021-05-04', 'Babacar Niang', '+221 70 564 78 90', true),
    ('44444444-0025-1111-1111-111111111111', v_school_id, v_class_gs, 'DIALLO', 'Abdoulaye', '2021-09-12', 'Mamadou Diallo', '+221 77 675 89 01', true),
    ('44444444-0026-1111-1111-111111111111', v_school_id, v_class_gs, 'BARRY', 'Kadiatou', '2021-02-22', 'Alpha Barry', '+221 78 786 90 12', true),
    ('44444444-0027-1111-1111-111111111111', v_school_id, v_class_gs, 'TRAORE', 'Samba', '2021-08-07', 'Adama Traore', '+221 76 897 01 23', true),
    ('44444444-0028-1111-1111-111111111111', v_school_id, v_class_gs, 'CAMARA', 'Binta', '2021-11-14', 'Sekou Camara', '+221 77 908 12 34', true),
    ('44444444-0029-1111-1111-111111111111', v_school_id, v_class_gs, 'MANE', 'Lamine', '2021-04-09', 'Ansoumane Mane', '+221 70 019 23 45', true),
    ('44444444-0030-1111-1111-111111111111', v_school_id, v_class_gs, 'SANE', 'Aïssatou', '2021-07-26', 'Boubacar Sane', '+221 78 130 34 56', true)
    ON CONFLICT (id) DO NOTHING;

    -- 6. Enregistrement d'un lot de paiements d'inscriptions (environ 22 payés / 8 impayés)
    -- Inscriptions Petite section (7 payés sur 10)
    FOR i IN 1..7 LOOP
        v_s_id := ('44444444-' || LPAD(i::text, 4, '0') || '-1111-1111-111111111111')::UUID;
        INSERT INTO public.payments (school_id, student_id, kind, amount, method, paid_at, status)
        VALUES (v_school_id, v_s_id, 'registration', 25000, 'wave', timezone('utc'::text, now() - INTERVAL '15 days'), 'valid')
        RETURNING id INTO v_p_id;

        INSERT INTO public.receipts (school_id, payment_id, receipt_number, public_token, issued_at, status)
        VALUES (v_school_id, v_p_id, 'REC-2026-000' || i, md5(random()::text || clock_timestamp()::text), timezone('utc'::text, now() - INTERVAL '15 days'), 'valid');
    END LOOP;

    -- Inscriptions Moyenne section (8 payés sur 10)
    FOR i IN 11..18 LOOP
        v_s_id := ('44444444-' || LPAD(i::text, 4, '0') || '-1111-1111-111111111111')::UUID;
        INSERT INTO public.payments (school_id, student_id, kind, amount, method, paid_at, status)
        VALUES (v_school_id, v_s_id, 'registration', 25000, 'cash', timezone('utc'::text, now() - INTERVAL '12 days'), 'valid')
        RETURNING id INTO v_p_id;

        INSERT INTO public.receipts (school_id, payment_id, receipt_number, public_token, issued_at, status)
        VALUES (v_school_id, v_p_id, 'REC-2026-00' || i, md5(random()::text || clock_timestamp()::text), timezone('utc'::text, now() - INTERVAL '12 days'), 'valid');
    END LOOP;

    -- Inscriptions Grande section (8 payés sur 10)
    FOR i IN 21..28 LOOP
        v_s_id := ('44444444-' || LPAD(i::text, 4, '0') || '-1111-1111-111111111111')::UUID;
        INSERT INTO public.payments (school_id, student_id, kind, amount, method, paid_at, status)
        VALUES (v_school_id, v_s_id, 'registration', 30000, 'orange_money', timezone('utc'::text, now() - INTERVAL '10 days'), 'valid')
        RETURNING id INTO v_p_id;

        INSERT INTO public.receipts (school_id, payment_id, receipt_number, public_token, issued_at, status)
        VALUES (v_school_id, v_p_id, 'REC-2026-00' || i, md5(random()::text || clock_timestamp()::text), timezone('utc'::text, now() - INTERVAL '10 days'), 'valid');
    END LOOP;

    -- Mise à jour de la séquence
    UPDATE public.receipt_sequences SET last_val = 28 WHERE school_id = v_school_id;

    -- 7. Cotisations d'Octobre (20 payés)
    FOR i IN 1..6 LOOP
        v_s_id := ('44444444-' || LPAD(i::text, 4, '0') || '-1111-1111-111111111111')::UUID;
        INSERT INTO public.payments (school_id, student_id, kind, month_id, amount, method, paid_at, status)
        VALUES (v_school_id, v_s_id, 'monthly', v_m_oct, 15000, 'wave', timezone('utc'::text, now() - INTERVAL '5 days'), 'valid')
        RETURNING id INTO v_p_id;

        INSERT INTO public.receipts (school_id, payment_id, receipt_number, public_token, issued_at, status)
        VALUES (v_school_id, v_p_id, 'REC-2026-00' || (28 + i), md5(random()::text || clock_timestamp()::text), timezone('utc'::text, now() - INTERVAL '5 days'), 'valid');
    END LOOP;

    UPDATE public.receipt_sequences SET last_val = 34 WHERE school_id = v_school_id;

END $$;
