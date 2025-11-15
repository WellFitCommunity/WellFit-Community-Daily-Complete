-- Emergency fix: Ensure all AI skills tables exist
-- This migration combines fixes for deployment issues
begin;

-- =====================================================
-- CREATE AI_SKILL_CONFIG IF NOT EXISTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_skill_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Skill #2: Billing Code Suggester
  billing_suggester_enabled boolean DEFAULT false,
  billing_suggester_model text DEFAULT 'claude-haiku-4-5-20250929',
  billing_suggester_cache_enabled boolean DEFAULT true,

  -- Skill #3: Readmission Risk Predictor
  readmission_predictor_enabled boolean DEFAULT false,
  readmission_predictor_model text DEFAULT 'claude-sonnet-4-5-20250929',
  readmission_predictor_auto_create_care_plan boolean DEFAULT false,

  -- Skill #4: SDOH Passive Detector (add columns if table exists)
  sdoh_passive_detector_enabled boolean DEFAULT false,
  sdoh_passive_detector_auto_create_indicators boolean DEFAULT false,
  sdoh_passive_detector_confidence_threshold numeric(3,2) DEFAULT 0.75,
  sdoh_passive_detector_model text DEFAULT 'claude-haiku-4-5-20250929',

  -- Skill #7: Handoff Synthesizer
  handoff_synthesizer_enabled boolean DEFAULT false,
  handoff_synthesizer_auto_generate boolean DEFAULT false,
  handoff_synthesizer_model text DEFAULT 'claude-haiku-4-5-20250929',

  -- Skill #9: CCM Eligibility Scorer
  ccm_eligibility_scorer_enabled boolean DEFAULT false,
  ccm_eligibility_scorer_auto_enroll boolean DEFAULT false,
  ccm_eligibility_scorer_minimum_score numeric(3,2) DEFAULT 0.70,
  ccm_eligibility_scorer_model text DEFAULT 'claude-haiku-4-5-20250929',

  -- Skill #6: Cultural Health Coach
  cultural_coach_enabled boolean DEFAULT false,
  cultural_coach_cache_threshold numeric(3,2) DEFAULT 0.85,
  cultural_coach_default_languages text[] DEFAULT ARRAY['en', 'es'],
  cultural_coach_model text DEFAULT 'claude-haiku-4-5-20250929',

  -- Skill #10: Welfare Check Dispatcher
  welfare_check_dispatcher_enabled boolean DEFAULT false,
  welfare_check_dispatcher_auto_dispatch_threshold integer DEFAULT 85,
  welfare_check_dispatcher_batch_time time DEFAULT '02:00:00',
  welfare_check_dispatcher_model text DEFAULT 'claude-haiku-4-5-20250929',

  -- Skill #11: Emergency Access Intelligence
  emergency_intel_enabled boolean DEFAULT false,
  emergency_intel_briefing_validity_days integer DEFAULT 7,
  emergency_intel_include_medical_history boolean DEFAULT true,
  emergency_intel_include_access_codes boolean DEFAULT true,

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One config per tenant
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_skill_config_tenant ON public.ai_skill_config(tenant_id);

ALTER TABLE public.ai_skill_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_skill_config_admin_access" ON public.ai_skill_config;
CREATE POLICY "ai_skill_config_admin_access" ON public.ai_skill_config
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id() AND public.is_admin(auth.uid()));

COMMENT ON TABLE public.ai_skill_config IS 'Feature flags and configuration for all 11 AI automation skills';

commit;
