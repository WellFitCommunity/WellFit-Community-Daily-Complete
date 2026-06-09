/**
 * Syndromic Surveillance Service
 *
 * ONC Criteria: 170.315(f)(2)
 * Purpose: Generate and transmit HL7 ADT messages to public health agencies
 * for real-time syndromic surveillance (emergency department, urgent care visits)
 *
 * Target: Texas DSHS (Department of State Health Services)
 *
 * NOTE: Decomposed into `syndromic-surveillance/` modules (god-file rule, CLAUDE.md #12).
 * This file is the barrel that preserves every original import path + the aggregate
 * `SyndromicSurveillanceService` object. No behavior changed — modules are verbatim moves.
 */

// Types
export type {
  SyndromicEncounter,
  SyndromicPatientData,
  SyndromicTransmission,
  ADTMessageOptions,
  FacilityData,
  TransmissionConfig,
  EncounterRow,
  TransmissionRow,
} from './syndromic-surveillance/types';

// HL7 ADT message generation + surveillance category
export { generateADTMessage } from './syndromic-surveillance/adtMessage';
export { determineSurveillanceCategory } from './syndromic-surveillance/helpers';

// Service operations
import { generateADTMessage } from './syndromic-surveillance/adtMessage';
import { determineSurveillanceCategory } from './syndromic-surveillance/helpers';
import {
  flagEncounterForSurveillance,
  getPendingEncounters,
  createTransmission,
  recordTransmissionResult,
  getTransmissionHistory,
  getSurveillanceStats,
} from './syndromic-surveillance/operations';

export {
  flagEncounterForSurveillance,
  getPendingEncounters,
  createTransmission,
  recordTransmissionResult,
  getTransmissionHistory,
  getSurveillanceStats,
};

// Export service (aggregate object — preserves existing default + named usage)
export const SyndromicSurveillanceService = {
  generateADTMessage,
  determineSurveillanceCategory,
  flagEncounterForSurveillance,
  getPendingEncounters,
  createTransmission,
  recordTransmissionResult,
  getTransmissionHistory,
  getSurveillanceStats,
};

export default SyndromicSurveillanceService;
