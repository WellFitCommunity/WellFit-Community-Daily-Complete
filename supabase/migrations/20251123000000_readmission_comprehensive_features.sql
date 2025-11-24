-- Comprehensive Readmission Risk Prediction Enhancement
-- Adds support for evidence-based feature storage and engagement metrics
-- migrate:up
begin;

-- 1. Create patient_engagement_metrics table if it doesn't exist
-- Tracks daily engagement across check-ins, games, and social activities
CREATE TABLE IF NOT EXISTS public.patient_engagement_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  date date NOT NULL,

  -- Check-in metrics
  check_in_completed boolean DEFAULT false,
  vitals_reported boolean DEFAULT false,
  mood_reported boolean DEFAULT false,
  symptoms_reported boolean DEFAULT false,

  -- Game participation
  trivia_played boolean DEFAULT false,
  trivia_score integer,
  word_find_played boolean DEFAULT false,
  word_find_score integer,

  -- Social engagement
  meal_photo_shared boolean DEFAULT false,
  community_interactions integer DEFAULT 0,
  messages_sent integer DEFAULT 0,

  -- Computed scores
  engagement_score integer CHECK (engagement_score BETWEEN 0 AND 100),
  overall_engagement_score integer CHECK (overall_engagement_score BETWEEN 0 AND 100),

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(patient_id, date)
);

CREATE INDEX IF NOT EXISTS idx_engagement_metrics_patient_date
  ON public.patient_engagement_metrics(patient_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_tenant
  ON public.patient_engagement_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_score
  ON public.patient_engagement_metrics(overall_engagement_score)
  WHERE overall_engagement_score < 40; -- Low engagement flag

DROP TRIGGER IF EXISTS trg_engagement_metrics_uat ON public.patient_engagement_metrics;
CREATE TRIGGER trg_engagement_metrics_uat
BEFORE UPDATE ON public.patient_engagement_metrics
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.patient_engagement_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "engagement_metrics_admin_rw_patient_r" ON public.patient_engagement_metrics;
CREATE POLICY "engagement_metrics_admin_rw_patient_r" ON public.patient_engagement_metrics
  USING (public.is_admin(auth.uid()) OR patient_id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()));

-- 2. Update readmission_risk_predictions table to store comprehensive features
-- Add columns for detailed feature storage
DO $$
BEGIN
  -- Clinical features
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='readmission_risk_predictions' AND column_name='clinical_features') THEN
    ALTER TABLE public.readmission_risk_predictions
      ADD COLUMN clinical_features jsonb DEFAULT '{}';
  END IF;

  -- Medication features
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='readmission_risk_predictions' AND column_name='medication_features') THEN
    ALTER TABLE public.readmission_risk_predictions
      ADD COLUMN medication_features jsonb DEFAULT '{}';
  END IF;

  -- Post-discharge features
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='readmission_risk_predictions' AND column_name='post_discharge_features') THEN
    ALTER TABLE public.readmission_risk_predictions
      ADD COLUMN post_discharge_features jsonb DEFAULT '{}';
  END IF;

  -- Social determinants features
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='readmission_risk_predictions' AND column_name='social_determinants_features') THEN
    ALTER TABLE public.readmission_risk_predictions
      ADD COLUMN social_determinants_features jsonb DEFAULT '{}';
  END IF;

  -- Functional status features
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='readmission_risk_predictions' AND column_name='functional_status_features') THEN
    ALTER TABLE public.readmission_risk_predictions
      ADD COLUMN functional_status_features jsonb DEFAULT '{}';
  END IF;

  -- Engagement features (WellFit's unique early warning system)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='readmission_risk_predictions' AND column_name='engagement_features') THEN
    ALTER TABLE public.readmission_risk_predictions
      ADD COLUMN engagement_features jsonb DEFAULT '{}';
  END IF;

  -- Self-reported health features
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='readmission_risk_predictions' AND column_name='self_reported_features') THEN
    ALTER TABLE public.readmission_risk_predictions
      ADD COLUMN self_reported_features jsonb DEFAULT '{}';
  END IF;

  -- Data quality metrics
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='readmission_risk_predictions' AND column_name='data_completeness_score') THEN
    ALTER TABLE public.readmission_risk_predictions
      ADD COLUMN data_completeness_score integer CHECK (data_completeness_score BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='readmission_risk_predictions' AND column_name='missing_critical_data') THEN
    ALTER TABLE public.readmission_risk_predictions
      ADD COLUMN missing_critical_data text[] DEFAULT '{}';
  END IF;
END $$;

-- 3. Create indexes for feature-based queries
CREATE INDEX IF NOT EXISTS idx_readmission_predictions_completeness
  ON public.readmission_risk_predictions(data_completeness_score)
  WHERE data_completeness_score < 70;

CREATE INDEX IF NOT EXISTS idx_readmission_predictions_engagement
  ON public.readmission_risk_predictions USING GIN (engagement_features)
  WHERE (engagement_features->>'isDisengaging')::boolean = true;

-- 4. Create view for high-risk patients with feature breakdown
CREATE OR REPLACE VIEW public.v_high_risk_readmission_patients AS
SELECT
  p.id AS patient_id,
  pr.first_name,
  pr.last_name,
  rp.discharge_date,
  rp.readmission_risk_score AS readmission_risk_30_day,
  rp.risk_category,
  rp.data_completeness_score,

  -- Extract key risk factors from features
  (rp.clinical_features->>'priorAdmissions30Day')::integer AS prior_admissions_30d,
  (rp.clinical_features->>'comorbidityCount')::integer AS comorbidity_count,
  (rp.clinical_features->>'isHighRiskDiagnosis')::boolean AS high_risk_diagnosis,

  (rp.engagement_features->>'consecutiveMissedCheckIns')::integer AS consecutive_missed_checkins,
  (rp.engagement_features->>'isDisengaging')::boolean AS is_disengaging,
  (rp.engagement_features->>'stoppedResponding')::boolean AS stopped_responding,
  (rp.engagement_features->>'overallEngagementScore')::integer AS engagement_score,

  (rp.medication_features->>'isPolypharmacy')::boolean AS polypharmacy,
  (rp.medication_features->>'hasHighRiskMedications')::boolean AS high_risk_meds,

  (rp.post_discharge_features->>'noFollowUpScheduled')::boolean AS no_followup,
  (rp.post_discharge_features->>'daysUntilFollowUp')::integer AS days_to_followup,

  (rp.social_determinants_features->>'livesAlone')::boolean AS lives_alone,
  (rp.social_determinants_features->>'hasTransportationBarrier')::boolean AS transport_barrier,
  (rp.social_determinants_features->>'isRuralLocation')::boolean AS rural_location,

  rp.recommended_interventions,
  rp.prediction_confidence,
  rp.created_at AS prediction_date

FROM public.readmission_risk_predictions rp
JOIN auth.users p ON rp.patient_id = p.id
LEFT JOIN public.profiles pr ON p.id = pr.id
WHERE rp.risk_category IN ('high', 'critical')
  AND rp.discharge_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY rp.readmission_risk_score DESC, rp.discharge_date DESC;

-- Grant access to view
GRANT SELECT ON public.v_high_risk_readmission_patients TO authenticated;

-- 5. Create function to calculate engagement-based early warning score
CREATE OR REPLACE FUNCTION public.calculate_engagement_warning_score(
  p_patient_id uuid,
  p_days integer DEFAULT 7
)
RETURNS TABLE (
  warning_score integer,
  warning_level text,
  concerning_factors text[],
  recommended_action text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_score integer := 0;
  v_factors text[] := ARRAY[]::text[];
  v_level text;
  v_action text;
  v_consecutive_missed integer;
  v_engagement_avg numeric;
  v_recent_avg numeric;
BEGIN
  -- Get engagement metrics for the specified period
  SELECT
    COALESCE(AVG(overall_engagement_score), 0),
    COUNT(*) FILTER (WHERE NOT check_in_completed)
  INTO v_recent_avg, v_consecutive_missed
  FROM public.patient_engagement_metrics
  WHERE patient_id = p_patient_id
    AND date >= CURRENT_DATE - p_days
    AND date <= CURRENT_DATE;

  -- Get baseline engagement (30 days)
  SELECT COALESCE(AVG(overall_engagement_score), 0)
  INTO v_engagement_avg
  FROM public.patient_engagement_metrics
  WHERE patient_id = p_patient_id
    AND date >= CURRENT_DATE - 30
    AND date <= CURRENT_DATE;

  -- Score consecutive missed check-ins
  IF v_consecutive_missed >= 3 THEN
    v_score := v_score + 30;
    v_factors := array_append(v_factors, format('Consecutive missed check-ins: %s', v_consecutive_missed));
  ELSIF v_consecutive_missed >= 2 THEN
    v_score := v_score + 15;
    v_factors := array_append(v_factors, format('Missed check-ins: %s', v_consecutive_missed));
  END IF;

  -- Score engagement drop
  IF v_engagement_avg > 0 AND v_recent_avg < (v_engagement_avg * 0.7) THEN
    v_score := v_score + 25;
    v_factors := array_append(v_factors, format('Engagement dropped %s%%', ROUND((1 - v_recent_avg / v_engagement_avg) * 100)));
  END IF;

  -- Score low absolute engagement
  IF v_recent_avg < 40 THEN
    v_score := v_score + 20;
    v_factors := array_append(v_factors, format('Low engagement score: %s/100', ROUND(v_recent_avg)));
  END IF;

  -- Determine warning level and action
  IF v_score >= 50 THEN
    v_level := 'CRITICAL';
    v_action := 'Immediate wellness call required within 2 hours';
  ELSIF v_score >= 30 THEN
    v_level := 'HIGH';
    v_action := 'Contact patient within 24 hours';
  ELSIF v_score >= 15 THEN
    v_level := 'MODERATE';
    v_action := 'Schedule check-in call within 48 hours';
  ELSE
    v_level := 'LOW';
    v_action := 'Continue normal monitoring';
  END IF;

  RETURN QUERY SELECT v_score, v_level, v_factors, v_action;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.calculate_engagement_warning_score(uuid, integer) TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.patient_engagement_metrics IS 'Daily engagement tracking for early warning detection - check-ins, games, social activity';
COMMENT ON VIEW public.v_high_risk_readmission_patients IS 'High-risk patients (last 30 days) with detailed feature breakdown for care coordination';
COMMENT ON FUNCTION public.calculate_engagement_warning_score IS 'Calculate engagement-based early warning score using WellFit behavioral data';

commit;

-- migrate:down
begin;

DROP FUNCTION IF EXISTS public.calculate_engagement_warning_score(uuid, integer);
DROP VIEW IF EXISTS public.v_high_risk_readmission_patients;
DROP TABLE IF EXISTS public.patient_engagement_metrics CASCADE;

-- Remove columns from readmission_risk_predictions
ALTER TABLE public.readmission_risk_predictions
  DROP COLUMN IF EXISTS clinical_features,
  DROP COLUMN IF EXISTS medication_features,
  DROP COLUMN IF EXISTS post_discharge_features,
  DROP COLUMN IF EXISTS social_determinants_features,
  DROP COLUMN IF EXISTS functional_status_features,
  DROP COLUMN IF EXISTS engagement_features,
  DROP COLUMN IF EXISTS self_reported_features,
  DROP COLUMN IF EXISTS data_completeness_score,
  DROP COLUMN IF EXISTS missing_critical_data;

commit;
