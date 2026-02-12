/**
 * FHIR R4 Resource Types — Barrel Re-export
 *
 * This file has been decomposed into focused modules under src/types/fhir/.
 * All exports are preserved for backwards compatibility.
 *
 * Modules:
 *   base.ts        — FHIRResource, CodeableConcept, Reference, Period, Quantity, etc.
 *   clinical.ts    — Condition, DiagnosticReport, Procedure, Observation, AllergyIntolerance
 *   preventive.ts  — Immunization, CarePlan, CareTeam, Goal, SDOH
 *   providers.ts   — Practitioner, PractitionerRole, Location, Organization, role constants
 *   documents.ts   — Encounter, DocumentReference, Provenance
 *   medications.ts — MedicationRequest, Medication, MedicationAffordabilityCheck
 *   advanced.ts    — CareCoordinationEvent, HealthEquityMetrics
 */
export * from './fhir/index';
