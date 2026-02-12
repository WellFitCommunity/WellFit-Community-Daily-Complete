/**
 * Enhanced FHIR Service — Barrel Re-export
 *
 * All types, utilities, and the main service class are re-exported
 * from this index for backward-compatible imports.
 */

// Types
export type {
  PatientProfile,
  VitalsEntry,
  CheckInRecord,
  MedicationRecord,
  ComprehensivePatientData,
  CacheEntry,
  EvidenceBasedRecommendation,
  DrugInteraction,
  ClinicalGuideline,
  WeeklyReport,
  MonthlyReport,
  EmergencyReport,
  FhirComplianceResult,
  DataQualityResult,
  ClinicalQualityResult,
  SmartSession,
  EnhancedPatientData,
  PopulationDashboard,
  RiskMatrix,
  InterventionItem,
  ResourceRecommendation,
  PredictiveAlert,
  ClinicalDecisionSupport,
  QualityMetrics,
  FhirBundle,
  PatientInsight,
  PopulationInsights,
  EmergencyAlert,
  HealthStatistics,
  AiConfiguration
} from './types';

// Data fetching utilities
export { DataCache, fetchComprehensivePatientData, fetchPopulationData, fetchRecentCheckIns } from './data-fetching';

// Clinical decision support functions
export { determinePrimaryCondition, getEvidenceBasedRecommendations, checkDrugInteractions, getApplicableClinicalGuidelines } from './clinical-decision-support';

// Population analytics functions
export { mapPriorityToNumber, calculateDueDate, generateRiskMatrix, generateInterventionQueue, generateResourceRecommendations, generatePredictiveAlerts } from './population-analytics';

// Quality assessment functions
export { assessFhirCompliance, assessDataQuality, assessClinicalQuality, cleanVitalSigns } from './quality-assessment';

// Reporting functions
export { generateClinicalSummary, generateRecommendedActions, calculateNextReviewDate, generateWeeklyReport, generateMonthlyReport, generateEmergencyReport } from './reporting';

// SMART sync functions
export { syncWithSmartSession } from './smart-sync';

// Main service class
export { EnhancedFhirService } from './EnhancedFhirServiceClass';
export { default } from './EnhancedFhirServiceClass';
