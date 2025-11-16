-- ============================================================================
-- PHI Encryption Functions (Simplified - Functions Only)
-- ============================================================================
-- Purpose: Add encrypt_data() and decrypt_data() functions for PHI at rest
-- HIPAA § 164.312(a)(2)(iv) - Encryption and Decryption
-- Date: 2025-11-12
-- ============================================================================

-- Drop all existing encryption function versions to prevent conflicts
DROP FUNCTION IF EXISTS public.encrypt_data(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.encrypt_data(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_data(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_data(TEXT) CASCADE;

-- ============================================================================
-- Function: encrypt_data
-- ============================================================================
-- Encrypts PHI data using AES-256 encryption with the configured encryption key
-- Returns: Base64-encoded encrypted data
CREATE OR REPLACE FUNCTION public.encrypt_data(
  p_plaintext TEXT,
  p_key_name TEXT DEFAULT 'app_encryption_key'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encryption_key TEXT;
BEGIN
  -- Retrieve encryption key from Vault
  SELECT decrypted_secret INTO v_encryption_key
  FROM vault.decrypted_secrets
  WHERE name = p_key_name
  LIMIT 1;

  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key "%" not found in Vault', p_key_name;
  END IF;

  -- AES-256 encryption using pgcrypto
  RETURN encode(
    pgp_sym_encrypt(p_plaintext, v_encryption_key),
    'base64'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Encryption failed: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- ============================================================================
-- Function: decrypt_data
-- ============================================================================
-- Decrypts PHI data that was encrypted with encrypt_data()
-- Returns: Decrypted plaintext or '[DECRYPTION ERROR]' on failure
CREATE OR REPLACE FUNCTION public.decrypt_data(
  p_encrypted TEXT,
  p_key_name TEXT DEFAULT 'app_encryption_key'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encryption_key TEXT;
BEGIN
  -- Return NULL if input is NULL or empty
  IF p_encrypted IS NULL OR p_encrypted = '' THEN
    RETURN NULL;
  END IF;

  -- Retrieve encryption key from Vault
  SELECT decrypted_secret INTO v_encryption_key
  FROM vault.decrypted_secrets
  WHERE name = p_key_name
  LIMIT 1;

  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key "%" not found in Vault', p_key_name;
  END IF;

  -- AES-256 decryption using pgcrypto
  RETURN pgp_sym_decrypt(
    decode(p_encrypted, 'base64'),
    v_encryption_key
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Decryption failed: %', SQLERRM;
    RETURN '[DECRYPTION ERROR]';
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.encrypt_data(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_data(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.encrypt_data IS 'Encrypts PHI data using AES-256 with app.encryption_key';
COMMENT ON FUNCTION public.decrypt_data IS 'Decrypts PHI data that was encrypted with encrypt_data()';
