-- =====================================================
-- Patient Consents for Third-Party App Access
-- =====================================================
-- Purpose: Track patient consent for SMART on FHIR app access
--          Separate from privacy_consent which handles general consents
-- Compliance: 21st Century Cures Act, HIPAA, ONC Cures Act Final Rule
-- Created: 2025-12-26
-- =====================================================

-- This table specifically tracks consent for third-party healthcare apps
-- to access patient data via SMART on FHIR / FHIR R4 APIs.

CREATE TABLE IF NOT EXISTS public.patient_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Patient reference
    patient_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- What this consent is for
    consent_category TEXT NOT NULL DEFAULT 'third_party_app' CHECK (
        consent_category IN (
            'third_party_app',      -- SMART on FHIR app access
            'data_sharing',         -- General data sharing with external systems
            'research',             -- Research study participation
            'health_information_exchange'  -- HIE participation
        )
    ),

    -- Consent scope details
    purpose TEXT NOT NULL,              -- Human-readable purpose (e.g., "Access your medications via Apple Health")
    scopes_granted TEXT[],              -- FHIR scopes granted (e.g., ['patient/MedicationRequest.read'])
    data_categories TEXT[],             -- USCDI categories covered (e.g., ['medications', 'allergies'])

    -- External app/system reference (nullable - set when linked to SMART app)
    external_app_id UUID,               -- Links to smart_registered_apps when created
    external_system_name TEXT,          -- Name of external system for display

    -- Consent lifecycle
    status TEXT NOT NULL DEFAULT 'active' CHECK (
        status IN ('active', 'expired', 'revoked', 'pending')
    ),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,             -- NULL = no expiration
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id),
    revocation_reason TEXT,

    -- Consent capture details
    consent_method TEXT NOT NULL DEFAULT 'electronic' CHECK (
        consent_method IN ('electronic', 'verbal', 'written', 'delegated')
    ),
    consent_document_url TEXT,          -- URL to signed consent document if applicable

    -- Delegated consent (for caregivers)
    granted_by UUID REFERENCES auth.users(id),  -- If different from patient (e.g., caregiver)
    relationship_to_patient TEXT,       -- e.g., 'legal_guardian', 'healthcare_proxy'

    -- Audit trail
    ip_address INET,
    user_agent TEXT,
    audit_log JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_patient_consents_patient ON public.patient_consents(patient_id);
CREATE INDEX idx_patient_consents_tenant ON public.patient_consents(tenant_id);
CREATE INDEX idx_patient_consents_status ON public.patient_consents(status) WHERE status = 'active';
CREATE INDEX idx_patient_consents_app ON public.patient_consents(external_app_id) WHERE external_app_id IS NOT NULL;
CREATE INDEX idx_patient_consents_category ON public.patient_consents(consent_category);
CREATE INDEX idx_patient_consents_expires ON public.patient_consents(expires_at) WHERE expires_at IS NOT NULL;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "patient_consents_service_all" ON public.patient_consents
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Patients can view their own consents
CREATE POLICY "patient_consents_patient_select" ON public.patient_consents
    FOR SELECT TO authenticated
    USING (patient_id = auth.uid() OR granted_by = auth.uid());

-- Patients can insert their own consents
CREATE POLICY "patient_consents_patient_insert" ON public.patient_consents
    FOR INSERT TO authenticated
    WITH CHECK (patient_id = auth.uid() OR granted_by = auth.uid());

-- Patients can update their own consents (revoke)
CREATE POLICY "patient_consents_patient_update" ON public.patient_consents
    FOR UPDATE TO authenticated
    USING (patient_id = auth.uid() OR granted_by = auth.uid())
    WITH CHECK (patient_id = auth.uid() OR granted_by = auth.uid());

-- Tenant-based isolation
CREATE POLICY "patient_consents_tenant" ON public.patient_consents
    FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() OR tenant_id IS NULL);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_patient_consents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();

    -- Auto-append to audit log on updates
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        NEW.audit_log = COALESCE(NEW.audit_log, '[]'::jsonb) || jsonb_build_array(
            jsonb_build_object(
                'action', 'status_change',
                'from', OLD.status,
                'to', NEW.status,
                'timestamp', NOW(),
                'by', auth.uid()
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_patient_consents_updated_at
    BEFORE UPDATE ON public.patient_consents
    FOR EACH ROW EXECUTE FUNCTION update_patient_consents_updated_at();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Check if patient has active consent for a specific app
CREATE OR REPLACE FUNCTION has_active_app_consent(
    p_patient_id UUID,
    p_app_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.patient_consents
        WHERE patient_id = p_patient_id
        AND external_app_id = p_app_id
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get active consents for a patient
CREATE OR REPLACE FUNCTION get_patient_active_consents(p_patient_id UUID)
RETURNS SETOF public.patient_consents AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.patient_consents
    WHERE patient_id = p_patient_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY granted_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Revoke consent
CREATE OR REPLACE FUNCTION revoke_patient_consent(
    p_consent_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_patient_id UUID;
BEGIN
    -- Get patient_id for authorization check
    SELECT patient_id INTO v_patient_id
    FROM public.patient_consents
    WHERE id = p_consent_id;

    -- Verify caller is the patient or has permission
    IF v_patient_id != auth.uid() THEN
        RAISE EXCEPTION 'Not authorized to revoke this consent';
    END IF;

    UPDATE public.patient_consents
    SET status = 'revoked',
        revoked_at = NOW(),
        revoked_by = auth.uid(),
        revocation_reason = p_reason
    WHERE id = p_consent_id
    AND status = 'active';

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON public.patient_consents TO authenticated;
GRANT ALL ON public.patient_consents TO service_role;
GRANT EXECUTE ON FUNCTION has_active_app_consent TO authenticated;
GRANT EXECUTE ON FUNCTION get_patient_active_consents TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_patient_consent TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.patient_consents IS 'Patient consent records for third-party app access (SMART on FHIR) and data sharing';
COMMENT ON COLUMN public.patient_consents.external_app_id IS 'Links to smart_registered_apps table when consent is for SMART app';
COMMENT ON COLUMN public.patient_consents.scopes_granted IS 'FHIR/OAuth scopes the patient consented to (e.g., patient/MedicationRequest.read)';
COMMENT ON COLUMN public.patient_consents.data_categories IS 'USCDI data categories covered by this consent';
