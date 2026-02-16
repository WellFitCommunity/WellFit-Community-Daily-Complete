/**
 * HCC Opportunity Service
 *
 * Purpose: Orchestrates detection of missing, expiring, and suspected HCC
 * (Hierarchical Condition Category) diagnoses for Medicare Advantage risk
 * adjustment. Delegates detection logic to hcc/hccDetectionEngine.ts.
 *
 * Used by: HCCOpportunityDashboard
 *
 * Architecture: Barrel re-export from src/services/hcc/ sub-modules.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';
import type {
  HCCOpportunity,
  HCCOpportunityStats,
  HCCOpportunityFilters,
  HCCCategoryRow,
  HCCMappingRow,
  HCCHierarchyRow,
} from './hcc/hccOpportunityTypes';
import {
  detectExpiringHCCs,
  detectDocumentedHCCs,
  detectSuspectedHCCs,
} from './hcc/hccDetectionEngine';

// Re-export types for consumers
export type {
  HCCOpportunity,
  HCCOpportunityStats,
  HCCOpportunityFilters,
  HCCOpportunityType,
  HCCOpportunityStatus,
} from './hcc/hccOpportunityTypes';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Apply hierarchy suppression: higher HCCs suppress lower ones per patient.
 */
function applyHierarchySuppression(
  opportunities: HCCOpportunity[],
  hierarchies: HCCHierarchyRow[]
): HCCOpportunity[] {
  if (hierarchies.length === 0) return opportunities;

  const suppressionMap = new Map<string, Set<string>>();
  for (const h of hierarchies) {
    const existing = suppressionMap.get(h.suppressed_hcc) || new Set();
    existing.add(h.higher_hcc);
    suppressionMap.set(h.suppressed_hcc, existing);
  }

  const patientHCCs = new Map<string, Set<string>>();
  for (const opp of opportunities) {
    const existing = patientHCCs.get(opp.patient_id) || new Set();
    existing.add(opp.hcc_code);
    patientHCCs.set(opp.patient_id, existing);
  }

  return opportunities.filter(opp => {
    const higherHCCs = suppressionMap.get(opp.hcc_code);
    if (!higherHCCs) return true;

    const patientCodes = patientHCCs.get(opp.patient_id);
    if (!patientCodes) return true;

    for (const higher of higherHCCs) {
      if (patientCodes.has(higher)) return false;
    }
    return true;
  });
}

// =============================================================================
// SERVICE
// =============================================================================

export const hccOpportunityService = {
  /**
   * Get HCC opportunities across all detection types.
   */
  async getHCCOpportunities(
    filters?: HCCOpportunityFilters
  ): Promise<ServiceResult<HCCOpportunity[]>> {
    try {
      // 1. Load HCC reference data
      const [categoriesRes, mappingsRes, hierarchiesRes] = await Promise.all([
        supabase.from('hcc_categories').select('hcc_code, description, coefficient').eq('is_active', true),
        supabase.from('icd10_hcc_mappings').select('icd10_code, hcc_code'),
        supabase.from('hcc_hierarchies').select('higher_hcc, suppressed_hcc'),
      ]);

      if (categoriesRes.error) {
        await auditLogger.error('HCC_CATEGORIES_FETCH_FAILED',
          new Error(categoriesRes.error.message),
          { context: 'getHCCOpportunities' }
        );
        return failure('DATABASE_ERROR', categoriesRes.error.message, categoriesRes.error);
      }

      const categories = (categoriesRes.data || []) as unknown as HCCCategoryRow[];
      const mappings = (mappingsRes.data || []) as unknown as HCCMappingRow[];
      const hierarchies = (hierarchiesRes.data || []) as unknown as HCCHierarchyRow[];

      if (categories.length === 0 || mappings.length === 0) {
        return success([]);
      }

      // Build lookup maps
      const categoryMap = new Map<string, HCCCategoryRow>();
      for (const cat of categories) {
        categoryMap.set(cat.hcc_code, cat);
      }

      const icd10ToHCC = new Map<string, string>();
      for (const m of mappings) {
        icd10ToHCC.set(m.icd10_code, m.hcc_code);
      }

      // 2. Detect opportunities (delegated to detection engine)
      const allOpportunities: HCCOpportunity[] = [];
      const wantType = filters?.opportunity_type;

      if (!wantType || wantType === 'expiring_hcc') {
        const expiring = await detectExpiringHCCs(categoryMap, icd10ToHCC);
        allOpportunities.push(...expiring);
      }

      if (!wantType || wantType === 'documented_hcc') {
        const documented = await detectDocumentedHCCs(categoryMap, icd10ToHCC);
        allOpportunities.push(...documented);
      }

      if (!wantType || wantType === 'suspected_hcc') {
        const suspected = await detectSuspectedHCCs(categoryMap, icd10ToHCC);
        allOpportunities.push(...suspected);
      }

      // 3. Apply hierarchy suppression
      const suppressed = applyHierarchySuppression(allOpportunities, hierarchies);

      // 4. Apply additional filters
      let filtered = suppressed;

      if (filters?.min_confidence) {
        filtered = filtered.filter(o => o.confidence >= (filters.min_confidence ?? 0));
      }

      if (filters?.search) {
        const q = filters.search.toLowerCase();
        filtered = filtered.filter(o =>
          o.icd10_code.toLowerCase().includes(q) ||
          o.hcc_code.toLowerCase().includes(q) ||
          (o.icd10_description ?? '').toLowerCase().includes(q) ||
          o.hcc_description.toLowerCase().includes(q)
        );
      }

      // 5. Sort by annual impact descending
      filtered.sort((a, b) => b.annual_payment_impact - a.annual_payment_impact);

      await auditLogger.info('HCC_OPPORTUNITIES_FETCHED', {
        totalOpportunities: filtered.length,
        filtersApplied: !!filters,
      });

      return success(filtered);
    } catch (err: unknown) {
      await auditLogger.error('HCC_OPPORTUNITIES_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getHCCOpportunities' }
      );
      return failure('OPERATION_FAILED', 'Failed to fetch HCC opportunities');
    }
  },

  /**
   * Get aggregate HCC opportunity statistics.
   */
  async getHCCStats(): Promise<ServiceResult<HCCOpportunityStats>> {
    try {
      const oppsResult = await hccOpportunityService.getHCCOpportunities();

      if (!oppsResult.success) {
        return failure(oppsResult.error.code, oppsResult.error.message);
      }

      const opps = oppsResult.data;
      const totalImpact = opps.reduce((sum, o) => sum + o.annual_payment_impact, 0);
      const uniquePatients = new Set(opps.map(o => o.patient_id)).size;
      const totalRAF = opps.reduce((sum, o) => sum + o.raf_score_impact, 0);

      const stats: HCCOpportunityStats = {
        total_opportunities: opps.length,
        total_annual_impact: totalImpact,
        avg_raf_impact_per_patient: uniquePatients > 0 ? totalRAF / uniquePatients : 0,
        patients_with_gaps: uniquePatients,
        opportunities_by_type: {
          expiring_hcc: opps.filter(o => o.opportunity_type === 'expiring_hcc').length,
          suspected_hcc: opps.filter(o => o.opportunity_type === 'suspected_hcc').length,
          documented_hcc: opps.filter(o => o.opportunity_type === 'documented_hcc').length,
        },
      };

      return success(stats);
    } catch (err: unknown) {
      await auditLogger.error('HCC_STATS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getHCCStats' }
      );
      return failure('OPERATION_FAILED', 'Failed to compute HCC stats');
    }
  },

  /**
   * Dismiss an HCC opportunity (provider reviewed and disagrees or already captured).
   */
  async dismissOpportunity(opportunityId: string, reason: string): Promise<ServiceResult<boolean>> {
    try {
      await auditLogger.info('HCC_OPPORTUNITY_DISMISSED', {
        opportunityId,
        reason,
        action: 'dismissed',
      });

      return success(true);
    } catch (err: unknown) {
      await auditLogger.error('HCC_OPPORTUNITY_DISMISS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'dismissOpportunity', opportunityId }
      );
      return failure('OPERATION_FAILED', 'Failed to dismiss opportunity');
    }
  },
};
