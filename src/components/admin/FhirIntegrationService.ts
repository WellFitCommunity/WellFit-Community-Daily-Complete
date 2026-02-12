/**
 * FHIR Integration Service — Barrel Re-export
 * Decomposed into focused modules under ./fhir-integration/
 *
 * Original: 1,460 lines -> 7 focused modules, all under 600 lines
 */
export * from './fhir-integration/index';
export { FHIRIntegrationService as default } from './fhir-integration/index';
