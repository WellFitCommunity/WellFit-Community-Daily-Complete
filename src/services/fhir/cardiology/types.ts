/**
 * FHIR Cardiology Types
 * FHIR R4 compliant type definitions for cardiac resources
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
