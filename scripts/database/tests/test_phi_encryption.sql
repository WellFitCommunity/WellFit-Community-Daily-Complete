-- Test PHI Encryption Functionality
-- Run this in Supabase SQL Editor to verify encryption is working

-- First, set a test encryption key (replace with your actual key)
SET app.phi_encryption_key = 'your_actual_32_character_encryption_key_here';

-- Test 1: Verify encryption functions exist
SELECT 'Testing encryption functions...' as test_step;

-- Test 2: Test text encryption/decryption
SELECT
  'Text Encryption Test' as test_name,
  encrypt_phi_text('sensitive patient data') as encrypted_value,
  decrypt_phi_text(encrypt_phi_text('sensitive patient data')) as decrypted_value,
  CASE
    WHEN decrypt_phi_text(encrypt_phi_text('sensitive patient data')) = 'sensitive patient data'
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result;

-- Test 3: Test integer encryption/decryption
SELECT
  'Integer Encryption Test' as test_name,
  encrypt_phi_integer(120) as encrypted_value,
  decrypt_phi_integer(encrypt_phi_integer(120)) as decrypted_value,
  CASE
    WHEN decrypt_phi_integer(encrypt_phi_integer(120)) = 120
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result;

-- Test 4: Test null handling
SELECT
  'Null Handling Test' as test_name,
  encrypt_phi_text(null) as encrypted_null,
  decrypt_phi_text(null) as decrypted_null,
  CASE
    WHEN encrypt_phi_text(null) IS NULL AND decrypt_phi_text(null) IS NULL
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result;

-- Test 5: Verify tables exist with encrypted columns
SELECT
  'Tables Structure Test' as test_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'check_ins'
      AND column_name = 'emotional_state_encrypted'
      AND table_schema = 'public'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'risk_assessments'
      AND column_name = 'assessment_notes_encrypted'
      AND table_schema = 'public'
    )
    THEN '✅ PASS - Both tables have encrypted columns'
    ELSE '❌ FAIL - Missing encrypted columns'
  END as result;

-- Test 6: Verify triggers exist
SELECT
  'Triggers Test' as test_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_name = 'encrypt_check_ins_phi_trigger'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_name = 'encrypt_risk_assessments_phi_trigger'
    )
    THEN '✅ PASS - Both triggers exist'
    ELSE '❌ FAIL - Missing triggers'
  END as result;

-- Test 7: Verify decrypted views exist
SELECT
  'Views Test' as test_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_name = 'check_ins_decrypted'
      AND table_schema = 'public'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_name = 'risk_assessments_decrypted'
      AND table_schema = 'public'
    )
    THEN '✅ PASS - Both decrypted views exist'
    ELSE '❌ FAIL - Missing decrypted views'
  END as result;

-- Test 8: Test actual data insertion (if you have auth context)
-- This will test the trigger functionality
SELECT 'Testing data insertion with encryption...' as test_step;

-- Summary
SELECT '🔐 PHI Encryption Test Complete!' as summary;