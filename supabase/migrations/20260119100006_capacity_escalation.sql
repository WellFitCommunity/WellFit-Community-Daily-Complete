-- ============================================================================
-- Capacity Escalation Automation
-- ============================================================================
-- Purpose: Automated threshold alerts for bed capacity
-- Date: 2026-01-19
--
-- Escalation Rules:
--   - 70-80% occupancy: Alert charge nurse
--   - 80-90% occupancy: Alert bed control + discharge coordinator
--   - 90-95% occupancy: Alert hospital administrator
--   - >95% occupancy: Trigger divert protocol notification
-- ============================================================================

-- ============================================================================
-- 1. Capacity Alert Rules Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS capacity_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Rule identification
  rule_name text NOT NULL,
  rule_description text,
  is_active boolean NOT NULL DEFAULT true,

  -- Threshold
  threshold_type text NOT NULL CHECK (threshold_type IN ('occupancy_percent', 'available_beds', 'ed_boarding_count', 'ed_boarding_hours')),
  threshold_operator text NOT NULL CHECK (threshold_operator IN ('>=', '>', '<=', '<', '=')),
  threshold_value numeric NOT NULL,

  -- Scope
  applies_to_facility_id uuid,  -- NULL = all facilities
  applies_to_unit_type text,     -- NULL = all unit types

  -- Alert configuration
  alert_type text NOT NULL,      -- e.g., 'capacity_watch', 'capacity_warning', 'capacity_critical', 'capacity_divert'
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  escalation_level integer NOT NULL DEFAULT 1,

  -- Notification targets (role names)
  escalation_targets text[] NOT NULL DEFAULT '{}',

  -- Timing
  cooldown_minutes integer NOT NULL DEFAULT 60,  -- Don't re-alert for this many minutes
  auto_resolve boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capacity_alert_rules_tenant
  ON capacity_alert_rules (tenant_id, is_active);

-- ============================================================================
-- 2. Insert Default Rules
-- ============================================================================
-- Note: These will be inserted per-tenant when they set up capacity monitoring.
-- This creates a template function to set up default rules.

CREATE OR REPLACE FUNCTION setup_default_capacity_rules(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Watch: 70-80% occupancy
  INSERT INTO capacity_alert_rules (
    tenant_id, rule_name, rule_description, threshold_type, threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'Capacity Watch', 'Monitor when occupancy reaches 70%',
    'occupancy_percent', '>=', 70,
    'capacity_watch', 'low', 1, ARRAY['charge_nurse'], 60
  )
  ON CONFLICT DO NOTHING;

  -- Warning: 80-90% occupancy
  INSERT INTO capacity_alert_rules (
    tenant_id, rule_name, rule_description, threshold_type, threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'Capacity Warning', 'Alert when occupancy reaches 80%',
    'occupancy_percent', '>=', 80,
    'capacity_warning', 'medium', 2, ARRAY['bed_control', 'discharge_coordinator', 'charge_nurse'], 30
  )
  ON CONFLICT DO NOTHING;

  -- Critical: 90-95% occupancy
  INSERT INTO capacity_alert_rules (
    tenant_id, rule_name, rule_description, threshold_type, threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'Capacity Critical', 'Escalate when occupancy reaches 90%',
    'occupancy_percent', '>=', 90,
    'capacity_critical', 'high', 3, ARRAY['hospital_administrator', 'bed_control', 'discharge_coordinator', 'nursing_supervisor'], 15
  )
  ON CONFLICT DO NOTHING;

  -- Divert: >95% occupancy
  INSERT INTO capacity_alert_rules (
    tenant_id, rule_name, rule_description, threshold_type, threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'Capacity Divert', 'Divert protocol when occupancy exceeds 95%',
    'occupancy_percent', '>=', 95,
    'capacity_divert', 'critical', 4, ARRAY['hospital_administrator', 'bed_control', 'discharge_coordinator', 'charge_nurse', 'nursing_supervisor'], 5
  )
  ON CONFLICT DO NOTHING;

  -- ED Boarding: >4 hours
  INSERT INTO capacity_alert_rules (
    tenant_id, rule_name, rule_description, threshold_type, threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'ED Boarding Alert', 'Alert when any ED boarder exceeds 4 hours',
    'ed_boarding_hours', '>=', 4,
    'ed_boarding_warning', 'medium', 2, ARRAY['bed_control', 'ed_charge_nurse', 'nursing_supervisor'], 30
  )
  ON CONFLICT DO NOTHING;

  -- ED Boarding Critical: >8 hours
  INSERT INTO capacity_alert_rules (
    tenant_id, rule_name, rule_description, threshold_type, threshold_operator, threshold_value,
    alert_type, severity, escalation_level, escalation_targets, cooldown_minutes
  ) VALUES (
    p_tenant_id, 'ED Boarding Critical', 'Escalate when ED boarder exceeds 8 hours',
    'ed_boarding_hours', '>=', 8,
    'ed_boarding_critical', 'high', 3, ARRAY['hospital_administrator', 'bed_control', 'ed_medical_director', 'nursing_supervisor'], 15
  )
  ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================================================
-- 3. Function: Check and Create Capacity Alerts
-- ============================================================================
CREATE OR REPLACE FUNCTION check_capacity_alerts(p_facility_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_facility RECORD;
  v_occupancy_percent numeric;
  v_rule RECORD;
  v_existing_alert_count integer;
  v_alerts_created integer := 0;
  v_now timestamptz := now();
BEGIN
  -- Get facility capacity
  SELECT * INTO v_facility
  FROM facility_capacity_snapshots
  WHERE facility_id = p_facility_id
  ORDER BY snapshot_at DESC
  LIMIT 1;

  IF v_facility IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No capacity data for facility');
  END IF;

  v_occupancy_percent := v_facility.occupancy_percent;

  -- Check each applicable rule
  FOR v_rule IN
    SELECT * FROM capacity_alert_rules
    WHERE tenant_id = v_facility.tenant_id
      AND is_active = true
      AND threshold_type = 'occupancy_percent'
      AND (applies_to_facility_id IS NULL OR applies_to_facility_id = p_facility_id)
    ORDER BY threshold_value DESC
  LOOP
    -- Check if threshold is breached
    IF (v_rule.threshold_operator = '>=' AND v_occupancy_percent >= v_rule.threshold_value)
       OR (v_rule.threshold_operator = '>' AND v_occupancy_percent > v_rule.threshold_value)
    THEN
      -- Check cooldown (no alert in last N minutes)
      SELECT COUNT(*) INTO v_existing_alert_count
      FROM guardian_alerts
      WHERE reference_id = p_facility_id::text
        AND alert_type = v_rule.alert_type
        AND triggered_at > v_now - (v_rule.cooldown_minutes || ' minutes')::interval;

      IF v_existing_alert_count = 0 THEN
        -- Create alert
        INSERT INTO guardian_alerts (
          tenant_id, alert_type, severity, title, message,
          reference_type, reference_id, status, escalation_level,
          escalation_targets, triggered_at, metadata
        ) VALUES (
          v_facility.tenant_id,
          v_rule.alert_type,
          v_rule.severity,
          v_facility.facility_name || ' at ' || round(v_occupancy_percent, 1) || '% capacity',
          'Capacity threshold breached: ' || v_rule.rule_name,
          'facility',
          p_facility_id::text,
          'active',
          v_rule.escalation_level,
          v_rule.escalation_targets,
          v_now,
          jsonb_build_object(
            'rule_id', v_rule.id,
            'rule_name', v_rule.rule_name,
            'occupancy_percent', v_occupancy_percent,
            'threshold_value', v_rule.threshold_value,
            'available_beds', v_facility.available_beds
          )
        );

        v_alerts_created := v_alerts_created + 1;
      END IF;
    END IF;
  END LOOP;

  -- Auto-resolve alerts if occupancy dropped below lowest threshold
  IF v_occupancy_percent < 70 THEN
    UPDATE guardian_alerts
    SET status = 'resolved',
        resolved_at = v_now,
        resolution_notes = 'Auto-resolved: occupancy dropped to ' || round(v_occupancy_percent, 1) || '%'
    WHERE reference_id = p_facility_id::text
      AND reference_type = 'facility'
      AND alert_type LIKE 'capacity_%'
      AND status = 'active';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'facility_id', p_facility_id,
    'occupancy_percent', v_occupancy_percent,
    'alerts_created', v_alerts_created
  );
END;
$$;

-- ============================================================================
-- 4. Ensure guardian_alerts has required columns
-- ============================================================================
-- Add columns if they don't exist (safe for re-runs)
DO $$
BEGIN
  -- escalation_level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_alerts' AND column_name = 'escalation_level'
  ) THEN
    ALTER TABLE guardian_alerts ADD COLUMN escalation_level integer DEFAULT 0;
  END IF;

  -- escalation_targets
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_alerts' AND column_name = 'escalation_targets'
  ) THEN
    ALTER TABLE guardian_alerts ADD COLUMN escalation_targets text[] DEFAULT '{}';
  END IF;

  -- triggered_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_alerts' AND column_name = 'triggered_at'
  ) THEN
    ALTER TABLE guardian_alerts ADD COLUMN triggered_at timestamptz DEFAULT now();
  END IF;

  -- resolved_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_alerts' AND column_name = 'resolved_at'
  ) THEN
    ALTER TABLE guardian_alerts ADD COLUMN resolved_at timestamptz;
  END IF;

  -- resolution_notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_alerts' AND column_name = 'resolution_notes'
  ) THEN
    ALTER TABLE guardian_alerts ADD COLUMN resolution_notes text;
  END IF;

  -- metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_alerts' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE guardian_alerts ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- ============================================================================
-- 5. Row Level Security
-- ============================================================================
ALTER TABLE capacity_alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capacity_alert_rules_tenant_isolation" ON capacity_alert_rules
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "capacity_alert_rules_service_role" ON capacity_alert_rules
  FOR ALL TO service_role USING (true);

-- ============================================================================
-- 6. Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON capacity_alert_rules TO authenticated;
GRANT EXECUTE ON FUNCTION setup_default_capacity_rules TO authenticated;
GRANT EXECUTE ON FUNCTION check_capacity_alerts TO authenticated;

-- ============================================================================
-- 7. Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Capacity Escalation Automation Migration Complete';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Table created: capacity_alert_rules';
  RAISE NOTICE 'Functions: setup_default_capacity_rules, check_capacity_alerts';
  RAISE NOTICE 'Default thresholds: watch (70%%), warning (80%%), critical (90%%), divert (95%%)';
  RAISE NOTICE 'ED boarding alerts: warning (4h), critical (8h)';
  RAISE NOTICE 'RLS policies applied for tenant isolation';
  RAISE NOTICE '=================================================================';
END $$;
