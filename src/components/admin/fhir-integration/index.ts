/**
 * FHIR Integration Service — Barrel Re-export
 *
 * Decomposed from FhirIntegrationService.ts (1,460 lines) into focused modules:
 * - types.ts: All FHIR R4 and database type definitions
 * - patientMapper.ts: Patient resource creation
 * - observationMapper.ts: Vitals and wellness observation mapping
 * - medicationMapper.ts: MedicationStatement mapping with helpers
 * - immunizationMapper.ts: Immunization resource mapping
 * - carePlanMapper.ts: CarePlan resource mapping
 * - exportService.ts: Export orchestration, population health, audit logging
 */

// Types
export type {
  FHIRPatient,
  FHIRObservation,
  FHIRMedicationStatement,
  FHIRImmunization,
  FHIRCarePlan,
  FHIRBundle,
  ImmunizationDbRow,
  CarePlanActivity,
  CarePlanDbRow,
  Profile,
  CheckIn,
  HealthEntry,
  Medication,
  VitalsRow,
} from './types';

// Mappers
export { createPatientResource, parseAddress } from './patientMapper';
export { createVitalsObservations, createWellnessObservations } from './observationMapper';
export {
  createMedicationStatements,
  mapMedicationStatus,
  parseFrequency,
  mapRouteToSNOMED,
} from './medicationMapper';
export { mapImmunizationToFHIR, mapSiteCode, mapRouteCodeImmunization } from './immunizationMapper';
export { mapCarePlanToFHIR } from './carePlanMapper';

// Main service class
export { FHIRIntegrationService } from './exportService';
export { FHIRIntegrationService as default } from './exportService';
