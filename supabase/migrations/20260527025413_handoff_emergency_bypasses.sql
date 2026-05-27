-- ============================================================================
-- Handoff Emergency Bypass Logging — rebuild (DRIFT-2-FIX, SH-3, SH-4)
-- ============================================================================
--
-- Background: an earlier migration (20251018120000_handoff_emergency_bypass)
-- created `log_handoff_override` against a table layout that has since been
-- repurposed: `shift_handoff_overrides` is now used for section-level
-- clinical-note overrides, NOT bypass-event logging. Migration
-- 20251209110000_drop_broken_functions dropped the old log_handoff_override
-- function. As a result, the client code in shiftHandoffService.ts called
-- a function that no longer existed — emergency bypass logging has been
-- non-functional in production since Dec 2025 (see tracker DRIFT-2).
--
-- Maria confirmed (2026-05-27) the feature is still wanted. This migration
-- rebuilds it cleanly with SH-3 and SH-4 improvements baked in:
--
--   - Dedicated `handoff_emergency_bypasses` table (no collision with the
--     section-overrides use of `shift_handoff_overrides`).
--   - SH-3: patient names are looked up SERVER-SIDE from `profiles` via the
--     caller-supplied `pending_patient_ids` array. The client no longer
--     passes names over the wire — PHI minimization.
--   - SH-4: client IP is read server-side from
--     `current_setting('request.headers')::json->>'x-forwarded-for'` (or
--     `cf-connecting-ip` as fallback). The client no longer claims an IP.
--   - Rule 8: `profiles.user_id` (NOT `profiles.id`) is used for the nurse
--     lookup. The pre-Dec function had this bug.
--   - SECURITY DEFINER with `SET search_path = public` (RPC-SEARCH-PATH-1).
--   - EXECUTE granted only to `authenticated`; REVOKED from `anon` and
--     `public`.
--   - RLS enabled on the table: nurses can read their own bypass rows,
--     admins/care_managers/department_heads/super_admins can read all
--     within their tenant, super_admin cross-tenant via a separate policy.
--   - No direct INSERT path — only the SECURITY DEFINER function can write.
--
-- The function returns the same JSONB shape the client already expects, so
-- the service-layer change is the parameter list (drop pendingPatientNames,
-- drop ip_address) but the return-handling code is unchanged.
-- ============================================================================

BEGIN;

-- 1. Table
CREATE TABLE IF NOT EXISTS public.handoff_emergency_bypasses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nurse_id UUID NOT NULL REFERENCES auth.users(id),
  nurse_name TEXT NOT NULL,
  nurse_email TEXT,
  shift_date DATE NOT NULL,
  shift_type TEXT NOT NULL,
  pending_count INTEGER NOT NULL DEFAULT 0,
  pending_patient_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Names looked up server-side by the RPC (SH-3); we still persist them so
  -- the manager-review dashboard can render the historic list without a
  -- per-row server roundtrip.
  pending_patient_names TEXT[] NOT NULL DEFAULT '{}'::text[],
  override_reason TEXT NOT NULL,
  override_explanation TEXT,
  nurse_signature TEXT,
  ip_address INET,  -- captured server-side from request headers (SH-4)
  user_agent TEXT,
  bypass_number_this_week INTEGER NOT NULL DEFAULT 1,
  weekly_bypass_count INTEGER NOT NULL DEFAULT 1,
  manager_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handoff_emergency_bypasses_nurse
  ON public.handoff_emergency_bypasses (nurse_id);
CREATE INDEX IF NOT EXISTS idx_handoff_emergency_bypasses_tenant
  ON public.handoff_emergency_bypasses (tenant_id);
CREATE INDEX IF NOT EXISTS idx_handoff_emergency_bypasses_date
  ON public.handoff_emergency_bypasses (shift_date DESC);

COMMENT ON TABLE public.handoff_emergency_bypasses IS
  'Append-only audit log of nurse-initiated emergency bypasses of the shift handoff workflow. One row per bypass event. RLS-restricted to the bypassing nurse, tenant admins, and super_admin.';

-- 2. RLS — RLS-restricted read; no direct INSERT (only via the function below)
ALTER TABLE public.handoff_emergency_bypasses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "handoff_emergency_bypasses_nurse_self_select"
  ON public.handoff_emergency_bypasses
  FOR SELECT
  TO authenticated
  USING (nurse_id = auth.uid());

CREATE POLICY "handoff_emergency_bypasses_tenant_admin_select"
  ON public.handoff_emergency_bypasses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.user_id = auth.uid()
        AND r.name IN ('admin', 'care_manager', 'department_head')
        AND p.tenant_id = handoff_emergency_bypasses.tenant_id
    )
  );

CREATE POLICY "handoff_emergency_bypasses_super_admin_select"
  ON public.handoff_emergency_bypasses
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

-- 3. The RPC. SECURITY DEFINER + SET search_path = public.
CREATE OR REPLACE FUNCTION public.log_handoff_override(
  p_shift_date DATE,
  p_shift_type TEXT,
  p_pending_count INTEGER,
  p_pending_patient_ids JSONB,
  p_override_reason TEXT,
  p_override_explanation TEXT,
  p_nurse_signature TEXT,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nurse_id UUID;
  v_tenant_id UUID;
  v_nurse_name TEXT;
  v_nurse_email TEXT;
  v_patient_names TEXT[];
  v_ip_address INET;
  v_headers_raw TEXT;
  v_xff TEXT;
  v_cf TEXT;
  v_weekly_count INTEGER;
  v_bypass_id UUID;
  v_should_notify BOOLEAN := FALSE;
BEGIN
  v_nurse_id := auth.uid();
  IF v_nurse_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: log_handoff_override requires a signed-in user';
  END IF;

  -- Rule 8: profiles.user_id (NOT profiles.id)
  SELECT
    COALESCE(NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''), 'Unknown Nurse'),
    NULL,  -- profiles has no email column in this schema; surfaced via auth.users separately if needed
    tenant_id
  INTO v_nurse_name, v_nurse_email, v_tenant_id
  FROM public.profiles
  WHERE user_id = v_nurse_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'NO_TENANT: nurse has no tenant_id on profile';
  END IF;

  -- SH-3: server-side name lookup from profiles via the supplied id array.
  -- jsonb_array_elements_text expands the JSONB array to one text row per id.
  -- LEFT JOIN preserves unknown ids as 'Unknown Patient' rather than dropping them.
  SELECT COALESCE(
    array_agg(
      COALESCE(
        NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
        'Unknown Patient'
      )
      ORDER BY pid_idx
    ),
    ARRAY[]::TEXT[]
  )
  INTO v_patient_names
  FROM jsonb_array_elements_text(p_pending_patient_ids) WITH ORDINALITY AS pid(id, pid_idx)
  LEFT JOIN public.profiles p ON p.user_id = pid.id::UUID;

  -- SH-4: server-side IP capture from request headers (best-effort; null if
  -- the function is called from a context without HTTP headers).
  BEGIN
    v_headers_raw := current_setting('request.headers', true);
    IF v_headers_raw IS NOT NULL AND v_headers_raw <> '' THEN
      v_xff := (v_headers_raw::json)->>'x-forwarded-for';
      v_cf  := (v_headers_raw::json)->>'cf-connecting-ip';
      -- x-forwarded-for can be a comma-separated chain; first hop is the client.
      IF v_xff IS NOT NULL AND v_xff <> '' THEN
        v_ip_address := split_part(v_xff, ',', 1)::INET;
      ELSIF v_cf IS NOT NULL AND v_cf <> '' THEN
        v_ip_address := v_cf::INET;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Malformed inet, missing setting, or invalid JSON: log to null and continue.
    v_ip_address := NULL;
  END;

  -- Weekly bypass count for this nurse.
  SELECT COUNT(*)
  INTO v_weekly_count
  FROM public.handoff_emergency_bypasses
  WHERE nurse_id = v_nurse_id
    AND created_at >= now() - INTERVAL '7 days';

  -- Notify the manager if this is the 3rd+ bypass this week.
  IF v_weekly_count + 1 >= 3 THEN
    v_should_notify := TRUE;
  END IF;

  INSERT INTO public.handoff_emergency_bypasses (
    tenant_id, nurse_id, nurse_name, nurse_email,
    shift_date, shift_type, pending_count,
    pending_patient_ids, pending_patient_names,
    override_reason, override_explanation, nurse_signature,
    ip_address, user_agent,
    bypass_number_this_week, weekly_bypass_count, manager_notified
  ) VALUES (
    v_tenant_id, v_nurse_id, v_nurse_name, v_nurse_email,
    p_shift_date, p_shift_type, p_pending_count,
    p_pending_patient_ids, v_patient_names,
    p_override_reason, p_override_explanation, p_nurse_signature,
    v_ip_address, p_user_agent,
    v_weekly_count + 1, v_weekly_count + 1, v_should_notify
  )
  RETURNING id INTO v_bypass_id;

  RETURN jsonb_build_object(
    'bypass_id', v_bypass_id,
    'bypass_number', v_weekly_count + 1,
    'weekly_total', v_weekly_count + 1,
    'should_notify_manager', v_should_notify,
    'nurse_name', v_nurse_name
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_handoff_override(DATE, TEXT, INTEGER, JSONB, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_handoff_override(DATE, TEXT, INTEGER, JSONB, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.log_handoff_override IS
  'Logs an emergency bypass of the shift handoff workflow. Looks up patient names and client IP server-side (SH-3/SH-4 — clients no longer pass them). SECURITY DEFINER with locked search_path. Returns bypass_id + weekly_count + should_notify_manager.';

COMMIT;
