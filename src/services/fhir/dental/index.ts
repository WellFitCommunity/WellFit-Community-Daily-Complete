/**
 * FHIR Dental Observation Service - Barrel Export
 * Re-exports all dental FHIR types, codes, helpers, and the main service class.
 */

// Types
export type {
  FHIRObservation,
  FHIRProcedure,
  FHIRCondition,
  FHIRDiagnosticReport,
  FHIRCodeableConcept,
  FHIRCoding,
  FHIRReference,
  FHIRQuantity,
  FHIRAnnotation,
  FHIRReferenceRange,
  FHIRApiResponse,
} from './types';

// Code constants
export { DENTAL_LOINC_CODES, DENTAL_SNOMED_CODES } from './codes';

// Service class
export { DentalObservationService } from './DentalObservationService';
