/**
 * =====================================================
 * LABOR & DELIVERY — METRICS SERVICE
 * =====================================================
 * Purpose: Unit-level KPI aggregation for L&D dashboard
 * Extracted from laborDeliveryService.ts for 600-line compliance
 * =====================================================
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type { LDUnitMetrics } from '../../types/laborDelivery';
import type { LDApiResponse } from './laborDeliveryService';

export class LDMetricsService {
  /** Get L&D unit metrics for the dashboard KPI panel */
  static async getUnitMetrics(
    tenantId: string
  ): Promise<LDApiResponse<LDUnitMetrics>> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [activePregRes, deliveriesTodayRes, activeLaborsRes, alertsRes] = await Promise.all([
        supabase.from('ld_pregnancies').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('status', 'active'),
        supabase.from('ld_delivery_records').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).gte('delivery_datetime', today),
        supabase.from('ld_labor_events').select('patient_id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).gte('event_time', today),
        supabase.from('ld_alerts').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('resolved', false),
      ]);

      return {
        success: true,
        data: {
          active_pregnancies: activePregRes.count ?? 0,
          deliveries_today: deliveriesTodayRes.count ?? 0,
          active_labors_today: activeLaborsRes.count ?? 0,
          active_alerts: alertsRes.count ?? 0,
        },
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_METRICS_ERROR', error, { tenantId });
      return { success: false, error: error.message };
    }
  }
}
