-- ============================================================================
-- SECURITY FEATURES AUDIT
-- Checks which features from skipped SOC2/security migrations are implemented
-- Date: 2025-11-16
-- ============================================================================

-- ============================================================================
-- SECTION 1: ENCRYPTION FUNCTIONS
-- ============================================================================
SELECT
  '=== ENCRYPTION FUNCTIONS ===' AS section,
  routine_name,
  routine_type,
  data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%encrypt%' OR routine_name LIKE '%decrypt%')
ORDER BY routine_name;

-- ============================================================================
-- SECTION 2: AUDIT TRIGGERS
-- ============================================================================
SELECT
  '=== AUDIT TRIGGERS ===' AS section,
  event_object_table AS table_name,
  trigger_name,
  event_manipulation AS trigger_event,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (trigger_name LIKE '%audit%' OR trigger_name LIKE '%log%')
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- SECTION 3: SECURITY TABLES
-- ============================================================================
SELECT
  '=== SECURITY TABLES ===' AS section,
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%audit%'
    OR table_name LIKE '%security%'
    OR table_name LIKE '%rate_limit%'
    OR table_name LIKE '%mfa%'
    OR table_name LIKE '%backup%'
    OR table_name LIKE '%alert%'
  )
ORDER BY table_name;

-- ============================================================================
-- SECTION 4: MFA CONFIGURATION
-- ============================================================================
SELECT
  '=== MFA STATUS ===' AS section,
  COUNT(*) AS total_users,
  COUNT(CASE WHEN id IN (SELECT user_id FROM auth.mfa_factors) THEN 1 END) AS users_with_mfa,
  ROUND(
    100.0 * COUNT(CASE WHEN id IN (SELECT user_id FROM auth.mfa_factors) THEN 1 END) / NULLIF(COUNT(*), 0),
    2
  ) AS mfa_percentage
FROM auth.users;

-- ============================================================================
-- SECTION 5: RLS POLICIES COUNT
-- ============================================================================
SELECT
  '=== RLS POLICIES ===' AS section,
  schemaname,
  tablename,
  COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY policy_count DESC, tablename
LIMIT 20;

-- ============================================================================
-- SECTION 6: FOREIGN KEY INDEXES
-- ============================================================================
SELECT
  '=== FOREIGN KEY INDEXES ===' AS section,
  COUNT(*) AS total_fk_indexes
FROM pg_indexes
WHERE schemaname = 'public'
  AND (indexname LIKE '%fkey%' OR indexname LIKE '%_fk_%');

-- ============================================================================
-- SECTION 7: PERFORMANCE INDEXES
-- ============================================================================
SELECT
  '=== PERFORMANCE INDEXES ===' AS section,
  tablename,
  COUNT(*) AS index_count
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
HAVING COUNT(*) > 1
ORDER BY index_count DESC
LIMIT 15;

-- ============================================================================
-- SECTION 8: MATERIALIZED VIEWS
-- ============================================================================
SELECT
  '=== MATERIALIZED VIEWS ===' AS section,
  schemaname,
  matviewname,
  hasindexes
FROM pg_matviews
WHERE schemaname = 'public'
ORDER BY matviewname;

-- ============================================================================
-- SECTION 9: STORAGE/VAULT USAGE
-- ============================================================================
SELECT
  '=== STORAGE BUCKETS ===' AS section,
  id AS bucket_id,
  name AS bucket_name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
ORDER BY name;

-- ============================================================================
-- SECTION 10: CRON JOBS (if pg_cron is enabled)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron is installed';
  ELSE
    RAISE NOTICE 'pg_cron is NOT installed';
  END IF;
END $$;

-- Try to check cron jobs (will error gracefully if pg_cron not installed)
SELECT
  '=== CRON JOBS ===' AS section,
  jobid,
  schedule,
  command,
  active
FROM cron.job
WHERE TRUE
ORDER BY jobid;
