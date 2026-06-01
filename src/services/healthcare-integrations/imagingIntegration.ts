/**
 * Imaging / PACS Integration (DICOM)
 *
 * Extracted from healthcareIntegrationsService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — service methods + DB mappers moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import type {
  PACSConnection,
  ImagingOrder,
  ImagingStudy,
  ImagingReport,
  CreateImagingOrderRequest,
} from '../../types/healthcareIntegrations';

export class ImagingIntegrationService {
  /**
   * Get all PACS connections for tenant
   */
  static async getConnections(): Promise<ServiceResult<PACSConnection[]>> {
    try {
      const { data, error } = await supabase
        .from('pacs_connections')
        .select('id, tenant_id, pacs_vendor, pacs_name, description, ae_title, hostname, port, query_ae_title, query_port, wado_url, wado_auth_type, dicomweb_url, dicomweb_qido_path, dicomweb_wado_path, dicomweb_stow_path, enabled, auto_fetch_studies, store_images_locally, last_connected_at, last_error, connection_status, created_at, updated_at, created_by')
        .order('pacs_name');

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapPACSConnectionFromDB));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get PACS connections', err);
    }
  }

  /**
   * Create an imaging order
   */
  static async createOrder(request: CreateImagingOrderRequest): Promise<ServiceResult<ImagingOrder>> {
    try {
      const internalOrderId = `IMG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const { data, error } = await supabase
        .from('imaging_orders')
        .insert({
          patient_id: request.patientId,
          pacs_connection_id: request.pacsConnectionId,
          internal_order_id: internalOrderId,
          ordering_provider_id: request.orderingProviderId,
          ordering_provider_npi: request.orderingProviderNpi,
          modality: request.modality,
          procedure_code: request.procedureCode,
          procedure_name: request.procedureName,
          body_part: request.bodyPart,
          laterality: request.laterality,
          reason_for_exam: request.reasonForExam,
          diagnosis_codes: request.diagnosisCodes,
          clinical_history: request.clinicalHistory,
          priority: request.priority || 'routine',
          scheduled_at: request.scheduledAt,
          order_status: 'pending',
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('IMAGING_CREATE_ORDER_FAILED', error.message);
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('IMAGING_ORDER_CREATED', { orderId: data.id, patientId: request.patientId });
      return success(mapImagingOrderFromDB(data));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to create imaging order', err);
    }
  }

  /**
   * Get imaging orders for a patient
   */
  static async getPatientOrders(patientId: string, limit = 50): Promise<ServiceResult<ImagingOrder[]>> {
    try {
      const { data, error } = await supabase
        .from('imaging_orders')
        .select('id, tenant_id, pacs_connection_id, patient_id, internal_order_id, accession_number, ordering_provider_id, ordering_provider_npi, modality, procedure_code, procedure_name, body_part, laterality, reason_for_exam, diagnosis_codes, clinical_history, priority, order_status, scheduled_at, performed_at, performing_facility, performing_location, interpreting_radiologist, dictated_at, finalized_at, study_instance_uid, fhir_imaging_study_id, fhir_diagnostic_report_id, created_at, updated_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapImagingOrderFromDB));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get patient imaging orders', err);
    }
  }

  /**
   * Get imaging studies for a patient
   */
  static async getPatientStudies(patientId: string, limit = 50): Promise<ServiceResult<ImagingStudy[]>> {
    try {
      const { data, error } = await supabase
        .from('imaging_studies')
        .select('id, tenant_id, order_id, patient_id, pacs_connection_id, study_instance_uid, series_count, instance_count, study_date, study_time, accession_number, modalities, study_description, body_part_examined, dicom_patient_name, dicom_patient_id, institution_name, referring_physician, performing_physician, storage_location, total_size_bytes, availability, has_report, report_id, received_at, created_at, updated_at')
        .eq('patient_id', patientId)
        .order('study_date', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapImagingStudyFromDB));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get patient imaging studies', err);
    }
  }

  /**
   * Get imaging reports for a patient
   */
  static async getPatientReports(patientId: string, limit = 50): Promise<ServiceResult<ImagingReport[]>> {
    try {
      const { data, error } = await supabase
        .from('imaging_reports')
        .select('id, tenant_id, study_id, order_id, patient_id, report_id, accession_number, report_status, clinical_info, comparison, technique, findings, impression, coded_findings, has_critical_finding, critical_finding_description, critical_finding_communicated, critical_finding_communicated_to, critical_finding_communicated_at, dictating_radiologist, dictating_radiologist_npi, signing_radiologist, signing_radiologist_npi, dictated_at, transcribed_at, signed_at, amended_at, is_amended, amendment_reason, original_report_id, fhir_diagnostic_report_id, created_at, updated_at')
        .eq('patient_id', patientId)
        .order('signed_at', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapImagingReportFromDB));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get patient imaging reports', err);
    }
  }

  /**
   * Get critical imaging findings that need acknowledgment
   */
  static async getCriticalFindings(): Promise<ServiceResult<ImagingReport[]>> {
    try {
      const { data, error } = await supabase
        .from('imaging_reports')
        .select('id, tenant_id, study_id, order_id, patient_id, report_id, accession_number, report_status, clinical_info, comparison, technique, findings, impression, coded_findings, has_critical_finding, critical_finding_description, critical_finding_communicated, critical_finding_communicated_to, critical_finding_communicated_at, dictating_radiologist, dictating_radiologist_npi, signing_radiologist, signing_radiologist_npi, dictated_at, transcribed_at, signed_at, amended_at, is_amended, amendment_reason, original_report_id, fhir_diagnostic_report_id, created_at, updated_at')
        .eq('has_critical_finding', true)
        .eq('critical_finding_communicated', false)
        .order('signed_at', { ascending: false });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapImagingReportFromDB));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get critical findings', err);
    }
  }
}

// ============================================================================
// DATABASE MAPPERS
// ============================================================================

export function mapPACSConnectionFromDB(row: Record<string, unknown>): PACSConnection {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    pacsVendor: row.pacs_vendor as string,
    pacsName: row.pacs_name as string,
    description: row.description as string | undefined,
    aeTitle: row.ae_title as string,
    hostname: row.hostname as string,
    port: row.port as number,
    queryAeTitle: row.query_ae_title as string | undefined,
    queryPort: row.query_port as number | undefined,
    wadoUrl: row.wado_url as string | undefined,
    wadoAuthType: row.wado_auth_type as PACSConnection['wadoAuthType'],
    dicomwebUrl: row.dicomweb_url as string | undefined,
    dicomwebQidoPath: row.dicomweb_qido_path as string | undefined,
    dicomwebWadoPath: row.dicomweb_wado_path as string | undefined,
    dicomwebStowPath: row.dicomweb_stow_path as string | undefined,
    enabled: row.enabled as boolean,
    autoFetchStudies: row.auto_fetch_studies as boolean,
    storeImagesLocally: row.store_images_locally as boolean,
    lastConnectedAt: row.last_connected_at as string | undefined,
    lastError: row.last_error as string | undefined,
    connectionStatus: row.connection_status as PACSConnection['connectionStatus'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: row.created_by as string | undefined,
  };
}

export function mapImagingOrderFromDB(row: Record<string, unknown>): ImagingOrder {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    pacsConnectionId: row.pacs_connection_id as string | undefined,
    patientId: row.patient_id as string,
    internalOrderId: row.internal_order_id as string,
    accessionNumber: row.accession_number as string | undefined,
    orderingProviderId: row.ordering_provider_id as string | undefined,
    orderingProviderNpi: row.ordering_provider_npi as string | undefined,
    modality: row.modality as string,
    procedureCode: row.procedure_code as string,
    procedureName: row.procedure_name as string,
    bodyPart: row.body_part as string | undefined,
    laterality: row.laterality as ImagingOrder['laterality'],
    reasonForExam: row.reason_for_exam as string | undefined,
    diagnosisCodes: row.diagnosis_codes as string[] | undefined,
    clinicalHistory: row.clinical_history as string | undefined,
    priority: row.priority as ImagingOrder['priority'],
    orderStatus: row.order_status as ImagingOrder['orderStatus'],
    scheduledAt: row.scheduled_at as string | undefined,
    performedAt: row.performed_at as string | undefined,
    performingFacility: row.performing_facility as string | undefined,
    performingLocation: row.performing_location as string | undefined,
    interpretingRadiologist: row.interpreting_radiologist as string | undefined,
    dictatedAt: row.dictated_at as string | undefined,
    finalizedAt: row.finalized_at as string | undefined,
    studyInstanceUid: row.study_instance_uid as string | undefined,
    fhirImagingStudyId: row.fhir_imaging_study_id as string | undefined,
    fhirDiagnosticReportId: row.fhir_diagnostic_report_id as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapImagingStudyFromDB(row: Record<string, unknown>): ImagingStudy {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    orderId: row.order_id as string | undefined,
    patientId: row.patient_id as string,
    pacsConnectionId: row.pacs_connection_id as string | undefined,
    studyInstanceUid: row.study_instance_uid as string,
    seriesCount: row.series_count as number,
    instanceCount: row.instance_count as number,
    studyDate: row.study_date as string,
    studyTime: row.study_time as string | undefined,
    accessionNumber: row.accession_number as string | undefined,
    modalities: row.modalities as string[],
    studyDescription: row.study_description as string | undefined,
    bodyPartExamined: row.body_part_examined as string | undefined,
    dicomPatientName: row.dicom_patient_name as string | undefined,
    dicomPatientId: row.dicom_patient_id as string | undefined,
    institutionName: row.institution_name as string | undefined,
    referringPhysician: row.referring_physician as string | undefined,
    performingPhysician: row.performing_physician as string | undefined,
    storageLocation: row.storage_location as string | undefined,
    totalSizeBytes: row.total_size_bytes as number | undefined,
    availability: row.availability as ImagingStudy['availability'],
    hasReport: row.has_report as boolean,
    reportId: row.report_id as string | undefined,
    receivedAt: row.received_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapImagingReportFromDB(row: Record<string, unknown>): ImagingReport {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    studyId: row.study_id as string | undefined,
    orderId: row.order_id as string | undefined,
    patientId: row.patient_id as string,
    reportId: row.report_id as string,
    accessionNumber: row.accession_number as string | undefined,
    reportStatus: row.report_status as ImagingReport['reportStatus'],
    clinicalInfo: row.clinical_info as string | undefined,
    comparison: row.comparison as string | undefined,
    technique: row.technique as string | undefined,
    findings: row.findings as string,
    impression: row.impression as string,
    codedFindings: row.coded_findings as Record<string, unknown> | undefined,
    hasCriticalFinding: row.has_critical_finding as boolean,
    criticalFindingDescription: row.critical_finding_description as string | undefined,
    criticalFindingCommunicated: row.critical_finding_communicated as boolean,
    criticalFindingCommunicatedTo: row.critical_finding_communicated_to as string | undefined,
    criticalFindingCommunicatedAt: row.critical_finding_communicated_at as string | undefined,
    dictatingRadiologist: row.dictating_radiologist as string | undefined,
    dictatingRadiologistNpi: row.dictating_radiologist_npi as string | undefined,
    signingRadiologist: row.signing_radiologist as string | undefined,
    signingRadiologistNpi: row.signing_radiologist_npi as string | undefined,
    dictatedAt: row.dictated_at as string | undefined,
    transcribedAt: row.transcribed_at as string | undefined,
    signedAt: row.signed_at as string | undefined,
    amendedAt: row.amended_at as string | undefined,
    isAmended: row.is_amended as boolean,
    amendmentReason: row.amendment_reason as string | undefined,
    originalReportId: row.original_report_id as string | undefined,
    fhirDiagnosticReportId: row.fhir_diagnostic_report_id as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
