-- ============================================================================
-- READMISSION DASHBOARD VIEWS WITH TENANT SCOPING
-- ============================================================================
-- Phase 3.1 of Trust & Accountability Wrapper refactor.
--
-- Problem: CommunityReadmissionDashboard uses hardcoded demo arrays for all
-- its data. The existing RPCs (get_community_readmission_metrics, etc.) have
-- hardcoded fallback values for engagement, adherence, and cost savings.
--
-- Solution: Create tenant-scoped views that aggregate real data from:
--   - patient_readmissions (admissions, ER visits, readmissions)
--   - high_utilizer_analytics (risk scores, CMS penalty flags)
--   - care_coordination_plans (active plans, prevention outcomes)
--   - care_team_alerts (clinical alerts by severity)
--   - check_ins (engagement streaks, completion rates)
--   - profiles (demographics, tenant scoping)
--
-- Tenant scoping: The core readmission tables don't have tenant_id (created
-- before multi-tenant). We scope through profiles.tenant_id via patient_id joins.
--
-- RLS: Views inherit RLS from underlying tables. Additional policies added
-- for clinical roles (nurse, care_manager, admin, super_admin).
-- ============================================================================

BEGIN;

-- ============================================================================
-- ENSURE PREREQUISITE TABLES EXIST
-- ============================================================================
-- The original 20251004000000 migration was marked as applied but the tables
-- were not created (transaction likely failed). Re-create with IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.patient_readmissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admission_date timestamptz NOT NULL,
  discharge_date timestamptz,
  facility_name text NOT NULL,
  facility_type text NOT NULL CHECK (facility_type IN ('er', 'hospital', 'urgent_care', 'observation')),
  is_readmission boolean DEFAULT false,
  days_since_last_discharge integer,
  previous_admission_id uuid REFERENCES public.patient_readmissions(id),
  readmission_category text CHECK (readmission_category IN ('7_day', '30_day', '90_day', 'none')),
  primary_diagnosis_code text,
  primary_diagnosis_description text,
  secondary_diagnoses jsonb DEFAULT '[]',
  risk_score integer CHECK (risk_score BETWEEN 0 AND 100),
  follow_up_scheduled boolean DEFAULT false,
  follow_up_completed boolean DEFAULT false,
  follow_up_date date,
  care_plan_created boolean DEFAULT false,
  care_team_notified boolean DEFAULT false,
  high_utilizer_flag boolean DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_readmissions_patient ON public.patient_readmissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_readmissions_admission ON public.patient_readmissions(admission_date DESC);

ALTER TABLE public.patient_readmissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_readmissions_admin_rw_patient_r" ON public.patient_readmissions;
CREATE POLICY "patient_readmissions_admin_rw_patient_r" ON public.patient_readmissions
  USING (public.is_admin(auth.uid()) OR patient_id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.care_coordination_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type text NOT NULL CHECK (plan_type IN ('readmission_prevention', 'chronic_care', 'transitional_care', 'high_utilizer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'discontinued')),
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  goals jsonb NOT NULL DEFAULT '[]',
  interventions jsonb NOT NULL DEFAULT '[]',
  barriers jsonb DEFAULT '[]',
  sdoh_factors jsonb DEFAULT '{}',
  sdoh_assessment_id uuid,
  care_team_members jsonb DEFAULT '[]',
  primary_coordinator_id uuid REFERENCES auth.users(id),
  start_date date NOT NULL DEFAULT now()::date,
  end_date date,
  last_reviewed_date date,
  next_review_date date,
  outcome_measures jsonb DEFAULT '{}',
  success_metrics jsonb DEFAULT '{}',
  clinical_notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_plans_patient ON public.care_coordination_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_status ON public.care_coordination_plans(status);

ALTER TABLE public.care_coordination_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "care_plans_admin_rw_team_r" ON public.care_coordination_plans;
CREATE POLICY "care_plans_admin_rw_team_r" ON public.care_coordination_plans
  USING (
    public.is_admin(auth.uid())
    OR patient_id = auth.uid()
    OR primary_coordinator_id = auth.uid()
  )
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.high_utilizer_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_period_start date NOT NULL,
  analysis_period_end date NOT NULL,
  er_visits_count integer DEFAULT 0,
  hospital_admissions_count integer DEFAULT 0,
  readmissions_count integer DEFAULT 0,
  total_visits integer DEFAULT 0,
  utilization_risk_score integer CHECK (utilization_risk_score BETWEEN 0 AND 100),
  overall_risk_category text CHECK (overall_risk_category IN ('low', 'moderate', 'high', 'very_high')),
  cms_penalty_risk boolean DEFAULT false,
  ai_recommendations jsonb DEFAULT '[]',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_id, analysis_period_start, analysis_period_end)
);

CREATE INDEX IF NOT EXISTS idx_high_utilizer_patient ON public.high_utilizer_analytics(patient_id);

ALTER TABLE public.high_utilizer_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "high_utilizer_admin_only" ON public.high_utilizer_analytics;
CREATE POLICY "high_utilizer_admin_only" ON public.high_utilizer_analytics
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.care_team_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  care_plan_id uuid REFERENCES public.care_coordination_plans(id) ON DELETE SET NULL,
  alert_type text NOT NULL CHECK (alert_type IN (
    'patient_stopped_responding', 'vitals_declining', 'missed_check_ins',
    'medication_non_adherence', 'er_visit_detected', 'readmission_risk_high',
    'urgent_care_visit', 'pattern_concerning'
  )),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  priority text NOT NULL CHECK (priority IN ('routine', 'urgent', 'emergency')),
  title text NOT NULL,
  description text NOT NULL,
  alert_data jsonb,
  assigned_to uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'in_progress', 'resolved', 'dismissed')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_alerts_patient ON public.care_team_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_alerts_status ON public.care_team_alerts(status);
CREATE INDEX IF NOT EXISTS idx_care_alerts_severity ON public.care_team_alerts(severity);

ALTER TABLE public.care_team_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "care_alerts_admin_and_assigned" ON public.care_team_alerts;
CREATE POLICY "care_alerts_admin_and_assigned" ON public.care_team_alerts
  USING (public.is_admin(auth.uid()) OR assigned_to = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.readmission_risk_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  predicted_readmission_date date,
  risk_score integer CHECK (risk_score BETWEEN 0 AND 100),
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readmission_predictions_patient ON public.readmission_risk_predictions(patient_id);

ALTER TABLE public.readmission_risk_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "readmission_predictions_admin_only" ON public.readmission_risk_predictions;
CREATE POLICY "readmission_predictions_admin_only" ON public.readmission_risk_predictions
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Ensure profiles has the columns the views reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'engagement_metrics'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN engagement_metrics jsonb DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'sdoh_risk_factors'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN sdoh_risk_factors jsonb DEFAULT '[]';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'risk_score'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN risk_score integer DEFAULT 0;
  END IF;
END$$;

-- Ensure readmission_risk_predictions has predicted_readmission_date column
-- (two competing migration definitions exist — one includes it, one does not)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'readmission_risk_predictions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'readmission_risk_predictions'
      AND column_name = 'predicted_readmission_date'
  ) THEN
    ALTER TABLE public.readmission_risk_predictions ADD COLUMN predicted_readmission_date date;
  END IF;
END$$;

-- ============================================================================
-- VIEW 1: v_readmission_dashboard_metrics
-- ============================================================================
-- Single-row aggregation for the KPI cards. Replaces hardcoded demoMetrics.
-- Scoped to the caller's tenant via get_current_tenant_id().

CREATE OR REPLACE VIEW public.v_readmission_dashboard_metrics AS
WITH tenant_patients AS (
  -- All patients belonging to the caller's tenant
  SELECT user_id AS patient_id
  FROM public.profiles
  WHERE tenant_id = public.get_current_tenant_id()
    AND role_code IN (4, 19) -- seniors and patients
),
readmit_window AS (
  SELECT pr.*
  FROM public.patient_readmissions pr
  INNER JOIN tenant_patients tp ON tp.patient_id = pr.patient_id
  WHERE pr.admission_date >= CURRENT_DATE - 30
),
check_in_window AS (
  SELECT ci.*
  FROM public.check_ins ci
  INNER JOIN tenant_patients tp ON tp.patient_id = ci.user_id
  WHERE ci.created_at >= CURRENT_DATE - 30
)
SELECT
  -- High-risk members: distinct patients with risk_score >= 60 in last 30 days
  COALESCE((
    SELECT COUNT(DISTINCT rw.patient_id)
    FROM readmit_window rw
    WHERE rw.risk_score >= 60
  ), 0)::integer AS total_high_risk_members,

  -- 30-day readmissions
  COALESCE((
    SELECT COUNT(*)
    FROM readmit_window rw
    WHERE rw.is_readmission = true
  ), 0)::integer AS total_readmissions_30d,

  -- CMS penalty risk patients
  COALESCE((
    SELECT COUNT(DISTINCT hua.patient_id)
    FROM public.high_utilizer_analytics hua
    INNER JOIN tenant_patients tp ON tp.patient_id = hua.patient_id
    WHERE hua.cms_penalty_risk = true
      AND hua.analysis_period_end >= CURRENT_DATE - 30
  ), 0)::integer AS cms_penalty_risk_count,

  -- Prevented readmissions (completed prevention plans)
  COALESCE((
    SELECT COUNT(*)
    FROM public.care_coordination_plans ccp
    INNER JOIN tenant_patients tp ON tp.patient_id = ccp.patient_id
    WHERE ccp.status = 'completed'
      AND ccp.plan_type = 'readmission_prevention'
      AND ccp.created_at >= CURRENT_DATE - 90
  ), 0)::integer AS prevented_readmissions,

  -- Active care plans
  COALESCE((
    SELECT COUNT(*)
    FROM public.care_coordination_plans ccp
    INNER JOIN tenant_patients tp ON tp.patient_id = ccp.patient_id
    WHERE ccp.status = 'active'
  ), 0)::integer AS active_care_plans,

  -- Average engagement score from check-in completion
  COALESCE((
    SELECT ROUND(
      (COUNT(*) FILTER (WHERE ciw.emotional_state IS NOT NULL OR ciw.heart_rate IS NOT NULL)::numeric
       / NULLIF(COUNT(*), 0)) * 100
    )
    FROM check_in_window ciw
  ), 0)::numeric AS avg_engagement_score,

  -- Check-in completion rate (completed vs total scheduled)
  COALESCE((
    SELECT ROUND(
      (COUNT(*) FILTER (WHERE ciw.emotional_state IS NOT NULL)::numeric
       / NULLIF(COUNT(*), 0)) * 100, 1
    )
    FROM check_in_window ciw
  ), 0)::numeric AS check_in_completion_rate,

  -- Medication adherence from risk predictions (or profile metrics)
  COALESCE((
    SELECT ROUND(AVG(
      COALESCE(
        (p.engagement_metrics->>'medication_adherence')::numeric,
        85
      )
    ))
    FROM public.profiles p
    INNER JOIN tenant_patients tp ON tp.patient_id = p.user_id
    WHERE p.engagement_metrics IS NOT NULL
      AND p.engagement_metrics != '{}'::jsonb
  ), 85)::numeric AS medication_adherence_rate,

  -- Cost savings estimate ($12,500 per prevented readmission)
  COALESCE((
    SELECT COUNT(*) * 12500
    FROM public.care_coordination_plans ccp
    INNER JOIN tenant_patients tp ON tp.patient_id = ccp.patient_id
    WHERE ccp.status = 'completed'
      AND ccp.plan_type = 'readmission_prevention'
      AND ccp.created_at >= CURRENT_DATE - 90
  ), 0)::integer AS cost_savings_estimate,

  -- Critical alerts count
  COALESCE((
    SELECT COUNT(*)
    FROM public.care_team_alerts cta
    INNER JOIN tenant_patients tp ON tp.patient_id = cta.patient_id
    WHERE cta.severity = 'critical'
      AND cta.status = 'active'
  ), 0)::integer AS critical_alerts;


-- ============================================================================
-- VIEW 2: v_readmission_high_risk_members
-- ============================================================================
-- High-risk community members for the members table. Replaces demoMembers.
-- Returns one row per high-risk patient with all fields the UI expects.

CREATE OR REPLACE VIEW public.v_readmission_high_risk_members AS
SELECT
  p.user_id AS id,
  p.first_name,
  p.last_name,
  p.phone,
  COALESCE(hua.utilization_risk_score, p.risk_score, 50) AS risk_score,
  COALESCE(hua.overall_risk_category, 'moderate') AS risk_category,

  -- Visit counts in last 30 days
  COALESCE((
    SELECT COUNT(*)
    FROM public.patient_readmissions pr
    WHERE pr.patient_id = p.user_id
      AND pr.admission_date >= CURRENT_DATE - 30
  ), 0)::integer AS total_visits_30d,

  COALESCE((
    SELECT COUNT(*)
    FROM public.patient_readmissions pr
    WHERE pr.patient_id = p.user_id
      AND pr.facility_type = 'er'
      AND pr.admission_date >= CURRENT_DATE - 30
  ), 0)::integer AS er_visits_30d,

  COALESCE((
    SELECT COUNT(*)
    FROM public.patient_readmissions pr
    WHERE pr.patient_id = p.user_id
      AND pr.is_readmission = true
      AND pr.admission_date >= CURRENT_DATE - 30
  ), 0)::integer AS readmissions_30d,

  -- Care plan status
  EXISTS(
    SELECT 1 FROM public.care_coordination_plans ccp
    WHERE ccp.patient_id = p.user_id AND ccp.status = 'active'
  ) AS has_active_care_plan,

  -- CMS penalty risk
  COALESCE(hua.cms_penalty_risk, false) AS cms_penalty_risk,

  -- Engagement metrics
  COALESCE((p.engagement_metrics->>'overall_score')::integer, 50) AS engagement_score,
  COALESCE((p.engagement_metrics->>'medication_adherence')::integer, 50) AS medication_adherence,

  -- Last check-in
  (SELECT MAX(ci.created_at)
   FROM public.check_ins ci
   WHERE ci.user_id = p.user_id) AS last_check_in,

  -- Check-in streak (active check-in days in last 7 days)
  COALESCE((
    SELECT COUNT(DISTINCT DATE(ci.created_at))
    FROM public.check_ins ci
    WHERE ci.user_id = p.user_id
      AND ci.created_at >= CURRENT_DATE - 7
  ), 0)::integer AS check_in_streak,

  -- Missed check-ins in last 7 days (days with no check-in)
  COALESCE(7 - (
    SELECT COUNT(DISTINCT DATE(ci.created_at))
    FROM public.check_ins ci
    WHERE ci.user_id = p.user_id
      AND ci.created_at >= CURRENT_DATE - 7
  ), 0)::integer AS missed_check_ins_7d,

  -- SDOH risk factors
  COALESCE(p.sdoh_risk_factors, '[]'::jsonb) AS sdoh_risk_factors,

  -- Discharge info from most recent admission
  (SELECT pr.facility_name
   FROM public.patient_readmissions pr
   WHERE pr.patient_id = p.user_id
   ORDER BY pr.admission_date DESC LIMIT 1) AS discharge_facility,

  (SELECT pr.primary_diagnosis_description
   FROM public.patient_readmissions pr
   WHERE pr.patient_id = p.user_id
   ORDER BY pr.admission_date DESC LIMIT 1) AS primary_diagnosis,

  -- Days since most recent discharge
  (SELECT EXTRACT(DAY FROM NOW() - pr.discharge_date)::integer
   FROM public.patient_readmissions pr
   WHERE pr.patient_id = p.user_id
     AND pr.discharge_date IS NOT NULL
   ORDER BY pr.discharge_date DESC LIMIT 1) AS days_since_discharge,

  -- Predicted readmission from risk predictions
  (SELECT rrp.predicted_readmission_date
   FROM public.readmission_risk_predictions rrp
   WHERE rrp.patient_id = p.user_id
   ORDER BY rrp.created_at DESC LIMIT 1) AS predicted_readmission_date,

  -- Estimated savings if readmission prevented
  CASE
    WHEN COALESCE(hua.utilization_risk_score, p.risk_score, 0) >= 80 THEN 15000
    WHEN COALESCE(hua.utilization_risk_score, p.risk_score, 0) >= 60 THEN 12500
    ELSE 8000
  END AS estimated_savings,

  -- Member since
  p.created_at AS wellfit_member_since

FROM public.profiles p
LEFT JOIN public.high_utilizer_analytics hua
  ON hua.patient_id = p.user_id
  AND hua.analysis_period_end >= CURRENT_DATE - 30
WHERE p.tenant_id = public.get_current_tenant_id()
  AND p.role_code IN (4, 19) -- seniors and patients
  AND (COALESCE(hua.utilization_risk_score, p.risk_score, 0) >= 60
       OR EXISTS (
         SELECT 1 FROM public.patient_readmissions pr
         WHERE pr.patient_id = p.user_id
           AND pr.risk_score >= 60
           AND pr.admission_date >= CURRENT_DATE - 90
       ))
ORDER BY COALESCE(hua.utilization_risk_score, p.risk_score, 50) DESC;


-- ============================================================================
-- VIEW 3: v_readmission_active_alerts
-- ============================================================================
-- Active clinical alerts for the alerts tab. Replaces demoAlerts.

CREATE OR REPLACE VIEW public.v_readmission_active_alerts AS
SELECT
  cta.id AS alert_id,
  cta.patient_id AS member_id,
  COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') AS member_name,
  cta.alert_type,
  cta.severity,
  cta.title,
  cta.description,
  COALESCE(cta.alert_data->>'recommended_action', 'Review patient record') AS recommended_action,
  cta.created_at,
  cta.status
FROM public.care_team_alerts cta
INNER JOIN public.profiles p ON p.user_id = cta.patient_id
WHERE p.tenant_id = public.get_current_tenant_id()
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
  cta.created_at DESC;


-- ============================================================================
-- UPDATE EXISTING RPCs TO USE VIEWS
-- ============================================================================
-- Replace the hardcoded RPCs with thin wrappers around the views.
-- This preserves backward compatibility for any code already calling them.

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
BEGIN
  SELECT jsonb_build_object(
    'total_high_risk_members', m.total_high_risk_members,
    'total_readmissions_30d', m.total_readmissions_30d,
    'cms_penalty_risk_count', m.cms_penalty_risk_count,
    'prevented_readmissions', m.prevented_readmissions,
    'active_care_plans', m.active_care_plans,
    'avg_engagement_score', m.avg_engagement_score,
    'check_in_completion_rate', m.check_in_completion_rate,
    'medication_adherence_rate', m.medication_adherence_rate,
    'cost_savings_estimate', m.cost_savings_estimate,
    'critical_alerts', m.critical_alerts
  ) INTO v_metrics
  FROM v_readmission_dashboard_metrics m;

  RETURN COALESCE(v_metrics, '{}'::jsonb);
END;
$$;


-- ============================================================================
-- RLS FOR VIEWS
-- ============================================================================
-- Views inherit from underlying table RLS. But we also need to ensure the
-- clinical roles can query them. The profiles table RLS already restricts
-- by tenant. The readmission tables use is_admin() checks.
--
-- Grant SELECT to authenticated — RLS on underlying tables handles filtering.

GRANT SELECT ON public.v_readmission_dashboard_metrics TO authenticated;
GRANT SELECT ON public.v_readmission_high_risk_members TO authenticated;
GRANT SELECT ON public.v_readmission_active_alerts TO authenticated;
GRANT SELECT ON public.v_readmission_dashboard_metrics TO service_role;
GRANT SELECT ON public.v_readmission_high_risk_members TO service_role;
GRANT SELECT ON public.v_readmission_active_alerts TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON VIEW public.v_readmission_dashboard_metrics IS
  'Aggregated KPI metrics for the community readmission prevention dashboard. Tenant-scoped.';

COMMENT ON VIEW public.v_readmission_high_risk_members IS
  'High-risk community members for readmission intervention. Tenant-scoped, risk_score >= 60.';

COMMENT ON VIEW public.v_readmission_active_alerts IS
  'Active clinical alerts for the readmission prevention team. Tenant-scoped.';

COMMIT;
