/**
 * FHIR Bulk Data Access IG - Export Service
 *
 * Purpose: Implements the $export operation per HL7 FHIR Bulk Data Access IG (R4)
 * Reference: https://hl7.org/fhir/uv/bulkdata/
 * Features: Async export jobs, NDJSON output, status polling, cancellation
 *
 * @module services/fhirBulkExportService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type ExportType = 'system' | 'patient' | 'group';

export type ExportStatus = 'pending' | 'in_progress' | 'completed' | 'error' | 'cancelled';

/** FHIR resource types supported for bulk export */
export type FhirExportResourceType =
  | 'Patient'
  | 'Condition'
  | 'MedicationRequest'
  | 'Observation'
  | 'Procedure'
  | 'DiagnosticReport'
  | 'Immunization'
  | 'AllergyIntolerance'
  | 'CarePlan'
  | 'Encounter';

/** A single NDJSON output file in the export manifest */
export interface NdjsonOutputFile {
  type: string;
  url: string;
  count: number;
}

/** Bulk export job record matching fhir_bulk_export_jobs table */
export interface BulkExportJob {
  id: string;
  tenant_id: string;
  requested_by: string;
  status: ExportStatus;
  export_type: ExportType;
  resource_types: string[];
  since_date: string | null;
  patient_id: string | null;
  group_id: string | null;
  output_format: string;
  progress_percent: number;
  total_resources: number;
  exported_resources: number;
  output_files: NdjsonOutputFile[];
  error_message: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
}

/** Request payload for initiating a bulk export */
export interface BulkExportRequest {
  exportType: ExportType;
  resourceTypes: string[];
  since?: string;
  patientId?: string;
  groupId?: string;
  outputFormat?: string;
}

/** Response after requesting an export (status URL + job ID) */
export interface ExportRequestResponse {
  jobId: string;
  statusUrl: string;
}

/** Status poll response per Bulk Data Access IG */
export interface ExportStatusResponse {
  jobId: string;
  status: ExportStatus;
  progressPercent: number;
  totalResources: number;
  exportedResources: number;
  output: NdjsonOutputFile[];
  errorMessage: string | null;
  requestedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
}

/** FHIR resource map: table name to FHIR resource type label */
const FHIR_TABLE_MAP: Record<string, string> = {
  Patient: 'fhir_patients',
  Condition: 'fhir_conditions',
  MedicationRequest: 'fhir_medication_requests',
  Observation: 'fhir_observations',
  Procedure: 'fhir_procedures',
  DiagnosticReport: 'fhir_diagnostic_reports',
};

// =============================================================================
// HELPERS
// =============================================================================

async function getTenantId(): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .single();
  return data?.tenant_id ?? null;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Request a new bulk export job.
 * Per Bulk Data Access IG, returns 202 Accepted with Content-Location header
 * pointing to the status polling endpoint.
 */
async function requestExport(
  request: BulkExportRequest
): Promise<ServiceResult<ExportRequestResponse>> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return failure('UNAUTHORIZED', 'No tenant context');

    const userId = await getCurrentUserId();
    if (!userId) return failure('UNAUTHORIZED', 'Not authenticated');

    if (request.resourceTypes.length === 0) {
      return failure('VALIDATION_ERROR', 'At least one resource type is required');
    }

    const { data, error } = await supabase
      .from('fhir_bulk_export_jobs')
      .insert({
        tenant_id: tenantId,
        requested_by: userId,
        status: 'pending' as ExportStatus,
        export_type: request.exportType,
        resource_types: request.resourceTypes,
        since_date: request.since ?? null,
        patient_id: request.patientId ?? null,
        group_id: request.groupId ?? null,
        output_format: request.outputFormat ?? 'application/fhir+ndjson',
      })
      .select('id, tenant_id, requested_by, status, export_type, resource_types, since_date, patient_id, group_id, output_format, progress_percent, total_resources, exported_resources, output_files, error_message, requested_at, started_at, completed_at, expires_at')
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);

    const job = data as BulkExportJob;

    await auditLogger.info('FHIR_BULK_EXPORT_REQUESTED', {
      jobId: job.id,
      exportType: request.exportType,
      resourceTypes: request.resourceTypes,
    });

    return success({
      jobId: job.id,
      statusUrl: `/fhir/$export-status/${job.id}`,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('FHIR_BULK_EXPORT_REQUEST_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to request bulk export');
  }
}

/**
 * Poll export job status.
 * Per Bulk Data Access IG:
 * - In progress: 202 with X-Progress header
 * - Completed: 200 with output manifest (NDJSON file URLs)
 * - Error: OperationOutcome
 */
async function getExportStatus(
  jobId: string
): Promise<ServiceResult<ExportStatusResponse>> {
  try {
    const { data, error } = await supabase
      .from('fhir_bulk_export_jobs')
      .select('id, tenant_id, requested_by, status, export_type, resource_types, since_date, patient_id, group_id, output_format, progress_percent, total_resources, exported_resources, output_files, error_message, requested_at, started_at, completed_at, expires_at')
      .eq('id', jobId)
      .single();

    if (error) return failure('NOT_FOUND', 'Export job not found', error);

    const job = data as BulkExportJob;

    return success({
      jobId: job.id,
      status: job.status,
      progressPercent: job.progress_percent,
      totalResources: job.total_resources,
      exportedResources: job.exported_resources,
      output: job.output_files,
      errorMessage: job.error_message,
      requestedAt: job.requested_at,
      completedAt: job.completed_at,
      expiresAt: job.expires_at,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('FHIR_BULK_EXPORT_STATUS_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to get export status');
  }
}

/**
 * Cancel a pending or in-progress export job.
 * Per Bulk Data Access IG, DELETE on the status endpoint cancels the job.
 */
async function cancelExport(
  jobId: string
): Promise<ServiceResult<{ jobId: string; status: ExportStatus }>> {
  try {
    const { data: current, error: fetchError } = await supabase
      .from('fhir_bulk_export_jobs')
      .select('status')
      .eq('id', jobId)
      .single();

    if (fetchError) return failure('NOT_FOUND', 'Export job not found', fetchError);

    const currentStatus = (current as { status: ExportStatus }).status;
    if (currentStatus === 'completed' || currentStatus === 'cancelled') {
      return failure('VALIDATION_ERROR', `Cannot cancel job in ${currentStatus} status`);
    }

    const { error } = await supabase
      .from('fhir_bulk_export_jobs')
      .update({ status: 'cancelled' as ExportStatus })
      .eq('id', jobId);

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.info('FHIR_BULK_EXPORT_CANCELLED', { jobId });

    return success({ jobId, status: 'cancelled' as ExportStatus });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('FHIR_BULK_EXPORT_CANCEL_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to cancel export');
  }
}

/**
 * List recent export jobs for the current tenant, optionally filtered by status.
 */
async function listExportJobs(
  status?: ExportStatus
): Promise<ServiceResult<BulkExportJob[]>> {
  try {
    let query = supabase
      .from('fhir_bulk_export_jobs')
      .select('id, tenant_id, requested_by, status, export_type, resource_types, since_date, patient_id, group_id, output_format, progress_percent, total_resources, exported_resources, output_files, error_message, requested_at, started_at, completed_at, expires_at');

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('requested_at', { ascending: false }).limit(50);

    const { data, error } = await query;

    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success((data ?? []) as BulkExportJob[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('FHIR_BULK_EXPORT_LIST_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to list export jobs');
  }
}

/**
 * Convert an array of FHIR resources to NDJSON format.
 * Per Bulk Data Access IG, NDJSON is one JSON object per line,
 * each terminated by a newline character (\n).
 *
 * @param resources - Array of FHIR resource objects
 * @returns NDJSON string (empty string for empty input)
 */
function convertToNdjson(resources: Record<string, unknown>[]): string {
  if (resources.length === 0) return '';
  return resources.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

/**
 * Process an export job: query FHIR tables, convert to NDJSON, store output manifest.
 * This is the worker function that would be called by a background process or edge function.
 */
async function generateExportOutput(
  jobId: string
): Promise<ServiceResult<BulkExportJob>> {
  try {
    // Mark job as in_progress
    const { data: jobData, error: fetchError } = await supabase
      .from('fhir_bulk_export_jobs')
      .select('id, tenant_id, requested_by, status, export_type, resource_types, since_date, patient_id, group_id, output_format, progress_percent, total_resources, exported_resources, output_files, error_message, requested_at, started_at, completed_at, expires_at')
      .eq('id', jobId)
      .single();

    if (fetchError) return failure('NOT_FOUND', 'Export job not found', fetchError);

    const job = jobData as BulkExportJob;

    if (job.status === 'cancelled') {
      return failure('VALIDATION_ERROR', 'Job has been cancelled');
    }

    const { error: startError } = await supabase
      .from('fhir_bulk_export_jobs')
      .update({ status: 'in_progress' as ExportStatus, started_at: new Date().toISOString() })
      .eq('id', jobId);

    if (startError) return failure('DATABASE_ERROR', startError.message, startError);

    await auditLogger.info('FHIR_BULK_EXPORT_STARTED', {
      jobId,
      resourceTypes: job.resource_types,
    });

    const outputFiles: NdjsonOutputFile[] = [];
    let totalCount = 0;

    // Process each requested resource type
    for (const resourceType of job.resource_types) {
      const tableName = FHIR_TABLE_MAP[resourceType];
      if (!tableName) continue;

      let query = supabase.from(tableName).select('*'); // TODO: specify columns per resource type — dynamic table requires full export for NDJSON

      // Apply since_date filter if provided
      if (job.since_date) {
        query = query.gte('updated_at', job.since_date);
      }

      // Apply patient filter for patient-level exports
      if (job.export_type === 'patient' && job.patient_id) {
        query = query.eq('patient_id', job.patient_id);
      }

      const { data: resources, error: queryError } = await query;

      if (queryError) {
        await auditLogger.warn('FHIR_BULK_EXPORT_RESOURCE_QUERY_FAILED', {
          jobId,
          resourceType,
          error: queryError.message,
        });
        continue;
      }

      const resourceArray = (resources ?? []) as Record<string, unknown>[];
      if (resourceArray.length === 0) continue;

      const ndjsonContent = convertToNdjson(resourceArray);
      const count = resourceArray.length;
      totalCount += count;

      outputFiles.push({
        type: resourceType,
        url: `/fhir/$export-output/${jobId}/${resourceType}.ndjson`,
        count,
      });

      // Update progress
      const progress = Math.round(
        ((job.resource_types.indexOf(resourceType) + 1) / job.resource_types.length) * 100
      );

      const { error: progressError } = await supabase
        .from('fhir_bulk_export_jobs')
        .update({
          progress_percent: progress,
          exported_resources: totalCount,
        })
        .eq('id', jobId);

      if (progressError) {
        await auditLogger.warn('FHIR_BULK_EXPORT_PROGRESS_UPDATE_FAILED', {
          jobId,
          error: progressError.message,
        });
      }

      // Store NDJSON content in Supabase storage (if available)
      // For now, the output_files URLs reference the retrievable endpoint
      void ndjsonContent; // Content would be stored to object storage in production
    }

    // Mark job as completed
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { data: updatedJob, error: completeError } = await supabase
      .from('fhir_bulk_export_jobs')
      .update({
        status: 'completed' as ExportStatus,
        progress_percent: 100,
        total_resources: totalCount,
        exported_resources: totalCount,
        output_files: outputFiles,
        completed_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', jobId)
      .select('id, tenant_id, requested_by, status, export_type, resource_types, since_date, patient_id, group_id, output_format, progress_percent, total_resources, exported_resources, output_files, error_message, requested_at, started_at, completed_at, expires_at')
      .single();

    if (completeError) return failure('DATABASE_ERROR', completeError.message, completeError);

    await auditLogger.info('FHIR_BULK_EXPORT_COMPLETED', {
      jobId,
      totalResources: totalCount,
      fileCount: outputFiles.length,
    });

    return success(updatedJob as BulkExportJob);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));

    // Mark job as errored
    await supabase
      .from('fhir_bulk_export_jobs')
      .update({
        status: 'error' as ExportStatus,
        error_message: error.message,
      })
      .eq('id', jobId);

    await auditLogger.error('FHIR_BULK_EXPORT_GENERATION_FAILED', error, {
      jobId,
    });

    return failure('OPERATION_FAILED', 'Failed to generate export output');
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const fhirBulkExportService = {
  requestExport,
  getExportStatus,
  cancelExport,
  listExportJobs,
  convertToNdjson,
  generateExportOutput,
};
