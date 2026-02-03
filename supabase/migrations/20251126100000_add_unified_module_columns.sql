-- Migration: Add unified module columns to tenant_module_config
-- This adds the modules that were previously only in system_feature_flags
-- Unifying them into the tenant module system for consistent access control

-- ============================================================================
-- ADD NEW CLINICAL MODULE COLUMNS
-- ============================================================================

ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS memory_clinic_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS memory_clinic_entitled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mental_health_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mental_health_entitled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stroke_assessment_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stroke_assessment_entitled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS wearable_integration_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS wearable_integration_entitled BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- ADD POPULATION HEALTH MODULE COLUMNS
-- ============================================================================

ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS frequent_flyers_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS frequent_flyers_entitled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS discharge_tracking_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS discharge_tracking_entitled BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- ADD WORKFLOW MODULE COLUMNS
-- ============================================================================

ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS shift_handoff_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS shift_handoff_entitled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS field_visits_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS field_visits_entitled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS caregiver_portal_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS caregiver_portal_entitled BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- ADD EMERGENCY MODULE COLUMNS
-- ============================================================================

ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS ems_metrics_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ems_metrics_entitled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS coordinated_response_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS coordinated_response_entitled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS law_enforcement_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS law_enforcement_entitled BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN tenant_module_config.memory_clinic_enabled IS 'Cognitive assessments, dementia screening, memory care features';
COMMENT ON COLUMN tenant_module_config.mental_health_enabled IS 'Behavioral health assessments, PHQ-9, GAD-7 screening';
COMMENT ON COLUMN tenant_module_config.stroke_assessment_enabled IS 'FAST screening, stroke risk evaluation, rehab tracking';
COMMENT ON COLUMN tenant_module_config.wearable_integration_enabled IS 'Fitbit, Apple Watch, Garmin data synchronization';

COMMENT ON COLUMN tenant_module_config.frequent_flyers_enabled IS 'High utilizer tracking, care management, intervention alerts';
COMMENT ON COLUMN tenant_module_config.discharge_tracking_enabled IS 'Hospital discharge follow-up, readmission prevention';

COMMENT ON COLUMN tenant_module_config.shift_handoff_enabled IS 'Nurse shift change documentation, critical info transfer';
COMMENT ON COLUMN tenant_module_config.field_visits_enabled IS 'CHW home visit scheduling, documentation, GPS tracking';
COMMENT ON COLUMN tenant_module_config.caregiver_portal_enabled IS 'Family caregiver access, care coordination, updates';

COMMENT ON COLUMN tenant_module_config.ems_metrics_enabled IS 'Emergency medical services integration, response tracking';
COMMENT ON COLUMN tenant_module_config.coordinated_response_enabled IS 'Multi-agency emergency coordination, incident management';
COMMENT ON COLUMN tenant_module_config.law_enforcement_enabled IS 'SHIELD Program - welfare check coordination for seniors and vulnerable populations';

-- ============================================================================
-- UPDATE RPC FUNCTION TO INCLUDE NEW MODULES
-- ============================================================================

CREATE OR REPLACE FUNCTION get_enabled_modules(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  module_name TEXT,
  is_enabled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Get tenant ID from parameter or current user
  IF p_tenant_id IS NOT NULL THEN
    v_tenant_id := p_tenant_id;
  ELSE
    SELECT tenant_id INTO v_tenant_id
    FROM profiles
    WHERE id = auth.uid();
  END IF;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'community_enabled'::TEXT, COALESCE(tmc.community_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'dashboard_enabled', COALESCE(tmc.dashboard_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'check_ins_enabled', COALESCE(tmc.check_ins_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'dental_enabled', COALESCE(tmc.dental_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'sdoh_enabled', COALESCE(tmc.sdoh_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'pharmacy_enabled', COALESCE(tmc.pharmacy_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'medications_enabled', COALESCE(tmc.medications_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'memory_clinic_enabled', COALESCE(tmc.memory_clinic_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'mental_health_enabled', COALESCE(tmc.mental_health_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'stroke_assessment_enabled', COALESCE(tmc.stroke_assessment_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'wearable_integration_enabled', COALESCE(tmc.wearable_integration_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'telehealth_enabled', COALESCE(tmc.telehealth_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'messaging_enabled', COALESCE(tmc.messaging_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'ehr_integration_enabled', COALESCE(tmc.ehr_integration_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'fhir_enabled', COALESCE(tmc.fhir_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'ai_scribe_enabled', COALESCE(tmc.ai_scribe_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'claude_care_enabled', COALESCE(tmc.claude_care_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'guardian_monitoring_enabled', COALESCE(tmc.guardian_monitoring_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'nurseos_clarity_enabled', COALESCE(tmc.nurseos_clarity_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'nurseos_shield_enabled', COALESCE(tmc.nurseos_shield_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'resilience_hub_enabled', COALESCE(tmc.resilience_hub_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'frequent_flyers_enabled', COALESCE(tmc.frequent_flyers_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'discharge_tracking_enabled', COALESCE(tmc.discharge_tracking_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'shift_handoff_enabled', COALESCE(tmc.shift_handoff_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'field_visits_enabled', COALESCE(tmc.field_visits_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'caregiver_portal_enabled', COALESCE(tmc.caregiver_portal_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'ems_metrics_enabled', COALESCE(tmc.ems_metrics_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'coordinated_response_enabled', COALESCE(tmc.coordinated_response_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'law_enforcement_enabled', COALESCE(tmc.law_enforcement_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'billing_integration_enabled', COALESCE(tmc.billing_integration_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'rpm_ccm_enabled', COALESCE(tmc.rpm_ccm_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'hipaa_audit_logging', COALESCE(tmc.hipaa_audit_logging, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'mfa_enforcement', COALESCE(tmc.mfa_enforcement, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_enabled_modules(UUID) TO authenticated;

-- Add audit log entry for this migration
DO $$
BEGIN
  INSERT INTO audit_logs (
    action,
    table_name,
    details,
    created_at
  ) VALUES (
    'MIGRATION',
    'tenant_module_config',
    jsonb_build_object(
      'migration', '20251126100000_add_unified_module_columns',
      'description', 'Added unified module columns for clinical, population health, workflow, and emergency modules',
      'modules_added', ARRAY[
        'memory_clinic', 'mental_health', 'stroke_assessment', 'wearable_integration',
        'frequent_flyers', 'discharge_tracking',
        'shift_handoff', 'field_visits', 'caregiver_portal',
        'ems_metrics', 'coordinated_response', 'law_enforcement'
      ]
    ),
    NOW()
  );
EXCEPTION WHEN OTHERS THEN
  -- Audit log table may not exist, continue
  NULL;
END;
$$;
