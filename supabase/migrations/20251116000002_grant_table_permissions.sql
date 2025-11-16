-- ============================================================================
-- Grant Table Permissions for audit_logs and realtime_subscription_registry
-- ============================================================================
-- Purpose: Fix "permission denied for table" errors
-- Context: RLS policies require table-level GRANT permissions first
-- Date: 2025-11-16
-- Issue: Policies exist but roles lack table access
-- ============================================================================

-- ============================================================================
-- 1. GRANT PERMISSIONS ON audit_logs
-- ============================================================================

-- Grant INSERT to anon role (for pre-auth audit logging)
GRANT INSERT ON audit_logs TO anon;

-- Grant INSERT to authenticated role (for logged-in users)
GRANT INSERT ON audit_logs TO authenticated;

-- Grant SELECT to authenticated users (to view their own logs)
GRANT SELECT ON audit_logs TO authenticated;

-- Grant ALL to service_role (for Edge Functions)
GRANT ALL ON audit_logs TO service_role;

-- ============================================================================
-- 2. GRANT PERMISSIONS ON realtime_subscription_registry
-- ============================================================================

-- Grant INSERT, UPDATE, DELETE, SELECT to anon role (for pre-auth subscriptions)
GRANT INSERT, UPDATE, DELETE, SELECT ON realtime_subscription_registry TO anon;

-- Grant INSERT, UPDATE, DELETE, SELECT to authenticated role (for logged-in users)
GRANT INSERT, UPDATE, DELETE, SELECT ON realtime_subscription_registry TO authenticated;

-- Grant ALL to service_role (for Edge Functions)
GRANT ALL ON realtime_subscription_registry TO service_role;

-- ============================================================================
-- 3. VERIFY PERMISSIONS
-- ============================================================================

DO $$
DECLARE
  audit_anon_perms text;
  audit_auth_perms text;
  registry_anon_perms text;
  registry_auth_perms text;
BEGIN
  -- Get permissions for audit_logs
  SELECT array_to_string(array_agg(privilege_type), ', ')
  INTO audit_anon_perms
  FROM information_schema.table_privileges
  WHERE table_name = 'audit_logs' AND grantee = 'anon';

  SELECT array_to_string(array_agg(privilege_type), ', ')
  INTO audit_auth_perms
  FROM information_schema.table_privileges
  WHERE table_name = 'audit_logs' AND grantee = 'authenticated';

  -- Get permissions for realtime_subscription_registry
  SELECT array_to_string(array_agg(privilege_type), ', ')
  INTO registry_anon_perms
  FROM information_schema.table_privileges
  WHERE table_name = 'realtime_subscription_registry' AND grantee = 'anon';

  SELECT array_to_string(array_agg(privilege_type), ', ')
  INTO registry_auth_perms
  FROM information_schema.table_privileges
  WHERE table_name = 'realtime_subscription_registry' AND grantee = 'authenticated';

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Table Permissions Granted!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'audit_logs:';
  RAISE NOTICE '  - anon: %', COALESCE(audit_anon_perms, 'none');
  RAISE NOTICE '  - authenticated: %', COALESCE(audit_auth_perms, 'none');
  RAISE NOTICE '';
  RAISE NOTICE 'realtime_subscription_registry:';
  RAISE NOTICE '  - anon: %', COALESCE(registry_anon_perms, 'none');
  RAISE NOTICE '  - authenticated: %', COALESCE(registry_auth_perms, 'none');
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Expected behavior:';
  RAISE NOTICE '- Both anon and authenticated can INSERT into both tables';
  RAISE NOTICE '- RLS policies will further restrict based on user_id';
  RAISE NOTICE '- "permission denied" errors should be FIXED';
  RAISE NOTICE '=================================================================';
END $$;
