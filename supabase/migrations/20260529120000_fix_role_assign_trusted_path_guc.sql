-- ============================================================================
-- SECURITY FIX: replace broken current_user trusted-path bypass with a GUC
-- ============================================================================
--
-- Migration 20260529110000 tried to let admin_assign_role's UPDATE through the
-- profiles_restrict_user_update trigger by bypassing when
--   current_user NOT IN ('authenticated','anon').
-- That is BROKEN and DANGEROUS: profiles_restrict_user_update is itself
-- SECURITY DEFINER (owner postgres), so INSIDE the trigger current_user is
-- ALWAYS 'postgres' -- never the client role. The bypass therefore fired on
-- EVERY update, including a direct client self-update, re-opening the role_id
-- self-escalation hole (verified: a self role_id change was no longer blocked).
--
-- FIX: use a transaction-local GUC handshake. admin_assign_role sets
-- app.role_assignment_ctx = '1' immediately before its UPDATE; the trigger
-- bypasses ONLY when that GUC is set. A browser/PostgREST client cannot set a
-- GUC (no arbitrary SQL/SET over REST) and the only function that sets it
-- (admin_assign_role) performs its own admin/super_admin/tenant/no-self-assign
-- authorization first. The GUC is is_local=true so it never leaks across
-- transactions (safe under transaction pooling). Direct client updates never
-- set it and remain fully gated -> the self-escalation hole stays closed.
-- ============================================================================

BEGIN;

-- 1. Trigger: bypass only on the GUC handshake -------------------------------
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

  -- Trusted server-side write path: admin_assign_role() sets this transaction-
  -- local GUC right before its UPDATE. It cannot be set by a PostgREST client
  -- and is only set by a function that has already authorized the caller.
  IF current_setting('app.role_assignment_ctx', true) = '1' THEN
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
    -- SECURITY: block ALL self role changes. role_id is the RLS-enforced column.
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

-- 2. admin_assign_role: set the GUC right before the UPDATE ------------------
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

  -- Open the trusted-path handshake for the trigger, then close it immediately.
  PERFORM set_config('app.role_assignment_ctx', '1', true);

  UPDATE public.profiles
  SET role_id = v_role_id,
      role = p_role_name,
      role_code = p_role_code,
      department = COALESCE(p_department, department)
  WHERE user_id = p_target_user_id;

  PERFORM set_config('app.role_assignment_ctx', '0', true);

  RETURN jsonb_build_object(
    'target_user_id', p_target_user_id,
    'role', p_role_name,
    'role_id', v_role_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_assign_role(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_role(UUID, TEXT, INTEGER, TEXT) TO authenticated;

COMMIT;
