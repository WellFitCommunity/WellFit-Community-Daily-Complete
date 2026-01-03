-- =============================================================================
-- Enforce Fail-Safe PHI Encryption
-- =============================================================================
-- Purpose: Change encryption functions to RAISE EXCEPTION on failure instead
--          of returning NULL. This prevents silent PHI data loss.
--
-- HIPAA Reference: 45 CFR 164.312(a)(2)(iv) - Encryption and decryption
-- Security Principle: Fail closed, not open
--
-- Before: Encryption failure returns NULL (data stored unencrypted - BAD)
-- After:  Encryption failure raises exception (transaction aborted - GOOD)
--
-- NOTE: Preserves existing function signatures and key retrieval logic.
--       Only changes the EXCEPTION handler behavior.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Replace encrypt_phi_text with fail-safe version
-- =============================================================================
CREATE OR REPLACE FUNCTION public.encrypt_phi_text(
  data text,
  use_clinical_key boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  encryption_key TEXT;
  encrypted_result BYTEA;
BEGIN
  -- Return null for null input (intentional - null in, null out)
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
      RAISE EXCEPTION '[PHI_ENCRYPTION_FAILED] Clinical encryption key not found in Vault. Check app.encryption_key';
    END IF;
  ELSE
    -- WellFit Community: Read from Supabase Secrets (via session setting)
    encryption_key := current_setting('app.settings.PHI_ENCRYPTION_KEY', true);

    IF encryption_key IS NULL OR encryption_key = '' THEN
      RAISE EXCEPTION '[PHI_ENCRYPTION_FAILED] WellFit encryption key not found. Ensure PHI_ENCRYPTION_KEY is set in Supabase Secrets';
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
    -- FAIL CLOSED: Do NOT allow unencrypted PHI to be stored
    -- This will abort the entire transaction, preventing data loss
    RAISE EXCEPTION '[PHI_ENCRYPTION_FAILED] Encryption failed - transaction aborted to prevent unencrypted PHI storage. Error: %', SQLERRM
      USING HINT = 'Check encryption key configuration and pgcrypto extension';
END;
$$;

COMMENT ON FUNCTION public.encrypt_phi_text(text, boolean) IS
  'Encrypts PHI text using AES-256. FAIL-SAFE: Raises exception on failure to prevent unencrypted data storage. HIPAA 164.312(a)(2)(iv) compliant.';

-- =============================================================================
-- 2. Replace decrypt_phi_text with fail-safe version
-- =============================================================================
CREATE OR REPLACE FUNCTION public.decrypt_phi_text(
  encrypted_data text,
  use_clinical_key boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  encryption_key TEXT;
  decrypted_result BYTEA;
BEGIN
  -- Return null for null input (intentional - null in, null out)
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
      RAISE EXCEPTION '[PHI_DECRYPTION_FAILED] Clinical encryption key not found in Vault';
    END IF;
  ELSE
    -- WellFit Community: Read from Supabase Secrets
    encryption_key := current_setting('app.settings.PHI_ENCRYPTION_KEY', true);

    IF encryption_key IS NULL OR encryption_key = '' THEN
      RAISE EXCEPTION '[PHI_DECRYPTION_FAILED] WellFit encryption key not found in Supabase Secrets';
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
    -- FAIL CLOSED: Alert on decryption failures
    -- This may indicate key rotation issues or data corruption
    RAISE EXCEPTION '[PHI_DECRYPTION_FAILED] Decryption failed - possible key mismatch or data corruption. Error: %', SQLERRM
      USING HINT = 'Verify encryption key matches the key used during encryption. Check for key rotation issues.';
END;
$$;

COMMENT ON FUNCTION public.decrypt_phi_text(text, boolean) IS
  'Decrypts PHI text encrypted with encrypt_phi_text. FAIL-SAFE: Raises exception on failure to alert about key/data issues. HIPAA compliant.';

-- =============================================================================
-- 3. Grant permissions (maintain existing access)
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.encrypt_phi_text(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_phi_text(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_phi_text(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_phi_text(text, boolean) TO service_role;

COMMIT;

-- =============================================================================
-- Post-migration verification (run manually to confirm fail-safe behavior)
-- =============================================================================
--
-- Test that invalid decryption now throws an exception:
--
--   SELECT decrypt_phi_text('this-is-not-valid-base64-encrypted-data');
--
-- Expected: ERROR with message containing [PHI_DECRYPTION_FAILED]
--
-- Test that NULL handling still works:
--
--   SELECT encrypt_phi_text(NULL);  -- Should return NULL, not throw
--   SELECT decrypt_phi_text(NULL);  -- Should return NULL, not throw
--
-- =============================================================================
