/**
 * Insurance Verification (X12 270/271 Eligibility)
 *
 * Extracted from healthcareIntegrationsService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — service methods + DB mappers moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import type {
  InsurancePayerConnection,
  EligibilityRequest,
  PatientInsurance,
  CheckEligibilityRequest,
} from '../../types/healthcareIntegrations';

export class InsuranceVerificationService {
  /**
   * Get all insurance payer connections
   */
  static async getPayerConnections(): Promise<ServiceResult<InsurancePayerConnection[]>> {
    try {
      const { data, error } = await supabase
        .from('insurance_payer_connections')
        .select('id, tenant_id, payer_id, payer_name, payer_type, edi_receiver_id, edi_interchange_qualifier, connection_type, clearinghouse_name, clearinghouse_id, api_endpoint, portal_url, supports_270_271, supports_276_277, supports_278, supports_835, supports_837, supports_real_time, batch_schedule, enabled, last_connected_at, last_error, connection_status, created_at, updated_at, created_by')
        .order('payer_name');

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapInsurancePayerFromDB));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get payer connections', err);
    }
  }

  /**
   * Check eligibility for a patient
   */
  static async checkEligibility(request: CheckEligibilityRequest): Promise<ServiceResult<EligibilityRequest>> {
    try {
      const { data: user } = await supabase.auth.getUser();
      const traceNumber = `TRN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const { data, error } = await supabase
        .from('eligibility_requests')
        .insert({
          patient_id: request.patientId,
          payer_connection_id: request.payerConnectionId,
          subscriber_id: request.subscriberId,
          subscriber_name: request.subscriberName,
          subscriber_dob: request.subscriberDob,
          is_dependent: request.isDependent || false,
          dependent_name: request.dependentName,
          dependent_dob: request.dependentDob,
          relationship_code: request.relationshipCode,
          service_type_codes: request.serviceTypeCodes,
          date_of_service: request.dateOfService,
          provider_npi: request.providerNpi,
          trace_number: traceNumber,
          request_status: 'pending',
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('ELIGIBILITY_CHECK_FAILED', error.message);
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('ELIGIBILITY_CHECK_INITIATED', { requestId: data.id, patientId: request.patientId });
      return success(mapEligibilityRequestFromDB(data));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to check eligibility', err);
    }
  }

  /**
   * Get eligibility requests for a patient
   */
  static async getPatientEligibilityHistory(patientId: string, limit = 20): Promise<ServiceResult<EligibilityRequest[]>> {
    try {
      const { data, error } = await supabase
        .from('eligibility_requests')
        .select('id, tenant_id, payer_connection_id, patient_id, subscriber_id, subscriber_name, subscriber_dob, is_dependent, dependent_name, dependent_dob, relationship_code, service_type_codes, date_of_service, provider_npi, provider_taxonomy, request_status, trace_number, submitter_trace, requested_at, submitted_at, response_received_at, response_id, error_code, error_message, created_at, created_by')
        .eq('patient_id', patientId)
        .order('requested_at', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapEligibilityRequestFromDB));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get eligibility history', err);
    }
  }

  /**
   * Get patient's active insurance
   */
  static async getPatientInsurance(patientId: string): Promise<ServiceResult<PatientInsurance[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_patient_active_insurance', { p_patient_id: patientId });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      // Map from RPC function result
      return success(data.map((row: Record<string, unknown>) => ({
        id: row.insurance_id as string,
        tenantId: '',
        patientId,
        payerConnectionId: undefined,
        payerId: '',
        payerName: row.payer_name as string,
        subscriberId: row.subscriber_id as string,
        groupNumber: row.group_number as string | undefined,
        groupName: undefined,
        subscriberRelationship: 'SELF' as const,
        planName: row.plan_name as string | undefined,
        planType: undefined,
        effectiveDate: '',
        coveragePriority: row.coverage_priority as number,
        lastVerifiedAt: row.last_verified_at as string | undefined,
        verificationStatus: row.verification_status as 'unverified' | 'verified' | 'needs_review' | 'inactive',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      })));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get patient insurance', err);
    }
  }

  /**
   * Add or update patient insurance
   */
  static async savePatientInsurance(insurance: Partial<PatientInsurance>): Promise<ServiceResult<PatientInsurance>> {
    try {
      const { data: user } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('patient_insurance')
        .upsert({
          id: insurance.id,
          patient_id: insurance.patientId,
          payer_connection_id: insurance.payerConnectionId,
          payer_id: insurance.payerId,
          payer_name: insurance.payerName,
          subscriber_id: insurance.subscriberId,
          group_number: insurance.groupNumber,
          group_name: insurance.groupName,
          subscriber_relationship: insurance.subscriberRelationship,
          subscriber_name: insurance.subscriberName,
          subscriber_dob: insurance.subscriberDob,
          plan_name: insurance.planName,
          plan_type: insurance.planType,
          effective_date: insurance.effectiveDate,
          termination_date: insurance.terminationDate,
          coverage_priority: insurance.coveragePriority,
          is_active: insurance.isActive ?? true,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('PATIENT_INSURANCE_SAVED', { insuranceId: data.id, patientId: insurance.patientId });
      return success(mapPatientInsuranceFromDB(data));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to save patient insurance', err);
    }
  }
}

// ============================================================================
// DATABASE MAPPERS
// ============================================================================

export function mapInsurancePayerFromDB(row: Record<string, unknown>): InsurancePayerConnection {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    payerId: row.payer_id as string,
    payerName: row.payer_name as string,
    payerType: row.payer_type as InsurancePayerConnection['payerType'],
    ediReceiverId: row.edi_receiver_id as string | undefined,
    ediInterchangeQualifier: row.edi_interchange_qualifier as string | undefined,
    connectionType: row.connection_type as InsurancePayerConnection['connectionType'],
    clearinghouseName: row.clearinghouse_name as string | undefined,
    clearinghouseId: row.clearinghouse_id as string | undefined,
    apiEndpoint: row.api_endpoint as string | undefined,
    portalUrl: row.portal_url as string | undefined,
    supports270_271: row.supports_270_271 as boolean,
    supports276_277: row.supports_276_277 as boolean,
    supports278: row.supports_278 as boolean,
    supports835: row.supports_835 as boolean,
    supports837: row.supports_837 as boolean,
    supportsRealTime: row.supports_real_time as boolean,
    batchSchedule: row.batch_schedule as string | undefined,
    enabled: row.enabled as boolean,
    lastConnectedAt: row.last_connected_at as string | undefined,
    lastError: row.last_error as string | undefined,
    connectionStatus: row.connection_status as InsurancePayerConnection['connectionStatus'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: row.created_by as string | undefined,
  };
}

export function mapEligibilityRequestFromDB(row: Record<string, unknown>): EligibilityRequest {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    payerConnectionId: row.payer_connection_id as string | undefined,
    patientId: row.patient_id as string,
    subscriberId: row.subscriber_id as string,
    subscriberName: row.subscriber_name as string | undefined,
    subscriberDob: row.subscriber_dob as string | undefined,
    isDependent: row.is_dependent as boolean,
    dependentName: row.dependent_name as string | undefined,
    dependentDob: row.dependent_dob as string | undefined,
    relationshipCode: row.relationship_code as string | undefined,
    serviceTypeCodes: row.service_type_codes as string[] | undefined,
    dateOfService: row.date_of_service as string,
    providerNpi: row.provider_npi as string | undefined,
    providerTaxonomy: row.provider_taxonomy as string | undefined,
    requestStatus: row.request_status as EligibilityRequest['requestStatus'],
    traceNumber: row.trace_number as string | undefined,
    submitterTrace: row.submitter_trace as string | undefined,
    requestedAt: row.requested_at as string,
    submittedAt: row.submitted_at as string | undefined,
    responseReceivedAt: row.response_received_at as string | undefined,
    responseId: row.response_id as string | undefined,
    errorCode: row.error_code as string | undefined,
    errorMessage: row.error_message as string | undefined,
    createdAt: row.created_at as string,
    createdBy: row.created_by as string | undefined,
  };
}

export function mapPatientInsuranceFromDB(row: Record<string, unknown>): PatientInsurance {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    patientId: row.patient_id as string,
    payerConnectionId: row.payer_connection_id as string | undefined,
    payerId: row.payer_id as string,
    payerName: row.payer_name as string,
    subscriberId: row.subscriber_id as string,
    groupNumber: row.group_number as string | undefined,
    groupName: row.group_name as string | undefined,
    subscriberRelationship: row.subscriber_relationship as PatientInsurance['subscriberRelationship'],
    subscriberName: row.subscriber_name as string | undefined,
    subscriberDob: row.subscriber_dob as string | undefined,
    planName: row.plan_name as string | undefined,
    planType: row.plan_type as string | undefined,
    effectiveDate: row.effective_date as string,
    terminationDate: row.termination_date as string | undefined,
    coveragePriority: row.coverage_priority as number,
    lastVerifiedAt: row.last_verified_at as string | undefined,
    lastVerificationRequestId: row.last_verification_request_id as string | undefined,
    verificationStatus: row.verification_status as PatientInsurance['verificationStatus'],
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: row.created_by as string | undefined,
  };
}
