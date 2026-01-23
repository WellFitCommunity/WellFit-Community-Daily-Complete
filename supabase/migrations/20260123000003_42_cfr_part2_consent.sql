-- Migration: 42 CFR Part 2 Consent and Sensitive Data Segmentation
-- Purpose: Extend consent system with substance use disorder (SUD) and mental health protections
-- Compliance: 42 CFR Part 2 (Substance Abuse), HIPAA § 164.508, State Mental Health Laws
-- migrate:up

BEGIN;

-- =============================================================================
-- 1. ADD SPECIAL CATEGORY TO EXISTING CONSENT TABLES
-- =============================================================================

-- Add special_category column to patient_consents for 42 CFR Part 2 protected data
ALTER TABLE public.patient_consents
ADD COLUMN IF NOT EXISTS special_category text CHECK (special_category IN (
    'none',
    'substance_use_disorder',    -- 42 CFR Part 2
    'mental_health',             -- State mental health laws
    'hiv_aids',                  -- HIV/AIDS specific protections
    'genetic_information',       -- GINA protected
    'reproductive_health',       -- State reproductive health laws
    'domestic_violence',         -- Sensitive safety data
    'minor_treatment'            -- Minor consent for sensitive services
)),
ADD COLUMN IF NOT EXISTS cfr42_authorization_id text,  -- Authorization form ID
ADD COLUMN IF NOT EXISTS requires_explicit_consent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS redisclosure_prohibited boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS authorization_expires_at timestamptz;

-- Add index for special category lookups
CREATE INDEX IF NOT EXISTS idx_patient_consents_special_category
ON public.patient_consents(special_category)
WHERE special_category IS NOT NULL AND special_category != 'none';

-- Add special category to consent policies (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patient_consent_policies') THEN
    ALTER TABLE public.patient_consent_policies
    ADD COLUMN IF NOT EXISTS special_category text CHECK (special_category IN (
        'none',
        'substance_use_disorder',
        'mental_health',
        'hiv_aids',
        'genetic_information',
        'reproductive_health',
        'domestic_violence',
        'minor_treatment'
    )),
    ADD COLUMN IF NOT EXISTS federal_regulation text,
    ADD COLUMN IF NOT EXISTS state_regulation text,
    ADD COLUMN IF NOT EXISTS requires_written_consent boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS minimum_consent_age integer;
  END IF;
END $$;

-- =============================================================================
-- 2. SENSITIVE DATA SEGMENTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sensitive_data_segments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Patient link
    patient_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,

    -- Segment classification
    segment_type text NOT NULL CHECK (segment_type IN (
        'substance_use_disorder',
        'mental_health',
        'hiv_aids',
        'genetic_information',
        'reproductive_health',
        'domestic_violence',
        'minor_treatment',
        'custom'
    )),

    -- Data source/reference
    source_table text NOT NULL,           -- e.g., 'clinical_notes', 'diagnoses', 'encounters'
    source_record_id uuid NOT NULL,       -- FK to the source record
    source_field text,                    -- Specific field if partial segmentation

    -- Classification metadata
    classification_method text NOT NULL DEFAULT 'manual' CHECK (classification_method IN (
        'manual',               -- Clinician marked
        'icd10_code',           -- Auto-detected from diagnosis codes
        'cpt_code',             -- Auto-detected from procedure codes
        'ai_detected',          -- AI flagged as potentially sensitive
        'patient_reported'      -- Patient self-identified
    )),

    icd10_codes text[],                   -- ICD-10 codes that triggered classification
    -- SUD: F10-F19 (Mental/behavioral disorders due to substance use)
    -- MH: F01-F99 (Mental, Behavioral and Neurodevelopmental disorders)

    -- Consent tracking
    consent_id uuid REFERENCES public.patient_consents(id),
    consent_required boolean NOT NULL DEFAULT true,
    consent_obtained boolean DEFAULT false,
    consent_obtained_at timestamptz,
    consent_obtained_by uuid REFERENCES auth.users(id),

    -- Disclosure tracking
    disclosure_prohibited boolean NOT NULL DEFAULT true,
    disclosure_exceptions text[],         -- 'medical_emergency', 'court_order', 'treatment_same_entity'

    -- Audit
    classified_by uuid REFERENCES auth.users(id),
    classified_at timestamptz DEFAULT now(),
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamptz,

    -- Status
    is_active boolean DEFAULT true,
    deactivated_at timestamptz,
    deactivation_reason text,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT sensitive_segment_unique UNIQUE (patient_id, source_table, source_record_id, source_field)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sensitive_segments_patient ON public.sensitive_data_segments(patient_id);
CREATE INDEX IF NOT EXISTS idx_sensitive_segments_type ON public.sensitive_data_segments(segment_type);
CREATE INDEX IF NOT EXISTS idx_sensitive_segments_source ON public.sensitive_data_segments(source_table, source_record_id);
CREATE INDEX IF NOT EXISTS idx_sensitive_segments_consent ON public.sensitive_data_segments(consent_obtained) WHERE NOT consent_obtained;
CREATE INDEX IF NOT EXISTS idx_sensitive_segments_active ON public.sensitive_data_segments(is_active) WHERE is_active = true;

-- =============================================================================
-- 3. CFR42 AUTHORIZATION LOG TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cfr42_authorization_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Authorization details
    authorization_id text NOT NULL UNIQUE,   -- External authorization form ID
    patient_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,

    -- Authorization scope
    purpose text NOT NULL,                    -- 'treatment', 'payment', 'coordination_of_care', etc.
    authorized_recipients text[] NOT NULL,    -- List of authorized recipients
    authorized_disclosures text[],            -- Types of info authorized for disclosure

    -- Validity
    authorization_date timestamptz NOT NULL,
    effective_date timestamptz NOT NULL,
    expiration_date timestamptz,              -- NULL = no expiration (valid until revoked)
    revoked_at timestamptz,
    revocation_reason text,

    -- Document reference
    signed_form_url text,
    signature_method text CHECK (signature_method IN (
        'wet_signature',
        'electronic_signature',
        'verbal_witnessed'
    )),
    witness_id uuid REFERENCES auth.users(id),

    -- Patient acknowledgment
    patient_acknowledged_at timestamptz,
    patient_acknowledgment_method text,

    -- Audit
    created_by uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cfr42_auth_patient ON public.cfr42_authorization_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_cfr42_auth_active ON public.cfr42_authorization_log(patient_id, revoked_at)
WHERE revoked_at IS NULL;

-- =============================================================================
-- 4. DISCLOSURE LOG TABLE (Required by 42 CFR Part 2)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sensitive_disclosure_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What was disclosed
    patient_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    segment_id uuid REFERENCES public.sensitive_data_segments(id),

    -- To whom
    recipient_name text NOT NULL,
    recipient_organization text,
    recipient_type text CHECK (recipient_type IN (
        'internal_provider',
        'external_provider',
        'health_plan',
        'patient',
        'legal_representative',
        'court_order',
        'research',
        'public_health',
        'emergency'
    )),

    -- Authorization basis
    disclosure_basis text NOT NULL CHECK (disclosure_basis IN (
        'patient_authorization',
        'medical_emergency',
        'court_order',
        'same_entity_treatment',
        'qualified_service_organization',
        'research_waiver',
        'public_health_emergency'
    )),
    authorization_id text REFERENCES public.cfr42_authorization_log(authorization_id),

    -- Disclosure details
    disclosed_at timestamptz NOT NULL DEFAULT now(),
    disclosed_by uuid NOT NULL REFERENCES auth.users(id),
    disclosure_method text CHECK (disclosure_method IN (
        'fax',
        'secure_email',
        'patient_portal',
        'direct_exchange',
        'verbal',
        'paper_mail',
        'api'
    )),

    -- Content tracking
    data_types_disclosed text[] NOT NULL,    -- 'diagnoses', 'medications', 'notes', etc.
    record_count integer,
    date_range_start date,
    date_range_end date,

    -- Redisclosure notice
    redisclosure_notice_included boolean DEFAULT true,
    redisclosure_notice_text text DEFAULT '42 CFR Part 2 prohibits redisclosure without patient consent.',

    -- Audit
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_disclosure_log_patient ON public.sensitive_disclosure_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_log_date ON public.sensitive_disclosure_log(disclosed_at DESC);
CREATE INDEX IF NOT EXISTS idx_disclosure_log_segment ON public.sensitive_disclosure_log(segment_id);

-- =============================================================================
-- 5. FUNCTIONS FOR SENSITIVE DATA HANDLING
-- =============================================================================

-- Function: Check if patient has active consent for sensitive data type
CREATE OR REPLACE FUNCTION public.check_sensitive_consent(
    p_patient_id uuid,
    p_segment_type text,
    p_purpose text DEFAULT 'treatment'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_has_consent boolean;
BEGIN
    -- Check for active consent matching the segment type and purpose
    SELECT EXISTS (
        SELECT 1 FROM public.patient_consents pc
        WHERE pc.patient_id = p_patient_id
        AND pc.special_category = p_segment_type
        AND pc.consent_given = true
        AND pc.withdrawn_at IS NULL
        AND (pc.expiration_date IS NULL OR pc.expiration_date > now())
        AND (pc.authorization_expires_at IS NULL OR pc.authorization_expires_at > now())
        -- Check sharing permissions for the specific purpose
        AND (
            pc.sharing_permissions IS NULL
            OR pc.sharing_permissions->>'purposes' IS NULL
            OR pc.sharing_permissions->'purposes' ? p_purpose
        )
    ) INTO v_has_consent;

    RETURN v_has_consent;
END;
$$;

-- Function: Get patient's sensitive data segments
CREATE OR REPLACE FUNCTION public.get_patient_sensitive_segments(
    p_patient_id uuid,
    p_requesting_user_id uuid
)
RETURNS TABLE (
    segment_id uuid,
    segment_type text,
    source_table text,
    source_record_id uuid,
    consent_obtained boolean,
    can_access boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sds.id AS segment_id,
        sds.segment_type,
        sds.source_table,
        sds.source_record_id,
        sds.consent_obtained,
        CASE
            WHEN NOT sds.consent_required THEN true
            WHEN sds.consent_obtained THEN true
            WHEN public.check_sensitive_consent(p_patient_id, sds.segment_type, 'treatment') THEN true
            ELSE false
        END AS can_access
    FROM public.sensitive_data_segments sds
    WHERE sds.patient_id = p_patient_id
    AND sds.is_active = true;
END;
$$;

-- Function: Auto-classify sensitive data from ICD-10 codes
CREATE OR REPLACE FUNCTION public.classify_sensitive_from_icd10(
    p_icd10_codes text[]
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    code text;
BEGIN
    FOREACH code IN ARRAY p_icd10_codes
    LOOP
        -- Substance Use Disorder codes (F10-F19)
        IF code ~ '^F1[0-9]' THEN
            RETURN 'substance_use_disorder';
        END IF;

        -- Mental Health codes (F20-F48: Schizophrenia, Mood, Anxiety disorders)
        IF code ~ '^F(2[0-9]|3[0-9]|4[0-8])' THEN
            RETURN 'mental_health';
        END IF;

        -- HIV/AIDS codes
        IF code ~ '^B2[0-4]|^Z21' THEN
            RETURN 'hiv_aids';
        END IF;

        -- Genetic conditions (certain congenital codes)
        IF code ~ '^Q' THEN
            RETURN 'genetic_information';
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$;

-- Function: Redact sensitive data in FHIR export
CREATE OR REPLACE FUNCTION public.redact_sensitive_fhir_data(
    p_patient_id uuid,
    p_fhir_bundle jsonb,
    p_authorized_segments text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
    v_entry jsonb;
    v_entries jsonb := '[]'::jsonb;
    v_resource_id text;
    v_is_sensitive boolean;
BEGIN
    -- Get list of sensitive segment IDs for this patient
    -- If no specific authorization, redact all sensitive data

    -- Process each entry in the bundle
    FOR v_entry IN SELECT jsonb_array_elements(p_fhir_bundle->'entry')
    LOOP
        v_resource_id := v_entry->'resource'->>'id';

        -- Check if this resource is marked as sensitive
        SELECT EXISTS (
            SELECT 1 FROM public.sensitive_data_segments sds
            WHERE sds.patient_id = p_patient_id
            AND sds.source_record_id::text = v_resource_id
            AND sds.is_active = true
            AND (
                p_authorized_segments IS NULL
                OR NOT (sds.segment_type = ANY(p_authorized_segments))
            )
        ) INTO v_is_sensitive;

        IF v_is_sensitive THEN
            -- Redact the resource - replace with minimal placeholder
            v_entry := jsonb_build_object(
                'fullUrl', v_entry->'fullUrl',
                'resource', jsonb_build_object(
                    'resourceType', v_entry->'resource'->>'resourceType',
                    'id', v_resource_id,
                    'meta', jsonb_build_object(
                        'security', jsonb_build_array(
                            jsonb_build_object(
                                'system', 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                                'code', 'REDACTED',
                                'display', 'Redacted - 42 CFR Part 2 Protected'
                            )
                        )
                    ),
                    'text', jsonb_build_object(
                        'status', 'generated',
                        'div', '<div xmlns="http://www.w3.org/1999/xhtml">[REDACTED - Protected Health Information]</div>'
                    )
                )
            );
        END IF;

        v_entries := v_entries || v_entry;
    END LOOP;

    -- Rebuild bundle with potentially redacted entries
    v_result := jsonb_set(p_fhir_bundle, '{entry}', v_entries);

    RETURN v_result;
END;
$$;

-- =============================================================================
-- 6. TRIGGERS
-- =============================================================================

-- Trigger: Auto-classify sensitive data on diagnosis insert
CREATE OR REPLACE FUNCTION public.auto_classify_sensitive_diagnosis()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_segment_type text;
BEGIN
    -- Get segment type from ICD-10 code
    v_segment_type := public.classify_sensitive_from_icd10(ARRAY[NEW.icd10_code]);

    IF v_segment_type IS NOT NULL THEN
        INSERT INTO public.sensitive_data_segments (
            patient_id,
            segment_type,
            source_table,
            source_record_id,
            classification_method,
            icd10_codes,
            consent_required
        ) VALUES (
            NEW.patient_id,
            v_segment_type,
            'encounter_diagnoses',
            NEW.id,
            'icd10_code',
            ARRAY[NEW.icd10_code],
            true
        )
        ON CONFLICT (patient_id, source_table, source_record_id, source_field)
        DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- Note: Create the trigger only if encounter_diagnoses has patient_id
-- This may need adjustment based on actual schema
-- DROP TRIGGER IF EXISTS trg_auto_classify_sensitive ON public.encounter_diagnoses;
-- CREATE TRIGGER trg_auto_classify_sensitive
--     AFTER INSERT ON public.encounter_diagnoses
--     FOR EACH ROW EXECUTE FUNCTION public.auto_classify_sensitive_diagnosis();

-- Trigger: Update timestamps
CREATE TRIGGER trg_sensitive_segments_updated_at
BEFORE UPDATE ON public.sensitive_data_segments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_cfr42_auth_updated_at
BEFORE UPDATE ON public.cfr42_authorization_log
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 7. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.sensitive_data_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cfr42_authorization_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensitive_disclosure_log ENABLE ROW LEVEL SECURITY;

-- Sensitive segments: Only accessible with proper consent or by admin
CREATE POLICY sensitive_segments_access ON public.sensitive_data_segments
    FOR SELECT TO authenticated
    USING (
        -- Admin access
        public.is_admin(auth.uid())
        -- Or care team member with consent
        OR (
            EXISTS (
                SELECT 1 FROM public.care_team_members ctm
                WHERE ctm.patient_id = sensitive_data_segments.patient_id
                AND ctm.member_id = auth.uid()
            )
            AND (
                NOT consent_required
                OR consent_obtained
                OR public.check_sensitive_consent(patient_id, segment_type, 'treatment')
            )
        )
    );

CREATE POLICY sensitive_segments_insert ON public.sensitive_data_segments
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin(auth.uid())
        OR classified_by = auth.uid()
    );

CREATE POLICY sensitive_segments_update ON public.sensitive_data_segments
    FOR UPDATE TO authenticated
    USING (
        public.is_admin(auth.uid())
        OR classified_by = auth.uid()
    );

-- CFR42 authorizations: Patient or admin access
CREATE POLICY cfr42_auth_access ON public.cfr42_authorization_log
    FOR ALL TO authenticated
    USING (
        patient_id = auth.uid()
        OR created_by = auth.uid()
        OR public.is_admin(auth.uid())
    );

-- Disclosure log: Admin only (audit trail)
CREATE POLICY disclosure_log_select ON public.sensitive_disclosure_log
    FOR SELECT TO authenticated
    USING (
        public.is_admin(auth.uid())
        OR disclosed_by = auth.uid()
    );

CREATE POLICY disclosure_log_insert ON public.sensitive_disclosure_log
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- =============================================================================
-- 8. COMMENTS
-- =============================================================================

COMMENT ON TABLE public.sensitive_data_segments IS '42 CFR Part 2 and state-protected sensitive data segments with consent tracking';
COMMENT ON TABLE public.cfr42_authorization_log IS 'Patient authorizations for disclosure of 42 CFR Part 2 protected information';
COMMENT ON TABLE public.sensitive_disclosure_log IS 'Audit log of all disclosures of sensitive/protected health information';

COMMENT ON FUNCTION public.check_sensitive_consent IS 'Check if patient has active consent for accessing sensitive data type';
COMMENT ON FUNCTION public.classify_sensitive_from_icd10 IS 'Auto-classify sensitive data category from ICD-10 diagnosis codes';
COMMENT ON FUNCTION public.redact_sensitive_fhir_data IS 'Redact 42 CFR Part 2 protected data from FHIR bundles';

COMMIT;

-- migrate:down
BEGIN;

DROP TABLE IF EXISTS public.sensitive_disclosure_log CASCADE;
DROP TABLE IF EXISTS public.cfr42_authorization_log CASCADE;
DROP TABLE IF EXISTS public.sensitive_data_segments CASCADE;

DROP FUNCTION IF EXISTS public.check_sensitive_consent CASCADE;
DROP FUNCTION IF EXISTS public.get_patient_sensitive_segments CASCADE;
DROP FUNCTION IF EXISTS public.classify_sensitive_from_icd10 CASCADE;
DROP FUNCTION IF EXISTS public.redact_sensitive_fhir_data CASCADE;
DROP FUNCTION IF EXISTS public.auto_classify_sensitive_diagnosis CASCADE;

ALTER TABLE public.patient_consents
DROP COLUMN IF EXISTS special_category,
DROP COLUMN IF EXISTS cfr42_authorization_id,
DROP COLUMN IF EXISTS requires_explicit_consent,
DROP COLUMN IF EXISTS redisclosure_prohibited,
DROP COLUMN IF EXISTS authorization_expires_at;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patient_consent_policies') THEN
    ALTER TABLE public.patient_consent_policies
    DROP COLUMN IF EXISTS special_category,
    DROP COLUMN IF EXISTS federal_regulation,
    DROP COLUMN IF EXISTS state_regulation,
    DROP COLUMN IF EXISTS requires_written_consent,
    DROP COLUMN IF EXISTS minimum_consent_age;
  END IF;
END $$;

COMMIT;
