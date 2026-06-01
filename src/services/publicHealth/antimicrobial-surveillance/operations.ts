/**
 * Antimicrobial Surveillance — database operations
 *
 * Extracted from antimicrobialSurveillanceService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — service functions moved verbatim.
 */

import { supabase } from '../../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../../_base';
import { auditLogger } from '../../auditLogger';
import type {
  AntimicrobialUsageRecord,
  AntimicrobialResistanceRecord,
  NHSNSubmission,
  FacilityData,
  UsageRow,
  ResistanceRow,
  SubmissionRow,
} from './types';
import { classifyAntimicrobial } from './constants';
import { generateAUDocument, generateARDocument } from './cdaDocuments';

/**
 * Record antimicrobial usage
 */
export async function recordAntimicrobialUsage(
  tenantId: string,
  usage: Omit<AntimicrobialUsageRecord, 'id' | 'tenantId' | 'includedInNhsnReport' | 'nhsnSubmissionId'>
): Promise<ServiceResult<{ id: string }>> {
  try {
    // Auto-classify if not provided
    const antimicrobialClass = usage.antimicrobialClass || classifyAntimicrobial(usage.medicationName) || 'Other';

    const { data, error } = await supabase
      .from('antimicrobial_usage')
      .insert({
        tenant_id: tenantId,
        patient_id: usage.patientId,
        encounter_id: usage.encounterId,
        medication_code: usage.medicationCode,
        medication_code_system: usage.medicationCodeSystem,
        medication_name: usage.medicationName,
        antimicrobial_class: antimicrobialClass,
        antimicrobial_subclass: usage.antimicrobialSubclass,
        dose_quantity: usage.doseQuantity,
        dose_unit: usage.doseUnit,
        route: usage.route,
        frequency: usage.frequency,
        duration_days: usage.durationDays,
        indication_code: usage.indicationCode,
        indication_description: usage.indicationDescription,
        prescriber_npi: usage.prescriberNpi,
        prescribed_date: usage.prescribedDate.toISOString().split('T')[0],
        start_date: usage.startDate?.toISOString().split('T')[0],
        end_date: usage.endDate?.toISOString().split('T')[0],
        therapy_type: usage.therapyType,
        included_in_nhsn_report: false,
      })
      .select('id')
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('ANTIMICROBIAL_USAGE_RECORDED', {
      tenantId,
      usageId: data.id,
      medicationName: usage.medicationName,
      antimicrobialClass,
    });

    return success({ id: data.id });
  } catch (err: unknown) {
    await auditLogger.error(
      'ANTIMICROBIAL_USAGE_RECORD_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('OPERATION_FAILED', 'Failed to record antimicrobial usage');
  }
}

/**
 * Record antimicrobial resistance result
 */
export async function recordResistance(
  tenantId: string,
  resistance: Omit<AntimicrobialResistanceRecord, 'id' | 'tenantId' | 'includedInNhsnReport' | 'nhsnSubmissionId'>
): Promise<ServiceResult<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('antimicrobial_resistance')
      .insert({
        tenant_id: tenantId,
        patient_id: resistance.patientId,
        encounter_id: resistance.encounterId,
        specimen_id: resistance.specimenId,
        specimen_type: resistance.specimenType,
        specimen_collection_date: resistance.specimenCollectionDate.toISOString(),
        specimen_source: resistance.specimenSource,
        organism_code: resistance.organismCode,
        organism_code_system: resistance.organismCodeSystem,
        organism_name: resistance.organismName,
        antimicrobial_tested: resistance.antimicrobialTested,
        antimicrobial_code: resistance.antimicrobialCode,
        interpretation: resistance.interpretation,
        mic_value: resistance.micValue,
        mic_unit: resistance.micUnit,
        is_mdro: resistance.isMdro,
        mdro_type: resistance.mdroType,
        lab_name: resistance.labName,
        lab_npi: resistance.labNpi,
        result_date: resistance.resultDate?.toISOString().split('T')[0],
        included_in_nhsn_report: false,
      })
      .select('id')
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('ANTIMICROBIAL_RESISTANCE_RECORDED', {
      tenantId,
      resistanceId: data.id,
      organismName: resistance.organismName,
      interpretation: resistance.interpretation,
      isMdro: resistance.isMdro,
    });

    return success({ id: data.id });
  } catch (err: unknown) {
    await auditLogger.error(
      'ANTIMICROBIAL_RESISTANCE_RECORD_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('OPERATION_FAILED', 'Failed to record resistance');
  }
}

/**
 * Create NHSN submission
 */
export async function createNHSNSubmission(
  tenantId: string,
  submissionType: 'AU' | 'AR',
  reportingPeriodStart: Date,
  reportingPeriodEnd: Date,
  facility: FacilityData
): Promise<ServiceResult<NHSNSubmission>> {
  try {
    let cdaDocument: string;
    let usageRecordCount = 0;
    let resistanceRecordCount = 0;

    if (submissionType === 'AU') {
      // Get usage records for period
      const { data: usageData, error: usageError } = await supabase
        .from('antimicrobial_usage')
        .select('id, tenant_id, patient_id, encounter_id, medication_code, medication_code_system, medication_name, antimicrobial_class, antimicrobial_subclass, dose_quantity, dose_unit, route, frequency, duration_days, indication_code, indication_description, prescriber_npi, prescribed_date, start_date, end_date, therapy_type, included_in_nhsn_report, nhsn_submission_id')
        .eq('tenant_id', tenantId)
        .eq('included_in_nhsn_report', false)
        .gte('prescribed_date', reportingPeriodStart.toISOString().split('T')[0])
        .lte('prescribed_date', reportingPeriodEnd.toISOString().split('T')[0]);

      if (usageError) {
        return failure('DATABASE_ERROR', usageError.message);
      }

      const usageRecords: AntimicrobialUsageRecord[] = ((usageData || []) as UsageRow[]).map((row: UsageRow) => ({
        id: row.id,
        tenantId: row.tenant_id,
        patientId: row.patient_id,
        encounterId: row.encounter_id,
        medicationCode: row.medication_code,
        medicationCodeSystem: row.medication_code_system,
        medicationName: row.medication_name,
        antimicrobialClass: row.antimicrobial_class,
        antimicrobialSubclass: row.antimicrobial_subclass,
        doseQuantity: row.dose_quantity,
        doseUnit: row.dose_unit,
        route: row.route,
        frequency: row.frequency,
        durationDays: row.duration_days,
        indicationCode: row.indication_code,
        indicationDescription: row.indication_description,
        prescriberNpi: row.prescriber_npi,
        prescribedDate: new Date(row.prescribed_date),
        startDate: row.start_date ? new Date(row.start_date) : undefined,
        endDate: row.end_date ? new Date(row.end_date) : undefined,
        therapyType: row.therapy_type as 'empiric' | 'targeted' | 'prophylaxis',
        includedInNhsnReport: false,
      }));

      usageRecordCount = usageRecords.length;
      cdaDocument = generateAUDocument({
        usageRecords,
        facility,
        reportingPeriodStart,
        reportingPeriodEnd,
      });
    } else {
      // Get resistance records for period
      const { data: resistanceData, error: resistanceError } = await supabase
        .from('antimicrobial_resistance')
        .select('id, tenant_id, patient_id, encounter_id, specimen_id, specimen_type, specimen_collection_date, specimen_source, organism_code, organism_code_system, organism_name, antimicrobial_tested, antimicrobial_code, interpretation, mic_value, mic_unit, is_mdro, mdro_type, lab_name, lab_npi, result_date, included_in_nhsn_report, nhsn_submission_id')
        .eq('tenant_id', tenantId)
        .eq('included_in_nhsn_report', false)
        .gte('specimen_collection_date', reportingPeriodStart.toISOString())
        .lte('specimen_collection_date', reportingPeriodEnd.toISOString());

      if (resistanceError) {
        return failure('DATABASE_ERROR', resistanceError.message);
      }

      const resistanceRecords: AntimicrobialResistanceRecord[] = ((resistanceData || []) as ResistanceRow[]).map((row: ResistanceRow) => ({
        id: row.id,
        tenantId: row.tenant_id,
        patientId: row.patient_id,
        encounterId: row.encounter_id,
        specimenId: row.specimen_id,
        specimenType: row.specimen_type,
        specimenCollectionDate: new Date(row.specimen_collection_date),
        specimenSource: row.specimen_source,
        organismCode: row.organism_code,
        organismCodeSystem: row.organism_code_system,
        organismName: row.organism_name,
        antimicrobialTested: row.antimicrobial_tested,
        antimicrobialCode: row.antimicrobial_code,
        interpretation: row.interpretation as 'S' | 'I' | 'R',
        micValue: row.mic_value,
        micUnit: row.mic_unit,
        isMdro: row.is_mdro,
        mdroType: row.mdro_type,
        labName: row.lab_name,
        labNpi: row.lab_npi,
        resultDate: row.result_date ? new Date(row.result_date) : undefined,
        includedInNhsnReport: false,
      }));

      resistanceRecordCount = resistanceRecords.length;
      cdaDocument = generateARDocument({
        resistanceRecords,
        facility,
        reportingPeriodStart,
        reportingPeriodEnd,
      });
    }

    // Save submission
    const { data, error } = await supabase
      .from('nhsn_submissions')
      .insert({
        tenant_id: tenantId,
        submission_type: submissionType,
        reporting_period_start: reportingPeriodStart.toISOString().split('T')[0],
        reporting_period_end: reportingPeriodEnd.toISOString().split('T')[0],
        facility_id: facility.id,
        nhsn_org_id: facility.nhsnOrgId,
        nhsn_facility_id: facility.nhsnFacilityId,
        document_type: 'CDA',
        cda_document: cdaDocument,
        usage_record_count: usageRecordCount,
        resistance_record_count: resistanceRecordCount,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('NHSN_SUBMISSION_CREATED', {
      tenantId,
      submissionId: data.id,
      submissionType,
      usageRecordCount,
      resistanceRecordCount,
    });

    return success({
      id: data.id,
      tenantId: data.tenant_id,
      submissionType,
      reportingPeriodStart,
      reportingPeriodEnd,
      facilityId: data.facility_id,
      nhsnOrgId: data.nhsn_org_id,
      nhsnFacilityId: data.nhsn_facility_id,
      documentType: 'CDA',
      cdaDocument,
      usageRecordCount,
      resistanceRecordCount,
      status: 'pending',
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'NHSN_SUBMISSION_CREATE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, submissionType }
    );
    return failure('OPERATION_FAILED', 'Failed to create NHSN submission');
  }
}

/**
 * Record NHSN submission result
 */
export async function recordSubmissionResult(
  submissionId: string,
  result: {
    success: boolean;
    nhsnSubmissionId?: string;
    responseStatus?: string;
    responseMessage?: string;
    errorMessage?: string;
  }
): Promise<ServiceResult<void>> {
  try {
    const status = result.success ? 'accepted' : 'rejected';

    const { error } = await supabase
      .from('nhsn_submissions')
      .update({
        status,
        submitted_at: new Date().toISOString(),
        nhsn_submission_id: result.nhsnSubmissionId,
        response_status: result.responseStatus,
        response_message: result.responseMessage,
        error_message: result.errorMessage,
      })
      .eq('id', submissionId);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    // Mark included records
    if (result.success) {
      const { data: submission } = await supabase
        .from('nhsn_submissions')
        .select('submission_type, reporting_period_start, reporting_period_end, tenant_id')
        .eq('id', submissionId)
        .single();

      if (submission) {
        const tableName = submission.submission_type === 'AU' ? 'antimicrobial_usage' : 'antimicrobial_resistance';
        const dateField = submission.submission_type === 'AU' ? 'prescribed_date' : 'specimen_collection_date';

        await supabase
          .from(tableName)
          .update({ included_in_nhsn_report: true, nhsn_submission_id: submissionId })
          .eq('tenant_id', submission.tenant_id)
          .gte(dateField, submission.reporting_period_start)
          .lte(dateField, submission.reporting_period_end);
      }
    }

    await auditLogger.info('NHSN_SUBMISSION_RESULT', {
      submissionId,
      status,
      nhsnSubmissionId: result.nhsnSubmissionId,
    });

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'NHSN_RECORD_RESULT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { submissionId }
    );
    return failure('OPERATION_FAILED', 'Failed to record submission result');
  }
}

/**
 * Get submission history
 */
export async function getSubmissionHistory(
  tenantId: string,
  options?: {
    submissionType?: 'AU' | 'AR';
    status?: string;
    limit?: number;
  }
): Promise<ServiceResult<NHSNSubmission[]>> {
  try {
    let query = supabase
      .from('nhsn_submissions')
      .select('id, tenant_id, submission_type, reporting_period_start, reporting_period_end, facility_id, nhsn_org_id, nhsn_facility_id, document_type, cda_document, usage_record_count, resistance_record_count, status, submitted_at, submission_method, nhsn_submission_id, response_status, response_message, error_message')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.submissionType) {
      query = query.eq('submission_type', options.submissionType);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const submissions: NHSNSubmission[] = ((data || []) as SubmissionRow[]).map((row: SubmissionRow) => ({
      id: row.id,
      tenantId: row.tenant_id,
      submissionType: row.submission_type as 'AU' | 'AR',
      reportingPeriodStart: new Date(row.reporting_period_start),
      reportingPeriodEnd: new Date(row.reporting_period_end),
      facilityId: row.facility_id,
      nhsnOrgId: row.nhsn_org_id,
      nhsnFacilityId: row.nhsn_facility_id,
      documentType: row.document_type,
      cdaDocument: row.cda_document,
      usageRecordCount: row.usage_record_count,
      resistanceRecordCount: row.resistance_record_count,
      status: row.status as NHSNSubmission['status'],
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
      submissionMethod: row.submission_method,
      nhsnSubmissionId: row.nhsn_submission_id,
      responseStatus: row.response_status,
      responseMessage: row.response_message,
      errorMessage: row.error_message,
    }));

    return success(submissions);
  } catch (err: unknown) {
    await auditLogger.error(
      'NHSN_GET_HISTORY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to get submission history');
  }
}
