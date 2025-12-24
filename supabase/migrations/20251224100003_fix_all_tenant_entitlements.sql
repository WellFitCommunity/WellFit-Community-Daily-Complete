-- ============================================================================
-- Fix Module Entitlements for ALL Tenants
-- Date: 2025-12-24
-- Purpose: Set entitlements for ALL tenants based on their license tier
-- ============================================================================

-- License Tier Entitlement Matrix:
-- basic:      Core modules only (community, dashboard, check_ins, medications, messaging, caregiver_portal, allergies_immunizations)
-- standard:   Basic + clinical/workflow modules
-- premium:    Standard + advanced features
-- enterprise: ALL modules

-- ============================================================================
-- 1. ENTERPRISE TIER - ALL MODULES ENTITLED
-- ============================================================================

UPDATE public.tenant_module_config
SET
  -- Core Platform
  community_entitled = TRUE, dashboard_entitled = TRUE, check_ins_entitled = TRUE,
  -- Clinical
  dental_entitled = TRUE, sdoh_entitled = TRUE, pharmacy_entitled = TRUE,
  medications_entitled = TRUE, memory_clinic_entitled = TRUE, mental_health_entitled = TRUE,
  stroke_assessment_entitled = TRUE, wearable_integration_entitled = TRUE,
  -- Communication
  telehealth_entitled = TRUE, messaging_entitled = TRUE,
  -- Integration
  ehr_integration_entitled = TRUE, fhir_entitled = TRUE,
  -- Advanced
  ai_scribe_entitled = TRUE, claude_care_entitled = TRUE, guardian_monitoring_entitled = TRUE,
  -- NurseOS
  nurseos_clarity_entitled = TRUE, nurseos_shield_entitled = TRUE, resilience_hub_entitled = TRUE,
  -- Population Health
  frequent_flyers_entitled = TRUE, discharge_tracking_entitled = TRUE,
  -- Workflow
  shift_handoff_entitled = TRUE, field_visits_entitled = TRUE, caregiver_portal_entitled = TRUE,
  time_clock_entitled = TRUE,
  -- Emergency
  ems_metrics_entitled = TRUE, coordinated_response_entitled = TRUE, law_enforcement_entitled = TRUE,
  -- Billing
  billing_integration_entitled = TRUE, rpm_ccm_entitled = TRUE,
  -- Security
  hipaa_audit_logging_entitled = TRUE, mfa_enforcement_entitled = TRUE,
  -- Additional
  physical_therapy_entitled = TRUE, passkey_authentication_entitled = TRUE,
  voice_command_entitled = TRUE, atlas_revenue_entitled = TRUE, vitals_capture_entitled = TRUE,
  smart_questionnaires_entitled = TRUE, medication_identifier_entitled = TRUE,
  clinical_documentation_entitled = TRUE, behavioral_analytics_entitled = TRUE,
  allergies_immunizations_entitled = TRUE,
  entitlements_updated_at = NOW()
WHERE license_tier = 'enterprise';

-- ============================================================================
-- 2. PREMIUM TIER - Standard + Advanced Features
-- ============================================================================

UPDATE public.tenant_module_config
SET
  -- Core Platform (basic tier)
  community_entitled = TRUE, dashboard_entitled = TRUE, check_ins_entitled = TRUE,
  -- Clinical (mixed tiers)
  dental_entitled = TRUE,           -- standard
  sdoh_entitled = TRUE,             -- standard
  pharmacy_entitled = TRUE,         -- premium
  medications_entitled = TRUE,      -- basic
  memory_clinic_entitled = TRUE,    -- premium
  mental_health_entitled = TRUE,    -- standard
  stroke_assessment_entitled = TRUE, -- premium
  wearable_integration_entitled = TRUE, -- standard
  -- Communication
  telehealth_entitled = TRUE,       -- premium
  messaging_entitled = TRUE,        -- basic
  -- Integration
  ehr_integration_entitled = FALSE, -- enterprise only
  fhir_entitled = TRUE,             -- premium
  -- Advanced
  ai_scribe_entitled = TRUE,        -- premium
  claude_care_entitled = TRUE,      -- premium
  guardian_monitoring_entitled = FALSE, -- enterprise only
  -- NurseOS
  nurseos_clarity_entitled = TRUE,  -- premium
  nurseos_shield_entitled = TRUE,   -- premium
  resilience_hub_entitled = TRUE,   -- standard
  -- Population Health
  frequent_flyers_entitled = TRUE,  -- standard
  discharge_tracking_entitled = TRUE, -- standard
  -- Workflow
  shift_handoff_entitled = TRUE,    -- standard
  field_visits_entitled = TRUE,     -- standard
  caregiver_portal_entitled = TRUE, -- basic
  time_clock_entitled = TRUE,       -- standard
  -- Emergency
  ems_metrics_entitled = TRUE,      -- premium
  coordinated_response_entitled = FALSE, -- enterprise only
  law_enforcement_entitled = TRUE,  -- premium
  -- Billing
  billing_integration_entitled = TRUE, -- premium
  rpm_ccm_entitled = TRUE,          -- premium
  -- Security
  hipaa_audit_logging_entitled = TRUE, -- standard
  mfa_enforcement_entitled = TRUE,  -- standard
  -- Additional
  physical_therapy_entitled = TRUE, -- premium
  passkey_authentication_entitled = TRUE, -- standard
  voice_command_entitled = TRUE,    -- premium
  atlas_revenue_entitled = FALSE,   -- enterprise only
  vitals_capture_entitled = TRUE,   -- standard
  smart_questionnaires_entitled = TRUE, -- premium
  medication_identifier_entitled = TRUE, -- premium
  clinical_documentation_entitled = TRUE, -- standard
  behavioral_analytics_entitled = TRUE, -- premium
  allergies_immunizations_entitled = TRUE, -- basic
  entitlements_updated_at = NOW()
WHERE license_tier = 'premium';

-- ============================================================================
-- 3. STANDARD TIER - Basic + Clinical/Workflow
-- ============================================================================

UPDATE public.tenant_module_config
SET
  -- Core Platform (basic tier)
  community_entitled = TRUE, dashboard_entitled = TRUE, check_ins_entitled = TRUE,
  -- Clinical
  dental_entitled = TRUE,           -- standard
  sdoh_entitled = TRUE,             -- standard
  pharmacy_entitled = FALSE,        -- premium
  medications_entitled = TRUE,      -- basic
  memory_clinic_entitled = FALSE,   -- premium
  mental_health_entitled = TRUE,    -- standard
  stroke_assessment_entitled = FALSE, -- premium
  wearable_integration_entitled = TRUE, -- standard
  -- Communication
  telehealth_entitled = FALSE,      -- premium
  messaging_entitled = TRUE,        -- basic
  -- Integration
  ehr_integration_entitled = FALSE, -- enterprise
  fhir_entitled = FALSE,            -- premium
  -- Advanced
  ai_scribe_entitled = FALSE,       -- premium
  claude_care_entitled = FALSE,     -- premium
  guardian_monitoring_entitled = FALSE, -- enterprise
  -- NurseOS
  nurseos_clarity_entitled = FALSE, -- premium
  nurseos_shield_entitled = FALSE,  -- premium
  resilience_hub_entitled = TRUE,   -- standard
  -- Population Health
  frequent_flyers_entitled = TRUE,  -- standard
  discharge_tracking_entitled = TRUE, -- standard
  -- Workflow
  shift_handoff_entitled = TRUE,    -- standard
  field_visits_entitled = TRUE,     -- standard
  caregiver_portal_entitled = TRUE, -- basic
  time_clock_entitled = TRUE,       -- standard
  -- Emergency
  ems_metrics_entitled = FALSE,     -- premium
  coordinated_response_entitled = FALSE, -- enterprise
  law_enforcement_entitled = FALSE, -- premium
  -- Billing
  billing_integration_entitled = FALSE, -- premium
  rpm_ccm_entitled = FALSE,         -- premium
  -- Security
  hipaa_audit_logging_entitled = TRUE, -- standard
  mfa_enforcement_entitled = TRUE,  -- standard
  -- Additional
  physical_therapy_entitled = FALSE, -- premium
  passkey_authentication_entitled = TRUE, -- standard
  voice_command_entitled = FALSE,   -- premium
  atlas_revenue_entitled = FALSE,   -- enterprise
  vitals_capture_entitled = TRUE,   -- standard
  smart_questionnaires_entitled = FALSE, -- premium
  medication_identifier_entitled = FALSE, -- premium
  clinical_documentation_entitled = TRUE, -- standard
  behavioral_analytics_entitled = FALSE, -- premium
  allergies_immunizations_entitled = TRUE, -- basic
  entitlements_updated_at = NOW()
WHERE license_tier = 'standard';

-- ============================================================================
-- 4. BASIC TIER - Core Modules Only
-- ============================================================================

UPDATE public.tenant_module_config
SET
  -- Core Platform
  community_entitled = TRUE, dashboard_entitled = TRUE, check_ins_entitled = TRUE,
  -- Clinical
  dental_entitled = FALSE,
  sdoh_entitled = FALSE,
  pharmacy_entitled = FALSE,
  medications_entitled = TRUE,      -- basic
  memory_clinic_entitled = FALSE,
  mental_health_entitled = FALSE,
  stroke_assessment_entitled = FALSE,
  wearable_integration_entitled = FALSE,
  -- Communication
  telehealth_entitled = FALSE,
  messaging_entitled = TRUE,        -- basic
  -- Integration
  ehr_integration_entitled = FALSE,
  fhir_entitled = FALSE,
  -- Advanced
  ai_scribe_entitled = FALSE,
  claude_care_entitled = FALSE,
  guardian_monitoring_entitled = FALSE,
  -- NurseOS
  nurseos_clarity_entitled = FALSE,
  nurseos_shield_entitled = FALSE,
  resilience_hub_entitled = FALSE,
  -- Population Health
  frequent_flyers_entitled = FALSE,
  discharge_tracking_entitled = FALSE,
  -- Workflow
  shift_handoff_entitled = FALSE,
  field_visits_entitled = FALSE,
  caregiver_portal_entitled = TRUE, -- basic
  time_clock_entitled = FALSE,
  -- Emergency
  ems_metrics_entitled = FALSE,
  coordinated_response_entitled = FALSE,
  law_enforcement_entitled = FALSE,
  -- Billing
  billing_integration_entitled = FALSE,
  rpm_ccm_entitled = FALSE,
  -- Security
  hipaa_audit_logging_entitled = FALSE,
  mfa_enforcement_entitled = FALSE,
  -- Additional
  physical_therapy_entitled = FALSE,
  passkey_authentication_entitled = FALSE,
  voice_command_entitled = FALSE,
  atlas_revenue_entitled = FALSE,
  vitals_capture_entitled = FALSE,
  smart_questionnaires_entitled = FALSE,
  medication_identifier_entitled = FALSE,
  clinical_documentation_entitled = FALSE,
  behavioral_analytics_entitled = FALSE,
  allergies_immunizations_entitled = TRUE, -- basic
  entitlements_updated_at = NOW()
WHERE license_tier = 'basic';

-- ============================================================================
-- 5. HANDLE NULL LICENSE TIER (default to basic)
-- ============================================================================

UPDATE public.tenant_module_config
SET
  license_tier = 'basic',
  community_entitled = TRUE, dashboard_entitled = TRUE, check_ins_entitled = TRUE,
  medications_entitled = TRUE, messaging_entitled = TRUE, caregiver_portal_entitled = TRUE,
  allergies_immunizations_entitled = TRUE,
  entitlements_updated_at = NOW()
WHERE license_tier IS NULL;

-- ============================================================================
-- 6. VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_enterprise_count INT;
  v_premium_count INT;
  v_standard_count INT;
  v_basic_count INT;
BEGIN
  SELECT COUNT(*) INTO v_enterprise_count FROM tenant_module_config WHERE license_tier = 'enterprise';
  SELECT COUNT(*) INTO v_premium_count FROM tenant_module_config WHERE license_tier = 'premium';
  SELECT COUNT(*) INTO v_standard_count FROM tenant_module_config WHERE license_tier = 'standard';
  SELECT COUNT(*) INTO v_basic_count FROM tenant_module_config WHERE license_tier = 'basic';

  RAISE NOTICE 'Entitlements updated for all tenants:';
  RAISE NOTICE '  Enterprise: % tenants (all modules)', v_enterprise_count;
  RAISE NOTICE '  Premium: % tenants (standard + advanced)', v_premium_count;
  RAISE NOTICE '  Standard: % tenants (basic + clinical/workflow)', v_standard_count;
  RAISE NOTICE '  Basic: % tenants (core modules only)', v_basic_count;
END $$;
