-- ============================================================================
-- Quick Setup: Enable All 11 AI Skills
-- ============================================================================
--
-- INSTRUCTIONS:
-- 1. Replace 'YOUR_TENANT_ID' with your actual tenant UUID
-- 2. Review the settings below and adjust as needed
-- 3. Run this script in your Supabase SQL Editor or via CLI
--
-- COST: $35.86/month for all 11 skills enabled
-- ============================================================================

-- Step 1: Get your tenant ID (if you don't know it)
-- SELECT id, name FROM public.tenants;

-- Step 2: Enable all AI skills with recommended settings
INSERT INTO public.ai_skill_config (
  tenant_id,

  -- Skill #2: Billing Code Suggester ($2.40/month)
  billing_suggester_enabled,
  billing_suggester_model,
  billing_suggester_cache_enabled,

  -- Skill #3: Readmission Risk Predictor ($4.20/month)
  readmission_predictor_enabled,
  readmission_predictor_model,
  readmission_predictor_auto_create_care_plan,

  -- Skill #4: SDOH Passive Detector ($1.80/month)
  sdoh_passive_detector_enabled,
  sdoh_passive_detector_confidence_threshold,
  sdoh_passive_detector_auto_create_indicators,
  sdoh_passive_detector_model,

  -- Skill #6: Cultural Health Coach ($6.00/month)
  cultural_coach_enabled,
  cultural_coach_default_languages,
  cultural_coach_cache_threshold,
  cultural_coach_model,

  -- Skill #7: Handoff Synthesizer ($0.60/month)
  handoff_synthesizer_enabled,
  handoff_synthesizer_auto_generate,
  handoff_synthesizer_model,

  -- Skill #9: CCM Eligibility Scorer ($3.60/month)
  ccm_eligibility_scorer_enabled,
  ccm_eligibility_scorer_minimum_score,
  ccm_eligibility_scorer_auto_enroll,
  ccm_eligibility_scorer_model,

  -- Skill #10: Welfare Check Dispatcher ($1.80/month)
  welfare_check_dispatcher_enabled,
  welfare_check_dispatcher_auto_dispatch_threshold,
  welfare_check_dispatcher_batch_time,
  welfare_check_dispatcher_model,

  -- Skill #11: Emergency Access Intelligence ($15.46/month)
  emergency_intel_enabled,
  emergency_intel_briefing_validity_days,
  emergency_intel_include_medical_history,
  emergency_intel_include_access_codes
)
VALUES (
  'YOUR_TENANT_ID', -- ⚠️ REPLACE THIS WITH YOUR ACTUAL TENANT UUID

  -- Skill #2: Billing Code Suggester
  true,  -- ✅ Enabled
  'claude-haiku-4-5-20250929',
  true,  -- Caching enabled

  -- Skill #3: Readmission Risk Predictor
  true,  -- ✅ Enabled
  'claude-sonnet-4-5-20250929', -- Use Sonnet for higher accuracy
  false, -- ⚠️ Manual review required before creating care plans

  -- Skill #4: SDOH Passive Detector
  true,  -- ✅ Enabled
  0.75,  -- 75% confidence threshold
  false, -- ⚠️ Manual clinical review required
  'claude-haiku-4-5-20250929',

  -- Skill #6: Cultural Health Coach
  true,  -- ✅ Enabled
  ARRAY['en', 'es', 'zh', 'ar', 'vi'], -- English, Spanish, Chinese, Arabic, Vietnamese
  0.85,  -- 85% cache threshold
  'claude-haiku-4-5-20250929',

  -- Skill #7: Handoff Synthesizer
  true,  -- ✅ Enabled
  false, -- Manual trigger at shift end
  'claude-haiku-4-5-20250929',

  -- Skill #9: CCM Eligibility Scorer
  true,  -- ✅ Enabled
  0.70,  -- 70% minimum eligibility score
  false, -- ⚠️ Manual enrollment (billing team approval required)
  'claude-haiku-4-5-20250929',

  -- Skill #10: Welfare Check Dispatcher
  true,  -- ✅ Enabled
  85,    -- Auto-dispatch when priority >= 85 (critical/high)
  '02:00:00', -- Run daily at 2:00 AM
  'claude-haiku-4-5-20250929',

  -- Skill #11: Emergency Access Intelligence
  true,  -- ✅ Enabled
  7,     -- Briefings valid for 7 days (regenerate weekly)
  true,  -- Include medical history
  true   -- Include access codes (door codes, gate codes)
)
ON CONFLICT (tenant_id) DO UPDATE SET
  -- Update if row already exists
  billing_suggester_enabled = EXCLUDED.billing_suggester_enabled,
  readmission_predictor_enabled = EXCLUDED.readmission_predictor_enabled,
  sdoh_passive_detector_enabled = EXCLUDED.sdoh_passive_detector_enabled,
  cultural_coach_enabled = EXCLUDED.cultural_coach_enabled,
  handoff_synthesizer_enabled = EXCLUDED.handoff_synthesizer_enabled,
  ccm_eligibility_scorer_enabled = EXCLUDED.ccm_eligibility_scorer_enabled,
  welfare_check_dispatcher_enabled = EXCLUDED.welfare_check_dispatcher_enabled,
  emergency_intel_enabled = EXCLUDED.emergency_intel_enabled,
  updated_at = now();

-- Step 3: Verify configuration
SELECT
  tenant_id,
  billing_suggester_enabled AS "Skill #2",
  readmission_predictor_enabled AS "Skill #3",
  sdoh_passive_detector_enabled AS "Skill #4",
  cultural_coach_enabled AS "Skill #6",
  handoff_synthesizer_enabled AS "Skill #7",
  ccm_eligibility_scorer_enabled AS "Skill #9",
  welfare_check_dispatcher_enabled AS "Skill #10",
  emergency_intel_enabled AS "Skill #11"
FROM public.ai_skill_config
WHERE tenant_id = 'YOUR_TENANT_ID'; -- ⚠️ REPLACE THIS

-- ============================================================================
-- Alternative: Enable Only Specific Skills (Lower Cost)
-- ============================================================================

/*
-- Example 1: Enable only billing and SDOH detection ($4.20/month)
INSERT INTO public.ai_skill_config (tenant_id, billing_suggester_enabled, sdoh_passive_detector_enabled)
VALUES ('YOUR_TENANT_ID', true, true)
ON CONFLICT (tenant_id) DO UPDATE SET
  billing_suggester_enabled = true,
  sdoh_passive_detector_enabled = true;

-- Example 2: Enable core clinical skills ($11.40/month)
INSERT INTO public.ai_skill_config (
  tenant_id,
  billing_suggester_enabled,
  readmission_predictor_enabled,
  sdoh_passive_detector_enabled,
  ccm_eligibility_scorer_enabled
)
VALUES ('YOUR_TENANT_ID', true, true, true, true)
ON CONFLICT (tenant_id) DO UPDATE SET
  billing_suggester_enabled = true,
  readmission_predictor_enabled = true,
  sdoh_passive_detector_enabled = true,
  ccm_eligibility_scorer_enabled = true;
*/
