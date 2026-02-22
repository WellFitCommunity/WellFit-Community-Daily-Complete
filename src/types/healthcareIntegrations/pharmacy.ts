/**
 * Healthcare Integrations — Pharmacy
 *
 * Types for pharmacy integrations: Surescripts, PillPack, CVS, Walgreens, etc.
 * Covers pharmacy connections, e-prescriptions, medication history, and refill requests.
 */

import type { BaseConnection } from './common';

// ============================================================================
// PHARMACY INTEGRATION
// ============================================================================

export type PharmacyType =
  | 'SURESCRIPTS'
  | 'PILLPACK'
  | 'CVS'
  | 'WALGREENS'
  | 'LOCAL'
  | 'MAIL_ORDER'
  | 'SPECIALTY'
  | 'CUSTOM';

export type PharmacyProtocol = 'NCPDP_SCRIPT' | 'FHIR' | 'API' | 'FAX' | 'MANUAL';

export interface PharmacyConnection extends BaseConnection {
  pharmacyType: PharmacyType;
  pharmacyName: string;
  ncpdpId?: string;
  npi?: string;
  deaNumber?: string;

  // Contact info
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  fax?: string;

  // Integration settings
  protocol: PharmacyProtocol;
  apiEndpoint?: string;

  // Capabilities
  supportsErx: boolean;
  supportsRefillRequests: boolean;
  supportsMedicationHistory: boolean;
  supportsEligibility: boolean;
  supportsControlledSubstances: boolean;

  // Settings
  isPreferred: boolean;
}

export type PrescriptionStatus =
  | 'draft'
  | 'pending_review'
  | 'signed'
  | 'transmitted'
  | 'dispensed'
  | 'partially_filled'
  | 'cancelled'
  | 'expired'
  | 'transfer_out'
  | 'error';

export type ControlledSubstanceSchedule = 'II' | 'III' | 'IV' | 'V';

export interface EPrescription {
  id: string;
  tenantId: string;
  pharmacyConnectionId?: string;

  // Patient
  patientId: string;

  // Prescriber
  prescriberId?: string;
  prescriberNpi: string;
  prescriberDea?: string;

  // Prescription identification
  internalRxId: string;
  externalRxId?: string;
  surescriptsMessageId?: string;

  // Medication details
  medicationName: string;
  medicationNdc?: string;
  rxnormCode?: string;
  strength?: string;
  dosageForm?: string;

  // Prescription details
  quantity: number;
  quantityUnit: string;
  daysSupply?: number;
  refillsAuthorized: number;
  refillsRemaining?: number;

  // Instructions
  sig: string;
  sigCode?: string;

  // Dispensing
  dispenseAsWritten: boolean;
  substitutionAllowed: boolean;

  // Clinical info
  diagnosisCodes?: string[];
  indication?: string;
  priorAuthNumber?: string;

  // Controlled substance info
  isControlledSubstance: boolean;
  schedule?: ControlledSubstanceSchedule;

  // Status
  rxStatus: PrescriptionStatus;

  // Timing
  writtenAt: string;
  signedAt?: string;
  transmittedAt?: string;
  dispensedAt?: string;
  expiresAt?: string;

  // Errors
  transmissionError?: string;
  pharmacyResponse?: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}

export type MedicationHistorySource = 'SURESCRIPTS' | 'PBM' | 'PATIENT_REPORTED' | 'FHIR' | 'MANUAL';

export interface MedicationHistory {
  id: string;
  tenantId: string;
  patientId: string;

  // Source
  source: MedicationHistorySource;
  sourcePharmacyName?: string;
  sourcePharmacyNcpdp?: string;

  // Medication
  medicationName: string;
  ndc?: string;
  rxnormCode?: string;
  strength?: string;
  dosageForm?: string;

  // Fill details
  fillDate?: string;
  quantityDispensed?: number;
  daysSupply?: number;
  refillsRemaining?: number;

  // Prescriber
  prescriberName?: string;
  prescriberNpi?: string;

  // Status
  isActive: boolean;
  discontinuedDate?: string;
  discontinuedReason?: string;

  fetchedAt: string;
  createdAt: string;
}

export type RefillRequestSource = 'PHARMACY' | 'PATIENT' | 'AUTOMATED';

export type RefillRequestStatus = 'pending' | 'approved' | 'denied' | 'new_rx_needed' | 'expired';

export interface RefillRequest {
  id: string;
  tenantId: string;
  patientId: string;
  originalPrescriptionId?: string;
  pharmacyConnectionId?: string;

  // Request details
  medicationName: string;
  requestSource: RefillRequestSource;

  // Status
  requestStatus: RefillRequestStatus;

  // Response
  responsePrescriptionId?: string;
  responseNotes?: string;
  respondedBy?: string;
  respondedAt?: string;

  // Timing
  requestedAt: string;
  dueBy?: string;

  createdAt: string;
  updatedAt: string;
}
