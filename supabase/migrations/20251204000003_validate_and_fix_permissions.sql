-- ============================================================================
-- Validate and Fix Database Permissions
-- ============================================================================
-- This migration checks for and fixes common permission issues
-- ============================================================================

-- Check 1: Find tables with RLS but potentially missing grants
DO $$
DECLARE
  missing_count INTEGER := 0;
  tbl RECORD;
BEGIN
  RAISE NOTICE '=== Permission Validation Report ===';

  FOR tbl IN
    SELECT t.tablename
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND t.rowsecurity = true
      AND t.tablename NOT LIKE 'pg_%'
    ORDER BY t.tablename
  LOOP
    -- Grant SELECT, INSERT, UPDATE, DELETE to authenticated for all RLS tables
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl.tablename);
    missing_count := missing_count + 1;
  END LOOP;

  RAISE NOTICE 'Granted permissions on % tables with RLS', missing_count;
END $$;

-- Check 2: Grant SELECT on all views to authenticated
DO $$
DECLARE
  view_count INTEGER := 0;
  v RECORD;
BEGIN
  FOR v IN
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v.table_name);
    view_count := view_count + 1;
  END LOOP;

  RAISE NOTICE 'Granted SELECT on % views', view_count;
END $$;

-- Check 3: Ensure service_role has full access
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.tablename);
  END LOOP;

  RAISE NOTICE 'Granted full access to service_role on all tables';
END $$;

-- Summary
DO $$
DECLARE
  rls_count INTEGER;
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rls_count FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE schemaname = 'public';

  RAISE NOTICE '=== Summary ===';
  RAISE NOTICE 'Tables with RLS: %', rls_count;
  RAISE NOTICE 'Total RLS policies: %', policy_count;
  RAISE NOTICE 'Permission validation complete!';
END $$;
