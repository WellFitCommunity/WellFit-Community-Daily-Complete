-- ============================================================================
-- TIME CLOCK: Employee time tracking for payroll
-- ============================================================================
-- A positive, non-punitive time tracking system that celebrates on-time arrivals
-- and provides payroll data without being Big Brother.
--
-- Features:
--   - Clock in/out tracking with optional location
--   - On-time detection with celebration triggers
--   - Streak tracking for gamification
--   - Manager visibility for payroll purposes
-- ============================================================================

-- ============================================================================
-- 1. TIME CLOCK ENTRIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS time_clock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to employee
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  employee_profile_id UUID REFERENCES employee_profiles(id) ON DELETE SET NULL,

  -- Multi-tenant support
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,

  -- =========================================================================
  -- CLOCK TIMES
  -- =========================================================================
  clock_in_time TIMESTAMPTZ NOT NULL,
  clock_out_time TIMESTAMPTZ,

  -- For on-time detection (optional - set from employee's default schedule)
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,

  -- =========================================================================
  -- STATUS & CALCULATIONS
  -- =========================================================================
  status TEXT DEFAULT 'clocked_in' CHECK (status IN (
    'clocked_in',      -- Currently working
    'clocked_out',     -- Completed shift
    'on_break',        -- On break (for future use)
    'auto_closed'      -- System closed (forgot to clock out)
  )),

  -- Calculated on clock out
  total_minutes INTEGER,
  total_hours NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_minutes IS NOT NULL
    THEN ROUND(total_minutes / 60.0, 2)
    ELSE NULL END
  ) STORED,

  -- On-time celebration trigger
  was_on_time BOOLEAN,
  minutes_early INTEGER,  -- Positive = early, negative = late

  -- =========================================================================
  -- OPTIONAL METADATA
  -- =========================================================================
  location TEXT,                    -- Office, remote, etc.
  notes TEXT,                       -- Optional notes (PTO, dr appt, etc.)
  ip_address INET,                  -- For audit purposes
  user_agent TEXT,                  -- Device info

  -- =========================================================================
  -- AUDIT FIELDS
  -- =========================================================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add documentation
COMMENT ON TABLE time_clock_entries IS 'Employee time clock entries for tracking work hours and payroll';
COMMENT ON COLUMN time_clock_entries.scheduled_start IS 'Expected shift start time for on-time calculation';
COMMENT ON COLUMN time_clock_entries.was_on_time IS 'True if clocked in on/before scheduled_start (celebration trigger!)';
COMMENT ON COLUMN time_clock_entries.minutes_early IS 'Positive = early, negative = late. NULL if no scheduled_start';
COMMENT ON COLUMN time_clock_entries.total_hours IS 'Auto-calculated from total_minutes on clock out';

-- ============================================================================
-- 2. TIME CLOCK STREAKS TABLE (GAMIFICATION)
-- ============================================================================
CREATE TABLE IF NOT EXISTS time_clock_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,

  -- Current streak
  current_streak INTEGER DEFAULT 0,
  streak_start_date DATE,
  last_on_time_date DATE,

  -- Best streak ever (bragging rights!)
  best_streak INTEGER DEFAULT 0,
  best_streak_start_date DATE,
  best_streak_end_date DATE,

  -- Stats
  total_on_time_days INTEGER DEFAULT 0,
  total_work_days INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One streak record per user per tenant
  UNIQUE (user_id, tenant_id)
);

COMMENT ON TABLE time_clock_streaks IS 'Tracks consecutive on-time days for gamification - celebrates consistency!';
COMMENT ON COLUMN time_clock_streaks.current_streak IS 'Current consecutive on-time days';
COMMENT ON COLUMN time_clock_streaks.best_streak IS 'Personal best streak (bragging rights!)';

-- ============================================================================
-- 3. TIME CLOCK SETTINGS TABLE (PER TENANT)
-- ============================================================================
CREATE TABLE IF NOT EXISTS time_clock_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

  -- Grace period for on-time (minutes after scheduled start still counts as on-time)
  grace_period_minutes INTEGER DEFAULT 5,

  -- Auto-close entries after X hours if forgot to clock out
  auto_close_after_hours INTEGER DEFAULT 12,

  -- Default work day (for employees without scheduled shifts)
  default_shift_start TIME DEFAULT '09:00:00',
  default_shift_end TIME DEFAULT '17:00:00',

  -- Celebration messages (JSON array of strings)
  celebration_messages JSONB DEFAULT '["Great start to the day! 🎉", "Right on time! 👏", "Crushing it! 💪", "Early bird gets the worm! 🐛", "You''re on fire! 🔥"]'::jsonb,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE time_clock_settings IS 'Tenant-level settings for time clock feature';
COMMENT ON COLUMN time_clock_settings.grace_period_minutes IS 'Minutes after scheduled start that still counts as on-time';

-- ============================================================================
-- 4. INDEXES
-- ============================================================================
-- Time clock entries
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_user_id ON time_clock_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_tenant_id ON time_clock_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_employee_profile_id ON time_clock_entries(employee_profile_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_clock_in_time ON time_clock_entries(clock_in_time);
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_status ON time_clock_entries(status);
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_date ON time_clock_entries((clock_in_time::date));

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_user_date
  ON time_clock_entries(user_id, clock_in_time DESC);
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_tenant_date
  ON time_clock_entries(tenant_id, clock_in_time DESC);

-- Streaks
CREATE INDEX IF NOT EXISTS idx_time_clock_streaks_user_id ON time_clock_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_streaks_tenant_id ON time_clock_streaks(tenant_id);

-- ============================================================================
-- 5. ENABLE RLS
-- ============================================================================
ALTER TABLE time_clock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_clock_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_clock_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES - TIME CLOCK ENTRIES
-- ============================================================================

-- Employees can view their own entries
CREATE POLICY time_clock_entries_select_own ON time_clock_entries
  FOR SELECT
  USING (user_id = auth.uid());

-- Managers can view their direct reports' entries
CREATE POLICY time_clock_entries_select_reports ON time_clock_entries
  FOR SELECT
  USING (
    user_id IN (
      SELECT user_id FROM employee_profiles
      WHERE manager_id IN (
        SELECT id FROM employee_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Admins can view all entries in their tenant
CREATE POLICY time_clock_entries_select_admin ON time_clock_entries
  FOR SELECT
  USING (
    tenant_id = get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role_code IN (1, 2)  -- SUPER_ADMIN, ADMIN
    )
  );

-- Employees can clock in (insert their own entries)
CREATE POLICY time_clock_entries_insert_own ON time_clock_entries
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = get_current_tenant_id()
  );

-- Employees can update their own entries (clock out, add notes)
CREATE POLICY time_clock_entries_update_own ON time_clock_entries
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can update any entry (corrections)
CREATE POLICY time_clock_entries_update_admin ON time_clock_entries
  FOR UPDATE
  USING (
    tenant_id = get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role_code IN (1, 2)
    )
  );

-- ============================================================================
-- 7. RLS POLICIES - TIME CLOCK STREAKS
-- ============================================================================

-- Users can view their own streak
CREATE POLICY time_clock_streaks_select_own ON time_clock_streaks
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all streaks (leaderboards)
CREATE POLICY time_clock_streaks_select_admin ON time_clock_streaks
  FOR SELECT
  USING (
    tenant_id = get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role_code IN (1, 2)
    )
  );

-- System can insert/update streaks
CREATE POLICY time_clock_streaks_insert ON time_clock_streaks
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY time_clock_streaks_update ON time_clock_streaks
  FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================================
-- 8. RLS POLICIES - TIME CLOCK SETTINGS
-- ============================================================================

-- Anyone in tenant can read settings
CREATE POLICY time_clock_settings_select ON time_clock_settings
  FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- Only admins can modify settings
CREATE POLICY time_clock_settings_insert_admin ON time_clock_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role_code IN (1, 2)
    )
  );

CREATE POLICY time_clock_settings_update_admin ON time_clock_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role_code IN (1, 2)
    )
  );

-- ============================================================================
-- 9. UPDATED_AT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_time_clock_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_time_clock_entries_updated_at ON time_clock_entries;
CREATE TRIGGER trigger_time_clock_entries_updated_at
  BEFORE UPDATE ON time_clock_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_time_clock_entries_updated_at();

CREATE OR REPLACE FUNCTION update_time_clock_streaks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_time_clock_streaks_updated_at ON time_clock_streaks;
CREATE TRIGGER trigger_time_clock_streaks_updated_at
  BEFORE UPDATE ON time_clock_streaks
  FOR EACH ROW
  EXECUTE FUNCTION update_time_clock_streaks_updated_at();

CREATE OR REPLACE FUNCTION update_time_clock_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_time_clock_settings_updated_at ON time_clock_settings;
CREATE TRIGGER trigger_time_clock_settings_updated_at
  BEFORE UPDATE ON time_clock_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_time_clock_settings_updated_at();

-- ============================================================================
-- 10. HELPER FUNCTIONS
-- ============================================================================

-- Clock in function
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
BEGIN
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

-- Clock out function
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
  v_total_minutes INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Get clock in time
  SELECT clock_in_time INTO v_clock_in_time
  FROM time_clock_entries
  WHERE id = p_entry_id AND status = 'clocked_in';

  IF v_clock_in_time IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0.00::NUMERIC, 'Entry not found or already clocked out'::TEXT;
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

-- Get today's entry for a user
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
BEGIN
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

-- Get weekly summary
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
BEGIN
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

-- Get time entries for date range (for history view)
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
BEGIN
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
-- 11. GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON time_clock_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON time_clock_streaks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON time_clock_settings TO authenticated;

GRANT EXECUTE ON FUNCTION clock_in(UUID, UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION clock_out(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_todays_time_entry(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_weekly_time_summary(UUID, UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_time_entries(UUID, UUID, DATE, DATE, INTEGER) TO authenticated;

-- ============================================================================
-- 12. INSERT DEFAULT SETTINGS FOR EXISTING TENANTS
-- ============================================================================
INSERT INTO time_clock_settings (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
