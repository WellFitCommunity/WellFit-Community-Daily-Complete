/**
 * EPCS — controlled-substance prescription lifecycle
 * (create → PDMP check → sign with 2FA → cancel)
 *
 * Extracted from epcsService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import type {
  EPCSPrescription,
  CreatePrescriptionInput,
  SignPrescriptionInput,
  PrescriptionStatus,
} from './types';
import { DEA_SCHEDULE_INFO, mapPrescription, generatePrescriptionNumber } from './helpers';
import { verifyProviderAuthorization } from './providerRegistration';
import { verifyTwoFactorAuth } from './twoFactor';
import { logAuditEvent } from './audit';

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
      .select('id, tenant_id, prescription_number, dea_unique_id, patient_id, prescriber_id, prescriber_registration_id, medication_name, medication_ndc, medication_rxnorm, dea_schedule, quantity, quantity_unit, days_supply, refills_authorized, refills_remaining, sig, route, frequency, diagnosis_code, diagnosis_description, pharmacy_ncpdp_id, pharmacy_npi, pharmacy_name, pharmacy_address, digital_signature_timestamp, digital_signature_method, digital_signature_verified, pdmp_checked, pdmp_check_timestamp, pdmp_query_id, pdmp_override_reason, transmission_status, transmitted_at, acknowledgment_received_at, transmission_error, dispensed_at, dispensed_quantity, partial_fill_allowed, status, cancelled_at, cancelled_reason, voided_at, void_reason, created_at, updated_at')
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
      .select('id, tenant_id, prescription_number, dea_unique_id, patient_id, prescriber_id, prescriber_registration_id, medication_name, medication_ndc, medication_rxnorm, dea_schedule, quantity, quantity_unit, days_supply, refills_authorized, refills_remaining, sig, route, frequency, diagnosis_code, diagnosis_description, pharmacy_ncpdp_id, pharmacy_npi, pharmacy_name, pharmacy_address, digital_signature_timestamp, digital_signature_method, digital_signature_verified, pdmp_checked, pdmp_check_timestamp, pdmp_query_id, pdmp_override_reason, transmission_status, transmitted_at, acknowledgment_received_at, transmission_error, dispensed_at, dispensed_quantity, partial_fill_allowed, status, cancelled_at, cancelled_reason, voided_at, void_reason, created_at, updated_at')
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
