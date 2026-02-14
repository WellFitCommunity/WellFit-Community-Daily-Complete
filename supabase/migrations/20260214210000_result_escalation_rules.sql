-- =============================================================================
-- Result Escalation Rules Engine (Phase 1 P7)
-- Auto-route abnormal lab values to specialist providers with SLA tracking
-- =============================================================================

-- ==================== TABLES ====================

CREATE TABLE IF NOT EXISTS result_escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('above', 'below', 'outside_range')),
  threshold_high NUMERIC,
  threshold_low NUMERIC,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'moderate', 'low')),
  route_to_specialty TEXT NOT NULL,
  target_minutes INTEGER NOT NULL DEFAULT 60,
  escalation_1_minutes INTEGER DEFAULT 120,
  escalation_2_minutes INTEGER DEFAULT 240,
  auto_create_task BOOLEAN NOT NULL DEFAULT true,
  notification_channels TEXT[] DEFAULT ARRAY['inbox'],
  clinical_guidance TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, test_name, condition, severity)
);

CREATE TABLE IF NOT EXISTS result_escalation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES result_escalation_rules(id) ON DELETE CASCADE,
  result_id UUID NOT NULL,
  result_source TEXT NOT NULL CHECK (result_source IN ('lab_results', 'fhir_diagnostic_reports')),
  patient_id UUID NOT NULL,
  test_name TEXT NOT NULL,
  test_value NUMERIC NOT NULL,
  test_unit TEXT,
  severity TEXT NOT NULL,
  route_to_specialty TEXT NOT NULL,
  routed_to_provider_id UUID,
  task_id UUID,
  escalation_status TEXT NOT NULL DEFAULT 'pending' CHECK (escalation_status IN ('pending', 'routed', 'acknowledged', 'resolved', 'expired')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_escalation_rules_test_name
  ON result_escalation_rules (test_name);

CREATE INDEX IF NOT EXISTS idx_escalation_rules_active
  ON result_escalation_rules (is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_escalation_log_patient
  ON result_escalation_log (patient_id);

CREATE INDEX IF NOT EXISTS idx_escalation_log_status
  ON result_escalation_log (escalation_status);

CREATE INDEX IF NOT EXISTS idx_escalation_log_created
  ON result_escalation_log (created_at DESC);

-- ==================== RLS ====================

ALTER TABLE result_escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_escalation_log ENABLE ROW LEVEL SECURITY;

-- Rules: admin/super_admin can manage
CREATE POLICY "escalation_rules_select_admin" ON result_escalation_rules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
    OR tenant_id IS NULL  -- global defaults visible to all authenticated
  );

CREATE POLICY "escalation_rules_insert_admin" ON result_escalation_rules
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "escalation_rules_update_admin" ON result_escalation_rules
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- Log: broader read access for clinical roles
CREATE POLICY "escalation_log_select_clinical" ON result_escalation_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin', 'physician', 'nurse')
    )
  );

-- Log: system insert for automated escalation (service role)
CREATE POLICY "escalation_log_insert_system" ON result_escalation_log
  FOR INSERT
  WITH CHECK (true);

-- Log: update for resolving escalations
CREATE POLICY "escalation_log_update_clinical" ON result_escalation_log
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin', 'physician', 'nurse')
    )
  );

-- ==================== UPDATED_AT TRIGGER ====================

CREATE OR REPLACE FUNCTION update_result_escalation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_result_escalation_rules_updated_at
  BEFORE UPDATE ON result_escalation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_result_escalation_rules_updated_at();

-- ==================== VIEW ====================

CREATE OR REPLACE VIEW v_active_escalation_rules
WITH (security_invoker = on) AS
SELECT
  r.*,
  COALESCE(log_counts.recent_escalations, 0) AS recent_escalations
FROM result_escalation_rules r
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS recent_escalations
  FROM result_escalation_log el
  WHERE el.rule_id = r.id
    AND el.created_at >= NOW() - INTERVAL '30 days'
) log_counts ON true
WHERE r.is_active = true;

-- ==================== SEED DATA ====================

INSERT INTO result_escalation_rules
  (test_name, display_name, condition, threshold_high, threshold_low, severity, route_to_specialty, target_minutes, escalation_1_minutes, escalation_2_minutes, clinical_guidance, tenant_id)
VALUES
  ('troponin', 'Troponin I', 'above', 0.04, NULL, 'critical', 'cardiology', 30, 60, 120, 'Acute MI possible — Cardiology consult', NULL),
  ('creatinine', 'Creatinine', 'above', 2.0, NULL, 'critical', 'nephrology', 60, 120, 240, 'Acute kidney injury risk — Consider nephrology consult', NULL),
  ('potassium', 'Potassium', 'above', 5.5, NULL, 'critical', 'cardiology', 30, 60, 120, 'Cardiac arrhythmia risk — Monitor EKG', NULL),
  ('potassium', 'Potassium', 'below', NULL, 3.0, 'critical', 'cardiology', 30, 60, 120, 'Hypokalemia — Cardiac arrhythmia risk', NULL),
  ('glucose', 'Blood Glucose', 'above', 300, NULL, 'high', 'endocrinology', 60, 120, 240, 'Hyperglycemia — Adjust insulin', NULL),
  ('hemoglobin', 'Hemoglobin', 'below', NULL, 7.0, 'critical', 'hematology', 60, 120, 240, 'Severe anemia — Consider transfusion', NULL),
  ('inr', 'INR', 'above', 3.5, NULL, 'high', 'hematology', 60, 120, 240, 'Bleeding risk — Hold anticoagulation', NULL)
ON CONFLICT DO NOTHING;
