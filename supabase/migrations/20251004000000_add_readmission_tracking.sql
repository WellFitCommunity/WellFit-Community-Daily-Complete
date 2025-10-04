-- Frequent Flyer Readmission Tracking and Care Coordination System
-- Production-grade implementation for CMS readmission prevention
-- migrate:up
begin;

-- 1. PATIENT_READMISSIONS table (track all readmission events)
CREATE TABLE IF NOT EXISTS public.patient_readmissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event details
  admission_date timestamptz NOT NULL,
  discharge_date timestamptz,
  facility_name text NOT NULL,
  facility_type text NOT NULL CHECK (facility_type IN ('er', 'hospital', 'urgent_care', 'observation')),

  -- Readmission tracking
  is_readmission boolean DEFAULT false,
  days_since_last_discharge integer,
  previous_admission_id uuid REFERENCES public.patient_readmissions(id),
  readmission_category text CHECK (readmission_category IN ('7_day', '30_day', '90_day', 'none')),

  -- Clinical information
  primary_diagnosis_code text,
  primary_diagnosis_description text,
  secondary_diagnoses jsonb DEFAULT '[]',
  risk_score integer CHECK (risk_score BETWEEN 0 AND 100),

  -- Follow-up tracking
  follow_up_scheduled boolean DEFAULT false,
  follow_up_completed boolean DEFAULT false,
  follow_up_date date,

  -- Care coordination flags
  care_plan_created boolean DEFAULT false,
  care_team_notified boolean DEFAULT false,
  high_utilizer_flag boolean DEFAULT false,

  -- Audit fields
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_readmissions_patient ON public.patient_readmissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_readmissions_admission ON public.patient_readmissions(admission_date DESC);
CREATE INDEX IF NOT EXISTS idx_patient_readmissions_is_readmission ON public.patient_readmissions(is_readmission) WHERE is_readmission = true;
CREATE INDEX IF NOT EXISTS idx_patient_readmissions_high_utilizer ON public.patient_readmissions(high_utilizer_flag) WHERE high_utilizer_flag = true;
CREATE INDEX IF NOT EXISTS idx_patient_readmissions_category ON public.patient_readmissions(readmission_category);

DROP TRIGGER IF EXISTS trg_patient_readmissions_uat ON public.patient_readmissions;
CREATE TRIGGER trg_patient_readmissions_uat
BEFORE UPDATE ON public.patient_readmissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.patient_readmissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_readmissions_admin_rw_patient_r" ON public.patient_readmissions;
CREATE POLICY "patient_readmissions_admin_rw_patient_r" ON public.patient_readmissions
  USING (public.is_admin(auth.uid()) OR patient_id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()));

-- 2. CARE_COORDINATION_PLANS table (personalized care plans for high-risk patients)
CREATE TABLE IF NOT EXISTS public.care_coordination_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plan metadata
  plan_type text NOT NULL CHECK (plan_type IN ('readmission_prevention', 'chronic_care', 'transitional_care', 'high_utilizer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'discontinued')),
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Plan details
  title text NOT NULL,
  goals jsonb NOT NULL DEFAULT '[]',
  -- Example: [{"goal": "Reduce ER visits", "target": "Zero visits in 30 days", "progress": "50%"}]

  interventions jsonb NOT NULL DEFAULT '[]',
  -- Example: [{"intervention": "Daily check-in calls", "frequency": "daily", "responsible": "nurse_team"}]

  barriers jsonb DEFAULT '[]',
  -- Example: [{"barrier": "Transportation", "solution": "Coordinate rideshare", "status": "in_progress"}]

  -- SDOH integration
  sdoh_factors jsonb DEFAULT '{}',
  -- Links to SDOH assessment
  sdoh_assessment_id uuid REFERENCES public.sdoh_assessments(id),

  -- Team coordination
  care_team_members jsonb DEFAULT '[]',
  -- Example: [{"role": "primary_nurse", "user_id": "uuid", "name": "Jane Smith"}]

  primary_coordinator_id uuid REFERENCES auth.users(id),

  -- Dates
  start_date date NOT NULL DEFAULT now()::date,
  end_date date,
  last_reviewed_date date,
  next_review_date date,

  -- Outcomes
  outcome_measures jsonb DEFAULT '{}',
  success_metrics jsonb DEFAULT '{}',

  -- Notes and documentation
  clinical_notes text,

  -- Audit fields
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_plans_patient ON public.care_coordination_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_status ON public.care_coordination_plans(status);
CREATE INDEX IF NOT EXISTS idx_care_plans_priority ON public.care_coordination_plans(priority);
CREATE INDEX IF NOT EXISTS idx_care_plans_type ON public.care_coordination_plans(plan_type);
CREATE INDEX IF NOT EXISTS idx_care_plans_coordinator ON public.care_coordination_plans(primary_coordinator_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_review_date ON public.care_coordination_plans(next_review_date);

DROP TRIGGER IF EXISTS trg_care_plans_uat ON public.care_coordination_plans;
CREATE TRIGGER trg_care_plans_uat
BEFORE UPDATE ON public.care_coordination_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.care_coordination_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "care_plans_admin_rw_team_r" ON public.care_coordination_plans;
CREATE POLICY "care_plans_admin_rw_team_r" ON public.care_coordination_plans
  USING (
    public.is_admin(auth.uid())
    OR patient_id = auth.uid()
    OR primary_coordinator_id = auth.uid()
  )
  WITH CHECK (public.is_admin(auth.uid()));

-- 3. PATIENT_CHECK_INS table (daily automated check-ins via SMS/app)
CREATE TABLE IF NOT EXISTS public.patient_daily_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  care_plan_id uuid REFERENCES public.care_coordination_plans(id) ON DELETE SET NULL,

  -- Check-in metadata
  check_in_date date NOT NULL DEFAULT now()::date,
  check_in_time timestamptz NOT NULL DEFAULT now(),
  check_in_method text NOT NULL CHECK (check_in_method IN ('sms', 'app', 'phone_call', 'automated')),

  -- Response status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'missed', 'escalated')),
  response_time timestamptz,

  -- Check-in questions and responses
  questions_asked jsonb NOT NULL DEFAULT '[]',
  -- Example: [{"question": "How are you feeling today?", "type": "scale", "scale": "1-10"}]

  responses jsonb DEFAULT '{}',
  -- Example: {"feeling": 7, "pain_level": 3, "medication_taken": true, "concerns": "slight dizziness"}

  -- Alert triggers
  alert_triggered boolean DEFAULT false,
  alert_type text CHECK (alert_type IN ('health_decline', 'medication_non_adherence', 'no_response', 'emergency', 'follow_up_needed')),
  alert_severity text CHECK (alert_severity IN ('low', 'medium', 'high', 'critical')),
  alert_details jsonb,

  -- Follow-up actions
  requires_follow_up boolean DEFAULT false,
  follow_up_completed boolean DEFAULT false,
  follow_up_notes text,
  follow_up_by uuid REFERENCES auth.users(id),

  -- Pattern detection
  concern_flags text[] DEFAULT '{}',
  -- Example: ['declining_mood', 'missed_medications', 'increased_pain']

  -- Automated analysis
  ai_analysis_summary text,
  risk_indicators jsonb,

  -- Audit fields
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_check_ins_patient ON public.patient_daily_check_ins(patient_id);
CREATE INDEX IF NOT EXISTS idx_daily_check_ins_date ON public.patient_daily_check_ins(check_in_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_check_ins_status ON public.patient_daily_check_ins(status);
CREATE INDEX IF NOT EXISTS idx_daily_check_ins_alert ON public.patient_daily_check_ins(alert_triggered) WHERE alert_triggered = true;
CREATE INDEX IF NOT EXISTS idx_daily_check_ins_care_plan ON public.patient_daily_check_ins(care_plan_id);
CREATE INDEX IF NOT EXISTS idx_daily_check_ins_severity ON public.patient_daily_check_ins(alert_severity);

DROP TRIGGER IF EXISTS trg_daily_check_ins_uat ON public.patient_daily_check_ins;
CREATE TRIGGER trg_daily_check_ins_uat
BEFORE UPDATE ON public.patient_daily_check_ins
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.patient_daily_check_ins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_check_ins_admin_rw_patient_r" ON public.patient_daily_check_ins;
CREATE POLICY "daily_check_ins_admin_rw_patient_r" ON public.patient_daily_check_ins
  USING (public.is_admin(auth.uid()) OR patient_id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()));

-- 4. HIGH_UTILIZER_ANALYTICS table (track patterns and interventions)
CREATE TABLE IF NOT EXISTS public.high_utilizer_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tracking period
  analysis_period_start date NOT NULL,
  analysis_period_end date NOT NULL,

  -- Utilization metrics
  er_visits_count integer DEFAULT 0,
  hospital_admissions_count integer DEFAULT 0,
  readmissions_count integer DEFAULT 0,
  urgent_care_visits_count integer DEFAULT 0,
  total_visits integer DEFAULT 0,

  -- Cost metrics (if available from claims)
  estimated_total_cost numeric(12,2),
  preventable_cost_estimate numeric(12,2),

  -- Risk scoring
  utilization_risk_score integer CHECK (utilization_risk_score BETWEEN 0 AND 100),
  readmission_risk_score integer CHECK (readmission_risk_score BETWEEN 0 AND 100),
  overall_risk_category text CHECK (overall_risk_category IN ('low', 'moderate', 'high', 'very_high')),

  -- Pattern analysis
  common_diagnoses jsonb DEFAULT '[]',
  visit_patterns jsonb DEFAULT '{}',
  -- Example: {"peak_hours": [14, 15, 16], "peak_days": ["Monday", "Friday"], "triggers": ["evening", "weekend"]}

  identified_barriers jsonb DEFAULT '[]',
  -- Example: [{"barrier": "lack_of_transportation", "impact": "high"}]

  -- Intervention tracking
  interventions_applied jsonb DEFAULT '[]',
  intervention_effectiveness jsonb DEFAULT '{}',

  -- Care coordination status
  has_active_care_plan boolean DEFAULT false,
  care_plan_id uuid REFERENCES public.care_coordination_plans(id),

  -- CMS penalty risk
  cms_penalty_risk boolean DEFAULT false,
  penalty_amount_estimate numeric(12,2),

  -- AI insights
  ai_recommendations jsonb DEFAULT '[]',
  predicted_next_admission_date date,
  prediction_confidence numeric(3,2),

  -- Audit fields
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(patient_id, analysis_period_start, analysis_period_end)
);

CREATE INDEX IF NOT EXISTS idx_high_utilizer_patient ON public.high_utilizer_analytics(patient_id);
CREATE INDEX IF NOT EXISTS idx_high_utilizer_period ON public.high_utilizer_analytics(analysis_period_start, analysis_period_end);
CREATE INDEX IF NOT EXISTS idx_high_utilizer_risk ON public.high_utilizer_analytics(overall_risk_category);
CREATE INDEX IF NOT EXISTS idx_high_utilizer_cms_risk ON public.high_utilizer_analytics(cms_penalty_risk) WHERE cms_penalty_risk = true;

DROP TRIGGER IF EXISTS trg_high_utilizer_uat ON public.high_utilizer_analytics;
CREATE TRIGGER trg_high_utilizer_uat
BEFORE UPDATE ON public.high_utilizer_analytics
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.high_utilizer_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "high_utilizer_admin_only" ON public.high_utilizer_analytics;
CREATE POLICY "high_utilizer_admin_only" ON public.high_utilizer_analytics
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. CARE_TEAM_ALERTS table (real-time alerts for care team)
CREATE TABLE IF NOT EXISTS public.care_team_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  care_plan_id uuid REFERENCES public.care_coordination_plans(id) ON DELETE SET NULL,

  -- Alert details
  alert_type text NOT NULL CHECK (alert_type IN (
    'patient_stopped_responding',
    'vitals_declining',
    'missed_check_ins',
    'medication_non_adherence',
    'er_visit_detected',
    'readmission_risk_high',
    'urgent_care_visit',
    'pattern_concerning'
  )),

  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  priority text NOT NULL CHECK (priority IN ('routine', 'urgent', 'emergency')),

  title text NOT NULL,
  description text NOT NULL,

  -- Alert data
  alert_data jsonb,
  -- Example: {"missed_days": 3, "last_response": "2025-10-01", "concern_level": "high"}

  -- Assignment
  assigned_to uuid REFERENCES auth.users(id),
  assigned_at timestamptz,

  -- Status tracking
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'in_progress', 'resolved', 'dismissed')),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  resolution_notes text,

  -- Actions taken
  actions_taken jsonb DEFAULT '[]',
  -- Example: [{"action": "Called patient", "time": "2025-10-04T10:00:00Z", "outcome": "No answer, left voicemail"}]

  -- Follow-up
  requires_escalation boolean DEFAULT false,
  escalated_to uuid REFERENCES auth.users(id),
  escalated_at timestamptz,

  -- Audit fields
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_alerts_patient ON public.care_team_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_alerts_status ON public.care_team_alerts(status);
CREATE INDEX IF NOT EXISTS idx_care_alerts_severity ON public.care_team_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_care_alerts_assigned ON public.care_team_alerts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_care_alerts_care_plan ON public.care_team_alerts(care_plan_id);
CREATE INDEX IF NOT EXISTS idx_care_alerts_active ON public.care_team_alerts(status) WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_care_alerts_uat ON public.care_team_alerts;
CREATE TRIGGER trg_care_alerts_uat
BEFORE UPDATE ON public.care_team_alerts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.care_team_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "care_alerts_admin_and_assigned" ON public.care_team_alerts;
CREATE POLICY "care_alerts_admin_and_assigned" ON public.care_team_alerts
  USING (public.is_admin(auth.uid()) OR assigned_to = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()));

-- Comments for documentation
COMMENT ON TABLE public.patient_readmissions IS 'Tracks all patient readmissions and ER visits for CMS reporting and intervention';
COMMENT ON TABLE public.care_coordination_plans IS 'Personalized care plans for high-risk and frequent flyer patients';
COMMENT ON TABLE public.patient_daily_check_ins IS 'Daily automated check-ins with patients via SMS/app for early intervention';
COMMENT ON TABLE public.high_utilizer_analytics IS 'Analytics and pattern detection for high-utilizer patients';
COMMENT ON TABLE public.care_team_alerts IS 'Real-time alerts for care team when patients show concerning patterns';

commit;

-- migrate:down
begin;

DROP TABLE IF EXISTS public.care_team_alerts CASCADE;
DROP TABLE IF EXISTS public.high_utilizer_analytics CASCADE;
DROP TABLE IF EXISTS public.patient_daily_check_ins CASCADE;
DROP TABLE IF EXISTS public.care_coordination_plans CASCADE;
DROP TABLE IF EXISTS public.patient_readmissions CASCADE;

commit;
