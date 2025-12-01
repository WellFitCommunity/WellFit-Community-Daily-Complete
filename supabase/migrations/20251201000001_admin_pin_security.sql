/**
 * Admin PIN Security Enhancement
 *
 * Adds rate limiting and SMS-based PIN reset for Admin/Staff authentication
 *
 * Features:
 * - 5 failed attempts = 15 minute lockout
 * - SMS OTP required for PIN reset
 * - Notification SMS on PIN change
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

-- ============================================================================
-- STAFF PIN ATTEMPTS (Rate Limiting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_pin_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  client_ip INET,
  user_agent TEXT,
  lockout_until TIMESTAMPTZ  -- Set when 5 failures reached
);

-- Index for fast lookup of recent attempts
CREATE INDEX IF NOT EXISTS idx_staff_pin_attempts_user_time
  ON staff_pin_attempts(user_id, attempted_at DESC);

-- Index for finding active lockouts
CREATE INDEX IF NOT EXISTS idx_staff_pin_attempts_lockout
  ON staff_pin_attempts(user_id, lockout_until)
  WHERE lockout_until IS NOT NULL;

COMMENT ON TABLE staff_pin_attempts IS 'Tracks PIN verification attempts for rate limiting (5 failures = 15 min lockout)';
COMMENT ON COLUMN staff_pin_attempts.lockout_until IS 'If set and > NOW(), user is locked out until this time';

-- ============================================================================
-- STAFF PIN RESET TOKENS (SMS Verification Flow)
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_pin_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  token_hash TEXT NOT NULL,  -- SHA256 of the OTP token
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint to prevent duplicate active tokens
CREATE UNIQUE INDEX IF NOT EXISTS idx_pin_reset_tokens_user_token
  ON staff_pin_reset_tokens(user_id, token_hash);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_pin_reset_tokens_expires
  ON staff_pin_reset_tokens(expires_at);

-- Index for finding unused tokens
CREATE INDEX IF NOT EXISTS idx_pin_reset_tokens_unused
  ON staff_pin_reset_tokens(user_id, expires_at)
  WHERE used_at IS NULL;

COMMENT ON TABLE staff_pin_reset_tokens IS 'Short-lived tokens for SMS-based PIN reset (10 min expiry)';
COMMENT ON COLUMN staff_pin_reset_tokens.token_hash IS 'SHA256 hash of the OTP token - never store plaintext';

-- ============================================================================
-- HELPER FUNCTION: Check if user is locked out
-- ============================================================================

CREATE OR REPLACE FUNCTION check_pin_lockout(p_user_id UUID)
RETURNS TABLE(is_locked BOOLEAN, unlock_at TIMESTAMPTZ, failed_count INT) AS $$
DECLARE
  v_failed_count INT;
  v_lockout_until TIMESTAMPTZ;
BEGIN
  -- Check for active lockout first
  SELECT spa.lockout_until INTO v_lockout_until
  FROM staff_pin_attempts spa
  WHERE spa.user_id = p_user_id
    AND spa.lockout_until IS NOT NULL
    AND spa.lockout_until > NOW()
  ORDER BY spa.lockout_until DESC
  LIMIT 1;

  IF v_lockout_until IS NOT NULL THEN
    RETURN QUERY SELECT true, v_lockout_until, 5;
    RETURN;
  END IF;

  -- Count failed attempts in last 15 minutes
  SELECT COUNT(*)::INT INTO v_failed_count
  FROM staff_pin_attempts spa
  WHERE spa.user_id = p_user_id
    AND spa.success = false
    AND spa.attempted_at > NOW() - INTERVAL '15 minutes';

  RETURN QUERY SELECT false, NULL::TIMESTAMPTZ, v_failed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_pin_lockout IS 'Returns lockout status for a user: (is_locked, unlock_at, failed_count)';

-- ============================================================================
-- HELPER FUNCTION: Record PIN attempt (and trigger lockout if needed)
-- ============================================================================

CREATE OR REPLACE FUNCTION record_pin_attempt(
  p_user_id UUID,
  p_success BOOLEAN,
  p_client_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_failed_count INT;
  v_new_attempt_id UUID;
BEGIN
  -- Insert the attempt and get its ID
  INSERT INTO staff_pin_attempts (user_id, success, client_ip, user_agent)
  VALUES (p_user_id, p_success, p_client_ip, p_user_agent)
  RETURNING id INTO v_new_attempt_id;

  -- If failed, check if we need to set lockout
  IF NOT p_success THEN
    SELECT COUNT(*)::INT INTO v_failed_count
    FROM staff_pin_attempts
    WHERE user_id = p_user_id
      AND success = false
      AND attempted_at > NOW() - INTERVAL '15 minutes';

    IF v_failed_count >= 5 THEN
      -- Set lockout for 15 minutes from now on the latest attempt
      UPDATE staff_pin_attempts
      SET lockout_until = NOW() + INTERVAL '15 minutes'
      WHERE id = v_new_attempt_id;
    END IF;
  ELSE
    -- On success, clear any existing lockout for this user
    UPDATE staff_pin_attempts
    SET lockout_until = NULL
    WHERE user_id = p_user_id
      AND lockout_until IS NOT NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_pin_attempt IS 'Records a PIN attempt and triggers 15-min lockout after 5 failures';

-- ============================================================================
-- HELPER FUNCTION: Cleanup expired tokens (for scheduled job)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_pin_reset_tokens()
RETURNS INT AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM staff_pin_reset_tokens
  WHERE expires_at < NOW() - INTERVAL '1 hour'
     OR used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_pin_reset_tokens IS 'Removes expired/used PIN reset tokens (run via pg_cron)';

-- ============================================================================
-- HELPER FUNCTION: Cleanup old PIN attempts (for scheduled job)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_pin_attempts()
RETURNS INT AS $$
DECLARE
  v_deleted INT;
BEGIN
  -- Keep last 24 hours of attempts for audit, delete older ones
  DELETE FROM staff_pin_attempts
  WHERE attempted_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_pin_attempts IS 'Removes PIN attempts older than 24 hours (run via pg_cron)';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE staff_pin_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_pin_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Service role only policies (edge functions use service role)
-- No direct client access to these sensitive tables

CREATE POLICY "Service role only - staff_pin_attempts"
  ON staff_pin_attempts
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Service role only - staff_pin_reset_tokens"
  ON staff_pin_reset_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================================================
-- SCHEDULE CLEANUP JOBS (if pg_cron available)
-- ============================================================================

-- Note: These may fail if pg_cron is not enabled, which is fine
DO $$
BEGIN
  -- Cleanup expired tokens every hour
  PERFORM cron.schedule(
    'cleanup-pin-reset-tokens',
    '0 * * * *',  -- Every hour
    'SELECT cleanup_expired_pin_reset_tokens()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available for token cleanup scheduling';
END $$;

DO $$
BEGIN
  -- Cleanup old attempts every 6 hours
  PERFORM cron.schedule(
    'cleanup-old-pin-attempts',
    '0 */6 * * *',  -- Every 6 hours
    'SELECT cleanup_old_pin_attempts()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available for attempts cleanup scheduling';
END $$;
