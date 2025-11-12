-- ========================================
-- CONFLICT RESOLUTION FOR PHI ENCRYPTION
-- ========================================
-- Run this FIRST to clean up all conflicting functions
-- Then run deploy-encryption.sql
-- ========================================

-- Step 1: Drop ALL possible encrypt_data function signatures
DROP FUNCTION IF EXISTS public.encrypt_data(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.encrypt_data(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.encrypt_data(p_plaintext TEXT, p_key_name TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.encrypt_data(p_plaintext TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.encrypt_data(plaintext TEXT, key_name TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.encrypt_data(plaintext TEXT) CASCADE;

-- Step 2: Drop ALL possible decrypt_data function signatures
DROP FUNCTION IF EXISTS public.decrypt_data(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_data(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_data(p_encrypted TEXT, p_key_name TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_data(p_encrypted TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_data(encrypted_data TEXT, key_name TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_data(encrypted_data TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_data(p_ciphertext TEXT, p_key_name TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_data(p_ciphertext TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_data(ciphertext TEXT) CASCADE;

-- Step 3: Drop old PHI encryption functions (from legacy migrations)
DROP FUNCTION IF EXISTS public.encrypt_phi_text(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.encrypt_phi_text(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_phi_text(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_phi_text(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_phi_text(encrypted_data TEXT, encryption_key TEXT) CASCADE;

-- Step 4: Drop any views that depend on these functions
DROP VIEW IF EXISTS public.profiles_decrypted CASCADE;
DROP VIEW IF EXISTS public.users_decrypted CASCADE;
DROP VIEW IF EXISTS public.patients_decrypted CASCADE;

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✅ All conflicting functions and views dropped';
  RAISE NOTICE 'Now run deploy-encryption.sql to create fresh encryption functions';
END $$;
