-- Appointment Analytics System Migration
-- Provides aggregation functions for telehealth appointment analytics dashboard

-- ============================================================================
-- Function: get_appointment_analytics_summary
-- Purpose: Get overall appointment metrics for a time range
-- ============================================================================
CREATE OR REPLACE FUNCTION get_appointment_analytics_summary(
  p_tenant_id UUID DEFAULT NULL,
  p_provider_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_total INTEGER;
  v_completed INTEGER;
  v_no_shows INTEGER;
  v_cancelled INTEGER;
  v_in_progress INTEGER;
  v_scheduled INTEGER;
  v_confirmed INTEGER;
  v_days_in_range INTEGER;
  v_avg_duration NUMERIC;
  v_total_duration INTEGER;
BEGIN
  -- Calculate days in range
  v_days_in_range := GREATEST(1, EXTRACT(DAY FROM (p_end_date - p_start_date))::INTEGER);

  -- Get counts by status
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'no-show'),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*) FILTER (WHERE status = 'in-progress'),
    COUNT(*) FILTER (WHERE status = 'scheduled'),
    COUNT(*) FILTER (WHERE status = 'confirmed'),
    COALESCE(AVG(duration_minutes), 30),
    COALESCE(SUM(duration_minutes) FILTER (WHERE status = 'completed'), 0)
  INTO
    v_total,
    v_completed,
    v_no_shows,
    v_cancelled,
    v_in_progress,
    v_scheduled,
    v_confirmed,
    v_avg_duration,
    v_total_duration
  FROM telehealth_appointments
  WHERE appointment_time >= p_start_date
    AND appointment_time < p_end_date
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    AND (p_provider_id IS NULL OR provider_id = p_provider_id);

  -- Build result
  v_result := jsonb_build_object(
    'totalAppointments', v_total,
    'completed', v_completed,
    'noShows', v_no_shows,
    'cancelled', v_cancelled,
    'inProgress', v_in_progress,
    'scheduled', v_scheduled,
    'confirmed', v_confirmed,
    'completionRate', CASE WHEN v_total > 0
      THEN ROUND((v_completed::NUMERIC / v_total) * 100, 1)
      ELSE 0 END,
    'noShowRate', CASE WHEN v_total > 0
      THEN ROUND((v_no_shows::NUMERIC / v_total) * 100, 1)
      ELSE 0 END,
    'cancellationRate', CASE WHEN v_total > 0
      THEN ROUND((v_cancelled::NUMERIC / v_total) * 100, 1)
      ELSE 0 END,
    'avgAppointmentsPerDay', ROUND(v_total::NUMERIC / v_days_in_range, 1),
    'avgDurationMinutes', ROUND(v_avg_duration, 0),
    'totalHoursCompleted', ROUND(v_total_duration::NUMERIC / 60, 1),
    'daysInRange', v_days_in_range,
    'startDate', p_start_date,
    'endDate', p_end_date
  );

  RETURN v_result;
END;
$$;

-- ============================================================================
-- Function: get_appointment_trends
-- Purpose: Get appointment trends over time (daily aggregation)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_appointment_trends(
  p_tenant_id UUID DEFAULT NULL,
  p_provider_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_granularity TEXT DEFAULT 'day' -- 'day', 'week', 'month'
)
RETURNS TABLE (
  period_start DATE,
  period_label TEXT,
  total_appointments INTEGER,
  completed INTEGER,
  no_shows INTEGER,
  cancelled INTEGER,
  completion_rate NUMERIC,
  no_show_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT
      CASE
        WHEN p_granularity = 'week' THEN DATE_TRUNC('week', d)::DATE
        WHEN p_granularity = 'month' THEN DATE_TRUNC('month', d)::DATE
        ELSE d::DATE
      END AS period_date
    FROM generate_series(
      p_start_date::DATE,
      p_end_date::DATE,
      CASE
        WHEN p_granularity = 'week' THEN '1 week'::INTERVAL
        WHEN p_granularity = 'month' THEN '1 month'::INTERVAL
        ELSE '1 day'::INTERVAL
      END
    ) AS d
  ),
  appointment_counts AS (
    SELECT
      CASE
        WHEN p_granularity = 'week' THEN DATE_TRUNC('week', appointment_time)::DATE
        WHEN p_granularity = 'month' THEN DATE_TRUNC('month', appointment_time)::DATE
        ELSE appointment_time::DATE
      END AS period_date,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'completed') AS comp,
      COUNT(*) FILTER (WHERE status = 'no-show') AS ns,
      COUNT(*) FILTER (WHERE status = 'cancelled') AS canc
    FROM telehealth_appointments
    WHERE appointment_time >= p_start_date
      AND appointment_time < p_end_date
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
      AND (p_provider_id IS NULL OR provider_id = p_provider_id)
    GROUP BY 1
  )
  SELECT
    ds.period_date AS period_start,
    CASE
      WHEN p_granularity = 'week' THEN 'Week of ' || TO_CHAR(ds.period_date, 'Mon DD')
      WHEN p_granularity = 'month' THEN TO_CHAR(ds.period_date, 'Mon YYYY')
      ELSE TO_CHAR(ds.period_date, 'Mon DD')
    END AS period_label,
    COALESCE(ac.total, 0)::INTEGER AS total_appointments,
    COALESCE(ac.comp, 0)::INTEGER AS completed,
    COALESCE(ac.ns, 0)::INTEGER AS no_shows,
    COALESCE(ac.canc, 0)::INTEGER AS cancelled,
    CASE WHEN COALESCE(ac.total, 0) > 0
      THEN ROUND((COALESCE(ac.comp, 0)::NUMERIC / ac.total) * 100, 1)
      ELSE 0
    END AS completion_rate,
    CASE WHEN COALESCE(ac.total, 0) > 0
      THEN ROUND((COALESCE(ac.ns, 0)::NUMERIC / ac.total) * 100, 1)
      ELSE 0
    END AS no_show_rate
  FROM date_series ds
  LEFT JOIN appointment_counts ac ON ds.period_date = ac.period_date
  ORDER BY ds.period_date;
END;
$$;

-- ============================================================================
-- Function: get_provider_appointment_stats
-- Purpose: Get appointment statistics by provider
-- ============================================================================
CREATE OR REPLACE FUNCTION get_provider_appointment_stats(
  p_tenant_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  provider_email TEXT,
  total_appointments INTEGER,
  completed INTEGER,
  no_shows INTEGER,
  cancelled INTEGER,
  completion_rate NUMERIC,
  no_show_rate NUMERIC,
  total_hours NUMERIC,
  avg_duration_minutes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ta.provider_id,
    COALESCE(p.full_name, 'Unknown Provider') AS provider_name,
    COALESCE(p.email, '') AS provider_email,
    COUNT(*)::INTEGER AS total_appointments,
    COUNT(*) FILTER (WHERE ta.status = 'completed')::INTEGER AS completed,
    COUNT(*) FILTER (WHERE ta.status = 'no-show')::INTEGER AS no_shows,
    COUNT(*) FILTER (WHERE ta.status = 'cancelled')::INTEGER AS cancelled,
    CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE ta.status = 'completed')::NUMERIC / COUNT(*)) * 100, 1)
      ELSE 0
    END AS completion_rate,
    CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE ta.status = 'no-show')::NUMERIC / COUNT(*)) * 100, 1)
      ELSE 0
    END AS no_show_rate,
    ROUND(COALESCE(SUM(ta.duration_minutes) FILTER (WHERE ta.status = 'completed'), 0)::NUMERIC / 60, 1) AS total_hours,
    COALESCE(AVG(ta.duration_minutes)::INTEGER, 30) AS avg_duration_minutes
  FROM telehealth_appointments ta
  LEFT JOIN profiles p ON ta.provider_id = p.user_id
  WHERE ta.appointment_time >= p_start_date
    AND ta.appointment_time < p_end_date
    AND (p_tenant_id IS NULL OR ta.tenant_id = p_tenant_id)
  GROUP BY ta.provider_id, p.full_name, p.email
  ORDER BY COUNT(*) DESC;
END;
$$;

-- ============================================================================
-- Function: get_no_show_patterns
-- Purpose: Analyze no-show patterns by day of week and hour
-- ============================================================================
CREATE OR REPLACE FUNCTION get_no_show_patterns(
  p_tenant_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '90 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_by_day_of_week JSONB;
  v_by_hour JSONB;
  v_high_risk_patients JSONB;
BEGIN
  -- No-shows by day of week
  SELECT jsonb_agg(
    jsonb_build_object(
      'dayOfWeek', day_num,
      'dayName', day_name,
      'totalAppointments', total,
      'noShows', no_shows,
      'noShowRate', rate
    ) ORDER BY day_num
  )
  INTO v_by_day_of_week
  FROM (
    SELECT
      EXTRACT(DOW FROM appointment_time)::INTEGER AS day_num,
      TO_CHAR(appointment_time, 'Day') AS day_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'no-show') AS no_shows,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE status = 'no-show')::NUMERIC / COUNT(*)) * 100, 1)
        ELSE 0
      END AS rate
    FROM telehealth_appointments
    WHERE appointment_time >= p_start_date
      AND appointment_time < p_end_date
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    GROUP BY 1, 2
  ) sub;

  -- No-shows by hour of day
  SELECT jsonb_agg(
    jsonb_build_object(
      'hour', hour_num,
      'hourLabel', hour_label,
      'totalAppointments', total,
      'noShows', no_shows,
      'noShowRate', rate
    ) ORDER BY hour_num
  )
  INTO v_by_hour
  FROM (
    SELECT
      EXTRACT(HOUR FROM appointment_time)::INTEGER AS hour_num,
      TO_CHAR(appointment_time, 'HH12 AM') AS hour_label,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'no-show') AS no_shows,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE status = 'no-show')::NUMERIC / COUNT(*)) * 100, 1)
        ELSE 0
      END AS rate
    FROM telehealth_appointments
    WHERE appointment_time >= p_start_date
      AND appointment_time < p_end_date
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    GROUP BY 1, 2
  ) sub;

  -- High-risk patients (most no-shows)
  SELECT jsonb_agg(
    jsonb_build_object(
      'patientId', patient_id,
      'patientName', patient_name,
      'totalAppointments', total,
      'noShowCount', no_shows,
      'noShowRate', rate,
      'isRestricted', is_restricted
    ) ORDER BY no_shows DESC
  )
  INTO v_high_risk_patients
  FROM (
    SELECT
      ta.patient_id,
      COALESCE(p.full_name, 'Unknown') AS patient_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE ta.status = 'no-show') AS no_shows,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE ta.status = 'no-show')::NUMERIC / COUNT(*)) * 100, 1)
        ELSE 0
      END AS rate,
      COALESCE(pns.is_restricted, false) AS is_restricted
    FROM telehealth_appointments ta
    LEFT JOIN profiles p ON ta.patient_id = p.user_id
    LEFT JOIN patient_no_show_stats pns ON ta.patient_id = pns.patient_id
    WHERE ta.appointment_time >= p_start_date
      AND ta.appointment_time < p_end_date
      AND (p_tenant_id IS NULL OR ta.tenant_id = p_tenant_id)
    GROUP BY ta.patient_id, p.full_name, pns.is_restricted
    HAVING COUNT(*) FILTER (WHERE ta.status = 'no-show') > 0
    ORDER BY COUNT(*) FILTER (WHERE ta.status = 'no-show') DESC
    LIMIT 10
  ) sub;

  RETURN jsonb_build_object(
    'byDayOfWeek', COALESCE(v_by_day_of_week, '[]'::JSONB),
    'byHour', COALESCE(v_by_hour, '[]'::JSONB),
    'highRiskPatients', COALESCE(v_high_risk_patients, '[]'::JSONB)
  );
END;
$$;

-- ============================================================================
-- Function: get_appointment_status_breakdown
-- Purpose: Get detailed status breakdown with encounter types
-- ============================================================================
CREATE OR REPLACE FUNCTION get_appointment_status_breakdown(
  p_tenant_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  encounter_type TEXT,
  status TEXT,
  count INTEGER,
  percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  -- Get total for percentage calculation
  SELECT COUNT(*) INTO v_total
  FROM telehealth_appointments
  WHERE appointment_time >= p_start_date
    AND appointment_time < p_end_date
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

  RETURN QUERY
  SELECT
    COALESCE(ta.encounter_type, 'outpatient') AS encounter_type,
    ta.status,
    COUNT(*)::INTEGER AS count,
    CASE WHEN v_total > 0
      THEN ROUND((COUNT(*)::NUMERIC / v_total) * 100, 1)
      ELSE 0
    END AS percentage
  FROM telehealth_appointments ta
  WHERE ta.appointment_time >= p_start_date
    AND ta.appointment_time < p_end_date
    AND (p_tenant_id IS NULL OR ta.tenant_id = p_tenant_id)
  GROUP BY ta.encounter_type, ta.status
  ORDER BY ta.encounter_type, count DESC;
END;
$$;

-- ============================================================================
-- Function: get_rescheduling_analytics
-- Purpose: Analyze appointment rescheduling patterns
-- ============================================================================
CREATE OR REPLACE FUNCTION get_rescheduling_analytics(
  p_tenant_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_total_reschedules INTEGER;
  v_by_role JSONB;
  v_top_reasons JSONB;
  v_reschedule_outcomes JSONB;
BEGIN
  -- Total reschedules
  SELECT COUNT(*) INTO v_total_reschedules
  FROM appointment_history
  WHERE change_type = 'rescheduled'
    AND created_at >= p_start_date
    AND created_at < p_end_date
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

  -- By role
  SELECT jsonb_agg(
    jsonb_build_object(
      'role', changed_by_role,
      'count', cnt,
      'percentage', pct
    )
  )
  INTO v_by_role
  FROM (
    SELECT
      COALESCE(changed_by_role, 'unknown') AS changed_by_role,
      COUNT(*) AS cnt,
      CASE WHEN v_total_reschedules > 0
        THEN ROUND((COUNT(*)::NUMERIC / v_total_reschedules) * 100, 1)
        ELSE 0
      END AS pct
    FROM appointment_history
    WHERE change_type = 'rescheduled'
      AND created_at >= p_start_date
      AND created_at < p_end_date
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    GROUP BY changed_by_role
    ORDER BY cnt DESC
  ) sub;

  -- Top reasons
  SELECT jsonb_agg(
    jsonb_build_object(
      'reason', reason,
      'count', cnt
    )
  )
  INTO v_top_reasons
  FROM (
    SELECT
      COALESCE(change_reason, 'No reason provided') AS reason,
      COUNT(*) AS cnt
    FROM appointment_history
    WHERE change_type = 'rescheduled'
      AND created_at >= p_start_date
      AND created_at < p_end_date
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    GROUP BY change_reason
    ORDER BY cnt DESC
    LIMIT 5
  ) sub;

  -- Outcomes of rescheduled appointments
  SELECT jsonb_agg(
    jsonb_build_object(
      'status', status,
      'count', cnt,
      'percentage', pct
    )
  )
  INTO v_reschedule_outcomes
  FROM (
    SELECT
      ta.status,
      COUNT(*) AS cnt,
      CASE WHEN v_total_reschedules > 0
        THEN ROUND((COUNT(*)::NUMERIC / v_total_reschedules) * 100, 1)
        ELSE 0
      END AS pct
    FROM appointment_history ah
    JOIN telehealth_appointments ta ON ah.appointment_id = ta.id
    WHERE ah.change_type = 'rescheduled'
      AND ah.created_at >= p_start_date
      AND ah.created_at < p_end_date
      AND (p_tenant_id IS NULL OR ah.tenant_id = p_tenant_id)
    GROUP BY ta.status
    ORDER BY cnt DESC
  ) sub;

  v_result := jsonb_build_object(
    'totalReschedules', v_total_reschedules,
    'byRole', COALESCE(v_by_role, '[]'::JSONB),
    'topReasons', COALESCE(v_top_reasons, '[]'::JSONB),
    'outcomes', COALESCE(v_reschedule_outcomes, '[]'::JSONB)
  );

  RETURN v_result;
END;
$$;

-- ============================================================================
-- Indexes for analytics performance
-- ============================================================================

-- Index for appointment time range queries
CREATE INDEX IF NOT EXISTS idx_telehealth_appointments_time_status
ON telehealth_appointments(appointment_time, status);

-- Index for provider analytics
CREATE INDEX IF NOT EXISTS idx_telehealth_appointments_provider_time
ON telehealth_appointments(provider_id, appointment_time);

-- Index for tenant analytics
CREATE INDEX IF NOT EXISTS idx_telehealth_appointments_tenant_time
ON telehealth_appointments(tenant_id, appointment_time);

-- Index for appointment history analytics
CREATE INDEX IF NOT EXISTS idx_appointment_history_type_created
ON appointment_history(change_type, created_at);

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_appointment_analytics_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_appointment_trends TO authenticated;
GRANT EXECUTE ON FUNCTION get_provider_appointment_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_no_show_patterns TO authenticated;
GRANT EXECUTE ON FUNCTION get_appointment_status_breakdown TO authenticated;
GRANT EXECUTE ON FUNCTION get_rescheduling_analytics TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION get_appointment_analytics_summary IS
'Returns overall appointment metrics including completion rates, no-show rates, and averages for a given time range';

COMMENT ON FUNCTION get_appointment_trends IS
'Returns time-series data of appointment metrics with configurable granularity (day, week, month)';

COMMENT ON FUNCTION get_provider_appointment_stats IS
'Returns appointment statistics broken down by provider including completion rates and total hours';

COMMENT ON FUNCTION get_no_show_patterns IS
'Analyzes no-show patterns by day of week, hour of day, and identifies high-risk patients';

COMMENT ON FUNCTION get_appointment_status_breakdown IS
'Returns detailed breakdown of appointment statuses by encounter type';

COMMENT ON FUNCTION get_rescheduling_analytics IS
'Analyzes appointment rescheduling patterns including reasons and outcomes';
