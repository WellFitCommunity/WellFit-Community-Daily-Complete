/**
 * Pharmacy Integration (Surescripts, PillPack)
 *
 * Extracted from healthcareIntegrationsService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — service methods + DB mappers moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import type {
  PharmacyConnection,
  EPrescription,
  MedicationHistory,
  RefillRequest,
  CreatePrescriptionRequest,
} from '../../types/healthcareIntegrations';

export class PharmacyIntegrationService {
  /**
   * Get all pharmacy connections for tenant
   */
  static async getConnections(): Promise<ServiceResult<PharmacyConnection[]>> {
    try {
      const { data, error } = await supabase
        .from('pharmacy_connections')
        .select('id, tenant_id, pharmacy_type, pharmacy_name, ncpdp_id, npi, dea_number, address_line1, address_line2, city, state, zip_code, phone, fax, protocol, api_endpoint, supports_erx, supports_refill_requests, supports_medication_history, supports_eligibility, supports_controlled_substances, enabled, is_preferred, last_connected_at, last_error, connection_status, created_at, updated_at, created_by')
        .order('pharmacy_name');

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapPharmacyConnectionFromDB));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get pharmacy connections', err);
    }
  }

  /**
   * Create a new e-prescription
   */
  static async createPrescription(request: CreatePrescriptionRequest): Promise<ServiceResult<EPrescription>> {
    try {
      const internalRxId = `RX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const { data, error } = await supabase
        .from('e_prescriptions')
        .insert({
          patient_id: request.patientId,
          pharmacy_connection_id: request.pharmacyConnectionId,
          internal_rx_id: internalRxId,
          prescriber_npi: request.prescriberNpi,
          prescriber_dea: request.prescriberDea,
          medication_name: request.medicationName,
          medication_ndc: request.medicationNdc,
          rxnorm_code: request.rxnormCode,
          strength: request.strength,
          dosage_form: request.dosageForm,
          quantity: request.quantity,
          quantity_unit: request.quantityUnit || 'EA',
          days_supply: request.daysSupply,
          refills_authorized: request.refillsAuthorized || 0,
          sig: request.sig,
          dispense_as_written: request.dispenseAsWritten || false,
          diagnosis_codes: request.diagnosisCodes,
          is_controlled_substance: request.isControlledSubstance || false,
          schedule: request.schedule,
          rx_status: 'draft',
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('PHARMACY_CREATE_RX_FAILED', error.message);
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('PRESCRIPTION_CREATED', { rxId: data.id, patientId: request.patientId });
      return success(mapPrescriptionFromDB(data));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to create prescription', err);
    }
  }

  /**
   * Get prescriptions for a patient
   */
  static async getPatientPrescriptions(patientId: string, limit = 50): Promise<ServiceResult<EPrescription[]>> {
    try {
      const { data, error } = await supabase
        .from('e_prescriptions')
        .select('id, tenant_id, pharmacy_connection_id, patient_id, prescriber_id, prescriber_npi, prescriber_dea, internal_rx_id, external_rx_id, surescripts_message_id, medication_name, medication_ndc, rxnorm_code, strength, dosage_form, quantity, quantity_unit, days_supply, refills_authorized, refills_remaining, sig, sig_code, dispense_as_written, substitution_allowed, diagnosis_codes, indication, prior_auth_number, is_controlled_substance, schedule, rx_status, written_at, signed_at, transmitted_at, dispensed_at, expires_at, transmission_error, pharmacy_response, created_at, updated_at')
        .eq('patient_id', patientId)
        .order('written_at', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapPrescriptionFromDB));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get patient prescriptions', err);
    }
  }

  /**
   * Get medication history for a patient
   */
  static async getMedicationHistory(patientId: string): Promise<ServiceResult<MedicationHistory[]>> {
    try {
      const { data, error } = await supabase
        .from('medication_history')
        .select('id, tenant_id, patient_id, source, source_pharmacy_name, source_pharmacy_ncpdp, medication_name, ndc, rxnorm_code, strength, dosage_form, fill_date, quantity_dispensed, days_supply, refills_remaining, prescriber_name, prescriber_npi, is_active, discontinued_date, discontinued_reason, fetched_at, created_at')
        .eq('patient_id', patientId)
        .order('fill_date', { ascending: false });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapMedicationHistoryFromDB));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get medication history', err);
    }
  }

  /**
   * Get pending refill requests
   */
  static async getPendingRefillRequests(): Promise<ServiceResult<RefillRequest[]>> {
    try {
      const { data, error } = await supabase
        .from('refill_requests')
        .select('id, tenant_id, patient_id, original_prescription_id, pharmacy_connection_id, medication_name, request_source, request_status, response_prescription_id, response_notes, responded_by, responded_at, requested_at, due_by, created_at, updated_at')
        .eq('request_status', 'pending')
        .order('requested_at', { ascending: true });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapRefillRequestFromDB));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get refill requests', err);
    }
  }

  /**
   * Respond to a refill request
   */
  static async respondToRefillRequest(
    requestId: string,
    status: 'approved' | 'denied' | 'new_rx_needed',
    responseNotes?: string,
    responsePrescriptionId?: string
  ): Promise<ServiceResult<void>> {
    try {
      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('refill_requests')
        .update({
          request_status: status,
          response_notes: responseNotes,
          response_prescription_id: responsePrescriptionId,
          responded_by: user.user?.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('REFILL_REQUEST_RESPONDED', { requestId, status });
      return success(undefined);
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to respond to refill request', err);
    }
  }
}

// ============================================================================
// DATABASE MAPPERS
// ============================================================================

export function mapPharmacyConnectionFromDB(row: Record<string, unknown>): PharmacyConnection {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    pharmacyType: row.pharmacy_type as PharmacyConnection['pharmacyType'],
    pharmacyName: row.pharmacy_name as string,
    ncpdpId: row.ncpdp_id as string | undefined,
    npi: row.npi as string | undefined,
    deaNumber: row.dea_number as string | undefined,
    addressLine1: row.address_line1 as string | undefined,
    addressLine2: row.address_line2 as string | undefined,
    city: row.city as string | undefined,
    state: row.state as string | undefined,
    zipCode: row.zip_code as string | undefined,
    phone: row.phone as string | undefined,
    fax: row.fax as string | undefined,
    protocol: row.protocol as PharmacyConnection['protocol'],
    apiEndpoint: row.api_endpoint as string | undefined,
    supportsErx: row.supports_erx as boolean,
    supportsRefillRequests: row.supports_refill_requests as boolean,
    supportsMedicationHistory: row.supports_medication_history as boolean,
    supportsEligibility: row.supports_eligibility as boolean,
    supportsControlledSubstances: row.supports_controlled_substances as boolean,
    enabled: row.enabled as boolean,
    isPreferred: row.is_preferred as boolean,
    lastConnectedAt: row.last_connected_at as string | undefined,
    lastError: row.last_error as string | undefined,
    connectionStatus: row.connection_status as PharmacyConnection['connectionStatus'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: row.created_by as string | undefined,
  };
}

export function mapPrescriptionFromDB(row: Record<string, unknown>): EPrescription {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    pharmacyConnectionId: row.pharmacy_connection_id as string | undefined,
    patientId: row.patient_id as string,
    prescriberId: row.prescriber_id as string | undefined,
    prescriberNpi: row.prescriber_npi as string,
    prescriberDea: row.prescriber_dea as string | undefined,
    internalRxId: row.internal_rx_id as string,
    externalRxId: row.external_rx_id as string | undefined,
    surescriptsMessageId: row.surescripts_message_id as string | undefined,
    medicationName: row.medication_name as string,
    medicationNdc: row.medication_ndc as string | undefined,
    rxnormCode: row.rxnorm_code as string | undefined,
    strength: row.strength as string | undefined,
    dosageForm: row.dosage_form as string | undefined,
    quantity: row.quantity as number,
    quantityUnit: row.quantity_unit as string,
    daysSupply: row.days_supply as number | undefined,
    refillsAuthorized: row.refills_authorized as number,
    refillsRemaining: row.refills_remaining as number | undefined,
    sig: row.sig as string,
    sigCode: row.sig_code as string | undefined,
    dispenseAsWritten: row.dispense_as_written as boolean,
    substitutionAllowed: row.substitution_allowed as boolean,
    diagnosisCodes: row.diagnosis_codes as string[] | undefined,
    indication: row.indication as string | undefined,
    priorAuthNumber: row.prior_auth_number as string | undefined,
    isControlledSubstance: row.is_controlled_substance as boolean,
    schedule: row.schedule as EPrescription['schedule'],
    rxStatus: row.rx_status as EPrescription['rxStatus'],
    writtenAt: row.written_at as string,
    signedAt: row.signed_at as string | undefined,
    transmittedAt: row.transmitted_at as string | undefined,
    dispensedAt: row.dispensed_at as string | undefined,
    expiresAt: row.expires_at as string | undefined,
    transmissionError: row.transmission_error as string | undefined,
    pharmacyResponse: row.pharmacy_response as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapMedicationHistoryFromDB(row: Record<string, unknown>): MedicationHistory {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    patientId: row.patient_id as string,
    source: row.source as MedicationHistory['source'],
    sourcePharmacyName: row.source_pharmacy_name as string | undefined,
    sourcePharmacyNcpdp: row.source_pharmacy_ncpdp as string | undefined,
    medicationName: row.medication_name as string,
    ndc: row.ndc as string | undefined,
    rxnormCode: row.rxnorm_code as string | undefined,
    strength: row.strength as string | undefined,
    dosageForm: row.dosage_form as string | undefined,
    fillDate: row.fill_date as string | undefined,
    quantityDispensed: row.quantity_dispensed as number | undefined,
    daysSupply: row.days_supply as number | undefined,
    refillsRemaining: row.refills_remaining as number | undefined,
    prescriberName: row.prescriber_name as string | undefined,
    prescriberNpi: row.prescriber_npi as string | undefined,
    isActive: row.is_active as boolean,
    discontinuedDate: row.discontinued_date as string | undefined,
    discontinuedReason: row.discontinued_reason as string | undefined,
    fetchedAt: row.fetched_at as string,
    createdAt: row.created_at as string,
  };
}

export function mapRefillRequestFromDB(row: Record<string, unknown>): RefillRequest {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    patientId: row.patient_id as string,
    originalPrescriptionId: row.original_prescription_id as string | undefined,
    pharmacyConnectionId: row.pharmacy_connection_id as string | undefined,
    medicationName: row.medication_name as string,
    requestSource: row.request_source as RefillRequest['requestSource'],
    requestStatus: row.request_status as RefillRequest['requestStatus'],
    responsePrescriptionId: row.response_prescription_id as string | undefined,
    responseNotes: row.response_notes as string | undefined,
    respondedBy: row.responded_by as string | undefined,
    respondedAt: row.responded_at as string | undefined,
    requestedAt: row.requested_at as string,
    dueBy: row.due_by as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
