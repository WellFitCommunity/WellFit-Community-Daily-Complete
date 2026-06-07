-- Rebuild the 42 CFR Part 2 sensitive-data subsystem (DB-reference drift triage — #6 corrective action)
-- Tracker: docs/trackers/db-reference-drift-triage-tracker.md (#6)
--
-- WHY: The original migration 20260123000003_42_cfr_part2_consent.sql created this entire
-- subsystem and then DROPPED ALL of it in its own `-- migrate:down` block (SYSTEMIC FINDING #1
-- self-destruct under `supabase db push`). Result: 3 tables, 5 functions, RLS, and column
-- additions all absent live; sensitiveDataService has been non-functional since Dec-2025.
-- Confirmed islanded (sensitiveDataService has zero importers; redact fn called nowhere), so there
-- is NO active fail-open exposure — this restores the foundation correctly, fail-closed.
--
-- THREE DELIBERATE CORRECTIONS over the self-destructed original:
--  1. check_sensitive_consent no longer queries the SMART-on-FHIR `patient_consents` table (a
--     name-collision: that is app-access consent and lacks every 42-CFR column the fn needed).
--     It is rebuilt against the DEDICATED cfr42_authorization_log — the actual 42-CFR Part 2
--     authorization record — and is strictly fail-closed (absence of a valid authorization = deny).
--  2. sensitive_data_segments.consent_id is decoupled from the patient_consents FK (same
--     conflation). It is a nullable uuid intended to hold a cfr42_authorization_log.id.
--  3. sensitive_disclosure_log INSERT RLS enforces `disclosed_by = auth.uid()` (was
--     `WITH CHECK (true)`, which made the 42-CFR disclosure audit trail spoofable — see
--     .claude/rules/adversarial-audit-lessons.md §4). The log remains append-only (no UPDATE/DELETE
--     policies → those operations denied under RLS).
--
-- All DEFINER functions are SET search_path = public hardened. No `-- migrate:down` block here.
--
-- ⚠️ AKIMA / COMPLIANCE REVIEW (flagged, not blocking — fail-closed defaults shipped):
--   (a) check_sensitive_consent predicate: requires the segment type to be explicitly listed in an
--       authorization's authorized_disclosures; purpose-level (p_purpose) scoping is NOT yet enforced.
--   (b) tables have no tenant_id (faithful to the original); isolation relies on care_team_members +
--       is_admin. Confirm whether is_admin is global vs tenant-scoped and whether tenant_id is needed.
--   (c) auto-classify-from-diagnosis trigger is intentionally OMITTED (live encounter_diagnoses lacks
--       icd10_code/patient_id; the original left it commented too). Wire after schema alignment.

-- =============================================================================
-- 1. CFR42 AUTHORIZATION LOG (created first — referenced by the others)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cfr42_authorization_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_id text NOT NULL UNIQUE,
    patient_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    purpose text NOT NULL,
    authorized_recipients text[] NOT NULL,
    authorized_disclosures text[],
    authorization_date timestamptz NOT NULL,
    effective_date timestamptz NOT NULL,
    expiration_date timestamptz,
    revoked_at timestamptz,
    revocation_reason text,
    signed_form_url text,
    signature_method text CHECK (signature_method IN ('wet_signature','electronic_signature','verbal_witnessed')),
    witness_id uuid REFERENCES auth.users(id),
    patient_acknowledged_at timestamptz,
    patient_acknowledgment_method text,
    created_by uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cfr42_auth_patient ON public.cfr42_authorization_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_cfr42_auth_active ON public.cfr42_authorization_log(patient_id, revoked_at) WHERE revoked_at IS NULL;

-- =============================================================================
-- 2. SENSITIVE DATA SEGMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sensitive_data_segments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    segment_type text NOT NULL CHECK (segment_type IN (
        'substance_use_disorder','mental_health','hiv_aids','genetic_information',
        'reproductive_health','domestic_violence','minor_treatment','custom'
    )),
    source_table text NOT NULL,
    source_record_id uuid NOT NULL,
    source_field text,
    classification_method text NOT NULL DEFAULT 'manual' CHECK (classification_method IN (
        'manual','icd10_code','cpt_code','ai_detected','patient_reported'
    )),
    icd10_codes text[],
    -- Decoupled from patient_consents (SMART-on-FHIR) to avoid the 42-CFR conflation.
    -- Holds a cfr42_authorization_log.id when consent is recorded; no hard FK to keep the
    -- two consent systems independent.
    consent_id uuid,
    consent_required boolean NOT NULL DEFAULT true,
    consent_obtained boolean DEFAULT false,
    consent_obtained_at timestamptz,
    consent_obtained_by uuid REFERENCES auth.users(id),
    disclosure_prohibited boolean NOT NULL DEFAULT true,
    disclosure_exceptions text[],
    classified_by uuid REFERENCES auth.users(id),
    classified_at timestamptz DEFAULT now(),
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamptz,
    is_active boolean DEFAULT true,
    deactivated_at timestamptz,
    deactivation_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sensitive_segment_unique UNIQUE (patient_id, source_table, source_record_id, source_field)
);
CREATE INDEX IF NOT EXISTS idx_sensitive_segments_patient ON public.sensitive_data_segments(patient_id);
CREATE INDEX IF NOT EXISTS idx_sensitive_segments_type ON public.sensitive_data_segments(segment_type);
CREATE INDEX IF NOT EXISTS idx_sensitive_segments_source ON public.sensitive_data_segments(source_table, source_record_id);
CREATE INDEX IF NOT EXISTS idx_sensitive_segments_consent ON public.sensitive_data_segments(consent_obtained) WHERE NOT consent_obtained;
CREATE INDEX IF NOT EXISTS idx_sensitive_segments_active ON public.sensitive_data_segments(is_active) WHERE is_active = true;

-- =============================================================================
-- 3. DISCLOSURE LOG (append-only audit trail — required by 42 CFR Part 2)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sensitive_disclosure_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    segment_id uuid REFERENCES public.sensitive_data_segments(id),
    recipient_name text NOT NULL,
    recipient_organization text,
    recipient_type text CHECK (recipient_type IN (
        'internal_provider','external_provider','health_plan','patient',
        'legal_representative','court_order','research','public_health','emergency'
    )),
    disclosure_basis text NOT NULL CHECK (disclosure_basis IN (
        'patient_authorization','medical_emergency','court_order','same_entity_treatment',
        'qualified_service_organization','research_waiver','public_health_emergency'
    )),
    authorization_id text REFERENCES public.cfr42_authorization_log(authorization_id),
    disclosed_at timestamptz NOT NULL DEFAULT now(),
    disclosed_by uuid NOT NULL REFERENCES auth.users(id),
    disclosure_method text CHECK (disclosure_method IN (
        'fax','secure_email','patient_portal','direct_exchange','verbal','paper_mail','api'
    )),
    data_types_disclosed text[] NOT NULL,
    record_count integer,
    date_range_start date,
    date_range_end date,
    redisclosure_notice_included boolean DEFAULT true,
    redisclosure_notice_text text DEFAULT '42 CFR Part 2 prohibits redisclosure without patient consent.',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disclosure_log_patient ON public.sensitive_disclosure_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_log_date ON public.sensitive_disclosure_log(disclosed_at DESC);
CREATE INDEX IF NOT EXISTS idx_disclosure_log_segment ON public.sensitive_disclosure_log(segment_id);

-- =============================================================================
-- 4. FUNCTIONS
-- =============================================================================

-- check_sensitive_consent — REBUILT against cfr42_authorization_log (fail-closed).
CREATE OR REPLACE FUNCTION public.check_sensitive_consent(
    p_patient_id uuid,
    p_segment_type text,
    p_purpose text DEFAULT 'treatment'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_consent boolean;
BEGIN
    -- 42 CFR Part 2: SUD/MH disclosure requires a valid patient authorization. Consent EXISTS iff
    -- there is an active (effective now, not expired, not revoked) authorization covering this
    -- segment type. Fail-closed: no qualifying authorization → false. (p_purpose retained for the
    -- caller contract; purpose-level scoping pending Akima review — see migration header.)
    SELECT EXISTS (
        SELECT 1 FROM public.cfr42_authorization_log a
        WHERE a.patient_id = p_patient_id
          AND a.revoked_at IS NULL
          AND a.effective_date <= now()
          AND (a.expiration_date IS NULL OR a.expiration_date > now())
          AND a.authorized_disclosures IS NOT NULL
          AND p_segment_type = ANY(a.authorized_disclosures)
    ) INTO v_has_consent;

    RETURN COALESCE(v_has_consent, false);
END;
$$;

-- get_patient_sensitive_segments — access decision per segment (consent gate).
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
SET search_path = public
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

-- classify_sensitive_from_icd10 — pure classifier, no table deps.
CREATE OR REPLACE FUNCTION public.classify_sensitive_from_icd10(p_icd10_codes text[])
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    code text;
BEGIN
    FOREACH code IN ARRAY p_icd10_codes
    LOOP
        IF code ~ '^F1[0-9]' THEN RETURN 'substance_use_disorder'; END IF;
        IF code ~ '^F(2[0-9]|3[0-9]|4[0-8])' THEN RETURN 'mental_health'; END IF;
        IF code ~ '^B2[0-4]|^Z21' THEN RETURN 'hiv_aids'; END IF;
        IF code ~ '^Q' THEN RETURN 'genetic_information'; END IF;
    END LOOP;
    RETURN NULL;
END;
$$;

-- redact_sensitive_fhir_data — redacts sensitive resources in a FHIR bundle for export.
CREATE OR REPLACE FUNCTION public.redact_sensitive_fhir_data(
    p_patient_id uuid,
    p_fhir_bundle jsonb,
    p_authorized_segments text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_entry jsonb;
    v_entries jsonb := '[]'::jsonb;
    v_resource_id text;
    v_is_sensitive boolean;
BEGIN
    FOR v_entry IN SELECT jsonb_array_elements(p_fhir_bundle->'entry')
    LOOP
        v_resource_id := v_entry->'resource'->>'id';

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

    v_result := jsonb_set(p_fhir_bundle, '{entry}', v_entries);
    RETURN v_result;
END;
$$;

-- =============================================================================
-- 5. updated_at TRIGGERS
-- =============================================================================
CREATE TRIGGER trg_sensitive_segments_updated_at
    BEFORE UPDATE ON public.sensitive_data_segments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_cfr42_auth_updated_at
    BEFORE UPDATE ON public.cfr42_authorization_log
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.sensitive_data_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cfr42_authorization_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensitive_disclosure_log ENABLE ROW LEVEL SECURITY;

-- Sensitive segments: admin, or care-team member WITH consent (fail-closed).
CREATE POLICY sensitive_segments_access ON public.sensitive_data_segments
    FOR SELECT TO authenticated
    USING (
        public.is_admin(auth.uid())
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
    WITH CHECK (public.is_admin(auth.uid()) OR classified_by = auth.uid());

CREATE POLICY sensitive_segments_update ON public.sensitive_data_segments
    FOR UPDATE TO authenticated
    USING (public.is_admin(auth.uid()) OR classified_by = auth.uid());

-- CFR42 authorizations: patient, creator, or admin.
CREATE POLICY cfr42_auth_access ON public.cfr42_authorization_log
    FOR ALL TO authenticated
    USING (patient_id = auth.uid() OR created_by = auth.uid() OR public.is_admin(auth.uid()));

-- Disclosure log: admin or own-disclosures read; INSERT identity-enforced; append-only (no UPDATE/DELETE).
CREATE POLICY disclosure_log_select ON public.sensitive_disclosure_log
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()) OR disclosed_by = auth.uid());

CREATE POLICY disclosure_log_insert ON public.sensitive_disclosure_log
    FOR INSERT TO authenticated
    WITH CHECK (disclosed_by = auth.uid());

-- =============================================================================
-- 7. GRANTS + COMMENTS
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.check_sensitive_consent(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_sensitive_segments(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.classify_sensitive_from_icd10(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redact_sensitive_fhir_data(uuid, jsonb, text[]) TO authenticated;

COMMENT ON TABLE public.sensitive_data_segments IS '42 CFR Part 2 / SUD-MH sensitive data segmentation. Consent gated via cfr42_authorization_log.';
COMMENT ON TABLE public.cfr42_authorization_log IS '42 CFR Part 2 patient authorizations (the consent record check_sensitive_consent reads).';
COMMENT ON TABLE public.sensitive_disclosure_log IS 'Append-only 42 CFR Part 2 disclosure audit trail. INSERT identity-enforced (disclosed_by = auth.uid()); no UPDATE/DELETE.';
COMMENT ON FUNCTION public.check_sensitive_consent(uuid, text, text) IS 'Fail-closed 42-CFR consent gate: true iff an active, non-revoked, in-effect cfr42 authorization lists the segment type. Rebuilt 2026-06-07 (was wrongly bound to SMART patient_consents).';
