-- ============================================================================
-- Create Missing AI Skill Tables
-- This migration creates tables that were supposed to exist but don't
-- The original migrations (20251115120000, 20251115130000, 20251004000000)
-- are marked as applied but the tables were not created (likely rolled back)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE CARE_COORDINATION_PLANS (needed by Skill #3: Readmission Predictor)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.care_coordination_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plan metadata
  plan_type text NOT NULL CHECK (plan_type IN ('readmission_prevention', 'chronic_care', 'transitional_care', 'high_utilizer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'discontinued')),
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Plan details
  title text NOT NULL,
  goals jsonb NOT NULL DEFAULT '[]',
  interventions jsonb NOT NULL DEFAULT '[]',
  barriers jsonb DEFAULT '[]',

  -- SDOH integration
  sdoh_factors jsonb DEFAULT '{}',

  -- Team coordination
  care_team_members jsonb DEFAULT '[]',
  primary_coordinator_id uuid REFERENCES auth.users(id),

  -- Dates
  start_date date NOT NULL DEFAULT now()::date,
  end_date date,
  last_reviewed_date date,
  next_review_date date,

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_care_plans_tenant ON public.care_coordination_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_patient ON public.care_coordination_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_status ON public.care_coordination_plans(status);

DROP TRIGGER IF EXISTS trg_care_plans_uat ON public.care_coordination_plans;
CREATE TRIGGER trg_care_plans_uat
BEFORE UPDATE ON public.care_coordination_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.care_coordination_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "care_plans_tenant_isolation" ON public.care_coordination_plans;
CREATE POLICY "care_plans_tenant_isolation" ON public.care_coordination_plans
  FOR ALL
  USING (
    CASE
      WHEN tenant_id IS NOT NULL THEN tenant_id = get_current_tenant_id()
      ELSE patient_id IN (SELECT id FROM auth.users WHERE id = auth.uid())
    END
  );

COMMENT ON TABLE public.care_coordination_plans IS 'Personalized care plans for high-risk patients (readmission prevention, chronic care, etc.)';

-- ============================================================================
-- 2. CREATE READMISSION_RISK_PREDICTIONS (Skill #3: Readmission Predictor)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.readmission_risk_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Discharge information
  discharge_date date NOT NULL,
  discharge_facility text,
  discharge_diagnosis_codes text[] DEFAULT '{}',
  discharge_disposition text,

  -- Risk prediction
  readmission_risk_score numeric(3,2) NOT NULL CHECK (readmission_risk_score BETWEEN 0.00 AND 1.00),
  risk_category text NOT NULL CHECK (risk_category IN ('low', 'medium', 'high', 'critical')),
  predicted_readmission_window_days integer NOT NULL DEFAULT 30,

  -- Risk factors identified
  primary_risk_factors jsonb NOT NULL DEFAULT '[]',
  secondary_risk_factors jsonb DEFAULT '[]',
  protective_factors jsonb DEFAULT '[]',

  -- AI recommendations
  recommended_interventions jsonb NOT NULL DEFAULT '[]',
  recommended_follow_up_timeframe text,
  recommended_care_intensity text CHECK (recommended_care_intensity IN ('standard', 'enhanced', 'intensive')),

  -- Clinical context
  patient_age integer,
  patient_comorbidities text[],
  recent_hospitalizations_count integer DEFAULT 0,
  recent_er_visits_count integer DEFAULT 0,
  has_active_care_plan boolean,

  -- Follow-up tracking
  follow_up_scheduled boolean DEFAULT false,
  follow_up_appointment_date date,
  care_plan_created boolean DEFAULT false,
  care_plan_id uuid REFERENCES public.care_coordination_plans(id) ON DELETE SET NULL,

  -- Outcome tracking
  actual_readmission_occurred boolean,
  actual_readmission_date date,
  actual_readmission_days_post_discharge integer,
  prediction_accuracy_score numeric(3,2),

  -- Model metadata
  ai_model_used text NOT NULL,
  ai_cost numeric(10,4),
  prediction_generated_at timestamptz NOT NULL DEFAULT now(),

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readmission_tenant ON public.readmission_risk_predictions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_readmission_patient ON public.readmission_risk_predictions(patient_id);
CREATE INDEX IF NOT EXISTS idx_readmission_discharge ON public.readmission_risk_predictions(discharge_date DESC);
CREATE INDEX IF NOT EXISTS idx_readmission_risk ON public.readmission_risk_predictions(risk_category);
CREATE INDEX IF NOT EXISTS idx_readmission_followup ON public.readmission_risk_predictions(follow_up_scheduled) WHERE follow_up_scheduled = false;

DROP TRIGGER IF EXISTS trg_readmission_uat ON public.readmission_risk_predictions;
CREATE TRIGGER trg_readmission_uat
BEFORE UPDATE ON public.readmission_risk_predictions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.readmission_risk_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "readmission_tenant_isolation" ON public.readmission_risk_predictions;
CREATE POLICY "readmission_tenant_isolation" ON public.readmission_risk_predictions
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

COMMENT ON TABLE public.readmission_risk_predictions IS 'AI-predicted hospital readmission risk for recently discharged patients';

-- ============================================================================
-- 3. CREATE PASSIVE_SDOH_DETECTIONS (Skill #4: SDOH Passive Detector)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passive_sdoh_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Detection source
  source_type text NOT NULL CHECK (source_type IN (
    'check_in_text', 'self_report_note', 'meal_photo',
    'engagement_gap', 'message_content', 'community_post'
  )),
  source_id uuid,
  source_text text,
  detected_at timestamptz NOT NULL DEFAULT now(),

  -- Detected SDOH category
  sdoh_category text NOT NULL CHECK (sdoh_category IN (
    'food_insecurity', 'housing_instability', 'transportation_barriers',
    'social_isolation', 'financial_strain', 'utilities_difficulty',
    'employment_concerns', 'education_barriers', 'health_literacy',
    'interpersonal_violence', 'stress_anxiety', 'depression_symptoms',
    'substance_use', 'medication_access', 'childcare_needs',
    'elder_care_needs', 'language_barriers', 'disability_support',
    'legal_concerns', 'immigration_status', 'incarceration_history',
    'digital_access', 'environmental_hazards', 'neighborhood_safety',
    'cultural_barriers', 'other'
  )),

  -- Detection confidence and risk
  confidence_score numeric(3,2) NOT NULL CHECK (confidence_score BETWEEN 0.00 AND 1.00),
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
  urgency text NOT NULL CHECK (urgency IN ('routine', 'soon', 'urgent', 'emergency')),

  -- Detection details
  detected_keywords text[],
  contextual_evidence jsonb,
  z_code_mapping text,

  -- AI analysis
  ai_summary text,
  ai_rationale text,
  recommended_actions jsonb,

  -- Clinical review
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'dismissed', 'escalated', 'resolved'
  )),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,

  -- Auto-created indicator (references sdoh_observations)
  sdoh_indicator_id uuid REFERENCES public.sdoh_observations(id) ON DELETE SET NULL,
  auto_created_indicator boolean DEFAULT false,

  -- Model metadata
  ai_model_used text,
  ai_cost numeric(10,4),
  processing_batch_id uuid,

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passive_sdoh_tenant ON public.passive_sdoh_detections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_passive_sdoh_patient ON public.passive_sdoh_detections(patient_id);
CREATE INDEX IF NOT EXISTS idx_passive_sdoh_status ON public.passive_sdoh_detections(status);
CREATE INDEX IF NOT EXISTS idx_passive_sdoh_category ON public.passive_sdoh_detections(sdoh_category);
CREATE INDEX IF NOT EXISTS idx_passive_sdoh_risk ON public.passive_sdoh_detections(risk_level);
CREATE INDEX IF NOT EXISTS idx_passive_sdoh_pending ON public.passive_sdoh_detections(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_passive_sdoh_detected_at ON public.passive_sdoh_detections(detected_at DESC);

DROP TRIGGER IF EXISTS trg_passive_sdoh_uat ON public.passive_sdoh_detections;
CREATE TRIGGER trg_passive_sdoh_uat
BEFORE UPDATE ON public.passive_sdoh_detections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.passive_sdoh_detections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "passive_sdoh_tenant_isolation" ON public.passive_sdoh_detections;
CREATE POLICY "passive_sdoh_tenant_isolation" ON public.passive_sdoh_detections
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

COMMENT ON TABLE public.passive_sdoh_detections IS 'AI-detected social determinants of health from patient communications';
COMMENT ON COLUMN public.passive_sdoh_detections.sdoh_indicator_id IS
  'References sdoh_observations.id (note: column name says "indicator" but references "observations" table)';

COMMIT;
