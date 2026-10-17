-- ==============================================================================
-- PLATEFORME DE GESTION DES ÉCOLES PRÉSCOLAIRES (GESTION DIPE)
-- SCRIPT 01 : STRUCTURE DE LA BASE DE DONNÉES (SCHEMA, TYPES, CONTRAINTES)
-- Compatible Supabase / PostgreSQL 14+
-- ==============================================================================

-- Activation des extensions requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Types énumérés
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('director', 'staff', 'superadmin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_kind AS ENUM ('registration', 'monthly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('valid', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cash', 'wave', 'orange_money', 'cheque', 'bank_transfer', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE school_status AS ENUM ('active', 'suspended', 'trial');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Table `schools` (Écoles référencées)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    director_name VARCHAR(255) NOT NULL,
    director_phone VARCHAR(50) NOT NULL,
    address TEXT,
    region VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    commune VARCHAR(100) NOT NULL,
    logo_url TEXT,
    school_year VARCHAR(20) NOT NULL DEFAULT '2026-2027',
    status school_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_school_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT chk_director_name_not_empty CHECK (char_length(trim(director_name)) > 0)
);

-- ------------------------------------------------------------------------------
-- 3. Table `profiles` (Utilisateurs et rôles associés à auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'director',
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 4. Table `classes` (Sections préscolaires par école)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    registration_fee INTEGER NOT NULL DEFAULT 0,
    monthly_fee INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_registration_fee_positive CHECK (registration_fee >= 0),
    CONSTRAINT chk_monthly_fee_positive CHECK (monthly_fee >= 0),
    CONSTRAINT uq_school_class_name UNIQUE (school_id, name)
);

-- ------------------------------------------------------------------------------
-- 5. Table `school_months` (Mois de l'année scolaire configurés pour l'école)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_months (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    school_year VARCHAR(20) NOT NULL DEFAULT '2026-2027',
    month_number INTEGER NOT NULL, -- Ex: 10 pour Octobre, 6 pour Juin
    label VARCHAR(50) NOT NULL,    -- Ex: "Octobre", "Novembre"
    position INTEGER NOT NULL,     -- Ordre chronologique scolaire (1 = Oct, 2 = Nov...)
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_month_number CHECK (month_number BETWEEN 1 AND 12),
    CONSTRAINT uq_school_year_month UNIQUE (school_id, school_year, month_number)
);

-- ------------------------------------------------------------------------------
-- 6. Table `students` (Élèves inscrits)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    last_name VARCHAR(100) NOT NULL,
    first_names VARCHAR(150) NOT NULL,
    birth_date DATE,
    parent_name VARCHAR(200),
    parent_phone VARCHAR(50),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_last_name_not_empty CHECK (char_length(trim(last_name)) > 0),
    CONSTRAINT chk_first_names_not_empty CHECK (char_length(trim(first_names)) > 0)
);

-- ------------------------------------------------------------------------------
-- 7. Table `payments` (Paiements d'inscriptions et cotisations mensuelles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    kind payment_kind NOT NULL,
    month_id UUID REFERENCES public.school_months(id) ON DELETE RESTRICT,
    amount INTEGER NOT NULL, -- Montants toujours entiers en FCFA
    method payment_method NOT NULL DEFAULT 'cash',
    reference VARCHAR(100),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status payment_status NOT NULL DEFAULT 'valid',
    cancel_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES auth.users(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_payment_amount_positive CHECK (amount >= 0),
    CONSTRAINT chk_month_required_for_monthly CHECK (
        (kind = 'registration' AND month_id IS NULL) OR
        (kind = 'monthly' AND month_id IS NOT NULL)
    ),
    CONSTRAINT chk_cancel_reason_on_cancelled CHECK (
        status = 'valid' OR (status = 'cancelled' AND cancel_reason IS NOT NULL)
    )
);

-- Unicité stricte : Un élève ne peut avoir qu'UN SEUL paiement valide pour l'inscription
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_valid_registration_payment 
ON public.payments (student_id, kind) 
WHERE kind = 'registration' AND status = 'valid';

-- Unicité stricte : Un élève ne peut avoir qu'UN SEUL paiement valide par mois scolaire
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_valid_monthly_payment 
ON public.payments (student_id, kind, month_id) 
WHERE kind = 'monthly' AND status = 'valid';

-- ------------------------------------------------------------------------------
-- 8. Table `receipt_sequences` (Garantit des numéros séquentiels stricts par école)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipt_sequences (
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    school_year VARCHAR(20) NOT NULL,
    last_val INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (school_id, school_year)
);

-- ------------------------------------------------------------------------------
-- 9. Table `receipts` (Reçus officiels horodatés avec jeton public)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    receipt_number VARCHAR(50) NOT NULL, -- Ex: REC-2026-0001
    public_token VARCHAR(64) NOT NULL UNIQUE, -- Jeton aléatoire cryptographique pour vérification
    issued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status payment_status NOT NULL DEFAULT 'valid',
    CONSTRAINT uq_school_receipt_number UNIQUE (school_id, receipt_number)
);

-- ------------------------------------------------------------------------------
-- 10. Table `audit_log` (Journal d'audit immuable des modifications et annulations)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 11. Index de performance
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_students_school_class ON public.students(school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_students_active ON public.students(school_id, active);
CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_lookup ON public.payments(school_id, kind, month_id, status);
CREATE INDEX IF NOT EXISTS idx_receipts_token ON public.receipts(public_token);
CREATE INDEX IF NOT EXISTS idx_audit_school_date ON public.audit_log(school_id, created_at DESC);
