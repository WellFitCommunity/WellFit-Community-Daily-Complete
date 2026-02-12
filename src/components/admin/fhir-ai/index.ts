/**
 * FHIR AI Service — Barrel Re-export
 *
 * Decomposed from the original FhirAiService.ts (1,425 lines) into focused modules:
 * - types.ts          — All interfaces and type definitions
 * - riskAssessment.ts — Vital sign risk evaluation, adherence, and trend detection
 * - patientInsights.ts — Patient-level insights, predictions, care recommendations
 * - populationAnalytics.ts — Population-level health analysis
 * - healthStatistics.ts — Daily/weekly aggregation and statistical helpers
 * - FhirAiServiceClass.ts — Thin orchestrator class preserving original API
 */

// Types
export type {
  VitalsReading,
  CheckInEntry,
  PatientProfile,
  PatientData,
  RiskDistribution,
  HealthRiskAssessment,
  VitalsTrend,
  PatientInsight,
  EmergencyAlert,
  PredictedOutcome,
  CareRecommendation,
  PopulationInsights,
  PopulationRecommendation,
  PopulationPrediction,
  AiConfiguration,
  DailyHealthLog,
  DailyAggregates,
  WeeklyHealthSummary,
  WeeklyTrends,
  HealthStatistics,
  OverallStatistics,
  VitalRiskResult,
} from './types';

// Orchestrator class
export { FhirAiService } from './FhirAiServiceClass';

// Default export for backward compatibility
export { FhirAiService as default } from './FhirAiServiceClass';

// Risk assessment functions (for direct use)
export {
  assessBloodPressureRisk,
  assessHeartRateRisk,
  assessGlucoseRisk,
  assessOxygenSaturationRisk,
  assessAdherenceRisk,
  calculateVitalTrend,
  analyzeVitalsTrends,
  analyzeTrends,
  calculateTrendDirection,
  calculatePriority,
  calculateAdherenceScore,
  detectEmergencyConditions,
  createEmergencyAlert,
  calculateOverallHealthScore,
  assessPatientRisk,
} from './riskAssessment';

// Patient insights functions
export {
  generatePredictedOutcomes,
  generateCareRecommendations,
  generatePatientInsights,
  monitorPatientInRealTime,
} from './patientInsights';

// Population analytics functions
export {
  calculatePopulationHealthScore,
  identifyTrendingConcerns,
  analyzeCommonConditions,
  calculatePopulationAdherence,
  calculateAverageAge,
  generatePopulationRecommendations,
  generatePopulationPredictions,
  generatePopulationInsights,
} from './populationAnalytics';

// Health statistics functions
export {
  computeDailyHealthLogs,
  computeWeeklyAverages,
  computeHealthStatistics,
} from './healthStatistics';
