-- Migration: Add 10 additional module columns to tenant_module_config
-- These modules were identified as existing features that need proper tenant gating

-- ============================================================================
-- ADD PHYSICAL THERAPY MODULE COLUMNS
-- ============================================================================

ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS physical_therapy_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS physical_therapy_entitled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tenant_module_config.physical_therapy_enabled IS 'PT treatment plans, assessments, sessions, exercise library';

-- ============================================================================
-- ADD ADVANCED AUTHENTICATION MODULE COLUMNS
-- ============================================================================

ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS passkey_authentication_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS passkey_authentication_entitled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tenant_module_config.passkey_authentication_enabled IS 'WebAuthn passwordless authentication for enhanced security';

-- ============================================================================
-- ADD VOICE FEATURES MODULE COLUMNS
-- ============================================================================

ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS voice_command_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS voice_command_entitled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tenant_module_config.voice_command_enabled IS 'Voice-activated controls, voice profiles, speech recognition';

-- ============================================================================
-- ADD ATLAS REVENUE MODULE COLUMNS
-- ============================================================================

ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS atlas_revenue_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS atlas_revenue_entitled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tenant_module_config.atlas_revenue_enabled IS 'Claims submission, appeals, coding suggestions, revenue optimization';

-- ============================================================================
-- ADD VITALS CAPTURE MODULE COLUMNS
-- ============================================================================

ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS vitals_capture_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vitals_capture_entitled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tenant_module_config.vitals_capture_enabled IS 'Mobile vitals recording, CHW field data collection';

-- ============================================================================
-- ADD SMART QUESTIONNAIRES MODULE COLUMNS
-- ============================================================================

ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS smart_questionnaires_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS smart_questionnaires_entitled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tenant_module_config.smart_questionnaires_enabled IS 'SMART on FHIR questionnaire integration, clinical forms';

-- ============================================================================
-- ADD MEDICATION IDENTIFIER MODULE COLUMNS
-- ============================================================================

ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS medication_identifier_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS medication_identifier_entitled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tenant_module_config.medication_identifier_enabled IS 'Pill identification, medication photo capture, label reading';

-- ============================================================================
-- ADD CLINICAL DOCUMENTATION MODULE COLUMNS
-- ============================================================================

ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS clinical_documentation_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS clinical_documentation_entitled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tenant_module_config.clinical_documentation_enabled IS 'SOAP notes, clinical note templates, encounter documentation';

-- ============================================================================
-- ADD BEHAVIORAL ANALYTICS MODULE COLUMNS
-- ============================================================================

ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS behavioral_analytics_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS behavioral_analytics_entitled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tenant_module_config.behavioral_analytics_enabled IS 'User behavior tracking, psychometric analysis, engagement metrics';

-- ============================================================================
-- ADD ALLERGIES & IMMUNIZATIONS MODULE COLUMNS
-- ============================================================================

ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS allergies_immunizations_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS allergies_immunizations_entitled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tenant_module_config.allergies_immunizations_enabled IS 'Allergy management, immunization records, health history';

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
  -- Additional Modules (10 new)
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
-- AUDIT LOG ENTRY
-- ============================================================================

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
      'migration', '20251126110000_add_additional_module_columns',
      'description', 'Added 10 additional module columns identified from feature audit',
      'modules_added', ARRAY[
        'physical_therapy', 'passkey_authentication', 'voice_command',
        'atlas_revenue', 'vitals_capture', 'smart_questionnaires',
        'medication_identifier', 'clinical_documentation',
        'behavioral_analytics', 'allergies_immunizations'
      ]
    ),
    NOW()
  );
EXCEPTION WHEN OTHERS THEN
  -- Audit log table may not exist, continue
  NULL;
END;
$$;
