-- ============================================================================
-- FIX: Change employee helper functions from SECURITY DEFINER to SECURITY INVOKER
-- ============================================================================
-- SECURITY DEFINER runs with owner privileges, bypassing RLS
-- SECURITY INVOKER runs with caller privileges, respecting RLS
-- ============================================================================

-- ============================================================================
-- 1. DROP AND RECREATE get_direct_reports with tenant check
-- ============================================================================
DROP FUNCTION IF EXISTS get_direct_reports(UUID);

CREATE OR REPLACE FUNCTION get_direct_reports(p_manager_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  job_title TEXT,
  department_name TEXT,
  employment_status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER  -- Respects RLS policies
AS $$
DECLARE
  v_caller_tenant_id UUID;
  v_manager_tenant_id UUID;
BEGIN
  -- Get caller's tenant
  SELECT tenant_id INTO v_caller_tenant_id
  FROM profiles
  WHERE user_id = auth.uid();

  -- Get manager's tenant
  SELECT ep.tenant_id INTO v_manager_tenant_id
  FROM employee_profiles ep
  WHERE ep.user_id = p_manager_user_id;

  -- Verify same tenant (cross-tenant access blocked)
  IF v_caller_tenant_id IS NULL OR v_manager_tenant_id IS NULL OR v_caller_tenant_id != v_manager_tenant_id THEN
    RETURN; -- Return empty result set
  END IF;

  RETURN QUERY
  SELECT
    ed.user_id,
    ed.full_name,
    ed.job_title,
    ed.department_name,
    ed.employment_status
  FROM employee_directory ed
  WHERE ed.manager_id = (
    SELECT id FROM employee_profiles WHERE user_id = p_manager_user_id
  )
  AND ed.tenant_id = v_caller_tenant_id;  -- Explicit tenant filter
END;
$$;

-- ============================================================================
-- 2. DROP AND RECREATE get_employee_by_number with caller tenant enforcement
-- ============================================================================
DROP FUNCTION IF EXISTS get_employee_by_number(TEXT, UUID);

CREATE OR REPLACE FUNCTION get_employee_by_number(p_employee_number TEXT, p_tenant_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  job_title TEXT,
  department_name TEXT,
  employment_status TEXT,
  work_email TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER  -- Respects RLS policies
AS $$
DECLARE
  v_caller_tenant_id UUID;
BEGIN
  -- Get caller's tenant
  SELECT tenant_id INTO v_caller_tenant_id
  FROM profiles
  WHERE user_id = auth.uid();

  -- Verify caller belongs to requested tenant (can't query other tenants)
  IF v_caller_tenant_id IS NULL OR v_caller_tenant_id != p_tenant_id THEN
    RETURN; -- Return empty result set
  END IF;

  RETURN QUERY
  SELECT
    ed.user_id,
    ed.full_name,
    ed.job_title,
    ed.department_name,
    ed.employment_status,
    ed.work_email
  FROM employee_directory ed
  WHERE ed.employee_number = p_employee_number
  AND ed.tenant_id = p_tenant_id;
END;
$$;

-- ============================================================================
-- 3. DROP AND RECREATE has_employee_profile with tenant check
-- ============================================================================
DROP FUNCTION IF EXISTS has_employee_profile(UUID);

CREATE OR REPLACE FUNCTION has_employee_profile(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER  -- Respects RLS policies
AS $$
DECLARE
  v_caller_tenant_id UUID;
  v_target_tenant_id UUID;
BEGIN
  -- Get caller's tenant
  SELECT tenant_id INTO v_caller_tenant_id
  FROM profiles
  WHERE user_id = auth.uid();

  -- Get target user's tenant
  SELECT tenant_id INTO v_target_tenant_id
  FROM profiles
  WHERE user_id = p_user_id;

  -- Verify same tenant
  IF v_caller_tenant_id IS NULL OR v_target_tenant_id IS NULL OR v_caller_tenant_id != v_target_tenant_id THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM employee_profiles WHERE user_id = p_user_id
  );
END;
$$;

-- ============================================================================
-- 4. RE-GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_direct_reports(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_by_number(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_employee_profile(UUID) TO authenticated;

-- ============================================================================
-- 5. Add comments for security documentation
-- ============================================================================
COMMENT ON FUNCTION get_direct_reports(UUID) IS 'Get direct reports for a manager. SECURITY INVOKER - respects RLS, enforces same-tenant access.';
COMMENT ON FUNCTION get_employee_by_number(TEXT, UUID) IS 'Get employee by badge number. SECURITY INVOKER - respects RLS, caller must belong to requested tenant.';
COMMENT ON FUNCTION has_employee_profile(UUID) IS 'Check if user has employee profile. SECURITY INVOKER - respects RLS, enforces same-tenant access.';
