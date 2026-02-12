/**
 * HL7 v2.x to FHIR R4 Translators - Barrel Export
 *
 * Re-exports all translator modules for convenient access.
 */

// Types
export type {
  FHIRResource,
  FHIRIdentifier,
  FHIRCodeableConcept,
  FHIRCoding,
  FHIRHumanName,
  FHIRAddress,
  FHIRContactPoint,
  FHIRReference,
  FHIRPatient,
  FHIREncounter,
  FHIRDiagnosticReport,
  FHIRObservation,
  FHIRServiceRequest,
  FHIRAllergyIntolerance,
  FHIRCondition,
  FHIRCoverage,
  FHIRBundle,
  FHIRTranslationSuccess,
  TranslationResult,
} from './types';

// Status / code translation maps
export {
  translateEncounterStatus,
  translatePatientClass,
  translateResultStatus,
  translateObservationStatus,
  translateOrderStatus,
  translateOrderIntent,
  translatePriority,
  translateAbnormalFlag,
  translateAllergenCategory,
  translateAllergySeverity,
  translateDiagnosisType,
  translateGender,
  translateNameType,
  translateAddressType,
  translateTelecomType,
  translateCodingSystem,
} from './statusMaps';

// Common translation helpers
export {
  translateDate,
  translateDateTime,
  translateCodedElement,
  translateHumanNames,
  translateAddresses,
  translateTelecoms,
  translateExtendedPersonToReference,
  translateLocationToReference,
  translatePatientIdentifiers,
  generateResourceId,
  generateUUID,
} from './commonTranslators';

// Segment-to-resource translators
export { pidToPatient } from './patientTranslator';
export { pv1ToEncounter } from './encounterTranslator';
export { obrToDiagnosticReport, obxToObservation } from './diagnosticTranslator';
export { orcToServiceRequest, al1ToAllergyIntolerance, dg1ToCondition, in1ToCoverage } from './orderTranslator';
