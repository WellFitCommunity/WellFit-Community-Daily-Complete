/**
 * FHIR Cardiology Observation Service - Barrel Export
 */

// Types (re-exported from shared FHIR types)
export type {
  FHIRObservation,
  FHIRCodeableConcept,
  FHIRQuantity,
  FHIRApiResponse,
} from './types';

// Code constants
export { CARDIOLOGY_LOINC_CODES, CARDIOLOGY_SNOMED_CODES } from './codes';

// Service class
export { CardiologyObservationService } from './CardiologyObservationService';
