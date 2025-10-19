-- Create Missing Audit Tables for HIPAA/SOC 2 Compliance
-- These tables are referenced in SOC 2 views but were never created

-- ============================================================================
-- 1. AUDIT_LOGS - Central audit trail for all user/admin actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event identification
  event_type TEXT NOT NULL, -- LOGIN, LOGOUT, DATA_ACCESS, ADMIN_ACTION, etc.
  event_category TEXT NOT NULL, -- AUTHENTICATION, DATA_ACCESS, ADMIN, SECURITY

  -- Actor (who did it)
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_ip_address TEXT,
  actor_user_agent TEXT,

  -- Target (what was affected)
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_resource_type TEXT, -- patient, encounter, claim, user, etc.
  target_resource_id TEXT,

  -- Action details
  action TEXT NOT NULL, -- READ, WRITE, UPDATE, DELETE, GRANT, REVOKE
  success BOOLEAN NOT NULL DEFAULT true,
  error_code TEXT,
  error_message TEXT,

  -- Context
  metadata JSONB, -- Additional context (old_value, new_value, reason, etc.)
  session_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_category ON audit_logs(event_category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_resource ON audit_logs(target_resource_type, target_resource_id);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs (for compliance reporting)
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Users can view their own audit logs (transparency)
CREATE POLICY "Users can view own audit logs"
  ON audit_logs
  FOR SELECT
  USING (actor_user_id = auth.uid() OR target_user_id = auth.uid());

-- Only system/service role can insert (prevents tampering)
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

COMMENT ON TABLE audit_logs IS 'HIPAA/SOC 2 compliant audit trail for all user actions, data access, and administrative operations';

-- ============================================================================
-- 2. SECURITY_EVENTS - Security-specific events (threats, anomalies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event details
  event_type TEXT NOT NULL, -- FAILED_LOGIN, UNAUTHORIZED_ACCESS, RATE_LIMIT, ANOMALY, etc.
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

  -- Source
  source_ip_address TEXT,
  source_user_agent TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Detection
  detection_method TEXT, -- RATE_LIMIT, PATTERN_MATCH, ANOMALY_DETECTION
  rule_triggered TEXT,

  -- Details
  description TEXT NOT NULL,
  metadata JSONB,

  -- Response
  action_taken TEXT, -- BLOCKED, LOGGED, ALERTED, LOCKED_ACCOUNT
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for security monitoring
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved);
CREATE INDEX IF NOT EXISTS idx_security_events_source_ip ON security_events(source_ip_address);

-- Enable Row Level Security
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Only admins and security team can view security events
CREATE POLICY "Admins can view security events"
  ON security_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Only service role can insert (prevents tampering)
CREATE POLICY "Service role can insert security events"
  ON security_events
  FOR INSERT
  WITH CHECK (true);

-- Admins can update (for resolution tracking)
CREATE POLICY "Admins can update security events"
  ON security_events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

COMMENT ON TABLE security_events IS 'Security-specific events for threat detection and incident response (SOC 2 CC7.3)';

-- ============================================================================
-- 3. CLAUDE_API_AUDIT - Claude API usage for cost tracking and compliance
-- ============================================================================
CREATE TABLE IF NOT EXISTS claude_api_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Request identification
  request_id TEXT NOT NULL UNIQUE, -- UUID for correlation
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Request details
  request_type TEXT NOT NULL, -- medical_coding, billing, chat, personalization, etc.
  model TEXT NOT NULL, -- claude-haiku-4-5-20250919, etc.

  -- Token usage
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,

  -- Cost tracking
  cost DECIMAL(10, 6) NOT NULL DEFAULT 0, -- In USD

  -- Performance
  response_time_ms INTEGER,

  -- Status
  success BOOLEAN NOT NULL DEFAULT true,
  error_code TEXT,
  error_message TEXT,

  -- PHI Compliance
  phi_scrubbed BOOLEAN NOT NULL DEFAULT true, -- Confirm PHI redaction applied

  -- Context
  metadata JSONB, -- prompt_type, patient_count, feature_name, etc.

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for cost reporting and compliance
CREATE INDEX IF NOT EXISTS idx_claude_audit_user_id ON claude_api_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_claude_audit_created_at ON claude_api_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claude_audit_request_type ON claude_api_audit(request_type);
CREATE INDEX IF NOT EXISTS idx_claude_audit_model ON claude_api_audit(model);
CREATE INDEX IF NOT EXISTS idx_claude_audit_success ON claude_api_audit(success);
CREATE INDEX IF NOT EXISTS idx_claude_audit_cost ON claude_api_audit(cost);

-- Enable Row Level Security
ALTER TABLE claude_api_audit ENABLE ROW LEVEL SECURITY;

-- Admins can view all Claude usage (for billing and compliance)
CREATE POLICY "Admins can view all Claude usage"
  ON claude_api_audit
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Users can view their own Claude usage (transparency)
CREATE POLICY "Users can view own Claude usage"
  ON claude_api_audit
  FOR SELECT
  USING (user_id = auth.uid());

-- Only service role can insert
CREATE POLICY "Service role can insert Claude audit"
  ON claude_api_audit
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE claude_api_audit IS 'Claude API usage audit for cost tracking, compliance, and medical decision documentation';

-- ============================================================================
-- 4. PHI_ACCESS_LOG - HIPAA-specific PHI access tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS phi_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who accessed
  accessor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accessor_role TEXT NOT NULL, -- doctor, nurse, admin, patient

  -- What was accessed
  phi_type TEXT NOT NULL, -- patient_record, encounter, medication, lab_result, etc.
  phi_resource_id TEXT NOT NULL,
  patient_id UUID, -- The patient whose PHI was accessed

  -- How it was accessed
  access_type TEXT NOT NULL, -- READ, WRITE, UPDATE, DELETE, EXPORT
  access_method TEXT NOT NULL, -- UI, API, BULK_EXPORT, REPORT

  -- Context
  purpose TEXT, -- treatment, payment, operations, patient_request
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamps
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for HIPAA audit queries
CREATE INDEX IF NOT EXISTS idx_phi_access_accessor_user_id ON phi_access_log(accessor_user_id);
CREATE INDEX IF NOT EXISTS idx_phi_access_patient_id ON phi_access_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_phi_access_phi_type ON phi_access_log(phi_type);
CREATE INDEX IF NOT EXISTS idx_phi_access_accessed_at ON phi_access_log(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_phi_access_type ON phi_access_log(access_type);

-- Enable Row Level Security
ALTER TABLE phi_access_log ENABLE ROW LEVEL SECURITY;

-- Only admins and compliance officers can view PHI access logs
CREATE POLICY "Admins can view PHI access logs"
  ON phi_access_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Patients can view their own PHI access logs (transparency per HIPAA)
CREATE POLICY "Patients can view own PHI access logs"
  ON phi_access_log
  FOR SELECT
  USING (patient_id::text = auth.uid()::text);

-- Only service role can insert
CREATE POLICY "Service role can insert PHI access logs"
  ON phi_access_log
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE phi_access_log IS 'HIPAA-mandated audit trail for all PHI access (§164.312(b) - Audit Controls)';

-- ============================================================================
-- 5. AGGREGATED VIEWS FOR REPORTING
-- ============================================================================

-- Daily audit summary
CREATE OR REPLACE VIEW audit_logs_daily_summary AS
SELECT
  DATE_TRUNC('day', created_at) as day,
  event_category,
  event_type,
  COUNT(*) as event_count,
  COUNT(CASE WHEN success = false THEN 1 END) as failure_count,
  COUNT(DISTINCT actor_user_id) as unique_users
FROM audit_logs
GROUP BY DATE_TRUNC('day', created_at), event_category, event_type
ORDER BY day DESC, event_count DESC;

-- Claude cost summary by user
CREATE OR REPLACE VIEW claude_cost_by_user AS
SELECT
  user_id,
  request_type,
  model,
  COUNT(*) as request_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(cost) as total_cost,
  AVG(response_time_ms) as avg_response_time_ms,
  COUNT(CASE WHEN success = false THEN 1 END) as failure_count
FROM claude_api_audit
GROUP BY user_id, request_type, model
ORDER BY total_cost DESC;

-- Security events requiring attention
CREATE OR REPLACE VIEW security_events_unresolved AS
SELECT
  id,
  event_type,
  severity,
  source_ip_address,
  user_id,
  description,
  action_taken,
  created_at,
  NOW() - created_at as age
FROM security_events
WHERE resolved = false
ORDER BY
  CASE severity
    WHEN 'CRITICAL' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    WHEN 'LOW' THEN 4
  END,
  created_at ASC;

-- PHI access by patient (for patient privacy dashboards)
CREATE OR REPLACE VIEW phi_access_by_patient AS
SELECT
  patient_id,
  phi_type,
  COUNT(*) as access_count,
  COUNT(DISTINCT accessor_user_id) as unique_accessors,
  MAX(accessed_at) as last_accessed,
  ARRAY_AGG(DISTINCT access_type) as access_types
FROM phi_access_log
GROUP BY patient_id, phi_type
ORDER BY last_accessed DESC;

COMMENT ON VIEW audit_logs_daily_summary IS 'Daily rollup of audit events for trend analysis';
COMMENT ON VIEW claude_cost_by_user IS 'Claude API cost tracking by user for billing and budgeting';
COMMENT ON VIEW security_events_unresolved IS 'Active security incidents requiring investigation or resolution';
COMMENT ON VIEW phi_access_by_patient IS 'PHI access summary by patient for privacy transparency';

-- ============================================================================
-- 6. HELPER FUNCTIONS FOR LOGGING
-- ============================================================================

-- Function to log audit events (can be called from Edge Functions)
CREATE OR REPLACE FUNCTION log_audit_event(
  p_event_type TEXT,
  p_event_category TEXT,
  p_actor_user_id UUID,
  p_action TEXT,
  p_success BOOLEAN DEFAULT true,
  p_target_user_id UUID DEFAULT NULL,
  p_target_resource_type TEXT DEFAULT NULL,
  p_target_resource_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO audit_logs (
    event_type,
    event_category,
    actor_user_id,
    action,
    success,
    target_user_id,
    target_resource_type,
    target_resource_id,
    metadata,
    error_message
  ) VALUES (
    p_event_type,
    p_event_category,
    p_actor_user_id,
    p_action,
    p_success,
    p_target_user_id,
    p_target_resource_type,
    p_target_resource_id,
    p_metadata,
    p_error_message
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit_event IS 'Helper function to insert audit log entries from Edge Functions';

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type TEXT,
  p_severity TEXT,
  p_description TEXT,
  p_source_ip_address TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_action_taken TEXT DEFAULT 'LOGGED',
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO security_events (
    event_type,
    severity,
    description,
    source_ip_address,
    user_id,
    action_taken,
    metadata
  ) VALUES (
    p_event_type,
    p_severity,
    p_description,
    p_source_ip_address,
    p_user_id,
    p_action_taken,
    p_metadata
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_security_event IS 'Helper function to insert security events from Edge Functions';

-- Function to log PHI access
CREATE OR REPLACE FUNCTION log_phi_access(
  p_accessor_user_id UUID,
  p_accessor_role TEXT,
  p_phi_type TEXT,
  p_phi_resource_id TEXT,
  p_patient_id UUID,
  p_access_type TEXT,
  p_access_method TEXT DEFAULT 'UI',
  p_purpose TEXT DEFAULT 'treatment',
  p_ip_address TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO phi_access_log (
    accessor_user_id,
    accessor_role,
    phi_type,
    phi_resource_id,
    patient_id,
    access_type,
    access_method,
    purpose,
    ip_address
  ) VALUES (
    p_accessor_user_id,
    p_accessor_role,
    p_phi_type,
    p_phi_resource_id,
    p_patient_id,
    p_access_type,
    p_access_method,
    p_purpose,
    p_ip_address
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_phi_access IS 'Helper function to log PHI access for HIPAA compliance (§164.312(b))';
