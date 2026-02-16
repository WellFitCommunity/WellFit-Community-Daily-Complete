/**
 * Labor & Delivery Service - Barrel Export
 */
export { LaborDeliveryService } from './laborDeliveryService';
export type { LDApiResponse } from './laborDeliveryService';

// Re-export types commonly needed by consumers
export type {
  CreatePregnancyRequest,
  CreatePrenatalVisitRequest,
  CreateDeliveryRecordRequest,
  CreateLaborEventRequest,
  CreateFetalMonitoringRequest,
  CreateNewbornAssessmentRequest,
  CreatePostpartumAssessmentRequest,
} from '../../types/laborDelivery';
