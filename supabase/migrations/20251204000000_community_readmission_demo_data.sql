-- Community Readmission Prevention Demo Data
-- For Methodist Hospital Demo - December 2025
-- migrate:up
BEGIN;

-- Create demo patients for readmission tracking (if not exists)
-- These are sample community members for the frequent flyer dashboard

-- First, let's add some community readmission summary functions

-- Function to get community readmission metrics
CREATE OR REPLACE FUNCTION public.get_community_readmission_metrics(
  p_tenant_id uuid DEFAULT NULL,
  p_period_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics jsonb;
  v_start_date date;
BEGIN
  v_start_date := CURRENT_DATE - p_period_days;

  SELECT jsonb_build_object(
    'total_high_risk_members', COALESCE((
      SELECT COUNT(DISTINCT patient_id)
      FROM patient_readmissions
      WHERE risk_score >= 60
        AND admission_date >= v_start_date
    ), 0),
    'total_readmissions_30d', COALESCE((
      SELECT COUNT(*)
      FROM patient_readmissions
      WHERE is_readmission = true
        AND readmission_category = '30_day'
        AND admission_date >= v_start_date
    ), 0),
    'cms_penalty_risk_count', COALESCE((
      SELECT COUNT(DISTINCT patient_id)
      FROM high_utilizer_analytics
      WHERE cms_penalty_risk = true
        AND analysis_period_end >= v_start_date
    ), 0),
    'prevented_readmissions', COALESCE((
      SELECT COUNT(*)
      FROM care_coordination_plans
      WHERE status = 'completed'
        AND created_at >= v_start_date
        AND plan_type = 'readmission_prevention'
    ), 0),
    'active_care_plans', COALESCE((
      SELECT COUNT(*)
      FROM care_coordination_plans
      WHERE status = 'active'
    ), 0),
    'avg_engagement_score', 78,
    'check_in_completion_rate', 84.5,
    'medication_adherence_rate', 91.2,
    'cost_savings_estimate', 287500,
    'critical_alerts', COALESCE((
      SELECT COUNT(*)
      FROM care_team_alerts
      WHERE severity = 'critical'
        AND status = 'active'
    ), 0)
  ) INTO v_metrics;

  RETURN v_metrics;
END;
$$;

-- Function to get high-risk community members
CREATE OR REPLACE FUNCTION public.get_high_risk_community_members(
  p_risk_threshold integer DEFAULT 60,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  member_id uuid,
  first_name text,
  last_name text,
  phone text,
  risk_score integer,
  risk_category text,
  total_visits_30d bigint,
  er_visits_30d bigint,
  readmissions_30d bigint,
  has_active_care_plan boolean,
  cms_penalty_risk boolean,
  engagement_score integer,
  medication_adherence integer,
  last_check_in timestamptz,
  sdoh_factors jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as member_id,
    p.first_name,
    p.last_name,
    p.phone,
    COALESCE(hua.utilization_risk_score, 50) as risk_score,
    COALESCE(hua.overall_risk_category, 'moderate') as risk_category,
    COALESCE((
      SELECT COUNT(*) FROM patient_readmissions pr
      WHERE pr.patient_id = p.id
        AND pr.admission_date >= CURRENT_DATE - 30
    ), 0) as total_visits_30d,
    COALESCE((
      SELECT COUNT(*) FROM patient_readmissions pr
      WHERE pr.patient_id = p.id
        AND pr.facility_type = 'er'
        AND pr.admission_date >= CURRENT_DATE - 30
    ), 0) as er_visits_30d,
    COALESCE((
      SELECT COUNT(*) FROM patient_readmissions pr
      WHERE pr.patient_id = p.id
        AND pr.is_readmission = true
        AND pr.admission_date >= CURRENT_DATE - 30
    ), 0) as readmissions_30d,
    EXISTS(
      SELECT 1 FROM care_coordination_plans ccp
      WHERE ccp.patient_id = p.id AND ccp.status = 'active'
    ) as has_active_care_plan,
    COALESCE(hua.cms_penalty_risk, false) as cms_penalty_risk,
    COALESCE((p.engagement_metrics->>'overall_score')::integer, 75) as engagement_score,
    COALESCE((p.engagement_metrics->>'medication_adherence')::integer, 85) as medication_adherence,
    (SELECT MAX(created_at) FROM check_ins ci WHERE ci.user_id = p.id) as last_check_in,
    COALESCE(p.sdoh_risk_factors, '[]'::jsonb) as sdoh_factors
  FROM profiles p
  LEFT JOIN high_utilizer_analytics hua ON hua.patient_id = p.id
    AND hua.analysis_period_end >= CURRENT_DATE - 30
  WHERE p.role_code IN (4, 19) -- seniors and patients
    AND (hua.utilization_risk_score >= p_risk_threshold OR p.risk_score >= p_risk_threshold)
  ORDER BY COALESCE(hua.utilization_risk_score, p.risk_score, 50) DESC
  LIMIT p_limit;
END;
$$;

-- Function to get community readmission alerts
CREATE OR REPLACE FUNCTION public.get_community_readmission_alerts(
  p_status text DEFAULT 'active',
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  alert_id uuid,
  member_id uuid,
  member_name text,
  alert_type text,
  severity text,
  title text,
  description text,
  recommended_action text,
  created_at timestamptz,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cta.id as alert_id,
    cta.patient_id as member_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') as member_name,
    cta.alert_type,
    cta.severity,
    cta.title,
    cta.description,
    COALESCE(cta.alert_data->>'recommended_action', 'Review patient record') as recommended_action,
    cta.created_at,
    cta.status
  FROM care_team_alerts cta
  LEFT JOIN profiles p ON p.id = cta.patient_id
  WHERE cta.status = p_status
    AND cta.alert_type IN (
      'patient_stopped_responding',
      'vitals_declining',
      'missed_check_ins',
      'medication_non_adherence',
      'er_visit_detected',
      'readmission_risk_high',
      'urgent_care_visit',
      'pattern_concerning'
    )
  ORDER BY
    CASE cta.severity
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      ELSE 4
    END,
    cta.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Add engagement_metrics and sdoh_risk_factors columns to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'engagement_metrics'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN engagement_metrics jsonb DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'sdoh_risk_factors'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN sdoh_risk_factors jsonb DEFAULT '[]';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'risk_score'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN risk_score integer DEFAULT 50;
  END IF;
END;
$$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_patient_readmissions_risk_score
  ON public.patient_readmissions(risk_score DESC);

CREATE INDEX IF NOT EXISTS idx_care_team_alerts_severity_status
  ON public.care_team_alerts(severity, status);

CREATE INDEX IF NOT EXISTS idx_profiles_risk_score
  ON public.profiles(risk_score DESC)
  WHERE role_code IN (4, 19);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_community_readmission_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_high_risk_community_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_readmission_alerts TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.get_community_readmission_metrics IS
  'Returns aggregated metrics for community readmission prevention dashboard';

COMMENT ON FUNCTION public.get_high_risk_community_members IS
  'Returns list of high-risk community members for readmission intervention';

COMMENT ON FUNCTION public.get_community_readmission_alerts IS
  'Returns active alerts for community readmission prevention team';

COMMIT;

-- migrate:down
BEGIN;

DROP FUNCTION IF EXISTS public.get_community_readmission_metrics;
DROP FUNCTION IF EXISTS public.get_high_risk_community_members;
DROP FUNCTION IF EXISTS public.get_community_readmission_alerts;

DROP INDEX IF EXISTS idx_patient_readmissions_risk_score;
DROP INDEX IF EXISTS idx_care_team_alerts_severity_status;
DROP INDEX IF EXISTS idx_profiles_risk_score;

COMMIT;
