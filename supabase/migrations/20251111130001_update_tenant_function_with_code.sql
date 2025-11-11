/**
 * Update get_all_tenants_with_status function
 * Add tenant_code to return columns
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

-- Drop existing function (can't change return type with CREATE OR REPLACE)
DROP FUNCTION IF EXISTS get_all_tenants_with_status();

-- Recreate function with tenant_code
CREATE FUNCTION get_all_tenants_with_status()
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  subdomain TEXT,
  tenant_code TEXT,
  is_active BOOLEAN,
  is_suspended BOOLEAN,
  suspension_reason TEXT,
  user_count BIGINT,
  patient_count BIGINT,
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin only';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.subdomain,
    t.tenant_code,
    COALESCE(tss.is_active, true),
    COALESCE(tss.is_suspended, false),
    tss.suspension_reason,
    (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id),
    (SELECT COUNT(*) FROM patients p WHERE p.tenant_id = t.id),
    (SELECT MAX(created_at) FROM audit_logs WHERE tenant_id = t.id),
    t.created_at
  FROM tenants t
  LEFT JOIN tenant_system_status tss ON tss.tenant_id = t.id
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_all_tenants_with_status IS
'Get all tenants with system status, user counts, and tenant codes. Super admin only.';
