-- =====================================================================
-- Fix Admin Usage Tracking RLS - Simplified Approach
-- =====================================================================

-- The issue is that the subquery to profiles table might fail in RLS context
-- Let's create a simpler policy that just allows all authenticated users
-- to read and write their own data

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all usage data" ON admin_usage_tracking;
DROP POLICY IF EXISTS "Users can view own usage data" ON admin_usage_tracking;
DROP POLICY IF EXISTS "Users can insert own usage data" ON admin_usage_tracking;

-- Create new simplified policies
-- Allow users to SELECT their own usage data
DO $$ BEGIN
  CREATE POLICY "Users can read own usage data"
    ON admin_usage_tracking
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Allow users to INSERT their own usage data
DO $$ BEGIN
  CREATE POLICY "Users can insert own usage data"
    ON admin_usage_tracking
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Allow users to UPDATE their own usage data
DO $$ BEGIN
  CREATE POLICY "Users can update own usage data"
    ON admin_usage_tracking
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- =====================================================================
-- Same for claude_usage_logs
-- =====================================================================

DROP POLICY IF EXISTS "Admins can view all Claude usage logs" ON claude_usage_logs;
DROP POLICY IF EXISTS "Users can view own Claude usage logs" ON claude_usage_logs;
DROP POLICY IF EXISTS "Users can insert own Claude usage logs" ON claude_usage_logs;
DROP POLICY IF EXISTS "System can insert Claude usage logs" ON claude_usage_logs;

-- Create new simplified policies for claude_usage_logs
DO $$ BEGIN
  CREATE POLICY "Users can read own usage logs"
    ON claude_usage_logs
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own usage logs"
    ON claude_usage_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- =====================================================================
-- Migration Complete
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Simplified RLS policies for admin_usage_tracking and claude_usage_logs';
  RAISE NOTICE '   - Removed complex admin detection subquery';
  RAISE NOTICE '   - Users can now access their own data';
  RAISE NOTICE '   - Edge Functions can insert with user_id = NULL';
END $$;
