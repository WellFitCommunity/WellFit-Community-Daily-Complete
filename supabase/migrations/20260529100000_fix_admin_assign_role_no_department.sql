-- ============================================================================
-- FIX: admin_assign_role referenced profiles.department, which does not exist
-- ============================================================================
--
-- The admin_assign_role RPC (migration 20260528160000) wrote
--   department = COALESCE(p_department, department)
-- but public.profiles has NO department column (columns are role, role_code,
-- role_id, tenant_id, user_id, ...). Every call therefore failed at runtime
-- with: ERROR 42703 column "department" does not exist. This was caught by a
-- live rolled-back call to the RPC (2026-05-29) — mocks could not catch it.
--
-- FIX: drop the department write from the UPDATE. The p_department parameter is
-- kept in the signature for API compatibility with userRoleManagementService
-- (which passes it), but is NOT persisted here because profiles cannot store it.
-- If staff department persistence is needed later, add the column (or a join
-- table) first, then reinstate the write.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_assign_role(
  p_target_user_id UUID,
  p_role_name TEXT,
  p_role_code INTEGER DEFAULT NULL,
  p_department TEXT DEFAULT NULL  -- accepted for API compatibility; not persisted (no profiles.department column)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_caller_tenant UUID;
  v_caller_is_admin BOOLEAN;
  v_caller_is_super BOOLEAN;
  v_target_tenant UUID;
  v_role_id INTEGER;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: admin_assign_role requires a signed-in user';
  END IF;

  IF p_target_user_id = v_caller THEN
    RAISE EXCEPTION 'CANNOT_SELF_ASSIGN: a different admin must change your role';
  END IF;

  SELECT tenant_id INTO v_caller_tenant FROM public.profiles WHERE user_id = v_caller;
  IF v_caller_tenant IS NULL THEN
    RAISE EXCEPTION 'NO_TENANT: caller has no tenant';
  END IF;

  -- Caller authority: admin/super_admin via profiles OR user_roles.
  v_caller_is_super :=
    EXISTS (SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
            WHERE p.user_id = v_caller AND r.name = 'super_admin')
    OR EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
               WHERE ur.user_id = v_caller AND r.name = 'super_admin');

  v_caller_is_admin := v_caller_is_super
    OR EXISTS (SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
               WHERE p.user_id = v_caller AND r.name = 'admin')
    OR EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
               WHERE ur.user_id = v_caller AND r.name = 'admin');

  IF NOT v_caller_is_admin THEN
    RAISE EXCEPTION 'FORBIDDEN: only admins may assign roles';
  END IF;

  -- Only super_admin may grant the elevated roles.
  IF p_role_name IN ('admin', 'super_admin') AND NOT v_caller_is_super THEN
    RAISE EXCEPTION 'FORBIDDEN: only super_admin may assign admin roles';
  END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE name = p_role_name;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'UNKNOWN_ROLE: % is not registered in the roles table', p_role_name;
  END IF;

  SELECT tenant_id INTO v_target_tenant FROM public.profiles WHERE user_id = p_target_user_id;
  IF v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'TARGET_NOT_FOUND: no profile for the target user';
  END IF;

  -- Same-tenant only (super_admin may cross tenants).
  IF v_target_tenant IS DISTINCT FROM v_caller_tenant AND NOT v_caller_is_super THEN
    RAISE EXCEPTION 'CROSS_TENANT_DENIED: cannot assign roles outside your tenant';
  END IF;

  UPDATE public.profiles
  SET role_id = v_role_id,
      role = p_role_name,
      role_code = p_role_code
  WHERE user_id = p_target_user_id;

  RETURN jsonb_build_object(
    'target_user_id', p_target_user_id,
    'role', p_role_name,
    'role_id', v_role_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_assign_role(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_role(UUID, TEXT, INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION public.admin_assign_role IS
  'Admin-only role assignment. Verifies caller is admin/super_admin (super_admin required for admin roles), same-tenant, no self-assign. Writes target role_id/role/role_code; trg_sync_user_roles then syncs user_roles. p_department is accepted for API compatibility but NOT persisted (public.profiles has no department column). SECURITY DEFINER, locked search_path.';

COMMIT;
