-- ============================================================================
-- Correct record_login_attempt: use a valid lockout_type
-- ============================================================================
-- The previous version (20260625185658) inserted account_lockouts.lockout_type
-- = the login attempt_type (e.g. 'password'), but the table's CHECK constraint
-- account_lockouts_lockout_type_check only permits:
--   'rate_limit' | 'manual' | 'security_event'
--
-- An automatic failed-login-threshold lockout is a 'security_event'. The login
-- attempt_type that triggered it is preserved in metadata for traceability.
--
-- Verified live (2026-06-25): inserting 'password' raised
--   23514 account_lockouts_lockout_type_check
-- Everything else in the function is unchanged from 20260625185658.
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

  -- 3. Auto-expire any stale lockout so a fresh one can form (the partial unique
  --    index forbids a 2nd active row).
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

  -- 5. Lock if threshold reached and not already actively locked.
  --    lockout_type MUST be one of: rate_limit | manual | security_event.
  IF v_failed_count >= c_max_attempts THEN
    INSERT INTO public.account_lockouts (
      identifier, lockout_type, user_id, locked_at, locked_until, metadata
    )
    SELECT
      p_identifier,
      'security_event',
      p_user_id,
      now(),
      now() + make_interval(mins => c_lockout_mins),
      jsonb_build_object(
        'failed_attempts', v_failed_count,
        'window_minutes',  c_window_mins,
        'attempt_type',    p_attempt_type,
        'reason',          'failed_login_threshold'
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.account_lockouts
       WHERE identifier = p_identifier AND unlocked_at IS NULL
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.record_login_attempt IS
  'Records a login attempt and locks the account (lockout_type=security_event) after 5 failed attempts within 15 minutes (15-minute lockout). SECURITY DEFINER; service_role only.';
