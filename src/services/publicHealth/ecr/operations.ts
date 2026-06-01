/**
 * Electronic Case Reporting (eCR) — database operations + AIMS submission lifecycle
 *
 * Extracted from ecrService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — service functions moved verbatim.
 */

import { supabase } from '../../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../../_base';
import { auditLogger } from '../../auditLogger';
import type {
  ReportableCondition,
  CaseReportTrigger,
  ElectronicCaseReport,
  PatientData,
  EncounterData,
  FacilityData,
  ReportableConditionRow,
  CaseReportRow,
} from './types';
import { AIMS_CONFIG } from './constants';
import { generateEICRDocument, generateDocumentId } from './eicrDocument';

/**
 * Get all active reportable conditions
 */
export async function getReportableConditions(
  jurisdiction?: string
): Promise<ServiceResult<ReportableCondition[]>> {
  try {
    let query = supabase
      .from('reportable_conditions')
      .select('id, condition_code, condition_code_system, condition_name, rckms_oid, reporting_jurisdiction, reporting_timeframe, is_nationally_notifiable, condition_category, trigger_codes, is_active')
      .eq('is_active', true);

    if (jurisdiction) {
      query = query.contains('reporting_jurisdiction', [jurisdiction]);
    }

    const { data, error } = await query.order('condition_name');

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const conditions: ReportableCondition[] = ((data || []) as ReportableConditionRow[]).map((row: ReportableConditionRow) => ({
      id: row.id,
      conditionCode: row.condition_code,
      conditionCodeSystem: row.condition_code_system,
      conditionName: row.condition_name,
      rckmsOid: row.rckms_oid,
      reportingJurisdiction: row.reporting_jurisdiction,
      reportingTimeframe: row.reporting_timeframe,
      isNationallyNotifiable: row.is_nationally_notifiable,
      conditionCategory: row.condition_category,
      triggerCodes: row.trigger_codes,
    }));

    return success(conditions);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECR_GET_CONDITIONS_FAILED',
      err instanceof Error ? err : new Error(String(err))
    );
    return failure('FETCH_FAILED', 'Failed to get reportable conditions');
  }
}

/**
 * Detect if a diagnosis code triggers a reportable condition
 */
export async function detectReportableCondition(
  diagnosisCode: string,
  jurisdiction = 'TX'
): Promise<ServiceResult<ReportableCondition | null>> {
  try {
    const { data, error } = await supabase
      .from('reportable_conditions')
      .select('id, condition_code, condition_code_system, condition_name, rckms_oid, reporting_jurisdiction, reporting_timeframe, is_nationally_notifiable, condition_category, trigger_codes')
      .eq('is_active', true)
      .contains('trigger_codes', [diagnosisCode])
      .contains('reporting_jurisdiction', [jurisdiction]);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    if (!data || data.length === 0) {
      return success(null);
    }

    const row = data[0] as ReportableConditionRow;
    return success({
      id: row.id,
      conditionCode: row.condition_code,
      conditionCodeSystem: row.condition_code_system,
      conditionName: row.condition_name,
      rckmsOid: row.rckms_oid,
      reportingJurisdiction: row.reporting_jurisdiction,
      reportingTimeframe: row.reporting_timeframe,
      isNationallyNotifiable: row.is_nationally_notifiable,
      conditionCategory: row.condition_category,
      triggerCodes: row.trigger_codes,
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'ECR_DETECT_CONDITION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { diagnosisCode }
    );
    return failure('OPERATION_FAILED', 'Failed to detect reportable condition');
  }
}

/**
 * Create and save an electronic case report
 */
export async function createCaseReport(
  tenantId: string,
  trigger: CaseReportTrigger,
  condition: ReportableCondition,
  patient: PatientData,
  encounter: EncounterData,
  facility: FacilityData
): Promise<ServiceResult<ElectronicCaseReport>> {
  try {
    // Generate eICR document
    const eicrDocument = generateEICRDocument({
      trigger,
      condition,
      patient,
      encounter,
      facility,
    });

    const eicrDocumentId = generateDocumentId();

    // Save case report
    const { data, error } = await supabase
      .from('electronic_case_reports')
      .insert({
        tenant_id: tenantId,
        patient_id: patient.patientId,
        trigger_encounter_id: trigger.encounterId,
        trigger_condition_id: condition.id,
        trigger_type: trigger.type,
        trigger_code: trigger.code,
        trigger_description: trigger.description,
        trigger_date: trigger.triggerDate.toISOString(),
        report_type: 'initial',
        eicr_document_id: eicrDocumentId,
        eicr_version: '3.1',
        eicr_document: eicrDocument,
        destination: AIMS_CONFIG.name,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('ECR_CASE_REPORT_CREATED', {
      tenantId,
      reportId: data.id,
      conditionName: condition.conditionName,
      patientId: patient.patientId,
    });

    return success({
      id: data.id,
      tenantId: data.tenant_id,
      patientId: data.patient_id,
      triggerEncounterId: data.trigger_encounter_id,
      triggerConditionId: data.trigger_condition_id,
      triggerType: data.trigger_type,
      triggerCode: data.trigger_code,
      triggerDescription: data.trigger_description,
      triggerDate: new Date(data.trigger_date),
      reportType: 'initial',
      eicrDocumentId: data.eicr_document_id,
      eicrVersion: data.eicr_version,
      eicrDocument: data.eicr_document,
      destination: data.destination,
      status: 'pending',
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'ECR_CREATE_REPORT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId: patient.patientId }
    );
    return failure('OPERATION_FAILED', 'Failed to create case report');
  }
}

/**
 * Record AIMS submission result
 */
export async function recordSubmissionResult(
  reportId: string,
  result: {
    success: boolean;
    aimsTransactionId?: string;
    errorCode?: string;
    errorMessage?: string;
  }
): Promise<ServiceResult<void>> {
  try {
    const status = result.success ? 'submitted' : 'rejected';

    const { error } = await supabase
      .from('electronic_case_reports')
      .update({
        status,
        submitted_at: new Date().toISOString(),
        aims_transaction_id: result.aimsTransactionId,
        error_code: result.errorCode,
        error_message: result.errorMessage,
      })
      .eq('id', reportId);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('ECR_SUBMISSION_RESULT', {
      reportId,
      status,
      aimsTransactionId: result.aimsTransactionId,
    });

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECR_RECORD_RESULT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { reportId }
    );
    return failure('OPERATION_FAILED', 'Failed to record submission result');
  }
}

/**
 * Record Reportability Response (RR)
 */
export async function recordReportabilityResponse(
  reportId: string,
  response: {
    rrDocument: string;
    determination: string;
    routingEntities: string[];
  }
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('electronic_case_reports')
      .update({
        status: 'rr_received',
        rr_received_at: new Date().toISOString(),
        rr_document: response.rrDocument,
        rr_determination: response.determination,
        rr_routing_entities: response.routingEntities,
      })
      .eq('id', reportId);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('ECR_RR_RECEIVED', {
      reportId,
      determination: response.determination,
      routingEntities: response.routingEntities,
    });

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECR_RECORD_RR_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { reportId }
    );
    return failure('OPERATION_FAILED', 'Failed to record reportability response');
  }
}

/**
 * Get pending case reports
 */
export async function getPendingReports(
  tenantId: string,
  limit = 100
): Promise<ServiceResult<ElectronicCaseReport[]>> {
  try {
    const { data, error } = await supabase
      .from('electronic_case_reports')
      .select('id, tenant_id, patient_id, trigger_encounter_id, trigger_condition_id, trigger_type, trigger_code, trigger_description, trigger_date, report_type, eicr_document_id, eicr_version, eicr_document, destination, aims_transaction_id, status, submitted_at, error_message')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const reports: ElectronicCaseReport[] = ((data || []) as CaseReportRow[]).map((row: CaseReportRow) => ({
      id: row.id,
      tenantId: row.tenant_id,
      patientId: row.patient_id,
      triggerEncounterId: row.trigger_encounter_id,
      triggerConditionId: row.trigger_condition_id,
      triggerType: row.trigger_type,
      triggerCode: row.trigger_code,
      triggerDescription: row.trigger_description,
      triggerDate: new Date(row.trigger_date),
      reportType: row.report_type as 'initial' | 'update' | 'cancel',
      eicrDocumentId: row.eicr_document_id,
      eicrVersion: row.eicr_version,
      eicrDocument: row.eicr_document,
      destination: row.destination,
      aimsTransactionId: row.aims_transaction_id,
      status: row.status as ElectronicCaseReport['status'],
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
      errorMessage: row.error_message,
    }));

    return success(reports);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECR_GET_PENDING_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to get pending reports');
  }
}

/**
 * Get case report history
 */
export async function getCaseReportHistory(
  tenantId: string,
  options?: {
    patientId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<ServiceResult<ElectronicCaseReport[]>> {
  try {
    let query = supabase
      .from('electronic_case_reports')
      .select('id, tenant_id, patient_id, trigger_encounter_id, trigger_condition_id, trigger_type, trigger_code, trigger_description, trigger_date, report_type, eicr_document_id, eicr_version, eicr_document, destination, aims_transaction_id, status, submitted_at, rr_received_at, rr_document, rr_determination, rr_routing_entities, error_message')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.patientId) {
      query = query.eq('patient_id', options.patientId);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.startDate) {
      query = query.gte('trigger_date', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('trigger_date', options.endDate.toISOString());
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const reports: ElectronicCaseReport[] = ((data || []) as CaseReportRow[]).map((row: CaseReportRow) => ({
      id: row.id,
      tenantId: row.tenant_id,
      patientId: row.patient_id,
      triggerEncounterId: row.trigger_encounter_id,
      triggerConditionId: row.trigger_condition_id,
      triggerType: row.trigger_type,
      triggerCode: row.trigger_code,
      triggerDescription: row.trigger_description,
      triggerDate: new Date(row.trigger_date),
      reportType: row.report_type as 'initial' | 'update' | 'cancel',
      eicrDocumentId: row.eicr_document_id,
      eicrVersion: row.eicr_version,
      eicrDocument: row.eicr_document,
      destination: row.destination,
      aimsTransactionId: row.aims_transaction_id,
      status: row.status as ElectronicCaseReport['status'],
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
      rrReceivedAt: row.rr_received_at ? new Date(row.rr_received_at) : undefined,
      rrDocument: row.rr_document,
      rrDetermination: row.rr_determination,
      rrRoutingEntities: row.rr_routing_entities,
      errorMessage: row.error_message,
    }));

    return success(reports);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECR_GET_HISTORY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to get case report history');
  }
}
