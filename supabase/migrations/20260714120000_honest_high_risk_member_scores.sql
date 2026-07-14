-- =====================================================
-- v_readmission_high_risk_members: stop fabricating member scores
-- =====================================================
-- Same defect class as 20260714110000 (dashboard 85% adherence), per-member:
--   risk_score            COALESCE(hua, profile, 50)  -> fabricated mid-risk
--   risk_category         COALESCE(hua, 'moderate')   -> fabricated category
--   engagement_score      COALESCE(metric, 50)        -> fabricated 50%
--   medication_adherence  COALESCE(metric, 50)        -> fabricated 50%
-- New behavior: NULL when no underlying data — the UI renders an explicit
-- unscored state instead of a plausible-looking number.
-- Also: engagement/adherence casts are now guarded (non-numeric metadata used
-- to abort the whole query on ::integer); ORDER BY falls back to 0 so
-- unscored members sort last. Membership WHERE clause is unchanged.
-- All other columns byte-equivalent to the live definition (pulled 2026-07-14).

CREATE OR REPLACE VIEW public.v_readmission_high_risk_members
WITH (security_invoker = on) AS
SELECT p.user_id AS id,
  p.first_name,
  p.last_name,
  p.phone,
  COALESCE(hua.utilization_risk_score, p.risk_score) AS risk_score,
  hua.overall_risk_category AS risk_category,
  COALESCE((SELECT count(*) FROM patient_readmissions pr
    WHERE pr.patient_id = p.user_id AND pr.admission_date >= (CURRENT_DATE - 30)), 0::bigint)::integer AS total_visits_30d,
  COALESCE((SELECT count(*) FROM patient_readmissions pr
    WHERE pr.patient_id = p.user_id AND pr.facility_type = 'er'::text AND pr.admission_date >= (CURRENT_DATE - 30)), 0::bigint)::integer AS er_visits_30d,
  COALESCE((SELECT count(*) FROM patient_readmissions pr
    WHERE pr.patient_id = p.user_id AND pr.is_readmission = true AND pr.admission_date >= (CURRENT_DATE - 30)), 0::bigint)::integer AS readmissions_30d,
  (EXISTS (SELECT 1 FROM care_coordination_plans ccp
    WHERE ccp.patient_id = p.user_id AND ccp.status = 'active'::text)) AS has_active_care_plan,
  COALESCE(hua.cms_penalty_risk, false) AS cms_penalty_risk,
  CASE WHEN (p.engagement_metrics ->> 'overall_score') ~ '^[0-9]+$'
       THEN (p.engagement_metrics ->> 'overall_score')::integer END AS engagement_score,
  CASE WHEN (p.engagement_metrics ->> 'medication_adherence') ~ '^[0-9]+$'
       THEN (p.engagement_metrics ->> 'medication_adherence')::integer END AS medication_adherence,
  (SELECT max(ci.created_at) FROM check_ins ci WHERE ci.user_id = p.user_id) AS last_check_in,
  COALESCE((SELECT count(DISTINCT date(ci.created_at)) FROM check_ins ci
    WHERE ci.user_id = p.user_id AND ci.created_at >= (CURRENT_DATE - 7)), 0::bigint)::integer AS check_in_streak,
  COALESCE(7 - ((SELECT count(DISTINCT date(ci.created_at)) FROM check_ins ci
    WHERE ci.user_id = p.user_id AND ci.created_at >= (CURRENT_DATE - 7))), 0::bigint)::integer AS missed_check_ins_7d,
  COALESCE(p.sdoh_risk_factors, '[]'::jsonb) AS sdoh_risk_factors,
  (SELECT pr.facility_name FROM patient_readmissions pr
    WHERE pr.patient_id = p.user_id ORDER BY pr.admission_date DESC LIMIT 1) AS discharge_facility,
  (SELECT pr.primary_diagnosis_description FROM patient_readmissions pr
    WHERE pr.patient_id = p.user_id ORDER BY pr.admission_date DESC LIMIT 1) AS primary_diagnosis,
  (SELECT EXTRACT(day FROM now() - pr.discharge_date)::integer FROM patient_readmissions pr
    WHERE pr.patient_id = p.user_id AND pr.discharge_date IS NOT NULL
    ORDER BY pr.discharge_date DESC LIMIT 1) AS days_since_discharge,
  (SELECT rrp.predicted_readmission_date FROM readmission_risk_predictions rrp
    WHERE rrp.patient_id = p.user_id ORDER BY rrp.created_at DESC LIMIT 1) AS predicted_readmission_date,
  CASE
    WHEN COALESCE(hua.utilization_risk_score, p.risk_score, 0) >= 80 THEN 15000
    WHEN COALESCE(hua.utilization_risk_score, p.risk_score, 0) >= 60 THEN 12500
    ELSE 8000
  END AS estimated_savings,
  p.created_at AS wellfit_member_since
FROM profiles p
LEFT JOIN high_utilizer_analytics hua
  ON hua.patient_id = p.user_id AND hua.analysis_period_end >= (CURRENT_DATE - 30)
WHERE p.tenant_id = get_current_tenant_id()
  AND (p.role_code = ANY (ARRAY[4, 19]))
  AND (COALESCE(hua.utilization_risk_score, p.risk_score, 0) >= 60
       OR (EXISTS (SELECT 1 FROM patient_readmissions pr
             WHERE pr.patient_id = p.user_id AND pr.risk_score >= 60
               AND pr.admission_date >= (CURRENT_DATE - 90))))
ORDER BY COALESCE(hua.utilization_risk_score, p.risk_score, 0) DESC;

GRANT SELECT ON public.v_readmission_high_risk_members TO authenticated;

COMMENT ON VIEW public.v_readmission_high_risk_members IS
  'Tenant-scoped high-risk member roster (security_invoker). risk_score/risk_category/engagement_score/medication_adherence are NULL when no underlying data exists — never fabricated defaults.';
