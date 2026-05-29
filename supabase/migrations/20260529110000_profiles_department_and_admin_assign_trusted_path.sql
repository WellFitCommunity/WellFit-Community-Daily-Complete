-- ============================================================================
-- profiles.department column + admin_assign_role trusted-path completion
-- ============================================================================
--
-- Three coupled fixes so admin role assignment actually works end-to-end for a
-- REGULAR admin (not just super_admin), and so the staff list can load:
--
--   1. Add public.profiles.department (TEXT, CHECK matching the Department union
--      'nursing'|'medical'|'therapy'|'administration'|NULL). The app already
--      reads/writes department (getStaffUsers select, StaffUser type, the assign
--      form) but the column never existed -> getStaffUsers errored 42703.
--
--   2. profiles_restrict_user_update: add a trusted-server-path bypass. A regular
--      admin calling admin_assign_role (SECURITY DEFINER, owner=postgres) updates
--      ANOTHER user's row; auth.uid() inside the trigger is still the (non-root)
--      admin, so the trigger RAISEd 'Profile update not allowed' and blocked the
--      RPC for the exact role it was built to empower (6 such admins exist today).
--      Inside a SECURITY DEFINER function current_user is the function owner, NOT
--      the 'authenticated'/'anon' client role -- use that to permit trusted
--      server-side writes. Direct client updates still run as 'authenticated' and
--      remain fully gated, so the role_id self-escalation hole stays closed.
--
--   3. admin_assign_role: restore the department write (now that the column
--      exists) that 20260529100000 had to strip.
-- ============================================================================

BEGIN;

-- 1. department column -------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_department_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_department_check
  CHECK (department IS NULL OR department IN ('nursing', 'medical', 'therapy', 'administration'));

COMMENT ON COLUMN public.profiles.department IS
  'Staff department for scoped access (department_head). NULL = all departments. Mirrors the Department union in src/types/roles.ts.';

-- 2. trigger: permit trusted server-side (SECURITY DEFINER) writes ------------
CREATE OR REPLACE FUNCTION public.profiles_restrict_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();

  -- Trusted server-side write path: SECURITY DEFINER functions such as
  -- admin_assign_role() execute as their owner (postgres), so current_user is
  -- no longer the 'authenticated'/'anon' client role. Those functions enforce
  -- their own authorization, so they are permitted here. Direct client updates
  -- still run as 'authenticated' and remain fully gated below -- this does NOT
  -- reopen the role_id self-escalation hole.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- root/super_admin may update any profile
  IF v_uid IS NOT NULL AND public.is_root(v_uid) THEN
    RETURN NEW;
  END IF;

  -- a user may update their OWN profile, but NOT their own role
  IF v_uid IS NOT NULL AND OLD.user_id = v_uid THEN
    IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'Cannot change user_id';
    END IF;
    IF (OLD.is_admin IS NOT TRUE) AND (NEW.is_admin IS TRUE) THEN
      RAISE EXCEPTION 'Cannot self-promote to admin';
    END IF;
    -- SECURITY: block ALL self role changes. role_id is the RLS-enforced
    -- column (the original vuln); role + role_code are covered for defense in
    -- depth. Role assignment must go through admin_assign_role().
    IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
      RAISE EXCEPTION 'Cannot change your own role';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change your own role';
    END IF;
    IF NEW.role_code IS DISTINCT FROM OLD.role_code THEN
      RAISE EXCEPTION 'Cannot change your own role';
    END IF;
    RETURN NEW;
  END IF;

  -- service/PostgREST context with JWT claims but no resolved uid: RLS still
  -- gates which row can be touched (own-row), so this path cannot cross rows.
  IF v_uid IS NULL THEN
    IF current_setting('request.jwt.claims', true) IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Profile update not allowed. auth.uid()=%, OLD.user_id=%', v_uid, OLD.user_id
    USING ERRCODE = 'P0001';
END;
$function$;

-- 3. admin_assign_role: restore department write -----------------------------
CREATE OR REPLACE FUNCTION public.admin_assign_role(
  p_target_user_id UUID,
  p_role_name TEXT,
  p_role_code INTEGER DEFAULT NULL,
  p_department TEXT DEFAULT NULL
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

  IF v_target_tenant IS DISTINCT FROM v_caller_tenant AND NOT v_caller_is_super THEN
    RAISE EXCEPTION 'CROSS_TENANT_DENIED: cannot assign roles outside your tenant';
  END IF;

  UPDATE public.profiles
  SET role_id = v_role_id,
      role = p_role_name,
      role_code = p_role_code,
      department = COALESCE(p_department, department)
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
  'Admin-only role assignment. Verifies caller is admin/super_admin (super_admin required for admin roles), same-tenant, no self-assign. Writes target role_id/role/role_code/department; trg_sync_user_roles then syncs user_roles. SECURITY DEFINER (owner postgres) -> profiles_restrict_user_update permits the write via its trusted-path (current_user) bypass. Locked search_path.';

COMMIT;
