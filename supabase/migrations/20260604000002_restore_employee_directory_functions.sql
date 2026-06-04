-- Restore: employee directory RPCs get_direct_reports + get_employee_by_number
--
-- DRIFT FORENSIC (DB-reference drift triage #14 + #15 — rpc::get_direct_reports,
-- rpc::get_employee_by_number):
--   Both were dropped by 20251209110000_drop_broken_functions.sql Part 2 ("functions
--   that need missing schema/dependencies"). Root cause: the immediately-prior
--   20251209100000_fix_database_function_errors.sql REWROTE them to query `profiles`
--   using columns profiles does NOT have (manager_id, employee_number) and with the
--   WRONG signatures (get_direct_reports(p_manager_id) / get_employee_by_number(TEXT)),
--   which broke them and mismatched the callers. They were then dropped and never
--   restored.
--
--   The CORRECT pre-regression versions are in 20251201110002_fix_employee_functions_
--   security.sql: SECURITY INVOKER, tenant-enforcing, querying the live
--   `employee_directory` view, and matching the actual caller signatures
--   (employeeService.getDirectReports -> {p_manager_user_id};
--    employeeService.getEmployeeByNumber -> {p_employee_number, p_tenant_id}).
--   Verified live before authoring: employee_directory view EXISTS (43 cols, all
--   referenced columns present); employee_profiles EXISTS (manager_id, user_id,
--   employee_number); profiles has tenant_id.
--
--   get_direct_reports is restored verbatim (its TABLE shape == the DirectReport TS
--   type). get_employee_by_number is restored returning SETOF employee_directory so
--   its result matches the caller's declared EmployeeDirectoryEntry type (the old
--   6-column TABLE shape under-populated that interface — a latent type lie). Added
--   SET search_path = public on both (advisor hygiene; behavior-neutral, objects are
--   fully qualified).

BEGIN;

-- Direct reports for a manager (by the manager's USER id). Same-tenant only.
DROP FUNCTION IF EXISTS public.get_direct_reports(UUID);
CREATE FUNCTION public.get_direct_reports(p_manager_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  job_title TEXT,
  department_name TEXT,
  employment_status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant_id UUID;
  v_manager_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_caller_tenant_id
  FROM profiles WHERE user_id = auth.uid();

  SELECT ep.tenant_id INTO v_manager_tenant_id
  FROM employee_profiles ep WHERE ep.user_id = p_manager_user_id;

  -- Cross-tenant access blocked
  IF v_caller_tenant_id IS NULL OR v_manager_tenant_id IS NULL
     OR v_caller_tenant_id != v_manager_tenant_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ed.user_id, ed.full_name, ed.job_title, ed.department_name, ed.employment_status
  FROM employee_directory ed
  WHERE ed.manager_id = (SELECT id FROM employee_profiles WHERE user_id = p_manager_user_id)
    AND ed.tenant_id = v_caller_tenant_id;
END;
$$;

-- Employee directory entry by badge number, scoped to the caller's tenant.
-- Returns the full employee_directory row (== EmployeeDirectoryEntry).
DROP FUNCTION IF EXISTS public.get_employee_by_number(TEXT, UUID);
CREATE FUNCTION public.get_employee_by_number(p_employee_number TEXT, p_tenant_id UUID)
RETURNS SETOF public.employee_directory
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_caller_tenant_id
  FROM profiles WHERE user_id = auth.uid();

  -- Caller may only query their own tenant
  IF v_caller_tenant_id IS NULL OR v_caller_tenant_id != p_tenant_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ed.* FROM public.employee_directory ed
  WHERE ed.employee_number = p_employee_number
    AND ed.tenant_id = p_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_direct_reports(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_by_number(TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.get_direct_reports(UUID) IS 'Direct reports for a manager (by user id). SECURITY INVOKER, same-tenant enforced.';
COMMENT ON FUNCTION public.get_employee_by_number(TEXT, UUID) IS 'Employee directory entry by badge number. SECURITY INVOKER, caller-tenant enforced. Returns SETOF employee_directory (EmployeeDirectoryEntry).';

COMMIT;
