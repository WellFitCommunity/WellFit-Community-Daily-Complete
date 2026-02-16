/**
 * Documentation Gap Indicator Service — Proactively identifies what providers
 * need to document before billing to qualify for higher E/M levels.
 * Used by: DocumentationGapDashboard
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';

// -- Types --

export type DocumentationGapCategory = 'time_gap' | 'diagnosis_gap' | 'data_complexity_gap' | 'risk_gap';
export type DocumentationGapPriority = 'high' | 'medium' | 'low';

export interface DocumentationGap {
  id: string;
  encounter_id: string;
  patient_id: string;
  date_of_service: string;
  encounter_type: string | null;
  provider_id: string | null;
  current_em_code: string;
  current_em_level: number;
  current_charge: number;
  target_em_code: string;
  target_em_level: number;
  target_charge: number;
  revenue_opportunity: number;
  category: DocumentationGapCategory;
  gap_description: string;
  actionable_steps: string[];
  confidence: number;
  priority: DocumentationGapPriority;
  current_time_minutes: number | null;
  time_needed_for_next_level: number | null;
  additional_minutes_needed: number | null;
  current_diagnosis_count: number;
  diagnoses_needed_for_next_level: number | null;
  current_data_complexity: string | null;
  data_complexity_needed: string | null;
  current_risk_level: string | null;
  risk_level_needed: string | null;
}

export interface DocumentationGapStats {
  total_gaps: number;
  total_revenue_opportunity: number;
  avg_opportunity_per_encounter: number;
  encounters_with_gaps: number;
  gaps_by_category: Record<DocumentationGapCategory, number>;
  gaps_by_priority: Record<DocumentationGapPriority, number>;
}

export interface DocumentationGapFilters {
  category?: DocumentationGapCategory;
  priority?: DocumentationGapPriority;
  min_confidence?: number;
  search?: string;
}

// -- Internal Types --

interface SuggestedCodeEntry {
  code: string;
  description?: string;
  confidence?: number;
  rationale?: string;
}

interface SuggestedCodesPayload {
  cpt?: SuggestedCodeEntry[];
  hcpcs?: SuggestedCodeEntry[];
}

interface BillingSuggestionRow {
  id: string;
  encounter_id: string;
  suggested_codes: SuggestedCodesPayload;
  overall_confidence: number;
  status: string;
  encounter_type: string | null;
  created_at: string;
}

interface EncounterRow {
  id: string;
  date_of_service: string | null;
  patient_id: string;
  provider_id: string | null;
  status: string;
  time_spent: number | null;
}

interface DiagnosisCountRow {
  encounter_id: string;
  count: number;
}

// -- Constants --

/** E/M time thresholds (CMS 2023) — established patients */
const ESTABLISHED_TIME_THRESHOLDS: Record<number, number> = {
  1: 0, 2: 10, 3: 20, 4: 30, 5: 40,
};

/** E/M time thresholds (CMS 2023) — new patients */
const NEW_PATIENT_TIME_THRESHOLDS: Record<number, number> = {
  2: 15, 3: 30, 4: 45, 5: 60,
};

/** Default fee schedule prices (fallback when DB lookup returns nothing) */
const DEFAULT_FEE_PRICES: Record<string, number> = {
  '99211': 26, '99212': 57, '99213': 93, '99214': 135, '99215': 185,
  '99202': 94, '99203': 130, '99204': 195, '99205': 250,
};

/** Statuses that mean the encounter is already finalized */
const FINALIZED_STATUSES = ['billed', 'completed', 'cancelled', 'no_show'];

// -- Helpers --

const EM_CODE_PREFIX_ESTABLISHED = '9921';
const EM_CODE_PREFIX_NEW = '9920';

function isEMCode(code: string): boolean {
  return (code.startsWith(EM_CODE_PREFIX_ESTABLISHED) || code.startsWith(EM_CODE_PREFIX_NEW)) && code.length === 5;
}

function getEMLevel(code: string): number {
  if (!isEMCode(code)) return -1;
  return parseInt(code.charAt(4), 10);
}

function isNewPatientCode(code: string): boolean {
  return code.startsWith(EM_CODE_PREFIX_NEW);
}

function buildEMCode(level: number, isNew: boolean): string {
  return isNew ? `9920${level}` : `9921${level}`;
}

async function lookupFeePrice(code: string): Promise<number> {
  const { data } = await supabase
    .from('fee_schedule_items')
    .select('price')
    .eq('code', code)
    .limit(1);

  if (data && data.length > 0) {
    const row = data[0] as { price: number };
    return row.price ?? DEFAULT_FEE_PRICES[code] ?? 0;
  }
  return DEFAULT_FEE_PRICES[code] ?? 0;
}

function assignPriority(revenueOpportunity: number): DocumentationGapPriority {
  if (revenueOpportunity >= 80) return 'high';
  if (revenueOpportunity >= 35) return 'medium';
  return 'low';
}

// -- Gap Computation --

interface GapComputeInput {
  currentLevel: number;
  currentCode: string;
  isNew: boolean;
  timeMinutes: number | null;
  diagnosisCount: number;
  dataComplexity: string | null;
  riskLevel: string | null;
}

interface ComputedGap {
  category: DocumentationGapCategory;
  targetLevel: number;
  targetCode: string;
  gap_description: string;
  actionable_steps: string[];
  time_needed_for_next_level: number | null;
  additional_minutes_needed: number | null;
  diagnoses_needed_for_next_level: number | null;
  data_complexity_needed: string | null;
  risk_level_needed: string | null;
}

const DATA_COMPLEXITY_LEVELS: Record<string, number> = {
  minimal: 1, limited: 2, moderate: 3, extensive: 4,
};
const DATA_COMPLEXITY_NAMES: Record<number, string> = {
  1: 'minimal', 2: 'limited', 3: 'moderate', 4: 'extensive',
};

const RISK_LEVELS: Record<string, number> = {
  minimal: 1, low: 2, moderate: 3, high: 4,
};
const RISK_NAMES: Record<number, string> = {
  1: 'minimal', 2: 'low', 3: 'moderate', 4: 'high',
};

function computeDocumentationGap(input: GapComputeInput): ComputedGap | null {
  const maxLevel = input.isNew ? 5 : 5;
  if (input.currentLevel >= maxLevel) return null;

  const nextLevel = input.currentLevel + 1;
  const targetCode = buildEMCode(nextLevel, input.isNew);

  // Try time-based gap first
  const timeThresholds = input.isNew ? NEW_PATIENT_TIME_THRESHOLDS : ESTABLISHED_TIME_THRESHOLDS;
  const nextTimeThreshold = timeThresholds[nextLevel];

  if (input.timeMinutes !== null && nextTimeThreshold !== undefined) {
    const additionalMinutes = nextTimeThreshold - input.timeMinutes;
    if (additionalMinutes > 0) {
      return {
        category: 'time_gap',
        targetLevel: nextLevel,
        targetCode,
        gap_description: `Document ${additionalMinutes} more minutes to qualify for ${targetCode}`,
        actionable_steps: [
          `Current time: ${input.timeMinutes} minutes. Next level requires ${nextTimeThreshold} minutes.`,
          `Document ${additionalMinutes} additional minutes of face-to-face or total visit time.`,
          'Include counseling/coordination time if applicable.',
        ],
        time_needed_for_next_level: nextTimeThreshold,
        additional_minutes_needed: additionalMinutes,
        diagnoses_needed_for_next_level: null,
        data_complexity_needed: null,
        risk_level_needed: null,
      };
    }
  }

  // MDM-based gap: find the easiest of the 3 components to upgrade
  // Problem complexity
  const dxNeeded = getDiagnosisGap(input.diagnosisCount, input.currentLevel, nextLevel);
  // Data complexity
  const dataGap = getDataComplexityGap(input.dataComplexity, input.currentLevel, nextLevel);
  // Risk level
  const riskGap = getRiskLevelGap(input.riskLevel, input.currentLevel, nextLevel);

  // Return the easiest gap to close (diagnosis first, then data, then risk)
  if (dxNeeded !== null) {
    return {
      category: 'diagnosis_gap',
      targetLevel: nextLevel,
      targetCode,
      gap_description: `Document ${dxNeeded} additional diagnosis(es) to support ${targetCode}`,
      actionable_steps: [
        `Current diagnoses: ${input.diagnosisCount}. Next level requires at least ${input.diagnosisCount + dxNeeded}.`,
        'Review patient conditions for any unaddressed active diagnoses.',
        'Document all chronic conditions managed during the encounter.',
      ],
      time_needed_for_next_level: null,
      additional_minutes_needed: null,
      diagnoses_needed_for_next_level: input.diagnosisCount + dxNeeded,
      data_complexity_needed: null,
      risk_level_needed: null,
    };
  }

  if (dataGap !== null) {
    return {
      category: 'data_complexity_gap',
      targetLevel: nextLevel,
      targetCode,
      gap_description: `Upgrade data complexity from "${input.dataComplexity ?? 'minimal'}" to "${dataGap}" for ${targetCode}`,
      actionable_steps: [
        `Current data complexity: ${input.dataComplexity ?? 'minimal'}. Needs: ${dataGap}.`,
        'Document review of external records, independent interpretation of tests, or discussion of discordant data.',
      ],
      time_needed_for_next_level: null,
      additional_minutes_needed: null,
      diagnoses_needed_for_next_level: null,
      data_complexity_needed: dataGap,
      risk_level_needed: null,
    };
  }

  if (riskGap !== null) {
    return {
      category: 'risk_gap',
      targetLevel: nextLevel,
      targetCode,
      gap_description: `Upgrade risk level from "${input.riskLevel ?? 'minimal'}" to "${riskGap}" for ${targetCode}`,
      actionable_steps: [
        `Current risk: ${input.riskLevel ?? 'minimal'}. Needs: ${riskGap}.`,
        'Document prescription drug management, decision regarding minor or major surgery, or parenteral controlled substance use.',
      ],
      time_needed_for_next_level: null,
      additional_minutes_needed: null,
      diagnoses_needed_for_next_level: null,
      data_complexity_needed: null,
      risk_level_needed: riskGap,
    };
  }

  return null;
}

function getDiagnosisGap(currentCount: number, _currentLevel: number, nextLevel: number): number | null {
  // CMS MDM: 0→L1, 1→L2, 2→L3, 3+ w/high risk→L4
  const thresholds: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3 };
  const needed = thresholds[nextLevel];
  if (needed === undefined) return null;
  const diff = needed - currentCount;
  return diff > 0 ? diff : null;
}

function getDataComplexityGap(current: string | null, _currentLevel: number, nextLevel: number): string | null {
  const currentNum = DATA_COMPLEXITY_LEVELS[current ?? 'minimal'] ?? 1;
  const neededNum = nextLevel > 4 ? 4 : nextLevel;
  if (currentNum < neededNum) {
    return DATA_COMPLEXITY_NAMES[neededNum] ?? null;
  }
  return null;
}

function getRiskLevelGap(current: string | null, _currentLevel: number, nextLevel: number): string | null {
  const currentNum = RISK_LEVELS[current ?? 'minimal'] ?? 1;
  const neededNum = nextLevel > 4 ? 4 : nextLevel;
  if (currentNum < neededNum) {
    return RISK_NAMES[neededNum] ?? null;
  }
  return null;
}

// -- Service --

export const documentationGapService = {
  /**
   * Get pre-billing documentation gaps — encounters with AI suggestions
   * where additional documentation could qualify for higher E/M level.
   */
  async getDocumentationGaps(
    filters?: DocumentationGapFilters
  ): Promise<ServiceResult<DocumentationGap[]>> {
    try {
      const minConfidence = filters?.min_confidence ?? 0.75;

      // 1. Fetch billing suggestions that are still pre-billing
      const { data: suggestions, error: suggestionsError } = await supabase
        .from('encounter_billing_suggestions')
        .select('id, encounter_id, suggested_codes, overall_confidence, status, encounter_type, created_at')
        .in('status', ['pending', 'accepted'])
        .gte('overall_confidence', minConfidence)
        .order('created_at', { ascending: false })
        .limit(200);

      if (suggestionsError) {
        await auditLogger.error('DOC_GAP_SUGGESTIONS_FETCH_FAILED',
          new Error(suggestionsError.message),
          { context: 'getDocumentationGaps' }
        );
        return failure('DATABASE_ERROR', suggestionsError.message, suggestionsError);
      }

      if (!suggestions || suggestions.length === 0) {
        return success([]);
      }

      const typedSuggestions = suggestions as unknown as BillingSuggestionRow[];

      // 2. Get encounters — filter out already-finalized
      const encounterIds = [...new Set(typedSuggestions.map(s => s.encounter_id))];

      const { data: encounters } = await supabase
        .from('encounters')
        .select('id, date_of_service, patient_id, provider_id, status, time_spent')
        .in('id', encounterIds);

      const encounterMap = new Map<string, EncounterRow>();
      if (encounters) {
        for (const enc of encounters as unknown as EncounterRow[]) {
          if (!FINALIZED_STATUSES.includes(enc.status)) {
            encounterMap.set(enc.id, enc);
          }
        }
      }

      // 3. Get diagnosis counts per encounter
      const activeEncounterIds = [...encounterMap.keys()];
      const diagnosisCountMap = new Map<string, number>();

      if (activeEncounterIds.length > 0) {
        const { data: diagData } = await supabase
          .from('encounter_diagnoses')
          .select('encounter_id')
          .in('encounter_id', activeEncounterIds);

        if (diagData) {
          const rows = diagData as unknown as DiagnosisCountRow[];
          for (const row of rows) {
            const count = diagnosisCountMap.get(row.encounter_id) ?? 0;
            diagnosisCountMap.set(row.encounter_id, count + 1);
          }
        }
      }

      // 4. Process each suggestion — compute gap to next E/M level
      const gaps: DocumentationGap[] = [];

      for (const suggestion of typedSuggestions) {
        const encounter = encounterMap.get(suggestion.encounter_id);
        if (!encounter) continue;

        const suggestedPayload = suggestion.suggested_codes || {};
        const allCodes = [...(suggestedPayload.cpt || []), ...(suggestedPayload.hcpcs || [])];

        for (const entry of allCodes) {
          if (!isEMCode(entry.code)) continue;

          const currentLevel = getEMLevel(entry.code);
          if (currentLevel < 1 || currentLevel >= 5) continue;

          const isNew = isNewPatientCode(entry.code);
          const diagnosisCount = diagnosisCountMap.get(suggestion.encounter_id) ?? 0;

          const computed = computeDocumentationGap({
            currentLevel,
            currentCode: entry.code,
            isNew,
            timeMinutes: encounter.time_spent,
            diagnosisCount,
            dataComplexity: null,
            riskLevel: null,
          });

          if (!computed) continue;

          const currentCharge = await lookupFeePrice(entry.code);
          const targetCharge = await lookupFeePrice(computed.targetCode);
          const opportunity = targetCharge - currentCharge;

          if (opportunity <= 0) continue;

          const gap: DocumentationGap = {
            id: `${suggestion.id}-gap`,
            encounter_id: suggestion.encounter_id,
            patient_id: encounter.patient_id,
            date_of_service: encounter.date_of_service ?? suggestion.created_at.split('T')[0],
            encounter_type: suggestion.encounter_type,
            provider_id: encounter.provider_id,
            current_em_code: entry.code,
            current_em_level: currentLevel,
            current_charge: currentCharge,
            target_em_code: computed.targetCode,
            target_em_level: computed.targetLevel,
            target_charge: targetCharge,
            revenue_opportunity: opportunity,
            category: computed.category,
            gap_description: computed.gap_description,
            actionable_steps: computed.actionable_steps,
            confidence: entry.confidence ?? suggestion.overall_confidence,
            priority: assignPriority(opportunity),
            current_time_minutes: encounter.time_spent,
            time_needed_for_next_level: computed.time_needed_for_next_level,
            additional_minutes_needed: computed.additional_minutes_needed,
            current_diagnosis_count: diagnosisCount,
            diagnoses_needed_for_next_level: computed.diagnoses_needed_for_next_level,
            current_data_complexity: null,
            data_complexity_needed: computed.data_complexity_needed,
            current_risk_level: null,
            risk_level_needed: computed.risk_level_needed,
          };

          gaps.push(gap);
        }
      }

      // 5. Apply client-side filters
      let filtered = gaps;

      if (filters?.category) {
        filtered = filtered.filter(g => g.category === filters.category);
      }

      if (filters?.priority) {
        filtered = filtered.filter(g => g.priority === filters.priority);
      }

      if (filters?.search) {
        const q = filters.search.toLowerCase();
        filtered = filtered.filter(g =>
          g.current_em_code.toLowerCase().includes(q) ||
          g.target_em_code.toLowerCase().includes(q) ||
          g.gap_description.toLowerCase().includes(q)
        );
      }

      // Sort by revenue_opportunity descending
      filtered.sort((a, b) => b.revenue_opportunity - a.revenue_opportunity);

      await auditLogger.info('DOC_GAP_ANALYSIS_COMPLETE', {
        totalGaps: filtered.length,
        filtersApplied: !!filters,
      });

      return success(filtered);
    } catch (err: unknown) {
      await auditLogger.error('DOC_GAP_ANALYSIS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getDocumentationGaps' }
      );
      return failure('OPERATION_FAILED', 'Failed to analyze documentation gaps');
    }
  },

  /**
   * Get aggregate documentation gap statistics.
   */
  async getDocumentationGapStats(): Promise<ServiceResult<DocumentationGapStats>> {
    try {
      const gapsResult = await documentationGapService.getDocumentationGaps();

      if (!gapsResult.success) {
        return failure(gapsResult.error.code, gapsResult.error.message);
      }

      const gaps = gapsResult.data;
      const totalRevenue = gaps.reduce((sum, g) => sum + g.revenue_opportunity, 0);
      const uniqueEncounters = new Set(gaps.map(g => g.encounter_id)).size;

      const stats: DocumentationGapStats = {
        total_gaps: gaps.length,
        total_revenue_opportunity: totalRevenue,
        avg_opportunity_per_encounter: uniqueEncounters > 0
          ? totalRevenue / uniqueEncounters
          : 0,
        encounters_with_gaps: uniqueEncounters,
        gaps_by_category: {
          time_gap: gaps.filter(g => g.category === 'time_gap').length,
          diagnosis_gap: gaps.filter(g => g.category === 'diagnosis_gap').length,
          data_complexity_gap: gaps.filter(g => g.category === 'data_complexity_gap').length,
          risk_gap: gaps.filter(g => g.category === 'risk_gap').length,
        },
        gaps_by_priority: {
          high: gaps.filter(g => g.priority === 'high').length,
          medium: gaps.filter(g => g.priority === 'medium').length,
          low: gaps.filter(g => g.priority === 'low').length,
        },
      };

      return success(stats);
    } catch (err: unknown) {
      await auditLogger.error('DOC_GAP_STATS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getDocumentationGapStats' }
      );
      return failure('OPERATION_FAILED', 'Failed to compute documentation gap stats');
    }
  },

  /**
   * Dismiss a gap (provider reviewed and decided not to update documentation).
   * Gaps are computed on-the-fly, so dismissal is logged as an audit event.
   */
  async dismissGap(gapId: string, reason: string): Promise<ServiceResult<boolean>> {
    try {
      await auditLogger.info('DOC_GAP_DISMISSED', {
        gapId,
        reason,
        action: 'dismissed',
      });

      return success(true);
    } catch (err: unknown) {
      await auditLogger.error('DOC_GAP_DISMISS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'dismissGap', gapId }
      );
      return failure('OPERATION_FAILED', 'Failed to dismiss gap');
    }
  },

  /**
   * Acknowledge a gap (provider will update documentation).
   * Logged as an audit event for tracking.
   */
  async acknowledgeGap(gapId: string, encounterId: string): Promise<ServiceResult<boolean>> {
    try {
      await auditLogger.info('DOC_GAP_ACKNOWLEDGED', {
        gapId,
        encounterId,
        action: 'acknowledged',
      });

      return success(true);
    } catch (err: unknown) {
      await auditLogger.error('DOC_GAP_ACKNOWLEDGE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'acknowledgeGap', gapId, encounterId }
      );
      return failure('OPERATION_FAILED', 'Failed to acknowledge gap');
    }
  },
};
