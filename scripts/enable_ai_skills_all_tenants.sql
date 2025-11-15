-- ============================================================================
-- Enable All 11 AI Skills for ALL Tenants
-- ============================================================================
--
-- This script enables all AI skills with recommended settings for every
-- tenant in your database.
--
-- COST: $35.86/month per tenant
-- ============================================================================

-- Enable all AI skills for all existing tenants
INSERT INTO public.ai_skill_config (
  tenant_id,

  -- Skill #2: Billing Code Suggester
  billing_suggester_enabled,
  billing_suggester_model,
  billing_suggester_cache_enabled,

  -- Skill #3: Readmission Risk Predictor
  readmission_predictor_enabled,
  readmission_predictor_model,
  readmission_predictor_auto_create_care_plan,

  -- Skill #4: SDOH Passive Detector
  sdoh_passive_detector_enabled,
  sdoh_passive_detector_confidence_threshold,
  sdoh_passive_detector_auto_create_indicators,
  sdoh_passive_detector_model,

  -- Skill #6: Cultural Health Coach
  cultural_coach_enabled,
  cultural_coach_default_languages,
  cultural_coach_cache_threshold,
  cultural_coach_model,

  -- Skill #7: Handoff Synthesizer
  handoff_synthesizer_enabled,
  handoff_synthesizer_auto_generate,
  handoff_synthesizer_model,

  -- Skill #9: CCM Eligibility Scorer
  ccm_eligibility_scorer_enabled,
  ccm_eligibility_scorer_minimum_score,
  ccm_eligibility_scorer_auto_enroll,
  ccm_eligibility_scorer_model,

  -- Skill #10: Welfare Check Dispatcher
  welfare_check_dispatcher_enabled,
  welfare_check_dispatcher_auto_dispatch_threshold,
  welfare_check_dispatcher_batch_time,
  welfare_check_dispatcher_model,

  -- Skill #11: Emergency Access Intelligence
  emergency_intel_enabled,
  emergency_intel_briefing_validity_days,
  emergency_intel_include_medical_history,
  emergency_intel_include_access_codes
)
SELECT
  t.id AS tenant_id,

  -- Skill #2: Billing Code Suggester ($2.40/month per tenant)
  true,  -- ✅ Enabled
  'claude-haiku-4-5-20250929',
  true,  -- Caching enabled

  -- Skill #3: Readmission Risk Predictor ($4.20/month per tenant)
  true,  -- ✅ Enabled
  'claude-sonnet-4-5-20250929',
  false, -- Manual review required

  -- Skill #4: SDOH Passive Detector ($1.80/month per tenant)
  true,  -- ✅ Enabled
  0.75,  -- 75% confidence threshold
  false, -- Manual clinical review required
  'claude-haiku-4-5-20250929',

  -- Skill #6: Cultural Health Coach ($6.00/month per tenant)
  true,  -- ✅ Enabled
  ARRAY['en', 'es', 'zh', 'ar', 'vi'], -- 5 languages
  0.85,
  'claude-haiku-4-5-20250929',

  -- Skill #7: Handoff Synthesizer ($0.60/month per tenant)
  true,  -- ✅ Enabled
  false, -- Manual trigger
  'claude-haiku-4-5-20250929',

  -- Skill #9: CCM Eligibility Scorer ($3.60/month per tenant)
  true,  -- ✅ Enabled
  0.70,
  false, -- Manual enrollment
  'claude-haiku-4-5-20250929',

  -- Skill #10: Welfare Check Dispatcher ($1.80/month per tenant)
  true,  -- ✅ Enabled
  85,    -- Auto-dispatch threshold
  '02:00:00', -- 2 AM daily batch
  'claude-haiku-4-5-20250929',

  -- Skill #11: Emergency Access Intelligence ($15.46/month per tenant)
  true,  -- ✅ Enabled
  7,     -- 7-day validity
  true,  -- Include medical history
  true   -- Include access codes

FROM public.tenants t
ON CONFLICT (tenant_id) DO UPDATE SET
  billing_suggester_enabled = EXCLUDED.billing_suggester_enabled,
  readmission_predictor_enabled = EXCLUDED.readmission_predictor_enabled,
  sdoh_passive_detector_enabled = EXCLUDED.sdoh_passive_detector_enabled,
  cultural_coach_enabled = EXCLUDED.cultural_coach_enabled,
  handoff_synthesizer_enabled = EXCLUDED.handoff_synthesizer_enabled,
  ccm_eligibility_scorer_enabled = EXCLUDED.ccm_eligibility_scorer_enabled,
  welfare_check_dispatcher_enabled = EXCLUDED.welfare_check_dispatcher_enabled,
  emergency_intel_enabled = EXCLUDED.emergency_intel_enabled,
  cultural_coach_default_languages = EXCLUDED.cultural_coach_default_languages,
  billing_suggester_model = EXCLUDED.billing_suggester_model,
  readmission_predictor_model = EXCLUDED.readmission_predictor_model,
  sdoh_passive_detector_model = EXCLUDED.sdoh_passive_detector_model,
  cultural_coach_model = EXCLUDED.cultural_coach_model,
  handoff_synthesizer_model = EXCLUDED.handoff_synthesizer_model,
  ccm_eligibility_scorer_model = EXCLUDED.ccm_eligibility_scorer_model,
  welfare_check_dispatcher_model = EXCLUDED.welfare_check_dispatcher_model,
  updated_at = now();

-- Show results
SELECT
  COUNT(*) AS total_tenants_configured,
  SUM(CASE WHEN billing_suggester_enabled THEN 1 ELSE 0 END) AS skill_2_enabled,
  SUM(CASE WHEN readmission_predictor_enabled THEN 1 ELSE 0 END) AS skill_3_enabled,
  SUM(CASE WHEN sdoh_passive_detector_enabled THEN 1 ELSE 0 END) AS skill_4_enabled,
  SUM(CASE WHEN cultural_coach_enabled THEN 1 ELSE 0 END) AS skill_6_enabled,
  SUM(CASE WHEN handoff_synthesizer_enabled THEN 1 ELSE 0 END) AS skill_7_enabled,
  SUM(CASE WHEN ccm_eligibility_scorer_enabled THEN 1 ELSE 0 END) AS skill_9_enabled,
  SUM(CASE WHEN welfare_check_dispatcher_enabled THEN 1 ELSE 0 END) AS skill_10_enabled,
  SUM(CASE WHEN emergency_intel_enabled THEN 1 ELSE 0 END) AS skill_11_enabled
FROM public.ai_skill_config;

-- ============================================================================
-- Verify Configuration for Each Tenant
-- ============================================================================

SELECT
  t.name AS tenant_name,
  c.billing_suggester_enabled AS "#2",
  c.readmission_predictor_enabled AS "#3",
  c.sdoh_passive_detector_enabled AS "#4",
  c.cultural_coach_enabled AS "#6",
  c.handoff_synthesizer_enabled AS "#7",
  c.ccm_eligibility_scorer_enabled AS "#9",
  c.welfare_check_dispatcher_enabled AS "#10",
  c.emergency_intel_enabled AS "#11",
  c.created_at
FROM public.tenants t
LEFT JOIN public.ai_skill_config c ON c.tenant_id = t.id
ORDER BY t.name;
