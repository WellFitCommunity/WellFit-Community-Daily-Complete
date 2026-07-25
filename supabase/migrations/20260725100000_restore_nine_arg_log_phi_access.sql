-- ============================================================================
-- Restore the nine-argument log_phi_access RPC (HIPAA §164.312(b))
--
-- External audit finding 1 (Claude Cowork, 2026-07-25): the frontend PHI
-- access logging path (src/services/phiAccessLogger.ts + UsersList.tsx +
-- healthCheck.ts) calls log_phi_access with NINE named arguments, but the
-- only live definition takes FOUR (p_resource_type, p_resource_id, p_action,
-- p_metadata → writes to audit_logs). Every nine-arg call has resolved to
-- PostgREST PGRST202 (no matching function) since 20251222000000 — nothing
-- was written. The intended target table public.phi_access_log EXISTS live
-- with exactly the nine-arg column shape (13 cols, immutability triggers,
-- RLS, GRANTs) but has 0 rows ever.
--
-- This migration creates the nine-arg OVERLOAD writing to phi_access_log.
-- The four-arg version is kept untouched (usePhiAccessLogging hook and its
-- callers use it; it works). The archived _SKIP_20251019120000 definition was
-- used as reference only — this version adds identity enforcement, which the
-- archived one lacked (it trusted p_accessor_user_id from the client).
--
-- Security posture:
--   * SECURITY DEFINER + SET search_path (phi_access_log INSERT RLS only
--     admits providers/admins, but patients logging their own Cures Act
--     access must succeed too — the function, not the policy, is the gate).
--   * FAIL CLOSED: unauthenticated callers are rejected; a caller claiming
--     an accessor_user_id other than auth.uid() is rejected
--     ('[PHI_ACCESS_IDENTITY_MISMATCH]' — spoof-proof audit trail, per
--     .claude/rules/adversarial-audit-lessons.md §4).
--   * tenant_id resolved server-side via get_current_tenant_id().
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_phi_access(
  p_accessor_user_id UUID,
  p_accessor_role TEXT,
  p_phi_type TEXT,
  p_phi_resource_id TEXT,
  p_patient_id UUID,
  p_access_type TEXT,
  p_access_method TEXT DEFAULT 'UI',
  p_purpose TEXT DEFAULT 'treatment',
  p_ip_address TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_log_id UUID;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION '[PHI_ACCESS_LOG_DENIED] Authentication required to log PHI access';
  END IF;

  IF p_accessor_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION '[PHI_ACCESS_IDENTITY_MISMATCH] accessor_user_id must match the authenticated user';
  END IF;

  INSERT INTO public.phi_access_log (
    accessor_user_id,
    accessor_role,
    phi_type,
    phi_resource_id,
    patient_id,
    access_type,
    access_method,
    purpose,
    ip_address,
    user_agent,
    tenant_id
  ) VALUES (
    v_uid,
    p_accessor_role,
    p_phi_type,
    p_phi_resource_id,
    p_patient_id,
    p_access_type,
    p_access_method,
    p_purpose,
    COALESCE(
      p_ip_address,
      current_setting('request.headers', true)::json->>'x-forwarded-for'
    ),
    current_setting('request.headers', true)::json->>'user-agent',
    public.get_current_tenant_id()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_phi_access(UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_phi_access(UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_phi_access(UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_phi_access(UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.log_phi_access(UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) IS
  'HIPAA §164.312(b) — logs PHI access to phi_access_log. Identity-enforced (accessor must equal auth.uid()); fails closed for unauthenticated or spoofed callers. Nine-arg overload restored 2026-07-25 (audit finding 1); the four-arg overload (→ audit_logs) is separate and unchanged.';
