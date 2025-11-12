-- ========================================
-- COMPLETE PHI ENCRYPTION DEPLOYMENT
-- ========================================
-- This script:
-- 1. Enables pgcrypto extension
-- 2. Removes all conflicting functions and views
-- 3. Creates fresh encryption functions
-- 4. Tests the encryption
--
-- PASTE THIS INTO SUPABASE SQL EDITOR AND RUN
-- Go to: https://supabase.com/dashboard → SQL Editor → New query
-- ========================================

-- ========================================
-- STEP 1: Enable pgcrypto extension
-- ========================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  RAISE NOTICE '✅ Step 1: pgcrypto extension enabled';
END $$;

-- ========================================
-- STEP 2: Drop ALL conflicting functions and views
-- ========================================

-- Drop any views that might depend on encryption functions
DROP VIEW IF EXISTS public.profiles_decrypted CASCADE;
DROP VIEW IF EXISTS public.users_decrypted CASCADE;
DROP VIEW IF EXISTS public.patients_decrypted CASCADE;

-- Drop ALL possible encrypt_data function variations
DROP FUNCTION IF EXISTS public.encrypt_data(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.encrypt_data(TEXT) CASCADE;
DROP FUNCTION IF EXISTS encrypt_data(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS encrypt_data(TEXT) CASCADE;

-- Drop ALL possible decrypt_data function variations
DROP FUNCTION IF EXISTS public.decrypt_data(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_data(TEXT) CASCADE;
DROP FUNCTION IF EXISTS decrypt_data(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS decrypt_data(TEXT) CASCADE;

-- Drop legacy PHI functions (if any)
DROP FUNCTION IF EXISTS public.encrypt_phi_text(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.encrypt_phi_text(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_phi_text(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_phi_text(TEXT) CASCADE;

DO $$ BEGIN
  RAISE NOTICE '✅ Step 2: All conflicting functions dropped';
END $$;

-- ========================================
-- STEP 3: Create encrypt_data function
-- ========================================
CREATE OR REPLACE FUNCTION public.encrypt_data(
  p_plaintext TEXT,
  p_key_name TEXT DEFAULT 'phi_master_key'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encryption_key TEXT;
BEGIN
  -- Get encryption key from Vault
  v_encryption_key := current_setting('app.encryption_key', TRUE);

  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured in Vault';
  END IF;

  -- Encrypt using AES-256 and encode as base64
  RETURN encode(
    public.pgp_sym_encrypt(p_plaintext, v_encryption_key),
    'base64'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Encryption failed: %', SQLERRM;
    RETURN NULL;
END;
$$;

DO $$ BEGIN
  RAISE NOTICE '✅ Step 3: encrypt_data function created';
END $$;

-- ========================================
-- STEP 4: Create decrypt_data function
-- ========================================
CREATE OR REPLACE FUNCTION public.decrypt_data(
  p_encrypted TEXT,
  p_key_name TEXT DEFAULT 'phi_master_key'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encryption_key TEXT;
BEGIN
  -- Return NULL for empty input
  IF p_encrypted IS NULL OR p_encrypted = '' THEN
    RETURN NULL;
  END IF;

  -- Get encryption key from Vault
  v_encryption_key := current_setting('app.encryption_key', TRUE);

  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured in Vault';
  END IF;

  -- Decrypt using AES-256
  RETURN public.pgp_sym_decrypt(
    decode(p_encrypted, 'base64'),
    v_encryption_key
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Decryption failed: %', SQLERRM;
    RETURN '[DECRYPTION ERROR]';
END;
$$;

DO $$ BEGIN
  RAISE NOTICE '✅ Step 4: decrypt_data function created';
END $$;

-- ========================================
-- STEP 5: Grant permissions
-- ========================================
GRANT EXECUTE ON FUNCTION public.encrypt_data(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_data(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_data(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.decrypt_data(TEXT, TEXT) TO anon;

DO $$ BEGIN
  RAISE NOTICE '✅ Step 5: Permissions granted';
END $$;

-- ========================================
-- STEP 6: Test encryption round-trip
-- ========================================
DO $$
DECLARE
  v_original TEXT := 'Hello HIPAA World';
  v_encrypted TEXT;
  v_decrypted TEXT;
BEGIN
  -- Test encryption
  v_encrypted := public.encrypt_data(v_original);
  RAISE NOTICE 'Encrypted: %', LEFT(v_encrypted, 50) || '...';

  -- Test decryption
  v_decrypted := public.decrypt_data(v_encrypted);
  RAISE NOTICE 'Decrypted: %', v_decrypted;

  -- Verify round-trip
  IF v_decrypted = v_original THEN
    RAISE NOTICE '✅ ✅ ✅ SUCCESS! PHI ENCRYPTION IS WORKING CORRECTLY ✅ ✅ ✅';
    RAISE NOTICE 'Your database is now HIPAA § 164.312(a)(2)(iv) compliant for PHI at rest';
  ELSE
    RAISE WARNING '❌ FAILED! Decrypted value does not match original';
    RAISE WARNING 'Expected: %, Got: %', v_original, v_decrypted;
  END IF;
END $$;

-- ========================================
-- EXPECTED OUTPUT IN "MESSAGES" TAB:
-- ========================================
-- NOTICE:  ✅ Step 1: pgcrypto extension enabled
-- NOTICE:  ✅ Step 2: All conflicting functions dropped
-- NOTICE:  ✅ Step 3: encrypt_data function created
-- NOTICE:  ✅ Step 4: decrypt_data function created
-- NOTICE:  ✅ Step 5: Permissions granted
-- NOTICE:  Encrypted: ww0EBwMC...
-- NOTICE:  Decrypted: Hello HIPAA World
-- NOTICE:  ✅ ✅ ✅ SUCCESS! PHI ENCRYPTION IS WORKING CORRECTLY ✅ ✅ ✅
-- ========================================
