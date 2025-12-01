/**
 * Envision Standalone Authentication
 *
 * Adds standalone auth capabilities to super_admin_users for partners, IT, and monitors
 * who don't have Supabase accounts.
 *
 * Features:
 * - Standalone password + PIN authentication (not tied to auth.users)
 * - 5 failed attempts = 15 minute lockout (both password and PIN)
 * - SMS-based password/PIN reset
 * - Rate limiting for security
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

-- ============================================================================
-- MODIFY SUPER_ADMIN_USERS TABLE
-- ============================================================================

-- Make user_id nullable (for standalone users without Supabase accounts)
ALTER TABLE super_admin_users
  ALTER COLUMN user_id DROP NOT NULL;

-- Add standalone auth columns
ALTER TABLE super_admin_users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Add unique constraint on phone for standalone auth lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_super_admin_users_phone
  ON super_admin_users(phone)
  WHERE phone IS NOT NULL;

-- Add unique constraint on email for login lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_super_admin_users_email
  ON super_admin_users(email);

COMMENT ON COLUMN super_admin_users.phone IS 'Phone number for SMS verification and password/PIN reset';
COMMENT ON COLUMN super_admin_users.password_hash IS 'PBKDF2 hash of standalone password (NULL if using Supabase auth)';
COMMENT ON COLUMN super_admin_users.pin_hash IS 'PBKDF2 hash of second-factor PIN (required for all users)';

-- ============================================================================
-- ENVISION PIN ATTEMPTS (Rate Limiting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS envision_auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID NOT NULL REFERENCES super_admin_users(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('password', 'pin')),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  client_ip INET,
  user_agent TEXT,
  lockout_until TIMESTAMPTZ  -- Set when 5 failures reached
);

-- Index for fast lookup of recent attempts
CREATE INDEX IF NOT EXISTS idx_envision_auth_attempts_user_time
  ON envision_auth_attempts(super_admin_id, attempt_type, attempted_at DESC);

-- Index for finding active lockouts
CREATE INDEX IF NOT EXISTS idx_envision_auth_attempts_lockout
  ON envision_auth_attempts(super_admin_id, attempt_type, lockout_until)
  WHERE lockout_until IS NOT NULL;

COMMENT ON TABLE envision_auth_attempts IS 'Tracks Envision auth attempts for rate limiting (5 failures = 15 min lockout)';
COMMENT ON COLUMN envision_auth_attempts.attempt_type IS 'Type of auth: password (step 1) or pin (step 2)';
COMMENT ON COLUMN envision_auth_attempts.lockout_until IS 'If set and > NOW(), user is locked out until this time';

-- ============================================================================
-- ENVISION RESET TOKENS (Password/PIN Reset via SMS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS envision_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID NOT NULL REFERENCES super_admin_users(id) ON DELETE CASCADE,
  reset_type TEXT NOT NULL CHECK (reset_type IN ('password', 'pin')),
  phone TEXT NOT NULL,
  token_hash TEXT NOT NULL,  -- SHA256 of the OTP token
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint to prevent duplicate active tokens
CREATE UNIQUE INDEX IF NOT EXISTS idx_envision_reset_tokens_user_token
  ON envision_reset_tokens(super_admin_id, reset_type, token_hash);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_envision_reset_tokens_expires
  ON envision_reset_tokens(expires_at);

-- Index for finding unused tokens
CREATE INDEX IF NOT EXISTS idx_envision_reset_tokens_unused
  ON envision_reset_tokens(super_admin_id, reset_type, expires_at)
  WHERE used_at IS NULL;

COMMENT ON TABLE envision_reset_tokens IS 'Short-lived tokens for SMS-based password/PIN reset (10 min expiry)';
COMMENT ON COLUMN envision_reset_tokens.reset_type IS 'Type of reset: password or pin';
COMMENT ON COLUMN envision_reset_tokens.token_hash IS 'SHA256 hash of the OTP token - never store plaintext';

-- ============================================================================
-- ENVISION SESSIONS (Two-Factor Session Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS envision_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID NOT NULL REFERENCES super_admin_users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,  -- Secure random token for session
  password_verified_at TIMESTAMPTZ NOT NULL,  -- When step 1 completed
  pin_verified_at TIMESTAMPTZ,  -- When step 2 completed (NULL = pending PIN)
  expires_at TIMESTAMPTZ NOT NULL,
  client_ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on session token
CREATE UNIQUE INDEX IF NOT EXISTS idx_envision_sessions_token
  ON envision_sessions(session_token);

-- Index for finding active sessions
CREATE INDEX IF NOT EXISTS idx_envision_sessions_active
  ON envision_sessions(super_admin_id, expires_at)
  WHERE pin_verified_at IS NOT NULL;

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_envision_sessions_expires
  ON envision_sessions(expires_at);

COMMENT ON TABLE envision_sessions IS 'Tracks Envision two-factor auth sessions (password + PIN)';
COMMENT ON COLUMN envision_sessions.pin_verified_at IS 'NULL until PIN verified, then user has full access';
COMMENT ON COLUMN envision_sessions.session_token IS 'Secure session token returned after full 2FA completion';

-- ============================================================================
-- HELPER FUNCTION: Check if Envision user is locked out
-- ============================================================================

CREATE OR REPLACE FUNCTION check_envision_lockout(p_super_admin_id UUID, p_attempt_type TEXT)
RETURNS TABLE(is_locked BOOLEAN, unlock_at TIMESTAMPTZ, failed_count INT) AS $$
DECLARE
  v_failed_count INT;
  v_lockout_until TIMESTAMPTZ;
BEGIN
  -- Check for active lockout first
  SELECT eaa.lockout_until INTO v_lockout_until
  FROM envision_auth_attempts eaa
  WHERE eaa.super_admin_id = p_super_admin_id
    AND eaa.attempt_type = p_attempt_type
    AND eaa.lockout_until IS NOT NULL
    AND eaa.lockout_until > NOW()
  ORDER BY eaa.lockout_until DESC
  LIMIT 1;

  IF v_lockout_until IS NOT NULL THEN
    RETURN QUERY SELECT true, v_lockout_until, 5;
    RETURN;
  END IF;

  -- Count failed attempts in last 15 minutes
  SELECT COUNT(*)::INT INTO v_failed_count
  FROM envision_auth_attempts eaa
  WHERE eaa.super_admin_id = p_super_admin_id
    AND eaa.attempt_type = p_attempt_type
    AND eaa.success = false
    AND eaa.attempted_at > NOW() - INTERVAL '15 minutes';

  RETURN QUERY SELECT false, NULL::TIMESTAMPTZ, v_failed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_envision_lockout IS 'Returns lockout status for Envision user: (is_locked, unlock_at, failed_count)';

-- ============================================================================
-- HELPER FUNCTION: Record Envision auth attempt (and trigger lockout if needed)
-- ============================================================================

CREATE OR REPLACE FUNCTION record_envision_attempt(
  p_super_admin_id UUID,
  p_attempt_type TEXT,
  p_success BOOLEAN,
  p_client_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_failed_count INT;
  v_new_attempt_id UUID;
BEGIN
  -- Insert the attempt and get its ID
  INSERT INTO envision_auth_attempts (super_admin_id, attempt_type, success, client_ip, user_agent)
  VALUES (p_super_admin_id, p_attempt_type, p_success, p_client_ip, p_user_agent)
  RETURNING id INTO v_new_attempt_id;

  -- If failed, check if we need to set lockout
  IF NOT p_success THEN
    SELECT COUNT(*)::INT INTO v_failed_count
    FROM envision_auth_attempts
    WHERE super_admin_id = p_super_admin_id
      AND attempt_type = p_attempt_type
      AND success = false
      AND attempted_at > NOW() - INTERVAL '15 minutes';

    IF v_failed_count >= 5 THEN
      -- Set lockout for 15 minutes from now on the latest attempt
      UPDATE envision_auth_attempts
      SET lockout_until = NOW() + INTERVAL '15 minutes'
      WHERE id = v_new_attempt_id;
    END IF;
  ELSE
    -- On success, clear any existing lockout for this user/type
    UPDATE envision_auth_attempts
    SET lockout_until = NULL
    WHERE super_admin_id = p_super_admin_id
      AND attempt_type = p_attempt_type
      AND lockout_until IS NOT NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_envision_attempt IS 'Records an Envision auth attempt and triggers 15-min lockout after 5 failures';

-- ============================================================================
-- HELPER FUNCTION: Cleanup expired Envision sessions and tokens
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_envision_auth_data()
RETURNS INT AS $$
DECLARE
  v_deleted INT := 0;
  v_count INT;
BEGIN
  -- Delete expired sessions
  DELETE FROM envision_sessions
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted + v_count;

  -- Delete expired/used tokens
  DELETE FROM envision_reset_tokens
  WHERE expires_at < NOW() - INTERVAL '1 hour'
     OR used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted + v_count;

  -- Delete old auth attempts (keep 24 hours)
  DELETE FROM envision_auth_attempts
  WHERE attempted_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted + v_count;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_envision_auth_data IS 'Removes expired sessions, tokens, and old attempts (run via pg_cron)';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE envision_auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE envision_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE envision_sessions ENABLE ROW LEVEL SECURITY;

-- Service role only policies (edge functions use service role)
-- No direct client access to these sensitive tables

CREATE POLICY "Service role only - envision_auth_attempts"
  ON envision_auth_attempts
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Service role only - envision_reset_tokens"
  ON envision_reset_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Service role only - envision_sessions"
  ON envision_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================================================
-- SCHEDULE CLEANUP JOBS (if pg_cron available)
-- ============================================================================

DO $$
BEGIN
  -- Cleanup expired Envision auth data every hour
  PERFORM cron.schedule(
    'cleanup-envision-auth-data',
    '30 * * * *',  -- Every hour at :30
    'SELECT cleanup_envision_auth_data()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available for Envision cleanup scheduling';
END $$;
