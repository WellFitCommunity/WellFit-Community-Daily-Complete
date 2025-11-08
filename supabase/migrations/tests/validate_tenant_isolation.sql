-- Tenant Isolation Validation Script
-- Purpose: Verify that RLS policies correctly enforce tenant boundaries
-- Run this in Supabase SQL Editor after deploying multi-tenancy migrations
-- Expected: All tests should show "PASS" status

-- =============================================================================
-- SETUP: Create test tenants and users
-- =============================================================================

DO $$
DECLARE
  tenant1_id UUID;
  tenant2_id UUID;
  user1_id UUID;
  user2_id UUID;
BEGIN
  -- Create two test tenants
  INSERT INTO tenants (id, subdomain, display_name, is_active)
  VALUES
    (gen_random_uuid(), 'test-tenant-1', 'Test Hospital 1', true),
    (gen_random_uuid(), 'test-tenant-2', 'Test Hospital 2', true)
  ON CONFLICT (subdomain) DO NOTHING;

  SELECT id INTO tenant1_id FROM tenants WHERE subdomain = 'test-tenant-1';
  SELECT id INTO tenant2_id FROM tenants WHERE subdomain = 'test-tenant-2';

  RAISE NOTICE 'Test Tenant 1 ID: %', tenant1_id;
  RAISE NOTICE 'Test Tenant 2 ID: %', tenant2_id;

  -- Note: In production, you'd create actual auth.users records
  -- For this test, we'll use SET commands to simulate users
END$$;

-- =============================================================================
-- TEST 1: Verify tenant_id columns exist on all required tables
-- =============================================================================

SELECT
  'TEST 1: Tenant Column Coverage' AS test_name,
  CASE
    WHEN COUNT(*) >= 250 THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  COUNT(*) AS tables_with_tenant_id,
  '250+ tables should have tenant_id' AS expected
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'tenant_id'
  AND table_name NOT LIKE '_backup_%'
  AND table_name NOT LIKE 'code_%'
  AND table_name NOT LIKE 'tenants';

-- =============================================================================
-- TEST 2: Verify RLS is enabled on all tenant-scoped tables
-- =============================================================================

SELECT
  'TEST 2: RLS Enabled' AS test_name,
  CASE
    WHEN COUNT(CASE WHEN NOT rowsecurity THEN 1 END) = 0 THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  COUNT(*) AS total_tables,
  COUNT(CASE WHEN rowsecurity THEN 1 END) AS tables_with_rls,
  COUNT(CASE WHEN NOT rowsecurity THEN 1 END) AS tables_without_rls
FROM pg_tables pt
WHERE schemaname = 'public'
  AND EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = pt.tablename
      AND c.column_name = 'tenant_id'
  )
  AND tablename NOT LIKE '_backup_%';

-- =============================================================================
-- TEST 3: Verify RLS policies exist for tenant isolation
-- =============================================================================

SELECT
  'TEST 3: RLS Policy Coverage' AS test_name,
  CASE
    WHEN COUNT(DISTINCT tablename) >= 200 THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  COUNT(DISTINCT tablename) AS tables_with_policies,
  COUNT(*) AS total_policies,
  '200+ tables should have tenant policies' AS expected
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE '%tenant%';

-- =============================================================================
-- TEST 4: Verify helper functions exist
-- =============================================================================

SELECT
  'TEST 4: Helper Functions' AS test_name,
  CASE
    WHEN COUNT(*) = 2 THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  array_agg(proname) AS functions_found,
  'Should have get_current_tenant_id and is_tenant_admin' AS expected
FROM pg_proc
WHERE proname IN ('get_current_tenant_id', 'is_tenant_admin')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- =============================================================================
-- TEST 5: Verify indexes exist on tenant_id columns
-- =============================================================================

SELECT
  'TEST 5: Tenant Indexes' AS test_name,
  CASE
    WHEN COUNT(*) >= 200 THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  COUNT(*) AS tenant_indexes,
  '200+ indexes on tenant_id columns' AS expected
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef LIKE '%tenant_id%';

-- =============================================================================
-- TEST 6: Verify NOT NULL constraints on tenant_id
-- =============================================================================

SELECT
  'TEST 6: NOT NULL Constraints' AS test_name,
  CASE
    WHEN COUNT(CASE WHEN is_nullable = 'YES' THEN 1 END) < 50 THEN 'PASS'
    ELSE 'WARN'
  END AS status,
  COUNT(*) AS total_tenant_columns,
  COUNT(CASE WHEN is_nullable = 'NO' THEN 1 END) AS not_null_count,
  COUNT(CASE WHEN is_nullable = 'YES' THEN 1 END) AS nullable_count,
  'Most tenant_id columns should be NOT NULL' AS expected
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'tenant_id'
  AND table_name NOT LIKE '_backup_%';

-- =============================================================================
-- TEST 7: Check for tables that might need tenant_id but don't have it
-- =============================================================================

SELECT
  'TEST 7: Tables Missing tenant_id' AS test_name,
  CASE
    WHEN COUNT(*) <= 30 THEN 'PASS'
    ELSE 'WARN'
  END AS status,
  COUNT(*) AS tables_without_tenant_id,
  array_agg(tablename ORDER BY tablename) FILTER (WHERE tablename NOT LIKE 'code_%') AS sample_tables
FROM pg_tables pt
WHERE schemaname = 'public'
  AND tablename NOT LIKE '_backup_%'
  AND tablename NOT LIKE 'code_%'
  AND tablename NOT LIKE 'tenants'
  AND tablename NOT LIKE 'spatial_%'
  AND tablename NOT LIKE 'guardian_cron_%'
  AND tablename NOT LIKE 'drill_metrics_%'
  AND tablename NOT LIKE 'backup_%'
  AND tablename NOT LIKE 'error_logs'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = pt.tablename
      AND c.column_name = 'tenant_id'
  );

-- =============================================================================
-- TEST 8: Verify foreign key constraints point to tenants table
-- =============================================================================

SELECT
  'TEST 8: Foreign Key Constraints' AS test_name,
  CASE
    WHEN COUNT(*) >= 200 THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  COUNT(*) AS fk_constraints,
  'tenant_id should reference tenants(id)' AS expected
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'tenant_id'
  AND tc.table_schema = 'public';

-- =============================================================================
-- TEST 9: Sample Policy Test (profiles table)
-- =============================================================================

SELECT
  'TEST 9: Sample Policy (profiles)' AS test_name,
  CASE
    WHEN COUNT(*) >= 2 THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  COUNT(*) AS policy_count,
  array_agg(policyname) AS policies,
  'profiles should have multiple tenant policies' AS expected
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
  AND policyname LIKE '%tenant%';

-- =============================================================================
-- TEST 10: Sample Policy Test (critical tables)
-- =============================================================================

WITH critical_tables AS (
  SELECT unnest(ARRAY[
    'encounters',
    'fhir_observations',
    'claims',
    'prehospital_handoffs',
    'audit_logs',
    'clinical_notes',
    'medications',
    'telehealth_sessions'
  ]) AS table_name
)
SELECT
  'TEST 10: Critical Table Policies' AS test_name,
  CASE
    WHEN COUNT(DISTINCT p.tablename) = 8 THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  COUNT(DISTINCT p.tablename) AS tables_with_policies,
  array_agg(DISTINCT p.tablename) AS tables_covered,
  '8 critical tables should have tenant policies' AS expected
FROM critical_tables ct
LEFT JOIN pg_policies p
  ON p.tablename = ct.table_name
  AND p.schemaname = 'public'
  AND p.policyname LIKE '%tenant%';

-- =============================================================================
-- FUNCTIONAL TEST: Simulate cross-tenant access attempt
-- =============================================================================

-- Note: This test requires actual tenant data
-- Uncomment and modify after you have real tenants set up

/*
DO $$
DECLARE
  tenant1_id UUID;
  tenant2_id UUID;
  test_result TEXT;
BEGIN
  -- Get tenant IDs
  SELECT id INTO tenant1_id FROM tenants WHERE subdomain = 'houston' LIMIT 1;
  SELECT id INTO tenant2_id FROM tenants WHERE subdomain = 'miami' LIMIT 1;

  -- Set current tenant to tenant1
  PERFORM set_config('app.current_tenant_id', tenant1_id::text, false);

  -- Try to query data from tenant2 (should return 0 rows)
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'PASS'
    ELSE 'FAIL - Cross-tenant leak detected!'
  END INTO test_result
  FROM profiles
  WHERE tenant_id = tenant2_id;

  RAISE NOTICE 'TEST 11: Cross-Tenant Isolation - %', test_result;
END$$;
*/

-- =============================================================================
-- SUMMARY REPORT
-- =============================================================================

SELECT
  '==================== VALIDATION SUMMARY ====================' AS summary;

SELECT
  'All tests completed. Check results above.' AS message,
  'Expected: All tests should show PASS status' AS expected,
  'If any tests show FAIL, review the specific test details' AS action;

-- =============================================================================
-- RECOMMENDATIONS
-- =============================================================================

SELECT
  '==================== RECOMMENDATIONS ====================' AS recommendations;

-- Tables that might need tenant_id but don't have it
SELECT
  'Tables that might need review:' AS category,
  array_agg(tablename) AS tables
FROM pg_tables pt
WHERE schemaname = 'public'
  AND tablename NOT LIKE '_backup_%'
  AND tablename NOT LIKE 'code_%'
  AND tablename NOT LIKE 'tenants'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = pt.tablename
      AND c.column_name = 'tenant_id'
  )
LIMIT 1;

-- Tables with tenant_id but nullable
SELECT
  'Tables with nullable tenant_id (should be NOT NULL):' AS category,
  array_agg(table_name) AS tables
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'tenant_id'
  AND is_nullable = 'YES'
  AND table_name NOT LIKE '_backup_%'
LIMIT 1;

SELECT
  '==================== END OF VALIDATION ====================' AS end_marker;
