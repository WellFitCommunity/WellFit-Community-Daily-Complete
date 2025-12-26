-- =====================================================
-- SMART on FHIR App Registration System
-- =====================================================
-- Purpose: Enable external healthcare apps to connect to
--          Envision Atlus via SMART on FHIR / OAuth2
-- Compliance: 21st Century Cures Act, ONC Cures Act Final Rule
-- Created: 2025-12-26
-- =====================================================

-- =====================================================
-- 1. REGISTERED APPS TABLE
-- =====================================================
-- Stores third-party healthcare apps that can connect to Envision Atlus

CREATE TABLE IF NOT EXISTS public.smart_registered_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- App identification
    client_id TEXT NOT NULL UNIQUE,
    client_name TEXT NOT NULL,
    client_description TEXT,
    client_uri TEXT, -- App's homepage
    logo_uri TEXT,

    -- OAuth2 settings
    client_secret_hash TEXT, -- NULL for public clients (PKCE only)
    is_confidential BOOLEAN NOT NULL DEFAULT false, -- true = has secret, false = public client
    redirect_uris TEXT[] NOT NULL,

    -- SMART on FHIR settings
    launch_uri TEXT, -- For EHR launch flow
    scopes_allowed TEXT[] NOT NULL DEFAULT ARRAY['patient/*.read', 'openid', 'fhirUser'],

    -- Security
    pkce_required BOOLEAN NOT NULL DEFAULT true, -- Required for public clients
    token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none' CHECK (
        token_endpoint_auth_method IN ('none', 'client_secret_basic', 'client_secret_post', 'private_key_jwt')
    ),
    jwks_uri TEXT, -- For private_key_jwt authentication

    -- App categorization
    app_type TEXT NOT NULL DEFAULT 'patient' CHECK (
        app_type IN ('patient', 'provider', 'system', 'research')
    ),

    -- Approval status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rejected', 'suspended', 'revoked')
    ),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    rejection_reason TEXT,

    -- Contact info
    developer_name TEXT,
    developer_email TEXT,
    tos_uri TEXT, -- Terms of service
    policy_uri TEXT, -- Privacy policy

    -- Statistics
    total_authorizations INTEGER DEFAULT 0,
    active_authorizations INTEGER DEFAULT 0,
    last_authorization_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_smart_apps_client_id ON public.smart_registered_apps(client_id);
CREATE INDEX idx_smart_apps_tenant ON public.smart_registered_apps(tenant_id);
CREATE INDEX idx_smart_apps_status ON public.smart_registered_apps(status) WHERE status = 'approved';
CREATE INDEX idx_smart_apps_type ON public.smart_registered_apps(app_type);

-- =====================================================
-- 2. AUTHORIZATION CODES TABLE
-- =====================================================
-- Temporary codes during OAuth2 authorization flow

CREATE TABLE IF NOT EXISTS public.smart_auth_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- OAuth2 flow
    code TEXT NOT NULL UNIQUE,
    app_id UUID NOT NULL REFERENCES public.smart_registered_apps(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,

    -- PKCE
    code_challenge TEXT,
    code_challenge_method TEXT CHECK (code_challenge_method IN ('S256', 'plain')),

    -- Request parameters
    redirect_uri TEXT NOT NULL,
    scopes_requested TEXT[] NOT NULL,
    scopes_granted TEXT[] NOT NULL,
    state TEXT, -- Client's state parameter

    -- Security
    used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMPTZ,

    -- Expiration (typically 10 minutes)
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Indexes
CREATE INDEX idx_smart_auth_codes_code ON public.smart_auth_codes(code) WHERE used = false;
CREATE INDEX idx_smart_auth_codes_expires ON public.smart_auth_codes(expires_at);

-- Auto-cleanup expired codes
CREATE OR REPLACE FUNCTION cleanup_expired_auth_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM public.smart_auth_codes
    WHERE expires_at < NOW() OR (used = true AND used_at < NOW() - INTERVAL '1 hour');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. PATIENT AUTHORIZATIONS TABLE
-- =====================================================
-- Long-term record of patient authorizations (links to consent system)
-- NOTE: Created before access_tokens due to foreign key reference

CREATE TABLE IF NOT EXISTS public.smart_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    app_id UUID NOT NULL REFERENCES public.smart_registered_apps(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    consent_id UUID REFERENCES public.patient_consents(id), -- Links to consent system

    -- Authorization details
    scopes_granted TEXT[] NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (
        status IN ('active', 'revoked', 'expired')
    ),

    -- Temporal
    authorized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- NULL = no expiration
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,

    -- Last activity
    last_access_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,

    -- Ensure one active authorization per app/patient
    UNIQUE(app_id, patient_id)
);

-- Indexes
CREATE INDEX idx_smart_auth_patient ON public.smart_authorizations(patient_id);
CREATE INDEX idx_smart_auth_app ON public.smart_authorizations(app_id);
CREATE INDEX idx_smart_auth_status ON public.smart_authorizations(status) WHERE status = 'active';
CREATE INDEX idx_smart_auth_consent ON public.smart_authorizations(consent_id);

-- =====================================================
-- 4. ACCESS TOKENS TABLE
-- =====================================================
-- Active access and refresh tokens

CREATE TABLE IF NOT EXISTS public.smart_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Token identification
    access_token TEXT NOT NULL UNIQUE,
    refresh_token TEXT UNIQUE,

    -- References
    app_id UUID NOT NULL REFERENCES public.smart_registered_apps(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    authorization_id UUID REFERENCES public.smart_authorizations(id) ON DELETE CASCADE,

    -- Granted scopes
    scopes TEXT[] NOT NULL,

    -- Token lifecycle
    access_token_expires_at TIMESTAMPTZ NOT NULL,
    refresh_token_expires_at TIMESTAMPTZ, -- NULL = no refresh token

    -- Revocation
    revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,

    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    use_count INTEGER DEFAULT 0,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Indexes
CREATE INDEX idx_smart_tokens_access ON public.smart_access_tokens(access_token) WHERE revoked = false;
CREATE INDEX idx_smart_tokens_refresh ON public.smart_access_tokens(refresh_token) WHERE revoked = false;
CREATE INDEX idx_smart_tokens_patient ON public.smart_access_tokens(patient_id);
CREATE INDEX idx_smart_tokens_app ON public.smart_access_tokens(app_id);
CREATE INDEX idx_smart_tokens_expires ON public.smart_access_tokens(access_token_expires_at);

-- =====================================================
-- 5. AUDIT LOG TABLE
-- =====================================================
-- Tracks all SMART/OAuth2 operations for compliance

CREATE TABLE IF NOT EXISTS public.smart_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event details
    event_type TEXT NOT NULL CHECK (event_type IN (
        'app_registered',
        'app_approved',
        'app_rejected',
        'app_suspended',
        'authorization_requested',
        'authorization_granted',
        'authorization_denied',
        'authorization_revoked',
        'token_issued',
        'token_refreshed',
        'token_revoked',
        'resource_accessed',
        'access_denied'
    )),

    -- References (nullable depending on event)
    app_id UUID REFERENCES public.smart_registered_apps(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    token_id UUID REFERENCES public.smart_access_tokens(id) ON DELETE SET NULL,
    authorization_id UUID REFERENCES public.smart_authorizations(id) ON DELETE SET NULL,

    -- Details
    details JSONB DEFAULT '{}'::jsonb,
    resource_type TEXT, -- e.g., 'Patient', 'Observation'
    resource_id TEXT,

    -- Request context
    ip_address INET,
    user_agent TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_smart_audit_event ON public.smart_audit_log(event_type, created_at);
CREATE INDEX idx_smart_audit_app ON public.smart_audit_log(app_id, created_at);
CREATE INDEX idx_smart_audit_patient ON public.smart_audit_log(patient_id, created_at);
CREATE INDEX idx_smart_audit_time ON public.smart_audit_log(created_at);

-- =====================================================
-- 6. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.smart_registered_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_auth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "smart_apps_service_all" ON public.smart_registered_apps
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "smart_auth_codes_service_all" ON public.smart_auth_codes
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "smart_tokens_service_all" ON public.smart_access_tokens
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "smart_authorizations_service_all" ON public.smart_authorizations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "smart_audit_service_all" ON public.smart_audit_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Patients can view their own authorizations
CREATE POLICY "smart_authorizations_patient_view" ON public.smart_authorizations
    FOR SELECT TO authenticated
    USING (patient_id = auth.uid());

-- Patients can view their own tokens
CREATE POLICY "smart_tokens_patient_view" ON public.smart_access_tokens
    FOR SELECT TO authenticated
    USING (patient_id = auth.uid());

-- Patients can view approved apps
CREATE POLICY "smart_apps_public_view" ON public.smart_registered_apps
    FOR SELECT TO authenticated
    USING (status = 'approved');

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Generate secure random client_id
CREATE OR REPLACE FUNCTION generate_smart_client_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'ea_' || encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Generate secure client_secret (returns plain text, store hash)
CREATE OR REPLACE FUNCTION generate_smart_client_secret()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Generate secure tokens
CREATE OR REPLACE FUNCTION generate_smart_access_token()
RETURNS TEXT AS $$
BEGIN
    RETURN 'eat_' || encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_smart_refresh_token()
RETURNS TEXT AS $$
BEGIN
    RETURN 'ert_' || encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_smart_auth_code()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. TRIGGERS
-- =====================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_smart_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_smart_apps_updated_at
    BEFORE UPDATE ON public.smart_registered_apps
    FOR EACH ROW EXECUTE FUNCTION update_smart_updated_at();

CREATE TRIGGER update_smart_authorizations_updated_at
    BEFORE UPDATE ON public.smart_authorizations
    FOR EACH ROW EXECUTE FUNCTION update_smart_updated_at();

-- Update app statistics on new authorization
CREATE OR REPLACE FUNCTION update_app_authorization_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.smart_registered_apps
        SET total_authorizations = total_authorizations + 1,
            active_authorizations = active_authorizations + 1,
            last_authorization_at = NOW()
        WHERE id = NEW.app_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status = 'revoked' THEN
        UPDATE public.smart_registered_apps
        SET active_authorizations = active_authorizations - 1
        WHERE id = NEW.app_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_app_stats_on_authorization
    AFTER INSERT OR UPDATE ON public.smart_authorizations
    FOR EACH ROW EXECUTE FUNCTION update_app_authorization_stats();

-- =====================================================
-- 9. SEED APPROVED APPS (Optional - for testing)
-- =====================================================

-- Example: Apple Health (would need real credentials in production)
-- INSERT INTO public.smart_registered_apps (
--     client_id,
--     client_name,
--     client_description,
--     redirect_uris,
--     scopes_allowed,
--     app_type,
--     status,
--     is_confidential,
--     pkce_required
-- ) VALUES (
--     'apple_health_kit',
--     'Apple Health',
--     'Apple Health app for iOS devices',
--     ARRAY['x-apple-health://callback'],
--     ARRAY['patient/Observation.read', 'patient/Condition.read', 'openid'],
--     'patient',
--     'approved',
--     false,
--     true
-- ) ON CONFLICT (client_id) DO NOTHING;

-- =====================================================
-- 10. COMMENTS
-- =====================================================

COMMENT ON TABLE public.smart_registered_apps IS 'Third-party healthcare apps registered to access Envision Atlus via SMART on FHIR';
COMMENT ON TABLE public.smart_auth_codes IS 'Temporary OAuth2 authorization codes (10 min expiry)';
COMMENT ON TABLE public.smart_access_tokens IS 'Active OAuth2 access and refresh tokens';
COMMENT ON TABLE public.smart_authorizations IS 'Patient authorizations for third-party apps (links to consent system)';
COMMENT ON TABLE public.smart_audit_log IS 'Audit trail for all SMART/OAuth2 operations (compliance requirement)';
