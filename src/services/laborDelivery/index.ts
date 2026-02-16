/**
 * Labor & Delivery Service - Barrel Export
 */
export { LaborDeliveryService } from './laborDeliveryService';
export type { LDApiResponse } from './laborDeliveryService';
export { generateLDAlerts } from './laborDeliveryAlerts';

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
} from '../../types/laborDelivery';
