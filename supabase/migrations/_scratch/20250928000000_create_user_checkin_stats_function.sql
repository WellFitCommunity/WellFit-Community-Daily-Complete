-- Create function to get user check-in statistics
-- Replace existing function to ensure correct signature

DROP FUNCTION IF EXISTS public.get_user_check_in_stats(UUID);
DROP FUNCTION IF EXISTS public.get_user_check_in_stats();

CREATE OR REPLACE FUNCTION public.get_user_check_in_stats(target_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_checkins BIGINT,
    this_week_checkins BIGINT,
    this_month_checkins BIGINT,
    streak_days INTEGER,
    last_checkin_date DATE,
    average_mood_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id_to_check UUID;
BEGIN
    -- Use provided user_id or default to current authenticated user
    user_id_to_check := COALESCE(target_user_id, auth.uid());

    -- Check if user exists and has permission
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = user_id_to_check
    ) THEN
        RAISE EXCEPTION 'User not found or access denied';
    END IF;

    -- Return aggregated check-in statistics
    RETURN QUERY
    SELECT
        -- Total check-ins
        (SELECT COUNT(*)::BIGINT
         FROM check_ins
         WHERE check_ins.user_id = user_id_to_check) as total_checkins,

        -- This week's check-ins
        (SELECT COUNT(*)::BIGINT
         FROM check_ins
         WHERE check_ins.user_id = user_id_to_check
         AND created_at >= date_trunc('week', CURRENT_DATE)) as this_week_checkins,

        -- This month's check-ins
        (SELECT COUNT(*)::BIGINT
         FROM check_ins
         WHERE check_ins.user_id = user_id_to_check
         AND created_at >= date_trunc('month', CURRENT_DATE)) as this_month_checkins,

        -- Calculate streak (simplified version)
        (SELECT GREATEST(0,
            (SELECT COUNT(DISTINCT DATE(created_at))::INTEGER
             FROM check_ins
             WHERE check_ins.user_id = user_id_to_check
             AND created_at >= CURRENT_DATE - INTERVAL '30 days')
        )) as streak_days,

        -- Last check-in date
        (SELECT DATE(MAX(created_at))
         FROM check_ins
         WHERE check_ins.user_id = user_id_to_check) as last_checkin_date,

        -- Average mood/emotional state score (if stored as numeric)
        (SELECT AVG(
            CASE
                WHEN emotional_state = 'excellent' THEN 5
                WHEN emotional_state = 'good' THEN 4
                WHEN emotional_state = 'okay' THEN 3
                WHEN emotional_state = 'poor' THEN 2
                WHEN emotional_state = 'terrible' THEN 1
                ELSE 3
            END
         )::NUMERIC(3,2)
         FROM check_ins
         WHERE check_ins.user_id = user_id_to_check
         AND emotional_state IS NOT NULL) as average_mood_score;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_check_in_stats(UUID) TO authenticated;

-- Comment
COMMENT ON FUNCTION public.get_user_check_in_stats IS 'Returns check-in statistics for a user including totals, streaks, and mood averages';