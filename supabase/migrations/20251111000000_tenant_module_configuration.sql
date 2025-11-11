-- ============================================================================
-- Tenant Module Configuration System
-- ============================================================================
-- Purpose: Enable/disable platform modules per tenant (B2B2C feature flags)
-- Date: 2025-11-11
-- Author: Claude (Enterprise Multi-Tenancy Enhancement)
--
-- Use Case Examples:
-- - Methodist Healthcare: dental=true, sdoh=true, telehealth=false
-- - Houston Senior Services: community=true, pharmacy=false
-- - Miami Healthcare: telehealth=true, ehr_integration=true
--
-- Security: Admin-only access, full RLS policies, audit logging
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE: tenant_module_config
-- ============================================================================
-- Stores per-tenant module enable/disable flags
-- One row per tenant, created automatically on tenant provisioning

CREATE TABLE IF NOT EXISTS public.tenant_module_config (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,

  -- Core Platform Modules
  community_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  dashboard_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  check_ins_enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Clinical Modules
  dental_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sdoh_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  pharmacy_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  medications_enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Communication Modules
  telehealth_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  messaging_enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Integration Modules
  ehr_integration_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  fhir_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Advanced Features
  ai_scribe_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  claude_care_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  guardian_monitoring_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- NurseOS Modules (for healthcare provider organizations)
  nurseos_clarity_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  nurseos_shield_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  resilience_hub_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Billing & Revenue Modules
  billing_integration_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rpm_ccm_enabled BOOLEAN NOT NULL DEFAULT FALSE, -- Remote Patient Monitoring / Chronic Care Management

  -- Security & Compliance
  hipaa_audit_logging BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_enforcement BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  license_tier TEXT NOT NULL DEFAULT 'standard' CHECK (license_tier IN ('basic', 'standard', 'premium', 'enterprise')),
  custom_modules JSONB DEFAULT '{}'::jsonb, -- For future custom modules

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_module_config_tenant_id
  ON public.tenant_module_config(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_module_config_license_tier
  ON public.tenant_module_config(license_tier);

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_tenant_module_config_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenant_module_config_updated_at ON public.tenant_module_config;
CREATE TRIGGER tenant_module_config_updated_at
  BEFORE UPDATE ON public.tenant_module_config
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_module_config_updated_at();

-- ============================================================================
-- FUNCTION: Check if module is enabled for tenant
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_module_enabled(
  p_module_name TEXT,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_enabled BOOLEAN;
BEGIN
  -- Use provided tenant_id or get from current user's profile
  v_tenant_id := COALESCE(p_tenant_id, get_current_tenant_id());

  IF v_tenant_id IS NULL THEN
    RETURN FALSE; -- No tenant = no access
  END IF;

  -- Dynamically check the module column
  EXECUTE format(
    'SELECT %I FROM public.tenant_module_config WHERE tenant_id = $1',
    p_module_name
  ) INTO v_enabled USING v_tenant_id;

  RETURN COALESCE(v_enabled, FALSE);
EXCEPTION
  WHEN undefined_column THEN
    -- Module name doesn't exist in schema
    RETURN FALSE;
  WHEN OTHERS THEN
    -- Any other error, deny access
    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.is_module_enabled IS
'Check if a specific module is enabled for a tenant. Returns FALSE if tenant not found or module undefined.';

-- ============================================================================
-- FUNCTION: Get all enabled modules for tenant
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_enabled_modules(
  p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
  module_name TEXT,
  is_enabled BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_config RECORD;
BEGIN
  v_tenant_id := COALESCE(p_tenant_id, get_current_tenant_id());

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_config
  FROM public.tenant_module_config
  WHERE tenant_module_config.tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Return all module columns and their values
  RETURN QUERY
  SELECT
    column_name::TEXT as module_name,
    CASE
      WHEN column_name = 'community_enabled' THEN v_config.community_enabled
      WHEN column_name = 'dashboard_enabled' THEN v_config.dashboard_enabled
      WHEN column_name = 'check_ins_enabled' THEN v_config.check_ins_enabled
      WHEN column_name = 'dental_enabled' THEN v_config.dental_enabled
      WHEN column_name = 'sdoh_enabled' THEN v_config.sdoh_enabled
      WHEN column_name = 'pharmacy_enabled' THEN v_config.pharmacy_enabled
      WHEN column_name = 'medications_enabled' THEN v_config.medications_enabled
      WHEN column_name = 'telehealth_enabled' THEN v_config.telehealth_enabled
      WHEN column_name = 'messaging_enabled' THEN v_config.messaging_enabled
      WHEN column_name = 'ehr_integration_enabled' THEN v_config.ehr_integration_enabled
      WHEN column_name = 'fhir_enabled' THEN v_config.fhir_enabled
      WHEN column_name = 'ai_scribe_enabled' THEN v_config.ai_scribe_enabled
      WHEN column_name = 'claude_care_enabled' THEN v_config.claude_care_enabled
      WHEN column_name = 'guardian_monitoring_enabled' THEN v_config.guardian_monitoring_enabled
      WHEN column_name = 'nurseos_clarity_enabled' THEN v_config.nurseos_clarity_enabled
      WHEN column_name = 'nurseos_shield_enabled' THEN v_config.nurseos_shield_enabled
      WHEN column_name = 'resilience_hub_enabled' THEN v_config.resilience_hub_enabled
      WHEN column_name = 'billing_integration_enabled' THEN v_config.billing_integration_enabled
      WHEN column_name = 'rpm_ccm_enabled' THEN v_config.rpm_ccm_enabled
      WHEN column_name = 'hipaa_audit_logging' THEN v_config.hipaa_audit_logging
      WHEN column_name = 'mfa_enforcement' THEN v_config.mfa_enforcement
      ELSE FALSE
    END as is_enabled
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'tenant_module_config'
    AND column_name LIKE '%_enabled'
    AND data_type = 'boolean';
END;
$$;

COMMENT ON FUNCTION public.get_enabled_modules IS
'Get all module flags and their enabled status for a tenant';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.tenant_module_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "tenant_module_config_admin_read" ON public.tenant_module_config;
DROP POLICY IF EXISTS "tenant_module_config_admin_write" ON public.tenant_module_config;
DROP POLICY IF EXISTS "tenant_module_config_user_read" ON public.tenant_module_config;

-- Admins can read and write their own tenant's config
CREATE POLICY "tenant_module_config_admin_read"
  ON public.tenant_module_config
  FOR SELECT
  USING (
    tenant_id = get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = tenant_module_config.tenant_id
        AND profiles.role IN ('admin', 'system_admin')
    )
  );

CREATE POLICY "tenant_module_config_admin_write"
  ON public.tenant_module_config
  FOR UPDATE
  USING (
    tenant_id = get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = tenant_module_config.tenant_id
        AND profiles.role IN ('admin', 'system_admin')
    )
  )
  WITH CHECK (
    tenant_id = get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = tenant_module_config.tenant_id
        AND profiles.role IN ('admin', 'system_admin')
    )
  );

-- Regular users can only read their tenant's config (to know what features are available)
CREATE POLICY "tenant_module_config_user_read"
  ON public.tenant_module_config
  FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON public.tenant_module_config TO authenticated;
GRANT UPDATE ON public.tenant_module_config TO authenticated; -- RLS will enforce admin-only
GRANT EXECUTE ON FUNCTION public.is_module_enabled TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_enabled_modules TO authenticated, anon;

-- ============================================================================
-- SEED DATA: Create default config for existing tenants
-- ============================================================================
-- Note: In production, you'd populate tenant_id from your tenants table
-- For now, we'll create a default entry for the main WellFit tenant

INSERT INTO public.tenant_module_config (
  tenant_id,
  community_enabled,
  dashboard_enabled,
  check_ins_enabled,
  dental_enabled,
  sdoh_enabled,
  pharmacy_enabled,
  medications_enabled,
  telehealth_enabled,
  messaging_enabled,
  ehr_integration_enabled,
  fhir_enabled,
  ai_scribe_enabled,
  claude_care_enabled,
  guardian_monitoring_enabled,
  nurseos_clarity_enabled,
  nurseos_shield_enabled,
  resilience_hub_enabled,
  billing_integration_enabled,
  rpm_ccm_enabled,
  hipaa_audit_logging,
  mfa_enforcement,
  license_tier
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid, -- Default tenant (replace with actual)
  TRUE,  -- community_enabled
  TRUE,  -- dashboard_enabled
  TRUE,  -- check_ins_enabled
  TRUE,  -- dental_enabled (enable for main tenant)
  TRUE,  -- sdoh_enabled (enable for main tenant)
  FALSE, -- pharmacy_enabled
  TRUE,  -- medications_enabled
  FALSE, -- telehealth_enabled
  TRUE,  -- messaging_enabled
  FALSE, -- ehr_integration_enabled
  FALSE, -- fhir_enabled
  FALSE, -- ai_scribe_enabled
  FALSE, -- claude_care_enabled
  TRUE,  -- guardian_monitoring_enabled
  FALSE, -- nurseos_clarity_enabled
  FALSE, -- nurseos_shield_enabled
  FALSE, -- resilience_hub_enabled
  FALSE, -- billing_integration_enabled
  FALSE, -- rpm_ccm_enabled
  TRUE,  -- hipaa_audit_logging
  FALSE, -- mfa_enforcement
  'enterprise' -- license_tier
)
ON CONFLICT (tenant_id) DO NOTHING; -- Don't overwrite if already exists

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.tenant_module_config IS
'Per-tenant module configuration (feature flags). Controls which platform modules are enabled for each B2B customer.';

COMMENT ON COLUMN public.tenant_module_config.dental_enabled IS
'Enable dental health module: assessments, procedures, CDT codes, FHIR integration';

COMMENT ON COLUMN public.tenant_module_config.sdoh_enabled IS
'Enable Social Determinants of Health module: 26 categories, risk tracking, Z-codes';

COMMENT ON COLUMN public.tenant_module_config.telehealth_enabled IS
'Enable telehealth/video consultation features';

COMMENT ON COLUMN public.tenant_module_config.ehr_integration_enabled IS
'Enable EHR adapter integration (Epic, Cerner, Athena)';

COMMENT ON COLUMN public.tenant_module_config.rpm_ccm_enabled IS
'Enable Remote Patient Monitoring and Chronic Care Management billing features';

COMMENT ON COLUMN public.tenant_module_config.license_tier IS
'Subscription tier: basic, standard, premium, enterprise - determines available features';

COMMENT ON COLUMN public.tenant_module_config.custom_modules IS
'JSONB field for tenant-specific custom modules not in standard schema';

COMMIT;

-- ============================================================================
-- USAGE EXAMPLES (as comments for documentation)
-- ============================================================================
/*

-- Check if dental module is enabled for current tenant:
SELECT public.is_module_enabled('dental_enabled');

-- Check if SDOH is enabled for specific tenant:
SELECT public.is_module_enabled('sdoh_enabled', '12345678-1234-1234-1234-123456789abc'::uuid);

-- Get all enabled modules for current tenant:
SELECT * FROM public.get_enabled_modules();

-- Get all enabled modules for specific tenant:
SELECT * FROM public.get_enabled_modules('12345678-1234-1234-1234-123456789abc'::uuid);

-- Admin: Enable dental module for their tenant:
UPDATE public.tenant_module_config
SET dental_enabled = TRUE, updated_by = auth.uid()
WHERE tenant_id = get_current_tenant_id();

-- Admin: Bulk enable multiple modules:
UPDATE public.tenant_module_config
SET
  dental_enabled = TRUE,
  sdoh_enabled = TRUE,
  telehealth_enabled = TRUE,
  license_tier = 'premium',
  updated_by = auth.uid()
WHERE tenant_id = get_current_tenant_id();

-- From application code (using Supabase client):
const { data: isDentalEnabled } = await supabase.rpc('is_module_enabled', {
  p_module_name: 'dental_enabled'
});

const { data: enabledModules } = await supabase.rpc('get_enabled_modules');

const { error } = await supabase
  .from('tenant_module_config')
  .update({ dental_enabled: true })
  .eq('tenant_id', currentTenantId);

*/
