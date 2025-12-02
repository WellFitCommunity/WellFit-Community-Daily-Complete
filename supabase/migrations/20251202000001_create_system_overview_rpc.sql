-- ============================================================================
-- Create get_system_overview RPC Function
-- Date: 2025-12-02
-- Purpose: Provide system overview stats for Super Admin dashboard
-- ============================================================================

-- Drop if exists
DROP FUNCTION IF EXISTS get_system_overview();

-- Create the function
CREATE OR REPLACE FUNCTION get_system_overview()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Check if caller is a super admin
  IF NOT EXISTS (
    SELECT 1 FROM super_admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied: Super admin privileges required';
  END IF;

  SELECT json_build_object(
    'total_tenants', (SELECT COUNT(*) FROM tenants),
    'active_tenants', (SELECT COUNT(*) FROM tenants WHERE status = 'active'),
    'suspended_tenants', (SELECT COUNT(*) FROM tenants WHERE status = 'suspended'),
    'total_users', (SELECT COUNT(*) FROM profiles),
    'total_patients', (SELECT COUNT(*) FROM profiles WHERE role_code IN (4, 19)),
    'total_staff', (SELECT COUNT(*) FROM profiles WHERE role_code IN (1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13)),
    'total_check_ins_today', (
      SELECT COUNT(*) FROM check_ins
      WHERE created_at >= CURRENT_DATE
    ),
    'total_check_ins_week', (
      SELECT COUNT(*) FROM check_ins
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    ),
    'critical_health_issues', 0,
    'system_health', 'healthy',
    'last_updated', NOW()
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute to authenticated users (RLS in function handles access)
GRANT EXECUTE ON FUNCTION get_system_overview() TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_system_overview() IS 'Returns system-wide statistics for super admin dashboard';
