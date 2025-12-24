-- ============================================================================
-- Fix WellFit Module Configuration
-- Date: 2025-12-24
-- Purpose:
--   1. Add missing time_clock columns
--   2. Set ALL entitlements to TRUE for WellFit tenant (enterprise tier)
--   3. Enable all modules for WellFit
--   4. Update get_enabled_modules() function to include time_clock
-- ============================================================================

-- WellFit Community tenant ID: 2b902657-6a20-4435-a78a-576f397517ca

-- ============================================================================
-- 1. ADD MISSING TIME CLOCK COLUMNS
-- ============================================================================

ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS time_clock_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS time_clock_entitled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.tenant_module_config.time_clock_enabled IS 'Employee time tracking, clock in/out, payroll hours, streak gamification';
COMMENT ON COLUMN public.tenant_module_config.time_clock_entitled IS 'Entitlement for time clock module';

-- ============================================================================
-- 2. SET ALL ENTITLEMENTS FOR WELLFIT TENANT (ENTERPRISE TIER)
-- ============================================================================

UPDATE public.tenant_module_config
SET
  -- Core Platform Entitlements
  community_entitled = TRUE,
  dashboard_entitled = TRUE,
  check_ins_entitled = TRUE,

  -- Clinical Module Entitlements
  dental_entitled = TRUE,
  sdoh_entitled = TRUE,
  pharmacy_entitled = TRUE,
  medications_entitled = TRUE,
  memory_clinic_entitled = TRUE,
  mental_health_entitled = TRUE,
  stroke_assessment_entitled = TRUE,
  wearable_integration_entitled = TRUE,

  -- Communication Module Entitlements
  telehealth_entitled = TRUE,
  messaging_entitled = TRUE,

  -- Integration Module Entitlements
  ehr_integration_entitled = TRUE,
  fhir_entitled = TRUE,

  -- Advanced Feature Entitlements
  ai_scribe_entitled = TRUE,
  claude_care_entitled = TRUE,
  guardian_monitoring_entitled = TRUE,

  -- NurseOS Module Entitlements
  nurseos_clarity_entitled = TRUE,
  nurseos_shield_entitled = TRUE,
  resilience_hub_entitled = TRUE,

  -- Population Health Entitlements
  frequent_flyers_entitled = TRUE,
  discharge_tracking_entitled = TRUE,

  -- Workflow Entitlements
  shift_handoff_entitled = TRUE,
  field_visits_entitled = TRUE,
  caregiver_portal_entitled = TRUE,
  time_clock_entitled = TRUE,

  -- Emergency Entitlements
  ems_metrics_entitled = TRUE,
  coordinated_response_entitled = TRUE,
  law_enforcement_entitled = TRUE,

  -- Billing & Revenue Entitlements
  billing_integration_entitled = TRUE,
  rpm_ccm_entitled = TRUE,

  -- Security & Compliance Entitlements
  hipaa_audit_logging_entitled = TRUE,
  mfa_enforcement_entitled = TRUE,

  -- Additional Module Entitlements
  physical_therapy_entitled = TRUE,
  passkey_authentication_entitled = TRUE,
  voice_command_entitled = TRUE,
  atlas_revenue_entitled = TRUE,
  vitals_capture_entitled = TRUE,
  smart_questionnaires_entitled = TRUE,
  medication_identifier_entitled = TRUE,
  clinical_documentation_entitled = TRUE,
  behavioral_analytics_entitled = TRUE,
  allergies_immunizations_entitled = TRUE,

  -- Tracking
  entitlements_updated_at = NOW(),
  updated_at = NOW()
WHERE tenant_id = '2b902657-6a20-4435-a78a-576f397517ca';

-- ============================================================================
-- 3. ENABLE ALL MODULES FOR WELLFIT TENANT
-- ============================================================================

UPDATE public.tenant_module_config
SET
  -- Core Platform Modules
  community_enabled = TRUE,
  dashboard_enabled = TRUE,
  check_ins_enabled = TRUE,

  -- Clinical Modules
  dental_enabled = TRUE,
  sdoh_enabled = TRUE,
  pharmacy_enabled = TRUE,
  medications_enabled = TRUE,
  memory_clinic_enabled = TRUE,
  mental_health_enabled = TRUE,
  stroke_assessment_enabled = TRUE,
  wearable_integration_enabled = TRUE,

  -- Communication Modules
  telehealth_enabled = TRUE,
  messaging_enabled = TRUE,

  -- Integration Modules
  ehr_integration_enabled = TRUE,
  fhir_enabled = TRUE,

  -- Advanced Features
  ai_scribe_enabled = TRUE,
  claude_care_enabled = TRUE,
  guardian_monitoring_enabled = TRUE,

  -- NurseOS Modules
  nurseos_clarity_enabled = TRUE,
  nurseos_shield_enabled = TRUE,
  resilience_hub_enabled = TRUE,

  -- Population Health Modules
  frequent_flyers_enabled = TRUE,
  discharge_tracking_enabled = TRUE,

  -- Workflow Modules
  shift_handoff_enabled = TRUE,
  field_visits_enabled = TRUE,
  caregiver_portal_enabled = TRUE,
  time_clock_enabled = TRUE,

  -- Emergency Modules
  ems_metrics_enabled = TRUE,
  coordinated_response_enabled = TRUE,
  law_enforcement_enabled = TRUE,

  -- Billing & Revenue Modules
  billing_integration_enabled = TRUE,
  rpm_ccm_enabled = TRUE,

  -- Security & Compliance
  hipaa_audit_logging = TRUE,
  mfa_enforcement = TRUE,

  -- Additional Modules
  physical_therapy_enabled = TRUE,
  passkey_authentication_enabled = TRUE,
  voice_command_enabled = TRUE,
  atlas_revenue_enabled = TRUE,
  vitals_capture_enabled = TRUE,
  smart_questionnaires_enabled = TRUE,
  medication_identifier_enabled = TRUE,
  clinical_documentation_enabled = TRUE,
  behavioral_analytics_enabled = TRUE,
  allergies_immunizations_enabled = TRUE,

  -- Metadata
  license_tier = 'enterprise',
  updated_at = NOW()
WHERE tenant_id = '2b902657-6a20-4435-a78a-576f397517ca';

-- ============================================================================
-- 4. UPDATE get_enabled_modules() FUNCTION TO INCLUDE time_clock
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
  -- Core Modules
  SELECT 'community_enabled'::TEXT, COALESCE(tmc.community_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'dashboard_enabled', COALESCE(tmc.dashboard_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'check_ins_enabled', COALESCE(tmc.check_ins_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  -- Clinical Modules
  UNION ALL SELECT 'dental_enabled', COALESCE(tmc.dental_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'sdoh_enabled', COALESCE(tmc.sdoh_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'pharmacy_enabled', COALESCE(tmc.pharmacy_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'medications_enabled', COALESCE(tmc.medications_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'memory_clinic_enabled', COALESCE(tmc.memory_clinic_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'mental_health_enabled', COALESCE(tmc.mental_health_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'stroke_assessment_enabled', COALESCE(tmc.stroke_assessment_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'wearable_integration_enabled', COALESCE(tmc.wearable_integration_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  -- Communication Modules
  UNION ALL SELECT 'telehealth_enabled', COALESCE(tmc.telehealth_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'messaging_enabled', COALESCE(tmc.messaging_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  -- Integration Modules
  UNION ALL SELECT 'ehr_integration_enabled', COALESCE(tmc.ehr_integration_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'fhir_enabled', COALESCE(tmc.fhir_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  -- Advanced Modules
  UNION ALL SELECT 'ai_scribe_enabled', COALESCE(tmc.ai_scribe_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'claude_care_enabled', COALESCE(tmc.claude_care_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'guardian_monitoring_enabled', COALESCE(tmc.guardian_monitoring_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  -- NurseOS Modules
  UNION ALL SELECT 'nurseos_clarity_enabled', COALESCE(tmc.nurseos_clarity_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'nurseos_shield_enabled', COALESCE(tmc.nurseos_shield_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'resilience_hub_enabled', COALESCE(tmc.resilience_hub_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  -- Population Health Modules
  UNION ALL SELECT 'frequent_flyers_enabled', COALESCE(tmc.frequent_flyers_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'discharge_tracking_enabled', COALESCE(tmc.discharge_tracking_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  -- Workflow Modules
  UNION ALL SELECT 'shift_handoff_enabled', COALESCE(tmc.shift_handoff_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'field_visits_enabled', COALESCE(tmc.field_visits_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'caregiver_portal_enabled', COALESCE(tmc.caregiver_portal_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'time_clock_enabled', COALESCE(tmc.time_clock_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  -- Emergency Modules
  UNION ALL SELECT 'ems_metrics_enabled', COALESCE(tmc.ems_metrics_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'coordinated_response_enabled', COALESCE(tmc.coordinated_response_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'law_enforcement_enabled', COALESCE(tmc.law_enforcement_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  -- Billing Modules
  UNION ALL SELECT 'billing_integration_enabled', COALESCE(tmc.billing_integration_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'rpm_ccm_enabled', COALESCE(tmc.rpm_ccm_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  -- Security Modules
  UNION ALL SELECT 'hipaa_audit_logging', COALESCE(tmc.hipaa_audit_logging, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'mfa_enforcement', COALESCE(tmc.mfa_enforcement, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  -- Additional Modules (including all 10 new + time_clock)
  UNION ALL SELECT 'physical_therapy_enabled', COALESCE(tmc.physical_therapy_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'passkey_authentication_enabled', COALESCE(tmc.passkey_authentication_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'voice_command_enabled', COALESCE(tmc.voice_command_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'atlas_revenue_enabled', COALESCE(tmc.atlas_revenue_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'vitals_capture_enabled', COALESCE(tmc.vitals_capture_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'smart_questionnaires_enabled', COALESCE(tmc.smart_questionnaires_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'medication_identifier_enabled', COALESCE(tmc.medication_identifier_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'clinical_documentation_enabled', COALESCE(tmc.clinical_documentation_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'behavioral_analytics_enabled', COALESCE(tmc.behavioral_analytics_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id
  UNION ALL SELECT 'allergies_immunizations_enabled', COALESCE(tmc.allergies_immunizations_enabled, FALSE) FROM tenant_module_config tmc WHERE tmc.tenant_id = v_tenant_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_enabled_modules(UUID) TO authenticated;

-- ============================================================================
-- 5. VERIFY CONFIGURATION
-- ============================================================================

DO $$
DECLARE
  v_config_count INT;
  v_entitled_count INT;
  v_enabled_count INT;
BEGIN
  -- Check if WellFit config exists
  SELECT COUNT(*) INTO v_config_count
  FROM tenant_module_config
  WHERE tenant_id = '2b902657-6a20-4435-a78a-576f397517ca';

  IF v_config_count = 0 THEN
    RAISE NOTICE 'WARNING: No tenant_module_config exists for WellFit! Creating one...';

    INSERT INTO tenant_module_config (
      tenant_id,
      license_tier,
      -- Core modules enabled and entitled
      community_enabled, community_entitled,
      dashboard_enabled, dashboard_entitled,
      check_ins_enabled, check_ins_entitled,
      -- All other columns will use defaults
      hipaa_audit_logging, hipaa_audit_logging_entitled
    )
    VALUES (
      '2b902657-6a20-4435-a78a-576f397517ca',
      'enterprise',
      TRUE, TRUE,
      TRUE, TRUE,
      TRUE, TRUE,
      TRUE, TRUE
    );

    RAISE NOTICE 'Created base tenant_module_config for WellFit - running full update...';

    -- Now run the full update
    UPDATE public.tenant_module_config
    SET
      -- All entitlements TRUE
      community_entitled = TRUE, dashboard_entitled = TRUE, check_ins_entitled = TRUE,
      dental_entitled = TRUE, sdoh_entitled = TRUE, pharmacy_entitled = TRUE,
      medications_entitled = TRUE, memory_clinic_entitled = TRUE, mental_health_entitled = TRUE,
      stroke_assessment_entitled = TRUE, wearable_integration_entitled = TRUE,
      telehealth_entitled = TRUE, messaging_entitled = TRUE,
      ehr_integration_entitled = TRUE, fhir_entitled = TRUE,
      ai_scribe_entitled = TRUE, claude_care_entitled = TRUE, guardian_monitoring_entitled = TRUE,
      nurseos_clarity_entitled = TRUE, nurseos_shield_entitled = TRUE, resilience_hub_entitled = TRUE,
      frequent_flyers_entitled = TRUE, discharge_tracking_entitled = TRUE,
      shift_handoff_entitled = TRUE, field_visits_entitled = TRUE, caregiver_portal_entitled = TRUE,
      time_clock_entitled = TRUE,
      ems_metrics_entitled = TRUE, coordinated_response_entitled = TRUE, law_enforcement_entitled = TRUE,
      billing_integration_entitled = TRUE, rpm_ccm_entitled = TRUE,
      hipaa_audit_logging_entitled = TRUE, mfa_enforcement_entitled = TRUE,
      physical_therapy_entitled = TRUE, passkey_authentication_entitled = TRUE,
      voice_command_entitled = TRUE, atlas_revenue_entitled = TRUE, vitals_capture_entitled = TRUE,
      smart_questionnaires_entitled = TRUE, medication_identifier_entitled = TRUE,
      clinical_documentation_entitled = TRUE, behavioral_analytics_entitled = TRUE,
      allergies_immunizations_entitled = TRUE,
      -- All modules enabled
      community_enabled = TRUE, dashboard_enabled = TRUE, check_ins_enabled = TRUE,
      dental_enabled = TRUE, sdoh_enabled = TRUE, pharmacy_enabled = TRUE,
      medications_enabled = TRUE, memory_clinic_enabled = TRUE, mental_health_enabled = TRUE,
      stroke_assessment_enabled = TRUE, wearable_integration_enabled = TRUE,
      telehealth_enabled = TRUE, messaging_enabled = TRUE,
      ehr_integration_enabled = TRUE, fhir_enabled = TRUE,
      ai_scribe_enabled = TRUE, claude_care_enabled = TRUE, guardian_monitoring_enabled = TRUE,
      nurseos_clarity_enabled = TRUE, nurseos_shield_enabled = TRUE, resilience_hub_enabled = TRUE,
      frequent_flyers_enabled = TRUE, discharge_tracking_enabled = TRUE,
      shift_handoff_enabled = TRUE, field_visits_enabled = TRUE, caregiver_portal_enabled = TRUE,
      time_clock_enabled = TRUE,
      ems_metrics_enabled = TRUE, coordinated_response_enabled = TRUE, law_enforcement_enabled = TRUE,
      billing_integration_enabled = TRUE, rpm_ccm_enabled = TRUE,
      hipaa_audit_logging = TRUE, mfa_enforcement = TRUE,
      physical_therapy_enabled = TRUE, passkey_authentication_enabled = TRUE,
      voice_command_enabled = TRUE, atlas_revenue_enabled = TRUE, vitals_capture_enabled = TRUE,
      smart_questionnaires_enabled = TRUE, medication_identifier_enabled = TRUE,
      clinical_documentation_enabled = TRUE, behavioral_analytics_enabled = TRUE,
      allergies_immunizations_enabled = TRUE,
      updated_at = NOW()
    WHERE tenant_id = '2b902657-6a20-4435-a78a-576f397517ca';
  END IF;

  -- Verify configuration
  SELECT
    COUNT(*) FILTER (WHERE community_entitled = TRUE) INTO v_entitled_count
  FROM tenant_module_config
  WHERE tenant_id = '2b902657-6a20-4435-a78a-576f397517ca';

  SELECT
    COUNT(*) FILTER (WHERE community_enabled = TRUE) INTO v_enabled_count
  FROM tenant_module_config
  WHERE tenant_id = '2b902657-6a20-4435-a78a-576f397517ca';

  RAISE NOTICE 'WellFit module configuration updated. Config exists: %, Entitled: %, Enabled: %',
    v_config_count, v_entitled_count, v_enabled_count;
END $$;
