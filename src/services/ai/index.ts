/**
 * AI Services Index
 *
 * Central export point for all AI-related services.
 * Includes accuracy tracking, prompt optimization, and individual skills.
 */

// Core accuracy tracking
export {
  AccuracyTrackingService,
  createAccuracyTrackingService,
  type PredictionRecord,
  type PredictionOutcome,
  type AccuracyMetrics,
  type PromptVersion,
  type ExperimentConfig,
  type ExperimentResults
} from './accuracyTrackingService';

// Optimized prompts
export {
  getOptimizedPrompt,
  getAvailableSkills,
  PROMPT_REGISTRY,
  type PromptTemplate,
  // Individual prompt exports for direct access
  READMISSION_RISK_PROMPT_V2,
  READMISSION_RISK_USER_TEMPLATE,
  BILLING_CODES_PROMPT_V2,
  SDOH_DETECTION_PROMPT_V2,
  WELFARE_CHECK_PROMPT_V2,
  SHIFT_HANDOFF_PROMPT_V2,
  EMERGENCY_BRIEFING_PROMPT_V2,
  CCM_ELIGIBILITY_PROMPT_V2
} from './optimizedPrompts';

// Individual AI skills
export { billingCodeSuggester, BillingCodeSuggester } from './billingCodeSuggester';
export { readmissionRiskPredictor, ReadmissionRiskPredictor } from './readmissionRiskPredictor';
export { sdohPassiveDetector, SDOHPassiveDetector } from './sdohPassiveDetector';
export { welfareCheckDispatcher } from './welfareCheckDispatcher';
export { emergencyAccessIntelligence } from './emergencyAccessIntelligence';
export { ccmEligibilityScorer, CCMEligibilityScorer } from './ccmEligibilityScorer';
export { culturalHealthCoach } from './culturalHealthCoach';
export { handoffRiskSynthesizer, HandoffRiskSynthesizer } from './handoffRiskSynthesizer';

// Bed optimization (Sonnet-powered for accuracy)
export {
  bedOptimizer,
  BedOptimizerService,
  type CapacityForecast,
  type DischargeRecommendation,
  type BedAssignmentRecommendation,
  type CapacityInsight,
  type OptimizationReport,
  type IncomingPatient
} from './bedOptimizer';

// Batch inference (P2 optimization - 10x cost reduction)
export {
  batchInference,
  BatchInferenceService,
  type InferencePriority,
  type InferenceStatus,
  type InferenceType,
  type InferenceRequest,
  type InferenceResult,
  type BatchResult,
  type BatchConfig,
  type QueueStats
} from './batchInference';

// SOAP Note AI Generation (Skill #18)
export {
  SOAPNoteAIService,
  type SOAPNoteSection,
  type CodeSuggestion,
  type GeneratedSOAPNote,
  type SOAPNoteGenerationRequest,
  type SOAPNoteGenerationResponse
} from './soapNoteAIService';

// Patient Q&A Bot (Skill #56)
export {
  PatientQAService,
  type SafetyCheck,
  type QAResponse,
  type ConversationMessage,
  type AskQuestionRequest
} from './patientQAService';

// Care Plan AI Generation (Skill #20)
export {
  CarePlanAIService,
  type CarePlanGoal,
  type CarePlanIntervention,
  type CarePlanBarrier,
  type CarePlanActivity,
  type GeneratedCarePlan,
  type CarePlanGenerationRequest,
  type CarePlanGenerationResponse
} from './carePlanAIService';

// Treatment Pathway Recommender (Skill #23)
export {
  TreatmentPathwayService,
  type TreatmentStep,
  type MedicationRecommendation,
  type LifestyleRecommendation,
  type ReferralRecommendation,
  type MonitoringParameter,
  type GuidelineSummary,
  type TreatmentPathway,
  type TreatmentPathwayRequest,
  type TreatmentPathwayResponse
} from './treatmentPathwayService';

// Discharge Summary Generator (Skill #19)
export {
  DischargeSummaryService,
  type MedicationEntry,
  type MedicationChange,
  type MedicationReconciliation,
  type DischargeDiagnosis,
  type ProcedurePerformed,
  type FollowUpAppointment,
  type PatientInstruction,
  type WarningSign,
  type DischargeSummary,
  type DischargeSummaryRequest,
  type DischargeSummaryResponse
} from './dischargeSummaryService';

// Progress Note Synthesizer (Skill #21)
export {
  ProgressNoteSynthesizerService,
  progressNoteSynthesizerService,
  type VitalsTrend,
  type MoodSummary,
  type ActivitySummary,
  type ConcernFlag,
  type ProgressNoteSummary,
  type GeneratedProgressNote,
  type ProgressNoteGenerationRequest,
  type ProgressNoteGenerationResponse,
  type SavedProgressNote
} from './progressNoteSynthesizerService';

// Fall Risk Predictor (Skill #30)
export {
  FallRiskPredictorService,
  fallRiskPredictorService,
  type RiskFactor,
  type ProtectiveFactor,
  type FallRiskIntervention,
  type CategoryScores,
  type FallRiskAssessment,
  type FallRiskAssessmentRequest,
  type FallRiskAssessmentResponse,
  type SavedFallRiskAssessment
} from './fallRiskPredictorService';

// Clinical Guideline Matcher (Skill #24)
export {
  ClinicalGuidelineMatcherService,
  clinicalGuidelineMatcherService,
  type ClinicalGuideline,
  type GuidelineRecommendation,
  type AdherenceGap,
  type PreventiveScreening,
  type GuidelineMatchResult,
  type GuidelineMatchRequest,
  type GuidelineMatchResponse,
  type SavedGuidelineMatch
} from './clinicalGuidelineMatcherService';

// Referral Letter Generator (Skill #22)
export {
  ReferralLetterService,
  type ReferralLetterRequest,
  type ReferringProvider,
  type RecipientProvider,
  type ReferralLetter,
  type ReferralLetterMetadata,
  type ReferralLetterResponse,
  type SavedReferralLetter
} from './referralLetterService';

// Contraindication Detector (Skill #25)
export {
  ContraindicationDetectorService,
  type ContraindicationType,
  type ContraindicationSeverity,
  type ContraindicationCheckRequest,
  type ContraindicationFinding,
  type PatientContext,
  type ContraindicationCheckResult,
  type ContraindicationCheckResponse,
  type SavedContraindicationCheck
} from './contraindicationDetectorService';

// Medication Reconciliation AI (Skill #26)
export {
  MedicationReconciliationAIService,
  type MedicationEntry as ReconciliationMedicationEntry,
  type MedicationSource,
  type DiscrepancyAnalysis,
  type DeprescribingCandidate,
  type PatientCounselingPoint,
  type ReconciliationSummary,
  type MedicationReconciliationAIResult,
  type MedicationReconciliationRequest,
  type MedicationReconciliationResponse,
  type SavedReconciliation
} from './medicationReconciliationAIService';
