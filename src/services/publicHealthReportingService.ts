/**
 * Public Health Reporting Service
 *
 * Purpose: Unified monitoring for syndromic surveillance, immunization registry,
 *          and electronic case reporting transmissions.
 * ONC Criteria: 170.315(f)(1), (f)(2), (f)(5)
 *
 * @module publicHealthReportingService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type TransmissionType = 'syndromic' | 'immunization' | 'ecr';
export type TransmissionStatus = 'pending' | 'submitted' | 'accepted' | 'rejected' | 'error';

export interface UnifiedTransmission {
  id: string;
  type: TransmissionType;
  submissionId: string;
  destination: string;
  endpoint: string;
  status: TransmissionStatus;
  patientId: string | null;
  submissionTimestamp: string;
  responseCode: string | null;
  responseMessage: string | null;
  isTest: boolean;
  errorDetails: string | null;
}

export interface TransmissionStats {
  total: number;
  success: number;
  pending: number;
  errors: number;
  byType: Record<TransmissionType, { total: number; success: number; error: number }>;
}

export interface TransmissionFilters {
  type?: TransmissionType;
  status?: TransmissionStatus | 'all';
  limit?: number;
}

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Get unified transmission list across all 3 public health reporting types
 */
export async function getTransmissions(
  tenantId: string,
  filters: TransmissionFilters = {}
): Promise<ServiceResult<UnifiedTransmission[]>> {
  try {
    const results: UnifiedTransmission[] = [];
    const limit = filters.limit || 100;

    // Fetch from each table unless type-filtered
    if (!filters.type || filters.type === 'syndromic') {
      const { data: syndromic } = await supabase
        .from('syndromic_surveillance_transmissions')
        .select('id, submission_id, destination, destination_endpoint, status, submission_timestamp, response_code, response_message, is_test')
        .eq('tenant_id', tenantId)
        .order('submission_timestamp', { ascending: false })
        .limit(limit);

      (syndromic || []).forEach(row => {
        results.push({
          id: row.id,
          type: 'syndromic',
          submissionId: row.submission_id,
          destination: row.destination,
          endpoint: row.destination_endpoint,
          status: normalizeStatus(row.status),
          patientId: null,
          submissionTimestamp: row.submission_timestamp,
          responseCode: row.response_code,
          responseMessage: row.response_message,
          isTest: row.is_test ?? false,
          errorDetails: row.status === 'error' ? row.response_message : null,
        });
      });
    }

    if (!filters.type || filters.type === 'immunization') {
      const { data: immunization } = await supabase
        .from('immunization_registry_submissions')
        .select('id, submission_id, registry_name, registry_endpoint, status, submission_timestamp, ack_code, ack_message, is_test, patient_id')
        .eq('tenant_id', tenantId)
        .order('submission_timestamp', { ascending: false })
        .limit(limit);

      (immunization || []).forEach(row => {
        results.push({
          id: row.id,
          type: 'immunization',
          submissionId: row.submission_id,
          destination: row.registry_name,
          endpoint: row.registry_endpoint,
          status: normalizeStatus(row.status),
          patientId: row.patient_id ?? null,
          submissionTimestamp: row.submission_timestamp,
          responseCode: row.ack_code,
          responseMessage: row.ack_message,
          isTest: row.is_test ?? false,
          errorDetails: row.status === 'error' ? row.ack_message : null,
        });
      });
    }

    if (!filters.type || filters.type === 'ecr') {
      const { data: ecr } = await supabase
        .from('ecr_submissions')
        .select('id, submission_id, destination_name, destination_endpoint, status, submission_timestamp, response_code, response_message, is_test')
        .eq('tenant_id', tenantId)
        .order('submission_timestamp', { ascending: false })
        .limit(limit);

      (ecr || []).forEach(row => {
        results.push({
          id: row.id,
          type: 'ecr',
          submissionId: row.submission_id,
          destination: row.destination_name,
          endpoint: row.destination_endpoint,
          status: normalizeStatus(row.status),
          patientId: null,
          submissionTimestamp: row.submission_timestamp,
          responseCode: row.response_code,
          responseMessage: row.response_message,
          isTest: row.is_test ?? false,
          errorDetails: row.status === 'error' ? row.response_message : null,
        });
      });
    }

    // Sort combined results by timestamp
    results.sort((a, b) =>
      new Date(b.submissionTimestamp).getTime() - new Date(a.submissionTimestamp).getTime()
    );

    // Apply status filter
    const filtered = filters.status && filters.status !== 'all'
      ? results.filter(t => t.status === filters.status)
      : results;

    return success(filtered.slice(0, limit));
  } catch (err: unknown) {
    await auditLogger.error(
      'PUBLIC_HEALTH_TRANSMISSIONS_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('OPERATION_FAILED', 'Failed to fetch transmissions');
  }
}

/**
 * Get aggregate stats across all transmission types
 */
export async function getStats(
  tenantId: string
): Promise<ServiceResult<TransmissionStats>> {
  try {
    const result = await getTransmissions(tenantId, { limit: 1000 });
    if (!result.success || !result.data) {
      return failure('OPERATION_FAILED', 'Failed to compute stats');
    }

    const all = result.data;
    const stats: TransmissionStats = {
      total: all.length,
      success: all.filter(t => t.status === 'accepted' || t.status === 'submitted').length,
      pending: all.filter(t => t.status === 'pending').length,
      errors: all.filter(t => t.status === 'error' || t.status === 'rejected').length,
      byType: {
        syndromic: computeTypeCounts(all, 'syndromic'),
        immunization: computeTypeCounts(all, 'immunization'),
        ecr: computeTypeCounts(all, 'ecr'),
      },
    };

    return success(stats);
  } catch (err: unknown) {
    await auditLogger.error(
      'PUBLIC_HEALTH_STATS_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('OPERATION_FAILED', 'Failed to compute transmission stats');
  }
}

/**
 * Retry a failed transmission by resetting its status to pending
 */
export async function retryTransmission(
  id: string,
  type: TransmissionType,
  tenantId: string
): Promise<ServiceResult<{ retried: boolean }>> {
  try {
    const tableName = getTableName(type);

    const { error } = await supabase
      .from(tableName)
      .update({ status: 'pending' })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      await auditLogger.error('PUBLIC_HEALTH_RETRY_FAILED', error, { id, type, tenantId });
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('PUBLIC_HEALTH_TRANSMISSION_RETRIED', { id, type, tenantId });
    return success({ retried: true });
  } catch (err: unknown) {
    await auditLogger.error(
      'PUBLIC_HEALTH_RETRY_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { id, type, tenantId }
    );
    return failure('OPERATION_FAILED', 'Failed to retry transmission');
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function normalizeStatus(status: string): TransmissionStatus {
  const map: Record<string, TransmissionStatus> = {
    pending: 'pending',
    submitted: 'submitted',
    accepted: 'accepted',
    rejected: 'rejected',
    error: 'error',
    failed: 'error',
  };
  return map[status] || 'pending';
}

function computeTypeCounts(
  all: UnifiedTransmission[],
  type: TransmissionType
): { total: number; success: number; error: number } {
  const ofType = all.filter(t => t.type === type);
  return {
    total: ofType.length,
    success: ofType.filter(t => t.status === 'accepted' || t.status === 'submitted').length,
    error: ofType.filter(t => t.status === 'error' || t.status === 'rejected').length,
  };
}

function getTableName(type: TransmissionType): string {
  switch (type) {
    case 'syndromic': return 'syndromic_surveillance_transmissions';
    case 'immunization': return 'immunization_registry_submissions';
    case 'ecr': return 'ecr_submissions';
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const publicHealthReportingService = {
  getTransmissions,
  getStats,
  retryTransmission,
};

export default publicHealthReportingService;
