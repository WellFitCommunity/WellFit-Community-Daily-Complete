# AI Skills Configuration Guide

## Overview

All 11 AI automation skills are installed but **disabled by default**. You need to enable them per tenant in the `ai_skill_config` table.

## Quick Start: Enable All Skills

```sql
-- Insert configuration for your tenant (replace YOUR_TENANT_ID with actual UUID)
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
  'YOUR_TENANT_ID', -- Replace with actual tenant UUID

  -- Skill #2: Billing Code Suggester
  true,  -- Enable billing suggester
  'claude-haiku-4-5-20250929',
  true,  -- Enable caching

  -- Skill #3: Readmission Risk Predictor
  true,  -- Enable readmission predictor
  'claude-sonnet-4-5-20250929',
  false, -- Don't auto-create care plans (requires manual review)

  -- Skill #4: SDOH Passive Detector
  true,  -- Enable SDOH detector
  0.75,  -- 75% confidence threshold
  false, -- Don't auto-create indicators (requires clinical review)
  'claude-haiku-4-5-20250929',

  -- Skill #6: Cultural Health Coach
  true,  -- Enable cultural coach
  ARRAY['en', 'es', 'zh', 'ar', 'vi'], -- Support 5 languages
  0.85,  -- 85% cache hit threshold
  'claude-haiku-4-5-20250929',

  -- Skill #7: Handoff Synthesizer
  true,  -- Enable handoff synthesizer
  false, -- Don't auto-generate (trigger manually)
  'claude-haiku-4-5-20250929',

  -- Skill #9: CCM Eligibility Scorer
  true,  -- Enable CCM scorer
  0.70,  -- 70% minimum score for eligibility
  false, -- Don't auto-enroll (requires billing team approval)
  'claude-haiku-4-5-20250929',

  -- Skill #10: Welfare Check Dispatcher
  true,  -- Enable welfare check dispatcher
  85,    -- Auto-dispatch at priority score >= 85
  '02:00:00', -- Run daily batch at 2:00 AM
  'claude-haiku-4-5-20250929',

  -- Skill #11: Emergency Access Intelligence
  true,  -- Enable emergency briefings
  7,     -- Briefings valid for 7 days
  true,  -- Include medical history
  true   -- Include access codes (door codes, gate codes)
);
```

**Total Cost: $35.86/month for all 11 skills**

---

## Enable Individual Skills

If you want to enable only specific skills, use this template:

```sql
-- Enable only Billing Code Suggester and SDOH Passive Detector
INSERT INTO public.ai_skill_config (
  tenant_id,
  billing_suggester_enabled,
  sdoh_passive_detector_enabled
)
VALUES (
  'YOUR_TENANT_ID',
  true,  -- Enable billing suggester ($2.40/month)
  true   -- Enable SDOH detector ($1.80/month)
);
-- Total: $4.20/month
```

---

## Update Existing Configuration

```sql
-- Enable additional skills for existing tenant
UPDATE public.ai_skill_config
SET
  cultural_coach_enabled = true,
  cultural_coach_default_languages = ARRAY['en', 'es', 'zh'],
  welfare_check_dispatcher_enabled = true,
  welfare_check_dispatcher_batch_time = '03:00:00' -- Change to 3 AM
WHERE tenant_id = 'YOUR_TENANT_ID';
```

---

## Configuration Options Explained

### Skill #2: Billing Code Suggester
- **billing_suggester_enabled**: Enable/disable the skill
- **billing_suggester_model**: AI model (`claude-haiku-4-5-20250929` or `claude-sonnet-4-5-20250929`)
- **billing_suggester_cache_enabled**: Enable prompt caching (recommended: true)

**Trigger**: Call `billingCodeSuggester.suggestCodes()` after encounter documentation

---

### Skill #3: Readmission Risk Predictor
- **readmission_predictor_enabled**: Enable/disable the skill
- **readmission_predictor_model**: AI model (recommended: `claude-sonnet-4-5-20250929` for accuracy)
- **readmission_predictor_auto_create_care_plan**: Auto-create care plans for high-risk patients

**Trigger**: Call `readmissionPredictor.predictRisk()` at patient discharge

---

### Skill #4: SDOH Passive Detector
- **sdoh_passive_detector_enabled**: Enable/disable the skill
- **sdoh_passive_detector_confidence_threshold**: Minimum confidence (0.00-1.00, recommended: 0.75)
- **sdoh_passive_detector_auto_create_indicators**: Auto-create SDOH indicators
- **sdoh_passive_detector_model**: AI model

**Trigger**: Call `sdohPassiveDetector.scanContent()` on check-ins, notes, messages

---

### Skill #6: Cultural Health Coach
- **cultural_coach_enabled**: Enable/disable the skill
- **cultural_coach_default_languages**: Supported languages (e.g., `['en', 'es', 'zh', 'ar']`)
- **cultural_coach_cache_threshold**: Cache hit rate threshold (0.00-1.00)
- **cultural_coach_model**: AI model

**Supported Languages**: en, es, zh, ar, vi, ko, ru, fr, de, hi, pt, ja, tl

**Trigger**: Call `culturalHealthCoach.translateContent()` for patient communications

---

### Skill #7: Handoff Synthesizer
- **handoff_synthesizer_enabled**: Enable/disable the skill
- **handoff_synthesizer_auto_generate**: Auto-generate handoffs at shift change
- **handoff_synthesizer_model**: AI model

**Trigger**: Call `handoffSynthesizer.generateHandoff()` at shift end (or auto-trigger)

---

### Skill #9: CCM Eligibility Scorer
- **ccm_eligibility_scorer_enabled**: Enable/disable the skill
- **ccm_eligibility_scorer_minimum_score**: Minimum score for eligibility (0.00-1.00, recommended: 0.70)
- **ccm_eligibility_scorer_auto_enroll**: Auto-enroll eligible patients
- **ccm_eligibility_scorer_model**: AI model

**Trigger**: Call `ccmEligibilityScorer.scorePatient()` monthly or on diagnosis change

---

### Skill #10: Welfare Check Dispatcher
- **welfare_check_dispatcher_enabled**: Enable/disable the skill
- **welfare_check_dispatcher_auto_dispatch_threshold**: Auto-dispatch at priority score (0-100)
- **welfare_check_dispatcher_batch_time**: Daily batch run time (e.g., '02:00:00' for 2 AM)
- **welfare_check_dispatcher_model**: AI model

**Trigger**: Schedule daily cron job to call `welfareCheckDispatcher.batchAssess()` OR call manually

---

### Skill #11: Emergency Access Intelligence
- **emergency_intel_enabled**: Enable/disable the skill
- **emergency_intel_briefing_validity_days**: How long briefings remain valid (recommended: 7 days)
- **emergency_intel_include_medical_history**: Include medical history in briefings
- **emergency_intel_include_access_codes**: Include door codes, gate codes, etc.

**Trigger**:
- Schedule weekly cron job to call `emergencyAccessIntelligence.generateBriefing()` for all seniors
- 911 dispatchers call `emergencyAccessIntelligence.getBriefing()` during emergency

---

## Check Current Configuration

```sql
-- View current configuration for a tenant
SELECT * FROM public.ai_skill_config
WHERE tenant_id = 'YOUR_TENANT_ID';
```

---

## Integration Checklist

After enabling skills in the database:

- [ ] **Add UI controls** - Add enable/disable toggles in admin settings
- [ ] **Integrate service calls** - Call the TypeScript services at appropriate trigger points
- [ ] **Set up cron jobs** - Schedule daily/weekly batch jobs (Skills #10, #11)
- [ ] **Configure ANTHROPIC_API_KEY** - Set environment variable in `.env`
- [ ] **Test each skill** - Verify functionality with test data
- [ ] **Monitor costs** - Track AI API usage via audit tables
- [ ] **Set up alerts** - Alert on high costs or failures

---

## Service Files Location

All AI skill services are located in `src/services/ai/`:

- `src/services/ai/billingCodeSuggester.ts` (Skill #2)
- `src/services/ai/readmissionPredictor.ts` (Skill #3)
- `src/services/ai/sdohPassiveDetector.ts` (Skill #4)
- `src/services/ai/culturalHealthCoach.ts` (Skill #6)
- `src/services/ai/handoffSynthesizer.ts` (Skill #7)
- `src/services/ai/ccmEligibilityScorer.ts` (Skill #9)
- `src/services/ai/welfareCheckDispatcher.ts` (Skill #10)
- `src/services/ai/emergencyAccessIntelligence.ts` (Skill #11)

---

## Cost Optimization Tips

1. **Use Haiku for high-volume tasks** - Skills #2, #4, #6, #7, #9, #10 use Haiku by default
2. **Use Sonnet for critical accuracy** - Skill #3 uses Sonnet for readmission predictions
3. **Enable caching** - Reduces costs by 90% for repeated prompts
4. **Batch processing** - Skills #10, #11 use daily/weekly batches (90-98% cost reduction)
5. **Adjust confidence thresholds** - Higher thresholds = fewer API calls
6. **Monitor usage** - Check `ai_cost` columns in each skill's table

---

## Support

For questions or issues with AI skills configuration:
- Check service file comments for detailed usage examples
- Review audit tables for error logs
- Consult AI_SKILLS_6_10_11_README.md for Skills #6, #10, #11 documentation
