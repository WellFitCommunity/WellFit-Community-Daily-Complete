-- ============================================================================
-- Staff Wellness Aggregate View Migration
-- ============================================================================
-- Purpose: Provide supervisor-level view of staff wellness metrics
-- Features: Joins staff profiles, burnout risk, workload snapshots
-- Used by: StaffWellnessDashboard for department-level wellness monitoring
-- ============================================================================

-- ============================================================================
-- PART 1: STAFF WELLNESS AGGREGATE VIEW
-- ============================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS vw_staff_wellness_summary;

-- Create comprehensive staff wellness view
CREATE OR REPLACE VIEW vw_staff_wellness_summary AS
SELECT
  s.staff_id,
  s.organization_id,
  s.primary_department_id,
  s.primary_facility_id,
  s.first_name,
  s.last_name,
  s.first_name || ' ' || s.last_name AS full_name,
  NULL::TEXT AS title,  -- hc_staff doesn't have title column
  s.employee_id,
  s.employment_status,
  s.user_account_id,

  -- Department info
  d.department_name,

  -- Latest burnout risk assessment
  pbr.risk_level AS burnout_risk_level,
  pbr.risk_score AS burnout_risk_score,
  pbr.emotional_exhaustion_score,
  pbr.depersonalization_score,
  pbr.personal_accomplishment_score,
  pbr.hours_worked_last_week,
  pbr.patient_count_last_week,
  pbr.overtime_hours,
  pbr.missed_breaks_count,
  pbr.assessment_date AS last_burnout_assessment_date,

  -- Computed compassion score (inverse of depersonalization + personal accomplishment)
  -- Scale: 0-100 where higher is better
  CASE
    WHEN pbr.depersonalization_score IS NOT NULL AND pbr.personal_accomplishment_score IS NOT NULL THEN
      LEAST(100, GREATEST(0,
        (100 - COALESCE(pbr.depersonalization_score, 0)) * 0.5 +
        COALESCE(pbr.personal_accomplishment_score, 50) * 0.5
      ))::INTEGER
    ELSE NULL
  END AS compassion_score,

  -- Latest workload snapshot
  sws.patient_count AS current_patient_count,
  sws.estimated_workload_score,
  sws.pending_tasks,
  sws.shift_hours_remaining,
  sws.snapshot_time AS last_workload_update,

  -- Computed documentation debt (pending tasks * 0.25 hours each as estimate)
  COALESCE(sws.pending_tasks * 0.25, 0) AS estimated_documentation_debt_hours,

  -- Computed last break time (if shift started and hours remaining known)
  CASE
    WHEN sws.shift_hours_remaining IS NOT NULL THEN
      ROUND((12 - sws.shift_hours_remaining) / 2)::INTEGER || ' hours ago'
    ELSE 'Unknown'
  END AS estimated_last_break,

  -- Mood trend (compare recent burnout scores)
  CASE
    WHEN pbr.risk_score IS NULL THEN 'unknown'
    WHEN pbr.risk_score < 30 THEN 'improving'
    WHEN pbr.risk_score < 60 THEN 'stable'
    ELSE 'declining'
  END AS mood_trend,

  -- Shift hours (inverse of remaining hours, assume 12-hour shifts)
  CASE
    WHEN sws.shift_hours_remaining IS NOT NULL THEN
      (12 - sws.shift_hours_remaining)::INTEGER
    ELSE NULL
  END AS shift_hours_worked,

  -- Timestamps
  s.created_at,
  s.updated_at

FROM hc_staff s
LEFT JOIN hc_department d ON s.primary_department_id = d.department_id

-- Get latest burnout risk for each staff member
LEFT JOIN LATERAL (
  SELECT *
  FROM provider_burnout_risk pbr_inner
  WHERE pbr_inner.user_id = s.user_account_id
  ORDER BY pbr_inner.assessment_date DESC
  LIMIT 1
) pbr ON true

-- Get latest workload snapshot for each staff member
LEFT JOIN LATERAL (
  SELECT *
  FROM staff_workload_snapshots sws_inner
  WHERE sws_inner.staff_id = s.user_account_id
  ORDER BY sws_inner.snapshot_time DESC
  LIMIT 1
) sws ON true

WHERE s.is_active = true
  AND s.employment_status = 'ACTIVE';

-- Grant access
GRANT SELECT ON vw_staff_wellness_summary TO authenticated;

COMMENT ON VIEW vw_staff_wellness_summary IS
  'Aggregates staff wellness data from burnout assessments and workload snapshots for supervisor dashboards';

-- ============================================================================
-- PART 2: RPC FUNCTION FOR DEPARTMENT WELLNESS METRICS
-- ============================================================================

-- Function to get wellness metrics for a department/facility
CREATE OR REPLACE FUNCTION get_department_wellness_metrics(
  p_organization_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_facility_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_staff INTEGER,
  high_risk_count INTEGER,
  critical_risk_count INTEGER,
  avg_compassion_score NUMERIC,
  avg_documentation_debt NUMERIC,
  staff_on_break INTEGER,
  interventions_needed INTEGER,
  avg_workload_score NUMERIC,
  avg_shift_hours NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_staff,
    COUNT(*) FILTER (WHERE burnout_risk_level = 'high')::INTEGER AS high_risk_count,
    COUNT(*) FILTER (WHERE burnout_risk_level = 'critical')::INTEGER AS critical_risk_count,
    ROUND(AVG(compassion_score), 0) AS avg_compassion_score,
    ROUND(AVG(estimated_documentation_debt_hours), 1) AS avg_documentation_debt,
    COUNT(*) FILTER (WHERE shift_hours_remaining > 10)::INTEGER AS staff_on_break,
    COUNT(*) FILTER (WHERE burnout_risk_level IN ('high', 'critical'))::INTEGER AS interventions_needed,
    ROUND(AVG(estimated_workload_score), 0) AS avg_workload_score,
    ROUND(AVG(shift_hours_worked), 1) AS avg_shift_hours
  FROM vw_staff_wellness_summary
  WHERE (p_organization_id IS NULL OR organization_id = p_organization_id)
    AND (p_department_id IS NULL OR primary_department_id = p_department_id)
    AND (p_facility_id IS NULL OR primary_facility_id = p_facility_id);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_department_wellness_metrics(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION get_department_wellness_metrics IS
  'Get aggregate wellness metrics for a department, facility, or organization';

-- ============================================================================
-- PART 3: RPC FUNCTION FOR STAFF WELLNESS LIST
-- ============================================================================

-- Function to get staff wellness list with filters
CREATE OR REPLACE FUNCTION get_staff_wellness_list(
  p_organization_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_facility_id UUID DEFAULT NULL,
  p_risk_filter TEXT DEFAULT NULL,  -- 'high', 'critical', 'at_risk' (high+critical)
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  staff_id UUID,
  full_name TEXT,
  title TEXT,
  department_name TEXT,
  burnout_risk_level TEXT,
  compassion_score INTEGER,
  documentation_debt_hours NUMERIC,
  last_break TEXT,
  shift_hours INTEGER,
  patient_count INTEGER,
  mood_trend TEXT,
  user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sws.staff_id,
    sws.full_name,
    sws.title,
    sws.department_name,
    COALESCE(sws.burnout_risk_level, 'unknown') AS burnout_risk_level,
    sws.compassion_score,
    sws.estimated_documentation_debt_hours AS documentation_debt_hours,
    sws.estimated_last_break AS last_break,
    sws.shift_hours_worked AS shift_hours,
    sws.current_patient_count AS patient_count,
    COALESCE(sws.mood_trend, 'unknown') AS mood_trend,
    sws.user_account_id AS user_id
  FROM vw_staff_wellness_summary sws
  WHERE (p_organization_id IS NULL OR sws.organization_id = p_organization_id)
    AND (p_department_id IS NULL OR sws.primary_department_id = p_department_id)
    AND (p_facility_id IS NULL OR sws.primary_facility_id = p_facility_id)
    AND (
      p_risk_filter IS NULL
      OR (p_risk_filter = 'at_risk' AND sws.burnout_risk_level IN ('high', 'critical'))
      OR sws.burnout_risk_level = p_risk_filter
    )
  ORDER BY
    CASE sws.burnout_risk_level
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'moderate' THEN 3
      WHEN 'low' THEN 4
      ELSE 5
    END,
    sws.compassion_score ASC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_staff_wellness_list(UUID, UUID, UUID, TEXT, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION get_staff_wellness_list IS
  'Get paginated list of staff with wellness metrics, optionally filtered by risk level';

-- Note: Demo data seeding removed - use separate demo data migration if needed
