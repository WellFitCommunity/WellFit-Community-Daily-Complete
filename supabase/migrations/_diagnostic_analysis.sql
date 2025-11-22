-- ============================================================================
-- COMPREHENSIVE SUPABASE SECURITY & PERFORMANCE DIAGNOSTIC
-- Date: 2025-11-21
-- Purpose: Identify all security and performance issues for Postgres 17 upgrade
-- ============================================================================

-- ============================================================================
-- 1. CHECK POSTGRES VERSION
-- ============================================================================
\echo '================================================='
\echo '1. POSTGRES VERSION CHECK'
\echo '================================================='
SELECT version();
SHOW server_version;

-- ============================================================================
-- 2. FIND MISSING INDEXES (Performance Issue)
-- ============================================================================
\echo ''
\echo '================================================='
\echo '2. TABLES WITHOUT INDEXES ON FOREIGN KEYS'
\echo '================================================='
SELECT
    c.conrelid::regclass AS table_name,
    a.attname AS column_name,
    'CREATE INDEX idx_' || c.conrelid::regclass::text || '_' || a.attname ||
    ' ON ' || c.conrelid::regclass || '(' || a.attname || ');' AS suggested_index
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f' -- foreign key constraints
  AND c.conrelid::regclass::text LIKE 'public.%'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND a.attnum = ANY(i.indkey)
  )
ORDER BY table_name, column_name;

-- ============================================================================
-- 3. FIND TABLES WITH MANY ROWS BUT NO INDEXES
-- ============================================================================
\echo ''
\echo '================================================='
\echo '3. HIGH-VOLUME TABLES NEEDING INDEXES'
\echo '================================================='
SELECT
    schemaname,
    tablename,
    CASE
        WHEN n_live_tup > 10000 THEN 'CRITICAL - ' || n_live_tup || ' rows'
        WHEN n_live_tup > 1000 THEN 'HIGH - ' || n_live_tup || ' rows'
        ELSE 'MEDIUM - ' || n_live_tup || ' rows'
    END AS priority,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.tablename) AS index_count
FROM pg_stat_user_tables t
WHERE schemaname = 'public'
  AND n_live_tup > 100
ORDER BY n_live_tup DESC
LIMIT 20;

-- ============================================================================
-- 4. FIND MISSING FOREIGN KEY CONSTRAINTS
-- ============================================================================
\echo ''
\echo '================================================='
\echo '4. POTENTIAL MISSING FOREIGN KEY CONSTRAINTS'
\echo '================================================='
-- Find columns named *_id or *_user_id that might need FK constraints
SELECT
    t.table_name,
    c.column_name,
    c.data_type,
    'Potential FK to ' ||
    CASE
        WHEN c.column_name = 'user_id' THEN 'auth.users(id)'
        WHEN c.column_name LIKE '%_user_id' THEN 'auth.users(id)'
        WHEN c.column_name LIKE '%_id' THEN REPLACE(c.column_name, '_id', 's') || '(id)'
        ELSE 'unknown'
    END AS suggested_reference
FROM information_schema.columns c
JOIN information_schema.tables t ON c.table_name = t.table_name
WHERE t.table_schema = 'public'
  AND c.column_name LIKE '%_id'
  AND c.data_type = 'uuid'
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND kcu.table_name = c.table_name
      AND kcu.column_name = c.column_name
  )
ORDER BY t.table_name, c.column_name;

-- ============================================================================
-- 5. ANALYZE RLS POLICIES (Find Duplicates/Issues)
-- ============================================================================
\echo ''
\echo '================================================='
\echo '5. RLS POLICY ANALYSIS'
\echo '================================================='

-- Count RLS policies per table
SELECT
    schemaname,
    tablename,
    COUNT(*) as policy_count,
    CASE
        WHEN COUNT(*) > 6 THEN 'REVIEW - Too many policies'
        WHEN COUNT(*) = 0 THEN 'CRITICAL - No RLS policies'
        ELSE 'OK'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY policy_count DESC;

-- Find tables with RLS enabled but no policies
\echo ''
\echo 'Tables with RLS enabled but NO policies:'
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.tablename = pg_tables.tablename
  );

-- ============================================================================
-- 6. FIND TABLES WITHOUT RLS (Security Issue)
-- ============================================================================
\echo ''
\echo '================================================='
\echo '6. TABLES WITHOUT ROW LEVEL SECURITY'
\echo '================================================='
SELECT
    schemaname,
    tablename,
    'ALTER TABLE ' || schemaname || '.' || tablename || ' ENABLE ROW LEVEL SECURITY;' AS fix_command
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;

-- ============================================================================
-- 7. CHECK FOR FUNCTIONS WITHOUT SECURITY DEFINER/INVOKER
-- ============================================================================
\echo ''
\echo '================================================='
\echo '7. FUNCTION SECURITY SETTINGS'
\echo '================================================='
SELECT
    n.nspname as schema_name,
    p.proname as function_name,
    CASE p.prosecdef
        WHEN true THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END as security_type,
    pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname;

-- ============================================================================
-- 8. CHECK PG_CRON JOBS
-- ============================================================================
\echo ''
\echo '================================================='
\echo '8. SCHEDULED JOBS (pg_cron)'
\echo '================================================='
SELECT
    jobid,
    schedule,
    command,
    active,
    jobname
FROM cron.job
ORDER BY jobid;

-- ============================================================================
-- 9. CHECK FOR INEFFICIENT TRIGGERS
-- ============================================================================
\echo ''
\echo '================================================='
\echo '9. TRIGGER ANALYSIS'
\echo '================================================='
SELECT
    schemaname,
    tablename,
    COUNT(*) as trigger_count
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
GROUP BY schemaname, tablename
HAVING COUNT(*) > 3
ORDER BY trigger_count DESC;

-- ============================================================================
-- 10. FIND SLOW QUERIES (if pg_stat_statements is enabled)
-- ============================================================================
\echo ''
\echo '================================================='
\echo '10. EXTENSION CHECK'
\echo '================================================='
SELECT
    extname as extension_name,
    extversion as version
FROM pg_extension
WHERE extname IN ('pgcrypto', 'pg_cron', 'pg_stat_statements', 'uuid-ossp', 'pg_trgm')
ORDER BY extname;

-- ============================================================================
-- 11. CHECK TABLE BLOAT
-- ============================================================================
\echo ''
\echo '================================================='
\echo '11. TABLE SIZE AND BLOAT ANALYSIS'
\echo '================================================='
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size,
    n_dead_tup,
    n_live_tup,
    CASE
        WHEN n_live_tup > 0 THEN ROUND(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
        ELSE 0
    END AS dead_tuple_percent
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND (n_dead_tup > 1000 OR pg_total_relation_size(schemaname||'.'||tablename) > 1024*1024)
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- ============================================================================
-- 12. SECURITY: CHECK FOR UNENCRYPTED PHI COLUMNS
-- ============================================================================
\echo ''
\echo '================================================='
\echo '12. POTENTIAL PHI COLUMNS (Review for Encryption)'
\echo '================================================='
SELECT
    table_name,
    column_name,
    data_type,
    'Potential PHI - consider encryption' as note
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    column_name ILIKE '%name%' OR
    column_name ILIKE '%phone%' OR
    column_name ILIKE '%email%' OR
    column_name ILIKE '%address%' OR
    column_name ILIKE '%ssn%' OR
    column_name ILIKE '%dob%' OR
    column_name ILIKE '%birth%' OR
    column_name ILIKE '%medical%' OR
    column_name ILIKE '%diagnosis%' OR
    column_name ILIKE '%note%'
  )
  AND data_type IN ('text', 'character varying', 'varchar', 'char')
ORDER BY table_name, column_name;

\echo ''
\echo '================================================='
\echo 'DIAGNOSTIC COMPLETE'
\echo '================================================='
