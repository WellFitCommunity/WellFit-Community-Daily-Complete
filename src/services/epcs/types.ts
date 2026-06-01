/**
 * EPCS — shared types
 *
 * Extracted from epcsService.ts (CLAUDE.md Commandment #12).
 */

export type DEASchedule = 2 | 3 | 4 | 5;

export type TFAMethod = 'hard_token' | 'soft_token' | 'biometric';

export type ProviderStatus = 'pending_verification' | 'active' | 'suspended' | 'revoked' | 'expired';

export type PrescriptionStatus =
  | 'draft'
  | 'pending_pdmp'
  | 'pending_signature'
  | 'signed'
  | 'transmitted'
  | 'filled'
  | 'cancelled'
  | 'expired';

export type TransmissionStatus =
  | 'pending_signature'
  | 'signed'
  | 'transmitted'
  | 'acknowledged'
  | 'error'
  | 'cancelled';

export interface ProviderRegistration {
  id: string;
  tenantId: string;
  providerId: string;
  deaNumber: string;
  deaSuffix?: string;
  deaExpirationDate: Date;
  deaSchedules: number[];
  stateLicenseNumber: string;
  stateLicenseState: string;
  stateLicenseExpiration: Date;
  identityProofingMethod: string;
  identityProofedDate: Date;
  tfaMethod: TFAMethod;
  tfaDeviceSerial?: string;
  tfaEnrollmentDate: Date;
  tfaLastVerified?: Date;
  status: ProviderStatus;
  statusReason?: string;
}

export interface EPCSPrescription {
  id: string;
  tenantId: string;
  prescriptionNumber: string;
  deaUniqueId: string;
  patientId: string;
  prescriberId: string;
  prescriberRegistrationId: string;
  medicationName: string;
  medicationNdc?: string;
  medicationRxnorm?: string;
  deaSchedule: DEASchedule;
  quantity: number;
  quantityUnit: string;
  daysSupply: number;
  refillsAuthorized: number;
  refillsRemaining: number;
  sig: string;
  route?: string;
  frequency?: string;
  diagnosisCode?: string;
  diagnosisDescription?: string;
  pharmacyNcpdpId?: string;
  pharmacyNpi?: string;
  pharmacyName?: string;
  pharmacyAddress?: string;
  digitalSignatureTimestamp?: Date;
  digitalSignatureMethod?: string;
  digitalSignatureVerified: boolean;
  pdmpChecked: boolean;
  pdmpCheckTimestamp?: Date;
  pdmpQueryId?: string;
  pdmpOverrideReason?: string;
  transmissionStatus: TransmissionStatus;
  transmittedAt?: Date;
  acknowledgmentReceivedAt?: Date;
  transmissionError?: string;
  dispensedAt?: Date;
  dispensedQuantity?: number;
  partialFillAllowed: boolean;
  status: PrescriptionStatus;
  cancelledAt?: Date;
  cancelledReason?: string;
  voidedAt?: Date;
  voidReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePrescriptionInput {
  patientId: string;
  prescriberId: string;
  medicationName: string;
  medicationNdc?: string;
  medicationRxnorm?: string;
  deaSchedule: DEASchedule;
  quantity: number;
  quantityUnit: string;
  daysSupply: number;
  refillsAuthorized?: number;
  sig: string;
  route?: string;
  frequency?: string;
  diagnosisCode?: string;
  diagnosisDescription?: string;
  pharmacyNcpdpId?: string;
  pharmacyNpi?: string;
  pharmacyName?: string;
  pharmacyAddress?: string;
  partialFillAllowed?: boolean;
}

export interface SignPrescriptionInput {
  prescriptionId: string;
  userId: string;
  tfaMethod: TFAMethod;
  tfaToken: string;
  tfaTokenSerial?: string;
  ipAddress?: string;
  deviceInfo?: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  eventType: string;
  eventTimestamp: Date;
  userId: string;
  userRole: string;
  prescriptionId?: string;
  patientId?: string;
  eventDetails: Record<string, unknown>;
  success: boolean;
  failureReason?: string;
}

// Database row types
export interface ProviderRegistrationRow {
  id: string;
  tenant_id: string;
  provider_id: string;
  dea_number: string;
  dea_suffix?: string;
  dea_expiration_date: string;
  dea_schedules: number[];
  state_license_number: string;
  state_license_state: string;
  state_license_expiration: string;
  identity_proofing_method: string;
  identity_proofed_date: string;
  tfa_method: string;
  tfa_device_serial?: string;
  tfa_enrollment_date: string;
  tfa_last_verified?: string;
  status: string;
  status_reason?: string;
}

export interface PrescriptionRow {
  id: string;
  tenant_id: string;
  prescription_number: string;
  dea_unique_id: string;
  patient_id: string;
  prescriber_id: string;
  prescriber_registration_id: string;
  medication_name: string;
  medication_ndc?: string;
  medication_rxnorm?: string;
  dea_schedule: number;
  quantity: number;
  quantity_unit: string;
  days_supply: number;
  refills_authorized: number;
  refills_remaining: number;
  sig: string;
  route?: string;
  frequency?: string;
  diagnosis_code?: string;
  diagnosis_description?: string;
  pharmacy_ncpdp_id?: string;
  pharmacy_npi?: string;
  pharmacy_name?: string;
  pharmacy_address?: string;
  digital_signature_timestamp?: string;
  digital_signature_method?: string;
  digital_signature_verified: boolean;
  pdmp_checked: boolean;
  pdmp_check_timestamp?: string;
  pdmp_query_id?: string;
  pdmp_override_reason?: string;
  transmission_status: string;
  transmitted_at?: string;
  acknowledgment_received_at?: string;
  transmission_error?: string;
  dispensed_at?: string;
  dispensed_quantity?: number;
  partial_fill_allowed: boolean;
  status: string;
  cancelled_at?: string;
  cancelled_reason?: string;
  voided_at?: string;
  void_reason?: string;
  created_at: string;
  updated_at: string;
}
