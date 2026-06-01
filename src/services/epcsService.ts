/**
 * Electronic Prescribing of Controlled Substances (EPCS) Service
 *
 * ONC Criteria: 170.315(b)(3) - Electronic Prescribing
 * DEA Regulation: 21 CFR Part 1311
 *
 * This service handles DEA-compliant controlled substance prescribing including:
 * - Provider DEA registration and verification
 * - Prescription creation with digital signatures
 * - PDMP check integration
 * - Complete audit trail for DEA compliance
 *
 * Decomposed 2026-06-01 (CLAUDE.md Commandment #12, 600-line limit). The
 * implementation now lives in cohesive modules under ./epcs/*:
 *   - types.ts                domain types + DB row shapes
 *   - helpers.ts              DEA schedule info, row mappers, RX number, DEA-number validation
 *   - providerRegistration.ts get registration + authorization check
 *   - prescriptions.ts        create → PDMP → sign (2FA) → cancel lifecycle
 *   - twoFactor.ts            2FA verification (21 CFR 1311.120)
 *   - audit.ts                DEA-required audit logging + audit-log retrieval
 *   - stats.ts                tenant EPCS statistics
 * Every named export, type, and the aggregate `EPCSService` object are
 * re-exported below, so existing import paths are unchanged — behavior identical.
 */

export type {
  DEASchedule,
  TFAMethod,
  ProviderStatus,
  PrescriptionStatus,
  TransmissionStatus,
  ProviderRegistration,
  EPCSPrescription,
  CreatePrescriptionInput,
  SignPrescriptionInput,
  AuditLogEntry,
  ProviderRegistrationRow,
  PrescriptionRow,
} from './epcs/types';

export { validateDEANumber } from './epcs/helpers';
export { getProviderRegistration, verifyProviderAuthorization } from './epcs/providerRegistration';
export {
  createPrescription,
  getPrescription,
  getPatientPrescriptions,
  recordPDMPCheck,
  signPrescription,
  cancelPrescription,
} from './epcs/prescriptions';
export { getPrescriptionAuditLog } from './epcs/audit';
export { getEPCSStats } from './epcs/stats';

import { validateDEANumber } from './epcs/helpers';
import { getProviderRegistration, verifyProviderAuthorization } from './epcs/providerRegistration';
import {
  createPrescription,
  getPrescription,
  getPatientPrescriptions,
  recordPDMPCheck,
  signPrescription,
  cancelPrescription,
} from './epcs/prescriptions';
import { getPrescriptionAuditLog } from './epcs/audit';
import { getEPCSStats } from './epcs/stats';

// =====================================================
// EXPORTS
// =====================================================

export const EPCSService = {
  // Provider Registration
  getProviderRegistration,
  verifyProviderAuthorization,

  // Prescriptions
  createPrescription,
  getPrescription,
  getPatientPrescriptions,
  recordPDMPCheck,
  signPrescription,
  cancelPrescription,

  // Audit
  getPrescriptionAuditLog,

  // Statistics
  getEPCSStats,

  // Utilities
  validateDEANumber,
};

export default EPCSService;
