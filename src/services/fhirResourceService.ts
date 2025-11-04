/**
 * FHIR Resource Service
 * Enterprise-grade service for managing FHIR R4 resources
 *
 * REFACTORED: 2025-11-04
 * - Extracted from monolithic file (3,498 lines originally, then 1,711 lines)
 * - Now imports from 22 modular service files in /services/fhir/
 * - Maintained 100% backwards compatibility
 * - All imports from 'services/fhirResourceService' continue to work
 *
 * @see /src/services/fhir/README.md for architecture details
 *
 * NEW USAGE (Recommended):
 * import { MedicationRequestService, ConditionService } from '@/services/fhir';
 * import { PatientService } from '@/services/fhir/PatientService';
 *
 * OLD USAGE (Still works):
 * import { FHIRService } from '@/services/fhirResourceService';
 * FHIRService.MedicationRequest.getActive(patientId);
 */

// ============================================================================
// IMPORTS - All FHIR R4 Resource Services
// ============================================================================

import {
  // Core Clinical Resources
  MedicationRequestService,
  ConditionService,
  DiagnosticReportService,
  ProcedureService,
  ObservationService,
  ImmunizationService,
  CarePlanService,
  CareTeamService,

  // Provider & Organization Resources
  PractitionerService,
  PractitionerRoleService,
  OrganizationService,
  LocationService,

  // Patient Care Resources
  AllergyIntoleranceService,
  EncounterService,
  DocumentReferenceService,
  GoalService,
  MedicationService,
  ProvenanceService,

  // WellFit Innovative Services (Differentiators)
  SDOHService,
  MedicationAffordabilityService,
  CareCoordinationService,
  HealthEquityService,

  // Utility Functions
  normalizeCondition,
  toFHIRCondition,
} from './fhir';

// ============================================================================
// RE-EXPORTS (for backwards compatibility)
// ============================================================================

// Core Clinical Resources
export {
  MedicationRequestService,
  ConditionService,
  DiagnosticReportService,
  ProcedureService,
  ObservationService,
  ImmunizationService,
  CarePlanService,
  CareTeamService,
};

// Provider & Organization Resources
export {
  PractitionerService,
  PractitionerRoleService,
  OrganizationService,
  LocationService,
};

// Patient Care Resources
export {
  AllergyIntoleranceService,
  EncounterService,
  DocumentReferenceService,
  GoalService,
  MedicationService,
  ProvenanceService,
};

// WellFit Innovative Services (Differentiators)
export {
  SDOHService,
  MedicationAffordabilityService,
  CareCoordinationService,
  HealthEquityService,
};

// Utility Functions
export {
  normalizeCondition,
  toFHIRCondition,
};

// ============================================================================
// UNIFIED FHIR SERVICE OBJECT (Legacy Default Export)
// Maintains backwards compatibility with code using: FHIRService.MedicationRequest.getActive()
// ============================================================================

export const FHIRService = {
  // Core Clinical Resources
  MedicationRequest: MedicationRequestService,
  Condition: ConditionService,
  DiagnosticReport: DiagnosticReportService,
  Procedure: ProcedureService,
  Observation: ObservationService,
  Immunization: ImmunizationService,
  CarePlan: CarePlanService,
  CareTeam: CareTeamService,

  // Provider & Organization Resources
  Practitioner: PractitionerService,
  PractitionerRole: PractitionerRoleService,
  Organization: OrganizationService,
  Location: LocationService,

  // Patient Care Resources
  AllergyIntolerance: AllergyIntoleranceService,
  Encounter: EncounterService,
  DocumentReference: DocumentReferenceService,
  Goal: GoalService,
  Medication: MedicationService,
  Provenance: ProvenanceService,

  // WellFit Innovative Services (Differentiators)
  SDOH: SDOHService,
  MedicationAffordability: MedicationAffordabilityService,
  CareCoordination: CareCoordinationService,
  HealthEquity: HealthEquityService,
};

// Default export for legacy code using: import FHIRService from '@/services/fhirResourceService'
export default FHIRService;
