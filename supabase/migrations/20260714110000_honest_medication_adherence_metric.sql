-- =====================================================
-- v_readmission_dashboard_metrics: stop fabricating medication adherence
-- =====================================================
-- The previous definition double-defaulted medication_adherence_rate to 85:
--   COALESCE(avg(COALESCE(metrics->>'medication_adherence', 85)), 85)
-- so a tenant with ZERO adherence data showed "85%" on a clinical dashboard.
-- New behavior: average only patients that actually carry a numeric
-- medication_adherence value in profiles.engagement_metrics; NULL when no
-- data exists (dashboard renders a no-data state, not a fake number).
-- Only the medication_adherence_rate expression changes; every other metric
-- is byte-equivalent to the live definition (pulled 2026-07-14).

CREATE OR REPLACE VIEW public.v_readmission_dashboard_metrics
WITH (security_invoker = on) AS
WITH tenant_patients AS (
  SELECT profiles.user_id AS patient_id
  FROM profiles
  WHERE profiles.tenant_id = get_current_tenant_id()
    AND profiles.role_code = ANY (ARRAY[4, 19])
), readmit_window AS (
  SELECT pr.patient_id, pr.risk_score, pr.is_readmission
  FROM patient_readmissions pr
  JOIN tenant_patients tp ON tp.patient_id = pr.patient_id
  WHERE pr.admission_date >= (CURRENT_DATE - 30)
), check_in_window AS (
  SELECT ci.emotional_state, ci.heart_rate
  FROM check_ins ci
  JOIN tenant_patients tp ON tp.patient_id = ci.user_id
  WHERE ci.created_at >= (CURRENT_DATE - 30)
)
SELECT
  COALESCE((SELECT count(DISTINCT rw.patient_id) FROM readmit_window rw WHERE rw.risk_score >= 60), 0::bigint)::integer AS total_high_risk_members,
  COALESCE((SELECT count(*) FROM readmit_window rw WHERE rw.is_readmission = true), 0::bigint)::integer AS total_readmissions_30d,
  COALESCE((
    SELECT count(DISTINCT hua.patient_id)
    FROM high_utilizer_analytics hua
    JOIN tenant_patients tp ON tp.patient_id = hua.patient_id
    WHERE hua.cms_penalty_risk = true AND hua.analysis_period_end >= (CURRENT_DATE - 30)
  ), 0::bigint)::integer AS cms_penalty_risk_count,
  COALESCE((
    SELECT count(*)
    FROM care_coordination_plans ccp
    JOIN tenant_patients tp ON tp.patient_id = ccp.patient_id
    WHERE ccp.status = 'completed'::text AND ccp.plan_type = 'readmission_prevention'::text AND ccp.created_at >= (CURRENT_DATE - 90)
  ), 0::bigint)::integer AS prevented_readmissions,
  COALESCE((
    SELECT count(*)
    FROM care_coordination_plans ccp
    JOIN tenant_patients tp ON tp.patient_id = ccp.patient_id
    WHERE ccp.status = 'active'::text
  ), 0::bigint)::integer AS active_care_plans,
  COALESCE((
    SELECT round(count(*) FILTER (WHERE ciw.emotional_state IS NOT NULL OR ciw.heart_rate IS NOT NULL)::numeric / NULLIF(count(*), 0)::numeric * 100::numeric)
    FROM check_in_window ciw
  ), 0::numeric) AS avg_engagement_score,
  COALESCE((
    SELECT round(count(*) FILTER (WHERE ciw.emotional_state IS NOT NULL)::numeric / NULLIF(count(*), 0)::numeric * 100::numeric, 1)
    FROM check_in_window ciw
  ), 0::numeric) AS check_in_completion_rate,
  (
    SELECT round(avg((p.engagement_metrics ->> 'medication_adherence')::numeric))
    FROM profiles p
    JOIN tenant_patients tp ON tp.patient_id = p.user_id
    WHERE (p.engagement_metrics ->> 'medication_adherence') ~ '^[0-9]+\.?[0-9]*$'
  ) AS medication_adherence_rate,
  COALESCE((
    SELECT count(*) * 12500
    FROM care_coordination_plans ccp
    JOIN tenant_patients tp ON tp.patient_id = ccp.patient_id
    WHERE ccp.status = 'completed'::text AND ccp.plan_type = 'readmission_prevention'::text AND ccp.created_at >= (CURRENT_DATE - 90)
  ), 0::bigint)::integer AS cost_savings_estimate,
  COALESCE((
    SELECT count(*)
    FROM care_team_alerts cta
    JOIN tenant_patients tp ON tp.patient_id = cta.patient_id
    WHERE cta.severity = 'critical'::text AND cta.status = 'active'::text
  ), 0::bigint)::integer AS critical_alerts;

GRANT SELECT ON public.v_readmission_dashboard_metrics TO authenticated;

COMMENT ON VIEW public.v_readmission_dashboard_metrics IS
  'Tenant-scoped readmission KPIs (security_invoker). medication_adherence_rate is NULL when no patient carries adherence data — never a fabricated default.';
