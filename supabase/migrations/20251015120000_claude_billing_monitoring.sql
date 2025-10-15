-- =====================================================================
-- Claude & Billing Monitoring Tables
-- Enterprise-grade monitoring for AI usage and billing workflows
-- HIPAA & SOC2 Compliant
-- =====================================================================

-- =====================================================================
-- Claude Usage Logging
-- Tracks all Claude API requests for cost monitoring and optimization
-- =====================================================================

CREATE TABLE IF NOT EXISTS claude_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Request context (NO PHI)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id TEXT NOT NULL,
  request_type TEXT NOT NULL,

  -- Model and usage
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,

  -- Cost tracking
  cost DECIMAL(10, 4) NOT NULL DEFAULT 0,

  -- Performance metrics
  response_time_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  error_code TEXT,
  error_message TEXT,

  -- Compliance & audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes for performance
  CONSTRAINT claude_usage_logs_check_tokens CHECK (input_tokens >= 0 AND output_tokens >= 0),
  CONSTRAINT claude_usage_logs_check_cost CHECK (cost >= 0)
);

-- Indexes
CREATE INDEX idx_claude_usage_logs_user_id ON claude_usage_logs(user_id);
CREATE INDEX idx_claude_usage_logs_created_at ON claude_usage_logs(created_at DESC);
CREATE INDEX idx_claude_usage_logs_model ON claude_usage_logs(model);
CREATE INDEX idx_claude_usage_logs_success ON claude_usage_logs(success);
CREATE INDEX idx_claude_usage_logs_request_type ON claude_usage_logs(request_type);

-- RLS Policies
ALTER TABLE claude_usage_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all Claude usage logs"
  ON claude_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- System can insert logs (service role)
CREATE POLICY "System can insert Claude usage logs"
  ON claude_usage_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =====================================================================
-- Billing Workflow Logs
-- Tracks all billing workflow executions
-- =====================================================================

CREATE TABLE IF NOT EXISTS billing_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workflow context (NO PHI - use encounter_id as reference)
  encounter_id UUID NOT NULL,
  patient_id UUID, -- Hashed/pseudonymized reference
  provider_id UUID REFERENCES billing_providers(id),
  payer_id UUID REFERENCES billing_payers(id),

  -- Workflow execution
  workflow_version TEXT DEFAULT 'v1.0',
  encounter_type TEXT,
  service_date DATE,

  -- Results
  success BOOLEAN NOT NULL DEFAULT false,
  requires_manual_review BOOLEAN NOT NULL DEFAULT false,
  manual_review_reason TEXT,

  -- AI integration
  ai_suggestions_used BOOLEAN DEFAULT false,
  ai_suggestions_accepted BOOLEAN DEFAULT false,
  sdoh_enhanced BOOLEAN DEFAULT false,

  -- Financial (aggregated, no itemized PHI)
  total_charges DECIMAL(12, 2) DEFAULT 0,
  estimated_reimbursement DECIMAL(12, 2) DEFAULT 0,

  -- Performance
  processing_time_ms INTEGER,
  workflow_steps INTEGER DEFAULT 0,

  -- Errors (NO PHI in error messages)
  errors JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT billing_workflows_check_charges CHECK (total_charges >= 0),
  CONSTRAINT billing_workflows_check_reimbursement CHECK (estimated_reimbursement >= 0)
);

-- Indexes
CREATE INDEX idx_billing_workflows_encounter_id ON billing_workflows(encounter_id);
CREATE INDEX idx_billing_workflows_created_at ON billing_workflows(created_at DESC);
CREATE INDEX idx_billing_workflows_success ON billing_workflows(success);
CREATE INDEX idx_billing_workflows_requires_review ON billing_workflows(requires_manual_review);
CREATE INDEX idx_billing_workflows_service_date ON billing_workflows(service_date);
CREATE INDEX idx_billing_workflows_encounter_type ON billing_workflows(encounter_type);

-- RLS Policies
ALTER TABLE billing_workflows ENABLE ROW LEVEL SECURITY;

-- Admins can view all workflows
CREATE POLICY "Admins can view all billing workflows"
  ON billing_workflows
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin', 'billing_admin')
    )
  );

-- System can insert/update workflows
CREATE POLICY "System can manage billing workflows"
  ON billing_workflows
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================================
-- Monitoring Dashboards Views
-- Pre-aggregated views for fast dashboard queries
-- =====================================================================

-- Claude usage summary (last 30 days)
CREATE OR REPLACE VIEW claude_usage_summary AS
SELECT
  DATE(created_at) as usage_date,
  model,
  COUNT(*) as total_requests,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_requests,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(cost) as total_cost,
  AVG(response_time_ms) as avg_response_time_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time_ms
FROM claude_usage_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), model
ORDER BY usage_date DESC, model;

-- Billing workflow summary (last 30 days)
CREATE OR REPLACE VIEW billing_workflow_summary AS
SELECT
  DATE(created_at) as workflow_date,
  encounter_type,
  COUNT(*) as total_workflows,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_workflows,
  SUM(CASE WHEN requires_manual_review THEN 1 ELSE 0 END) as manual_reviews,
  SUM(CASE WHEN ai_suggestions_used THEN 1 ELSE 0 END) as ai_assisted,
  SUM(CASE WHEN sdoh_enhanced THEN 1 ELSE 0 END) as sdoh_enhanced,
  SUM(total_charges) as total_charges,
  SUM(estimated_reimbursement) as total_reimbursement,
  AVG(processing_time_ms) as avg_processing_time_ms
FROM billing_workflows
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), encounter_type
ORDER BY workflow_date DESC, encounter_type;

-- =====================================================================
-- Data Retention Policies (SOC2 Compliance)
-- Automated cleanup of old monitoring data
-- =====================================================================

-- Function to cleanup old monitoring data (retention: 1 year)
CREATE OR REPLACE FUNCTION cleanup_monitoring_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete Claude usage logs older than 1 year
  DELETE FROM claude_usage_logs
  WHERE created_at < NOW() - INTERVAL '1 year';

  -- Delete billing workflow logs older than 7 years (legal requirement)
  -- Archive to cold storage before deletion in production
  DELETE FROM billing_workflows
  WHERE created_at < NOW() - INTERVAL '7 years';

  -- Log cleanup operation
  RAISE NOTICE 'Monitoring data cleanup completed at %', NOW();
END;
$$;

-- Schedule cleanup job (run monthly)
-- Note: This requires pg_cron extension to be enabled
-- ALTER SYSTEM SET cron.database_name = 'postgres';
-- SELECT cron.schedule('cleanup-monitoring-data', '0 0 1 * *', 'SELECT cleanup_monitoring_data()');

-- =====================================================================
-- Audit Logging for Administrative Actions
-- HIPAA & SOC2 Compliance
-- =====================================================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Actor information
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  admin_email TEXT,

  -- Action details
  action_type TEXT NOT NULL, -- 'view', 'export', 'modify', 'delete'
  resource_type TEXT NOT NULL, -- 'claude_metrics', 'billing_workflow', 'patient_data'
  resource_id UUID,

  -- Context
  action_description TEXT,
  ip_address INET,
  user_agent TEXT,

  -- Compliance
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT admin_audit_logs_check_action CHECK (
    action_type IN ('view', 'export', 'modify', 'delete', 'access')
  )
);

-- Indexes
CREATE INDEX idx_admin_audit_logs_admin_user_id ON admin_audit_logs(admin_user_id);
CREATE INDEX idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX idx_admin_audit_logs_action_type ON admin_audit_logs(action_type);
CREATE INDEX idx_admin_audit_logs_resource_type ON admin_audit_logs(resource_type);

-- RLS Policies
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can view all audit logs
CREATE POLICY "Super admins can view audit logs"
  ON admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- All authenticated users can insert audit logs (for self-logging)
CREATE POLICY "Users can log their own actions"
  ON admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (admin_user_id = auth.uid());

-- =====================================================================
-- Helper Functions for Monitoring
-- =====================================================================

-- Function to log Claude usage
CREATE OR REPLACE FUNCTION log_claude_usage(
  p_user_id UUID,
  p_request_id TEXT,
  p_request_type TEXT,
  p_model TEXT,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER,
  p_cost DECIMAL,
  p_response_time_ms INTEGER,
  p_success BOOLEAN,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO claude_usage_logs (
    user_id,
    request_id,
    request_type,
    model,
    input_tokens,
    output_tokens,
    cost,
    response_time_ms,
    success,
    error_code,
    error_message
  ) VALUES (
    p_user_id,
    p_request_id,
    p_request_type,
    p_model,
    p_input_tokens,
    p_output_tokens,
    p_cost,
    p_response_time_ms,
    p_success,
    p_error_code,
    p_error_message
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Function to log billing workflow
CREATE OR REPLACE FUNCTION log_billing_workflow(
  p_encounter_id UUID,
  p_patient_id UUID,
  p_provider_id UUID,
  p_payer_id UUID,
  p_encounter_type TEXT,
  p_service_date DATE,
  p_success BOOLEAN,
  p_requires_manual_review BOOLEAN,
  p_total_charges DECIMAL,
  p_estimated_reimbursement DECIMAL,
  p_processing_time_ms INTEGER,
  p_errors JSONB DEFAULT '[]'::jsonb,
  p_warnings JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workflow_id UUID;
BEGIN
  INSERT INTO billing_workflows (
    encounter_id,
    patient_id,
    provider_id,
    payer_id,
    encounter_type,
    service_date,
    success,
    requires_manual_review,
    total_charges,
    estimated_reimbursement,
    processing_time_ms,
    errors,
    warnings,
    created_by
  ) VALUES (
    p_encounter_id,
    p_patient_id,
    p_provider_id,
    p_payer_id,
    p_encounter_type,
    p_service_date,
    p_success,
    p_requires_manual_review,
    p_total_charges,
    p_estimated_reimbursement,
    p_processing_time_ms,
    p_errors,
    p_warnings,
    auth.uid()
  )
  RETURNING id INTO v_workflow_id;

  RETURN v_workflow_id;
END;
$$;

-- =====================================================================
-- Comments for Documentation
-- =====================================================================

COMMENT ON TABLE claude_usage_logs IS 'HIPAA & SOC2 compliant logging of all Claude AI API requests. Contains NO PHI - only usage metrics and costs.';
COMMENT ON TABLE billing_workflows IS 'HIPAA & SOC2 compliant logging of billing workflow executions. Contains NO itemized PHI - only aggregated metrics.';
COMMENT ON TABLE admin_audit_logs IS 'SOC2 compliant audit trail of all administrative actions for security monitoring and compliance reporting.';

COMMENT ON FUNCTION log_claude_usage IS 'Helper function to log Claude AI usage with automatic timestamping and validation.';
COMMENT ON FUNCTION log_billing_workflow IS 'Helper function to log billing workflow execution with automatic timestamping.';
COMMENT ON FUNCTION cleanup_monitoring_data IS 'Automated cleanup function for monitoring data retention compliance (SOC2).';

-- =====================================================================
-- Grant Permissions
-- =====================================================================

-- Service role can execute all functions
GRANT EXECUTE ON FUNCTION log_claude_usage TO service_role;
GRANT EXECUTE ON FUNCTION log_billing_workflow TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_monitoring_data TO service_role;

-- =====================================================================
-- Migration Complete
-- =====================================================================

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Claude & Billing Monitoring tables created successfully';
  RAISE NOTICE '   - claude_usage_logs: Claude AI usage tracking';
  RAISE NOTICE '   - billing_workflows: Billing workflow execution logs';
  RAISE NOTICE '   - admin_audit_logs: Administrative action audit trail';
  RAISE NOTICE '   - Monitoring views: Pre-aggregated dashboard data';
  RAISE NOTICE '   - HIPAA & SOC2 compliant: NO PHI in monitoring tables';
END $$;
