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
