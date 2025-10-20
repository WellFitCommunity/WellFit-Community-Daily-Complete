-- =====================================================================
-- Grant Basic Permissions to admin_usage_tracking and claude_usage_logs
-- =====================================================================

-- The issue: RLS policies exist but the authenticated role doesn't have
-- basic SELECT/INSERT/UPDATE permissions on the tables

-- Grant permissions to authenticated users for admin_usage_tracking
GRANT SELECT, INSERT, UPDATE ON TABLE public.admin_usage_tracking TO authenticated;

-- Grant permissions to authenticated users for claude_usage_logs
GRANT SELECT, INSERT ON TABLE public.claude_usage_logs TO authenticated;

-- Grant permissions to anon users as well (for public access if needed)
GRANT SELECT, INSERT ON TABLE public.admin_usage_tracking TO anon;
GRANT SELECT, INSERT ON TABLE public.claude_usage_logs TO anon;

-- =====================================================================
-- Migration Complete
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Granted table permissions for admin_usage_tracking and claude_usage_logs';
  RAISE NOTICE '   - authenticated role can now SELECT, INSERT, UPDATE';
  RAISE NOTICE '   - anon role can SELECT, INSERT';
  RAISE NOTICE '   - RLS policies will now properly restrict access';
END $$;
