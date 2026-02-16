/**
 * Claim Resubmission Service — correction chains, voiding, resubmission stats
 * Used by: ClaimResubmissionDashboard
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';

export interface DenialDetail {
  denial_code: string | null;
  denial_reason: string | null;
  appeal_deadline: string | null;
  appeal_status: string | null;
}

export interface RejectedClaim {
  claim_id: string;
  encounter_id: string | null;
  payer_name: string | null;
  status: string;
  total_charge: number;
  control_number: string | null;
  created_at: string;
  updated_at: string;
  aging_days: number;
  denial: DenialDetail | null;
  parent_claim_id: string | null;
  resubmission_count: number;
}

export interface ResubmissionStats {
  total_rejected: number;
  total_amount_at_risk: number;
  avg_days_since_rejection: number;
  resubmitted_count: number;
  voided_count: number;
  past_appeal_deadline: number;
}

export interface CorrectionPayload {
  original_claim_id: string;
  correction_note: string;
}

export interface ResubmissionChainEntry {
  claim_id: string;
  control_number: string | null;
  status: string;
  resubmission_count: number;
  is_current: boolean;
  created_at: string;
}

export type ResubmissionStatusFilter = 'all' | 'rejected' | 'void';

interface ClaimRow {
  id: string;
  encounter_id: string | null;
  status: string;
  total_charge: number | null;
  control_number: string | null;
  created_at: string;
  updated_at: string;
  parent_claim_id: string | null;
  resubmission_count: number | null;
  payer_id: string | null;
  billing_payers: { name: string | null } | null;
}

interface DenialRow {
  denial_code: string | null;
  denial_reason: string | null;
  appeal_deadline: string | null;
  appeal_status: string | null;
}

interface ClaimLineRow {
  code_system: string;
  procedure_code: string;
  modifiers: string[];
  units: number;
  charge_amount: number;
  diagnosis_pointers: number[];
  service_date: string | null;
  position: number | null;
}

interface ChainRow {
  id: string;
  control_number: string | null;
  status: string;
  resubmission_count: number | null;
  parent_claim_id: string | null;
  created_at: string;
}

function computeAgingDays(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

function mapChainRow(row: ChainRow, isCurrent: boolean): ResubmissionChainEntry {
  return {
    claim_id: row.id,
    control_number: row.control_number,
    status: row.status,
    resubmission_count: row.resubmission_count ?? 0,
    is_current: isCurrent,
    created_at: row.created_at,
  };
}

function mapRowToRejectedClaim(row: ClaimRow, denial: DenialDetail | null): RejectedClaim {
  return {
    claim_id: row.id,
    encounter_id: row.encounter_id,
    payer_name: row.billing_payers?.name || null,
    status: row.status,
    total_charge: row.total_charge ?? 0,
    control_number: row.control_number,
    created_at: row.created_at,
    updated_at: row.updated_at,
    aging_days: computeAgingDays(row.created_at),
    denial,
    parent_claim_id: row.parent_claim_id,
    resubmission_count: row.resubmission_count ?? 0,
  };
}

export const claimResubmissionService = {
  /** Get rejected and voided claims with denial details and aging. */
  async getRejectedClaims(
    filter?: ResubmissionStatusFilter,
    search?: string
  ): Promise<ServiceResult<RejectedClaim[]>> {
    try {
      const statuses = filter === 'rejected' ? ['rejected']
        : filter === 'void' ? ['void']
        : ['rejected', 'void'];

      const { data, error } = await supabase
        .from('claims')
        .select(
          'id, encounter_id, status, total_charge, control_number, created_at, updated_at, parent_claim_id, resubmission_count, payer_id, billing_payers(name)'
        )
        .in('status', statuses)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        await auditLogger.error(
          'CLAIM_RESUBMISSION_FETCH_FAILED',
          'Failed to fetch rejected claims',
          { context: 'getRejectedClaims' }
        );
        return failure('DATABASE_ERROR', 'Failed to fetch rejected claims', error);
      }

      const rows = (data || []) as unknown as ClaimRow[];
      const claimIds = rows.map(r => r.id);

      // Batch-fetch denial details
      const denialMap = new Map<string, DenialDetail>();
      if (claimIds.length > 0) {
        const { data: denials } = await supabase
          .from('claim_denials')
          .select('claim_id, denial_code, denial_reason, appeal_deadline, appeal_status')
          .in('claim_id', claimIds);

        for (const d of (denials || []) as Array<DenialRow & { claim_id: string }>) {
          denialMap.set(d.claim_id, {
            denial_code: d.denial_code,
            denial_reason: d.denial_reason,
            appeal_deadline: d.appeal_deadline,
            appeal_status: d.appeal_status,
          });
        }
      }

      let claims = rows.map(row => mapRowToRejectedClaim(row, denialMap.get(row.id) || null));

      // Client-side search on payer name or control number
      if (search) {
        const term = search.toLowerCase();
        claims = claims.filter(c =>
          (c.payer_name && c.payer_name.toLowerCase().includes(term)) ||
          (c.control_number && c.control_number.toLowerCase().includes(term))
        );
      }

      return success(claims);
    } catch (err: unknown) {
      await auditLogger.error(
        'CLAIM_RESUBMISSION_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getRejectedClaims' }
      );
      return failure('OPERATION_FAILED', 'Failed to fetch rejected claims');
    }
  },

  /** Compute aggregate stats for rejected/voided claims. */
  async getResubmissionStats(): Promise<ServiceResult<ResubmissionStats>> {
    try {
      const { data, error } = await supabase
        .from('claims')
        .select('id, status, total_charge, created_at, parent_claim_id')
        .in('status', ['rejected', 'void']);

      if (error) {
        await auditLogger.error(
          'CLAIM_RESUBMISSION_STATS_FAILED',
          'Failed to compute resubmission stats',
          { context: 'getResubmissionStats' }
        );
        return failure('DATABASE_ERROR', 'Failed to compute resubmission stats', error);
      }

      const rows = (data || []) as Array<{
        id: string;
        status: string;
        total_charge: number | null;
        created_at: string;
        parent_claim_id: string | null;
      }>;

      // Also count claims that have a parent (resubmitted children)
      const { data: resubmittedChildren } = await supabase
        .from('claims')
        .select('id')
        .not('parent_claim_id', 'is', null);

      const resubmittedCount = (resubmittedChildren || []).length;

      // Get denial deadlines for past-deadline count
      const rejectedIds = rows.filter(r => r.status === 'rejected').map(r => r.id);
      let pastDeadlineCount = 0;

      if (rejectedIds.length > 0) {
        const { data: denials } = await supabase
          .from('claim_denials')
          .select('claim_id, appeal_deadline')
          .in('claim_id', rejectedIds);

        const today = new Date().toISOString().split('T')[0];
        for (const d of (denials || []) as Array<{ claim_id: string; appeal_deadline: string | null }>) {
          if (d.appeal_deadline && d.appeal_deadline < today) {
            pastDeadlineCount++;
          }
        }
      }

      const rejected = rows.filter(r => r.status === 'rejected');
      const voided = rows.filter(r => r.status === 'void');

      const totalDays = rejected.reduce((sum, r) => sum + computeAgingDays(r.created_at), 0);

      const stats: ResubmissionStats = {
        total_rejected: rejected.length,
        total_amount_at_risk: rejected.reduce((sum, r) => sum + (r.total_charge ?? 0), 0),
        avg_days_since_rejection: rejected.length > 0 ? Math.round(totalDays / rejected.length) : 0,
        resubmitted_count: resubmittedCount,
        voided_count: voided.length,
        past_appeal_deadline: pastDeadlineCount,
      };

      return success(stats);
    } catch (err: unknown) {
      await auditLogger.error(
        'CLAIM_RESUBMISSION_STATS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getResubmissionStats' }
      );
      return failure('OPERATION_FAILED', 'Failed to compute resubmission stats');
    }
  },

  /** Get the latest denial detail for a claim. */
  async getDenialDetails(claimId: string): Promise<ServiceResult<DenialDetail | null>> {
    try {
      const { data, error } = await supabase
        .from('claim_denials')
        .select('denial_code, denial_reason, appeal_deadline, appeal_status')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        await auditLogger.error(
          'CLAIM_DENIAL_FETCH_FAILED',
          'Failed to fetch denial details',
          { claimId }
        );
        return failure('DATABASE_ERROR', 'Failed to fetch denial details', error);
      }

      const rows = (data || []) as DenialRow[];
      if (rows.length === 0) {
        return success(null);
      }

      return success({
        denial_code: rows[0].denial_code,
        denial_reason: rows[0].denial_reason,
        appeal_deadline: rows[0].appeal_deadline,
        appeal_status: rows[0].appeal_status,
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'CLAIM_DENIAL_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { claimId }
      );
      return failure('OPERATION_FAILED', 'Failed to fetch denial details');
    }
  },

  /** Create a corrected child claim from a rejected original. */
  async createCorrectedClaim(
    payload: CorrectionPayload
  ): Promise<ServiceResult<{ new_claim_id: string }>> {
    try {
      // 1. Verify original status
      const { data: original, error: origErr } = await supabase
        .from('claims')
        .select(
          'id, encounter_id, payer_id, billing_provider_id, claim_type, status, total_charge, resubmission_count, created_by'
        )
        .eq('id', payload.original_claim_id)
        .single();

      if (origErr || !original) {
        return failure('NOT_FOUND', 'Original claim not found');
      }

      const orig = original as {
        id: string;
        encounter_id: string;
        payer_id: string | null;
        billing_provider_id: string | null;
        claim_type: string;
        status: string;
        total_charge: number | null;
        resubmission_count: number | null;
        created_by: string;
      };

      if (orig.status !== 'rejected') {
        return failure(
          'INVALID_STATE',
          `Cannot correct a claim in '${orig.status}' status — only rejected claims can be corrected`
        );
      }

      const newResubCount = (orig.resubmission_count ?? 0) + 1;

      // 2. Insert corrected claim
      const { data: newClaim, error: insertErr } = await supabase
        .from('claims')
        .insert({
          encounter_id: orig.encounter_id,
          payer_id: orig.payer_id,
          billing_provider_id: orig.billing_provider_id,
          claim_type: orig.claim_type,
          status: 'generated',
          total_charge: orig.total_charge,
          parent_claim_id: orig.id,
          resubmission_count: newResubCount,
          created_by: orig.created_by,
        })
        .select('id')
        .single();

      if (insertErr || !newClaim) {
        await auditLogger.error(
          'CLAIM_CORRECTION_INSERT_FAILED',
          'Failed to insert corrected claim',
          { originalClaimId: payload.original_claim_id }
        );
        return failure('DATABASE_ERROR', 'Failed to create corrected claim', insertErr);
      }

      const newClaimId = (newClaim as { id: string }).id;

      // 3. Copy claim lines
      const { data: lines } = await supabase
        .from('claim_lines')
        .select('code_system, procedure_code, modifiers, units, charge_amount, diagnosis_pointers, service_date, position')
        .eq('claim_id', orig.id);

      const lineRows = (lines || []) as ClaimLineRow[];
      if (lineRows.length > 0) {
        const newLines = lineRows.map(l => ({
          claim_id: newClaimId,
          code_system: l.code_system,
          procedure_code: l.procedure_code,
          modifiers: l.modifiers,
          units: l.units,
          charge_amount: l.charge_amount,
          diagnosis_pointers: l.diagnosis_pointers,
          service_date: l.service_date,
          position: l.position,
        }));

        await supabase.from('claim_lines').insert(newLines);
      }

      // 4. Void original
      await supabase
        .from('claims')
        .update({ status: 'void' })
        .eq('id', orig.id);

      // 5. Status history for original (rejected → void)
      await supabase.from('claim_status_history').insert({
        claim_id: orig.id,
        from_status: 'rejected',
        to_status: 'void',
        note: `Replaced by corrected claim. Correction note: ${payload.correction_note}`,
        created_by: orig.created_by,
      });

      // Status history for new claim
      await supabase.from('claim_status_history').insert({
        claim_id: newClaimId,
        from_status: null,
        to_status: 'generated',
        note: `Corrected from claim ${orig.id}. Note: ${payload.correction_note}`,
        created_by: orig.created_by,
      });

      await auditLogger.clinical('CLAIM_CORRECTION_CREATED', true, {
        originalClaimId: orig.id,
        newClaimId,
        resubmissionCount: newResubCount,
        correctionNote: payload.correction_note,
      });

      return success({ new_claim_id: newClaimId });
    } catch (err: unknown) {
      await auditLogger.error(
        'CLAIM_CORRECTION_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { originalClaimId: payload.original_claim_id }
      );
      return failure('OPERATION_FAILED', 'Failed to create corrected claim');
    }
  },

  /** Void a rejected claim with a reason (min 10 chars). */
  async voidRejectedClaim(
    claimId: string,
    reason: string
  ): Promise<ServiceResult<{ voided: boolean }>> {
    try {
      if (reason.length < 10) {
        return failure('VALIDATION_ERROR', 'Void reason must be at least 10 characters');
      }

      const { data: claim, error: claimErr } = await supabase
        .from('claims')
        .select('id, status, created_by')
        .eq('id', claimId)
        .single();

      if (claimErr || !claim) {
        return failure('NOT_FOUND', 'Claim not found');
      }

      const claimData = claim as { id: string; status: string; created_by: string };

      if (claimData.status !== 'rejected') {
        return failure(
          'INVALID_STATE',
          `Cannot void a claim in '${claimData.status}' status — only rejected claims can be voided from this workflow`
        );
      }

      await supabase
        .from('claims')
        .update({ status: 'void' })
        .eq('id', claimId);

      await supabase.from('claim_status_history').insert({
        claim_id: claimId,
        from_status: 'rejected',
        to_status: 'void',
        note: `Voided: ${reason}`,
        created_by: claimData.created_by,
      });

      await auditLogger.clinical('CLAIM_VOIDED', true, {
        claimId,
        voidReason: reason,
      });

      return success({ voided: true });
    } catch (err: unknown) {
      await auditLogger.error(
        'CLAIM_VOID_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { claimId }
      );
      return failure('OPERATION_FAILED', 'Failed to void claim');
    }
  },

  /** Walk the resubmission chain (up to root, down to children). */
  async getResubmissionChain(
    claimId: string
  ): Promise<ServiceResult<ResubmissionChainEntry[]>> {
    try {
      // Fetch all claims to build chain — in practice chains are short (2-5)
      // so we fetch the specific claim, walk up to root, then collect children
      const chain: ResubmissionChainEntry[] = [];
      const visited = new Set<string>();

      // Start with the target claim
      const { data: startClaim, error: startErr } = await supabase
        .from('claims')
        .select('id, control_number, status, resubmission_count, parent_claim_id, created_at')
        .eq('id', claimId)
        .single();

      if (startErr || !startClaim) {
        return failure('NOT_FOUND', 'Claim not found');
      }

      const start = startClaim as ChainRow;

      // Walk up to root
      let current: ChainRow | null = start;
      const ancestors: ChainRow[] = [];

      while (current?.parent_claim_id && !visited.has(current.parent_claim_id)) {
        visited.add(current.id);
        const { data: parent } = await supabase
          .from('claims')
          .select('id, control_number, status, resubmission_count, parent_claim_id, created_at')
          .eq('id', current.parent_claim_id)
          .single();

        if (!parent) break;
        const parentRow = parent as ChainRow;
        ancestors.unshift(parentRow);
        current = parentRow;
      }

      // Walk down from target to children
      visited.clear();
      visited.add(claimId);
      const descendants: ChainRow[] = [];

      const { data: children } = await supabase
        .from('claims')
        .select('id, control_number, status, resubmission_count, parent_claim_id, created_at')
        .eq('parent_claim_id', claimId);

      for (const child of (children || []) as ChainRow[]) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          descendants.push(child);
        }
      }

      // Build chain: ancestors → target → descendants
      for (const a of ancestors) chain.push(mapChainRow(a, false));
      chain.push(mapChainRow(start, true));
      for (const d of descendants) chain.push(mapChainRow(d, false));

      return success(chain);
    } catch (err: unknown) {
      await auditLogger.error(
        'CLAIM_CHAIN_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { claimId }
      );
      return failure('OPERATION_FAILED', 'Failed to fetch resubmission chain');
    }
  },
};
