-- ============================================================================
-- Add All 36 AI Skill Columns to ai_skill_config
-- ============================================================================
-- This migration adds the missing 31 skill columns to support all 36 completed
-- AI skills in the Envision dashboard.
--
-- Existing columns (5):
--   1. billing_suggester_enabled
--   2. readmission_predictor_enabled
--   3. cultural_health_coach_enabled
--   4. welfare_check_dispatcher_enabled
--   5. emergency_intelligence_enabled
--
-- Adding columns for skills #3-36 (31 new columns)
-- ============================================================================

-- Skill #3: SDOH Passive Detector
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS sdoh_passive_detector_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sdoh_passive_detector_model TEXT DEFAULT 'claude-haiku-4-5-20250929',
ADD COLUMN IF NOT EXISTS sdoh_passive_detector_confidence_threshold NUMERIC(3,2) DEFAULT 0.75,
ADD COLUMN IF NOT EXISTS sdoh_passive_detector_auto_create_indicators BOOLEAN DEFAULT false;

-- Skill #4: Dashboard Personalization
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS dashboard_personalization_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS dashboard_personalization_model TEXT DEFAULT 'claude-haiku-4-5-20250929';

-- Skill #5: Medical Transcript Processing
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS medical_transcript_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS medical_transcript_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #6: CCM Eligibility Scorer
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS ccm_eligibility_scorer_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ccm_eligibility_scorer_model TEXT DEFAULT 'claude-haiku-4-5-20250929',
ADD COLUMN IF NOT EXISTS ccm_eligibility_scorer_minimum_score NUMERIC(3,2) DEFAULT 0.70,
ADD COLUMN IF NOT EXISTS ccm_eligibility_scorer_auto_enroll BOOLEAN DEFAULT false;

-- Skill #8: Bed Optimizer
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS bed_optimizer_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bed_optimizer_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #9: Drug Interaction Checker
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS drug_interaction_checker_enabled BOOLEAN DEFAULT false;

-- Skill #10: Patient Form Extraction
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS patient_form_extraction_enabled BOOLEAN DEFAULT false;

-- Skill #11: Riley Smart Scribe
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS riley_smart_scribe_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS riley_smart_scribe_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #12: Mood Suggestions
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS mood_suggestions_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mood_suggestions_model TEXT DEFAULT 'claude-haiku-4-5-20250929';

-- Skill #13: Smart Check-In Questions
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS smart_checkin_questions_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS smart_checkin_questions_model TEXT DEFAULT 'claude-haiku-4-5-20250929';

-- Skill #14: Patient Education Generator
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS patient_education_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS patient_education_model TEXT DEFAULT 'claude-haiku-4-5-20250929';

-- Skill #15: Enhanced Drug Interactions
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS enhanced_drug_interactions_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS enhanced_drug_interactions_model TEXT DEFAULT 'claude-haiku-4-5-20250929';

-- Skill #16: Dashboard Anomaly Detection
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS dashboard_anomaly_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS dashboard_anomaly_model TEXT DEFAULT 'claude-haiku-4-5-20250929';

-- Skill #17: Caregiver Briefing Generator
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS caregiver_briefing_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS caregiver_briefing_model TEXT DEFAULT 'claude-haiku-4-5-20250929';

-- Skill #18: SOAP Note Auto-Generator
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS soap_note_generator_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS soap_note_generator_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #19: Discharge Summary Generator
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS discharge_summary_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS discharge_summary_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #20: Care Plan Auto-Generator
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS care_plan_generator_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS care_plan_generator_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #21: Progress Note Synthesizer
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS progress_note_synthesizer_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS progress_note_synthesizer_model TEXT DEFAULT 'claude-haiku-4-5-20250929';

-- Skill #22: Referral Letter Generator
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS referral_letter_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS referral_letter_model TEXT DEFAULT 'claude-haiku-4-5-20250929';

-- Skill #23: Treatment Pathway Recommender
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS treatment_pathway_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS treatment_pathway_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #24: Clinical Guideline Matcher
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS clinical_guideline_matcher_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS clinical_guideline_matcher_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #25: Contraindication Detector
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS contraindication_detector_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS contraindication_detector_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #26: Medication Reconciliation AI
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS medication_reconciliation_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS medication_reconciliation_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #27: Appointment Prep Instructions
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS appointment_prep_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS appointment_prep_model TEXT DEFAULT 'claude-haiku-4-5-20250929';

-- Skill #28: Missed Check-In Escalation
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS missed_checkin_escalation_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS missed_checkin_escalation_model TEXT DEFAULT 'claude-haiku-4-5-20250929';

-- Skill #30: Fall Risk Predictor
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS fall_risk_predictor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS fall_risk_predictor_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #31: Medication Adherence Predictor
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS medication_adherence_predictor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS medication_adherence_predictor_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #32: Care Escalation Scorer
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS care_escalation_scorer_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS care_escalation_scorer_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #33: Infection Risk Predictor (HAI)
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS infection_risk_predictor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS infection_risk_predictor_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #35: Schedule Optimizer
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS schedule_optimizer_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS schedule_optimizer_model TEXT DEFAULT 'claude-haiku-4-5-20250929';

-- Skill #50: FHIR Semantic Mapper
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS fhir_semantic_mapper_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS fhir_semantic_mapper_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #56: Patient Q&A Bot
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS patient_qa_bot_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS patient_qa_bot_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #57: Provider Assistant
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS provider_assistant_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS provider_assistant_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Skill #7: Handoff Synthesizer (referenced in enable script but missing)
ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS handoff_synthesizer_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS handoff_synthesizer_model TEXT DEFAULT 'claude-haiku-4-5-20250929',
ADD COLUMN IF NOT EXISTS handoff_synthesizer_auto_generate BOOLEAN DEFAULT false;

-- ============================================================================
-- Enable all skills for existing tenants
-- ============================================================================
UPDATE public.ai_skill_config SET
  -- Existing skills (keep enabled if already enabled)
  billing_suggester_enabled = COALESCE(billing_suggester_enabled, true),
  readmission_predictor_enabled = COALESCE(readmission_predictor_enabled, true),
  cultural_health_coach_enabled = COALESCE(cultural_health_coach_enabled, true),
  welfare_check_dispatcher_enabled = COALESCE(welfare_check_dispatcher_enabled, true),
  emergency_intelligence_enabled = COALESCE(emergency_intelligence_enabled, true),

  -- New skills - enable all
  sdoh_passive_detector_enabled = true,
  dashboard_personalization_enabled = true,
  medical_transcript_enabled = true,
  ccm_eligibility_scorer_enabled = true,
  bed_optimizer_enabled = true,
  drug_interaction_checker_enabled = true,
  patient_form_extraction_enabled = true,
  riley_smart_scribe_enabled = true,
  mood_suggestions_enabled = true,
  smart_checkin_questions_enabled = true,
  patient_education_enabled = true,
  enhanced_drug_interactions_enabled = true,
  dashboard_anomaly_enabled = true,
  caregiver_briefing_enabled = true,
  soap_note_generator_enabled = true,
  discharge_summary_enabled = true,
  care_plan_generator_enabled = true,
  progress_note_synthesizer_enabled = true,
  referral_letter_enabled = true,
  treatment_pathway_enabled = true,
  clinical_guideline_matcher_enabled = true,
  contraindication_detector_enabled = true,
  medication_reconciliation_enabled = true,
  appointment_prep_enabled = true,
  missed_checkin_escalation_enabled = true,
  fall_risk_predictor_enabled = true,
  medication_adherence_predictor_enabled = true,
  care_escalation_scorer_enabled = true,
  infection_risk_predictor_enabled = true,
  schedule_optimizer_enabled = true,
  fhir_semantic_mapper_enabled = true,
  patient_qa_bot_enabled = true,
  provider_assistant_enabled = true,
  handoff_synthesizer_enabled = true,
  updated_at = now();

-- ============================================================================
-- Insert config for any tenants that don't have ai_skill_config yet
-- ============================================================================
INSERT INTO public.ai_skill_config (
  tenant_id,
  billing_suggester_enabled,
  readmission_predictor_enabled,
  cultural_health_coach_enabled,
  welfare_check_dispatcher_enabled,
  emergency_intelligence_enabled,
  sdoh_passive_detector_enabled,
  dashboard_personalization_enabled,
  medical_transcript_enabled,
  ccm_eligibility_scorer_enabled,
  bed_optimizer_enabled,
  drug_interaction_checker_enabled,
  patient_form_extraction_enabled,
  riley_smart_scribe_enabled,
  mood_suggestions_enabled,
  smart_checkin_questions_enabled,
  patient_education_enabled,
  enhanced_drug_interactions_enabled,
  dashboard_anomaly_enabled,
  caregiver_briefing_enabled,
  soap_note_generator_enabled,
  discharge_summary_enabled,
  care_plan_generator_enabled,
  progress_note_synthesizer_enabled,
  referral_letter_enabled,
  treatment_pathway_enabled,
  clinical_guideline_matcher_enabled,
  contraindication_detector_enabled,
  medication_reconciliation_enabled,
  appointment_prep_enabled,
  missed_checkin_escalation_enabled,
  fall_risk_predictor_enabled,
  medication_adherence_predictor_enabled,
  care_escalation_scorer_enabled,
  infection_risk_predictor_enabled,
  schedule_optimizer_enabled,
  fhir_semantic_mapper_enabled,
  patient_qa_bot_enabled,
  provider_assistant_enabled,
  handoff_synthesizer_enabled
)
SELECT
  t.id,
  true, true, true, true, true,  -- Original 5
  true, true, true, true, true,  -- Skills 3-8
  true, true, true, true, true,  -- Skills 9-13
  true, true, true, true, true,  -- Skills 14-18
  true, true, true, true, true,  -- Skills 19-23
  true, true, true, true, true,  -- Skills 24-28
  true, true, true, true, true,  -- Skills 30-35
  true, true, true, true         -- Skills 50, 56, 57, 7
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skill_config c WHERE c.tenant_id = t.id
);

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  col_count INTEGER;
  enabled_count INTEGER;
BEGIN
  -- Count enabled columns
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'ai_skill_config'
    AND column_name LIKE '%_enabled';

  -- Count tenants with skills enabled
  SELECT COUNT(*) INTO enabled_count
  FROM ai_skill_config
  WHERE billing_suggester_enabled = true;

  RAISE NOTICE '✅ AI Skill columns: % enabled flags', col_count;
  RAISE NOTICE '✅ Tenants with skills enabled: %', enabled_count;
END $$;
