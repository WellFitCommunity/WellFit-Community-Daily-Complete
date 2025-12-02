-- ============================================================================
-- Fix Super Admin Panel Access
-- Date: 2025-12-02
-- Purpose: Add RLS policies for super admins to access Guardian, SOC2,
--          Feature Flags, and AI Skills panels across all tenants
-- ============================================================================

-- ============================================================================
-- 1. FIX guardian_alerts RLS - Super admins need access
-- ============================================================================

-- Add super admin access policy for guardian_alerts
DROP POLICY IF EXISTS "Super admins can view all guardian alerts" ON guardian_alerts;
CREATE POLICY "Super admins can view all guardian alerts"
ON guardian_alerts
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true)
);

DROP POLICY IF EXISTS "Super admins can update guardian alerts" ON guardian_alerts;
CREATE POLICY "Super admins can update guardian alerts"
ON guardian_alerts
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true)
);

DROP POLICY IF EXISTS "Super admins can insert guardian alerts" ON guardian_alerts;
CREATE POLICY "Super admins can insert guardian alerts"
ON guardian_alerts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true)
);

-- ============================================================================
-- 2. FIX guardian_cron_log RLS - Super admins need access
-- ============================================================================

ALTER TABLE guardian_cron_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view guardian cron logs" ON guardian_cron_log;
CREATE POLICY "Super admins can view guardian cron logs"
ON guardian_cron_log
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true)
);

DROP POLICY IF EXISTS "Super admins can manage guardian cron logs" ON guardian_cron_log;
CREATE POLICY "Super admins can manage guardian cron logs"
ON guardian_cron_log
FOR ALL
TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true)
);

-- ============================================================================
-- 3. FIX tenant_module_config RLS - Super admins need cross-tenant access
-- ============================================================================

DROP POLICY IF EXISTS "Super admins can view all tenant module configs" ON tenant_module_config;
CREATE POLICY "Super admins can view all tenant module configs"
ON tenant_module_config
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true)
);

DROP POLICY IF EXISTS "Super admins can update all tenant module configs" ON tenant_module_config;
CREATE POLICY "Super admins can update all tenant module configs"
ON tenant_module_config
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true)
)
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true)
);

-- ============================================================================
-- 4. FIX admin_audit_logs RLS - Super admins need cross-tenant access
-- ============================================================================

-- Check if table exists first and add policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_audit_logs') THEN
    -- Enable RLS
    EXECUTE 'ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY';

    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "Super admins can view all audit logs" ON admin_audit_logs;

    -- Create new policy
    CREATE POLICY "Super admins can view all audit logs"
    ON admin_audit_logs
    FOR SELECT
    TO authenticated
    USING (
      auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true)
    );
  END IF;
END $$;

-- ============================================================================
-- 5. FIX ai_skill_config table structure
-- The AISkillsControlPanel expects tenant_id, not skill_key
-- ============================================================================

-- Drop and recreate the ai_skill_config table with correct structure
DROP TABLE IF EXISTS ai_skill_config;

CREATE TABLE ai_skill_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,

  -- AI Skills flags
  billing_suggester_enabled BOOLEAN DEFAULT false,
  readmission_predictor_enabled BOOLEAN DEFAULT false,
  cultural_health_coach_enabled BOOLEAN DEFAULT false,
  welfare_check_dispatcher_enabled BOOLEAN DEFAULT false,
  emergency_intelligence_enabled BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_skill_config ENABLE ROW LEVEL SECURITY;

-- Super admins can access all AI skill configs
DROP POLICY IF EXISTS "Super admins full access ai_skill_config" ON ai_skill_config;
CREATE POLICY "Super admins full access ai_skill_config"
ON ai_skill_config
FOR ALL
TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true)
)
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true)
);

-- ============================================================================
-- 6. SEED system_feature_flags with initial data
-- First, check if requires_license is BOOLEAN or TEXT and adapt accordingly
-- ============================================================================

DO $$
DECLARE
  col_type TEXT;
BEGIN
  -- Get the column type
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'system_feature_flags' AND column_name = 'requires_license';

  IF col_type = 'boolean' THEN
    -- Column is BOOLEAN - insert with boolean values
    INSERT INTO system_feature_flags (feature_key, feature_name, description, is_enabled, category, enabled_for_new_tenants, requires_license) VALUES
      -- Core Features
      ('core_dashboard', 'Dashboard', 'Main dashboard and analytics', true, 'core', true, false),
      ('core_check_ins', 'Daily Check-Ins', 'Patient daily health check-in system', true, 'core', true, false),
      ('core_messaging', 'Secure Messaging', 'HIPAA-compliant messaging system', true, 'core', true, false),
      -- Healthcare Features
      ('health_telehealth', 'Telehealth', 'Video consultation capabilities', true, 'healthcare', false, true),
      ('health_sdoh', 'SDOH Assessment', 'Social Determinants of Health tracking', true, 'healthcare', true, false),
      ('health_pharmacy', 'Pharmacy Integration', 'Medication management and pharmacy sync', false, 'healthcare', false, true),
      ('health_dental', 'Dental Module', 'Dental health tracking and CDT codes', true, 'healthcare', false, true),
      ('health_ehr_integration', 'EHR Integration', 'Connect to Epic, Cerner, Athena', false, 'healthcare', false, true),
      -- AI Features
      ('ai_billing_suggester', 'AI Billing Suggester', 'Automated ICD-10/CPT code suggestions', true, 'ai', false, true),
      ('ai_readmission_predictor', 'Readmission Risk AI', '30-day readmission risk prediction', true, 'ai', false, true),
      ('ai_cultural_coach', 'Cultural Health Coach', 'Multi-language health content', true, 'ai', false, true),
      ('ai_scribe', 'AI Scribe', 'Automated clinical documentation', false, 'ai', false, true),
      -- Compliance Features
      ('compliance_hipaa_logging', 'HIPAA Audit Logging', 'Comprehensive audit trail', true, 'compliance', true, false),
      ('compliance_mfa', 'MFA Enforcement', 'Multi-factor authentication requirement', true, 'compliance', false, false),
      -- Law Enforcement Features
      ('le_welfare_check', 'Welfare Check Dispatcher', 'Law enforcement welfare check integration', false, 'law_enforcement', false, true),
      ('le_emergency_intel', 'Emergency Intelligence', '911 dispatcher briefing system', false, 'law_enforcement', false, true),
      -- Billing Features
      ('billing_rpm_ccm', 'RPM/CCM Billing', 'Remote Patient Monitoring billing', false, 'billing', false, true),
      ('billing_integration', 'Billing Integration', 'Clearinghouse and claims integration', false, 'billing', false, true)
    ON CONFLICT (feature_key) DO UPDATE SET
      feature_name = EXCLUDED.feature_name,
      description = EXCLUDED.description,
      category = EXCLUDED.category;
  ELSE
    -- Column is TEXT or other - insert with text values
    INSERT INTO system_feature_flags (feature_key, feature_name, description, is_enabled, category, enabled_for_new_tenants, requires_license) VALUES
      -- Core Features
      ('core_dashboard', 'Dashboard', 'Main dashboard and analytics', true, 'core', true, NULL),
      ('core_check_ins', 'Daily Check-Ins', 'Patient daily health check-in system', true, 'core', true, NULL),
      ('core_messaging', 'Secure Messaging', 'HIPAA-compliant messaging system', true, 'core', true, NULL),
      -- Healthcare Features
      ('health_telehealth', 'Telehealth', 'Video consultation capabilities', true, 'healthcare', false, 'premium'),
      ('health_sdoh', 'SDOH Assessment', 'Social Determinants of Health tracking', true, 'healthcare', true, NULL),
      ('health_pharmacy', 'Pharmacy Integration', 'Medication management and pharmacy sync', false, 'healthcare', false, 'enterprise'),
      ('health_dental', 'Dental Module', 'Dental health tracking and CDT codes', true, 'healthcare', false, 'premium'),
      ('health_ehr_integration', 'EHR Integration', 'Connect to Epic, Cerner, Athena', false, 'healthcare', false, 'enterprise'),
      -- AI Features
      ('ai_billing_suggester', 'AI Billing Suggester', 'Automated ICD-10/CPT code suggestions', true, 'ai', false, 'premium'),
      ('ai_readmission_predictor', 'Readmission Risk AI', '30-day readmission risk prediction', true, 'ai', false, 'enterprise'),
      ('ai_cultural_coach', 'Cultural Health Coach', 'Multi-language health content', true, 'ai', false, 'premium'),
      ('ai_scribe', 'AI Scribe', 'Automated clinical documentation', false, 'ai', false, 'enterprise'),
      -- Compliance Features
      ('compliance_hipaa_logging', 'HIPAA Audit Logging', 'Comprehensive audit trail', true, 'compliance', true, NULL),
      ('compliance_mfa', 'MFA Enforcement', 'Multi-factor authentication requirement', true, 'compliance', false, 'standard'),
      -- Law Enforcement Features
      ('le_welfare_check', 'Welfare Check Dispatcher', 'Law enforcement welfare check integration', false, 'law_enforcement', false, 'enterprise'),
      ('le_emergency_intel', 'Emergency Intelligence', '911 dispatcher briefing system', false, 'law_enforcement', false, 'enterprise'),
      -- Billing Features
      ('billing_rpm_ccm', 'RPM/CCM Billing', 'Remote Patient Monitoring billing', false, 'billing', false, 'enterprise'),
      ('billing_integration', 'Billing Integration', 'Clearinghouse and claims integration', false, 'billing', false, 'enterprise')
    ON CONFLICT (feature_key) DO UPDATE SET
      feature_name = EXCLUDED.feature_name,
      description = EXCLUDED.description,
      category = EXCLUDED.category;
  END IF;
END $$;

-- ============================================================================
-- 7. Create tenant_module_config entries for existing tenants
-- ============================================================================

INSERT INTO tenant_module_config (tenant_id, license_tier, hipaa_audit_logging, mfa_enforcement)
SELECT
  t.id as tenant_id,
  'standard' as license_tier,
  true as hipaa_audit_logging,
  false as mfa_enforcement
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_module_config tmc WHERE tmc.tenant_id = t.id
)
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- 8. Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_skill_config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON guardian_cron_log TO authenticated;

-- ============================================================================
-- 9. Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Super Admin Panel Access Fix Complete!';
  RAISE NOTICE '- Guardian alerts/cron_log: Super admin RLS policies added';
  RAISE NOTICE '- tenant_module_config: Super admin cross-tenant access added';
  RAISE NOTICE '- ai_skill_config: Restructured with tenant_id column';
  RAISE NOTICE '- system_feature_flags: Seeded with initial data';
END $$;
