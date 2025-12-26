-- ============================================================================
-- Modular AI Skills Design
-- ============================================================================
-- This migration creates a truly modular, row-based AI skills system that
-- supports dynamic skill addition and license-based entitlements.
--
-- Tables created:
--   1. ai_skills - Master table of all available AI skills
--   2. tenant_ai_skill_config - Junction table for tenant-skill relationships
--   3. license_tier_skills - Which skills are included in each license tier
--
-- Benefits:
--   - Add new skills without migrations (just INSERT)
--   - License-based entitlements
--   - Dynamic UI reads from database
--   - Audit trail for skill changes
-- ============================================================================

-- ============================================================================
-- 1. AI Skills Master Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_key TEXT NOT NULL UNIQUE,  -- e.g., 'billing_suggester', 'soap_note_generator'
  skill_number INTEGER NOT NULL UNIQUE,  -- e.g., 1, 2, 3... for ordering
  name TEXT NOT NULL,  -- Display name
  description TEXT,
  category TEXT NOT NULL,  -- 'core', 'clinical_docs', 'decision_support', 'patient_engagement', 'risk_prediction', 'admin', 'conversational', 'interoperability'
  model TEXT DEFAULT 'claude-haiku-4-5-20250929',  -- Default AI model
  monthly_cost_estimate NUMERIC(10,2) DEFAULT 0,  -- Estimated cost per tenant
  is_active BOOLEAN DEFAULT true,  -- Global on/off switch
  requires_license_tier TEXT[] DEFAULT ARRAY['standard', 'professional', 'enterprise'],  -- Which tiers include this
  icon_name TEXT,  -- Lucide icon name for UI
  color_class TEXT,  -- Tailwind color class
  service_path TEXT,  -- Path to the service file
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_skills_category ON public.ai_skills(category);
CREATE INDEX IF NOT EXISTS idx_ai_skills_skill_key ON public.ai_skills(skill_key);

-- ============================================================================
-- 2. Tenant AI Skill Configuration (Junction Table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_ai_skill_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.ai_skills(id) ON DELETE CASCADE,
  is_entitled BOOLEAN DEFAULT false,  -- Paid for / included in license
  is_enabled BOOLEAN DEFAULT false,   -- Actually turned on
  settings JSONB DEFAULT '{}',        -- Skill-specific settings
  enabled_at TIMESTAMPTZ,
  enabled_by UUID REFERENCES auth.users(id),
  disabled_at TIMESTAMPTZ,
  disabled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, skill_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_tenant_ai_skill_tenant ON public.tenant_ai_skill_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_ai_skill_skill ON public.tenant_ai_skill_config(skill_id);
CREATE INDEX IF NOT EXISTS idx_tenant_ai_skill_enabled ON public.tenant_ai_skill_config(is_enabled) WHERE is_enabled = true;

-- ============================================================================
-- 3. Insert All 36 Completed AI Skills
-- ============================================================================
INSERT INTO public.ai_skills (skill_number, skill_key, name, description, category, model, monthly_cost_estimate, icon_name, color_class, service_path) VALUES
-- Core Skills (1-12)
(1, 'billing_suggester', 'Billing Code Suggester', 'AI-powered ICD-10/CPT code suggestions with 95% cache hit rate', 'core', 'claude-haiku-4-5-20250929', 2.40, 'DollarSign', 'text-green-600', 'src/services/ai/billingCodeSuggester.ts'),
(2, 'readmission_predictor', 'Readmission Risk Predictor', '30/7/90-day readmission risk prediction', 'core', 'claude-sonnet-4-5-20250929', 4.20, 'TrendingUp', 'text-blue-600', 'src/services/ai/readmissionRiskPredictor.ts'),
(3, 'sdoh_passive_detector', 'SDOH Passive Detector', 'Daily batch detection of 25 social determinant categories', 'core', 'claude-haiku-4-5-20250929', 1.80, 'Users', 'text-orange-600', 'src/services/ai/sdohPassiveDetector.ts'),
(4, 'dashboard_personalization', 'Dashboard Personalization', 'AI-personalized dashboard layouts', 'core', 'claude-haiku-4-5-20250929', 1.00, 'Layout', 'text-purple-600', 'supabase/functions/claude-personalization/'),
(5, 'medical_transcript', 'Medical Transcript Processing', 'Real-time medical transcription streaming', 'core', 'claude-sonnet-4-5-20250929', 5.00, 'FileText', 'text-indigo-600', 'supabase/functions/process-medical-transcript/'),
(6, 'ccm_eligibility_scorer', 'CCM Eligibility Scorer', 'Weekly chronic care management eligibility scoring', 'core', 'claude-haiku-4-5-20250929', 3.60, 'ClipboardCheck', 'text-teal-600', 'src/services/ai/ccmEligibilityScorer.ts'),
(7, 'cultural_health_coach', 'Cultural Health Coach', 'Multi-language (13) health content translation', 'core', 'claude-haiku-4-5-20250929', 6.00, 'Globe', 'text-purple-600', 'src/services/ai/culturalHealthCoach.ts'),
(8, 'bed_optimizer', 'Bed Optimizer', 'Hospital capacity forecasting and optimization', 'core', 'claude-sonnet-4-5-20250929', 4.50, 'Bed', 'text-cyan-600', 'src/services/ai/bedOptimizer.ts'),
(9, 'drug_interaction_checker', 'Drug Interaction Checker', 'RxNorm API-powered drug interaction detection', 'core', 'rxnorm-api', 0.00, 'Pill', 'text-red-600', 'supabase/functions/check-drug-interactions/'),
(10, 'patient_form_extraction', 'Patient Form Extraction', 'Handwriting OCR and form data extraction', 'core', 'claude-vision', 3.00, 'FileSearch', 'text-amber-600', 'supabase/functions/extract-patient-form/'),
(11, 'riley_smart_scribe', 'Riley Smart Scribe', 'Deepgram + Claude medical transcription', 'core', 'claude-sonnet-4-5-20250929', 8.00, 'Mic', 'text-pink-600', 'supabase/functions/realtime_medical_transcription/'),
(12, 'mood_suggestions', 'Mood Suggestions', 'AI-powered personalized mood recommendations', 'core', 'claude-haiku-4-5-20250929', 1.20, 'Smile', 'text-yellow-600', 'supabase/functions/smart-mood-suggestions/'),

-- Quick Wins (13-17)
(13, 'smart_checkin_questions', 'Smart Check-In Questions', 'Personalized daily check-in question generation', 'patient_engagement', 'claude-haiku-4-5-20250929', 1.50, 'MessageCircle', 'text-blue-500', 'supabase/functions/ai-check-in-questions/'),
(14, 'patient_education', 'Patient Education Generator', '6th-grade reading level health content', 'patient_engagement', 'claude-haiku-4-5-20250929', 2.00, 'GraduationCap', 'text-green-500', 'src/services/ai/patientEducationService.ts'),
(15, 'enhanced_drug_interactions', 'Enhanced Drug Interactions', 'Alternative medication suggestions', 'clinical_docs', 'claude-haiku-4-5-20250929', 1.50, 'Pill', 'text-red-500', 'src/services/ai/enhancedDrugInteractionService.ts'),
(16, 'dashboard_anomaly', 'Dashboard Anomaly Detection', 'AI-powered metric insights and alerts', 'admin', 'claude-haiku-4-5-20250929', 2.00, 'AlertTriangle', 'text-orange-500', 'src/services/ai/dashboardAnomalyService.ts'),
(17, 'caregiver_briefing', 'Caregiver Briefing Generator', 'Automated family caregiver updates', 'patient_engagement', 'claude-haiku-4-5-20250929', 1.80, 'Heart', 'text-pink-500', 'src/services/ai/caregiverBriefingService.ts'),

-- Clinical Documentation (18-22)
(18, 'soap_note_generator', 'SOAP Note Auto-Generator', 'Generate SOAP notes from encounter summaries', 'clinical_docs', 'claude-sonnet-4-5-20250929', 4.00, 'FileText', 'text-blue-600', 'src/services/ai/soapNoteAIService.ts'),
(19, 'discharge_summary', 'Discharge Summary Generator', 'Auto-generate with medication reconciliation', 'clinical_docs', 'claude-sonnet-4-5-20250929', 3.50, 'FileOutput', 'text-green-600', 'src/services/ai/dischargeSummaryService.ts'),
(20, 'care_plan_generator', 'Care Plan Auto-Generator', 'Evidence-based care plans from diagnosis + SDOH', 'clinical_docs', 'claude-sonnet-4-5-20250929', 4.00, 'ClipboardList', 'text-purple-600', 'src/services/ai/carePlanAIService.ts'),
(21, 'progress_note_synthesizer', 'Progress Note Synthesizer', 'Vitals trends, mood, adherence synthesis', 'clinical_docs', 'claude-haiku-4-5-20250929', 2.00, 'TrendingUp', 'text-indigo-600', 'src/services/ai/progressNoteSynthesizerService.ts'),
(22, 'referral_letter', 'Referral Letter Generator', 'Specialist referral letters with urgency levels', 'clinical_docs', 'claude-haiku-4-5-20250929', 1.50, 'Mail', 'text-cyan-600', 'src/services/ai/referralLetterService.ts'),

-- Clinical Decision Support (23-26)
(23, 'treatment_pathway', 'Treatment Pathway Recommender', 'Evidence-based treatment suggestions', 'decision_support', 'claude-sonnet-4-5-20250929', 5.00, 'GitBranch', 'text-blue-700', 'supabase/functions/ai-treatment-pathway/'),
(24, 'clinical_guideline_matcher', 'Clinical Guideline Matcher', 'Smart guideline recommendations with gap detection', 'decision_support', 'claude-sonnet-4-5-20250929', 4.50, 'BookOpen', 'text-green-700', 'supabase/functions/ai-clinical-guideline-matcher/'),
(25, 'contraindication_detector', 'Contraindication Detector', 'Multi-factor patient safety analysis', 'decision_support', 'claude-sonnet-4-5-20250929', 4.00, 'ShieldAlert', 'text-red-700', 'src/services/ai/contraindicationDetectorService.ts'),
(26, 'medication_reconciliation', 'Medication Reconciliation AI', 'Clinical reasoning, deprescribing, counseling', 'decision_support', 'claude-sonnet-4-5-20250929', 4.50, 'Pill', 'text-purple-700', 'src/services/ai/medicationReconciliationAIService.ts'),

-- Patient Engagement (27-28)
(27, 'appointment_prep', 'Appointment Prep Instructions', 'Condition-specific prep with multi-format delivery', 'patient_engagement', 'claude-haiku-4-5-20250929', 1.50, 'Calendar', 'text-blue-500', 'src/services/ai/appointmentPrepInstructionsService.ts'),
(28, 'missed_checkin_escalation', 'Missed Check-In Escalation', 'AI-powered escalation with risk analysis', 'patient_engagement', 'claude-haiku-4-5-20250929', 2.00, 'AlertCircle', 'text-orange-600', 'supabase/functions/ai-missed-checkin-escalation/'),

-- Risk Prediction (30-33)
(30, 'fall_risk_predictor', 'Fall Risk Predictor', 'Morse Scale + evidence-based assessment', 'risk_prediction', 'claude-sonnet-4-5-20250929', 3.50, 'Activity', 'text-amber-600', 'src/services/ai/fallRiskPredictorService.ts'),
(31, 'medication_adherence_predictor', 'Medication Adherence Predictor', 'Barrier identification, intervention recommendations', 'risk_prediction', 'claude-sonnet-4-5-20250929', 3.00, 'Pill', 'text-blue-600', 'src/services/ai/medicationAdherencePredictorService.ts'),
(32, 'care_escalation_scorer', 'Care Escalation Scorer', 'Confidence-level escalation with clinical indicators', 'risk_prediction', 'claude-sonnet-4-5-20250929', 3.00, 'ArrowUpCircle', 'text-red-600', 'src/services/ai/careEscalationScorerService.ts'),
(33, 'infection_risk_predictor', 'Infection Risk Predictor (HAI)', 'CLABSI, CAUTI, SSI, VAP, C. diff prediction', 'risk_prediction', 'claude-sonnet-4-5-20250929', 4.00, 'Bug', 'text-green-700', 'src/services/ai/infectionRiskPredictorService.ts'),

-- Admin Automation (35)
(35, 'schedule_optimizer', 'Schedule Optimizer', 'Shift scheduling with coverage & fairness', 'admin', 'claude-haiku-4-5-20250929', 2.50, 'CalendarClock', 'text-indigo-600', 'src/services/ai/scheduleOptimizerService.ts'),

-- Interoperability (50)
(50, 'fhir_semantic_mapper', 'FHIR Semantic Mapper', 'R4/R5 mapping with AI suggestions', 'interoperability', 'claude-sonnet-4-5-20250929', 3.00, 'Link', 'text-cyan-700', 'src/services/ai/fhirSemanticMapperService.ts'),

-- Conversational AI (56-57)
(56, 'patient_qa_bot', 'Patient Q&A Bot', 'Health question answering with safety guardrails', 'conversational', 'claude-sonnet-4-5-20250929', 5.00, 'MessageSquare', 'text-blue-600', 'supabase/functions/ai-patient-qa-bot/'),
(57, 'provider_assistant', 'Provider Assistant', 'Role-adaptive AI for all staff types', 'conversational', 'claude-sonnet-4-5-20250929', 6.00, 'UserCog', 'text-purple-600', 'src/services/ai/providerAssistantService.ts'),

-- Additional Core Skills
(58, 'welfare_check_dispatcher', 'Welfare Check Dispatcher', 'Law enforcement welfare check prioritization', 'core', 'claude-haiku-4-5-20250929', 1.80, 'Shield', 'text-indigo-600', 'src/services/ai/welfareCheckDispatcher.ts'),
(59, 'emergency_intelligence', 'Emergency Access Intelligence', 'Pre-generated 911 dispatcher briefings', 'core', 'claude-sonnet-4-5-20250929', 15.46, 'Zap', 'text-red-600', 'src/services/ai/emergencyIntelligence.ts'),
(60, 'handoff_synthesizer', 'Handoff Synthesizer', 'Shift handoff summary generation', 'clinical_docs', 'claude-haiku-4-5-20250929', 0.60, 'RefreshCw', 'text-teal-600', 'src/services/ai/handoffSynthesizerService.ts')

ON CONFLICT (skill_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  model = EXCLUDED.model,
  monthly_cost_estimate = EXCLUDED.monthly_cost_estimate,
  icon_name = EXCLUDED.icon_name,
  color_class = EXCLUDED.color_class,
  service_path = EXCLUDED.service_path,
  updated_at = now();

-- ============================================================================
-- 4. License Tier Skill Mappings
-- ============================================================================
-- Update requires_license_tier for each skill based on tier
UPDATE public.ai_skills SET requires_license_tier = ARRAY['standard', 'professional', 'enterprise']
WHERE skill_key IN ('billing_suggester', 'mood_suggestions', 'smart_checkin_questions', 'patient_education');

UPDATE public.ai_skills SET requires_license_tier = ARRAY['professional', 'enterprise']
WHERE skill_key IN ('readmission_predictor', 'sdoh_passive_detector', 'cultural_health_coach', 'ccm_eligibility_scorer',
                    'drug_interaction_checker', 'caregiver_briefing', 'progress_note_synthesizer', 'referral_letter',
                    'appointment_prep', 'missed_checkin_escalation', 'schedule_optimizer');

UPDATE public.ai_skills SET requires_license_tier = ARRAY['enterprise']
WHERE skill_key IN ('dashboard_personalization', 'medical_transcript', 'bed_optimizer', 'patient_form_extraction',
                    'riley_smart_scribe', 'enhanced_drug_interactions', 'dashboard_anomaly', 'soap_note_generator',
                    'discharge_summary', 'care_plan_generator', 'treatment_pathway', 'clinical_guideline_matcher',
                    'contraindication_detector', 'medication_reconciliation', 'fall_risk_predictor',
                    'medication_adherence_predictor', 'care_escalation_scorer', 'infection_risk_predictor',
                    'fhir_semantic_mapper', 'patient_qa_bot', 'provider_assistant', 'welfare_check_dispatcher',
                    'emergency_intelligence', 'handoff_synthesizer');

-- ============================================================================
-- 5. Populate tenant_ai_skill_config for Existing Tenants
-- ============================================================================
-- Insert skill configs for all existing tenants based on their license tier
INSERT INTO public.tenant_ai_skill_config (tenant_id, skill_id, is_entitled, is_enabled)
SELECT
  t.id as tenant_id,
  s.id as skill_id,
  -- Entitled based on license tier
  CASE
    WHEN tmc.license_tier = 'enterprise' THEN true
    WHEN tmc.license_tier = 'professional' AND 'professional' = ANY(s.requires_license_tier) THEN true
    WHEN tmc.license_tier = 'standard' AND 'standard' = ANY(s.requires_license_tier) THEN true
    ELSE false
  END as is_entitled,
  -- Enable all entitled skills by default
  CASE
    WHEN tmc.license_tier = 'enterprise' THEN true
    WHEN tmc.license_tier = 'professional' AND 'professional' = ANY(s.requires_license_tier) THEN true
    WHEN tmc.license_tier = 'standard' AND 'standard' = ANY(s.requires_license_tier) THEN true
    ELSE false
  END as is_enabled
FROM public.tenants t
CROSS JOIN public.ai_skills s
LEFT JOIN public.tenant_module_config tmc ON tmc.tenant_id = t.id
ON CONFLICT (tenant_id, skill_id) DO UPDATE SET
  is_entitled = EXCLUDED.is_entitled,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = now();

-- ============================================================================
-- 6. Helper Functions
-- ============================================================================

-- Function to get all skills for a tenant with their status
CREATE OR REPLACE FUNCTION get_tenant_ai_skills(p_tenant_id UUID)
RETURNS TABLE (
  skill_id UUID,
  skill_key TEXT,
  skill_number INTEGER,
  name TEXT,
  description TEXT,
  category TEXT,
  model TEXT,
  monthly_cost_estimate NUMERIC,
  icon_name TEXT,
  color_class TEXT,
  is_entitled BOOLEAN,
  is_enabled BOOLEAN,
  settings JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.skill_key,
    s.skill_number,
    s.name,
    s.description,
    s.category,
    s.model,
    s.monthly_cost_estimate,
    s.icon_name,
    s.color_class,
    COALESCE(tc.is_entitled, false),
    COALESCE(tc.is_enabled, false),
    COALESCE(tc.settings, '{}'::jsonb)
  FROM public.ai_skills s
  LEFT JOIN public.tenant_ai_skill_config tc ON tc.skill_id = s.id AND tc.tenant_id = p_tenant_id
  WHERE s.is_active = true
  ORDER BY s.skill_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle a skill for a tenant
CREATE OR REPLACE FUNCTION toggle_tenant_ai_skill(
  p_tenant_id UUID,
  p_skill_key TEXT,
  p_enabled BOOLEAN,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_skill_id UUID;
  v_is_entitled BOOLEAN;
BEGIN
  -- Get skill ID
  SELECT id INTO v_skill_id FROM public.ai_skills WHERE skill_key = p_skill_key;
  IF v_skill_id IS NULL THEN
    RAISE EXCEPTION 'Skill not found: %', p_skill_key;
  END IF;

  -- Check if tenant is entitled to this skill
  SELECT is_entitled INTO v_is_entitled
  FROM public.tenant_ai_skill_config
  WHERE tenant_id = p_tenant_id AND skill_id = v_skill_id;

  IF NOT COALESCE(v_is_entitled, false) AND p_enabled THEN
    RAISE EXCEPTION 'Tenant is not entitled to skill: %', p_skill_key;
  END IF;

  -- Update or insert
  INSERT INTO public.tenant_ai_skill_config (tenant_id, skill_id, is_entitled, is_enabled, enabled_at, enabled_by, disabled_at, disabled_by)
  VALUES (
    p_tenant_id,
    v_skill_id,
    COALESCE(v_is_entitled, false),
    p_enabled,
    CASE WHEN p_enabled THEN now() ELSE NULL END,
    CASE WHEN p_enabled THEN p_user_id ELSE NULL END,
    CASE WHEN NOT p_enabled THEN now() ELSE NULL END,
    CASE WHEN NOT p_enabled THEN p_user_id ELSE NULL END
  )
  ON CONFLICT (tenant_id, skill_id) DO UPDATE SET
    is_enabled = p_enabled,
    enabled_at = CASE WHEN p_enabled THEN now() ELSE tenant_ai_skill_config.enabled_at END,
    enabled_by = CASE WHEN p_enabled THEN p_user_id ELSE tenant_ai_skill_config.enabled_by END,
    disabled_at = CASE WHEN NOT p_enabled THEN now() ELSE NULL END,
    disabled_by = CASE WHEN NOT p_enabled THEN p_user_id ELSE NULL END,
    updated_at = now();

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a skill is enabled for a tenant
CREATE OR REPLACE FUNCTION is_ai_skill_enabled(p_tenant_id UUID, p_skill_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT tc.is_enabled INTO v_enabled
  FROM public.tenant_ai_skill_config tc
  JOIN public.ai_skills s ON s.id = tc.skill_id
  WHERE tc.tenant_id = p_tenant_id AND s.skill_key = p_skill_key;

  RETURN COALESCE(v_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 7. RLS Policies
-- ============================================================================
ALTER TABLE public.ai_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_ai_skill_config ENABLE ROW LEVEL SECURITY;

-- AI Skills: Anyone can read (public catalog)
DROP POLICY IF EXISTS "ai_skills_read" ON public.ai_skills;
CREATE POLICY "ai_skills_read" ON public.ai_skills
  FOR SELECT USING (true);

-- AI Skills: Only super admins can modify
DROP POLICY IF EXISTS "ai_skills_admin_write" ON public.ai_skills;
CREATE POLICY "ai_skills_admin_write" ON public.ai_skills
  FOR ALL USING (
    EXISTS (SELECT 1 FROM super_admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

-- Tenant AI Skill Config: Tenants can read their own config
DROP POLICY IF EXISTS "tenant_ai_skill_config_read" ON public.tenant_ai_skill_config;
CREATE POLICY "tenant_ai_skill_config_read" ON public.tenant_ai_skill_config
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM super_admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

-- Tenant AI Skill Config: Only admins can modify
DROP POLICY IF EXISTS "tenant_ai_skill_config_write" ON public.tenant_ai_skill_config;
CREATE POLICY "tenant_ai_skill_config_write" ON public.tenant_ai_skill_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true AND tenant_id = tenant_ai_skill_config.tenant_id)
    OR EXISTS (SELECT 1 FROM super_admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

-- ============================================================================
-- 8. Grant Permissions
-- ============================================================================
GRANT SELECT ON public.ai_skills TO authenticated;
GRANT SELECT ON public.ai_skills TO anon;
GRANT SELECT, INSERT, UPDATE ON public.tenant_ai_skill_config TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_ai_skills(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_tenant_ai_skill(UUID, TEXT, BOOLEAN, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_ai_skill_enabled(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 9. Verification
-- ============================================================================
DO $$
DECLARE
  skill_count INTEGER;
  config_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO skill_count FROM public.ai_skills;
  SELECT COUNT(*) INTO config_count FROM public.tenant_ai_skill_config;

  RAISE NOTICE '✅ AI Skills created: %', skill_count;
  RAISE NOTICE '✅ Tenant skill configs created: %', config_count;
END $$;
