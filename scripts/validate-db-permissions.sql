-- =====================================================================
-- Database Permission Validation Script
-- =====================================================================
-- Purpose: Identify tables, views, and other objects that have RLS
-- enabled but lack proper authenticated role permissions
--
-- Usage: Run this script to audit permission issues
-- PGPASSWORD="..." psql -h ... -U ... -d ... -f validate-db-permissions.sql
-- =====================================================================

\echo '=================================================='
\echo 'WellFit Database Permission Validation Report'
\echo '=================================================='
\echo ''

-- ==================== Check 1: Tables with RLS but no permissions ====================
\echo '1. Checking tables with RLS but no authenticated permissions...'
\echo ''

SELECT
  '❌ Missing Permissions' as status,
  t.table_name,
  'RLS enabled but no authenticated access' as issue
FROM information_schema.tables t
LEFT JOIN information_schema.table_privileges tp
  ON t.table_name = tp.table_name
  AND t.table_schema = tp.table_schema
LEFT JOIN pg_tables
  ON pg_tables.tablename = t.table_name
  AND pg_tables.schemaname = t.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT LIKE 'pg_%'
  AND t.table_name NOT LIKE 'sql_%'
  AND pg_tables.rowsecurity = true
GROUP BY t.table_name
HAVING COUNT(DISTINCT CASE WHEN tp.grantee = 'authenticated'
  AND tp.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  THEN tp.privilege_type END) = 0
UNION ALL
SELECT
  '✅ All Good' as status,
  'No issues found' as table_name,
  '' as issue
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.tables t
  LEFT JOIN information_schema.table_privileges tp
    ON t.table_name = tp.table_name
    AND t.table_schema = tp.table_schema
  LEFT JOIN pg_tables
    ON pg_tables.tablename = t.table_name
    AND pg_tables.schemaname = t.table_schema
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND pg_tables.rowsecurity = true
  GROUP BY t.table_name
  HAVING COUNT(DISTINCT CASE WHEN tp.grantee = 'authenticated'
    AND tp.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    THEN tp.privilege_type END) = 0
);

\echo ''

-- ==================== Check 2: Views without SELECT permission ====================
\echo '2. Checking views without SELECT permission...'
\echo ''

SELECT
  '❌ Missing SELECT' as status,
  t.table_name as view_name,
  'View lacks authenticated SELECT' as issue
FROM information_schema.tables t
LEFT JOIN information_schema.table_privileges tp
  ON t.table_name = tp.table_name
  AND t.table_schema = tp.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type = 'VIEW'
  AND t.table_name NOT LIKE 'pg_%'
GROUP BY t.table_name
HAVING COUNT(DISTINCT CASE WHEN tp.grantee = 'authenticated'
  AND tp.privilege_type = 'SELECT' THEN 1 END) = 0
UNION ALL
SELECT
  '✅ All Good' as status,
  'No issues found' as view_name,
  '' as issue
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.tables t
  LEFT JOIN information_schema.table_privileges tp
    ON t.table_name = tp.table_name
    AND t.table_schema = tp.table_schema
  WHERE t.table_schema = 'public'
    AND t.table_type = 'VIEW'
    AND t.table_name NOT LIKE 'pg_%'
  GROUP BY t.table_name
  HAVING COUNT(DISTINCT CASE WHEN tp.grantee = 'authenticated'
    AND tp.privilege_type = 'SELECT' THEN 1 END) = 0
);

\echo ''

-- ==================== Check 3: RLS Policies Summary ====================
\echo '3. RLS Policy Summary...'
\echo ''

SELECT
  tablename,
  COUNT(*) as policy_count,
  STRING_AGG(DISTINCT cmd::text, ', ' ORDER BY cmd::text) as operations
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY policy_count DESC
LIMIT 20;

\echo ''

-- ==================== Check 4: Tables with RLS enabled ====================
\echo '4. Summary: Tables with RLS enabled...'
\echo ''

SELECT
  COUNT(*) as total_tables_with_rls,
  SUM(CASE WHEN policy_count > 0 THEN 1 ELSE 0 END) as tables_with_policies,
  SUM(CASE WHEN policy_count = 0 THEN 1 ELSE 0 END) as tables_without_policies
FROM (
  SELECT
    t.tablename,
    COUNT(p.policyname) as policy_count
  FROM pg_tables t
  LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
  WHERE t.schemaname = 'public'
    AND t.rowsecurity = true
  GROUP BY t.tablename
) as rls_summary;

\echo ''
\echo '=================================================='
\echo 'Validation Complete'
\echo '=================================================='
