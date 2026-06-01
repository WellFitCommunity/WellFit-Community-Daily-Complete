/**
 * Electronic Case Reporting (eCR) Service
 *
 * ONC Criteria: 170.315(f)(3)
 * Purpose: Generate and submit eICR (electronic Initial Case Report) documents
 * to public health agencies via the AIMS (Association of Public Health Laboratories
 * Informatics Messaging Services) platform.
 *
 * Document Standard: HL7 CDA R2 (Clinical Document Architecture)
 * Profile: eICR R3.1 (HL7 Implementation Guide for CDA® R2: Public Health Case Report)
 *
 * Decomposed 2026-06-01 (CLAUDE.md Commandment #12, 600-line limit). The
 * implementation now lives in cohesive modules under ./ecr/*:
 *   - types.ts        record/condition/patient/encounter types + DB row shapes
 *   - constants.ts    eICR template IDs, AIMS config, code systems + OID resolver
 *   - eicrDocument.ts eICR CDA document generation + section builders + formatters
 *   - operations.ts   reportable-condition lookup, case-report create + AIMS submission lifecycle
 * The public type surface, generateEICRDocument, every operation, and the
 * aggregate `ECRService` object are re-exported below — import paths unchanged.
 */

export type {
  ReportableCondition,
  CaseReportTrigger,
  ElectronicCaseReport,
  PatientData,
  EncounterData,
} from './ecr/types';

export { generateEICRDocument } from './ecr/eicrDocument';

export {
  getReportableConditions,
  detectReportableCondition,
  createCaseReport,
  recordSubmissionResult,
  recordReportabilityResponse,
  getPendingReports,
  getCaseReportHistory,
} from './ecr/operations';

import { generateEICRDocument } from './ecr/eicrDocument';
import {
  getReportableConditions,
  detectReportableCondition,
  createCaseReport,
  recordSubmissionResult,
  recordReportabilityResponse,
  getPendingReports,
  getCaseReportHistory,
} from './ecr/operations';

// Export service
export const ECRService = {
  generateEICRDocument,
  getReportableConditions,
  detectReportableCondition,
  createCaseReport,
  recordSubmissionResult,
  recordReportabilityResponse,
  getPendingReports,
  getCaseReportHistory,
};

export default ECRService;
