/**
 * Super Admin Multi-Tenant Assignments
 *
 * Allows Envision staff to access multiple tenants for monitoring
 * Used by MultiTenantSelector and MultiTenantMonitor components
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

-- ============================================================================
-- MULTI-TENANT ASSIGNMENTS
-- ============================================================================

/**
 * Super admin tenant assignments
 * Tracks which super admins can access which tenants
 */
CREATE TABLE IF NOT EXISTS super_admin_tenant_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  super_admin_id UUID NOT NULL REFERENCES super_admin_users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Access level
  access_level TEXT NOT NULL DEFAULT 'monitor' CHECK (access_level IN ('monitor', 'manage', 'full')),

  -- Permissions
  can_view_metrics BOOLEAN NOT NULL DEFAULT true,
  can_view_logs BOOLEAN NOT NULL DEFAULT false,
  can_modify_settings BOOLEAN NOT NULL DEFAULT false,

  -- Metadata
  assigned_by UUID REFERENCES super_admin_users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT, -- Why this assignment was made
  expires_at TIMESTAMPTZ, -- Optional expiration

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  UNIQUE(super_admin_id, tenant_id)
);

CREATE INDEX idx_super_admin_tenant_assignments_admin ON super_admin_tenant_assignments(super_admin_id);
CREATE INDEX idx_super_admin_tenant_assignments_tenant ON super_admin_tenant_assignments(tenant_id);
CREATE INDEX idx_super_admin_tenant_assignments_active ON super_admin_tenant_assignments(super_admin_id)
  WHERE expires_at IS NULL OR expires_at > NOW();

COMMENT ON TABLE super_admin_tenant_assignments IS 'Multi-tenant access assignments for Envision staff';
COMMENT ON COLUMN super_admin_tenant_assignments.access_level IS 'monitor: View only metrics, manage: Can change settings, full: Full control';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

/**
 * Get all tenants a super admin can access
 */
CREATE OR REPLACE FUNCTION get_super_admin_assigned_tenants(
  p_super_admin_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  tenant_code TEXT,
  subdomain TEXT,
  access_level TEXT,
  can_view_metrics BOOLEAN,
  can_view_logs BOOLEAN,
  can_modify_settings BOOLEAN,
  assigned_at TIMESTAMPTZ
) AS $$
DECLARE
  v_super_admin_id UUID;
BEGIN
  -- Get super_admin_id from user_id
  SELECT id INTO v_super_admin_id
  FROM super_admin_users
  WHERE user_id = p_super_admin_user_id
    AND is_active = true;

  -- If not a super admin, return empty
  IF v_super_admin_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.tenant_code,
    t.subdomain,
    a.access_level,
    a.can_view_metrics,
    a.can_view_logs,
    a.can_modify_settings,
    a.assigned_at
  FROM super_admin_tenant_assignments a
  JOIN tenants t ON t.id = a.tenant_id
  WHERE a.super_admin_id = v_super_admin_id
    AND (a.expires_at IS NULL OR a.expires_at > NOW())
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

/**
 * Check if super admin can access a specific tenant
 */
CREATE OR REPLACE FUNCTION can_super_admin_access_tenant(
  p_tenant_id UUID,
  p_super_admin_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  v_super_admin_id UUID;
  v_has_access BOOLEAN;
BEGIN
  -- Get super_admin_id from user_id
  SELECT id INTO v_super_admin_id
  FROM super_admin_users
  WHERE user_id = p_super_admin_user_id
    AND is_active = true;

  -- If not a super admin, deny access
  IF v_super_admin_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if assignment exists and is active
  SELECT EXISTS (
    SELECT 1
    FROM super_admin_tenant_assignments
    WHERE super_admin_id = v_super_admin_id
      AND tenant_id = p_tenant_id
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_has_access;

  RETURN v_has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

/**
 * Assign super admin to tenant
 */
CREATE OR REPLACE FUNCTION assign_super_admin_to_tenant(
  p_super_admin_email TEXT,
  p_tenant_id UUID,
  p_access_level TEXT DEFAULT 'monitor',
  p_reason TEXT DEFAULT NULL,
  p_assigned_by_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
  v_super_admin_id UUID;
  v_assigned_by_id UUID;
  v_assignment_id UUID;
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin only';
  END IF;

  -- Get super admin ID
  SELECT id INTO v_super_admin_id
  FROM super_admin_users
  WHERE email = p_super_admin_email
    AND is_active = true;

  IF v_super_admin_id IS NULL THEN
    RAISE EXCEPTION 'Super admin not found: %', p_super_admin_email;
  END IF;

  -- Get assigner's super admin ID
  SELECT id INTO v_assigned_by_id
  FROM super_admin_users
  WHERE user_id = p_assigned_by_user_id
    AND is_active = true;

  -- Insert or update assignment
  INSERT INTO super_admin_tenant_assignments (
    super_admin_id,
    tenant_id,
    access_level,
    can_view_metrics,
    can_view_logs,
    can_modify_settings,
    assigned_by,
    reason
  ) VALUES (
    v_super_admin_id,
    p_tenant_id,
    p_access_level,
    true, -- Always allow viewing metrics
    p_access_level IN ('manage', 'full'),
    p_access_level = 'full',
    v_assigned_by_id,
    p_reason
  )
  ON CONFLICT (super_admin_id, tenant_id) DO UPDATE SET
    access_level = p_access_level,
    can_view_logs = p_access_level IN ('manage', 'full'),
    can_modify_settings = p_access_level = 'full',
    updated_at = NOW()
  RETURNING id INTO v_assignment_id;

  -- Log audit event
  INSERT INTO super_admin_audit_log (
    super_admin_id,
    super_admin_email,
    action,
    target_type,
    target_id,
    target_name,
    new_value,
    reason,
    severity
  ) VALUES (
    v_assigned_by_id,
    (SELECT email FROM super_admin_users WHERE id = v_assigned_by_id),
    'tenant.assign_super_admin',
    'tenant_assignment',
    v_assignment_id::text,
    (SELECT name FROM tenants WHERE id = p_tenant_id),
    jsonb_build_object(
      'super_admin_email', p_super_admin_email,
      'tenant_id', p_tenant_id,
      'access_level', p_access_level
    ),
    p_reason,
    'info'
  );

  RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECURITY POLICIES (RLS)
-- ============================================================================

ALTER TABLE super_admin_tenant_assignments ENABLE ROW LEVEL SECURITY;

-- Super admins can see all assignments
CREATE POLICY super_admin_tenant_assignments_super_admin_all
  ON super_admin_tenant_assignments
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admin_users WHERE is_active = true
    )
  );

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_super_admin_assigned_tenants(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_super_admin_access_tenant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_super_admin_to_tenant(TEXT, UUID, TEXT, TEXT, UUID) TO authenticated;

-- ============================================================================
-- SEED DATA - Assign Maria and Akima to WellFit
-- ============================================================================

/**
 * This will automatically assign Maria and Akima to the WellFit tenant
 * when they are added as super admins
 *
 * NOTE: You must first:
 * 1. Create the WellFit tenant with code 'WF-001'
 * 2. Add Maria and Akima as super_admin_users
 *
 * Then run this to assign them to WellFit:
 *
 * SELECT assign_super_admin_to_tenant(
 *   'maria@thewellfitcommunity.org',
 *   (SELECT id FROM tenants WHERE tenant_code = 'WF-001'),
 *   'full',
 *   'WellFit tenant owner'
 * );
 *
 * SELECT assign_super_admin_to_tenant(
 *   'akima@thewellfitcommunity.org',
 *   (SELECT id FROM tenants WHERE tenant_code = 'WF-001'),
 *   'full',
 *   'WellFit tenant owner'
 * );
 */

COMMENT ON TABLE super_admin_tenant_assignments IS 'Multi-tenant assignments - allows Envision staff to monitor multiple tenants (HIPAA-compliant system metrics only)';
