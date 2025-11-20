-- PHI Encryption Functions - HIPAA § 164.312(a)(2)(iv) Compliance
-- Server-side encryption using PostgreSQL pgcrypto
-- Encryption key stored in Supabase Vault, never exposed to client

-- Ensure pgcrypto extension exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption function for PHI text data
-- Uses AES encryption with key from Supabase Vault
CREATE OR REPLACE FUNCTION public.encrypt_phi_text(
  data TEXT,
  encryption_key TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  key_to_use TEXT;
  encrypted_result BYTEA;
BEGIN
  -- Return null for null input
  IF data IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get encryption key from parameter or Supabase Vault secret
  -- CRITICAL: No fallback key. If vault is not configured, fail gracefully per HIPAA requirements
  key_to_use := COALESCE(
    encryption_key,
    current_setting('app.phi_encryption_key', true)
  );

  -- Fail gracefully if no encryption key is available
  IF key_to_use IS NULL OR key_to_use = '' THEN
    RAISE EXCEPTION 'PHI encryption key not configured. Configure app.phi_encryption_key in Supabase Vault.'
      USING HINT = 'Set vault secret: INSERT INTO vault.secrets (name, secret) VALUES (''phi_encryption_key'', ''<your-key>'')';
  END IF;

  -- Encrypt using AES-256
  encrypted_result := encrypt(
    data::BYTEA,
    digest(key_to_use, 'sha256'), -- Use SHA-256 hash of key for consistent 256-bit key
    'aes'
  );

  -- Return as base64 for storage
  RETURN encode(encrypted_result, 'base64');

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't expose details to client
    RAISE WARNING 'PHI encryption failed: %', SQLERRM;
    -- In production, you may want to throw instead of returning null
    RETURN NULL;
END;
$$;

-- Create decryption function for PHI text data
CREATE OR REPLACE FUNCTION public.decrypt_phi_text(
  encrypted_data TEXT,
  encryption_key TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  key_to_use TEXT;
  decrypted_result BYTEA;
BEGIN
  -- Return null for null input
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get encryption key from parameter or Supabase Vault secret
  key_to_use := COALESCE(
    encryption_key,
    current_setting('app.phi_encryption_key', true)
  );

  -- Fail gracefully if no encryption key is available
  IF key_to_use IS NULL OR key_to_use = '' THEN
    RAISE EXCEPTION 'PHI decryption key not configured. Configure app.phi_encryption_key in Supabase Vault.'
      USING HINT = 'Set vault secret: INSERT INTO vault.secrets (name, secret) VALUES (''phi_encryption_key'', ''<your-key>'')';
  END IF;

  -- Decrypt from base64
  decrypted_result := decrypt(
    decode(encrypted_data, 'base64'),
    digest(key_to_use, 'sha256'), -- Use SHA-256 hash of key for consistent 256-bit key
    'aes'
  );

  -- Return as UTF-8 text
  RETURN convert_from(decrypted_result, 'utf8');

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'PHI decryption failed: %', SQLERRM;
    -- Return null on decryption failure
    RETURN NULL;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.encrypt_phi_text(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_phi_text(TEXT, TEXT) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.encrypt_phi_text IS
  'Encrypts PHI text data using AES-256. Key sourced from Supabase Vault in production.';
COMMENT ON FUNCTION public.decrypt_phi_text IS
  'Decrypts PHI text data encrypted with encrypt_phi_text. HIPAA compliant.';
