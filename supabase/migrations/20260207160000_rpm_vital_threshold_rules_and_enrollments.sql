-- ============================================================================
-- RPM Vital Threshold Rules & Enrollment Tracking
-- ============================================================================
-- Purpose: Per-patient/condition vital sign threshold rules and RPM enrollment
-- tracking for clinical monitoring and CPT 99453-99458 billing.
--
-- Reuses proven patterns from:
--   - capacity_alert_rules (threshold rule structure)
--   - setup_default_capacity_rules() (default seeding function)
--   - guardian_alerts (alert destination)
--
-- Date: 2026-02-07
-- ============================================================================

-- ============================================================================
-- 1. Vital Threshold Rules Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS vital_threshold_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Scope: NULL patient_id = default rule for all patients in tenant
  patient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ICD-10 condition code (e.g., 'I10' hypertension) — NULL = general
  condition_code text,

  -- Rule identification
  rule_name text NOT NULL,
  vital_type text NOT NULL CHECK (vital_type IN (
    'heart_rate', 'bp_systolic', 'bp_diastolic',
    'oxygen_saturation', 'glucose', 'weight', 'temperature'
  )),
  loinc_code text,

  -- Threshold
  threshold_operator text NOT NULL CHECK (threshold_operator IN ('>=', '>', '<=', '<')),
  threshold_value numeric NOT NULL,

  -- Alert configuration
  alert_type text NOT NULL CHECK (alert_type IN ('vital_watch', 'vital_warning', 'vital_critical')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  escalation_level integer NOT NULL DEFAULT 1,
  escalation_targets text[] NOT NULL DEFAULT '{}',

  -- Timing
  cooldown_minutes integer NOT NULL DEFAULT 60,
  auto_resolve boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vital_threshold_rules_tenant
  ON vital_threshold_rules (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_vital_threshold_rules_patient
  ON vital_threshold_rules (patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vital_threshold_rules_type
  ON vital_threshold_rules (vital_type);

-- ============================================================================
-- 2. RPM Enrollments Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS rpm_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'paused', 'completed', 'cancelled'
  )),

  enrolled_at timestamptz NOT NULL DEFAULT now(),
  enrolled_by uuid REFERENCES auth.users(id),

  -- Clinical context
  primary_diagnosis_code text,
  monitoring_reason text,
  ordering_provider_id uuid REFERENCES auth.users(id),

  -- Device tracking
  device_types text[] NOT NULL DEFAULT '{}',

  -- Billing milestones (CPT 99453-99458)
  setup_completed_at timestamptz,
  total_monitoring_minutes integer NOT NULL DEFAULT 0,

  -- Monitoring period
  monitoring_start_date date,
  monitoring_end_date date,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate active enrollments per patient
  CONSTRAINT uq_rpm_enrollment_active UNIQUE (tenant_id, patient_id, status)
);

CREATE INDEX IF NOT EXISTS idx_rpm_enrollments_tenant
  ON rpm_enrollments (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_rpm_enrollments_patient
  ON rpm_enrollments (patient_id, status);
CREATE INDEX IF NOT EXISTS idx_rpm_enrollments_provider
  ON rpm_enrollments (ordering_provider_id) WHERE ordering_provider_id IS NOT NULL;

-- ============================================================================
-- 3. Ensure guardian_alerts has columns needed for vital alerts
-- ============================================================================
DO $$
BEGIN
  -- reference_type (e.g., 'patient', 'facility')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_alerts' AND column_name = 'reference_type'
  ) THEN
    ALTER TABLE guardian_alerts ADD COLUMN reference_type text;
  END IF;

  -- reference_id (the entity the alert is about)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_alerts' AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE guardian_alerts ADD COLUMN reference_id text;
  END IF;

  -- alert_type (granular type, e.g., 'vital_critical', 'capacity_watch')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_alerts' AND column_name = 'alert_type'
  ) THEN
    ALTER TABLE guardian_alerts ADD COLUMN alert_type text;
  END IF;

  -- tenant_id (may not exist on older guardian_alerts)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_alerts' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE guardian_alerts ADD COLUMN tenant_id uuid REFERENCES tenants(id);
  END IF;
END $$;

-- Index for cooldown lookups
CREATE INDEX IF NOT EXISTS idx_guardian_alerts_ref_type
  ON guardian_alerts (reference_id, alert_type, status);
CREATE INDEX IF NOT EXISTS idx_guardian_alerts_tenant
  ON guardian_alerts (tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- 4. Default Vital Threshold Rules (per-tenant seeding)
-- ============================================================================
CREATE OR REPLACE FUNCTION setup_default_vital_rules(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ── Heart Rate ──────────────────────────────────────────────────────
  -- High HR (>100 bpm) - tachycardia watch
  INSERT INTO vital_threshold_rules (
    tenant_id, rule_name, vital_type, loinc_code,
    threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'Heart Rate High', 'heart_rate', '8867-4',
    '>=', 100,
    'vital_watch', 'low', 1, ARRAY['nurse'], 60
  ) ON CONFLICT DO NOTHING;

  -- Critical HR (>130 bpm)
  INSERT INTO vital_threshold_rules (
    tenant_id, rule_name, vital_type, loinc_code,
    threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'Heart Rate Critical', 'heart_rate', '8867-4',
    '>=', 130,
    'vital_critical', 'critical', 3, ARRAY['physician', 'nurse', 'charge_nurse'], 15
  ) ON CONFLICT DO NOTHING;

  -- Low HR (<50 bpm) - bradycardia
  INSERT INTO vital_threshold_rules (
    tenant_id, rule_name, vital_type, loinc_code,
    threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'Heart Rate Low', 'heart_rate', '8867-4',
    '<', 50,
    'vital_warning', 'medium', 2, ARRAY['nurse', 'physician'], 30
  ) ON CONFLICT DO NOTHING;

  -- ── Blood Pressure Systolic ─────────────────────────────────────────
  -- High systolic (>=140 mmHg) - stage 2 hypertension
  INSERT INTO vital_threshold_rules (
    tenant_id, rule_name, vital_type, loinc_code,
    threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'BP Systolic High', 'bp_systolic', '8480-6',
    '>=', 140,
    'vital_watch', 'low', 1, ARRAY['nurse'], 60
  ) ON CONFLICT DO NOTHING;

  -- Crisis systolic (>=180 mmHg) - hypertensive crisis
  INSERT INTO vital_threshold_rules (
    tenant_id, rule_name, vital_type, loinc_code,
    threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'BP Systolic Crisis', 'bp_systolic', '8480-6',
    '>=', 180,
    'vital_critical', 'critical', 3, ARRAY['physician', 'nurse', 'charge_nurse'], 15
  ) ON CONFLICT DO NOTHING;

  -- Low systolic (<90 mmHg) - hypotension
  INSERT INTO vital_threshold_rules (
    tenant_id, rule_name, vital_type, loinc_code,
    threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'BP Systolic Low', 'bp_systolic', '8480-6',
    '<', 90,
    'vital_warning', 'medium', 2, ARRAY['nurse', 'physician'], 30
  ) ON CONFLICT DO NOTHING;

  -- ── Blood Pressure Diastolic ────────────────────────────────────────
  -- High diastolic (>=90 mmHg)
  INSERT INTO vital_threshold_rules (
    tenant_id, rule_name, vital_type, loinc_code,
    threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'BP Diastolic High', 'bp_diastolic', '8462-4',
    '>=', 90,
    'vital_watch', 'low', 1, ARRAY['nurse'], 60
  ) ON CONFLICT DO NOTHING;

  -- ── Oxygen Saturation ───────────────────────────────────────────────
  -- Low SpO2 (<92%)
  INSERT INTO vital_threshold_rules (
    tenant_id, rule_name, vital_type, loinc_code,
    threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'SpO2 Low', 'oxygen_saturation', '2708-6',
    '<', 92,
    'vital_warning', 'medium', 2, ARRAY['nurse', 'physician'], 30
  ) ON CONFLICT DO NOTHING;

  -- Critical SpO2 (<88%)
  INSERT INTO vital_threshold_rules (
    tenant_id, rule_name, vital_type, loinc_code,
    threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'SpO2 Critical', 'oxygen_saturation', '2708-6',
    '<', 88,
    'vital_critical', 'critical', 3, ARRAY['physician', 'nurse', 'charge_nurse'], 15
  ) ON CONFLICT DO NOTHING;

  -- ── Glucose ─────────────────────────────────────────────────────────
  -- High glucose (>=200 mg/dL)
  INSERT INTO vital_threshold_rules (
    tenant_id, rule_name, vital_type, loinc_code,
    threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'Glucose High', 'glucose', '2339-0',
    '>=', 200,
    'vital_watch', 'low', 1, ARRAY['nurse'], 60
  ) ON CONFLICT DO NOTHING;

  -- Critical glucose (>=300 mg/dL)
  INSERT INTO vital_threshold_rules (
    tenant_id, rule_name, vital_type, loinc_code,
    threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'Glucose Critical', 'glucose', '2339-0',
    '>=', 300,
    'vital_critical', 'critical', 3, ARRAY['physician', 'nurse', 'charge_nurse'], 15
  ) ON CONFLICT DO NOTHING;

  -- Low glucose (<70 mg/dL) - hypoglycemia
  INSERT INTO vital_threshold_rules (
    tenant_id, rule_name, vital_type, loinc_code,
    threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'Glucose Low', 'glucose', '2339-0',
    '<', 70,
    'vital_warning', 'high', 2, ARRAY['nurse', 'physician'], 30
  ) ON CONFLICT DO NOTHING;

  -- ── Temperature ─────────────────────────────────────────────────────
  -- High temperature (>=100.4°F / 38°C) - fever
  INSERT INTO vital_threshold_rules (
    tenant_id, rule_name, vital_type, loinc_code,
    threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'Temperature High', 'temperature', '8310-5',
    '>=', 100.4,
    'vital_warning', 'medium', 2, ARRAY['nurse', 'physician'], 60
  ) ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================================================
-- 5. Row Level Security
-- ============================================================================
ALTER TABLE vital_threshold_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vital_threshold_rules_tenant_isolation" ON vital_threshold_rules
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "vital_threshold_rules_service_role" ON vital_threshold_rules
  FOR ALL TO service_role USING (true);

ALTER TABLE rpm_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rpm_enrollments_tenant_isolation" ON rpm_enrollments
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "rpm_enrollments_service_role" ON rpm_enrollments
  FOR ALL TO service_role USING (true);

-- ============================================================================
-- 6. Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON vital_threshold_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rpm_enrollments TO authenticated;
GRANT EXECUTE ON FUNCTION setup_default_vital_rules TO authenticated;

-- ============================================================================
-- 7. Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'RPM Vital Threshold Rules & Enrollments Migration Complete';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Tables created: vital_threshold_rules, rpm_enrollments';
  RAISE NOTICE 'Function: setup_default_vital_rules(tenant_id)';
  RAISE NOTICE 'guardian_alerts columns ensured: reference_type, reference_id, alert_type, tenant_id';
  RAISE NOTICE 'Default rules: 14 vital thresholds (HR, BP, SpO2, glucose, temperature)';
  RAISE NOTICE 'RLS policies applied for tenant isolation';
  RAISE NOTICE '=================================================================';
END $$;
