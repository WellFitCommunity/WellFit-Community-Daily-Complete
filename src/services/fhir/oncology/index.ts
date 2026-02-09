/**
 * FHIR Oncology Observation Service - Barrel Export
 */

// Types (re-exported from shared FHIR types)
export type {
  FHIRObservation,
  FHIRCodeableConcept,
  FHIRQuantity,
  FHIRApiResponse,
} from './types';

// Code constants
export { ONCOLOGY_LOINC_CODES, ONCOLOGY_SNOMED_CODES } from './codes';

// Service class
export { OncologyObservationService } from './OncologyObservationService';
