/**
 * Immunization Registry Service
 *
 * ONC Criteria: 170.315(f)(1)
 * Purpose: Generate and transmit HL7 VXU (Vaccination Update) messages
 * to state immunization information systems (IIS)
 *
 * Target: Texas ImmTrac2 (DSHS Immunization Registry)
 *
 * NOTE: Decomposed into `immunization-registry/` modules (god-file rule, CLAUDE.md #12).
 * This file is the barrel that preserves every original import path + the aggregate
 * `ImmunizationRegistryService` object. No behavior changed — modules are verbatim moves.
 */

// Types
export type {
  ImmunizationRecord,
  ImmunizationPatientData,
  ImmunizationSubmission,
  FacilityData,
  RegistryConfig,
  SubmissionRow,
} from './immunization-registry/types';

// HL7 VXU message generation
export { generateVXUMessage } from './immunization-registry/vxuMessage';

// Service operations
import {
  submitImmunization,
  recordSubmissionResult,
  getPatientSubmissionHistory,
  getPendingSubmissions,
  getCVXVaccineName,
  getMVXManufacturerName,
} from './immunization-registry/operations';
import { generateVXUMessage } from './immunization-registry/vxuMessage';

export {
  submitImmunization,
  recordSubmissionResult,
  getPatientSubmissionHistory,
  getPendingSubmissions,
  getCVXVaccineName,
  getMVXManufacturerName,
};

// Export service (aggregate object — preserves existing default + named usage)
export const ImmunizationRegistryService = {
  generateVXUMessage,
  submitImmunization,
  recordSubmissionResult,
  getPatientSubmissionHistory,
  getPendingSubmissions,
  getCVXVaccineName,
  getMVXManufacturerName,
};

export default ImmunizationRegistryService;
