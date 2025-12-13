-- Migration: MCP Tier 2 Logging Tables
-- Description: Audit logging for HL7/X12 Transformer and Clearinghouse MCPs
-- Date: 2025-12-13

-- =====================================================
-- HL7/X12 TRANSFORMER MCP LOGGING
-- =====================================================

-- Create HL7/X12 MCP audit log table
CREATE TABLE IF NOT EXISTS mcp_hl7_x12_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Request info
  tool_name TEXT NOT NULL,
  request_params JSONB,

  -- Response info
  success BOOLEAN NOT NULL DEFAULT false,
  response_data JSONB,
  error_message TEXT,

  -- Message tracking
  message_type TEXT, -- 'HL7' or 'X12'
  message_subtype TEXT, -- 'ADT', 'ORU', '837P', '835', etc.
  control_id TEXT, -- Message control ID

  -- Conversion tracking
  source_format TEXT, -- 'HL7', 'X12', 'FHIR'
  target_format TEXT, -- 'HL7', 'X12', 'FHIR', 'JSON'

  -- Performance
  execution_time_ms INTEGER,
  message_size_bytes INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for HL7/X12 audit log
CREATE INDEX IF NOT EXISTS idx_mcp_hl7_x12_audit_tenant ON mcp_hl7_x12_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_hl7_x12_audit_user ON mcp_hl7_x12_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_hl7_x12_audit_tool ON mcp_hl7_x12_audit_log(tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_hl7_x12_audit_message_type ON mcp_hl7_x12_audit_log(message_type, message_subtype);
CREATE INDEX IF NOT EXISTS idx_mcp_hl7_x12_audit_created ON mcp_hl7_x12_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_hl7_x12_audit_control_id ON mcp_hl7_x12_audit_log(control_id);

-- Enable RLS
ALTER TABLE mcp_hl7_x12_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Service role full access to HL7/X12 audit"
  ON mcp_hl7_x12_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins view tenant HL7/X12 audit logs"
  ON mcp_hl7_x12_audit_log
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role_code IN (1, 2, 7) -- admin, super_admin, billing
    )
  );

-- =====================================================
-- CLEARINGHOUSE MCP LOGGING
-- =====================================================

-- Create Clearinghouse MCP audit log table
CREATE TABLE IF NOT EXISTS mcp_clearinghouse_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Request info
  tool_name TEXT NOT NULL,
  request_params JSONB,

  -- Response info
  success BOOLEAN NOT NULL DEFAULT false,
  response_data JSONB,
  error_message TEXT,

  -- Transaction tracking
  transaction_type TEXT, -- 'claim_submit', 'eligibility', 'status', 'prior_auth', 'remittance'
  payer_id TEXT,
  payer_name TEXT,

  -- Claim tracking
  claim_id TEXT,
  submission_id TEXT,
  patient_id TEXT,

  -- Financial tracking
  charge_amount DECIMAL(12,2),
  paid_amount DECIMAL(12,2),

  -- Status tracking
  transaction_status TEXT, -- 'submitted', 'accepted', 'rejected', 'pending'
  status_code TEXT,
  status_description TEXT,

  -- Clearinghouse info
  clearinghouse_provider TEXT, -- 'waystar', 'change_healthcare', 'availity'
  clearinghouse_trace_number TEXT,

  -- Performance
  execution_time_ms INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for Clearinghouse audit log
CREATE INDEX IF NOT EXISTS idx_mcp_clearinghouse_audit_tenant ON mcp_clearinghouse_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_clearinghouse_audit_user ON mcp_clearinghouse_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_clearinghouse_audit_tool ON mcp_clearinghouse_audit_log(tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_clearinghouse_audit_transaction ON mcp_clearinghouse_audit_log(transaction_type);
CREATE INDEX IF NOT EXISTS idx_mcp_clearinghouse_audit_payer ON mcp_clearinghouse_audit_log(payer_id);
CREATE INDEX IF NOT EXISTS idx_mcp_clearinghouse_audit_claim ON mcp_clearinghouse_audit_log(claim_id);
CREATE INDEX IF NOT EXISTS idx_mcp_clearinghouse_audit_patient ON mcp_clearinghouse_audit_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_mcp_clearinghouse_audit_status ON mcp_clearinghouse_audit_log(transaction_status);
CREATE INDEX IF NOT EXISTS idx_mcp_clearinghouse_audit_created ON mcp_clearinghouse_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_clearinghouse_audit_submission ON mcp_clearinghouse_audit_log(submission_id);

-- Enable RLS
ALTER TABLE mcp_clearinghouse_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Service role full access to clearinghouse audit"
  ON mcp_clearinghouse_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins view tenant clearinghouse audit logs"
  ON mcp_clearinghouse_audit_log
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role_code IN (1, 2, 7) -- admin, super_admin, billing
    )
  );

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View: HL7/X12 transformation statistics by tenant
CREATE OR REPLACE VIEW mcp_hl7_x12_stats AS
SELECT
  tenant_id,
  tool_name,
  message_type,
  message_subtype,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE success = true) as successful_calls,
  COUNT(*) FILTER (WHERE success = false) as failed_calls,
  ROUND(AVG(execution_time_ms)::numeric, 2) as avg_execution_ms,
  ROUND(AVG(message_size_bytes)::numeric, 0) as avg_message_bytes,
  MIN(created_at) as first_call,
  MAX(created_at) as last_call
FROM mcp_hl7_x12_audit_log
GROUP BY tenant_id, tool_name, message_type, message_subtype;

-- View: Clearinghouse transaction statistics by tenant
CREATE OR REPLACE VIEW mcp_clearinghouse_stats AS
SELECT
  tenant_id,
  transaction_type,
  payer_id,
  payer_name,
  clearinghouse_provider,
  COUNT(*) as total_transactions,
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE success = false) as failed,
  COUNT(*) FILTER (WHERE transaction_status = 'accepted') as accepted,
  COUNT(*) FILTER (WHERE transaction_status = 'rejected') as rejected,
  COUNT(*) FILTER (WHERE transaction_status = 'pending') as pending,
  SUM(charge_amount) as total_charges,
  SUM(paid_amount) as total_paid,
  ROUND(AVG(execution_time_ms)::numeric, 2) as avg_execution_ms,
  MIN(created_at) as first_transaction,
  MAX(created_at) as last_transaction
FROM mcp_clearinghouse_audit_log
GROUP BY tenant_id, transaction_type, payer_id, payer_name, clearinghouse_provider;

-- View: Daily clearinghouse volume
CREATE OR REPLACE VIEW mcp_clearinghouse_daily_volume AS
SELECT
  tenant_id,
  DATE(created_at) as transaction_date,
  transaction_type,
  COUNT(*) as transaction_count,
  SUM(charge_amount) as total_charges,
  SUM(paid_amount) as total_paid,
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE transaction_status = 'accepted') as accepted,
  COUNT(*) FILTER (WHERE transaction_status = 'rejected') as rejected
FROM mcp_clearinghouse_audit_log
GROUP BY tenant_id, DATE(created_at), transaction_type
ORDER BY transaction_date DESC;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to log HL7/X12 MCP call
CREATE OR REPLACE FUNCTION log_hl7_x12_mcp_call(
  p_tenant_id UUID,
  p_user_id UUID,
  p_tool_name TEXT,
  p_request_params JSONB,
  p_success BOOLEAN,
  p_response_data JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_message_type TEXT DEFAULT NULL,
  p_message_subtype TEXT DEFAULT NULL,
  p_control_id TEXT DEFAULT NULL,
  p_source_format TEXT DEFAULT NULL,
  p_target_format TEXT DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL,
  p_message_size_bytes INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO mcp_hl7_x12_audit_log (
    tenant_id, user_id, tool_name, request_params, success,
    response_data, error_message, message_type, message_subtype,
    control_id, source_format, target_format, execution_time_ms, message_size_bytes
  ) VALUES (
    p_tenant_id, p_user_id, p_tool_name, p_request_params, p_success,
    p_response_data, p_error_message, p_message_type, p_message_subtype,
    p_control_id, p_source_format, p_target_format, p_execution_time_ms, p_message_size_bytes
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Function to log Clearinghouse MCP call
CREATE OR REPLACE FUNCTION log_clearinghouse_mcp_call(
  p_tenant_id UUID,
  p_user_id UUID,
  p_tool_name TEXT,
  p_request_params JSONB,
  p_success BOOLEAN,
  p_response_data JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_transaction_type TEXT DEFAULT NULL,
  p_payer_id TEXT DEFAULT NULL,
  p_payer_name TEXT DEFAULT NULL,
  p_claim_id TEXT DEFAULT NULL,
  p_submission_id TEXT DEFAULT NULL,
  p_patient_id TEXT DEFAULT NULL,
  p_charge_amount DECIMAL DEFAULT NULL,
  p_paid_amount DECIMAL DEFAULT NULL,
  p_transaction_status TEXT DEFAULT NULL,
  p_status_code TEXT DEFAULT NULL,
  p_status_description TEXT DEFAULT NULL,
  p_clearinghouse_provider TEXT DEFAULT NULL,
  p_clearinghouse_trace_number TEXT DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO mcp_clearinghouse_audit_log (
    tenant_id, user_id, tool_name, request_params, success,
    response_data, error_message, transaction_type, payer_id, payer_name,
    claim_id, submission_id, patient_id, charge_amount, paid_amount,
    transaction_status, status_code, status_description,
    clearinghouse_provider, clearinghouse_trace_number, execution_time_ms
  ) VALUES (
    p_tenant_id, p_user_id, p_tool_name, p_request_params, p_success,
    p_response_data, p_error_message, p_transaction_type, p_payer_id, p_payer_name,
    p_claim_id, p_submission_id, p_patient_id, p_charge_amount, p_paid_amount,
    p_transaction_status, p_status_code, p_status_description,
    p_clearinghouse_provider, p_clearinghouse_trace_number, p_execution_time_ms
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT ON mcp_hl7_x12_audit_log TO authenticated;
GRANT SELECT ON mcp_clearinghouse_audit_log TO authenticated;
GRANT SELECT ON mcp_hl7_x12_stats TO authenticated;
GRANT SELECT ON mcp_clearinghouse_stats TO authenticated;
GRANT SELECT ON mcp_clearinghouse_daily_volume TO authenticated;

GRANT ALL ON mcp_hl7_x12_audit_log TO service_role;
GRANT ALL ON mcp_clearinghouse_audit_log TO service_role;

GRANT EXECUTE ON FUNCTION log_hl7_x12_mcp_call TO service_role;
GRANT EXECUTE ON FUNCTION log_clearinghouse_mcp_call TO service_role;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE mcp_hl7_x12_audit_log IS 'Audit log for HL7/X12 Transformer MCP server operations';
COMMENT ON TABLE mcp_clearinghouse_audit_log IS 'Audit log for Clearinghouse MCP server operations';

COMMENT ON VIEW mcp_hl7_x12_stats IS 'Statistics view for HL7/X12 transformation operations by tenant';
COMMENT ON VIEW mcp_clearinghouse_stats IS 'Statistics view for clearinghouse transactions by tenant';
COMMENT ON VIEW mcp_clearinghouse_daily_volume IS 'Daily transaction volume for clearinghouse operations';

COMMENT ON FUNCTION log_hl7_x12_mcp_call IS 'Log an HL7/X12 Transformer MCP operation with full context';
COMMENT ON FUNCTION log_clearinghouse_mcp_call IS 'Log a Clearinghouse MCP operation with full context';
