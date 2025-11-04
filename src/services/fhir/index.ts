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

// Utility functions
export { normalizeCondition, toFHIRCondition } from './utils/fhirNormalizers';
