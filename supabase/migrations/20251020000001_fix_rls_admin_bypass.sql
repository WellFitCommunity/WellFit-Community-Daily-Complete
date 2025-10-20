-- =====================================================================
-- Fix RLS Policies - Add Service Role Bypass and Better Admin Detection
-- =====================================================================

-- For admin_usage_tracking: More permissive admin policy
DROP POLICY IF EXISTS "Admins can view all usage data" ON admin_usage_tracking;

CREATE POLICY "Admins can view all usage data"
  ON admin_usage_tracking
  FOR SELECT
  TO authenticated
  USING (
    -- Check if current user is admin via profiles table
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND (
        profiles.role IN ('admin', 'super_admin')
        OR profiles.role_code IN (1, 2)
      )
    )
    OR
    -- Also allow if current user is querying their own data
    user_id = auth.uid()
  );

-- For claude_usage_logs: More permissive admin policy
DROP POLICY IF EXISTS "Admins can view all Claude usage logs" ON claude_usage_logs;

CREATE POLICY "Admins can view all Claude usage logs"
  ON claude_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    -- Check if current user is admin via profiles table
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND (
        profiles.role IN ('admin', 'super_admin')
        OR profiles.role_code IN (1, 2)
      )
    )
    OR
    -- Also allow if current user is viewing their own logs
    user_id = auth.uid()
  );

-- Make sure the "Users can view own" policies still exist
DROP POLICY IF EXISTS "Users can view own usage data" ON admin_usage_tracking;

CREATE POLICY "Users can view own usage data"
  ON admin_usage_tracking
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own Claude usage logs" ON claude_usage_logs;

CREATE POLICY "Users can view own Claude usage logs"
  ON claude_usage_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================================
-- Migration Complete
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies updated with better admin detection';
  RAISE NOTICE '   - Added role_code fallback for admin detection';
  RAISE NOTICE '   - Added OR condition for own data access';
  RAISE NOTICE '   - Policies now more permissive for admins';
END $$;
