-- Migration: Enable MFA Enrollment for Admin/Clinical Roles
-- Date: 2026-02-09
-- Purpose: Create mfa_enrollment table, RPC functions, and compliance view
-- Authority: user_roles table (per CLAUDE.md governance)

-- ============================================================================
-- 0. DROP STALE TABLE (pre-existing with wrong schema — missing enforcement_status)
-- ============================================================================
DROP TABLE IF EXISTS public.mfa_enrollment CASCADE;

-- ============================================================================
-- 1. MFA ENROLLMENT TABLE
-- ============================================================================
CREATE TABLE public.mfa_enrollment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  mfa_method TEXT CHECK (mfa_method IN ('totp', 'sms', 'email', NULL)),
  totp_secret TEXT,
  totp_backup_codes TEXT[],
  enrollment_date TIMESTAMPTZ,
  last_verified TIMESTAMPTZ,
  grace_period_ends TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  enforcement_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (enforcement_status IN ('pending', 'grace_period', 'enforced', 'exempt')),
  exemption_reason TEXT,
  exemption_approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mfa_enrollment_user_unique UNIQUE (user_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_mfa_enrollment_user_id ON public.mfa_enrollment(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_enrollment_status ON public.mfa_enrollment(enforcement_status);
CREATE INDEX IF NOT EXISTS idx_mfa_enrollment_grace ON public.mfa_enrollment(grace_period_ends)
  WHERE enforcement_status IN ('pending', 'grace_period');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.mfa_enrollment_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mfa_enrollment_updated ON public.mfa_enrollment;
CREATE TRIGGER trg_mfa_enrollment_updated
  BEFORE UPDATE ON public.mfa_enrollment
  FOR EACH ROW EXECUTE FUNCTION public.mfa_enrollment_updated_at();

-- ============================================================================
-- 2. ROW-LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.mfa_enrollment ENABLE ROW LEVEL SECURITY;

-- Users can view their own enrollment
DROP POLICY IF EXISTS "Users view own MFA enrollment" ON public.mfa_enrollment;
CREATE POLICY "Users view own MFA enrollment"
  ON public.mfa_enrollment
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own enrollment (for TOTP setup)
DROP POLICY IF EXISTS "Users update own MFA enrollment" ON public.mfa_enrollment;
CREATE POLICY "Users update own MFA enrollment"
  ON public.mfa_enrollment
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all enrollments in their tenant
DROP POLICY IF EXISTS "Admins view all MFA enrollments" ON public.mfa_enrollment;
CREATE POLICY "Admins view all MFA enrollments"
  ON public.mfa_enrollment
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin', 'it_admin')
    )
  );

-- Admins can update enrollments (for exemptions, grace period extensions)
DROP POLICY IF EXISTS "Admins update MFA enrollments" ON public.mfa_enrollment;
CREATE POLICY "Admins update MFA enrollments"
  ON public.mfa_enrollment
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin', 'it_admin')
    )
  );

-- Service role can insert (for seeding and edge functions)
DROP POLICY IF EXISTS "Service role insert MFA enrollment" ON public.mfa_enrollment;
CREATE POLICY "Service role insert MFA enrollment"
  ON public.mfa_enrollment
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 3. ROLES REQUIRING MFA (constant list)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mfa_required_roles()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'super_admin', 'admin', 'it_admin', 'department_head',
    'nurse', 'physician', 'doctor',
    'nurse_practitioner', 'physician_assistant', 'clinical_supervisor',
    'case_manager', 'social_worker', 'community_health_worker', 'chw',
    'physical_therapist', 'pt', 'pharmacist', 'radiologist', 'lab_tech',
    'quality_manager', 'billing_specialist'
  ]::TEXT[];
$$;

-- ============================================================================
-- 4. CHECK IF MFA IS REQUIRED FOR A USER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_mfa_required(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_required_roles TEXT[] := public.mfa_required_roles();
BEGIN
  -- Priority 1: Check user_roles table (authoritative)
  FOR v_role IN
    SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p_user_id
  LOOP
    IF v_role = ANY(v_required_roles) THEN
      RETURN true;
    END IF;
  END LOOP;

  -- Priority 2: Check profiles.role (legacy fallback)
  SELECT p.role INTO v_role
    FROM public.profiles p
    WHERE p.user_id = p_user_id;

  IF v_role IS NOT NULL AND v_role = ANY(v_required_roles) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ============================================================================
-- 5. GET MFA ENROLLMENT STATUS (main RPC for frontend)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_mfa_enrollment_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mfa_required BOOLEAN;
  v_enrollment RECORD;
  v_role TEXT;
  v_days_remaining INTEGER;
BEGIN
  -- Check if MFA is required for this user
  v_mfa_required := public.check_mfa_required(p_user_id);

  -- Get primary role from user_roles (authoritative)
  SELECT ur.role INTO v_role
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
    ORDER BY ur.created_at ASC
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
$$;

-- ============================================================================
-- 6. LOG MFA VERIFICATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_mfa_verification(
  p_user_id UUID,
  p_success BOOLEAN,
  p_method TEXT DEFAULT 'totp'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update last_verified on success
  IF p_success THEN
    UPDATE public.mfa_enrollment
      SET last_verified = NOW()
      WHERE user_id = p_user_id;
  END IF;

  -- Write to audit_logs (not security_events per plan)
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    p_user_id,
    CASE WHEN p_success THEN 'MFA_VERIFICATION_SUCCESS' ELSE 'MFA_VERIFICATION_FAILED' END,
    'mfa_enrollment',
    p_user_id::TEXT,
    jsonb_build_object(
      'method', p_method,
      'success', p_success,
      'timestamp', NOW()
    )
  );
END;
$$;

-- ============================================================================
-- 7. GRANT MFA EXEMPTION (super admin only)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.grant_mfa_exemption(
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Verify caller is super_admin or admin via user_roles
  SELECT ur.role INTO v_caller_role
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin', 'admin')
    LIMIT 1;

  IF v_caller_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admins can grant MFA exemptions');
  END IF;

  -- Upsert exemption
  INSERT INTO public.mfa_enrollment (user_id, role, enforcement_status, exemption_reason, exemption_approved_by)
  VALUES (
    p_user_id,
    COALESCE(
      (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p_user_id ORDER BY ur.created_at ASC LIMIT 1),
      'unknown'
    ),
    'exempt',
    p_reason,
    auth.uid()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    enforcement_status = 'exempt',
    exemption_reason = EXCLUDED.exemption_reason,
    exemption_approved_by = EXCLUDED.exemption_approved_by,
    updated_at = NOW();

  -- Audit log
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    auth.uid(),
    'MFA_EXEMPTION_GRANTED',
    'mfa_enrollment',
    p_user_id::TEXT,
    jsonb_build_object(
      'target_user_id', p_user_id,
      'reason', p_reason,
      'granted_by', auth.uid()
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- 8. MFA COMPLIANCE REPORT VIEW
-- ============================================================================
CREATE OR REPLACE VIEW public.mfa_compliance_report
WITH (security_invoker = on)
AS
SELECT
  ur.role,
  COUNT(DISTINCT ur.user_id) AS total_users,
  COUNT(DISTINCT CASE WHEN me.mfa_enabled = true THEN ur.user_id END) AS mfa_enabled_count,
  COUNT(DISTINCT CASE WHEN me.mfa_enabled IS NOT true AND me.enforcement_status != 'exempt' THEN ur.user_id END) AS non_compliant_count,
  COUNT(DISTINCT CASE WHEN me.enforcement_status = 'exempt' THEN ur.user_id END) AS exempt_count,
  CASE
    WHEN COUNT(DISTINCT ur.user_id) > 0
    THEN ROUND(
      100.0 * (
        COUNT(DISTINCT CASE WHEN me.mfa_enabled = true THEN ur.user_id END) +
        COUNT(DISTINCT CASE WHEN me.enforcement_status = 'exempt' THEN ur.user_id END)
      ) / COUNT(DISTINCT ur.user_id),
      1
    )
    ELSE 100.0
  END AS compliance_pct
FROM public.user_roles ur
LEFT JOIN public.mfa_enrollment me ON me.user_id = ur.user_id
WHERE ur.role = ANY(public.mfa_required_roles())
GROUP BY ur.role
ORDER BY ur.role;

-- ============================================================================
-- 9. SEED EXISTING ADMIN/CLINICAL USERS WITH GRACE PERIOD
-- ============================================================================
INSERT INTO public.mfa_enrollment (user_id, role, enforcement_status, grace_period_ends)
SELECT
  ur.user_id,
  ur.role,
  'grace_period',
  NOW() + INTERVAL '7 days'
FROM public.user_roles ur
WHERE ur.role = ANY(public.mfa_required_roles())
  AND NOT EXISTS (
    SELECT 1 FROM public.mfa_enrollment me WHERE me.user_id = ur.user_id
  )
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON public.mfa_enrollment TO authenticated;
GRANT SELECT ON public.mfa_compliance_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_mfa_required(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mfa_enrollment_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_mfa_verification(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_mfa_exemption(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_required_roles() TO authenticated;
