-- ============================================================================
-- TIME CLOCK SECURITY FIX: Validate auth.uid() in SECURITY DEFINER functions
-- ============================================================================
-- CRITICAL: The original clock_in/clock_out RPCs accepted user-supplied IDs
-- without validating they match auth.uid(). This allowed any authenticated
-- user to clock in/out as another user or in another tenant.
-- ============================================================================

-- ============================================================================
-- 1. SECURE clock_in FUNCTION
-- ============================================================================
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
  v_user_tenant_id UUID;
BEGIN
  -- =========================================================================
  -- SECURITY: Validate caller identity
  -- =========================================================================
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot clock in as another user';
  END IF;

  -- Verify caller belongs to the specified tenant
  SELECT tenant_id INTO v_user_tenant_id
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_user_tenant_id IS NULL OR v_user_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'Invalid tenant for current user';
  END IF;

  -- Check if already clocked in today
  IF EXISTS (
    SELECT 1 FROM time_clock_entries
    WHERE user_id = p_user_id
      AND tenant_id = p_tenant_id
      AND status = 'clocked_in'
      AND clock_in_time::date = CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'Already clocked in today';
  END IF;

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

  -- Update streak if on time
  IF v_was_on_time THEN
    INSERT INTO time_clock_streaks (user_id, tenant_id, current_streak, streak_start_date, last_on_time_date, total_on_time_days, total_work_days)
    VALUES (p_user_id, p_tenant_id, 1, CURRENT_DATE, CURRENT_DATE, 1, 1)
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET
      current_streak = CASE
        WHEN time_clock_streaks.last_on_time_date = CURRENT_DATE - INTERVAL '1 day'
        THEN time_clock_streaks.current_streak + 1
        WHEN time_clock_streaks.last_on_time_date = CURRENT_DATE
        THEN time_clock_streaks.current_streak
        ELSE 1
      END,
      streak_start_date = CASE
        WHEN time_clock_streaks.last_on_time_date = CURRENT_DATE - INTERVAL '1 day'
        THEN time_clock_streaks.streak_start_date
        WHEN time_clock_streaks.last_on_time_date = CURRENT_DATE
        THEN time_clock_streaks.streak_start_date
        ELSE CURRENT_DATE
      END,
      last_on_time_date = CURRENT_DATE,
      total_on_time_days = time_clock_streaks.total_on_time_days +
        CASE WHEN time_clock_streaks.last_on_time_date = CURRENT_DATE THEN 0 ELSE 1 END,
      total_work_days = time_clock_streaks.total_work_days +
        CASE WHEN time_clock_streaks.last_on_time_date = CURRENT_DATE THEN 0 ELSE 1 END,
      best_streak = GREATEST(
        time_clock_streaks.best_streak,
        CASE
          WHEN time_clock_streaks.last_on_time_date = CURRENT_DATE - INTERVAL '1 day'
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
-- 2. SECURE clock_out FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION clock_out(
  p_entry_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  total_minutes INTEGER,
  total_hours NUMERIC,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clock_in_time TIMESTAMPTZ;
  v_entry_user_id UUID;
  v_total_minutes INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- =========================================================================
  -- SECURITY: Validate caller identity
  -- =========================================================================
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0.00::NUMERIC, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  -- Get entry and verify ownership
  SELECT clock_in_time, user_id INTO v_clock_in_time, v_entry_user_id
  FROM time_clock_entries
  WHERE id = p_entry_id AND status = 'clocked_in';

  IF v_clock_in_time IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0.00::NUMERIC, 'Entry not found or already clocked out'::TEXT;
    RETURN;
  END IF;

  -- Verify the entry belongs to the caller
  IF v_entry_user_id != auth.uid() THEN
    RETURN QUERY SELECT FALSE, 0, 0.00::NUMERIC, 'Cannot clock out another user''s entry'::TEXT;
    RETURN;
  END IF;

  -- Calculate minutes
  v_total_minutes := EXTRACT(EPOCH FROM (v_now - v_clock_in_time)) / 60;

  -- Update the entry
  UPDATE time_clock_entries
  SET
    clock_out_time = v_now,
    total_minutes = v_total_minutes,
    status = 'clocked_out',
    notes = COALESCE(p_notes, notes)
  WHERE id = p_entry_id;

  RETURN QUERY SELECT
    TRUE,
    v_total_minutes,
    ROUND(v_total_minutes / 60.0, 2)::NUMERIC,
    'Clocked out successfully! You worked ' ||
      FLOOR(v_total_minutes / 60) || ' hours and ' ||
      (v_total_minutes % 60) || ' minutes today.'::TEXT;
END;
$$;

-- ============================================================================
-- 3. SECURE get_todays_time_entry FUNCTION
-- ============================================================================
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
  v_user_tenant_id UUID;
BEGIN
  -- =========================================================================
  -- SECURITY: Validate caller identity
  -- =========================================================================
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot view another user''s time entry';
  END IF;

  -- Verify caller belongs to the specified tenant
  SELECT tenant_id INTO v_user_tenant_id
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_user_tenant_id IS NULL OR v_user_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'Invalid tenant for current user';
  END IF;

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
    AND e.clock_in_time::date = CURRENT_DATE
  ORDER BY e.clock_in_time DESC
  LIMIT 1;
END;
$$;

-- ============================================================================
-- 4. SECURE get_weekly_time_summary FUNCTION
-- ============================================================================
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
  v_week_start DATE := COALESCE(p_week_start, date_trunc('week', CURRENT_DATE)::date);
  v_user_tenant_id UUID;
BEGIN
  -- =========================================================================
  -- SECURITY: Validate caller identity
  -- =========================================================================
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot view another user''s time summary';
  END IF;

  -- Verify caller belongs to the specified tenant
  SELECT tenant_id INTO v_user_tenant_id
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_user_tenant_id IS NULL OR v_user_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'Invalid tenant for current user';
  END IF;

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
    AND e.clock_in_time::date >= v_week_start
    AND e.clock_in_time::date < v_week_start + INTERVAL '7 days'
    AND e.status = 'clocked_out';
END;
$$;

-- ============================================================================
-- 5. SECURE get_time_entries FUNCTION
-- ============================================================================
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
  v_user_tenant_id UUID;
BEGIN
  -- =========================================================================
  -- SECURITY: Validate caller identity
  -- =========================================================================
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot view another user''s time entries';
  END IF;

  -- Verify caller belongs to the specified tenant
  SELECT tenant_id INTO v_user_tenant_id
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_user_tenant_id IS NULL OR v_user_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'Invalid tenant for current user';
  END IF;

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
    AND (p_start_date IS NULL OR e.clock_in_time::date >= p_start_date)
    AND (p_end_date IS NULL OR e.clock_in_time::date <= p_end_date)
  ORDER BY e.clock_in_time DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- 6. ADD ADMIN FUNCTIONS (with proper authorization)
-- ============================================================================

-- Get all tenant entries (for admin view)
CREATE OR REPLACE FUNCTION get_tenant_time_entries(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
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
  v_caller_tenant_id UUID;
  v_caller_role_code INTEGER;
BEGIN
  -- =========================================================================
  -- SECURITY: Validate caller is admin in the tenant
  -- =========================================================================
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT tenant_id, role_code INTO v_caller_tenant_id, v_caller_role_code
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_caller_tenant_id IS NULL OR v_caller_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'Invalid tenant for current user';
  END IF;

  -- Only admins (role_code 1, 2) or department heads (role_code 7) can view all entries
  IF v_caller_role_code NOT IN (1, 2, 7) THEN
    RAISE EXCEPTION 'Insufficient permissions to view tenant time entries';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.user_id,
    p.first_name,
    p.last_name,
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
  JOIN profiles p ON p.user_id = e.user_id
  WHERE e.tenant_id = p_tenant_id
    AND (p_start_date IS NULL OR e.clock_in_time::date >= p_start_date)
    AND (p_end_date IS NULL OR e.clock_in_time::date <= p_end_date)
  ORDER BY e.clock_in_time DESC
  LIMIT p_limit;
END;
$$;

-- Get team entries (for manager view - direct reports only)
CREATE OR REPLACE FUNCTION get_team_time_entries(
  p_manager_user_id UUID,
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
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
  v_caller_tenant_id UUID;
  v_manager_employee_id UUID;
BEGIN
  -- =========================================================================
  -- SECURITY: Validate caller identity
  -- =========================================================================
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() != p_manager_user_id THEN
    RAISE EXCEPTION 'Cannot view another manager''s team entries';
  END IF;

  SELECT tenant_id INTO v_caller_tenant_id
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_caller_tenant_id IS NULL OR v_caller_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'Invalid tenant for current user';
  END IF;

  -- Get the manager's employee profile ID
  SELECT id INTO v_manager_employee_id
  FROM employee_profiles
  WHERE user_id = p_manager_user_id AND tenant_id = p_tenant_id;

  IF v_manager_employee_id IS NULL THEN
    RAISE EXCEPTION 'Manager employee profile not found';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.user_id,
    p.first_name,
    p.last_name,
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
  JOIN profiles p ON p.user_id = e.user_id
  WHERE e.user_id IN (
    SELECT ep.user_id
    FROM employee_profiles ep
    WHERE ep.manager_id = v_manager_employee_id
  )
  AND e.tenant_id = p_tenant_id
  AND (p_start_date IS NULL OR e.clock_in_time::date >= p_start_date)
  AND (p_end_date IS NULL OR e.clock_in_time::date <= p_end_date)
  ORDER BY e.clock_in_time DESC;
END;
$$;

-- ============================================================================
-- 7. GRANT PERMISSIONS FOR NEW FUNCTIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_tenant_time_entries(UUID, DATE, DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_time_entries(UUID, UUID, DATE, DATE) TO authenticated;
