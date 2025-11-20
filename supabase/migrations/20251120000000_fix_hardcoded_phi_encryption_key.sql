-- ============================================================================
-- SECURITY FIX: Remove Hardcoded PHI Encryption Key
-- Date: 2025-11-20
-- ============================================================================
-- ISSUE: PHI encryption functions have hardcoded key in migration file
--   - 'PHI-ENCRYPT-2025-WELLFIT-SECURE-KEY-V1' exposed in Git
--   - HIPAA violation - keys must not be in source code
--
-- FIX: Use correct key sources:
--   - WellFit Community: PHI_ENCRYPTION_KEY from Supabase Secrets
--   - Envision Atlus: app.encryption_key from Vault
--
-- ============================================================================

-- Drop existing functions with hardcoded keys
DROP FUNCTION IF EXISTS public.encrypt_phi_text(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_phi_text(TEXT, TEXT) CASCADE;

-- ============================================================================
-- Function: encrypt_phi_text (SECURE VERSION)
-- ============================================================================
-- Encrypts PHI data using AES-256 with keys from proper sources
-- NO hardcoded fallback keys
CREATE OR REPLACE FUNCTION public.encrypt_phi_text(
  data TEXT,
  use_clinical_key BOOLEAN DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key TEXT;
  encrypted_result BYTEA;
BEGIN
  -- Return null for null input
  IF data IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get encryption key from appropriate source
  IF use_clinical_key THEN
    -- Envision Atlus (Clinical): Read from Vault
    SELECT decrypted_secret INTO encryption_key
    FROM vault.decrypted_secrets
    WHERE name = 'app.encryption_key'
    LIMIT 1;

    IF encryption_key IS NULL OR encryption_key = '' THEN
      RAISE EXCEPTION 'Clinical encryption key not found in Vault. Check app.encryption_key';
    END IF;
  ELSE
    -- WellFit Community: Read from Supabase Secrets (via session setting)
    encryption_key := current_setting('app.settings.PHI_ENCRYPTION_KEY', true);

    IF encryption_key IS NULL OR encryption_key = '' THEN
      RAISE EXCEPTION 'WellFit encryption key not found. Ensure PHI_ENCRYPTION_KEY is set in Supabase Secrets';
    END IF;
  END IF;

  -- Encrypt using AES-256
  encrypted_result := encrypt(
    data::BYTEA,
    digest(encryption_key, 'sha256'),
    'aes'
  );

  -- Return as base64 for storage
  RETURN encode(encrypted_result, 'base64');

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'PHI encryption failed: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- ============================================================================
-- Function: decrypt_phi_text (SECURE VERSION)
-- ============================================================================
-- Decrypts PHI data encrypted with encrypt_phi_text
CREATE OR REPLACE FUNCTION public.decrypt_phi_text(
  encrypted_data TEXT,
  use_clinical_key BOOLEAN DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key TEXT;
  decrypted_result BYTEA;
BEGIN
  -- Return null for null input
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get encryption key from appropriate source
  IF use_clinical_key THEN
    -- Envision Atlus (Clinical): Read from Vault
    SELECT decrypted_secret INTO encryption_key
    FROM vault.decrypted_secrets
    WHERE name = 'app.encryption_key'
    LIMIT 1;

    IF encryption_key IS NULL OR encryption_key = '' THEN
      RAISE EXCEPTION 'Clinical encryption key not found in Vault';
    END IF;
  ELSE
    -- WellFit Community: Read from Supabase Secrets
    encryption_key := current_setting('app.settings.PHI_ENCRYPTION_KEY', true);

    IF encryption_key IS NULL OR encryption_key = '' THEN
      RAISE EXCEPTION 'WellFit encryption key not found in Supabase Secrets';
    END IF;
  END IF;

  -- Decrypt from base64
  decrypted_result := decrypt(
    decode(encrypted_data, 'base64'),
    digest(encryption_key, 'sha256'),
    'aes'
  );

  -- Return as UTF-8 text
  RETURN convert_from(decrypted_result, 'utf8');

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'PHI decryption failed: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.encrypt_phi_text(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_phi_text(TEXT, BOOLEAN) TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.encrypt_phi_text IS
  'Encrypts PHI text using AES-256. Default (FALSE): WellFit Community key from Secrets. TRUE: Envision Atlus key from Vault.';
COMMENT ON FUNCTION public.decrypt_phi_text IS
  'Decrypts PHI text encrypted with encrypt_phi_text. HIPAA compliant - no hardcoded keys.';

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================
--
-- EXISTING KEYS (Already Configured):
-- ------------------------------------
-- ✅ WellFit Community: PHI_ENCRYPTION_KEY in Supabase Secrets
-- ✅ Envision Atlus: app.encryption_key in Vault
--
-- USAGE EXAMPLES:
-- ---------------
-- WellFit Community (default, use_clinical_key = FALSE):
--   SELECT encrypt_phi_text('patient name');
--   SELECT decrypt_phi_text(encrypted_column);
--
-- Envision Atlus (clinical, use_clinical_key = TRUE):
--   SELECT encrypt_phi_text('clinical note', TRUE);
--   SELECT decrypt_phi_text(encrypted_column, TRUE);
--
-- VERIFICATION TEST:
-- ------------------
-- Test both keys work:
--   SELECT decrypt_phi_text(encrypt_phi_text('WellFit Test'), FALSE) as wellfit_test;
--   SELECT decrypt_phi_text(encrypt_phi_text('Envision Test', TRUE), TRUE) as envision_test;
--
-- Both should return the original text.
-- ============================================================================
