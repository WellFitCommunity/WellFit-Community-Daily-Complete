-- Fix get_mfa_enrollment_status: it ordered user_roles by ur.created_at, which does NOT exist on
-- user_roles (columns: user_id, role_id, role, tenant_id, department). Every call raised
-- "column ur.created_at does not exist" -> PostgREST 400, breaking the login MFA-status check.
-- Fix: order by ur.role_id (exists, deterministic). Only the ORDER BY clause changes.

CREATE OR REPLACE FUNCTION public.get_mfa_enrollment_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mfa_required BOOLEAN;
  v_enrollment RECORD;
  v_role TEXT;
  v_days_remaining INTEGER;
BEGIN
  -- Check if MFA is required for this user
  v_mfa_required := public.check_mfa_required(p_user_id);

  -- Get primary role from user_roles (authoritative). user_roles has no created_at column,
  -- so order deterministically by role_id.
  SELECT ur.role INTO v_role
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
    ORDER BY ur.role_id ASC
    LIMIT 1;

  -- Fallback to profiles.role
  IF v_role IS NULL THEN
    SELECT p.role INTO v_role
      FROM public.profiles p
      WHERE p.user_id = p_user_id;
  END IF;

  -- Get enrollment record
  SELECT * INTO v_enrollment
    FROM public.mfa_enrollment me
    WHERE me.user_id = p_user_id;

  -- If no enrollment exists but MFA is required, return pending status
  IF v_enrollment IS NULL AND v_mfa_required THEN
    RETURN jsonb_build_object(
      'mfa_required', true,
      'mfa_enabled', false,
      'enrollment_exists', false,
      'enforcement_status', 'pending',
      'grace_period_ends', NULL,
      'days_remaining', 0,
      'role', COALESCE(v_role, 'unknown'),
      'mfa_method', NULL
    );
  END IF;

  -- If no enrollment and not required
  IF v_enrollment IS NULL THEN
    RETURN jsonb_build_object(
      'mfa_required', false,
      'mfa_enabled', false,
      'enrollment_exists', false,
      'enforcement_status', 'exempt',
      'grace_period_ends', NULL,
      'days_remaining', NULL,
      'role', COALESCE(v_role, 'unknown'),
      'mfa_method', NULL
    );
  END IF;

  -- Calculate days remaining in grace period
  IF v_enrollment.grace_period_ends IS NOT NULL THEN
    v_days_remaining := GREATEST(0,
      EXTRACT(DAY FROM (v_enrollment.grace_period_ends - NOW()))::INTEGER
    );
  ELSE
    v_days_remaining := 0;
  END IF;

  RETURN jsonb_build_object(
    'mfa_required', v_mfa_required,
    'mfa_enabled', COALESCE(v_enrollment.mfa_enabled, false),
    'enrollment_exists', true,
    'enforcement_status', v_enrollment.enforcement_status,
    'grace_period_ends', v_enrollment.grace_period_ends,
    'days_remaining', v_days_remaining,
    'role', COALESCE(v_role, 'unknown'),
    'mfa_method', v_enrollment.mfa_method,
    'last_verified', v_enrollment.last_verified,
    'exemption_reason', v_enrollment.exemption_reason
  );
END;
$function$;
