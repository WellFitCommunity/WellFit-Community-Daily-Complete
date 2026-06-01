/**
 * EPCS — constants, DB row mappers, and DEA number validation
 *
 * Extracted from epcsService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — moved verbatim.
 */

import type {
  DEASchedule,
  TFAMethod,
  ProviderStatus,
  PrescriptionStatus,
  TransmissionStatus,
  ProviderRegistration,
  EPCSPrescription,
  ProviderRegistrationRow,
  PrescriptionRow,
} from './types';

export const DEA_SCHEDULE_INFO: Record<DEASchedule, { name: string; refillsAllowed: number }> = {
  2: { name: 'Schedule II', refillsAllowed: 0 },
  3: { name: 'Schedule III', refillsAllowed: 5 },
  4: { name: 'Schedule IV', refillsAllowed: 5 },
  5: { name: 'Schedule V', refillsAllowed: 5 },
};

export function mapProviderRegistration(row: ProviderRegistrationRow): ProviderRegistration {
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

export function mapPrescription(row: PrescriptionRow): EPCSPrescription {
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

export function generatePrescriptionNumber(): string {
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
