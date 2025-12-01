-- ============================================================================
-- TIME CLOCK TIMEZONE SUPPORT
-- ============================================================================
-- Updates time clock functions to use tenant's configured timezone for
-- date-based calculations (streaks, "today's entry", weekly summaries).
--
-- This ensures an employee in Pacific time clocking in at 11pm sees it as
-- "today" rather than "tomorrow" (which would happen if server is in Eastern).
-- ============================================================================

-- ============================================================================
-- 1. UPDATE CLOCK_IN FUNCTION
-- ============================================================================
-- Uses tenant_local_date() instead of CURRENT_DATE for streak calculations

CREATE OR REPLACE FUNCTION clock_in(
  p_user_id UUID,
  p_tenant_id UUID,
  p_location TEXT DEFAULT NULL,
  p_scheduled_start TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  entry_id UUID,
  was_on_time BOOLEAN,
  minutes_early INTEGER,
  current_streak INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry_id UUID;
  v_was_on_time BOOLEAN := TRUE;
  v_minutes_early INTEGER := 0;
  v_grace_period INTEGER := 5;
  v_employee_profile_id UUID;
  v_current_streak INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_today DATE;
  v_yesterday DATE;
BEGIN
  -- Validate user is clocking in for themselves
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot clock in for another user';
  END IF;

  -- Get today's date in tenant's timezone
  v_today := tenant_local_date(p_tenant_id);
  v_yesterday := v_today - INTERVAL '1 day';

  -- Get employee profile ID
  SELECT id INTO v_employee_profile_id
  FROM employee_profiles
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id;

  -- Get grace period from settings
  SELECT COALESCE(grace_period_minutes, 5) INTO v_grace_period
  FROM time_clock_settings
  WHERE tenant_id = p_tenant_id;

  -- Calculate on-time status
  IF p_scheduled_start IS NOT NULL THEN
    v_minutes_early := EXTRACT(EPOCH FROM (p_scheduled_start - v_now)) / 60;
    v_was_on_time := v_minutes_early >= -v_grace_period;
  END IF;

  -- Create the entry
  INSERT INTO time_clock_entries (
    user_id,
    employee_profile_id,
    tenant_id,
    clock_in_time,
    scheduled_start,
    location,
    was_on_time,
    minutes_early,
    status
  ) VALUES (
    p_user_id,
    v_employee_profile_id,
    p_tenant_id,
    v_now,
    p_scheduled_start,
    p_location,
    v_was_on_time,
    v_minutes_early,
    'clocked_in'
  )
  RETURNING id INTO v_entry_id;

  -- Update streak if on time (using tenant's local date)
  IF v_was_on_time THEN
    INSERT INTO time_clock_streaks (user_id, tenant_id, current_streak, streak_start_date, last_on_time_date, total_on_time_days, total_work_days)
    VALUES (p_user_id, p_tenant_id, 1, v_today, v_today, 1, 1)
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET
      current_streak = CASE
        WHEN time_clock_streaks.last_on_time_date = v_yesterday
        THEN time_clock_streaks.current_streak + 1
        WHEN time_clock_streaks.last_on_time_date = v_today
        THEN time_clock_streaks.current_streak
        ELSE 1
      END,
      streak_start_date = CASE
        WHEN time_clock_streaks.last_on_time_date = v_yesterday
        THEN time_clock_streaks.streak_start_date
        WHEN time_clock_streaks.last_on_time_date = v_today
        THEN time_clock_streaks.streak_start_date
        ELSE v_today
      END,
      last_on_time_date = v_today,
      total_on_time_days = time_clock_streaks.total_on_time_days +
        CASE WHEN time_clock_streaks.last_on_time_date = v_today THEN 0 ELSE 1 END,
      total_work_days = time_clock_streaks.total_work_days +
        CASE WHEN time_clock_streaks.last_on_time_date = v_today THEN 0 ELSE 1 END,
      best_streak = GREATEST(
        time_clock_streaks.best_streak,
        CASE
          WHEN time_clock_streaks.last_on_time_date = v_yesterday
          THEN time_clock_streaks.current_streak + 1
          ELSE 1
        END
      ),
      updated_at = NOW();
  END IF;

  -- Get current streak
  SELECT COALESCE(s.current_streak, 0) INTO v_current_streak
  FROM time_clock_streaks s
  WHERE s.user_id = p_user_id AND s.tenant_id = p_tenant_id;

  RETURN QUERY SELECT v_entry_id, v_was_on_time, v_minutes_early, v_current_streak;
END;
$$;

-- ============================================================================
-- 2. UPDATE GET_TODAYS_TIME_ENTRY FUNCTION
-- ============================================================================
-- Uses tenant's timezone for "today" determination

CREATE OR REPLACE FUNCTION get_todays_time_entry(p_user_id UUID, p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  clock_in_time TIMESTAMPTZ,
  clock_out_time TIMESTAMPTZ,
  status TEXT,
  was_on_time BOOLEAN,
  minutes_early INTEGER,
  total_minutes INTEGER,
  total_hours NUMERIC,
  notes TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE;
  v_tz TEXT;
BEGIN
  -- Get tenant's timezone and today's date
  v_tz := get_tenant_timezone(p_tenant_id);
  v_today := (NOW() AT TIME ZONE v_tz)::DATE;

  RETURN QUERY
  SELECT
    e.id,
    e.clock_in_time,
    e.clock_out_time,
    e.status,
    e.was_on_time,
    e.minutes_early,
    e.total_minutes,
    e.total_hours,
    e.notes
  FROM time_clock_entries e
  WHERE e.user_id = p_user_id
    AND e.tenant_id = p_tenant_id
    AND (e.clock_in_time AT TIME ZONE v_tz)::DATE = v_today
  ORDER BY e.clock_in_time DESC
  LIMIT 1;
END;
$$;

-- ============================================================================
-- 3. UPDATE GET_WEEKLY_TIME_SUMMARY FUNCTION
-- ============================================================================
-- Uses tenant's timezone for week calculations

CREATE OR REPLACE FUNCTION get_weekly_time_summary(
  p_user_id UUID,
  p_tenant_id UUID,
  p_week_start DATE DEFAULT NULL
)
RETURNS TABLE (
  week_start DATE,
  total_entries INTEGER,
  total_minutes INTEGER,
  total_hours NUMERIC,
  on_time_count INTEGER,
  on_time_percentage NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_week_start DATE;
  v_tz TEXT;
BEGIN
  -- Get tenant's timezone
  v_tz := get_tenant_timezone(p_tenant_id);

  -- Calculate week start in tenant's timezone
  v_week_start := COALESCE(
    p_week_start,
    date_trunc('week', (NOW() AT TIME ZONE v_tz))::DATE
  );

  RETURN QUERY
  SELECT
    v_week_start,
    COUNT(*)::INTEGER AS total_entries,
    COALESCE(SUM(e.total_minutes), 0)::INTEGER AS total_minutes,
    COALESCE(ROUND(SUM(e.total_minutes) / 60.0, 2), 0)::NUMERIC AS total_hours,
    COUNT(*) FILTER (WHERE e.was_on_time = TRUE)::INTEGER AS on_time_count,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND(COUNT(*) FILTER (WHERE e.was_on_time = TRUE) * 100.0 / COUNT(*), 0)
      ELSE 0
    END::NUMERIC AS on_time_percentage
  FROM time_clock_entries e
  WHERE e.user_id = p_user_id
    AND e.tenant_id = p_tenant_id
    AND (e.clock_in_time AT TIME ZONE v_tz)::DATE >= v_week_start
    AND (e.clock_in_time AT TIME ZONE v_tz)::DATE < v_week_start + INTERVAL '7 days'
    AND e.status = 'clocked_out';
END;
$$;

-- ============================================================================
-- 4. UPDATE GET_TIME_ENTRIES FUNCTION
-- ============================================================================
-- Uses tenant's timezone for date range filtering

CREATE OR REPLACE FUNCTION get_time_entries(
  p_user_id UUID,
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  clock_in_time TIMESTAMPTZ,
  clock_out_time TIMESTAMPTZ,
  status TEXT,
  was_on_time BOOLEAN,
  minutes_early INTEGER,
  total_minutes INTEGER,
  total_hours NUMERIC,
  location TEXT,
  notes TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_tz TEXT;
BEGIN
  -- Get tenant's timezone
  v_tz := get_tenant_timezone(p_tenant_id);

  RETURN QUERY
  SELECT
    e.id,
    e.clock_in_time,
    e.clock_out_time,
    e.status,
    e.was_on_time,
    e.minutes_early,
    e.total_minutes,
    e.total_hours,
    e.location,
    e.notes
  FROM time_clock_entries e
  WHERE e.user_id = p_user_id
    AND e.tenant_id = p_tenant_id
    AND (p_start_date IS NULL OR (e.clock_in_time AT TIME ZONE v_tz)::DATE >= p_start_date)
    AND (p_end_date IS NULL OR (e.clock_in_time AT TIME ZONE v_tz)::DATE <= p_end_date)
  ORDER BY e.clock_in_time DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- 5. ADD TIMEZONE INFO TO TIME CLOCK SETTINGS VIEW
-- ============================================================================
-- Helper view that includes tenant timezone with time clock settings

CREATE OR REPLACE VIEW time_clock_settings_with_timezone AS
SELECT
  tcs.*,
  t.timezone,
  COALESCE(t.timezone, 'America/Chicago') AS effective_timezone
FROM time_clock_settings tcs
JOIN tenants t ON t.id = tcs.tenant_id;

COMMENT ON VIEW time_clock_settings_with_timezone IS
'Time clock settings with tenant timezone for easy access in queries.';

GRANT SELECT ON time_clock_settings_with_timezone TO authenticated;
