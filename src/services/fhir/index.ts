/**
 * FHIR Services Barrel Export
 *
 * Central export point for all FHIR R4 resource services
 * Maintains backwards compatibility with previous monolithic service
 *
 * Usage:
 * ```typescript
 * import { MedicationRequestService, ConditionService } from '@/services/fhir';
 * ```
 */

// Core FHIR R4 Resource Services
export { MedicationRequestService } from './MedicationRequestService';
export { ConditionService } from './ConditionService';
export { DiagnosticReportService } from './DiagnosticReportService';
export { ProcedureService } from './ProcedureService';
export { ObservationService } from './ObservationService';
export { ImmunizationService } from './ImmunizationService';
export { CarePlanService } from './CarePlanService';
export { CareTeamService } from './CareTeamService';
export { PractitionerService } from './PractitionerService';
export { PractitionerRoleService } from './PractitionerRoleService';
export { AllergyIntoleranceService } from './AllergyIntoleranceService';
export { EncounterService } from './EncounterService';
export { DocumentReferenceService } from './DocumentReferenceService';
export { GoalService } from './GoalService';
export { LocationService } from './LocationService';
export { OrganizationService } from './OrganizationService';
export { MedicationService } from './MedicationService';
export { ProvenanceService } from './ProvenanceService';

// WellFit Innovative Services (Differentiators)
export { SDOHService } from './SDOHService';
export { MedicationAffordabilityService } from './MedicationAffordabilityService';
export { CareCoordinationService } from './CareCoordinationService';
export { HealthEquityService } from './HealthEquityService';

// Utility functions
export { normalizeCondition, toFHIRCondition } from './utils/fhirNormalizers';
