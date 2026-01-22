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
 */

import { supabase } from '../lib/supabaseClient';
import { ServiceResult, success, failure } from './_base';
import { auditLogger } from './auditLogger';

// =====================================================
// TYPES
// =====================================================

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
interface ProviderRegistrationRow {
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

interface PrescriptionRow {
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

// =====================================================
// CONSTANTS
// =====================================================

const DEA_SCHEDULE_INFO: Record<DEASchedule, { name: string; refillsAllowed: number }> = {
  2: { name: 'Schedule II', refillsAllowed: 0 },
  3: { name: 'Schedule III', refillsAllowed: 5 },
  4: { name: 'Schedule IV', refillsAllowed: 5 },
  5: { name: 'Schedule V', refillsAllowed: 5 },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function mapProviderRegistration(row: ProviderRegistrationRow): ProviderRegistration {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    providerId: row.provider_id,
    deaNumber: row.dea_number,
    deaSuffix: row.dea_suffix,
    deaExpirationDate: new Date(row.dea_expiration_date),
    deaSchedules: row.dea_schedules,
    stateLicenseNumber: row.state_license_number,
    stateLicenseState: row.state_license_state,
    stateLicenseExpiration: new Date(row.state_license_expiration),
    identityProofingMethod: row.identity_proofing_method,
    identityProofedDate: new Date(row.identity_proofed_date),
    tfaMethod: row.tfa_method as TFAMethod,
    tfaDeviceSerial: row.tfa_device_serial,
    tfaEnrollmentDate: new Date(row.tfa_enrollment_date),
    tfaLastVerified: row.tfa_last_verified ? new Date(row.tfa_last_verified) : undefined,
    status: row.status as ProviderStatus,
    statusReason: row.status_reason,
  };
}

function mapPrescription(row: PrescriptionRow): EPCSPrescription {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    prescriptionNumber: row.prescription_number,
    deaUniqueId: row.dea_unique_id,
    patientId: row.patient_id,
    prescriberId: row.prescriber_id,
    prescriberRegistrationId: row.prescriber_registration_id,
    medicationName: row.medication_name,
    medicationNdc: row.medication_ndc,
    medicationRxnorm: row.medication_rxnorm,
    deaSchedule: row.dea_schedule as DEASchedule,
    quantity: row.quantity,
    quantityUnit: row.quantity_unit,
    daysSupply: row.days_supply,
    refillsAuthorized: row.refills_authorized,
    refillsRemaining: row.refills_remaining,
    sig: row.sig,
    route: row.route,
    frequency: row.frequency,
    diagnosisCode: row.diagnosis_code,
    diagnosisDescription: row.diagnosis_description,
    pharmacyNcpdpId: row.pharmacy_ncpdp_id,
    pharmacyNpi: row.pharmacy_npi,
    pharmacyName: row.pharmacy_name,
    pharmacyAddress: row.pharmacy_address,
    digitalSignatureTimestamp: row.digital_signature_timestamp
      ? new Date(row.digital_signature_timestamp)
      : undefined,
    digitalSignatureMethod: row.digital_signature_method,
    digitalSignatureVerified: row.digital_signature_verified,
    pdmpChecked: row.pdmp_checked,
    pdmpCheckTimestamp: row.pdmp_check_timestamp
      ? new Date(row.pdmp_check_timestamp)
      : undefined,
    pdmpQueryId: row.pdmp_query_id,
    pdmpOverrideReason: row.pdmp_override_reason,
    transmissionStatus: row.transmission_status as TransmissionStatus,
    transmittedAt: row.transmitted_at ? new Date(row.transmitted_at) : undefined,
    acknowledgmentReceivedAt: row.acknowledgment_received_at
      ? new Date(row.acknowledgment_received_at)
      : undefined,
    transmissionError: row.transmission_error,
    dispensedAt: row.dispensed_at ? new Date(row.dispensed_at) : undefined,
    dispensedQuantity: row.dispensed_quantity,
    partialFillAllowed: row.partial_fill_allowed,
    status: row.status as PrescriptionStatus,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
    cancelledReason: row.cancelled_reason,
    voidedAt: row.voided_at ? new Date(row.voided_at) : undefined,
    voidReason: row.void_reason,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function generatePrescriptionNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RX${timestamp}${random}`;
}

/**
 * Validate DEA number format and checksum
 */
export function validateDEANumber(deaNumber: string): boolean {
  // DEA format: 2 letters + 7 digits
  if (!/^[A-Z]{2}\d{7}$/.test(deaNumber)) {
    return false;
  }

  const letters = deaNumber.substring(0, 2);
  const digits = deaNumber.substring(2);

  // First letter must be valid registrant type
  const validFirstLetters = 'ABCDEFGHJKLMPRSTUX';
  if (!validFirstLetters.includes(letters[0])) {
    return false;
  }

  // Calculate checksum
  const sum =
    parseInt(digits[0]) +
    parseInt(digits[2]) +
    parseInt(digits[4]) +
    2 * (parseInt(digits[1]) + parseInt(digits[3]) + parseInt(digits[5]));

  const checkDigit = sum % 10;

  return checkDigit === parseInt(digits[6]);
}

// =====================================================
// PROVIDER REGISTRATION
// =====================================================

/**
 * Get provider's EPCS registration
 */
export async function getProviderRegistration(
  tenantId: string,
  providerId: string
): Promise<ServiceResult<ProviderRegistration | null>> {
  try {
    const { data, error } = await supabase
      .from('epcs_provider_registrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider_id', providerId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', error.message);
    }

    return success(data ? mapProviderRegistration(data) : null);
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_REGISTRATION_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, providerId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch provider registration');
  }
}

/**
 * Verify provider is authorized to prescribe a specific schedule
 */
export async function verifyProviderAuthorization(
  tenantId: string,
  providerId: string,
  schedule: DEASchedule
): Promise<ServiceResult<{ authorized: boolean; reason?: string; registration?: ProviderRegistration }>> {
  try {
    const regResult = await getProviderRegistration(tenantId, providerId);
    if (!regResult.success) {
      return failure(regResult.error?.code || 'FETCH_FAILED', regResult.error?.message || 'Failed to fetch registration');
    }

    if (!regResult.data) {
      return success({
        authorized: false,
        reason: 'Provider is not registered for EPCS',
      });
    }

    const registration = regResult.data;

    // Check status
    if (registration.status !== 'active') {
      return success({
        authorized: false,
        reason: `Provider registration is ${registration.status}`,
        registration,
      });
    }

    // Check DEA expiration
    if (new Date() > registration.deaExpirationDate) {
      return success({
        authorized: false,
        reason: 'DEA registration has expired',
        registration,
      });
    }

    // Check state license expiration
    if (new Date() > registration.stateLicenseExpiration) {
      return success({
        authorized: false,
        reason: 'State license has expired',
        registration,
      });
    }

    // Check schedule authorization
    if (!registration.deaSchedules.includes(schedule)) {
      return success({
        authorized: false,
        reason: `Provider is not authorized for Schedule ${schedule}`,
        registration,
      });
    }

    return success({
      authorized: true,
      registration,
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_AUTHORIZATION_CHECK_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, providerId, schedule }
    );
    return failure('OPERATION_FAILED', 'Failed to verify provider authorization');
  }
}

// =====================================================
// PRESCRIPTION MANAGEMENT
// =====================================================

/**
 * Create a new controlled substance prescription (draft)
 */
export async function createPrescription(
  tenantId: string,
  input: CreatePrescriptionInput
): Promise<ServiceResult<EPCSPrescription>> {
  try {
    // Verify provider authorization
    const authResult = await verifyProviderAuthorization(
      tenantId,
      input.prescriberId,
      input.deaSchedule
    );

    if (!authResult.success) {
      return failure(authResult.error?.code || 'AUTHORIZATION_FAILED', authResult.error?.message || 'Authorization check failed');
    }

    if (!authResult.data.authorized || !authResult.data.registration) {
      return failure('UNAUTHORIZED', authResult.data.reason || 'Provider not authorized');
    }

    // Validate refills (Schedule II cannot have refills)
    const maxRefills = DEA_SCHEDULE_INFO[input.deaSchedule].refillsAllowed;
    const refillsAuthorized = Math.min(input.refillsAuthorized || 0, maxRefills);

    // Generate prescription number
    const prescriptionNumber = generatePrescriptionNumber();

    // Create prescription
    const { data, error } = await supabase
      .from('epcs_prescriptions')
      .insert({
        tenant_id: tenantId,
        prescription_number: prescriptionNumber,
        patient_id: input.patientId,
        prescriber_id: input.prescriberId,
        prescriber_registration_id: authResult.data.registration.id,
        medication_name: input.medicationName,
        medication_ndc: input.medicationNdc,
        medication_rxnorm: input.medicationRxnorm,
        dea_schedule: input.deaSchedule,
        quantity: input.quantity,
        quantity_unit: input.quantityUnit,
        days_supply: input.daysSupply,
        refills_authorized: refillsAuthorized,
        refills_remaining: refillsAuthorized,
        sig: input.sig,
        route: input.route,
        frequency: input.frequency,
        diagnosis_code: input.diagnosisCode,
        diagnosis_description: input.diagnosisDescription,
        pharmacy_ncpdp_id: input.pharmacyNcpdpId,
        pharmacy_npi: input.pharmacyNpi,
        pharmacy_name: input.pharmacyName,
        pharmacy_address: input.pharmacyAddress,
        partial_fill_allowed: input.partialFillAllowed || false,
        status: 'draft',
        transmission_status: 'pending_signature',
      })
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const prescription = mapPrescription(data);

    // Log audit event
    await logAuditEvent(tenantId, {
      eventType: 'prescription_created',
      userId: input.prescriberId,
      userRole: 'prescriber',
      prescriptionId: prescription.id,
      patientId: input.patientId,
      eventDetails: {
        medicationName: input.medicationName,
        deaSchedule: input.deaSchedule,
        quantity: input.quantity,
        daysSupply: input.daysSupply,
      },
      success: true,
    });

    await auditLogger.info('EPCS_PRESCRIPTION_CREATED', {
      tenantId,
      prescriptionId: prescription.id,
      patientId: input.patientId,
      prescriberId: input.prescriberId,
      deaSchedule: input.deaSchedule,
    });

    return success(prescription);
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_PRESCRIPTION_CREATE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId: input.patientId }
    );
    return failure('OPERATION_FAILED', 'Failed to create prescription');
  }
}

/**
 * Get a prescription by ID
 */
export async function getPrescription(
  tenantId: string,
  prescriptionId: string
): Promise<ServiceResult<EPCSPrescription | null>> {
  try {
    const { data, error } = await supabase
      .from('epcs_prescriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', prescriptionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', error.message);
    }

    return success(data ? mapPrescription(data) : null);
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_PRESCRIPTION_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, prescriptionId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch prescription');
  }
}

/**
 * Get prescriptions for a patient
 */
export async function getPatientPrescriptions(
  tenantId: string,
  patientId: string,
  options?: { status?: PrescriptionStatus[]; limit?: number }
): Promise<ServiceResult<EPCSPrescription[]>> {
  try {
    let query = supabase
      .from('epcs_prescriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (options?.status && options.status.length > 0) {
      query = query.in('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    return success((data || []).map(mapPrescription));
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_PATIENT_PRESCRIPTIONS_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch patient prescriptions');
  }
}

/**
 * Update prescription status after PDMP check
 */
export async function recordPDMPCheck(
  tenantId: string,
  prescriptionId: string,
  pdmpQueryId: string,
  override?: { reason: string; overriddenBy: string }
): Promise<ServiceResult<EPCSPrescription>> {
  try {
    const updateData: Record<string, unknown> = {
      pdmp_checked: true,
      pdmp_check_timestamp: new Date().toISOString(),
      pdmp_query_id: pdmpQueryId,
      status: 'pending_signature',
    };

    if (override) {
      updateData.pdmp_override_reason = override.reason;
    }

    const { data, error } = await supabase
      .from('epcs_prescriptions')
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('id', prescriptionId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const prescription = mapPrescription(data);

    // Log audit event
    await logAuditEvent(tenantId, {
      eventType: 'pdmp_checked',
      userId: override?.overriddenBy || 'system',
      userRole: override ? 'prescriber' : 'system',
      prescriptionId: prescription.id,
      patientId: prescription.patientId,
      eventDetails: {
        pdmpQueryId,
        override: override ? true : false,
        overrideReason: override?.reason,
      },
      success: true,
    });

    return success(prescription);
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_PDMP_RECORD_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, prescriptionId }
    );
    return failure('OPERATION_FAILED', 'Failed to record PDMP check');
  }
}

/**
 * Sign a prescription with two-factor authentication
 * This is the critical DEA compliance step (21 CFR 1311.120)
 */
export async function signPrescription(
  tenantId: string,
  input: SignPrescriptionInput
): Promise<ServiceResult<EPCSPrescription>> {
  try {
    // Get prescription
    const rxResult = await getPrescription(tenantId, input.prescriptionId);
    if (!rxResult.success || !rxResult.data) {
      return failure('NOT_FOUND', 'Prescription not found');
    }

    const prescription = rxResult.data;

    // Validate prescription state
    if (prescription.status !== 'pending_signature' && prescription.status !== 'pending_pdmp') {
      return failure('VALIDATION_ERROR', `Cannot sign prescription in status: ${prescription.status}`);
    }

    // Verify PDMP was checked (required by most states)
    if (!prescription.pdmpChecked && !prescription.pdmpOverrideReason) {
      return failure('VALIDATION_ERROR', 'PDMP check required before signing');
    }

    // Verify TFA (in production, this would call the actual 2FA provider)
    const tfaValid = await verifyTwoFactorAuth(
      tenantId,
      input.userId,
      input.tfaMethod,
      input.tfaToken
    );

    if (!tfaValid.success || !tfaValid.data.valid) {
      await logAuditEvent(tenantId, {
        eventType: 'signature_failed',
        userId: input.userId,
        userRole: 'prescriber',
        prescriptionId: prescription.id,
        patientId: prescription.patientId,
        eventDetails: {
          tfaMethod: input.tfaMethod,
          reason: tfaValid.data?.reason || 'TFA verification failed',
        },
        success: false,
        failureReason: tfaValid.data?.reason || 'TFA verification failed',
      });

      return failure('UNAUTHORIZED', 'Two-factor authentication failed');
    }

    // Update prescription with signature
    const { data, error } = await supabase
      .from('epcs_prescriptions')
      .update({
        digital_signature_timestamp: new Date().toISOString(),
        digital_signature_method: input.tfaMethod,
        digital_signature_verified: true,
        status: 'signed',
        transmission_status: 'signed',
      })
      .eq('tenant_id', tenantId)
      .eq('id', input.prescriptionId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const signedPrescription = mapPrescription(data);

    // Update provider's last TFA verification
    await supabase
      .from('epcs_provider_registrations')
      .update({ tfa_last_verified: new Date().toISOString() })
      .eq('id', prescription.prescriberRegistrationId);

    // Log audit event
    await logAuditEvent(tenantId, {
      eventType: 'prescription_signed',
      userId: input.userId,
      userRole: 'prescriber',
      prescriptionId: signedPrescription.id,
      patientId: signedPrescription.patientId,
      eventDetails: {
        signatureTimestamp: signedPrescription.digitalSignatureTimestamp,
        tfaMethod: input.tfaMethod,
        tfaTokenSerial: input.tfaTokenSerial,
        ipAddress: input.ipAddress,
      },
      signatureMethod: input.tfaMethod,
      tfaTokenSerial: input.tfaTokenSerial,
      success: true,
    });

    await auditLogger.info('EPCS_PRESCRIPTION_SIGNED', {
      tenantId,
      prescriptionId: signedPrescription.id,
      prescriberId: input.userId,
      deaSchedule: signedPrescription.deaSchedule,
    });

    return success(signedPrescription);
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_PRESCRIPTION_SIGN_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, prescriptionId: input.prescriptionId }
    );
    return failure('OPERATION_FAILED', 'Failed to sign prescription');
  }
}

/**
 * Cancel a prescription
 */
export async function cancelPrescription(
  tenantId: string,
  prescriptionId: string,
  cancelledBy: string,
  reason: string
): Promise<ServiceResult<EPCSPrescription>> {
  try {
    const rxResult = await getPrescription(tenantId, prescriptionId);
    if (!rxResult.success || !rxResult.data) {
      return failure('NOT_FOUND', 'Prescription not found');
    }

    const prescription = rxResult.data;

    // Cannot cancel already dispensed prescriptions
    if (prescription.status === 'filled') {
      return failure('VALIDATION_ERROR', 'Cannot cancel a filled prescription');
    }

    const { data, error } = await supabase
      .from('epcs_prescriptions')
      .update({
        status: 'cancelled',
        transmission_status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: reason,
        cancelled_by: cancelledBy,
      })
      .eq('tenant_id', tenantId)
      .eq('id', prescriptionId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const cancelledPrescription = mapPrescription(data);

    // Log audit event
    await logAuditEvent(tenantId, {
      eventType: 'prescription_cancelled',
      userId: cancelledBy,
      userRole: 'prescriber',
      prescriptionId: cancelledPrescription.id,
      patientId: cancelledPrescription.patientId,
      eventDetails: { reason },
      success: true,
    });

    return success(cancelledPrescription);
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_PRESCRIPTION_CANCEL_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, prescriptionId }
    );
    return failure('OPERATION_FAILED', 'Failed to cancel prescription');
  }
}

// =====================================================
// TWO-FACTOR AUTHENTICATION
// =====================================================

/**
 * Verify two-factor authentication
 * In production, this would integrate with the actual 2FA provider (RSA, Symantec, etc.)
 */
async function verifyTwoFactorAuth(
  tenantId: string,
  userId: string,
  method: TFAMethod,
  token: string
): Promise<ServiceResult<{ valid: boolean; reason?: string }>> {
  try {
    // Get provider registration to verify TFA is set up
    const { data: registration, error } = await supabase
      .from('epcs_provider_registrations')
      .select('tfa_method, tfa_device_serial')
      .eq('tenant_id', tenantId)
      .eq('provider_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !registration) {
      return success({ valid: false, reason: 'Provider not registered for EPCS' });
    }

    // Verify method matches registration
    if (registration.tfa_method !== method) {
      return success({
        valid: false,
        reason: `TFA method mismatch. Expected: ${registration.tfa_method}`,
      });
    }

    // In production, call actual TFA provider API here
    // For now, simulate validation (token must be 6+ digits)
    if (!/^\d{6,8}$/.test(token)) {
      return success({ valid: false, reason: 'Invalid token format' });
    }

    // Simulate successful verification
    return success({ valid: true });
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_TFA_VERIFICATION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, userId, method }
    );
    return failure('UNAUTHORIZED', 'TFA verification failed');
  }
}

// =====================================================
// AUDIT LOGGING
// =====================================================

/**
 * Log an EPCS audit event (DEA requirement)
 */
async function logAuditEvent(
  tenantId: string,
  event: {
    eventType: string;
    userId: string;
    userRole: string;
    prescriptionId?: string;
    patientId?: string;
    eventDetails: Record<string, unknown>;
    signatureMethod?: string;
    tfaTokenSerial?: string;
    success: boolean;
    failureReason?: string;
    ipAddress?: string;
    deviceInfo?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.from('epcs_audit_log').insert({
      tenant_id: tenantId,
      event_type: event.eventType,
      event_timestamp: new Date().toISOString(),
      user_id: event.userId,
      user_role: event.userRole,
      prescription_id: event.prescriptionId,
      patient_id: event.patientId,
      event_details: event.eventDetails,
      signature_method: event.signatureMethod,
      tfa_token_serial: event.tfaTokenSerial,
      success: event.success,
      failure_reason: event.failureReason,
      user_ip_address: event.ipAddress,
      user_device_info: event.deviceInfo,
    });
  } catch (err: unknown) {
    // Don't fail the main operation if audit logging fails
    // but do log it for investigation
    await auditLogger.error(
      'EPCS_AUDIT_LOG_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, eventType: event.eventType }
    );
  }
}

/**
 * Get audit log for a prescription
 */
export async function getPrescriptionAuditLog(
  tenantId: string,
  prescriptionId: string
): Promise<ServiceResult<AuditLogEntry[]>> {
  try {
    const { data, error } = await supabase
      .from('epcs_audit_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('prescription_id', prescriptionId)
      .order('event_timestamp', { ascending: true });

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const entries: AuditLogEntry[] = (data || []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      eventType: row.event_type,
      eventTimestamp: new Date(row.event_timestamp),
      userId: row.user_id,
      userRole: row.user_role,
      prescriptionId: row.prescription_id,
      patientId: row.patient_id,
      eventDetails: row.event_details,
      success: row.success,
      failureReason: row.failure_reason,
    }));

    return success(entries);
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_AUDIT_LOG_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, prescriptionId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch audit log');
  }
}

// =====================================================
// STATISTICS
// =====================================================

/**
 * Get EPCS statistics for a tenant
 */
export async function getEPCSStats(
  tenantId: string,
  options?: { startDate?: Date; endDate?: Date }
): Promise<ServiceResult<{
  totalPrescriptions: number;
  bySchedule: Record<number, number>;
  byStatus: Record<string, number>;
  signedCount: number;
  cancelledCount: number;
}>> {
  try {
    let query = supabase
      .from('epcs_prescriptions')
      .select('dea_schedule, status')
      .eq('tenant_id', tenantId);

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const prescriptions = data || [];

    const bySchedule: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 };
    const byStatus: Record<string, number> = {};

    for (const rx of prescriptions) {
      bySchedule[rx.dea_schedule] = (bySchedule[rx.dea_schedule] || 0) + 1;
      byStatus[rx.status] = (byStatus[rx.status] || 0) + 1;
    }

    return success({
      totalPrescriptions: prescriptions.length,
      bySchedule,
      byStatus,
      signedCount: byStatus['signed'] || 0 + (byStatus['transmitted'] || 0) + (byStatus['filled'] || 0),
      cancelledCount: byStatus['cancelled'] || 0,
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_STATS_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch EPCS statistics');
  }
}

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
