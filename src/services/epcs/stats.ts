/**
 * EPCS — tenant statistics
 *
 * Extracted from epcsService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';

/**
 * Get EPCS statistics for a tenant
 */
export async function getEPCSStats(
  tenantId: string,
  options?: { startDate?: Date; endDate?: Date }
): Promise<ServiceResult<{
  totalPrescriptions: number;
  bySchedule: Record<number, number>;
  byStatus: Record<string, number>;
  signedCount: number;
  cancelledCount: number;
}>> {
  try {
    let query = supabase
      .from('epcs_prescriptions')
      .select('dea_schedule, status')
      .eq('tenant_id', tenantId);

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const prescriptions = data || [];

    const bySchedule: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 };
    const byStatus: Record<string, number> = {};

    for (const rx of prescriptions) {
      bySchedule[rx.dea_schedule] = (bySchedule[rx.dea_schedule] || 0) + 1;
      byStatus[rx.status] = (byStatus[rx.status] || 0) + 1;
    }

    return success({
      totalPrescriptions: prescriptions.length,
      bySchedule,
      byStatus,
      signedCount: (byStatus['signed'] || 0) + (byStatus['transmitted'] || 0) + (byStatus['filled'] || 0),
      cancelledCount: byStatus['cancelled'] || 0,
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_STATS_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch EPCS statistics');
  }
}
