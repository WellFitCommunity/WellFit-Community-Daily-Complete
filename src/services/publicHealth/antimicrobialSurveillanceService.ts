/**
 * Antimicrobial Use & Resistance (AU/AR) Surveillance Service
 *
 * ONC Criteria: 170.315(f)(4)
 * Purpose: Track antimicrobial usage and resistance patterns,
 * generate NHSN CDA documents for CDC reporting.
 *
 * Target: CDC National Healthcare Safety Network (NHSN)
 *
 * Decomposed 2026-06-01 (CLAUDE.md Commandment #12, 600-line limit). The
 * implementation now lives in cohesive modules under ./antimicrobial-surveillance/*:
 *   - types.ts        record/submission interfaces + DB row shapes
 *   - constants.ts    NHSN config, antimicrobial classes, MDRO types, code systems + classification accessors
 *   - cdaDocuments.ts NHSN CDA (AU/AR) document generation + HL7/XML formatters
 *   - operations.ts   record usage/resistance, create submission, record result, history
 * Every named export, type, and the aggregate `AntimicrobialSurveillanceService`
 * object are re-exported below, so existing import paths are unchanged.
 */

export type {
  AntimicrobialUsageRecord,
  AntimicrobialResistanceRecord,
  NHSNSubmission,
  FacilityData,
  UsageRow,
  ResistanceRow,
  SubmissionRow,
} from './antimicrobial-surveillance/types';

export {
  NHSN_CONFIG,
  ANTIMICROBIAL_CLASSES,
  MDRO_TYPES,
  CODE_SYSTEMS,
  classifyAntimicrobial,
  getMDROTypes,
  getAntimicrobialClasses,
} from './antimicrobial-surveillance/constants';

export { generateAUDocument, generateARDocument } from './antimicrobial-surveillance/cdaDocuments';

export {
  recordAntimicrobialUsage,
  recordResistance,
  createNHSNSubmission,
  recordSubmissionResult,
  getSubmissionHistory,
} from './antimicrobial-surveillance/operations';

import {
  classifyAntimicrobial,
  getMDROTypes,
  getAntimicrobialClasses,
} from './antimicrobial-surveillance/constants';
import { generateAUDocument, generateARDocument } from './antimicrobial-surveillance/cdaDocuments';
import {
  recordAntimicrobialUsage,
  recordResistance,
  createNHSNSubmission,
  recordSubmissionResult,
  getSubmissionHistory,
} from './antimicrobial-surveillance/operations';

// Export service
export const AntimicrobialSurveillanceService = {
  generateAUDocument,
  generateARDocument,
  classifyAntimicrobial,
  recordAntimicrobialUsage,
  recordResistance,
  createNHSNSubmission,
  recordSubmissionResult,
  getSubmissionHistory,
  getMDROTypes,
  getAntimicrobialClasses,
};

export default AntimicrobialSurveillanceService;
