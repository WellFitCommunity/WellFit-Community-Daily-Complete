/**
 * FHIR Oncology Types
 * FHIR R4 compliant type definitions for oncology resources
 */

// Re-use shared FHIR types from dental module
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
} from '../dental/types';
