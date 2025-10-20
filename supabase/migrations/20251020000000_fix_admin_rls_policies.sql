-- =====================================================================
-- Fix RLS Policies for Admin Access
-- Allows admins to view usage tracking and Claude logs
-- =====================================================================

-- Admin policy for admin_usage_tracking (view all for analytics)
DROP POLICY IF EXISTS "Admins can view all usage data" ON admin_usage_tracking;

CREATE POLICY "Admins can view all usage data"
  ON admin_usage_tracking
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Admin policy for claude_usage_logs (already exists but using user_roles)
-- Update to use profiles table for consistency
DROP POLICY IF EXISTS "Admins can view all Claude usage logs" ON claude_usage_logs;

CREATE POLICY "Admins can view all Claude usage logs"
  ON claude_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Users can also view their own Claude usage
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
  RAISE NOTICE '✅ Admin RLS policies fixed';
  RAISE NOTICE '   - Admins can now view all usage tracking data';
  RAISE NOTICE '   - Admins can now view all Claude usage logs';
  RAISE NOTICE '   - Users can view their own Claude usage logs';
END $$;
