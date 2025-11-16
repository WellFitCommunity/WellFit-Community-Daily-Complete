-- ============================================================================
-- Check-In Streak Calculation Function
-- ============================================================================
-- Purpose: Calculate consecutive daily check-in streak for provider wellness gamification
-- Author: Healthcare Workflow Engineer
-- Date: 2025-10-30
-- ============================================================================

-- Function to calculate check-in streak (consecutive days with check-ins)
CREATE OR REPLACE FUNCTION calculate_checkin_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  streak_count INTEGER := 0;
  check_date DATE := CURRENT_DATE;
  has_checkin BOOLEAN;
BEGIN
  -- Count consecutive days with check-ins, working backwards from today
  LOOP
    -- Check if there's a check-in for this date
    SELECT EXISTS (
      SELECT 1
      FROM provider_daily_checkins
      WHERE user_id = p_user_id
        AND checkin_date = check_date
    ) INTO has_checkin;

    -- If no check-in found, break the streak
    EXIT WHEN NOT has_checkin;

    -- Increment streak count
    streak_count := streak_count + 1;

    -- Move to previous day
    check_date := check_date - INTERVAL '1 day';

    -- Safety limit: don't check more than 365 days back
    EXIT WHEN streak_count >= 365;
  END LOOP;

  RETURN streak_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_checkin_streak(UUID) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION calculate_checkin_streak(UUID) IS
  'Calculates the number of consecutive days (including today) that a provider has completed daily check-ins. Used for wellness gamification.';

-- ============================================================================
-- Update getDashboardStats to use this function
-- ============================================================================
-- Note: The resilienceHubService.ts will call this function to populate
-- the check_in_streak_days field in the dashboard stats
-- ============================================================================
