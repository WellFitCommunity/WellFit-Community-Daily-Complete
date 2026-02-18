/**
 * Labor & Delivery Service - Barrel Export
 */
export { LaborDeliveryService } from './laborDeliveryService';
export type { LDApiResponse } from './laborDeliveryService';
export { generateLDAlerts } from './laborDeliveryAlerts';
export { LDAlertService } from './laborDeliveryAlertService';
export type { LDPersistedAlert, CreateAlertRequest } from './laborDeliveryAlertService';
export { LDMetricsService } from './laborDeliveryMetrics';
export { suggestBillingCodes } from './laborDeliveryBilling';
export type { BillingSuggestion } from './laborDeliveryBilling';
export {
  requestEscalationScore,
  generateLaborProgressNote,
  checkLDDrugInteraction,
  generateDischargeSummary,
} from './laborDeliveryAI';
export type {
  LDEscalationResult,
  LDProgressNote,
  LDDrugInteractionResult,
  LDDischargeSummary,
} from './laborDeliveryAI';

export {
  checkGuidelineCompliance,
  generateLDShiftHandoff,
  scanPrenatalNotesForSDOH,
} from './laborDeliveryAI_tier2';
export type {
  LDGuidelineComplianceResult,
  LDGuidelineRecommendation,
  LDAdherenceGap,
  LDPreventiveScreening,
  LDShiftHandoffResult,
  LDHandoffSection,
  LDSDOHResult,
  LDSDOHDetection,
} from './laborDeliveryAI_tier2';

export {
  generateBirthPlan,
  calculatePPDRisk,
  checkLDContraindication,
  generateLDPatientEducation,
  LD_EDUCATION_TOPICS,
} from './laborDeliveryAI_tier3';
export type {
  LDEducationTopicKey,
} from './laborDeliveryAI_tier3';

// Re-export types commonly needed by consumers
export type {
  CreatePregnancyRequest,
  CreatePrenatalVisitRequest,
  CreateDeliveryRecordRequest,
  CreateLaborEventRequest,
  CreateFetalMonitoringRequest,
  CreateNewbornAssessmentRequest,
  CreatePostpartumAssessmentRequest,
  CreateMedicationAdminRequest,
  CreateRiskAssessmentRequest,
} from '../../types/laborDelivery';
