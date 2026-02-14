/**
 * Claim Aging Service — aging queries, stats, and claim status history
 *
 * Purpose: Queries claims table with LEFT JOIN to billing_payers,
 * computes aging days, provides bucket aggregation for dashboard metrics,
 * and retrieves claim status transition history.
 *
 * Used by: ClaimAgingDashboard
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

export interface AgingClaim {
  claim_id: string;
  encounter_id: string | null;
  payer_name: string | null;
  status: string;
  total_charge: number;
  control_number: string | null;
  created_at: string;
  updated_at: string;
  aging_days: number;
}

export interface ClaimAgingStats {
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  total_outstanding: number;
  total_amount: number;
}

export interface ClaimStatusEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
}

export type ClaimStatusFilter = 'all' | 'generated' | 'submitted' | 'accepted' | 'rejected';

/** Statuses that count as "outstanding" (not resolved) */
const OUTSTANDING_STATUSES = ['generated', 'submitted', 'accepted', 'rejected'];

interface ClaimAgingFilters {
  status?: ClaimStatusFilter;
  payerSearch?: string;
  controlNumberSearch?: string;
}

// =============================================================================
// DATABASE ROW INTERFACES (Supabase query shapes)
// =============================================================================

interface ClaimRow {
  id: string;
  encounter_id: string | null;
  status: string;
  total_charge: number | null;
  control_number: string | null;
  created_at: string;
  updated_at: string;
  billing_payers: { name: string } | null;
}

interface ClaimStatusHistoryRow {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function computeAgingDays(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

function mapRowToAgingClaim(row: ClaimRow): AgingClaim {
  const payerData = row.billing_payers;
  return {
    claim_id: row.id,
    encounter_id: row.encounter_id,
    payer_name: payerData ? payerData.name : null,
    status: row.status,
    total_charge: row.total_charge ?? 0,
    control_number: row.control_number,
    created_at: row.created_at,
    updated_at: row.updated_at,
    aging_days: computeAgingDays(row.created_at),
  };
}

// =============================================================================
// SERVICE
// =============================================================================

export const claimAgingService = {
  /**
   * Get all outstanding claims with aging data.
   * Only includes claims with status IN ('generated','submitted','accepted','rejected').
   * Optionally filters by status, payer name, or control number.
   */
  async getAgingClaims(
    filters?: ClaimAgingFilters
  ): Promise<ServiceResult<AgingClaim[]>> {
    try {
      let query = supabase
        .from('claims')
        .select('id, encounter_id, status, total_charge, control_number, created_at, updated_at, billing_payers(name)')
        .in('status', OUTSTANDING_STATUSES)
        .order('created_at', { ascending: true });

      // Apply status filter if not 'all'
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) {
        await auditLogger.error(
          'CLAIM_AGING_FETCH_FAILED',
          'Failed to fetch aging claims',
          { context: 'getAgingClaims' }
        );
        return failure('DATABASE_ERROR', 'Failed to fetch aging claims', error);
      }

      const rows = (data || []) as unknown as ClaimRow[];
      let claims = rows.map(mapRowToAgingClaim);

      // Client-side filtering for payer search
      if (filters?.payerSearch) {
        const search = filters.payerSearch.toLowerCase();
        claims = claims.filter(
          (c) => c.payer_name && c.payer_name.toLowerCase().includes(search)
        );
      }

      // Client-side filtering for control number search
      if (filters?.controlNumberSearch) {
        const search = filters.controlNumberSearch.toLowerCase();
        claims = claims.filter(
          (c) =>
            c.control_number &&
            c.control_number.toLowerCase().includes(search)
        );
      }

      return success(claims);
    } catch (err: unknown) {
      await auditLogger.error(
        'CLAIM_AGING_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getAgingClaims' }
      );
      return failure('OPERATION_FAILED', 'Failed to fetch aging claims');
    }
  },

  /**
   * Compute aggregate aging stats across all outstanding claims.
   * Returns bucket counts (0-30, 31-60, 61-90, 90+) and totals.
   */
  async getAgingStats(): Promise<ServiceResult<ClaimAgingStats>> {
    try {
      const { data, error } = await supabase
        .from('claims')
        .select('id, total_charge, created_at')
        .in('status', OUTSTANDING_STATUSES);

      if (error) {
        await auditLogger.error(
          'CLAIM_AGING_STATS_FAILED',
          'Failed to compute aging stats',
          { context: 'getAgingStats' }
        );
        return failure('DATABASE_ERROR', 'Failed to compute aging stats', error);
      }

      const rows = (data || []) as Array<{
        id: string;
        total_charge: number | null;
        created_at: string;
      }>;

      const stats: ClaimAgingStats = {
        bucket_0_30: 0,
        bucket_31_60: 0,
        bucket_61_90: 0,
        bucket_90_plus: 0,
        total_outstanding: rows.length,
        total_amount: 0,
      };

      for (const row of rows) {
        const days = computeAgingDays(row.created_at);
        const charge = row.total_charge ?? 0;
        stats.total_amount += charge;

        if (days <= 30) {
          stats.bucket_0_30++;
        } else if (days <= 60) {
          stats.bucket_31_60++;
        } else if (days <= 90) {
          stats.bucket_61_90++;
        } else {
          stats.bucket_90_plus++;
        }
      }

      return success(stats);
    } catch (err: unknown) {
      await auditLogger.error(
        'CLAIM_AGING_STATS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getAgingStats' }
      );
      return failure('OPERATION_FAILED', 'Failed to compute aging stats');
    }
  },

  /**
   * Get the status transition history for a specific claim.
   * Returns entries ordered by created_at DESC (most recent first).
   */
  async getClaimHistory(
    claimId: string
  ): Promise<ServiceResult<ClaimStatusEntry[]>> {
    try {
      const { data, error } = await supabase
        .from('claim_status_history')
        .select('id, from_status, to_status, note, created_at')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: false });

      if (error) {
        await auditLogger.error(
          'CLAIM_HISTORY_FETCH_FAILED',
          'Failed to fetch claim history',
          { claimId }
        );
        return failure('DATABASE_ERROR', 'Failed to fetch claim history', error);
      }

      const entries = (data || []) as ClaimStatusHistoryRow[];

      return success(entries);
    } catch (err: unknown) {
      await auditLogger.error(
        'CLAIM_HISTORY_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { claimId }
      );
      return failure('OPERATION_FAILED', 'Failed to fetch claim history');
    }
  },
};
