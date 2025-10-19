-- ============================================================================
-- SOC 2 Compliance Security Foundation
-- ============================================================================
-- Purpose: Implement critical security controls for FHIR backend
-- Addresses: Audit logging, security events, encryption foundation
-- SOC 2 Controls: CC6.1, CC6.5, CC6.6, CC6.8, CC7.2, CC7.3, PI1.4, PI1.5
-- Date: 2025-10-18
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: ENABLE ENCRYPTION EXTENSION
-- ============================================================================

-- Enable pgcrypto for field-level encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption key management table (keys stored in environment variables in production)
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id BIGSERIAL PRIMARY KEY,
  key_name TEXT UNIQUE NOT NULL,
  key_purpose TEXT NOT NULL CHECK (key_purpose IN ('phi', 'credentials', 'tokens', 'system')),
  key_algorithm TEXT NOT NULL DEFAULT 'aes256' CHECK (key_algorithm IN ('aes256', 'aes128')),
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Only super_admin can access encryption keys
ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "encryption_keys_super_admin_only" ON public.encryption_keys;
CREATE POLICY "encryption_keys_super_admin_only"
  ON public.encryption_keys
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- ============================================================================
-- PART 2: COMPREHENSIVE AUDIT LOGGING SYSTEM
-- ============================================================================

-- Main audit log table for ALL PHI access
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  actor_ip_address INET,
  actor_user_agent TEXT,

  -- What
  event_type TEXT NOT NULL CHECK (event_type IN (
    -- PHI Access Events
    'PHI_READ', 'PHI_WRITE', 'PHI_UPDATE', 'PHI_DELETE', 'PHI_EXPORT',
    -- FHIR Operations
    'FHIR_IMPORT_STARTED', 'FHIR_IMPORT_COMPLETED', 'FHIR_IMPORT_FAILED',
    'FHIR_EXPORT_STARTED', 'FHIR_EXPORT_COMPLETED', 'FHIR_EXPORT_FAILED',
    'FHIR_SYNC_STARTED', 'FHIR_SYNC_COMPLETED', 'FHIR_SYNC_FAILED',
    -- Connection Management
    'FHIR_CONNECTION_CREATED', 'FHIR_CONNECTION_UPDATED', 'FHIR_CONNECTION_DELETED',
    'FHIR_CONNECTION_TEST_SUCCESS', 'FHIR_CONNECTION_TEST_FAILED',
    -- Token Management
    'ACCESS_TOKEN_CREATED', 'ACCESS_TOKEN_REFRESHED', 'ACCESS_TOKEN_EXPIRED',
    'ACCESS_TOKEN_REVOKED',
    -- Patient Mapping
    'PATIENT_MAPPING_CREATED', 'PATIENT_MAPPING_UPDATED', 'PATIENT_MAPPING_DELETED',
    -- Data Retention
    'DATA_RETENTION_EXECUTED', 'DATA_SECURE_DELETE',
    -- Administrative
    'ROLE_ASSIGNED', 'ROLE_REVOKED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED',
    -- System
    'SYSTEM_BACKUP', 'SYSTEM_RESTORE', 'CONFIGURATION_CHANGE'
  )),
  event_category TEXT NOT NULL CHECK (event_category IN (
    'PHI_ACCESS', 'DATA_MODIFICATION', 'AUTHENTICATION', 'AUTHORIZATION',
    'CONFIGURATION', 'SYSTEM', 'FHIR_SYNC'
  )),

  -- Where
  resource_type TEXT, -- 'Patient', 'Observation', 'Immunization', etc.
  resource_id TEXT,
  table_name TEXT,

  -- When
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Context
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operation TEXT, -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'EXPORT'

  -- Details (NO PHI - only metadata)
  metadata JSONB DEFAULT '{}',

  -- Outcome
  success BOOLEAN NOT NULL,
  error_code TEXT,
  error_message TEXT, -- Sanitized error, NO PHI

  -- Retention
  retention_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 years'), -- SOC 2 requires 7 years

  -- Integrity
  checksum TEXT -- SHA256 hash for tamper detection
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_category ON public.audit_logs(event_category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON public.audit_logs(success) WHERE success = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_retention ON public.audit_logs(retention_date) WHERE retention_date <= NOW();

-- Partition by month for performance (PostgreSQL 10+)
-- CREATE TABLE audit_logs_y2025m10 PARTITION OF audit_logs
--   FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

-- RLS: Audit logs are append-only, read-only for admins
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_read"
  ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- No UPDATE or DELETE policies - audit logs are immutable
-- Inserts only via service role or triggers

-- ============================================================================
-- PART 3: SECURITY EVENTS MONITORING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event Classification
  event_type TEXT NOT NULL CHECK (event_type IN (
    -- Authentication Threats
    'FAILED_LOGIN', 'BRUTE_FORCE_ATTEMPT', 'INVALID_TOKEN', 'EXPIRED_TOKEN',
    'SUSPICIOUS_LOGIN', 'MULTIPLE_CONCURRENT_SESSIONS',
    -- Authorization Violations
    'UNAUTHORIZED_ACCESS_ATTEMPT', 'PRIVILEGE_ESCALATION_ATTEMPT', 'RLS_VIOLATION',
    -- Data Threats
    'MASS_DATA_EXPORT', 'UNUSUAL_DATA_ACCESS_PATTERN', 'AFTER_HOURS_ACCESS',
    'DATA_EXFILTRATION_ATTEMPT',
    -- System Threats
    'RATE_LIMIT_EXCEEDED', 'DDOS_DETECTED', 'SQL_INJECTION_ATTEMPT',
    'XSS_ATTEMPT', 'INVALID_INPUT', 'MALFORMED_FHIR_DATA',
    -- Integrity Threats
    'AUDIT_LOG_TAMPERING_DETECTED', 'CHECKSUM_MISMATCH', 'UNAUTHORIZED_CONFIG_CHANGE',
    -- FHIR-Specific
    'FHIR_IMPORT_FAILED', 'FHIR_SYNC_ANOMALY', 'EXTERNAL_API_FAILURE',
    'TOKEN_REFRESH_FAILED', 'CONNECTION_COMPROMISED_SUSPECTED'
  )),

  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

  -- Who/Where/When
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_ip_address INET,
  actor_user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Details (NO PHI)
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  -- Response
  auto_blocked BOOLEAN DEFAULT FALSE,
  requires_investigation BOOLEAN DEFAULT FALSE,
  investigated BOOLEAN DEFAULT FALSE,
  investigated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  investigated_at TIMESTAMPTZ,
  resolution TEXT,

  -- Correlation
  related_audit_log_id UUID REFERENCES public.audit_logs(id) ON DELETE SET NULL,
  correlation_id TEXT, -- Group related events

  -- Alerting
  alert_sent BOOLEAN DEFAULT FALSE,
  alert_sent_at TIMESTAMPTZ,
  alert_recipients TEXT[]
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON public.security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_actor ON public.security_events(actor_user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON public.security_events(actor_ip_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_uninvestigated ON public.security_events(timestamp DESC)
  WHERE requires_investigation = TRUE AND investigated = FALSE;
CREATE INDEX IF NOT EXISTS idx_security_events_correlation ON public.security_events(correlation_id);

-- RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_events_admin_all" ON public.security_events;
CREATE POLICY "security_events_admin_all"
  ON public.security_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- PART 4: DATA CLASSIFICATION METADATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.data_classification (
  id BIGSERIAL PRIMARY KEY,

  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,

  classification TEXT NOT NULL CHECK (classification IN (
    'PHI', 'PII', 'FINANCIAL', 'CONFIDENTIAL', 'INTERNAL', 'PUBLIC'
  )),

  encryption_required BOOLEAN NOT NULL DEFAULT TRUE,
  audit_access BOOLEAN NOT NULL DEFAULT TRUE,
  retention_period INTERVAL NOT NULL DEFAULT INTERVAL '7 years',

  description TEXT,
  compliance_tags TEXT[] DEFAULT '{}', -- ['HIPAA', 'GDPR', 'SOC2']

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(table_name, column_name)
);

-- RLS
ALTER TABLE public.data_classification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_classification_admin_all" ON public.data_classification;
CREATE POLICY "data_classification_admin_all"
  ON public.data_classification
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- PART 5: RATE LIMITING INFRASTRUCTURE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifier (user, IP, or API key)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET,
  api_key_hash TEXT,

  -- Rate limit type
  limit_type TEXT NOT NULL CHECK (limit_type IN (
    'FHIR_SYNC', 'FHIR_EXPORT', 'API_CALL', 'LOGIN_ATTEMPT', 'DATA_QUERY'
  )),

  -- Timing
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,

  -- Counts
  request_count INTEGER NOT NULL DEFAULT 1,
  limit_threshold INTEGER NOT NULL,

  -- Status
  limit_exceeded BOOLEAN DEFAULT FALSE,
  blocked BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rate_limit_user ON public.rate_limit_events(user_id, limit_type, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip ON public.rate_limit_events(ip_address, limit_type, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_exceeded ON public.rate_limit_events(window_start DESC) WHERE limit_exceeded = TRUE;
CREATE INDEX IF NOT EXISTS idx_rate_limit_cleanup ON public.rate_limit_events(window_end) WHERE window_end < NOW();

-- RLS
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limit_admin_read" ON public.rate_limit_events;
CREATE POLICY "rate_limit_admin_read"
  ON public.rate_limit_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- PART 6: HELPER FUNCTIONS
-- ============================================================================

-- Function to log audit event (called from triggers and application code)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_event_type TEXT,
  p_event_category TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_operation TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_id UUID;
  v_actor_id UUID;
  v_actor_role TEXT;
BEGIN
  -- Get current user
  v_actor_id := auth.uid();

  -- Get actor role
  SELECT role INTO v_actor_role
  FROM public.user_roles
  WHERE user_id = v_actor_id
  LIMIT 1;

  -- Insert audit log
  INSERT INTO public.audit_logs (
    actor_user_id,
    actor_role,
    actor_ip_address,
    event_type,
    event_category,
    resource_type,
    resource_id,
    target_user_id,
    operation,
    metadata,
    success,
    error_message,
    checksum
  ) VALUES (
    v_actor_id,
    v_actor_role,
    inet_client_addr(),
    p_event_type,
    p_event_category,
    p_resource_type,
    p_resource_id,
    p_target_user_id,
    p_operation,
    p_metadata,
    p_success,
    p_error_message,
    encode(digest(
      v_actor_id::TEXT || p_event_type || p_resource_id || NOW()::TEXT,
      'sha256'
    ), 'hex')
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Never let audit logging break the main operation
    -- Log to PostgreSQL log instead
    RAISE WARNING 'Audit logging failed: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Function to log security event
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_severity TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_auto_block BOOLEAN DEFAULT FALSE,
  p_requires_investigation BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
  v_actor_id UUID;
BEGIN
  v_actor_id := auth.uid();

  INSERT INTO public.security_events (
    event_type,
    severity,
    actor_user_id,
    actor_ip_address,
    description,
    metadata,
    auto_blocked,
    requires_investigation
  ) VALUES (
    p_event_type,
    p_severity,
    v_actor_id,
    inet_client_addr(),
    p_description,
    p_metadata,
    p_auto_block,
    p_requires_investigation
  ) RETURNING id INTO v_event_id;

  -- TODO: Trigger alert if severity is HIGH or CRITICAL

  RETURN v_event_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Security event logging failed: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_limit_type TEXT,
  p_threshold INTEGER,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  v_window_end := NOW();

  -- Count recent requests
  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM public.rate_limit_events
  WHERE user_id = v_user_id
    AND limit_type = p_limit_type
    AND window_start >= v_window_start;

  -- Record this request
  INSERT INTO public.rate_limit_events (
    user_id,
    ip_address,
    limit_type,
    window_start,
    window_end,
    request_count,
    limit_threshold,
    limit_exceeded,
    blocked
  ) VALUES (
    v_user_id,
    inet_client_addr(),
    p_limit_type,
    v_window_start,
    v_window_end,
    1,
    p_threshold,
    v_count >= p_threshold,
    v_count >= p_threshold
  );

  -- Return TRUE if within limit, FALSE if exceeded
  RETURN v_count < p_threshold;
END;
$$;

-- Function to clean up old rate limit records
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limit_events
  WHERE window_end < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ============================================================================
-- PART 7: INITIAL DATA CLASSIFICATION
-- ============================================================================

-- Classify PHI fields in FHIR tables
INSERT INTO public.data_classification (table_name, column_name, classification, encryption_required, audit_access, compliance_tags)
VALUES
  -- FHIR Connections (credentials)
  ('fhir_connections', 'access_token', 'CONFIDENTIAL', TRUE, TRUE, ARRAY['SOC2', 'HIPAA']),
  ('fhir_connections', 'refresh_token', 'CONFIDENTIAL', TRUE, TRUE, ARRAY['SOC2', 'HIPAA']),
  ('fhir_connections', 'client_id', 'CONFIDENTIAL', TRUE, TRUE, ARRAY['SOC2']),

  -- Patient Mappings (PHI)
  ('fhir_patient_mappings', 'fhir_patient_id', 'PHI', TRUE, TRUE, ARRAY['HIPAA', 'SOC2']),

  -- Profiles (PHI/PII)
  ('profiles', 'phone', 'PII', TRUE, TRUE, ARRAY['GDPR', 'HIPAA', 'SOC2']),
  ('profiles', 'email', 'PII', TRUE, TRUE, ARRAY['GDPR', 'SOC2']),
  ('profiles', 'first_name', 'PHI', TRUE, TRUE, ARRAY['HIPAA', 'GDPR']),
  ('profiles', 'last_name', 'PHI', TRUE, TRUE, ARRAY['HIPAA', 'GDPR']),
  ('profiles', 'dob', 'PHI', TRUE, TRUE, ARRAY['HIPAA']),

  -- FHIR Resources
  ('fhir_immunizations', 'patient_id', 'PHI', TRUE, TRUE, ARRAY['HIPAA', 'SOC2']),
  ('fhir_care_plans', 'patient_id', 'PHI', TRUE, TRUE, ARRAY['HIPAA', 'SOC2']),
  ('fhir_observations', 'patient_id', 'PHI', TRUE, TRUE, ARRAY['HIPAA', 'SOC2']),
  ('check_ins', 'user_id', 'PHI', TRUE, TRUE, ARRAY['HIPAA']),

  -- Lab Results
  ('lab_results', 'patient_mrn', 'PHI', TRUE, TRUE, ARRAY['HIPAA', 'SOC2'])
ON CONFLICT (table_name, column_name) DO NOTHING;

-- ============================================================================
-- PART 8: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on audit/security functions to authenticated users
GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated;

COMMIT;

-- ============================================================================
-- ROLLBACK (PART 9)
-- ============================================================================

-- migrate:down
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.cleanup_rate_limit_events();
-- DROP FUNCTION IF EXISTS public.check_rate_limit(TEXT, INTEGER, INTEGER);
-- DROP FUNCTION IF EXISTS public.log_security_event(TEXT, TEXT, TEXT, JSONB, BOOLEAN, BOOLEAN);
-- DROP FUNCTION IF EXISTS public.log_audit_event(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, BOOLEAN, TEXT);
-- DROP TABLE IF EXISTS public.rate_limit_events CASCADE;
-- DROP TABLE IF EXISTS public.data_classification CASCADE;
-- DROP TABLE IF EXISTS public.security_events CASCADE;
-- DROP TABLE IF EXISTS public.audit_logs CASCADE;
-- DROP TABLE IF EXISTS public.encryption_keys CASCADE;
-- COMMIT;
