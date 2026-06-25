-- ============================================================================
-- Implement Real Account Lockout Functions (replace stubs)
-- ============================================================================
-- Replaces the no-op stubs from 20251215200000_add_account_lockout_stub.sql with
-- a working brute-force lockout system backed by the existing (already-present)
-- public.login_attempts and public.account_lockouts tables.
--
-- Policy (tunable — see constants in record_login_attempt):
--   * Threshold:        5 failed attempts
--   * Counting window: 15 minutes (rolling, reset by a successful login)
--   * Lockout duration:15 minutes
--   Chosen to be senior-friendly while meeting SOC2 CC6.1 — generous attempt
--   count, short lockout. To change policy, edit the three CONSTANT values and
--   ship a new migration.
--
-- Security posture:
--   * SECURITY DEFINER + SET search_path = public — these run pre-auth (anon has
--     no JWT yet) and must read/write the lockout tables regardless of RLS.
--   * EXECUTE granted to service_role ONLY. The only caller is the
--     `login-security` edge function (service-role client). The browser reaches
--     it via functions.invoke('login-security'), never direct RPC. Revoking
--     anon/authenticated EXECUTE closes a lockout-DoS / audit-forgery vector
--     (an anon caller could otherwise lock out arbitrary identifiers).
--
-- Table columns relied upon (verified live 2026-06-25 via information_schema):
--   login_attempts:   identifier, attempt_type, success, user_id, ip_address,
--                     user_agent, error_message, metadata, created_at
--   account_lockouts: identifier, lockout_type, user_id, locked_at,
--                     locked_until, unlocked_at, unlocked_by, unlock_reason,
--                     metadata
--   Partial unique index idx_account_lockouts_active_identifier on
--   (identifier) WHERE unlocked_at IS NULL enforces one ACTIVE lockout per
--   identifier — the insert below respects it (auto-expire stale + NOT EXISTS).
-- ============================================================================

-- ============================================================================
-- record_login_attempt: log every attempt; lock after threshold failures
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_identifier TEXT,
  p_attempt_type TEXT,
  p_success BOOLEAN,
  p_user_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_max_attempts CONSTANT INTEGER := 5;   -- failures before lock
  c_window_mins  CONSTANT INTEGER := 15;  -- rolling count window
  c_lockout_mins CONSTANT INTEGER := 15;  -- lock duration
  v_failed_count INTEGER;
  v_last_success TIMESTAMPTZ;
BEGIN
  -- 1. Always record the attempt (audit trail)
  INSERT INTO public.login_attempts (
    identifier, attempt_type, success, user_id,
    ip_address, user_agent, error_message, metadata
  ) VALUES (
    p_identifier, p_attempt_type, p_success, p_user_id,
    p_ip_address, p_user_agent, p_error_message, COALESCE(p_metadata, '{}'::jsonb)
  );

  -- 2. Successful login clears any active lockout and resets the window
  IF p_success THEN
    UPDATE public.account_lockouts
       SET unlocked_at   = now(),
           unlocked_by   = p_user_id,
           unlock_reason = 'successful_login'
     WHERE identifier = p_identifier
       AND unlocked_at IS NULL;
    RETURN;
  END IF;

  -- 3. Failed attempt: auto-expire any stale lockout so a fresh one can form.
  --    (The partial unique index forbids a 2nd active row, so we must close
  --     out an expired-but-not-unlocked lock before inserting a new one.)
  UPDATE public.account_lockouts
     SET unlocked_at   = now(),
         unlock_reason = 'lockout_expired'
   WHERE identifier = p_identifier
     AND unlocked_at IS NULL
     AND locked_until <= now();

  -- 4. Count failures since the last successful login, within the window
  SELECT max(created_at) INTO v_last_success
    FROM public.login_attempts
   WHERE identifier = p_identifier AND success = TRUE;

  SELECT count(*) INTO v_failed_count
    FROM public.login_attempts
   WHERE identifier = p_identifier
     AND success = FALSE
     AND created_at >= now() - make_interval(mins => c_window_mins)
     AND created_at >  COALESCE(v_last_success, '-infinity'::timestamptz);

  -- 5. Lock if threshold reached and not already actively locked
  IF v_failed_count >= c_max_attempts THEN
    INSERT INTO public.account_lockouts (
      identifier, lockout_type, user_id, locked_at, locked_until, metadata
    )
    SELECT
      p_identifier,
      COALESCE(p_attempt_type, 'password'),
      p_user_id,
      now(),
      now() + make_interval(mins => c_lockout_mins),
      jsonb_build_object('failed_attempts', v_failed_count, 'window_minutes', c_window_mins)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.account_lockouts
       WHERE identifier = p_identifier AND unlocked_at IS NULL
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.record_login_attempt IS
  'Records a login attempt and locks the account after 5 failed attempts within 15 minutes (15-minute lockout). SECURITY DEFINER; service_role only.';

-- ============================================================================
-- is_account_locked: TRUE if an unexpired, un-cleared lockout exists
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_account_locked(p_identifier TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.account_lockouts
     WHERE identifier = p_identifier
       AND unlocked_at IS NULL
       AND locked_until > now()
  );
END;
$$;

COMMENT ON FUNCTION public.is_account_locked IS
  'Returns TRUE if the identifier has an active (unexpired, un-cleared) lockout. SECURITY DEFINER; service_role only.';

-- ============================================================================
-- get_failed_login_count: failures since last success, within p_minutes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_failed_login_count(
  p_identifier TEXT,
  p_minutes INTEGER DEFAULT 15
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_success TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  SELECT max(created_at) INTO v_last_success
    FROM public.login_attempts
   WHERE identifier = p_identifier AND success = TRUE;

  SELECT count(*) INTO v_count
    FROM public.login_attempts
   WHERE identifier = p_identifier
     AND success = FALSE
     AND created_at >= now() - make_interval(mins => p_minutes)
     AND created_at >  COALESCE(v_last_success, '-infinity'::timestamptz);

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.get_failed_login_count IS
  'Counts failed login attempts for an identifier since its last successful login, within p_minutes. SECURITY DEFINER; service_role only.';

-- ============================================================================
-- Grants — service_role ONLY (revoke the broad anon/authenticated grants the
-- stub migration created; these are reachable only via the service-role
-- login-security edge function).
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.is_account_locked(TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_failed_login_count(TEXT, INTEGER) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_login_attempt(TEXT, TEXT, BOOLEAN, UUID, TEXT, TEXT, TEXT, JSONB) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_account_locked(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_failed_login_count(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(TEXT, TEXT, BOOLEAN, UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  IF (SELECT prosecdef FROM pg_proc WHERE proname = 'record_login_attempt') IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'record_login_attempt is not SECURITY DEFINER';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE proname = 'is_account_locked') IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'is_account_locked is not SECURITY DEFINER';
  END IF;
  RAISE NOTICE 'Account lockout functions implemented successfully';
END;
$$;
