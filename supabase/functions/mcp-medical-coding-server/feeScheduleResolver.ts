// =====================================================
// MCP Medical Coding Server — Fee Schedule Resolver
// Resolves $0 charges by looking up rates from the
// fee_schedule_rates table. Only CPT/HCPCS codes
// can be resolved directly. NDC and LOINC codes
// require crosswalk tables (future: P3-2).
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { MCPLogger, ChargeEntry, ChargesByCategory } from "./types.ts";
import { withTimeout } from "../_shared/mcpQueryTimeout.ts";

// -------------------------------------------------------
// Database row shape (system boundary cast)
// -------------------------------------------------------
interface FeeScheduleRateRow {
  code: string;
  code_type: string;
  rate: number;
  description: string | null;
}

/**
 * Look up fee schedule rates for charges that have $0 amounts.
 * Uses the most recent active fee schedule (defaults to Medicare).
 * Only resolves CPT and HCPCS codes — NDC and LOINC need
 * crosswalk tables (P3-2) before they can be resolved.
 *
 * @returns Total dollar amount resolved from fee schedule
 */
export async function resolveZeroCharges(
  sb: SupabaseClient,
  charges: ChargesByCategory,
  timeoutMs: number,
  logger: MCPLogger
): Promise<number> {
  // Collect all codes with $0 that could be resolved
  const codesToResolve: Array<{ code: string; codeSystem: string }> = [];

  for (const entries of Object.values(charges)) {
    for (const entry of entries as ChargeEntry[]) {
      if (
        entry.charge_amount === 0 &&
        (entry.code_system === 'cpt' || entry.code_system === 'hcpcs')
      ) {
        codesToResolve.push({ code: entry.code, codeSystem: entry.code_system });
      }
    }
  }

  if (codesToResolve.length === 0) return 0;

  // Get the most recent active fee schedule
  const { data: scheduleData } = await withTimeout(
    sb.from('fee_schedules')
      .select('id')
      .eq('is_active', true)
      .order('effective_date', { ascending: false })
      .limit(1)
      .single(),
    timeoutMs,
    'Fee schedule lookup'
  );

  if (!scheduleData) {
    logger.warn('CHARGE_AGG_NO_FEE_SCHEDULE', {
      message: 'No active fee schedule found — zero-amount charges cannot be resolved'
    });
    return 0;
  }

  const scheduleId = (scheduleData as { id: string }).id;
  const uniqueCodes = [...new Set(codesToResolve.map(c => c.code))];

  const { data: rateRows } = await withTimeout(
    sb.from('fee_schedule_rates')
      .select('code, code_type, rate, description')
      .eq('fee_schedule_id', scheduleId)
      .in('code', uniqueCodes),
    timeoutMs,
    'Fee schedule rates lookup'
  );

  if (!rateRows || rateRows.length === 0) return 0;

  const rateMap = new Map<string, number>();
  for (const row of rateRows as FeeScheduleRateRow[]) {
    rateMap.set(`${row.code_type}:${row.code}`, row.rate);
  }

  // Apply rates to zero-amount charges
  let resolvedAmount = 0;
  for (const entries of Object.values(charges)) {
    for (const entry of entries as ChargeEntry[]) {
      if (entry.charge_amount === 0) {
        const key = `${entry.code_system}:${entry.code}`;
        const rate = rateMap.get(key);
        if (rate !== undefined) {
          entry.charge_amount = rate;
          resolvedAmount += rate * entry.units;
        }
      }
    }
  }

  if (resolvedAmount > 0) {
    logger.info('CHARGE_AGG_FEE_SCHEDULE_RESOLVED', {
      codesResolved: rateMap.size,
      totalResolved: Math.round(resolvedAmount * 100) / 100
    });
  }

  return resolvedAmount;
}
