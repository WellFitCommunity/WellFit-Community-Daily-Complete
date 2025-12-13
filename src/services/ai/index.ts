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
