-- ============================================================================
-- Emergency Access ("Break-the-Glass") Logging — ONC 170.315 (d)(6)
-- ============================================================================
--
-- ONC certification criterion (d)(6) requires the technology to permit an
-- identified, authenticated user to access a patient's electronic health
-- information during an emergency, and to record that access. This is the
-- classic "break-the-glass" pattern: a clinician who does not normally have
-- access to a given patient's record may grant themselves time-limited
-- access by recording a justification, and that grant is audited and a
-- supervisor is notified.
--
-- Design mirrors the proven `handoff_emergency_bypasses` pattern
-- (20260527025534) — the most recent, house-standard break-the-glass shape
-- in this codebase:
--   - Dedicated append-only audit table; one row per grant event.
--   - NO direct INSERT path — only the SECURITY DEFINER RPC may write.
--   - Rule 8: nurse/patient lookups use `profiles.user_id` (NOT profiles.id).
--   - Server-side client IP capture from request headers (no client claim).
--   - SECURITY DEFINER with `SET search_path = public` (RPC-SEARCH-PATH-1).
--   - EXECUTE granted only to `authenticated`; REVOKED from anon/public.
--   - RLS: accessor reads own rows; tenant admins/care_managers/
--     department_heads read all in their tenant; super_admin reads all.
--
-- POLICY DEFAULTS (Maria/Akima own these — set here, overridable):
--   - Access duration: 60 minutes, then the grant lapses (expires_at). The
--     grant RPC takes p_duration_minutes (default 60) so policy can tune it
--     per-call without a schema change.
--   - Supervisor notification: fires on EVERY grant (emergency PHI access is
--     higher-stakes than a handoff bypass, so no threshold). The RPC returns
--     should_notify_supervisor = TRUE; the service layer dispatches the
--     send-email notification to tenant admins.
-- ============================================================================

BEGIN;

-- 1. Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  accessing_user_id UUID NOT NULL REFERENCES auth.users(id),
  accessing_user_name TEXT NOT NULL,        -- looked up server-side (profiles)
  patient_id UUID NOT NULL REFERENCES auth.users(id),
  patient_name TEXT NOT NULL,               -- looked up server-side (profiles)
  access_reason TEXT NOT NULL,              -- mandatory justification
  access_explanation TEXT,                  -- optional free-text detail
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,          -- granted_at + duration (default 60m)
  revoked_at TIMESTAMPTZ,                    -- set if access ended early
  revoked_by UUID REFERENCES auth.users(id),
  ip_address INET,                          -- captured server-side (headers)
  user_agent TEXT,
  supervisors_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emergency_access_log_accessor
  ON public.emergency_access_log (accessing_user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_access_log_patient
  ON public.emergency_access_log (patient_id);
CREATE INDEX IF NOT EXISTS idx_emergency_access_log_tenant
  ON public.emergency_access_log (tenant_id);
-- Partial index for the hot "is there an active grant right now?" check.
CREATE INDEX IF NOT EXISTS idx_emergency_access_log_active
  ON public.emergency_access_log (patient_id, accessing_user_id, expires_at)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.emergency_access_log IS
  'ONC (d)(6) break-the-glass audit log. One row per emergency-access grant to a patient record. Append-only via grant_emergency_access(); revocation via revoke_emergency_access(). RLS-restricted to the accessor, tenant admins, and super_admin.';

-- 2. RLS — read-only policies; all writes go through the RPCs below ----------
ALTER TABLE public.emergency_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emergency_access_log_accessor_self_select"
  ON public.emergency_access_log
  FOR SELECT
  TO authenticated
  USING (accessing_user_id = auth.uid());

CREATE POLICY "emergency_access_log_tenant_admin_select"
  ON public.emergency_access_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.user_id = auth.uid()
        AND r.name = 'admin'
        AND p.tenant_id = emergency_access_log.tenant_id
    )
  );

CREATE POLICY "emergency_access_log_super_admin_select"
  ON public.emergency_access_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.user_id = auth.uid()
        AND r.name = 'super_admin'
    )
  );

-- 3. Grant RPC — the ONLY write path. SECURITY DEFINER + locked search_path --
CREATE OR REPLACE FUNCTION public.grant_emergency_access(
  p_patient_id UUID,
  p_access_reason TEXT,
  p_access_explanation TEXT DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 60,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_user_name TEXT;
  v_patient_name TEXT;
  v_patient_tenant UUID;
  v_duration INTEGER;
  v_ip_address INET;
  v_headers_raw TEXT;
  v_xff TEXT;
  v_cf TEXT;
  v_expires_at TIMESTAMPTZ;
  v_access_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: grant_emergency_access requires a signed-in user';
  END IF;

  IF p_access_reason IS NULL OR TRIM(p_access_reason) = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED: emergency access requires a justification';
  END IF;

  -- Authorization floor: break-the-glass is a clinical/staff action. Block
  -- the clearly non-clinical role classes outright. We use a DENYLIST (not an
  -- allowlist) on purpose: the dangerous failure mode here is blocking a
  -- legitimate clinician during an emergency, so any staff/clinical role may
  -- proceed and the grant is fully audited + supervisor-notified regardless.
  -- (Clinical-policy knob — Maria/Akima may tighten this list.)
  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.user_id = v_user_id
      AND r.name IN ('patient', 'senior', 'caregiver', 'volunteer', 'user')
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: emergency access is restricted to clinical/staff roles';
  END IF;

  -- Clamp duration to a sane window: 5 minutes .. 8 hours. Default 60.
  v_duration := COALESCE(p_duration_minutes, 60);
  IF v_duration < 5 THEN v_duration := 5; END IF;
  IF v_duration > 480 THEN v_duration := 480; END IF;

  -- Rule 8: profiles.user_id (NOT profiles.id)
  SELECT
    COALESCE(NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''), 'Unknown User'),
    tenant_id
  INTO v_user_name, v_tenant_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'NO_TENANT: accessing user has no tenant_id on profile';
  END IF;

  -- Patient name + tenant (server-side; client never supplies the name).
  SELECT
    COALESCE(NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''), 'Unknown Patient'),
    tenant_id
  INTO v_patient_name, v_patient_tenant
  FROM public.profiles
  WHERE user_id = p_patient_id;

  IF v_patient_name IS NULL THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND: no profile for the supplied patient_id';
  END IF;

  -- Tenant isolation: break-the-glass stays within the accessor's tenant.
  IF v_patient_tenant IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'CROSS_TENANT_DENIED: emergency access cannot cross tenant boundaries';
  END IF;

  -- Server-side IP capture (best-effort; null outside an HTTP context).
  BEGIN
    v_headers_raw := current_setting('request.headers', true);
    IF v_headers_raw IS NOT NULL AND v_headers_raw <> '' THEN
      v_xff := (v_headers_raw::json)->>'x-forwarded-for';
      v_cf  := (v_headers_raw::json)->>'cf-connecting-ip';
      IF v_xff IS NOT NULL AND v_xff <> '' THEN
        v_ip_address := split_part(v_xff, ',', 1)::INET;
      ELSIF v_cf IS NOT NULL AND v_cf <> '' THEN
        v_ip_address := v_cf::INET;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip_address := NULL;
  END;

  v_expires_at := now() + (v_duration || ' minutes')::INTERVAL;

  INSERT INTO public.emergency_access_log (
    tenant_id, accessing_user_id, accessing_user_name,
    patient_id, patient_name,
    access_reason, access_explanation,
    granted_at, expires_at,
    ip_address, user_agent,
    supervisors_notified
  ) VALUES (
    v_tenant_id, v_user_id, v_user_name,
    p_patient_id, v_patient_name,
    p_access_reason, p_access_explanation,
    now(), v_expires_at,
    v_ip_address, p_user_agent,
    false  -- service layer flips this to true after send-email dispatch
  )
  RETURNING id INTO v_access_id;

  -- Supervisor notification fires on EVERY grant (policy: no threshold).
  RETURN jsonb_build_object(
    'access_id', v_access_id,
    'accessing_user_name', v_user_name,
    'patient_name', v_patient_name,
    'tenant_id', v_tenant_id,
    'granted_at', now(),
    'expires_at', v_expires_at,
    'duration_minutes', v_duration,
    'should_notify_supervisor', true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_emergency_access(UUID, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_emergency_access(UUID, TEXT, TEXT, INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION public.grant_emergency_access IS
  'ONC (d)(6) break-the-glass grant. Records a time-limited emergency-access event for the caller against a patient record (same tenant only). Looks up names + client IP server-side. Default 60-minute expiry (clamped 5m..8h). Returns access_id + expires_at + should_notify_supervisor=true. SECURITY DEFINER, locked search_path.';

-- 4. Revoke RPC — end a grant early (accessor or tenant admin) ----------------
CREATE OR REPLACE FUNCTION public.revoke_emergency_access(
  p_access_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_row_tenant UUID;
  v_row_accessor UUID;
  v_is_admin BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: revoke_emergency_access requires a signed-in user';
  END IF;

  SELECT tenant_id, accessing_user_id
  INTO v_row_tenant, v_row_accessor
  FROM public.emergency_access_log
  WHERE id = p_access_id;

  IF v_row_tenant IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: no emergency-access row for the supplied id';
  END IF;

  -- Caller may revoke if they are the accessor, or a tenant admin/super_admin.
  SELECT p.tenant_id,
         (r.name IN ('admin', 'super_admin'))
  INTO v_tenant_id, v_is_admin
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.role_id
  WHERE p.user_id = v_user_id;

  IF NOT (
    v_row_accessor = v_user_id
    OR (COALESCE(v_is_admin, false) AND v_tenant_id = v_row_tenant)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: only the accessor or a tenant admin may revoke this grant';
  END IF;

  UPDATE public.emergency_access_log
  SET revoked_at = COALESCE(revoked_at, now()),
      revoked_by = CASE WHEN revoked_at IS NULL THEN v_user_id ELSE revoked_by END
  WHERE id = p_access_id;

  RETURN jsonb_build_object('access_id', p_access_id, 'revoked', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_emergency_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_emergency_access(UUID) TO authenticated;

COMMENT ON FUNCTION public.revoke_emergency_access IS
  'Ends an emergency-access grant early. Permitted for the original accessor or a tenant admin/super_admin. Idempotent (keeps the first revocation). SECURITY DEFINER, locked search_path.';

-- 5. Active-access check — boolean gate for "does this user currently hold
--    break-the-glass access to this patient?" Used by the UI/service to show
--    the access banner and (later) to widen record visibility. -------------
CREATE OR REPLACE FUNCTION public.has_active_emergency_access(
  p_patient_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.emergency_access_log
    WHERE patient_id = p_patient_id
      AND accessing_user_id = COALESCE(p_user_id, auth.uid())
      AND revoked_at IS NULL
      AND expires_at > now()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_active_emergency_access(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_emergency_access(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.has_active_emergency_access IS
  'Returns TRUE if the given user (default: caller) currently holds an unrevoked, unexpired emergency-access grant to the patient. SECURITY DEFINER, locked search_path.';

COMMIT;
