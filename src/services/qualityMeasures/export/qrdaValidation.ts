/**
 * QRDA Validation & Export History
 *
 * ONC Criteria: 170.315(c)(2), (c)(3)
 */

import { supabase } from '../../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../../_base';
import { auditLogger } from '../../auditLogger';
import type { ExportHistoryRow } from './types';

/**
 * Validate QRDA document (basic validation)
 */
export async function validateQRDADocument(
  exportId: string
): Promise<ServiceResult<{ valid: boolean; errors: string[] }>> {
  try {
    const { data: exportRecord, error } = await supabase
      .from('ecqm_qrda_exports')
      .select('measure_ids, reporting_period_start, reporting_period_end, export_type, patient_id')
      .eq('id', exportId)
      .single();

    if (error || !exportRecord) {
      return failure('NOT_FOUND', 'Export record not found');
    }

    const errors: string[] = [];

    if (!exportRecord.measure_ids || exportRecord.measure_ids.length === 0) {
      errors.push('No measures specified in export');
    }

    if (!exportRecord.reporting_period_start || !exportRecord.reporting_period_end) {
      errors.push('Missing reporting period dates');
    }

    if (exportRecord.export_type === 'QRDA_I' && !exportRecord.patient_id) {
      errors.push('QRDA I export requires a patient ID');
    }

    const validationStatus = errors.length === 0 ? 'valid' : 'invalid';
    await supabase
      .from('ecqm_qrda_exports')
      .update({
        validation_status: validationStatus,
        validation_errors: errors,
        validated_at: new Date().toISOString()
      })
      .eq('id', exportId);

    return success({ valid: errors.length === 0, errors });
  } catch (err: unknown) {
    await auditLogger.error(
      'QRDA_VALIDATION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { exportId }
    );
    return failure('VALIDATION_ERROR', 'Failed to validate QRDA document');
  }
}

/**
 * Get export history for a tenant
 */
export async function getExportHistory(
  tenantId: string,
  limit: number = 50
): Promise<ServiceResult<Array<{
  id: string;
  exportType: string;
  measureIds: string[];
  createdAt: string;
  validationStatus: string;
  patientCount?: number;
}>>> {
  try {
    const { data, error } = await supabase
      .from('ecqm_qrda_exports')
      .select('id, export_type, measure_ids, created_at, validation_status, patient_count')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    return success(
      ((data || []) as ExportHistoryRow[]).map((d: ExportHistoryRow) => ({
        id: d.id,
        exportType: d.export_type,
        measureIds: d.measure_ids,
        createdAt: d.created_at,
        validationStatus: d.validation_status,
        patientCount: d.patient_count
      }))
    );
  } catch (err: unknown) {
    await auditLogger.error(
      'QRDA_HISTORY_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch export history');
  }
}
