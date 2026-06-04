-- Fix: ambiguous column references in the restored employee directory RPCs.
--
-- 20260604000002 restored get_direct_reports / get_employee_by_number verbatim from
-- the historical 20251201110002 version, which carried a latent bug exposed on live
-- execution: the RETURNS TABLE / SETOF OUT columns (user_id, tenant_id, ...) collide
-- with the unqualified column references inside `SELECT tenant_id FROM profiles WHERE
-- user_id = auth.uid()` →  ERROR 42702 "column reference \"user_id\" is ambiguous".
-- (The historical version had the same bug; it was dropped before it ever ran here.)
--
-- Fix: fully qualify every internal column reference with a table alias, and resolve
-- the manager's employee_profiles.id into a local variable. Behavior is otherwise
-- identical (SECURITY INVOKER, same-tenant enforcement, same return shapes).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_direct_reports(p_manager_user_id UUID)
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
  v_manager_profile_id UUID;
BEGIN
  SELECT p.tenant_id INTO v_caller_tenant_id
  FROM profiles p WHERE p.user_id = auth.uid();

  SELECT ep.tenant_id, ep.id INTO v_manager_tenant_id, v_manager_profile_id
  FROM employee_profiles ep WHERE ep.user_id = p_manager_user_id;

  -- Cross-tenant access blocked
  IF v_caller_tenant_id IS NULL OR v_manager_tenant_id IS NULL
     OR v_caller_tenant_id != v_manager_tenant_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ed.user_id, ed.full_name, ed.job_title, ed.department_name, ed.employment_status
  FROM employee_directory ed
  WHERE ed.manager_id = v_manager_profile_id
    AND ed.tenant_id = v_caller_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_employee_by_number(p_employee_number TEXT, p_tenant_id UUID)
RETURNS SETOF public.employee_directory
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant_id UUID;
BEGIN
  SELECT p.tenant_id INTO v_caller_tenant_id
  FROM profiles p WHERE p.user_id = auth.uid();

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

COMMIT;
