-- ============================================================================
-- WellFit Tenant Full Configuration
-- Date: 2025-12-02
-- Purpose: Enable all features and set branding for WellFit Community (WF-0001)
-- ============================================================================

-- WellFit Community tenant ID: 2b902657-6a20-4435-a78a-576f397517ca

-- ============================================================================
-- 1. UPDATE TENANT BRANDING
-- ============================================================================

UPDATE tenants SET
  app_name = 'WellFit Community',
  logo_url = '/wellfit-logo.png',
  primary_color = '#8cc63f',
  secondary_color = '#5a9a1f',
  accent_color = '#3d7a0a',
  text_color = '#333333',
  gradient = 'linear-gradient(135deg, #8cc63f 0%, #5a9a1f 100%)',
  contact_info = jsonb_build_object(
    'phone', '(713) 555-0100',
    'email', 'support@wellfitcommunity.com',
    'address', 'Houston, TX'
  ),
  custom_footer = 'WellFit Community - Empowering Healthy Living'
WHERE id = '2b902657-6a20-4435-a78a-576f397517ca'
   OR tenant_code = 'WF-0001';

-- ============================================================================
-- 2. ENABLE ALL MODULES FOR WELLFIT TENANT
-- ============================================================================

-- First, ensure tenant_module_config exists for WellFit with all modules enabled
INSERT INTO tenant_module_config (
  tenant_id,
  -- Core Platform Modules
  community_enabled,
  dashboard_enabled,
  check_ins_enabled,
  -- Clinical Modules
  dental_enabled,
  sdoh_enabled,
  pharmacy_enabled,
  medications_enabled,
  -- Communication Modules
  telehealth_enabled,
  messaging_enabled,
  -- Integration Modules
  ehr_integration_enabled,
  fhir_enabled,
  -- Advanced Features
  ai_scribe_enabled,
  claude_care_enabled,
  guardian_monitoring_enabled,
  -- NurseOS Modules
  nurseos_clarity_enabled,
  nurseos_shield_enabled,
  resilience_hub_enabled,
  -- Billing & Revenue Modules
  billing_integration_enabled,
  rpm_ccm_enabled,
  -- Security & Compliance
  hipaa_audit_logging,
  mfa_enforcement,
  -- License tier
  license_tier
)
SELECT
  '2b902657-6a20-4435-a78a-576f397517ca',
  -- Core Platform Modules (all true)
  true, true, true,
  -- Clinical Modules (all true)
  true, true, true, true,
  -- Communication Modules (all true)
  true, true,
  -- Integration Modules (all true)
  true, true,
  -- Advanced Features (all true)
  true, true, true,
  -- NurseOS Modules (all true)
  true, true, true,
  -- Billing & Revenue Modules (all true)
  true, true,
  -- Security & Compliance
  true, true,
  -- License tier
  'enterprise'
WHERE EXISTS (
  SELECT 1 FROM tenants WHERE id = '2b902657-6a20-4435-a78a-576f397517ca'
)
ON CONFLICT (tenant_id) DO UPDATE SET
  -- Core Platform Modules
  community_enabled = true,
  dashboard_enabled = true,
  check_ins_enabled = true,
  -- Clinical Modules
  dental_enabled = true,
  sdoh_enabled = true,
  pharmacy_enabled = true,
  medications_enabled = true,
  -- Communication Modules
  telehealth_enabled = true,
  messaging_enabled = true,
  -- Integration Modules
  ehr_integration_enabled = true,
  fhir_enabled = true,
  -- Advanced Features
  ai_scribe_enabled = true,
  claude_care_enabled = true,
  guardian_monitoring_enabled = true,
  -- NurseOS Modules
  nurseos_clarity_enabled = true,
  nurseos_shield_enabled = true,
  resilience_hub_enabled = true,
  -- Billing & Revenue Modules
  billing_integration_enabled = true,
  rpm_ccm_enabled = true,
  -- Security & Compliance
  hipaa_audit_logging = true,
  mfa_enforcement = true,
  -- License tier
  license_tier = 'enterprise',
  updated_at = NOW();

-- ============================================================================
-- 3. VERIFY CONFIGURATION
-- ============================================================================

DO $$
DECLARE
  v_tenant_name TEXT;
  v_module_count INT;
BEGIN
  -- Check tenant branding
  SELECT name INTO v_tenant_name
  FROM tenants
  WHERE id = '2b902657-6a20-4435-a78a-576f397517ca';

  IF v_tenant_name IS NOT NULL THEN
    RAISE NOTICE 'WellFit tenant branding configured: %', v_tenant_name;
  ELSE
    RAISE WARNING 'WellFit tenant not found!';
  END IF;

  -- Check module config
  SELECT COUNT(*) INTO v_module_count
  FROM tenant_module_config
  WHERE tenant_id = '2b902657-6a20-4435-a78a-576f397517ca';

  IF v_module_count > 0 THEN
    RAISE NOTICE 'WellFit module configuration enabled';
  ELSE
    RAISE WARNING 'WellFit module configuration NOT found!';
  END IF;
END $$;
