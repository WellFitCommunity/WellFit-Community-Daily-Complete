-- ============================================================================
-- Add 10 New AI Skills
-- ============================================================================
-- Skills being added:
--   #29: Medication Instructions Generator
--   #34: Extended Readmission 1-Year Predictor
--   #36: Audit Report Generator
--   #39: Population Health Insights
--   #42: Enhanced Voice Commands
--   #51: HL7 v2 Interpreter
--   #53: Security Anomaly Detector
--   #54: PHI Exposure Risk Scorer
--   #55: HIPAA Violation Predictor
--   #61: Care Team Chat Summarizer (renumbered from 58 to avoid conflict with welfare_check_dispatcher)
-- ============================================================================

-- ============================================================================
-- 1. Add skills to ai_skills master table
-- ============================================================================

INSERT INTO public.ai_skills (skill_key, skill_number, name, description, category, model, monthly_cost_estimate, requires_license_tier, icon_name, color_class, service_path)
VALUES
  -- #29: Medication Instructions Generator
  ('medication_instructions', 29, 'Medication Instructions Generator',
   'Generates personalized, patient-friendly medication instructions with visual pill identification, dosing schedules, food/drug interactions, and multi-language support at 6th-grade reading level.',
   'patient_engagement', 'claude-haiku-4-5-20250929', 150.00,
   ARRAY['standard', 'professional', 'enterprise'],
   'Pill', 'text-pink-600', 'src/services/ai/medicationInstructionsService.ts'),

  -- #34: Extended Readmission 1-Year Predictor
  ('readmission_predictor_1year', 34, 'Extended Readmission Predictor (1-Year)',
   'Extends readmission prediction to 1-year horizon with seasonal patterns, chronic disease progression modeling, and social determinant factors.',
   'risk_prediction', 'claude-sonnet-4-5-20250929', 400.00,
   ARRAY['professional', 'enterprise'],
   'TrendingUp', 'text-orange-600', 'src/services/ai/extendedReadmissionPredictorService.ts'),

  -- #36: Audit Report Generator
  ('audit_report_generator', 36, 'Audit Report Generator',
   'Automatically generates SOC2, HIPAA, and compliance audit reports from system logs, access patterns, and security events.',
   'admin', 'claude-haiku-4-5-20250929', 200.00,
   ARRAY['professional', 'enterprise'],
   'FileCheck', 'text-gray-600', 'src/services/ai/auditReportGeneratorService.ts'),

  -- #39: Population Health Insights
  ('population_health_insights', 39, 'Population Health Insights',
   'AI-powered cohort analysis, disease prevalence trends, risk stratification, and predictive analytics for value-based care contracts.',
   'risk_prediction', 'claude-sonnet-4-5-20250929', 500.00,
   ARRAY['enterprise'],
   'Users', 'text-blue-600', 'src/services/ai/populationHealthInsightsService.ts'),

  -- #42: Enhanced Voice Commands
  ('enhanced_voice_commands', 42, 'Enhanced Voice Commands',
   'Claude-powered natural language intent recognition for voice commands, supporting complex queries and contextual understanding.',
   'conversational', 'claude-haiku-4-5-20250929', 250.00,
   ARRAY['professional', 'enterprise'],
   'Mic', 'text-purple-600', 'src/services/ai/enhancedVoiceCommandsService.ts'),

  -- #51: HL7 v2 Interpreter
  ('hl7_v2_interpreter', 51, 'HL7 v2 Message Interpreter',
   'Intelligent parsing and interpretation of ambiguous HL7 v2 messages, handling non-standard implementations and legacy system variations.',
   'interoperability', 'claude-sonnet-4-5-20250929', 350.00,
   ARRAY['professional', 'enterprise'],
   'FileCode', 'text-indigo-600', 'src/services/ai/hl7V2InterpreterService.ts'),

  -- #53: Security Anomaly Detector
  ('security_anomaly_detector', 53, 'Security Anomaly Detector',
   'ML-powered behavioral analysis detecting unusual access patterns, potential breaches, and insider threats in real-time.',
   'admin', 'claude-sonnet-4-5-20250929', 400.00,
   ARRAY['professional', 'enterprise'],
   'ShieldAlert', 'text-red-600', 'src/services/ai/securityAnomalyDetectorService.ts'),

  -- #54: PHI Exposure Risk Scorer
  ('phi_exposure_risk_scorer', 54, 'PHI Exposure Risk Scorer',
   'Assesses risk of PHI exposure based on access patterns, data sensitivity, user roles, and compliance requirements.',
   'admin', 'claude-sonnet-4-5-20250929', 300.00,
   ARRAY['professional', 'enterprise'],
   'Eye', 'text-amber-600', 'src/services/ai/phiExposureRiskScorerService.ts'),

  -- #55: HIPAA Violation Predictor
  ('hipaa_violation_predictor', 55, 'HIPAA Violation Predictor',
   'Proactively identifies potential HIPAA violations before they occur based on behavioral patterns and system configurations.',
   'admin', 'claude-sonnet-4-5-20250929', 350.00,
   ARRAY['professional', 'enterprise'],
   'AlertTriangle', 'text-red-700', 'src/services/ai/hipaaViolationPredictorService.ts'),

  -- #61: Care Team Chat Summarizer (renumbered from 58 to avoid conflict with welfare_check_dispatcher)
  ('care_team_chat_summarizer', 61, 'Care Team Chat Summarizer',
   'Summarizes care team communications, extracts action items, and highlights critical patient updates for shift handoffs.',
   'clinical_docs', 'claude-haiku-4-5-20250929', 200.00,
   ARRAY['standard', 'professional', 'enterprise'],
   'MessageSquare', 'text-cyan-600', 'src/services/ai/careTeamChatSummarizerService.ts')
ON CONFLICT (skill_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  model = EXCLUDED.model,
  monthly_cost_estimate = EXCLUDED.monthly_cost_estimate,
  requires_license_tier = EXCLUDED.requires_license_tier,
  icon_name = EXCLUDED.icon_name,
  color_class = EXCLUDED.color_class,
  service_path = EXCLUDED.service_path,
  updated_at = now();

-- ============================================================================
-- 2. Create tenant skill configs for new skills
-- ============================================================================

INSERT INTO public.tenant_ai_skill_config (tenant_id, skill_id, is_entitled, is_enabled)
SELECT
  t.id,
  s.id,
  -- Entitled based on license tier
  CASE
    WHEN t.license_tier = 'enterprise' THEN true
    WHEN t.license_tier = 'professional' AND 'professional' = ANY(s.requires_license_tier) THEN true
    WHEN t.license_tier = 'standard' AND 'standard' = ANY(s.requires_license_tier) THEN true
    ELSE false
  END,
  -- Enable all entitled skills by default
  CASE
    WHEN t.license_tier = 'enterprise' THEN true
    WHEN t.license_tier = 'professional' AND 'professional' = ANY(s.requires_license_tier) THEN true
    WHEN t.license_tier = 'standard' AND 'standard' = ANY(s.requires_license_tier) THEN true
    ELSE false
  END
FROM public.tenants t
CROSS JOIN public.ai_skills s
WHERE s.skill_key IN (
  'medication_instructions',
  'readmission_predictor_1year',
  'audit_report_generator',
  'population_health_insights',
  'enhanced_voice_commands',
  'hl7_v2_interpreter',
  'security_anomaly_detector',
  'phi_exposure_risk_scorer',
  'hipaa_violation_predictor',
  'care_team_chat_summarizer'
)
AND NOT EXISTS (
  SELECT 1 FROM public.tenant_ai_skill_config c
  WHERE c.tenant_id = t.id AND c.skill_id = s.id
);

-- ============================================================================
-- 3. Create storage tables for new skills
-- ============================================================================

-- Table for Medication Instructions
CREATE TABLE IF NOT EXISTS public.ai_medication_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_id TEXT NOT NULL UNIQUE,
  patient_id UUID NOT NULL,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  form TEXT,
  frequency TEXT,
  patient_context JSONB DEFAULT '{}',
  result JSONB NOT NULL,
  language TEXT DEFAULT 'English',
  reading_level TEXT DEFAULT 'simple',
  delivered_via TEXT,
  delivered_at TIMESTAMPTZ,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_med_instructions_patient ON public.ai_medication_instructions(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_med_instructions_tenant ON public.ai_medication_instructions(tenant_id);

-- Table for Extended Readmission Predictions
CREATE TABLE IF NOT EXISTS public.ai_extended_readmission_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id TEXT NOT NULL UNIQUE,
  patient_id UUID NOT NULL,
  prediction_horizon TEXT NOT NULL DEFAULT '1_year',
  risk_score NUMERIC(5,4) NOT NULL,
  risk_level TEXT NOT NULL,
  seasonal_factors JSONB DEFAULT '{}',
  chronic_disease_factors JSONB DEFAULT '{}',
  sdoh_factors JSONB DEFAULT '{}',
  interventions JSONB DEFAULT '[]',
  result JSONB NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_ext_readmission_patient ON public.ai_extended_readmission_predictions(patient_id);

-- Table for Audit Reports
CREATE TABLE IF NOT EXISTS public.ai_audit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT NOT NULL UNIQUE,
  report_type TEXT NOT NULL, -- 'soc2', 'hipaa', 'custom'
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'review', 'final'
  findings JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  compliance_score NUMERIC(5,2),
  result JSONB NOT NULL,
  generated_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_reports_tenant ON public.ai_audit_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_reports_type ON public.ai_audit_reports(report_type);

-- Table for Population Health Insights
CREATE TABLE IF NOT EXISTS public.ai_population_health_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id TEXT NOT NULL UNIQUE,
  insight_type TEXT NOT NULL, -- 'cohort_analysis', 'trend', 'risk_stratification', 'prediction'
  cohort_criteria JSONB DEFAULT '{}',
  population_size INTEGER,
  analysis_period_start TIMESTAMPTZ,
  analysis_period_end TIMESTAMPTZ,
  key_findings JSONB DEFAULT '[]',
  risk_distribution JSONB DEFAULT '{}',
  trends JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  result JSONB NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_pop_health_tenant ON public.ai_population_health_insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_pop_health_type ON public.ai_population_health_insights(insight_type);

-- Table for HL7 v2 Interpretations
CREATE TABLE IF NOT EXISTS public.ai_hl7_interpretations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interpretation_id TEXT NOT NULL UNIQUE,
  message_control_id TEXT,
  message_type TEXT NOT NULL,
  trigger_event TEXT,
  original_message TEXT NOT NULL,
  parsed_segments JSONB DEFAULT '{}',
  ambiguities_detected JSONB DEFAULT '[]',
  ai_interpretations JSONB DEFAULT '[]',
  confidence_score NUMERIC(3,2),
  fhir_mapping JSONB DEFAULT '{}',
  result JSONB NOT NULL,
  source_system TEXT,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_hl7_tenant ON public.ai_hl7_interpretations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_hl7_msg_type ON public.ai_hl7_interpretations(message_type);

-- Table for Security Anomalies
CREATE TABLE IF NOT EXISTS public.ai_security_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id TEXT NOT NULL UNIQUE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  anomaly_type TEXT NOT NULL, -- 'access_pattern', 'data_exfiltration', 'privilege_escalation', 'brute_force', 'insider_threat'
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  resource_accessed TEXT,
  action_taken TEXT,
  baseline_behavior JSONB DEFAULT '{}',
  detected_deviation JSONB DEFAULT '{}',
  risk_score NUMERIC(5,2),
  recommendations JSONB DEFAULT '[]',
  status TEXT DEFAULT 'open', -- 'open', 'investigating', 'resolved', 'false_positive'
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  result JSONB NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_security_anomalies_tenant ON public.ai_security_anomalies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_security_anomalies_severity ON public.ai_security_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_ai_security_anomalies_status ON public.ai_security_anomalies(status);
CREATE INDEX IF NOT EXISTS idx_ai_security_anomalies_user ON public.ai_security_anomalies(user_id);

-- Table for PHI Exposure Risk Scores
CREATE TABLE IF NOT EXISTS public.ai_phi_exposure_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id TEXT NOT NULL UNIQUE,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scope TEXT NOT NULL, -- 'user', 'role', 'department', 'system'
  scope_id TEXT NOT NULL,
  overall_risk_score NUMERIC(5,2) NOT NULL,
  risk_level TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  access_pattern_score NUMERIC(5,2),
  data_sensitivity_score NUMERIC(5,2),
  role_appropriateness_score NUMERIC(5,2),
  temporal_pattern_score NUMERIC(5,2),
  risk_factors JSONB DEFAULT '[]',
  mitigation_recommendations JSONB DEFAULT '[]',
  result JSONB NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_phi_scores_tenant ON public.ai_phi_exposure_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_phi_scores_level ON public.ai_phi_exposure_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_ai_phi_scores_scope ON public.ai_phi_exposure_scores(scope, scope_id);

-- Table for HIPAA Violation Predictions
CREATE TABLE IF NOT EXISTS public.ai_hipaa_violation_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id TEXT NOT NULL UNIQUE,
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  violation_type TEXT NOT NULL, -- 'access_control', 'audit_control', 'integrity', 'transmission_security', 'administrative'
  probability NUMERIC(5,4) NOT NULL,
  risk_level TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  contributing_factors JSONB DEFAULT '[]',
  affected_systems JSONB DEFAULT '[]',
  affected_users JSONB DEFAULT '[]',
  preventive_actions JSONB DEFAULT '[]',
  regulatory_references JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active', -- 'active', 'mitigated', 'occurred', 'false_positive'
  mitigated_by UUID REFERENCES auth.users(id),
  mitigated_at TIMESTAMPTZ,
  result JSONB NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_hipaa_predictions_tenant ON public.ai_hipaa_violation_predictions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_hipaa_predictions_status ON public.ai_hipaa_violation_predictions(status);
CREATE INDEX IF NOT EXISTS idx_ai_hipaa_predictions_level ON public.ai_hipaa_violation_predictions(risk_level);

-- Table for Care Team Chat Summaries
CREATE TABLE IF NOT EXISTS public.ai_care_team_chat_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id TEXT NOT NULL UNIQUE,
  patient_id UUID,
  chat_channel TEXT, -- channel or thread identifier
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  message_count INTEGER,
  participant_count INTEGER,
  summary_text TEXT NOT NULL,
  key_decisions JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  critical_updates JSONB DEFAULT '[]',
  follow_up_required JSONB DEFAULT '[]',
  sentiment_analysis JSONB DEFAULT '{}',
  result JSONB NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_summaries_tenant ON public.ai_care_team_chat_summaries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_summaries_patient ON public.ai_care_team_chat_summaries(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_summaries_period ON public.ai_care_team_chat_summaries(period_start, period_end);

-- ============================================================================
-- 4. Enable RLS on all new tables
-- ============================================================================

ALTER TABLE public.ai_medication_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_extended_readmission_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_population_health_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_hl7_interpretations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_security_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_phi_exposure_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_hipaa_violation_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_care_team_chat_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies (tenant isolation)
CREATE POLICY "ai_medication_instructions_tenant_isolation" ON public.ai_medication_instructions
  FOR ALL USING (tenant_id = get_current_tenant_id() OR is_admin_user());

CREATE POLICY "ai_extended_readmission_tenant_isolation" ON public.ai_extended_readmission_predictions
  FOR ALL USING (tenant_id = get_current_tenant_id() OR is_admin_user());

CREATE POLICY "ai_audit_reports_tenant_isolation" ON public.ai_audit_reports
  FOR ALL USING (tenant_id = get_current_tenant_id() OR is_admin_user());

CREATE POLICY "ai_population_health_tenant_isolation" ON public.ai_population_health_insights
  FOR ALL USING (tenant_id = get_current_tenant_id() OR is_admin_user());

CREATE POLICY "ai_hl7_interpretations_tenant_isolation" ON public.ai_hl7_interpretations
  FOR ALL USING (tenant_id = get_current_tenant_id() OR is_admin_user());

CREATE POLICY "ai_security_anomalies_tenant_isolation" ON public.ai_security_anomalies
  FOR ALL USING (tenant_id = get_current_tenant_id() OR is_admin_user());

CREATE POLICY "ai_phi_exposure_scores_tenant_isolation" ON public.ai_phi_exposure_scores
  FOR ALL USING (tenant_id = get_current_tenant_id() OR is_admin_user());

CREATE POLICY "ai_hipaa_predictions_tenant_isolation" ON public.ai_hipaa_violation_predictions
  FOR ALL USING (tenant_id = get_current_tenant_id() OR is_admin_user());

CREATE POLICY "ai_chat_summaries_tenant_isolation" ON public.ai_care_team_chat_summaries
  FOR ALL USING (tenant_id = get_current_tenant_id() OR is_admin_user());

-- ============================================================================
-- 5. Verification
-- ============================================================================

DO $$
DECLARE
  skill_count INTEGER;
  table_count INTEGER;
BEGIN
  -- Count new skills
  SELECT COUNT(*) INTO skill_count
  FROM public.ai_skills
  WHERE skill_key IN (
    'medication_instructions', 'readmission_predictor_1year', 'audit_report_generator',
    'population_health_insights', 'enhanced_voice_commands', 'hl7_v2_interpreter',
    'security_anomaly_detector', 'phi_exposure_risk_scorer', 'hipaa_violation_predictor',
    'care_team_chat_summarizer'
  );

  -- Count new tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'ai_medication_instructions', 'ai_extended_readmission_predictions', 'ai_audit_reports',
    'ai_population_health_insights', 'ai_hl7_interpretations', 'ai_security_anomalies',
    'ai_phi_exposure_scores', 'ai_hipaa_violation_predictions', 'ai_care_team_chat_summaries'
  );

  RAISE NOTICE '✅ New AI Skills added: %', skill_count;
  RAISE NOTICE '✅ New storage tables created: %', table_count;
END $$;
