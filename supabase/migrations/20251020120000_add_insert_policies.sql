-- =====================================================================
-- Add INSERT Policies for Admin Usage Tracking and Claude Usage Logs
-- =====================================================================

-- For admin_usage_tracking: Allow users to insert their own tracking data
DROP POLICY IF EXISTS "Users can insert own usage data" ON admin_usage_tracking;

CREATE POLICY "Users can insert own usage data"
  ON admin_usage_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- For claude_usage_logs: Allow users to insert their own logs
DROP POLICY IF EXISTS "Users can insert own Claude usage logs" ON claude_usage_logs;

CREATE POLICY "Users can insert own Claude usage logs"
  ON claude_usage_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =====================================================================
-- Migration Complete
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ INSERT policies added for admin_usage_tracking and claude_usage_logs';
  RAISE NOTICE '   - Users can now insert their own tracking data';
  RAISE NOTICE '   - Users can now insert their own usage logs';
END $$;
