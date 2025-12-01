/**
 * Envision TOTP Authentication
 *
 * Adds Time-based One-Time Password (TOTP) support for Envision super admins.
 * Replaces SMS-based PIN verification with authenticator app (Google Authenticator, Authy, etc.)
 *
 * Features:
 * - TOTP secret storage (encrypted)
 * - 10 one-time backup codes for recovery
 * - Migration path from PIN to TOTP
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

-- ============================================================================
-- ADD TOTP COLUMNS TO SUPER_ADMIN_USERS
-- ============================================================================

-- TOTP secret (base32 encoded, should be encrypted at rest by Supabase)
ALTER TABLE super_admin_users
  ADD COLUMN IF NOT EXISTS totp_secret TEXT;

-- TOTP enabled flag
ALTER TABLE super_admin_users
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;

-- 10 hashed one-time backup codes for recovery
ALTER TABLE super_admin_users
  ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[];

-- Timestamp when TOTP was set up
ALTER TABLE super_admin_users
  ADD COLUMN IF NOT EXISTS totp_setup_at TIMESTAMPTZ;

-- Timestamp when backup codes were last regenerated
ALTER TABLE super_admin_users
  ADD COLUMN IF NOT EXISTS totp_backup_codes_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN super_admin_users.totp_secret IS 'Base32-encoded TOTP secret for authenticator apps (RFC 6238)';
COMMENT ON COLUMN super_admin_users.totp_enabled IS 'True if TOTP is enabled and verified for this user';
COMMENT ON COLUMN super_admin_users.totp_backup_codes IS 'Array of 10 hashed one-time backup codes (SHA-256)';
COMMENT ON COLUMN super_admin_users.totp_setup_at IS 'When TOTP was successfully set up (first code verified)';
COMMENT ON COLUMN super_admin_users.totp_backup_codes_generated_at IS 'When backup codes were last regenerated';

-- ============================================================================
-- TOTP VERIFICATION ATTEMPTS (Rate Limiting)
-- ============================================================================

-- Extend envision_auth_attempts to support TOTP
-- The existing table already has attempt_type CHECK constraint, need to add 'totp'
ALTER TABLE envision_auth_attempts
  DROP CONSTRAINT IF EXISTS envision_auth_attempts_attempt_type_check;

ALTER TABLE envision_auth_attempts
  ADD CONSTRAINT envision_auth_attempts_attempt_type_check
  CHECK (attempt_type IN ('password', 'pin', 'totp', 'backup_code'));

COMMENT ON COLUMN envision_auth_attempts.attempt_type IS 'Type of auth: password (step 1), pin (legacy step 2), totp (step 2), backup_code (recovery)';

-- ============================================================================
-- TOTP SETUP TOKENS (Temporary tokens during TOTP setup flow)
-- ============================================================================

CREATE TABLE IF NOT EXISTS envision_totp_setup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID NOT NULL REFERENCES super_admin_users(id) ON DELETE CASCADE,
  temp_secret TEXT NOT NULL,  -- Temporary secret until verified
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active setup per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_envision_totp_setup_user_active
  ON envision_totp_setup(super_admin_id)
  WHERE verified = false AND expires_at > NOW();

-- Cleanup index
CREATE INDEX IF NOT EXISTS idx_envision_totp_setup_expires
  ON envision_totp_setup(expires_at);

COMMENT ON TABLE envision_totp_setup IS 'Temporary TOTP secrets during setup (before first code verification)';
COMMENT ON COLUMN envision_totp_setup.temp_secret IS 'Temporary TOTP secret - moved to super_admin_users.totp_secret after verification';

-- Enable RLS
ALTER TABLE envision_totp_setup ENABLE ROW LEVEL SECURITY;

-- Service role only (edge functions use service role)
CREATE POLICY "Service role only - envision_totp_setup"
  ON envision_totp_setup
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================================================
-- HELPER FUNCTION: Generate backup codes
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_totp_backup_codes()
RETURNS TEXT[] AS $$
DECLARE
  codes TEXT[] := '{}';
  i INT;
  code TEXT;
BEGIN
  -- Generate 10 random 8-character alphanumeric codes
  FOR i IN 1..10 LOOP
    -- Generate random bytes and encode as base64, then take first 8 chars
    -- Format: XXXX-XXXX for readability
    code := upper(substring(encode(gen_random_bytes(6), 'hex') from 1 for 8));
    code := substring(code from 1 for 4) || '-' || substring(code from 5 for 4);
    codes := array_append(codes, code);
  END LOOP;

  RETURN codes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION generate_totp_backup_codes IS 'Generates 10 random backup codes in XXXX-XXXX format';

-- ============================================================================
-- HELPER FUNCTION: Hash a backup code for storage
-- ============================================================================

CREATE OR REPLACE FUNCTION hash_backup_code(code TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Use SHA-256 to hash the backup code
  -- Remove any dashes for consistent hashing
  RETURN encode(sha256(replace(upper(code), '-', '')::bytea), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION hash_backup_code IS 'Hashes a backup code using SHA-256 for secure storage';

-- ============================================================================
-- HELPER FUNCTION: Verify and consume a backup code
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_and_consume_backup_code(
  p_super_admin_id UUID,
  p_code TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_hashed_code TEXT;
  v_codes TEXT[];
  v_new_codes TEXT[];
  v_code TEXT;
  v_found BOOLEAN := false;
BEGIN
  -- Hash the provided code
  v_hashed_code := hash_backup_code(p_code);

  -- Get current backup codes
  SELECT totp_backup_codes INTO v_codes
  FROM super_admin_users
  WHERE id = p_super_admin_id;

  IF v_codes IS NULL THEN
    RETURN false;
  END IF;

  -- Check each code and build new array without the matched code
  v_new_codes := '{}';
  FOREACH v_code IN ARRAY v_codes LOOP
    IF v_code = v_hashed_code AND NOT v_found THEN
      -- Found matching code, don't add to new array (consuming it)
      v_found := true;
    ELSE
      v_new_codes := array_append(v_new_codes, v_code);
    END IF;
  END LOOP;

  IF v_found THEN
    -- Update the backup codes array (removing the used code)
    UPDATE super_admin_users
    SET totp_backup_codes = v_new_codes
    WHERE id = p_super_admin_id;
  END IF;

  RETURN v_found;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION verify_and_consume_backup_code IS 'Verifies a backup code and removes it from the array if valid (one-time use)';

-- ============================================================================
-- HELPER FUNCTION: Get remaining backup code count
-- ============================================================================

CREATE OR REPLACE FUNCTION get_backup_code_count(p_super_admin_id UUID)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COALESCE(array_length(totp_backup_codes, 1), 0) INTO v_count
  FROM super_admin_users
  WHERE id = p_super_admin_id;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_backup_code_count IS 'Returns the number of remaining backup codes for a user';

-- ============================================================================
-- UPDATE CLEANUP FUNCTION
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

  -- Delete expired TOTP setup tokens
  DELETE FROM envision_totp_setup
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted + v_count;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_envision_auth_data IS 'Removes expired sessions, tokens, TOTP setup, and old attempts (run via pg_cron)';
