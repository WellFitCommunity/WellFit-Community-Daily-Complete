# AI Skills Roadmap & Tracker

> Last Updated: December 2025

---

## Status Legend

| Icon | Status |
|------|--------|
| ✅ | Complete - Production ready |
| 🔨 | In Progress - Being implemented |
| 📋 | Planned - In backlog |

---

## Core AI Skills (Foundation)

| # | Skill | Status | Model | Location | Notes |
|---|-------|--------|-------|----------|-------|
| 1 | Billing Code Suggester | ✅ | Haiku 4.5 | `src/services/ai/billingCodeSuggester.ts` | 95% cache hit rate |
| 2 | Readmission Risk Predictor | ✅ | Sonnet 4.5 | `src/services/ai/readmissionRiskPredictor.ts` | 30/7/90-day prediction |
| 3 | SDOH Passive Detector | ✅ | Haiku 4.5 | `src/services/ai/sdohPassiveDetector.ts` | Daily batch, 25 categories |
| 4 | Dashboard Personalization | ✅ | Haiku 4.5 | `supabase/functions/claude-personalization/` | Edge function |
| 5 | Medical Transcript Processing | ✅ | Sonnet 4.5 | `supabase/functions/process-medical-transcript/` | Real-time streaming |
| 6 | CCM Eligibility Scorer | ✅ | Haiku 4.5 | `src/services/ai/ccmEligibilityScorer.ts` | Weekly batch |
| 7 | Cultural Health Coach | ✅ | Haiku 4.5 | `src/services/ai/culturalHealthCoach.ts` | 13 languages |
| 8 | Bed Optimizer | ✅ | Sonnet 4.5 | `src/services/ai/bedOptimizer.ts` | Capacity forecasting |
| 9 | Drug Interaction Checker | ✅ | RxNorm API | `supabase/functions/check-drug-interactions/` | Free NLM API |
| 10 | Patient Form Extraction | ✅ | Vision | `supabase/functions/extract-patient-form/` | Handwriting OCR |
| 11 | Riley Smart Scribe | ✅ | Deepgram + Sonnet | `supabase/functions/realtime_medical_transcription/` | Production-ready (set DEEPGRAM_API_KEY) |
| 12 | Mood Suggestions | ✅ | Haiku 4.5 | `supabase/functions/smart-mood-suggestions/` | AI-powered personalized generation |

---

## Quick Wins (Phase 1)

| # | Skill | Status | Model | Target Location | Description |
|---|-------|--------|-------|-----------------|-------------|
| 13 | Smart Check-In Questions | ✅ | Haiku 4.5 | `supabase/functions/ai-check-in-questions/` | Personalized daily check-in questions |
| 14 | Patient Education Generator | ✅ | Haiku 4.5 | `src/services/ai/patientEducationService.ts` | 6th-grade reading level content |
| 15 | Enhanced Drug Interactions | ✅ | Haiku 4.5 | Extend existing | Alternative medication suggestions |
| 16 | Dashboard Anomaly Detection | ✅ | Haiku 4.5 | `src/services/ai/dashboardAnomalyService.ts` | AI-powered metric insights |
| 17 | Caregiver Briefing Generator | ✅ | Haiku 4.5 | `src/services/ai/caregiverBriefingService.ts` | Automated family updates |

---

## Clinical Documentation (Phase 2)

| # | Skill | Status | Model | Target Location | Description |
|---|-------|--------|-------|-----------------|-------------|
| 18 | SOAP Note Auto-Generator | ✅ | Sonnet 4.5 | `src/services/ai/soapNoteAIService.ts` | Generate from encounter summaries |
| 19 | Discharge Summary Generator | ✅ | Sonnet 4.5 | `src/services/ai/dischargeSummaryService.ts` | Auto-generate with med reconciliation |
| 20 | Care Plan Auto-Generator | ✅ | Sonnet 4.5 | `src/services/ai/carePlanAIService.ts` | Evidence-based from diagnosis + SDOH |
| 21 | Progress Note Synthesizer | ✅ | Haiku 4.5 | `src/services/ai/progressNoteSynthesizerService.ts` | Vitals trends, mood, adherence synthesis |
| 22 | Referral Letter Generator | ✅ | Haiku 4.5 | `src/services/ai/referralLetterService.ts` | Specialist referral letters with urgency levels |

---

## Clinical Decision Support (Phase 3)

| # | Skill | Status | Model | Target Location | Description |
|---|-------|--------|-------|-----------------|-------------|
| 23 | Treatment Pathway Recommender | ✅ | Sonnet 4.5 | `supabase/functions/ai-treatment-pathway/` | Evidence-based treatment suggestions |
| 24 | Clinical Guideline Matcher | ✅ | Sonnet 4.5 | `supabase/functions/ai-clinical-guideline-matcher/` | Smart guideline recommendations |
| 25 | Contraindication Detector | ✅ | Sonnet 4.5 | `src/services/ai/contraindicationDetectorService.ts` | Patient-specific risk detection with multi-factor analysis |
| 26 | Medication Reconciliation AI | ✅ | Sonnet 4.5 | `src/services/ai/medicationReconciliationAIService.ts` | Clinical reasoning, deprescribing, counseling |

---

## Patient Engagement (Phase 4)

| # | Skill | Status | Model | Target Location | Description |
|---|-------|--------|-------|-----------------|-------------|
| 27 | Appointment Prep Instructions | ✅ | Haiku 4.5 | `src/services/ai/appointmentPrepInstructionsService.ts` | Condition-specific prep with multi-format delivery |
| 28 | Missed Check-In Escalation | ✅ | Haiku 4.5 | `supabase/functions/ai-missed-checkin-escalation/` | AI-powered escalation with risk analysis |
| 29 | Medication Instructions Generator | ✅ | Haiku 4.5 | `src/services/ai/medicationInstructionsService.ts` | Personalized with visual aids, pill ID, multi-language |

---

## Risk Prediction (Phase 5)

| # | Skill | Status | Model | Target Location | Description |
|---|-------|--------|-------|-----------------|-------------|
| 30 | Fall Risk Predictor | ✅ | Sonnet 4.5 | `src/services/ai/fallRiskPredictorService.ts` | Morse Scale + evidence-based assessment |
| 31 | Medication Adherence Predictor | ✅ | Sonnet 4.5 | `src/services/ai/medicationAdherencePredictorService.ts` | Barrier identification, intervention recommendations |
| 32 | Care Escalation Scorer | ✅ | Sonnet 4.5 | `src/services/ai/careEscalationScorerService.ts` | Confidence-level escalation with clinical indicators |
| 33 | Infection Risk Predictor (HAI) | ✅ | Sonnet 4.5 | `src/services/ai/infectionRiskPredictorService.ts` | CLABSI, CAUTI, SSI, VAP, C. diff prediction |
| 34 | Extended Readmission (1-Year) | ✅ | Sonnet 4.5 | `src/services/ai/extendedReadmissionPredictorService.ts` | 1-year horizon with seasonal patterns & SDOH factors |

---

## Admin Automation (Phase 6)

| # | Skill | Status | Model | Target Location | Description |
|---|-------|--------|-------|-----------------|-------------|
| 35 | Schedule Optimizer | ✅ | Haiku 4.5 | `src/services/ai/scheduleOptimizerService.ts` | Shift scheduling with coverage & fairness |
| 36 | Audit Report Generator | ✅ | Haiku 4.5 | `src/services/ai/auditReportGeneratorService.ts` | SOC2, HIPAA compliance report generation |
| 37 | Performance Summary Generator | 📋 | Haiku 4.5 | `StaffFinancialSavingsTracker.tsx` | Staff summaries |
| 38 | Billing Optimization Engine | 📋 | Sonnet 4.5 | `BillingDashboard.tsx` | Advanced coding optimization |

---

## Analytics & Insights (Phase 7)

| # | Skill | Status | Model | Target Location | Description |
|---|-------|--------|-------|-----------------|-------------|
| 39 | Population Health Insights | ✅ | Sonnet 4.5 | `src/services/ai/populationHealthInsightsService.ts` | Cohort analysis, risk stratification, VBC analytics |
| 40 | Predictive Cost Modeling | 📋 | Sonnet 4.5 | `AICostDashboard.tsx` | Cost projections |
| 41 | Clinical Outcomes Prediction | 📋 | Sonnet 4.5 | New service | Mortality, LOS prediction |

---

## Voice & NLP (Phase 8)

| # | Skill | Status | Model | Target Location | Description |
|---|-------|--------|-------|-----------------|-------------|
| 42 | Enhanced Voice Commands | ✅ | Haiku 4.5 | `src/services/ai/enhancedVoiceCommandsService.ts` | Claude-powered NLU intent recognition |
| 43 | Ambient Clinical Intelligence | 📋 | Sonnet 4.5 | `process-medical-transcript/` | Real-time suggestions |
| 44 | Voice Emotion Detection | 📋 | Sonnet 4.5 | New service | Patient emotional state |

---

## Specialty Domains (Phase 9)

| # | Skill | Status | Model | Target Location | Description |
|---|-------|--------|-------|-----------------|-------------|
| 45 | Stroke Recovery Predictor | 📋 | Sonnet 4.5 | `neuroSuiteService.ts` | Recovery trajectory |
| 46 | Cognitive Decline Tracker | 📋 | Sonnet 4.5 | NeuroSuite | Pattern detection + interventions |
| 47 | Dental Treatment Planner | 📋 | Sonnet 4.5 | `dentalHealthService.ts` | Treatment from findings |
| 48 | CDT Code Suggester | 📋 | Haiku 4.5 | Dental service | Dental procedure codes |
| 49 | Field Visit Optimizer | 📋 | Haiku 4.5 | `FieldVisitManager.ts` | Route optimization |

---

## Interoperability (Phase 10)

| # | Skill | Status | Model | Target Location | Description |
|---|-------|--------|-------|-----------------|-------------|
| 50 | FHIR Semantic Mapper | ✅ | Sonnet 4.5 | `src/services/ai/fhirSemanticMapperService.ts` | R4/R5 mapping, AI suggestions |
| 51 | HL7 v2 Interpreter | ✅ | Sonnet 4.5 | `src/services/ai/hl7V2InterpreterService.ts` | Ambiguous message handling, segment parsing, validation |
| 52 | EDI Claims Validator | 📋 | Haiku 4.5 | `mcpHL7X12Client.ts` | Intelligent validation |

---

## Security & Compliance (Phase 11)

| # | Skill | Status | Model | Target Location | Description |
|---|-------|--------|-------|-----------------|-------------|
| 53 | Security Anomaly Detector | ✅ | Sonnet 4.5 | `src/services/ai/securityAnomalyDetectorService.ts` | ML behavior detection, threat assessment |
| 54 | PHI Exposure Risk Scorer | ✅ | Sonnet 4.5 | `src/services/ai/phiExposureRiskScorerService.ts` | Risk assessment, exposure analysis |
| 55 | HIPAA Violation Predictor | ✅ | Sonnet 4.5 | `src/services/ai/hipaaViolationPredictorService.ts` | Predictive compliance, violation risk scoring |

---

## Conversational AI (Phase 12)

| # | Skill | Status | Model | Target Location | Description |
|---|-------|--------|-------|-----------------|-------------|
| 56 | Patient Q&A Bot | ✅ | Sonnet 4.5 | `supabase/functions/ai-patient-qa-bot/` | Health question answering |
| 57 | Provider Assistant | ✅ | Sonnet 4.5 | `src/services/ai/providerAssistantService.ts` | Role-adaptive for all staff |
| 58 | Care Team Chat Summarizer | ✅ | Haiku 4.5 | `src/services/ai/careTeamChatSummarizerService.ts` | Team communication summaries, action item extraction |
| 59 | Admin Chat Assistant | 📋 | Haiku 4.5 | `IntelligentAdminPanel.tsx` | Conversational admin help |

---

## Cost Optimization Strategy

| Model | Use Cases | Input/Output per 1K |
|-------|-----------|---------------------|
| **Haiku 4.5** | Frequent ops, selection, summaries, simple decisions | $0.25 / $1.25 |
| **Sonnet 4.5** | Critical decisions, clinical accuracy, complex analysis | $3.00 / $15.00 |
| **Vision** | Form extraction, wound photos, medication labels | Per image |

**Techniques:**
- Prompt caching for common diagnoses (60-80% hit rate)
- Batch API for overnight analytics (10x cost reduction)
- MCP integration for multi-step clinical workflows
- Edge function caching for repeated patient queries

---

## Progress Summary

| Category | Complete | Partial | Planned | Total |
|----------|----------|---------|---------|-------|
| Core Skills | 12 | 0 | 0 | 12 |
| Quick Wins | 5 | 0 | 0 | 5 |
| Clinical Docs | 5 | 0 | 0 | 5 |
| Decision Support | 4 | 0 | 0 | 4 |
| Patient Engagement | 3 | 0 | 0 | 3 |
| Risk Prediction | 5 | 0 | 0 | 5 |
| Admin Automation | 2 | 0 | 2 | 4 |
| Analytics | 1 | 0 | 2 | 3 |
| Voice/NLP | 1 | 0 | 2 | 3 |
| Specialty | 0 | 0 | 5 | 5 |
| Interoperability | 2 | 0 | 1 | 3 |
| Security | 3 | 0 | 0 | 3 |
| Conversational | 3 | 0 | 1 | 4 |
| **TOTAL** | **46** | **0** | **13** | **59** |

---

## Intelligent Learning Loop Status

### Current State (January 2026)

**Infrastructure Built:**
- ✅ `accuracyTrackingService.ts` - Complete prediction recording, outcome tracking, A/B testing
- ✅ Database tables: `ai_predictions`, `ai_prompt_versions`, `ai_prompt_experiments`, `billing_code_accuracy`, `sdoh_detection_accuracy`
- ✅ Prompt version management with activation/deactivation
- ✅ Statistical significance testing for experiments (two-proportion z-test)

**Gap Identified:**
- ❌ **Skills NOT integrated** with `accuracyTrackingService`
- ❌ AI skills do not call `recordPrediction()` after making predictions
- ❌ No feedback mechanism connecting outcomes back to skill improvement
- ❌ Prompt optimization based on accuracy data not implemented

### Integration Required

Each AI skill needs to integrate with `accuracyTrackingService`:

```typescript
// Example integration pattern for any AI skill:
import { createAccuracyTrackingService } from './accuracyTrackingService';

// After making a prediction:
const trackingResult = await accuracyService.recordPrediction({
  tenantId,
  skillName: 'billing_code_suggester',  // Unique skill identifier
  predictionType: 'code',
  predictionValue: { codes: suggestedCodes },
  confidence: avgConfidence,
  patientId,
  model: 'claude-haiku-4-5-20250929',
  inputTokens,
  outputTokens,
  costUsd,
  latencyMs
});

// When outcome is known (e.g., provider review):
await accuracyService.recordOutcome({
  predictionId: trackingResult.data,
  actualOutcome: { acceptedCodes, rejectedCodes },
  isAccurate: acceptanceRate >= 0.70,
  outcomeSource: 'provider_review'
});
```

### Services Missing Tests (January 2026)

| Service | Status | Priority |
|---------|--------|----------|
| `ccmEligibilityScorer.ts` | ✅ Tests added (120+ tests) | High |
| `culturalHealthCoach.ts` | ✅ Tests added (85+ tests) | High |
| `emergencyAccessIntelligence.ts` | ✅ Tests added (90+ tests) | High |
| `handoffRiskSynthesizer.ts` | ✅ Tests added (75+ tests) | Medium |
| `sdohPassiveDetector.ts` | ✅ Tests added (85+ tests) | High |
| `welfareCheckDispatcher.ts` | ✅ Tests added (85+ tests) | High |

**All 6 missing test suites created: January 3, 2026**

---

## Implementation Queue

### Current Sprint
1. [x] Smart Check-In Questions
2. [x] Patient Education Generator
3. [x] Enhanced Drug Interactions
4. [x] Dashboard Anomaly Detection
5. [x] Caregiver Briefing Generator
6. [x] Riley Smart Scribe (verified production-ready)
7. [x] SOAP Note Auto-Generator
8. [x] Patient Q&A Bot
9. [x] Care Plan Auto-Generator
10. [x] Treatment Pathway Recommender
11. [x] Discharge Summary Generator
12. [x] Progress Note Synthesizer
13. [x] Fall Risk Predictor
14. [x] Clinical Guideline Matcher
15. [x] Referral Letter Generator
16. [x] Contraindication Detector
17. [x] Medication Reconciliation AI
18. [x] Appointment Prep Instructions

### Next Sprint
- Medication Instructions Generator (#29)
- Medication Adherence Predictor (#31)
- Care Escalation Scorer (#32)
- Infection Risk Predictor (#33)

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-26 | Completed Care Team Chat Summarizer (#58) - Team communication summaries with action item extraction |
| 2025-12-26 | Completed HIPAA Violation Predictor (#55) - Predictive compliance with violation risk scoring |
| 2025-12-26 | Completed PHI Exposure Risk Scorer (#54) - Risk assessment and exposure analysis |
| 2025-12-26 | Completed Security Anomaly Detector (#53) - ML behavior detection with threat assessment |
| 2025-12-26 | Completed HL7 v2 Interpreter (#51) - Ambiguous message handling, segment parsing, validation |
| 2025-12-26 | Completed Population Health Insights (#39) - Cohort analysis, risk stratification, VBC analytics |
| 2025-12-26 | Completed Audit Report Generator (#36) - SOC2, HIPAA compliance report generation |
| 2025-12-26 | Completed Extended Readmission Predictor (#34) - 1-year horizon with seasonal patterns & SDOH factors |
| 2025-12-26 | Completed Medication Instructions Generator (#29) - Personalized with visual aids, pill ID, multi-language |
| 2025-12-26 | Completed Enhanced Voice Commands (#42) - Claude-powered NLU intent recognition |
| 2025-12-24 | Completed Schedule Optimizer (#35) - Staff shift scheduling with coverage, fairness, and cost optimization |
| 2025-12-24 | Completed Provider Assistant (#57) - Role-adaptive conversational AI for physicians, nurses, care coordinators, pharmacists, and admin staff |
| 2025-12-24 | Completed Medication Adherence Predictor (#31) - Barrier identification, regimen complexity analysis, historical patterns, intervention recommendations |
| 2025-12-24 | Completed Care Escalation Scorer (#32) - Confidence-level escalation with clinical indicators for shift handoff |
| 2025-12-24 | Completed Infection Risk Predictor (#33) - CLABSI, CAUTI, SSI, VAP, C. diff with prevention bundles |
| 2025-12-24 | Completed Missed Check-In Escalation (#28) - AI-powered escalation with risk factor analysis, caregiver notification, and welfare check recommendations |
| 2025-12-23 | Completed Appointment Prep Instructions (#27) - Personalized condition-specific preparation with fasting, medication holds, checklists, and multi-format delivery (SMS, email, print) |
| 2025-12-23 | Completed Medication Reconciliation AI (#26) - AI-enhanced reconciliation with clinical reasoning for discrepancies, deprescribing opportunities, patient counseling points, and pharmacy verification checklists |
| 2025-12-23 | Completed Contraindication Detector (#25) - Multi-factor patient safety analysis including disease-drug, allergy cross-reactivity, lab values, age, pregnancy, and organ impairment checks |
| 2025-12-23 | Completed Referral Letter Generator (#22) - Professional referral letters with urgency levels, safety guardrails, and physician review workflow |
| 2025-12-23 | Completed Mood Suggestions (#12) - Enhanced from selection-only to AI-powered personalized generation with history context |
| 2025-12-23 | Added Clinical Guideline Matcher (#24) - Smart guideline recommendations with adherence gap detection |
| 2025-12-23 | Added Fall Risk Predictor (#30) - Morse Scale + evidence-based clinical risk assessment |
| 2025-12-23 | Added Progress Note Synthesizer (#21) - Vitals trends, mood, adherence synthesis across check-ins |
| 2025-12-23 | Added Discharge Summary Generator (#19) - Comprehensive summaries with medication reconciliation |
| 2025-12-23 | Added Treatment Pathway Recommender (#23) - Evidence-based clinical decision support with allergy/contraindication checking |
| 2025-12-23 | Added Care Plan Auto-Generator (#20) - Evidence-based care plans with safety guardrails |
| 2025-12-23 | Added SOAP Note Auto-Generator (#18) - AI-powered SOAP note generation using Sonnet 4.5 |
| 2025-12-23 | Added Patient Q&A Bot (#56) - Health question answering with safety guardrails |
| 2025-12-23 | Verified Riley Smart Scribe is production-ready (was incorrectly marked as demo-only) |
| 2025-12-23 | Completed 5 Quick Win skills: Check-In Questions, Patient Education, Drug Interactions, Dashboard Anomaly, Caregiver Briefing |
| 2025-12-23 | Initial roadmap created with 59 skills tracked |
