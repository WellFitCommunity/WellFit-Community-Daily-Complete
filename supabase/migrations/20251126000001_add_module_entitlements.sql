-- ============================================================================
-- Two-Tier Module Control: Entitlements + Active States
-- ============================================================================
-- Purpose: Add entitlement columns for SuperAdmin control
--
-- Model:
--   - *_entitled columns: Set by Envision SuperAdmin (ceiling based on payment)
--   - *_enabled columns: Set by Tenant Admin (active within entitlements)
--   - A module is only accessible if BOTH entitled=true AND enabled=true
--
-- Date: 2025-11-26
-- Author: Claude (Envision Atlus Two-Tier Feature Control)
-- ============================================================================

BEGIN;

-- ============================================================================
-- ADD ENTITLEMENT COLUMNS
-- ============================================================================
-- These represent what the tenant has PAID FOR (set by Envision SuperAdmin)
-- Tenants can only enable features within their entitlements

-- Core Platform Entitlements
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS community_entitled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS dashboard_entitled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS check_ins_entitled BOOLEAN NOT NULL DEFAULT TRUE;

-- Clinical Module Entitlements
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS dental_entitled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS sdoh_entitled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS pharmacy_entitled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS medications_entitled BOOLEAN NOT NULL DEFAULT TRUE;

-- Communication Module Entitlements
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS telehealth_entitled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS messaging_entitled BOOLEAN NOT NULL DEFAULT TRUE;

-- Integration Module Entitlements
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS ehr_integration_entitled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS fhir_entitled BOOLEAN NOT NULL DEFAULT FALSE;

-- Advanced Feature Entitlements
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS ai_scribe_entitled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS claude_care_entitled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS guardian_monitoring_entitled BOOLEAN NOT NULL DEFAULT FALSE;

-- NurseOS Module Entitlements
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS nurseos_clarity_entitled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS nurseos_shield_entitled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS resilience_hub_entitled BOOLEAN NOT NULL DEFAULT FALSE;

-- Billing & Revenue Entitlements
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS billing_integration_entitled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS rpm_ccm_entitled BOOLEAN NOT NULL DEFAULT FALSE;

-- Security & Compliance Entitlements
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS hipaa_audit_logging_entitled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS mfa_enforcement_entitled BOOLEAN NOT NULL DEFAULT FALSE;

-- Add SuperAdmin tracking fields
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS entitlements_updated_at TIMESTAMPTZ;
ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS entitlements_updated_by UUID;

-- ============================================================================
-- UPDATE is_module_enabled() TO CHECK BOTH ENTITLED AND ENABLED
-- ============================================================================
-- A module is only accessible if:
--   1. The tenant is ENTITLED to it (SuperAdmin has granted access)
--   2. The tenant has ENABLED it (Tenant Admin has activated it)

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
  v_entitled BOOLEAN;
  v_entitled_column TEXT;
BEGIN
  -- Use provided tenant_id or get from current user's profile
  v_tenant_id := COALESCE(p_tenant_id, get_current_tenant_id());

  IF v_tenant_id IS NULL THEN
    RETURN FALSE; -- No tenant = no access
  END IF;

  -- Derive entitled column name from enabled column name
  -- e.g., 'dental_enabled' -> 'dental_entitled'
  v_entitled_column := regexp_replace(p_module_name, '_enabled$', '_entitled');

  -- If column doesn't end with _enabled, it might already be in a different format
  IF v_entitled_column = p_module_name THEN
    -- Try adding _entitled if the column name doesn't have _enabled
    v_entitled_column := p_module_name || '_entitled';
  END IF;

  -- Check both enabled and entitled columns
  BEGIN
    -- First check if entitled (SuperAdmin granted access)
    EXECUTE format(
      'SELECT %I FROM public.tenant_module_config WHERE tenant_id = $1',
      v_entitled_column
    ) INTO v_entitled USING v_tenant_id;

    -- If not entitled, return FALSE immediately
    IF NOT COALESCE(v_entitled, FALSE) THEN
      RETURN FALSE;
    END IF;

    -- Then check if enabled (Tenant Admin activated)
    EXECUTE format(
      'SELECT %I FROM public.tenant_module_config WHERE tenant_id = $1',
      p_module_name
    ) INTO v_enabled USING v_tenant_id;

    RETURN COALESCE(v_enabled, FALSE);
  EXCEPTION
    WHEN undefined_column THEN
      -- Column doesn't exist, might be legacy schema
      -- Fall back to just checking enabled column
      BEGIN
        EXECUTE format(
          'SELECT %I FROM public.tenant_module_config WHERE tenant_id = $1',
          p_module_name
        ) INTO v_enabled USING v_tenant_id;
        RETURN COALESCE(v_enabled, FALSE);
      EXCEPTION
        WHEN undefined_column THEN
          RETURN FALSE;
      END;
    WHEN OTHERS THEN
      RETURN FALSE;
  END;
END;
$$;

COMMENT ON FUNCTION public.is_module_enabled IS
'Check if a module is both ENTITLED (SuperAdmin granted) AND ENABLED (Tenant Admin activated). Both must be true for access.';

-- ============================================================================
-- NEW FUNCTION: Check if module is entitled (SuperAdmin view)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_module_entitled(
  p_module_name TEXT,
  p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entitled BOOLEAN;
  v_entitled_column TEXT;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Derive entitled column name
  v_entitled_column := regexp_replace(p_module_name, '_enabled$', '_entitled');
  IF v_entitled_column = p_module_name THEN
    v_entitled_column := p_module_name || '_entitled';
  END IF;

  EXECUTE format(
    'SELECT %I FROM public.tenant_module_config WHERE tenant_id = $1',
    v_entitled_column
  ) INTO v_entitled USING p_tenant_id;

  RETURN COALESCE(v_entitled, FALSE);
EXCEPTION
  WHEN undefined_column THEN
    RETURN FALSE;
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.is_module_entitled IS
'Check if a tenant is ENTITLED to a module (SuperAdmin has granted access). Used by SuperAdmin portal.';

-- ============================================================================
-- NEW FUNCTION: Get entitlements and enabled states
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_module_states(
  p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
  module_name TEXT,
  is_entitled BOOLEAN,
  is_enabled BOOLEAN,
  is_accessible BOOLEAN
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

  -- Return all module states
  RETURN QUERY
  SELECT 'community_enabled'::TEXT,
         v_config.community_entitled,
         v_config.community_enabled,
         v_config.community_entitled AND v_config.community_enabled
  UNION ALL SELECT 'dashboard_enabled', v_config.dashboard_entitled, v_config.dashboard_enabled, v_config.dashboard_entitled AND v_config.dashboard_enabled
  UNION ALL SELECT 'check_ins_enabled', v_config.check_ins_entitled, v_config.check_ins_enabled, v_config.check_ins_entitled AND v_config.check_ins_enabled
  UNION ALL SELECT 'dental_enabled', v_config.dental_entitled, v_config.dental_enabled, v_config.dental_entitled AND v_config.dental_enabled
  UNION ALL SELECT 'sdoh_enabled', v_config.sdoh_entitled, v_config.sdoh_enabled, v_config.sdoh_entitled AND v_config.sdoh_enabled
  UNION ALL SELECT 'pharmacy_enabled', v_config.pharmacy_entitled, v_config.pharmacy_enabled, v_config.pharmacy_entitled AND v_config.pharmacy_enabled
  UNION ALL SELECT 'medications_enabled', v_config.medications_entitled, v_config.medications_enabled, v_config.medications_entitled AND v_config.medications_enabled
  UNION ALL SELECT 'telehealth_enabled', v_config.telehealth_entitled, v_config.telehealth_enabled, v_config.telehealth_entitled AND v_config.telehealth_enabled
  UNION ALL SELECT 'messaging_enabled', v_config.messaging_entitled, v_config.messaging_enabled, v_config.messaging_entitled AND v_config.messaging_enabled
  UNION ALL SELECT 'ehr_integration_enabled', v_config.ehr_integration_entitled, v_config.ehr_integration_enabled, v_config.ehr_integration_entitled AND v_config.ehr_integration_enabled
  UNION ALL SELECT 'fhir_enabled', v_config.fhir_entitled, v_config.fhir_enabled, v_config.fhir_entitled AND v_config.fhir_enabled
  UNION ALL SELECT 'ai_scribe_enabled', v_config.ai_scribe_entitled, v_config.ai_scribe_enabled, v_config.ai_scribe_entitled AND v_config.ai_scribe_enabled
  UNION ALL SELECT 'claude_care_enabled', v_config.claude_care_entitled, v_config.claude_care_enabled, v_config.claude_care_entitled AND v_config.claude_care_enabled
  UNION ALL SELECT 'guardian_monitoring_enabled', v_config.guardian_monitoring_entitled, v_config.guardian_monitoring_enabled, v_config.guardian_monitoring_entitled AND v_config.guardian_monitoring_enabled
  UNION ALL SELECT 'nurseos_clarity_enabled', v_config.nurseos_clarity_entitled, v_config.nurseos_clarity_enabled, v_config.nurseos_clarity_entitled AND v_config.nurseos_clarity_enabled
  UNION ALL SELECT 'nurseos_shield_enabled', v_config.nurseos_shield_entitled, v_config.nurseos_shield_enabled, v_config.nurseos_shield_entitled AND v_config.nurseos_shield_enabled
  UNION ALL SELECT 'resilience_hub_enabled', v_config.resilience_hub_entitled, v_config.resilience_hub_enabled, v_config.resilience_hub_entitled AND v_config.resilience_hub_enabled
  UNION ALL SELECT 'billing_integration_enabled', v_config.billing_integration_entitled, v_config.billing_integration_enabled, v_config.billing_integration_entitled AND v_config.billing_integration_enabled
  UNION ALL SELECT 'rpm_ccm_enabled', v_config.rpm_ccm_entitled, v_config.rpm_ccm_enabled, v_config.rpm_ccm_entitled AND v_config.rpm_ccm_enabled
  UNION ALL SELECT 'hipaa_audit_logging', v_config.hipaa_audit_logging_entitled, v_config.hipaa_audit_logging, v_config.hipaa_audit_logging_entitled AND v_config.hipaa_audit_logging
  UNION ALL SELECT 'mfa_enforcement', v_config.mfa_enforcement_entitled, v_config.mfa_enforcement, v_config.mfa_enforcement_entitled AND v_config.mfa_enforcement;
END;
$$;

COMMENT ON FUNCTION public.get_module_states IS
'Get all module states including entitlement, enabled, and accessible (both true) status for a tenant.';

-- ============================================================================
-- SUPERADMIN RLS BYPASS POLICY
-- ============================================================================
-- SuperAdmins need to update ANY tenant's entitlements (not just their own)

-- Policy for SuperAdmin to read any tenant
DROP POLICY IF EXISTS "tenant_module_config_superadmin_read" ON public.tenant_module_config;
CREATE POLICY "tenant_module_config_superadmin_read"
  ON public.tenant_module_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admin_users
      WHERE super_admin_users.id = auth.uid()
        AND super_admin_users.status = 'active'
    )
  );

-- Policy for SuperAdmin to update any tenant's entitlements
DROP POLICY IF EXISTS "tenant_module_config_superadmin_write" ON public.tenant_module_config;
CREATE POLICY "tenant_module_config_superadmin_write"
  ON public.tenant_module_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admin_users
      WHERE super_admin_users.id = auth.uid()
        AND super_admin_users.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admin_users
      WHERE super_admin_users.id = auth.uid()
        AND super_admin_users.status = 'active'
    )
  );

-- Policy for SuperAdmin to insert new tenant configs
DROP POLICY IF EXISTS "tenant_module_config_superadmin_insert" ON public.tenant_module_config;
CREATE POLICY "tenant_module_config_superadmin_insert"
  ON public.tenant_module_config
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admin_users
      WHERE super_admin_users.id = auth.uid()
        AND super_admin_users.status = 'active'
    )
  );

-- ============================================================================
-- RESTRICT TENANT ADMIN FROM MODIFYING ENTITLEMENTS
-- ============================================================================
-- Tenant admins can only modify *_enabled columns, not *_entitled columns

-- Update existing admin write policy to exclude entitlement columns
DROP POLICY IF EXISTS "tenant_module_config_admin_write" ON public.tenant_module_config;
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
    -- Not a SuperAdmin (they use the superadmin policy)
    AND NOT EXISTS (
      SELECT 1 FROM public.super_admin_users
      WHERE super_admin_users.id = auth.uid()
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

-- ============================================================================
-- GRANTS FOR NEW FUNCTION
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.is_module_entitled TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_module_states TO authenticated;

-- ============================================================================
-- UPDATE DEFAULT TENANT ENTITLEMENTS
-- ============================================================================
-- Set default WellFit tenant as fully entitled (enterprise tier)

UPDATE public.tenant_module_config
SET
  community_entitled = TRUE,
  dashboard_entitled = TRUE,
  check_ins_entitled = TRUE,
  dental_entitled = TRUE,
  sdoh_entitled = TRUE,
  pharmacy_entitled = TRUE,
  medications_entitled = TRUE,
  telehealth_entitled = TRUE,
  messaging_entitled = TRUE,
  ehr_integration_entitled = TRUE,
  fhir_entitled = TRUE,
  ai_scribe_entitled = TRUE,
  claude_care_entitled = TRUE,
  guardian_monitoring_entitled = TRUE,
  nurseos_clarity_entitled = TRUE,
  nurseos_shield_entitled = TRUE,
  resilience_hub_entitled = TRUE,
  billing_integration_entitled = TRUE,
  rpm_ccm_entitled = TRUE,
  hipaa_audit_logging_entitled = TRUE,
  mfa_enforcement_entitled = TRUE,
  entitlements_updated_at = NOW()
WHERE tenant_id = '00000000-0000-0000-0000-000000000000'::uuid;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN public.tenant_module_config.dental_entitled IS
'SuperAdmin entitlement: Tenant has paid for dental module access';

COMMENT ON COLUMN public.tenant_module_config.dental_enabled IS
'Tenant Admin activation: Dental module is currently active for users';

COMMENT ON COLUMN public.tenant_module_config.entitlements_updated_at IS
'Timestamp of last entitlement change by SuperAdmin';

COMMENT ON COLUMN public.tenant_module_config.entitlements_updated_by IS
'SuperAdmin user who last modified entitlements';

COMMIT;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================
/*

-- SuperAdmin: Grant dental entitlement to a tenant
UPDATE public.tenant_module_config
SET
  dental_entitled = TRUE,
  entitlements_updated_at = NOW(),
  entitlements_updated_by = 'superadmin-user-id'
WHERE tenant_id = 'tenant-uuid';

-- Tenant Admin: Enable dental (only works if entitled)
UPDATE public.tenant_module_config
SET dental_enabled = TRUE
WHERE tenant_id = get_current_tenant_id();

-- Check if user can access dental (both entitled AND enabled)
SELECT public.is_module_enabled('dental_enabled');

-- SuperAdmin: View all tenant module states
SELECT * FROM public.get_module_states('tenant-uuid');

-- Application code:
const { data: states } = await supabase.rpc('get_module_states', { p_tenant_id: tenantId });
// states = [{ module_name, is_entitled, is_enabled, is_accessible }, ...]

*/
