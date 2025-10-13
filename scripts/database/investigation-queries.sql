-- ============================================================================
-- Root SQL Files Investigation Queries
-- ============================================================================
--
-- Run these queries in Supabase Dashboard → SQL Editor
-- to determine which root SQL files have been applied
--
-- Copy results and share with your team to determine cleanup actions
--
-- ============================================================================

-- ============================================================================
-- 1. CHECK PHI ENCRYPTION IMPLEMENTATION
-- ============================================================================

SELECT '========================================' as separator;
SELECT '1. PHI ENCRYPTION INVESTIGATION' as section;
SELECT '========================================' as separator;

-- 1.1 Check if check_ins_audit table exists
SELECT
    'check_ins_audit' as table_name,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'check_ins_audit')
        THEN '✅ EXISTS'
        ELSE '❌ DOES NOT EXIST'
    END as status;

-- 1.2 Check for encrypted columns in check_ins_audit (if table exists)
SELECT
    'check_ins_audit' as table_name,
    column_name,
    data_type,
    '✅ ENCRYPTED COLUMN' as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'check_ins_audit'
  AND column_name LIKE '%encrypted%'
ORDER BY column_name;

-- 1.3 Check if risk_assessments table exists
SELECT
    'risk_assessments' as table_name,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'risk_assessments')
        THEN '✅ EXISTS'
        ELSE '❌ DOES NOT EXIST'
    END as status;

-- 1.4 Check for encrypted columns in risk_assessments (if table exists)
SELECT
    'risk_assessments' as table_name,
    column_name,
    data_type,
    '✅ ENCRYPTED COLUMN' as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'risk_assessments'
  AND column_name LIKE '%encrypted%'
ORDER BY column_name;

-- 1.5 Check if PHI encryption functions exist
SELECT
    routine_name as function_name,
    routine_type,
    '✅ FUNCTION EXISTS' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('encrypt_phi_text', 'decrypt_phi_text', 'encrypt_phi_integer', 'decrypt_phi_integer')
ORDER BY routine_name;

-- ============================================================================
-- 2. CHECK USER QUESTIONS SCHEMA
-- ============================================================================

SELECT '========================================' as separator;
SELECT '2. USER QUESTIONS SCHEMA INVESTIGATION' as section;
SELECT '========================================' as separator;

-- 2.1 Check if user_questions table exists
SELECT
    'user_questions' as table_name,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_questions')
        THEN '✅ EXISTS'
        ELSE '❌ DOES NOT EXIST'
    END as status;

-- 2.2 Show user_questions schema (if it exists)
SELECT
    'user_questions' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_questions'
ORDER BY ordinal_position;

-- 2.3 Check for specific columns that indicate enhanced schema
SELECT
    'user_questions enhanced features' as check_name,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'user_questions'
              AND column_name IN ('priority', 'category', 'is_required')
        )
        THEN '✅ ENHANCED SCHEMA APPLIED'
        ELSE '❌ BASIC SCHEMA OR NOT EXISTS'
    END as status;

-- ============================================================================
-- 3. CHECK FOR OTHER RELATED TABLES
-- ============================================================================

SELECT '========================================' as separator;
SELECT '3. RELATED TABLES CHECK' as section;
SELECT '========================================' as separator;

-- 3.1 Check all tables that might have encrypted columns
SELECT
    table_name,
    COUNT(*) as encrypted_column_count,
    STRING_AGG(column_name, ', ' ORDER BY column_name) as encrypted_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name LIKE '%encrypted%'
GROUP BY table_name
ORDER BY table_name;

-- 3.2 Check for check_ins table (different from check_ins_audit)
SELECT
    'check_ins' as table_name,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'check_ins')
        THEN '✅ EXISTS'
        ELSE '❌ DOES NOT EXIST'
    END as status;

-- ============================================================================
-- 4. SUMMARY AND RECOMMENDATIONS
-- ============================================================================

SELECT '========================================' as separator;
SELECT '4. SUMMARY' as section;
SELECT '========================================' as separator;

-- 4.1 Tables summary
SELECT
    'Tables Checked' as metric,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('check_ins', 'check_ins_audit', 'risk_assessments', 'user_questions');

-- 4.2 Encrypted columns summary
SELECT
    'Total Encrypted Columns' as metric,
    COUNT(*) as count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name LIKE '%encrypted%';

-- 4.3 Encryption functions summary
SELECT
    'Encryption Functions' as metric,
    COUNT(*) as count
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('encrypt_phi_text', 'decrypt_phi_text', 'encrypt_phi_integer', 'decrypt_phi_integer');

-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================
--
-- PHI ENCRYPTION FILES:
--   IF encrypted columns found in check_ins_audit AND risk_assessments:
--     ✅ Delete: complete_phi_encryption_correct_tables.sql
--     ✅ Delete: complete_phi_encryption_existing_tables.sql
--     ✅ Delete: complete_phi_encryption_new_tables.sql
--     ✅ Delete: manual_phi_encryption.sql
--     → All 4 PHI files can be deleted (already applied)
--
--   IF no encrypted columns found:
--     ⚠️  Archive all 4 files to archive/database/phi-encryption-not-applied/
--     → Encryption was designed but never implemented
--
--   IF partial encryption (only some tables):
--     🔍 Review which version to apply
--     → Create proper migration if needed
--
-- USER QUESTIONS FILES:
--   IF user_questions table exists with enhanced schema:
--     ✅ Delete: ENHANCED_USER_QUESTIONS_MIGRATION.sql
--     ✅ Delete: QUESTIONS_DATABASE_SCHEMA.sql
--     → Schema already applied
--
--   IF user_questions table missing OR basic schema only:
--     ⚠️  Archive files to archive/database/user-questions-not-applied/
--     → Decide if you want to implement this feature
--
-- ============================================================================
