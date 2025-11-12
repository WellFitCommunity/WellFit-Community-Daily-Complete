-- ========================================
-- PASTE THIS INTO SUPABASE SQL EDITOR
-- ========================================
-- This will deploy PHI encryption functions and test them
-- Go to: https://supabase.com/dashboard → SQL Editor → New query
-- Paste this entire file and click "Run"
-- ========================================

-- Step 1: Drop existing functions (if any)
DROP FUNCTION IF EXISTS public.encrypt_data(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.encrypt_data(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_data(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_data(TEXT) CASCADE;

-- Step 2: Create encrypt_data function
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
  v_encryption_key := current_setting('app.encryption_key', TRUE);

  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured';
  END IF;

  RETURN encode(pgp_sym_encrypt(p_plaintext, v_encryption_key), 'base64');
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Encryption failed: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Step 3: Create decrypt_data function
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
  IF p_encrypted IS NULL OR p_encrypted = '' THEN
    RETURN NULL;
  END IF;

  v_encryption_key := current_setting('app.encryption_key', TRUE);

  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured';
  END IF;

  RETURN pgp_sym_decrypt(decode(p_encrypted, 'base64'), v_encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Decryption failed: %', SQLERRM;
    RETURN '[DECRYPTION ERROR]';
END;
$$;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION public.encrypt_data(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_data(TEXT, TEXT) TO authenticated;

-- Step 5: Test encryption (THIS WILL SHOW IF IT WORKS!)
DO $$
DECLARE
  encrypted_value TEXT;
  decrypted_value TEXT;
BEGIN
  -- Test encryption
  encrypted_value := public.encrypt_data('Hello HIPAA World');
  RAISE NOTICE 'Encrypted: %', encrypted_value;

  -- Test decryption
  decrypted_value := public.decrypt_data(encrypted_value);
  RAISE NOTICE 'Decrypted: %', decrypted_value;

  -- Verify it works
  IF decrypted_value = 'Hello HIPAA World' THEN
    RAISE NOTICE '✅ SUCCESS! PHI encryption is working correctly';
  ELSE
    RAISE WARNING '❌ FAILED! Decrypted value does not match';
  END IF;
END;
$$;

-- ========================================
-- EXPECTED OUTPUT IN "Messages" TAB:
-- ========================================
-- NOTICE:  Encrypted: wcBMA... (long encrypted string)
-- NOTICE:  Decrypted: Hello HIPAA World
-- NOTICE:  ✅ SUCCESS! PHI encryption is working correctly
-- ========================================
