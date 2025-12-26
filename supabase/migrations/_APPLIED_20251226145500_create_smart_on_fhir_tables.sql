-- Migration: Create SMART on FHIR Tables
-- Purpose: Support SMART on FHIR OAuth2 app authorization per 21st Century Cures Act
-- Compliance: ONC Cures Act Final Rule, 21st Century Cures Act
--
-- Tables:
--   1. smart_registered_apps - Registered third-party SMART applications
--   2. smart_auth_codes - OAuth2 authorization codes (short-lived)
--   3. smart_authorizations - Patient authorizations to apps
--   4. smart_access_tokens - Access and refresh tokens
--   5. smart_audit_log - Audit trail for all SMART events

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: smart_registered_apps
-- Stores registered SMART on FHIR applications
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS smart_registered_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- App identification
  client_id TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT, -- NULL for public clients, hashed for confidential
  app_name TEXT NOT NULL,
  app_description TEXT,
  app_logo_url TEXT,

  -- App classification
  app_type TEXT NOT NULL DEFAULT 'patient' CHECK (app_type IN ('patient', 'provider', 'backend', 'system')),
  is_confidential BOOLEAN NOT NULL DEFAULT false, -- true = confidential client, false = public client

  -- OAuth2 configuration
  redirect_uris TEXT[] NOT NULL DEFAULT '{}',
  allowed_scopes TEXT[] NOT NULL DEFAULT '{}',
  default_scopes TEXT[] DEFAULT '{}',

  -- Developer information
  developer_name TEXT,
  developer_email TEXT,
  developer_url TEXT,
  privacy_policy_url TEXT,
  terms_of_service_url TEXT,

  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended', 'revoked', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Security settings
  require_pkce BOOLEAN NOT NULL DEFAULT true,
  token_lifetime_seconds INTEGER DEFAULT 3600, -- 1 hour default
  refresh_token_lifetime_seconds INTEGER DEFAULT 2592000, -- 30 days default
  max_authorizations_per_patient INTEGER DEFAULT 1,

  -- Metadata
  tenant_id UUID REFERENCES tenants(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for smart_registered_apps
CREATE INDEX IF NOT EXISTS idx_smart_registered_apps_client_id ON smart_registered_apps(client_id);
CREATE INDEX IF NOT EXISTS idx_smart_registered_apps_status ON smart_registered_apps(status);
CREATE INDEX IF NOT EXISTS idx_smart_registered_apps_app_type ON smart_registered_apps(app_type);
CREATE INDEX IF NOT EXISTS idx_smart_registered_apps_tenant_id ON smart_registered_apps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_smart_registered_apps_created_at ON smart_registered_apps(created_at DESC);

-- Enable RLS
ALTER TABLE smart_registered_apps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for smart_registered_apps
CREATE POLICY "smart_registered_apps_admin_all" ON smart_registered_apps
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Anyone can view approved apps (for discovery)
CREATE POLICY "smart_registered_apps_public_read" ON smart_registered_apps
  FOR SELECT
  TO authenticated
  USING (status = 'approved');

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: smart_auth_codes
-- Short-lived authorization codes for OAuth2 code exchange
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS smart_auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Authorization code
  code TEXT NOT NULL UNIQUE,

  -- References
  app_id UUID NOT NULL REFERENCES smart_registered_apps(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL, -- Patient who authorized
  user_id UUID NOT NULL REFERENCES auth.users(id), -- User who performed authorization

  -- OAuth2 parameters
  redirect_uri TEXT NOT NULL,
  scopes_requested TEXT[] NOT NULL DEFAULT '{}',
  scopes_granted TEXT[] NOT NULL DEFAULT '{}',
  state TEXT, -- Client-provided state parameter

  -- PKCE (Proof Key for Code Exchange)
  code_challenge TEXT,
  code_challenge_method TEXT DEFAULT 'S256' CHECK (code_challenge_method IN ('S256', 'plain')),

  -- Lifecycle
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,

  -- Audit
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for smart_auth_codes
CREATE INDEX IF NOT EXISTS idx_smart_auth_codes_code ON smart_auth_codes(code);
CREATE INDEX IF NOT EXISTS idx_smart_auth_codes_app_id ON smart_auth_codes(app_id);
CREATE INDEX IF NOT EXISTS idx_smart_auth_codes_patient_id ON smart_auth_codes(patient_id);
CREATE INDEX IF NOT EXISTS idx_smart_auth_codes_expires_at ON smart_auth_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_smart_auth_codes_used ON smart_auth_codes(used) WHERE NOT used;

-- Enable RLS
ALTER TABLE smart_auth_codes ENABLE ROW LEVEL SECURITY;

-- Only service role should access auth codes (handled via Edge Functions)
CREATE POLICY "smart_auth_codes_service_only" ON smart_auth_codes
  FOR ALL
  TO service_role
  USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: smart_authorizations
-- Tracks patient authorizations to SMART apps
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS smart_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  app_id UUID NOT NULL REFERENCES smart_registered_apps(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Authorization details
  scopes_granted TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired', 'suspended')),

  -- Revocation
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  revoked_by UUID REFERENCES auth.users(id),

  -- Activity tracking
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiration

  -- Ensure one active authorization per app/patient pair
  UNIQUE (app_id, patient_id)
);

-- Indexes for smart_authorizations
CREATE INDEX IF NOT EXISTS idx_smart_authorizations_app_id ON smart_authorizations(app_id);
CREATE INDEX IF NOT EXISTS idx_smart_authorizations_patient_id ON smart_authorizations(patient_id);
CREATE INDEX IF NOT EXISTS idx_smart_authorizations_user_id ON smart_authorizations(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_authorizations_status ON smart_authorizations(status);
CREATE INDEX IF NOT EXISTS idx_smart_authorizations_created_at ON smart_authorizations(created_at DESC);

-- Enable RLS
ALTER TABLE smart_authorizations ENABLE ROW LEVEL SECURITY;

-- Patients can view their own authorizations
CREATE POLICY "smart_authorizations_patient_select" ON smart_authorizations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Patients can update (revoke) their own authorizations
CREATE POLICY "smart_authorizations_patient_update" ON smart_authorizations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins have full access
CREATE POLICY "smart_authorizations_admin_all" ON smart_authorizations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: smart_access_tokens
-- Stores access and refresh tokens for SMART apps
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS smart_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tokens (hashed in production, plaintext here for demo)
  access_token TEXT NOT NULL UNIQUE,
  refresh_token TEXT UNIQUE, -- NULL if offline_access not granted

  -- References
  app_id UUID NOT NULL REFERENCES smart_registered_apps(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  authorization_id UUID REFERENCES smart_authorizations(id) ON DELETE SET NULL,

  -- Token metadata
  scopes TEXT[] NOT NULL DEFAULT '{}',

  -- Expiration
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ,

  -- Revocation
  revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0,

  -- Audit
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for smart_access_tokens
CREATE INDEX IF NOT EXISTS idx_smart_access_tokens_access_token ON smart_access_tokens(access_token);
CREATE INDEX IF NOT EXISTS idx_smart_access_tokens_refresh_token ON smart_access_tokens(refresh_token) WHERE refresh_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_smart_access_tokens_app_id ON smart_access_tokens(app_id);
CREATE INDEX IF NOT EXISTS idx_smart_access_tokens_patient_id ON smart_access_tokens(patient_id);
CREATE INDEX IF NOT EXISTS idx_smart_access_tokens_authorization_id ON smart_access_tokens(authorization_id);
CREATE INDEX IF NOT EXISTS idx_smart_access_tokens_revoked ON smart_access_tokens(revoked) WHERE NOT revoked;
CREATE INDEX IF NOT EXISTS idx_smart_access_tokens_expires ON smart_access_tokens(access_token_expires_at);

-- Enable RLS
ALTER TABLE smart_access_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role should access tokens (handled via Edge Functions)
CREATE POLICY "smart_access_tokens_service_only" ON smart_access_tokens
  FOR ALL
  TO service_role
  USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: smart_audit_log
-- Audit trail for all SMART on FHIR events
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS smart_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event classification
  event_type TEXT NOT NULL CHECK (event_type IN (
    'app_registered',
    'app_approved',
    'app_rejected',
    'app_suspended',
    'app_revoked',
    'authorization_requested',
    'authorization_granted',
    'authorization_denied',
    'authorization_revoked',
    'token_issued',
    'token_refreshed',
    'token_revoked',
    'token_introspected',
    'resource_accessed',
    'scope_downgrade',
    'security_violation'
  )),

  -- References (all optional depending on event type)
  app_id UUID REFERENCES smart_registered_apps(id) ON DELETE SET NULL,
  patient_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token_id UUID REFERENCES smart_access_tokens(id) ON DELETE SET NULL,
  authorization_id UUID REFERENCES smart_authorizations(id) ON DELETE SET NULL,

  -- Event details
  details JSONB DEFAULT '{}'::jsonb,
  scopes_requested TEXT[],
  scopes_granted TEXT[],
  resource_type TEXT, -- e.g., 'Patient', 'Observation'
  resource_id TEXT,

  -- Request context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for smart_audit_log
CREATE INDEX IF NOT EXISTS idx_smart_audit_log_event_type ON smart_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_smart_audit_log_app_id ON smart_audit_log(app_id);
CREATE INDEX IF NOT EXISTS idx_smart_audit_log_patient_id ON smart_audit_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_smart_audit_log_user_id ON smart_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_audit_log_created_at ON smart_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_audit_log_details ON smart_audit_log USING GIN (details);

-- Enable RLS
ALTER TABLE smart_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view audit logs
CREATE POLICY "smart_audit_log_admin_select" ON smart_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Service role can insert audit logs
CREATE POLICY "smart_audit_log_service_insert" ON smart_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS: Auto-update updated_at timestamps
-- ═══════════════════════════════════════════════════════════════════════════════

-- Generic updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_smart_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for smart_registered_apps
DROP TRIGGER IF EXISTS trigger_smart_registered_apps_updated_at ON smart_registered_apps;
CREATE TRIGGER trigger_smart_registered_apps_updated_at
  BEFORE UPDATE ON smart_registered_apps
  FOR EACH ROW
  EXECUTE FUNCTION update_smart_updated_at();

-- Trigger for smart_authorizations
DROP TRIGGER IF EXISTS trigger_smart_authorizations_updated_at ON smart_authorizations;
CREATE TRIGGER trigger_smart_authorizations_updated_at
  BEFORE UPDATE ON smart_authorizations
  FOR EACH ROW
  EXECUTE FUNCTION update_smart_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- GRANTS: Permissions for authenticated users
-- ═══════════════════════════════════════════════════════════════════════════════

GRANT SELECT ON smart_registered_apps TO authenticated;
GRANT SELECT, UPDATE ON smart_authorizations TO authenticated;
GRANT SELECT ON smart_audit_log TO authenticated;

-- Service role gets full access (for Edge Functions)
GRANT ALL ON smart_registered_apps TO service_role;
GRANT ALL ON smart_auth_codes TO service_role;
GRANT ALL ON smart_authorizations TO service_role;
GRANT ALL ON smart_access_tokens TO service_role;
GRANT ALL ON smart_audit_log TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMMENTS: Table documentation
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE smart_registered_apps IS 'Registered SMART on FHIR applications (21st Century Cures Act compliance)';
COMMENT ON TABLE smart_auth_codes IS 'OAuth2 authorization codes for SMART app authentication';
COMMENT ON TABLE smart_authorizations IS 'Patient authorizations granting SMART apps access to their data';
COMMENT ON TABLE smart_access_tokens IS 'Access and refresh tokens for authorized SMART apps';
COMMENT ON TABLE smart_audit_log IS 'Audit trail for all SMART on FHIR events (HIPAA compliance)';

-- ═══════════════════════════════════════════════════════════════════════════════
-- CLEANUP FUNCTION: Remove expired tokens and codes
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cleanup_expired_smart_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  codes_deleted INTEGER;
  tokens_deleted INTEGER;
BEGIN
  -- Delete expired auth codes older than 24 hours
  DELETE FROM smart_auth_codes
  WHERE expires_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS codes_deleted = ROW_COUNT;

  -- Delete revoked tokens older than 30 days
  DELETE FROM smart_access_tokens
  WHERE revoked = true
  AND revoked_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS tokens_deleted = ROW_COUNT;

  deleted_count := codes_deleted + tokens_deleted;

  -- Log cleanup
  INSERT INTO smart_audit_log (event_type, details)
  VALUES ('token_introspected', jsonb_build_object(
    'action', 'cleanup',
    'codes_deleted', codes_deleted,
    'tokens_deleted', tokens_deleted
  ));

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_smart_tokens IS 'Cleanup function to remove expired authorization codes and revoked tokens';
