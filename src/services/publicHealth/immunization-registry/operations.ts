/**
 * Immunization Registry — Service operations
 *
 * Persistence + lifecycle for VXU submissions to the state IIS.
 * Extracted verbatim from immunizationRegistryService.ts (god-file decomposition).
 */

import { supabase } from '../../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../../_base';
import { auditLogger } from '../../auditLogger';
import type {
  ImmunizationRecord,
  ImmunizationPatientData,
  ImmunizationSubmission,
  FacilityData,
  SubmissionRow,
} from './types';
import { TX_IMMTRAC2_CONFIG, CVX_VACCINE_NAMES, MVX_MANUFACTURERS } from './constants';
import { generateMessageControlId } from './helpers';
import { generateVXUMessage } from './vxuMessage';

/**
 * Submit immunization to registry
 */
export async function submitImmunization(
  tenantId: string,
  immunization: ImmunizationRecord,
  patient: ImmunizationPatientData,
  facility: FacilityData
): Promise<ServiceResult<ImmunizationSubmission>> {
  try {
    // Generate VXU message
    const hl7Message = generateVXUMessage({
      immunization,
      patient,
      facility,
    });

    const messageControlId = generateMessageControlId();

    // Save submission record
    const { data, error } = await supabase
      .from('immunization_registry_submissions')
      .insert({
        tenant_id: tenantId,
        patient_id: patient.patientId,
        immunization_id: immunization.id,
        vaccine_cvx_code: immunization.vaccineCvxCode,
        vaccine_name: immunization.vaccineName,
        administration_date: immunization.administrationDate.toISOString().split('T')[0],
        lot_number: immunization.lotNumber,
        expiration_date: immunization.expirationDate?.toISOString().split('T')[0],
        manufacturer_mvx_code: immunization.manufacturerMvxCode,
        administered_by_npi: immunization.administeredByNpi,
        administration_site: immunization.administrationSite,
        administration_route: immunization.administrationRoute,
        dose_number: immunization.doseNumber,
        series_name: immunization.seriesName,
        registry_name: TX_IMMTRAC2_CONFIG.name,
        registry_endpoint: TX_IMMTRAC2_CONFIG.endpoint,
        message_type: 'VXU_V04',
        message_control_id: messageControlId,
        hl7_message: hl7Message,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('IMMUNIZATION_SUBMISSION_CREATED', {
      tenantId,
      submissionId: data.id,
      patientId: patient.patientId,
      vaccineCvx: immunization.vaccineCvxCode,
    });

    return success({
      id: data.id,
      tenantId: data.tenant_id,
      patientId: data.patient_id,
      immunizationId: data.immunization_id,
      vaccineCvxCode: data.vaccine_cvx_code,
      vaccineName: data.vaccine_name,
      administrationDate: new Date(data.administration_date),
      registryName: data.registry_name,
      messageControlId: data.message_control_id,
      hl7Message: data.hl7_message,
      status: 'pending',
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'IMMUNIZATION_SUBMISSION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId: patient.patientId }
    );
    return failure('OPERATION_FAILED', 'Failed to submit immunization');
  }
}

/**
 * Record submission result (registry response)
 */
export async function recordSubmissionResult(
  submissionId: string,
  result: {
    success: boolean;
    responseCode?: string;
    responseMessage?: string;
    errorCode?: string;
    errorMessage?: string;
  }
): Promise<ServiceResult<void>> {
  try {
    const status = result.success ? 'accepted' : 'rejected';

    const { error } = await supabase
      .from('immunization_registry_submissions')
      .update({
        status,
        sent_at: new Date().toISOString(),
        response_received_at: new Date().toISOString(),
        response_code: result.responseCode,
        response_message: result.responseMessage,
        error_code: result.errorCode,
        error_message: result.errorMessage,
      })
      .eq('id', submissionId);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('IMMUNIZATION_SUBMISSION_RESULT', {
      submissionId,
      status,
      responseCode: result.responseCode,
    });

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'IMMUNIZATION_RECORD_RESULT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { submissionId }
    );
    return failure('OPERATION_FAILED', 'Failed to record submission result');
  }
}

/**
 * Get submission history for a patient
 */
export async function getPatientSubmissionHistory(
  tenantId: string,
  patientId: string,
  limit = 50
): Promise<ServiceResult<ImmunizationSubmission[]>> {
  try {
    const { data, error } = await supabase
      .from('immunization_registry_submissions')
      .select('id, tenant_id, patient_id, immunization_id, vaccine_cvx_code, vaccine_name, administration_date, registry_name, message_control_id, hl7_message, status, sent_at, response_code, response_message, error_message')
      .eq('tenant_id', tenantId)
      .eq('patient_id', patientId)
      .order('administration_date', { ascending: false })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const submissions: ImmunizationSubmission[] = ((data || []) as SubmissionRow[]).map((row: SubmissionRow) => ({
      id: row.id,
      tenantId: row.tenant_id,
      patientId: row.patient_id,
      immunizationId: row.immunization_id,
      vaccineCvxCode: row.vaccine_cvx_code,
      vaccineName: row.vaccine_name,
      administrationDate: new Date(row.administration_date),
      registryName: row.registry_name,
      messageControlId: row.message_control_id,
      hl7Message: row.hl7_message,
      status: row.status as ImmunizationSubmission['status'],
      sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
      responseCode: row.response_code,
      responseMessage: row.response_message,
      errorMessage: row.error_message,
    }));

    return success(submissions);
  } catch (err: unknown) {
    await auditLogger.error(
      'IMMUNIZATION_GET_HISTORY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId }
    );
    return failure('FETCH_FAILED', 'Failed to get submission history');
  }
}

/**
 * Get pending submissions
 */
export async function getPendingSubmissions(
  tenantId: string,
  limit = 100
): Promise<ServiceResult<ImmunizationSubmission[]>> {
  try {
    const { data, error } = await supabase
      .from('immunization_registry_submissions')
      .select('id, tenant_id, patient_id, immunization_id, vaccine_cvx_code, vaccine_name, administration_date, registry_name, message_control_id, hl7_message, status, sent_at, response_code, response_message, error_message')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const submissions: ImmunizationSubmission[] = ((data || []) as SubmissionRow[]).map((row: SubmissionRow) => ({
      id: row.id,
      tenantId: row.tenant_id,
      patientId: row.patient_id,
      immunizationId: row.immunization_id,
      vaccineCvxCode: row.vaccine_cvx_code,
      vaccineName: row.vaccine_name,
      administrationDate: new Date(row.administration_date),
      registryName: row.registry_name,
      messageControlId: row.message_control_id,
      hl7Message: row.hl7_message,
      status: 'pending',
    }));

    return success(submissions);
  } catch (err: unknown) {
    await auditLogger.error(
      'IMMUNIZATION_GET_PENDING_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to get pending submissions');
  }
}

/**
 * Get CVX code information
 */
export function getCVXVaccineName(cvxCode: string): string | null {
  return CVX_VACCINE_NAMES[cvxCode] || null;
}

/**
 * Get MVX manufacturer name
 */
export function getMVXManufacturerName(mvxCode: string): string | null {
  return MVX_MANUFACTURERS[mvxCode] || null;
}
