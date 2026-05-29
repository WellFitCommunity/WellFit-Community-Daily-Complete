-- ============================================================================
-- SECURITY FIX: self-escalation via profiles.role_id + admin role-assign RPC
-- ============================================================================
--
-- VULNERABILITY (found 2026-05-28): the profiles UPDATE RLS policy is own-row
-- with no column lock (USING user_id = auth.uid(), no WITH CHECK), and the
-- guard trigger profiles_restrict_user_update only blocked self-setting
-- role_code (the legacy column) and is_admin. It NEVER checked role_id — the
-- column the RLS policies across the app actually enforce on. So a logged-in
-- user could UPDATE their own profile SET role_id = 2 (super_admin), pass all
-- guards, and RLS would treat them as super_admin. Full self-promotion.
--
-- FIX:
--   1. Harden profiles_restrict_user_update so a non-root user cannot change
--      their OWN role_id / role / role_code (role changes are admin-only).
--   2. Add admin_assign_role(): a SECURITY DEFINER RPC that lets a verified
--      admin assign a role to ANOTHER user (definer bypasses the own-row RLS
--      policy, so we can keep that policy locked down). Only super_admin may
--      grant admin/super_admin; same-tenant only; no self-assign.
--   3. Backfill profiles.role (text) from role_id so the app-layer resolver
--      and the DB RLS agree (role_id is the single source of truth).
-- ============================================================================

BEGIN;

-- 1. Hardened self-update guard ---------------------------------------------
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

-- 2. Admin role-assignment RPC ----------------------------------------------
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
  'Admin-only role assignment. Verifies caller is admin/super_admin (super_admin required for admin roles), same-tenant, no self-assign. Writes target role_id/role/role_code; trg_sync_user_roles then syncs user_roles. SECURITY DEFINER, locked search_path. Closes the gap where the own-row profiles policy had no admin write path.';

-- 3. Backfill profiles.role (text) from the source-of-truth role_id ----------
-- Guard escape: SET LOCAL request.jwt.claims so profiles_restrict_user_update
-- permits this maintenance UPDATE (no auth.uid() in a migration context).
SET LOCAL "request.jwt.claims" = '{"role":"service_role"}';

UPDATE public.profiles p
SET role = r.name
FROM public.roles r
WHERE r.id = p.role_id
  AND (p.role IS NULL OR p.role <> r.name);

COMMIT;
