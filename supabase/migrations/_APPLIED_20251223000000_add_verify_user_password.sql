/**
 * Add verify_user_password function for Envision login
 *
 * This function allows Edge Functions to verify a user's password against
 * the auth.users table using PostgreSQL's pgcrypto extension.
 *
 * This bypasses Supabase's signInWithPassword which requires CAPTCHA,
 * allowing programmatic password verification for Envision 2FA flow.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

-- Ensure pgcrypto extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- FUNCTION: verify_user_password
-- ============================================================================
-- Verifies a password against the stored bcrypt hash in auth.users
-- Returns TRUE if password matches, FALSE otherwise
-- SECURITY DEFINER allows access to auth.users which is normally restricted
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_user_password(
  user_email TEXT,
  input_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_encrypted_password TEXT;
BEGIN
  -- Input validation
  IF user_email IS NULL OR user_email = '' THEN
    RETURN FALSE;
  END IF;

  IF input_password IS NULL OR input_password = '' THEN
    RETURN FALSE;
  END IF;

  -- Look up the user's encrypted password from auth.users
  SELECT encrypted_password INTO v_encrypted_password
  FROM auth.users
  WHERE email = LOWER(user_email)
  LIMIT 1;

  -- User not found
  IF v_encrypted_password IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verify password using pgcrypto's crypt function
  -- bcrypt hashes are self-salting, so we pass the stored hash as the salt
  RETURN v_encrypted_password = crypt(input_password, v_encrypted_password);
END;
$$;

-- Grant execute permission to service role (Edge Functions)
GRANT EXECUTE ON FUNCTION verify_user_password(TEXT, TEXT) TO service_role;

-- Revoke from public and anon for security
REVOKE EXECUTE ON FUNCTION verify_user_password(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION verify_user_password(TEXT, TEXT) FROM anon;

COMMENT ON FUNCTION verify_user_password IS
  'Verifies user password against auth.users bcrypt hash. Used by Envision login to bypass CAPTCHA for 2FA flow.';
