-- Add Missing Audit Tables (claude_api_audit and phi_access_log)
-- audit_logs and security_events already exist

-- ============================================================================
-- 1. CLAUDE_API_AUDIT - Claude API usage for cost tracking and compliance
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
-- 2. PHI_ACCESS_LOG - HIPAA-specific PHI access tracking
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
-- 3. AGGREGATED VIEWS FOR REPORTING
-- ============================================================================

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

COMMENT ON VIEW claude_cost_by_user IS 'Claude API cost tracking by user for billing and budgeting';
COMMENT ON VIEW phi_access_by_patient IS 'PHI access summary by patient for privacy transparency';

-- ============================================================================
-- 4. HELPER FUNCTIONS FOR LOGGING
-- ============================================================================

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
