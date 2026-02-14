/**
 * Undercoding Detection Service
 *
 * Purpose: Compares AI-suggested billing codes against actually billed codes
 * to identify revenue gaps from undercoding. Detects lower E/M levels,
 * missed charges, and lower-value code substitutions.
 *
 * Used by: UndercodingDetectionDashboard
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

/** Shape of CPT/HCPCS entries stored in the suggested_codes jsonb */
interface SuggestedCodeEntry {
  code: string;
  description?: string;
  confidence?: number;
  rationale?: string;
}

/** Shape of the suggested_codes jsonb column */
interface SuggestedCodesPayload {
  cpt?: SuggestedCodeEntry[];
  hcpcs?: SuggestedCodeEntry[];
  icd10?: SuggestedCodeEntry[];
}

/** Row from encounter_billing_suggestions */
interface BillingSuggestionRow {
  id: string;
  encounter_id: string;
  tenant_id: string;
  suggested_codes: SuggestedCodesPayload;
  overall_confidence: number;
  status: string;
  encounter_type: string | null;
  created_at: string;
}

/** Row from claim_lines joined through claims */
interface ClaimLineRow {
  procedure_code: string;
  code_system: string;
  charge_amount: number;
}

/** Row from encounters for date_of_service */
interface EncounterRow {
  id: string;
  date_of_service: string | null;
}

export type GapType = 'lower_em_level' | 'missed_code' | 'lower_value_code';
export type GapStatus = 'open' | 'reviewed' | 'accepted' | 'dismissed';

export interface UndercodingGap {
  id: string;
  encounter_id: string;
  date_of_service: string;
  encounter_type: string | null;
  suggested_code: string;
  suggested_description: string | null;
  billed_code: string | null;
  billed_description: string | null;
  suggested_charge: number;
  billed_charge: number;
  revenue_gap: number;
  confidence: number;
  rationale: string | null;
  gap_type: GapType;
  status: GapStatus;
}

export interface UndercodingStats {
  total_gaps: number;
  total_revenue_opportunity: number;
  avg_gap_per_encounter: number;
  encounters_with_gaps: number;
  most_common_gap_code: string | null;
  gaps_by_type: {
    lower_em_level: number;
    missed_code: number;
    lower_value_code: number;
  };
}

export interface UndercodingFilters {
  gap_type?: GapType;
  min_confidence?: number;
  status?: GapStatus;
  search?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/** E/M codes in the 992xx range — higher last digits = higher complexity */
const EM_CODE_PREFIX = '992';

function isEMCode(code: string): boolean {
  return code.startsWith(EM_CODE_PREFIX) && code.length === 5;
}

function getEMLevel(code: string): number {
  if (!isEMCode(code)) return -1;
  return parseInt(code.charAt(4), 10);
}

/**
 * Classify the gap type between a suggested code and what was billed.
 *
 * - lower_em_level: Both are E/M codes but billed code has lower level
 * - missed_code: Suggested code was not billed at all
 * - lower_value_code: Same code system but different code with lower charge
 */
function classifyGapType(
  suggestedCode: string,
  billedCode: string | null,
  suggestedCharge: number,
  billedCharge: number
): GapType {
  // If nothing was billed matching this suggestion, it's missed
  if (!billedCode) {
    return 'missed_code';
  }

  // Both E/M — check level
  if (isEMCode(suggestedCode) && isEMCode(billedCode)) {
    const suggestedLevel = getEMLevel(suggestedCode);
    const billedLevel = getEMLevel(billedCode);
    if (suggestedLevel > billedLevel) {
      return 'lower_em_level';
    }
  }

  // Different code with lower charge
  if (suggestedCharge > billedCharge) {
    return 'lower_value_code';
  }

  // Fallback — treat as lower value if there's a gap
  return 'lower_value_code';
}

/**
 * Look up a fee schedule price for a code. Returns 0 if not found.
 */
async function lookupFeePrice(code: string): Promise<number> {
  const { data } = await supabase
    .from('fee_schedule_items')
    .select('price')
    .eq('code', code)
    .limit(1);

  if (data && data.length > 0) {
    const row = data[0] as { price: number };
    return row.price ?? 0;
  }
  return 0;
}

/**
 * Find the best matching billed code for a suggested code.
 * Returns the billed code and its charge, or null if not billed.
 */
function findBilledMatch(
  suggestedCode: string,
  billedCodes: ClaimLineRow[]
): { code: string; charge: number } | null {
  // Exact match first
  const exact = billedCodes.find(b => b.procedure_code === suggestedCode);
  if (exact) {
    return { code: exact.procedure_code, charge: exact.charge_amount };
  }

  // E/M level match — find a billed code in the same E/M family
  if (isEMCode(suggestedCode)) {
    const prefix = suggestedCode.substring(0, 4);
    const emMatch = billedCodes.find(b => b.procedure_code.startsWith(prefix));
    if (emMatch) {
      return { code: emMatch.procedure_code, charge: emMatch.charge_amount };
    }
  }

  return null;
}

// =============================================================================
// SERVICE
// =============================================================================

export const undercodingDetectionService = {
  /**
   * Get undercoding gaps by comparing AI suggestions to billed claim lines.
   */
  async getUndercodingGaps(
    filters?: UndercodingFilters
  ): Promise<ServiceResult<UndercodingGap[]>> {
    try {
      // 1. Fetch billing suggestions with high confidence
      const minConfidence = filters?.min_confidence ?? 0.75;

      const { data: suggestions, error: suggestionsError } = await supabase
        .from('encounter_billing_suggestions')
        .select('id, encounter_id, tenant_id, suggested_codes, overall_confidence, status, encounter_type, created_at')
        .neq('status', 'rejected')
        .gte('overall_confidence', minConfidence)
        .order('created_at', { ascending: false })
        .limit(200);

      if (suggestionsError) {
        await auditLogger.error('UNDERCODING_SUGGESTIONS_FETCH_FAILED',
          new Error(suggestionsError.message),
          { context: 'getUndercodingGaps' }
        );
        return failure('DATABASE_ERROR', suggestionsError.message, suggestionsError);
      }

      if (!suggestions || suggestions.length === 0) {
        return success([]);
      }

      const typedSuggestions = suggestions as unknown as BillingSuggestionRow[];

      // 2. Get encounter IDs for date lookup
      const encounterIds = [...new Set(typedSuggestions.map(s => s.encounter_id))];

      const { data: encounters } = await supabase
        .from('encounters')
        .select('id, date_of_service')
        .in('id', encounterIds);

      const encounterMap = new Map<string, string>();
      if (encounters) {
        for (const enc of encounters as unknown as EncounterRow[]) {
          encounterMap.set(enc.id, enc.date_of_service ?? '');
        }
      }

      // 3. Get claims and claim_lines for these encounters
      const { data: claims } = await supabase
        .from('claims')
        .select('id, encounter_id')
        .in('encounter_id', encounterIds);

      const claimIdToEncounter = new Map<string, string>();
      const claimIds: string[] = [];
      if (claims) {
        for (const claim of claims as unknown as Array<{ id: string; encounter_id: string }>) {
          claimIdToEncounter.set(claim.id, claim.encounter_id);
          claimIds.push(claim.id);
        }
      }

      // Build encounter -> billed codes map
      const encounterBilledCodes = new Map<string, ClaimLineRow[]>();
      if (claimIds.length > 0) {
        const { data: claimLines } = await supabase
          .from('claim_lines')
          .select('claim_id, procedure_code, code_system, charge_amount')
          .in('claim_id', claimIds);

        if (claimLines) {
          for (const line of claimLines as unknown as Array<ClaimLineRow & { claim_id: string }>) {
            const encId = claimIdToEncounter.get(line.claim_id);
            if (encId) {
              const existing = encounterBilledCodes.get(encId) || [];
              existing.push({
                procedure_code: line.procedure_code,
                code_system: line.code_system,
                charge_amount: line.charge_amount ?? 0,
              });
              encounterBilledCodes.set(encId, existing);
            }
          }
        }
      }

      // 4. Compare suggested codes vs billed codes
      const gaps: UndercodingGap[] = [];

      for (const suggestion of typedSuggestions) {
        const billedCodes = encounterBilledCodes.get(suggestion.encounter_id) || [];
        const suggestedPayload = suggestion.suggested_codes || {};
        const cptCodes = suggestedPayload.cpt || [];
        const hcpcsCodes = suggestedPayload.hcpcs || [];
        const allSuggestedCodes = [...cptCodes, ...hcpcsCodes];

        for (const suggested of allSuggestedCodes) {
          const suggestedCharge = await lookupFeePrice(suggested.code);
          const billedMatch = findBilledMatch(suggested.code, billedCodes);
          const billedCharge = billedMatch?.charge ?? 0;

          // Only flag as a gap if there is a revenue difference
          const revenueGap = suggestedCharge - billedCharge;
          if (revenueGap <= 0 && billedMatch !== null) {
            continue; // No undercoding for this code
          }

          const gapType = classifyGapType(
            suggested.code,
            billedMatch?.code ?? null,
            suggestedCharge,
            billedCharge
          );

          const gap: UndercodingGap = {
            id: `${suggestion.id}-${suggested.code}`,
            encounter_id: suggestion.encounter_id,
            date_of_service: encounterMap.get(suggestion.encounter_id) || suggestion.created_at.split('T')[0],
            encounter_type: suggestion.encounter_type,
            suggested_code: suggested.code,
            suggested_description: suggested.description ?? null,
            billed_code: billedMatch?.code ?? null,
            billed_description: null,
            suggested_charge: suggestedCharge,
            billed_charge: billedCharge,
            revenue_gap: revenueGap > 0 ? revenueGap : suggestedCharge,
            confidence: suggested.confidence ?? suggestion.overall_confidence,
            rationale: suggested.rationale ?? null,
            gap_type: gapType,
            status: 'open',
          };

          gaps.push(gap);
        }
      }

      // 5. Apply client-side filters
      let filtered = gaps;

      if (filters?.gap_type) {
        filtered = filtered.filter(g => g.gap_type === filters.gap_type);
      }

      if (filters?.status) {
        filtered = filtered.filter(g => g.status === filters.status);
      }

      if (filters?.search) {
        const q = filters.search.toLowerCase();
        filtered = filtered.filter(g =>
          g.suggested_code.toLowerCase().includes(q) ||
          (g.billed_code ?? '').toLowerCase().includes(q) ||
          (g.suggested_description ?? '').toLowerCase().includes(q)
        );
      }

      // Sort by revenue gap descending
      filtered.sort((a, b) => b.revenue_gap - a.revenue_gap);

      await auditLogger.info('UNDERCODING_GAPS_FETCHED', {
        totalGaps: filtered.length,
        filtersApplied: !!filters,
      });

      return success(filtered);
    } catch (err: unknown) {
      await auditLogger.error('UNDERCODING_GAPS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getUndercodingGaps' }
      );
      return failure('OPERATION_FAILED', 'Failed to fetch undercoding gaps');
    }
  },

  /**
   * Get aggregate undercoding statistics.
   */
  async getUndercodingStats(): Promise<ServiceResult<UndercodingStats>> {
    try {
      const gapsResult = await undercodingDetectionService.getUndercodingGaps();

      if (!gapsResult.success) {
        return failure(gapsResult.error.code, gapsResult.error.message);
      }

      const gaps = gapsResult.data;

      const totalRevenue = gaps.reduce((sum, g) => sum + g.revenue_gap, 0);
      const uniqueEncounters = new Set(gaps.map(g => g.encounter_id)).size;

      // Find most common gap code
      const codeFrequency = new Map<string, number>();
      for (const g of gaps) {
        const count = codeFrequency.get(g.suggested_code) || 0;
        codeFrequency.set(g.suggested_code, count + 1);
      }
      let mostCommonCode: string | null = null;
      let maxFrequency = 0;
      for (const [code, count] of codeFrequency) {
        if (count > maxFrequency) {
          maxFrequency = count;
          mostCommonCode = code;
        }
      }

      const stats: UndercodingStats = {
        total_gaps: gaps.length,
        total_revenue_opportunity: totalRevenue,
        avg_gap_per_encounter: uniqueEncounters > 0
          ? totalRevenue / uniqueEncounters
          : 0,
        encounters_with_gaps: uniqueEncounters,
        most_common_gap_code: mostCommonCode,
        gaps_by_type: {
          lower_em_level: gaps.filter(g => g.gap_type === 'lower_em_level').length,
          missed_code: gaps.filter(g => g.gap_type === 'missed_code').length,
          lower_value_code: gaps.filter(g => g.gap_type === 'lower_value_code').length,
        },
      };

      return success(stats);
    } catch (err: unknown) {
      await auditLogger.error('UNDERCODING_STATS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getUndercodingStats' }
      );
      return failure('OPERATION_FAILED', 'Failed to compute undercoding stats');
    }
  },

  /**
   * Dismiss a gap (provider reviewed and disagrees with the AI suggestion).
   */
  async dismissGap(gapId: string, reason: string): Promise<ServiceResult<boolean>> {
    try {
      // Gap IDs are composite: `{suggestion_id}-{code}`
      // We need to update the suggestion status or track dismissals separately.
      // For now, log the dismissal as an audit event since gaps are computed, not stored.
      await auditLogger.info('UNDERCODING_GAP_DISMISSED', {
        gapId,
        reason,
        action: 'dismissed',
      });

      return success(true);
    } catch (err: unknown) {
      await auditLogger.error('UNDERCODING_GAP_DISMISS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'dismissGap', gapId }
      );
      return failure('OPERATION_FAILED', 'Failed to dismiss gap');
    }
  },
};
