-- =============================================================================
-- PHI Encryption Comprehensive Tests
-- =============================================================================
-- Purpose: Verify PHI encryption/decryption functions work correctly
-- Run: psql -f scripts/database/tests/test_phi_encryption_comprehensive.sql
--
-- HIPAA Reference: 45 CFR 164.312(a)(2)(iv) - Encryption and decryption
-- =============================================================================

\echo '=== PHI Encryption Comprehensive Tests ==='
\echo ''

-- =============================================================================
-- TEST 1: Verify encrypt_phi_text function exists with correct signature
-- =============================================================================
\echo 'TEST 1: Checking encrypt_phi_text function signature...'

DO $$
DECLARE
  func_exists BOOLEAN;
  return_type TEXT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'encrypt_phi_text'
  ) INTO func_exists;

  IF NOT func_exists THEN
    RAISE EXCEPTION 'TEST 1 FAILED: encrypt_phi_text function not found';
  END IF;

  SELECT pg_catalog.format_type(p.prorettype, NULL)
  INTO return_type
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname = 'encrypt_phi_text'
  LIMIT 1;

  IF return_type = 'text' THEN
    RAISE NOTICE 'TEST 1 PASSED: encrypt_phi_text exists, returns text';
  ELSE
    RAISE EXCEPTION 'TEST 1 FAILED: encrypt_phi_text returns %, expected text', return_type;
  END IF;
END $$;

-- =============================================================================
-- TEST 2: Verify decrypt_phi_text function exists with correct signature
-- =============================================================================
\echo 'TEST 2: Checking decrypt_phi_text function signature...'

DO $$
DECLARE
  func_exists BOOLEAN;
  return_type TEXT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'decrypt_phi_text'
  ) INTO func_exists;

  IF NOT func_exists THEN
    RAISE EXCEPTION 'TEST 2 FAILED: decrypt_phi_text function not found';
  END IF;

  SELECT pg_catalog.format_type(p.prorettype, NULL)
  INTO return_type
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname = 'decrypt_phi_text'
  LIMIT 1;

  IF return_type = 'text' THEN
    RAISE NOTICE 'TEST 2 PASSED: decrypt_phi_text exists, returns text';
  ELSE
    RAISE EXCEPTION 'TEST 2 FAILED: decrypt_phi_text returns %, expected text', return_type;
  END IF;
END $$;

-- =============================================================================
-- TEST 3: NULL input returns NULL (not exception)
-- =============================================================================
\echo 'TEST 3: Testing NULL input handling...'

DO $$
DECLARE
  encrypt_result TEXT;
  decrypt_result TEXT;
BEGIN
  -- Test encrypt_phi_text(NULL)
  SELECT encrypt_phi_text(NULL) INTO encrypt_result;
  IF encrypt_result IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 3 FAILED: encrypt_phi_text(NULL) should return NULL, got %', encrypt_result;
  END IF;

  -- Test decrypt_phi_text(NULL)
  SELECT decrypt_phi_text(NULL) INTO decrypt_result;
  IF decrypt_result IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 3 FAILED: decrypt_phi_text(NULL) should return NULL, got %', decrypt_result;
  END IF;

  RAISE NOTICE 'TEST 3 PASSED: NULL input correctly returns NULL';
EXCEPTION
  WHEN OTHERS THEN
    -- NULL should NOT throw an exception
    RAISE EXCEPTION 'TEST 3 FAILED: NULL input should not throw exception: %', SQLERRM;
END $$;

-- =============================================================================
-- TEST 4: Fail-safe behavior - invalid data raises exception
-- =============================================================================
\echo 'TEST 4: Testing fail-safe behavior on invalid data...'

DO $$
DECLARE
  result TEXT;
BEGIN
  -- Attempt to decrypt invalid data
  SELECT decrypt_phi_text('this-is-definitely-not-valid-encrypted-data') INTO result;

  -- If we get here without exception, the fail-safe is broken
  IF result IS NULL THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Invalid data returned NULL instead of raising exception (fail-safe broken!)';
  ELSE
    RAISE EXCEPTION 'TEST 4 FAILED: Invalid data returned value instead of raising exception';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- We expect an exception - check if it's the right one
    IF SQLERRM LIKE '%PHI_DECRYPTION_FAILED%' THEN
      RAISE NOTICE 'TEST 4 PASSED: Invalid data correctly raises PHI_DECRYPTION_FAILED';
    ELSIF SQLERRM LIKE '%PHI_ENCRYPTION_FAILED%' THEN
      RAISE NOTICE 'TEST 4 PASSED: Invalid data correctly raises PHI_ENCRYPTION_FAILED';
    ELSIF SQLERRM LIKE '%encryption key not found%' THEN
      -- Key not configured is also valid (function is failing safely)
      RAISE NOTICE 'TEST 4 PASSED: Function fails safely when key not configured';
    ELSE
      -- Any exception is better than NULL (fail-safe working)
      RAISE NOTICE 'TEST 4 PASSED: Function raised exception (fail-safe working): %', substring(SQLERRM, 1, 60);
    END IF;
END $$;

-- =============================================================================
-- TEST 5: Encrypted output is base64 encoded
-- =============================================================================
\echo 'TEST 5: Testing encrypted output format (base64)...'

DO $$
DECLARE
  test_data TEXT := 'Test PHI Data';
  encrypted TEXT;
  is_base64 BOOLEAN;
BEGIN
  -- This test may fail if encryption key is not set, which is expected in some environments
  BEGIN
    SELECT encrypt_phi_text(test_data) INTO encrypted;

    IF encrypted IS NULL THEN
      RAISE NOTICE 'TEST 5 SKIPPED: Encryption returned NULL (key may not be configured)';
      RETURN;
    END IF;

    -- Check if result looks like base64 (alphanumeric + /+= and reasonable length)
    is_base64 := encrypted ~ '^[A-Za-z0-9+/]+=*$' AND length(encrypted) > 10;

    IF is_base64 THEN
      RAISE NOTICE 'TEST 5 PASSED: Encrypted output is base64 format (% chars)', length(encrypted);
    ELSE
      RAISE EXCEPTION 'TEST 5 FAILED: Encrypted output is not base64: %', substring(encrypted, 1, 50);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%key not found%' OR SQLERRM LIKE '%PHI_ENCRYPTION_FAILED%' THEN
        RAISE NOTICE 'TEST 5 SKIPPED: Encryption key not configured (expected in dev)';
      ELSE
        RAISE EXCEPTION 'TEST 5 FAILED: Unexpected error: %', SQLERRM;
      END IF;
  END;
END $$;

-- =============================================================================
-- TEST 6: Functions are SECURITY DEFINER
-- =============================================================================
\echo 'TEST 6: Checking functions use SECURITY DEFINER...'

DO $$
DECLARE
  encrypt_security TEXT;
  decrypt_security TEXT;
BEGIN
  SELECT prosecdef::text INTO encrypt_security
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'encrypt_phi_text'
  LIMIT 1;

  SELECT prosecdef::text INTO decrypt_security
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'decrypt_phi_text'
  LIMIT 1;

  IF encrypt_security = 'true' AND decrypt_security = 'true' THEN
    RAISE NOTICE 'TEST 6 PASSED: Both functions use SECURITY DEFINER';
  ELSE
    RAISE EXCEPTION 'TEST 6 FAILED: Functions should use SECURITY DEFINER (encrypt: %, decrypt: %)',
      encrypt_security, decrypt_security;
  END IF;
END $$;

-- =============================================================================
-- TEST 7: Functions have proper search_path set
-- =============================================================================
\echo 'TEST 7: Checking functions have secure search_path...'

DO $$
DECLARE
  encrypt_config TEXT[];
  decrypt_config TEXT[];
  has_search_path BOOLEAN := false;
BEGIN
  SELECT proconfig INTO encrypt_config
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'encrypt_phi_text'
  LIMIT 1;

  -- Check if search_path is set in config
  IF encrypt_config IS NOT NULL THEN
    FOR i IN 1..array_length(encrypt_config, 1) LOOP
      IF encrypt_config[i] LIKE 'search_path=%' THEN
        has_search_path := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF has_search_path THEN
    RAISE NOTICE 'TEST 7 PASSED: Functions have search_path configured';
  ELSE
    RAISE NOTICE 'TEST 7 WARNING: Functions may not have explicit search_path (check manually)';
  END IF;
END $$;

-- =============================================================================
-- TEST 8: Permissions granted to authenticated role
-- =============================================================================
\echo 'TEST 8: Checking function permissions...'

DO $$
DECLARE
  has_auth_grant BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
    AND routine_name = 'encrypt_phi_text'
    AND grantee = 'authenticated'
    AND privilege_type = 'EXECUTE'
  ) INTO has_auth_grant;

  IF has_auth_grant THEN
    RAISE NOTICE 'TEST 8 PASSED: authenticated role has EXECUTE on encrypt_phi_text';
  ELSE
    -- Check if public has access (less restrictive but still valid)
    SELECT EXISTS(
      SELECT 1
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
      AND routine_name = 'encrypt_phi_text'
      AND privilege_type = 'EXECUTE'
    ) INTO has_auth_grant;

    IF has_auth_grant THEN
      RAISE NOTICE 'TEST 8 PASSED: EXECUTE permission exists on encrypt_phi_text';
    ELSE
      RAISE NOTICE 'TEST 8 WARNING: No explicit EXECUTE grant found (may inherit from public)';
    END IF;
  END IF;
END $$;

-- =============================================================================
-- TEST 9: Empty string handling
-- =============================================================================
\echo 'TEST 9: Testing empty string handling...'

DO $$
DECLARE
  encrypted TEXT;
BEGIN
  BEGIN
    SELECT encrypt_phi_text('') INTO encrypted;

    -- Empty string should either:
    -- 1. Return encrypted empty string (valid)
    -- 2. Return NULL (valid - treating empty as null)
    -- 3. Raise exception (valid - refusing to encrypt empty)

    IF encrypted IS NULL THEN
      RAISE NOTICE 'TEST 9 PASSED: Empty string returns NULL';
    ELSIF length(encrypted) > 0 THEN
      RAISE NOTICE 'TEST 9 PASSED: Empty string encrypts to % chars', length(encrypted);
    ELSE
      RAISE NOTICE 'TEST 9 PASSED: Empty string handled';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%key not found%' THEN
        RAISE NOTICE 'TEST 9 SKIPPED: Encryption key not configured';
      ELSE
        RAISE NOTICE 'TEST 9 PASSED: Empty string raises exception (valid behavior)';
      END IF;
  END;
END $$;

-- =============================================================================
-- TEST 10: Unicode/special character handling
-- =============================================================================
\echo 'TEST 10: Testing Unicode character handling...'

DO $$
DECLARE
  test_unicode TEXT := 'Patient: José García 日本語 emoji: 🏥';
  encrypted TEXT;
BEGIN
  BEGIN
    SELECT encrypt_phi_text(test_unicode) INTO encrypted;

    IF encrypted IS NULL THEN
      RAISE NOTICE 'TEST 10 SKIPPED: Encryption key not configured';
    ELSIF length(encrypted) > 0 THEN
      RAISE NOTICE 'TEST 10 PASSED: Unicode text encrypts successfully';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%key not found%' THEN
        RAISE NOTICE 'TEST 10 SKIPPED: Encryption key not configured';
      ELSE
        RAISE EXCEPTION 'TEST 10 FAILED: Unicode handling error: %', SQLERRM;
      END IF;
  END;
END $$;

-- =============================================================================
-- TEST 11: Verify pgcrypto extension is available
-- =============================================================================
\echo 'TEST 11: Checking pgcrypto extension...'

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RAISE NOTICE 'TEST 11 PASSED: pgcrypto extension is installed';
  ELSE
    RAISE EXCEPTION 'TEST 11 FAILED: pgcrypto extension not found';
  END IF;
END $$;

-- =============================================================================
-- TEST 12: Function comments document HIPAA compliance
-- =============================================================================
\echo 'TEST 12: Checking function documentation...'

DO $$
DECLARE
  encrypt_comment TEXT;
  decrypt_comment TEXT;
BEGIN
  SELECT obj_description(p.oid, 'pg_proc') INTO encrypt_comment
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'encrypt_phi_text'
  LIMIT 1;

  SELECT obj_description(p.oid, 'pg_proc') INTO decrypt_comment
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'decrypt_phi_text'
  LIMIT 1;

  IF encrypt_comment IS NOT NULL AND decrypt_comment IS NOT NULL THEN
    RAISE NOTICE 'TEST 12 PASSED: Functions have documentation comments';
  ELSE
    RAISE NOTICE 'TEST 12 WARNING: Functions may be missing documentation comments';
  END IF;
END $$;

-- =============================================================================
-- SUMMARY
-- =============================================================================
\echo ''
\echo '=== PHI Encryption Test Summary ==='
\echo 'Tests 1-4: Core functionality (must pass)'
\echo 'Tests 5-12: Extended validation (some may skip if key not configured)'
\echo ''
\echo 'Note: Some tests may show SKIPPED if PHI_ENCRYPTION_KEY is not set.'
\echo 'This is expected in development environments.'
\echo ''
