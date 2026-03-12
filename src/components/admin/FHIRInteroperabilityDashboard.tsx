/**
 * FHIR Interoperability Dashboard — Barrel re-export
 *
 * The implementation has been decomposed into focused sub-modules under
 * ./fhir-interoperability/. This file preserves the original import path.
 *
 * Import paths that work:
 *   import FHIRInteroperabilityDashboard from './FHIRInteroperabilityDashboard'
 *   import { FHIRInteroperabilityDashboard } from './FHIRInteroperabilityDashboard'
 *   import FHIRInteroperabilityDashboard from './fhir-interoperability'
 */

export { FHIRInteroperabilityDashboard } from './fhir-interoperability';
export { default } from './fhir-interoperability';
