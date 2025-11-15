-- AI Automation Skills: SDOH Passive Detector, Handoff Synthesizer, CCM Eligibility Scorer
-- Production-grade implementation for automated care detection and billing optimization
-- migrate:up
begin;

-- =====================================================
-- SKILL #4: SDOH PASSIVE DETECTOR
-- =====================================================

-- Passive SDOH Detections (auto-detected from check-ins, notes, engagement)
CREATE TABLE IF NOT EXISTS public.passive_sdoh_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Detection source
  source_type text NOT NULL CHECK (source_type IN (
    'check_in_text',
    'self_report_note',
    'meal_photo',
    'engagement_gap',
    'message_content',
    'community_post'
  )),
  source_id uuid, -- ID of check-in, self-report, etc.
  source_text text, -- Text that triggered detection
  detected_at timestamptz NOT NULL DEFAULT now(),

  -- Detected SDOH categories
  sdoh_category text NOT NULL CHECK (sdoh_category IN (
    'food_insecurity',
    'housing_instability',
    'transportation_barriers',
    'social_isolation',
    'financial_strain',
    'utilities_difficulty',
    'employment_concerns',
    'education_barriers',
    'health_literacy',
    'interpersonal_violence',
    'stress_anxiety',
    'depression_symptoms',
    'substance_use',
    'medication_access',
    'childcare_needs',
    'elder_care_needs',
    'language_barriers',
    'disability_support',
    'legal_concerns',
    'immigration_status',
    'incarceration_history',
    'digital_access',
    'environmental_hazards',
    'neighborhood_safety',
    'cultural_barriers',
    'other'
  )),

  -- Detection confidence and risk
  confidence_score numeric(3,2) NOT NULL CHECK (confidence_score BETWEEN 0.00 AND 1.00),
  -- 0.00-0.50: low confidence, 0.50-0.75: medium, 0.75-0.90: high, 0.90-1.00: very high

  risk_level text NOT NULL CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
  urgency text NOT NULL CHECK (urgency IN ('routine', 'soon', 'urgent', 'emergency')),

  -- Detection details
  detected_keywords text[], -- Keywords that triggered detection
  contextual_evidence jsonb, -- Supporting evidence
  z_code_mapping text, -- ICD-10 Z-code for billing (e.g., Z59.0 = homelessness)

  -- AI analysis
  ai_summary text, -- Brief summary of detection
  ai_rationale text, -- Why AI detected this
  recommended_actions jsonb, -- Suggested interventions
  -- Example: [{"action": "Refer to social worker", "priority": "high", "timeframe": "within 48 hours"}]

  -- Clinical review
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Awaiting clinical review
    'confirmed',    -- Provider confirmed detection
    'dismissed',    -- False positive
    'escalated',    -- Needs urgent attention
    'resolved'      -- Issue addressed
  )),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,

  -- Auto-created indicator
  sdoh_indicator_id uuid, -- TODO: Add FK constraint once sdoh_indicators table is re-created
  auto_created_indicator boolean DEFAULT false,

  -- Model metadata
  ai_model_used text,
  ai_cost numeric(10,4),
  processing_batch_id uuid, -- For batch processing tracking

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

-- =====================================================
-- SKILL #7: HANDOFF RISK SYNTHESIZER
-- =====================================================

-- AI-Generated Shift Handoff Summaries
CREATE TABLE IF NOT EXISTS public.ai_shift_handoff_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Shift information
  shift_date date NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('day', 'evening', 'night')),
  from_shift text NOT NULL, -- 'day', 'evening', 'night'
  to_shift text NOT NULL,
  unit_name text, -- Ward/unit name

  -- Patient census
  patient_count integer NOT NULL,
  high_risk_patient_count integer NOT NULL DEFAULT 0,

  -- AI-generated summary
  executive_summary text NOT NULL, -- 2-3 sentence overview
  critical_alerts jsonb NOT NULL DEFAULT '[]',
  -- Example: [{"patient_id": "...", "alert": "Vitals declining", "severity": "high"}]

  high_risk_patients jsonb NOT NULL DEFAULT '[]',
  -- Example: [{"patient_id": "...", "name": "[REDACTED]", "risk_factors": [...], "action_items": [...]}]

  vitals_trends jsonb NOT NULL DEFAULT '{}',
  -- Example: {"trending_up": 5, "stable": 20, "trending_down": 3, "critical": 1}

  care_plan_updates jsonb NOT NULL DEFAULT '[]',
  -- Example: [{"patient_id": "...", "update": "New pain management protocol", "priority": "medium"}]

  behavioral_concerns jsonb NOT NULL DEFAULT '[]',
  -- Example: [{"patient_id": "...", "concern": "Increased agitation", "intervention": "..."}]

  pending_tasks jsonb NOT NULL DEFAULT '[]',
  -- Example: [{"task": "Complete discharge paperwork for Pt 302", "priority": "high", "deadline": "..."}]

  medication_alerts jsonb NOT NULL DEFAULT '[]',
  -- Example: [{"patient_id": "...", "alert": "PRN pain med request at 14:30", "follow_up": "..."}]

  -- Synthesis metadata
  data_sources_analyzed jsonb NOT NULL DEFAULT '{}',
  -- Example: {"observations": true, "care_plans": true, "anomalies": true, "risk_assessments": true}

  patients_analyzed uuid[], -- Array of patient IDs included in summary

  -- Model metadata
  ai_model_used text NOT NULL,
  ai_cost numeric(10,4),
  synthesis_duration_seconds numeric(5,2),
  generated_at timestamptz NOT NULL DEFAULT now(),

  -- Handoff acknowledgment
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  handoff_notes text, -- Additional notes from receiving nurse

  -- Audit
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_handoff_tenant ON public.ai_shift_handoff_summaries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_handoff_date ON public.ai_shift_handoff_summaries(shift_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_handoff_shift ON public.ai_shift_handoff_summaries(shift_type);
CREATE INDEX IF NOT EXISTS idx_ai_handoff_acknowledged ON public.ai_shift_handoff_summaries(acknowledged_at) WHERE acknowledged_at IS NULL;

DROP TRIGGER IF EXISTS trg_ai_handoff_uat ON public.ai_shift_handoff_summaries;
CREATE TRIGGER trg_ai_handoff_uat
BEFORE UPDATE ON public.ai_shift_handoff_summaries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_shift_handoff_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_handoff_tenant_isolation" ON public.ai_shift_handoff_summaries;
CREATE POLICY "ai_handoff_tenant_isolation" ON public.ai_shift_handoff_summaries
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

COMMENT ON TABLE public.ai_shift_handoff_summaries IS 'AI-generated shift handoff summaries for nursing staff';

-- =====================================================
-- SKILL #9: CCM ELIGIBILITY SCORER
-- =====================================================

-- CCM (Chronic Care Management) Eligibility Assessments
CREATE TABLE IF NOT EXISTS public.ccm_eligibility_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Assessment date
  assessment_date date NOT NULL DEFAULT CURRENT_DATE,
  assessment_period_start date NOT NULL,
  assessment_period_end date NOT NULL,

  -- CCM eligibility criteria
  chronic_conditions_count integer NOT NULL,
  chronic_conditions jsonb NOT NULL DEFAULT '[]',
  -- Example: [{"code": "E11.9", "description": "Type 2 diabetes", "severity": "moderate"}]

  meets_cms_criteria boolean NOT NULL, -- 2+ chronic conditions

  -- Engagement metrics
  engagement_score numeric(3,2) NOT NULL CHECK (engagement_score BETWEEN 0.00 AND 1.00),
  check_in_completion_rate numeric(3,2),
  appointment_adherence_rate numeric(3,2),
  medication_adherence_rate numeric(3,2),

  -- SDOH risk factors
  sdoh_risk_count integer DEFAULT 0,
  sdoh_barriers jsonb DEFAULT '[]',
  -- Example: [{"category": "transportation", "risk_level": "high"}]

  -- Eligibility score
  overall_eligibility_score numeric(3,2) NOT NULL CHECK (overall_eligibility_score BETWEEN 0.00 AND 1.00),
  -- Score combines: chronic conditions, engagement, SDOH needs

  eligibility_category text NOT NULL CHECK (eligibility_category IN (
    'not_eligible',      -- < 2 chronic conditions
    'eligible_low',      -- Eligible but low engagement
    'eligible_moderate', -- Eligible with moderate engagement
    'eligible_high',     -- Excellent CCM candidate
    'enrolled'           -- Already enrolled in CCM
  )),

  -- Predicted reimbursement
  predicted_monthly_reimbursement numeric(10,2),
  -- CPT 99490: $42-65/month for 20+ min
  -- CPT 99439: Additional $30-45 for complex patients

  reimbursement_tier text CHECK (reimbursement_tier IN ('basic', 'complex', 'principal_care')),
  recommended_cpt_codes text[],

  -- AI recommendations
  enrollment_recommendation text NOT NULL CHECK (enrollment_recommendation IN (
    'strongly_recommend',
    'recommend',
    'consider',
    'not_recommended'
  )),

  recommendation_rationale text,

  barriers_to_enrollment jsonb DEFAULT '[]',
  -- Example: [{"barrier": "Low engagement", "solution": "Increase outreach frequency"}]

  recommended_interventions jsonb DEFAULT '[]',
  -- Example: [{"intervention": "Schedule monthly care coordination calls", "benefit": "Increases engagement"}]

  -- Enrollment tracking
  enrollment_status text NOT NULL DEFAULT 'not_enrolled' CHECK (enrollment_status IN (
    'not_enrolled',
    'outreach_pending',
    'consent_pending',
    'enrolled',
    'declined',
    'ineligible'
  )),

  enrolled_at timestamptz,
  enrollment_consent_date date,
  assigned_care_coordinator_id uuid REFERENCES auth.users(id),

  -- Model metadata
  ai_model_used text,
  ai_cost numeric(10,4),
  assessment_batch_id uuid, -- For weekly batch processing

  -- Audit
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One assessment per patient per period
  UNIQUE(patient_id, assessment_period_start, assessment_period_end)
);

CREATE INDEX IF NOT EXISTS idx_ccm_eligibility_tenant ON public.ccm_eligibility_assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccm_eligibility_patient ON public.ccm_eligibility_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_ccm_eligibility_date ON public.ccm_eligibility_assessments(assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_ccm_eligibility_category ON public.ccm_eligibility_assessments(eligibility_category);
CREATE INDEX IF NOT EXISTS idx_ccm_eligibility_enrolled ON public.ccm_eligibility_assessments(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_ccm_eligibility_high ON public.ccm_eligibility_assessments(overall_eligibility_score DESC)
  WHERE eligibility_category IN ('eligible_high', 'eligible_moderate');

DROP TRIGGER IF EXISTS trg_ccm_eligibility_uat ON public.ccm_eligibility_assessments;
CREATE TRIGGER trg_ccm_eligibility_uat
BEFORE UPDATE ON public.ccm_eligibility_assessments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ccm_eligibility_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ccm_eligibility_tenant_isolation" ON public.ccm_eligibility_assessments;
CREATE POLICY "ccm_eligibility_tenant_isolation" ON public.ccm_eligibility_assessments
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

COMMENT ON TABLE public.ccm_eligibility_assessments IS 'AI-powered CCM eligibility assessments for billing optimization';

-- =====================================================
-- FEATURE FLAGS UPDATE (extend ai_skill_config)
-- =====================================================

ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS sdoh_passive_detector_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sdoh_passive_detector_auto_create_indicators boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sdoh_passive_detector_confidence_threshold numeric(3,2) DEFAULT 0.75,
ADD COLUMN IF NOT EXISTS sdoh_passive_detector_model text DEFAULT 'claude-haiku-4-5-20250929',

ADD COLUMN IF NOT EXISTS handoff_synthesizer_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS handoff_synthesizer_auto_generate boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS handoff_synthesizer_model text DEFAULT 'claude-haiku-4-5-20250929',

ADD COLUMN IF NOT EXISTS ccm_eligibility_scorer_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ccm_eligibility_scorer_auto_enroll boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ccm_eligibility_scorer_minimum_score numeric(3,2) DEFAULT 0.70,
ADD COLUMN IF NOT EXISTS ccm_eligibility_scorer_model text DEFAULT 'claude-haiku-4-5-20250929';

COMMENT ON COLUMN public.ai_skill_config.sdoh_passive_detector_enabled IS 'Enable passive SDOH detection from check-ins and notes';
COMMENT ON COLUMN public.ai_skill_config.handoff_synthesizer_enabled IS 'Enable AI-powered shift handoff summaries';
COMMENT ON COLUMN public.ai_skill_config.ccm_eligibility_scorer_enabled IS 'Enable automated CCM eligibility scoring';

-- =====================================================
-- ANALYTICS VIEWS
-- =====================================================

-- SDOH Passive Detection Analytics
CREATE OR REPLACE VIEW public.sdoh_passive_detection_analytics AS
SELECT
  tenant_id,
  DATE(detected_at) as detection_date,
  sdoh_category,
  COUNT(*) as total_detections,
  COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_detections,
  COUNT(*) FILTER (WHERE status = 'dismissed') as false_positives,
  COUNT(*) FILTER (WHERE auto_created_indicator = true) as auto_created_indicators,
  AVG(confidence_score) as avg_confidence,
  COUNT(*) FILTER (WHERE risk_level = 'critical') as critical_risk_count,
  SUM(ai_cost) as total_ai_cost
FROM public.passive_sdoh_detections
GROUP BY tenant_id, DATE(detected_at), sdoh_category;

COMMENT ON VIEW public.sdoh_passive_detection_analytics IS 'Daily analytics for passive SDOH detection performance';

-- Handoff Synthesis Analytics
CREATE OR REPLACE VIEW public.handoff_synthesis_analytics AS
SELECT
  tenant_id,
  shift_date,
  shift_type,
  COUNT(*) as handoffs_generated,
  AVG(patient_count) as avg_patient_census,
  AVG(high_risk_patient_count) as avg_high_risk_patients,
  COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL) as acknowledged_count,
  AVG(EXTRACT(EPOCH FROM (acknowledged_at - generated_at))/60) as avg_acknowledgment_time_minutes,
  SUM(ai_cost) as total_ai_cost,
  AVG(synthesis_duration_seconds) as avg_synthesis_time
FROM public.ai_shift_handoff_summaries
GROUP BY tenant_id, shift_date, shift_type;

COMMENT ON VIEW public.handoff_synthesis_analytics IS 'Daily analytics for AI shift handoff synthesis';

-- CCM Eligibility Analytics
CREATE OR REPLACE VIEW public.ccm_eligibility_analytics AS
SELECT
  tenant_id,
  assessment_date,
  COUNT(*) as total_assessments,
  COUNT(*) FILTER (WHERE meets_cms_criteria = true) as cms_eligible_count,
  COUNT(*) FILTER (WHERE eligibility_category = 'eligible_high') as high_priority_count,
  COUNT(*) FILTER (WHERE enrollment_status = 'enrolled') as enrolled_count,
  SUM(predicted_monthly_reimbursement) as total_predicted_revenue,
  AVG(overall_eligibility_score) as avg_eligibility_score,
  COUNT(*) FILTER (WHERE enrollment_status = 'declined') as declined_count,
  SUM(ai_cost) as total_ai_cost
FROM public.ccm_eligibility_assessments
GROUP BY tenant_id, assessment_date;

COMMENT ON VIEW public.ccm_eligibility_analytics IS 'Analytics for CCM eligibility assessments and revenue potential';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON public.passive_sdoh_detections TO authenticated;
GRANT SELECT ON public.ai_shift_handoff_summaries TO authenticated;
GRANT SELECT ON public.ccm_eligibility_assessments TO authenticated;
GRANT SELECT ON public.sdoh_passive_detection_analytics TO authenticated;
GRANT SELECT ON public.handoff_synthesis_analytics TO authenticated;
GRANT SELECT ON public.ccm_eligibility_analytics TO authenticated;

commit;

-- migrate:down
begin;

DROP VIEW IF EXISTS public.ccm_eligibility_analytics CASCADE;
DROP VIEW IF EXISTS public.handoff_synthesis_analytics CASCADE;
DROP VIEW IF EXISTS public.sdoh_passive_detection_analytics CASCADE;

ALTER TABLE public.ai_skill_config
DROP COLUMN IF EXISTS sdoh_passive_detector_enabled,
DROP COLUMN IF EXISTS sdoh_passive_detector_auto_create_indicators,
DROP COLUMN IF EXISTS sdoh_passive_detector_confidence_threshold,
DROP COLUMN IF EXISTS sdoh_passive_detector_model,
DROP COLUMN IF EXISTS handoff_synthesizer_enabled,
DROP COLUMN IF EXISTS handoff_synthesizer_auto_generate,
DROP COLUMN IF EXISTS handoff_synthesizer_model,
DROP COLUMN IF EXISTS ccm_eligibility_scorer_enabled,
DROP COLUMN IF EXISTS ccm_eligibility_scorer_auto_enroll,
DROP COLUMN IF EXISTS ccm_eligibility_scorer_minimum_score,
DROP COLUMN IF EXISTS ccm_eligibility_scorer_model;

DROP TABLE IF EXISTS public.ccm_eligibility_assessments CASCADE;
DROP TABLE IF EXISTS public.ai_shift_handoff_summaries CASCADE;
DROP TABLE IF EXISTS public.passive_sdoh_detections CASCADE;

commit;
