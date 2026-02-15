/**
 * ERA Payment Posting Service
 *
 * Matches 835 remittance advice to claims, posts payments, and tracks
 * reconciliation status to close the revenue cycle.
 *
 * Used by: ERAPaymentPostingDashboard
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

export type MatchMethod = 'auto' | 'manual' | 'override';

export interface ClaimPayment {
  id: string;
  claim_id: string;
  remittance_id: string | null;
  paid_amount: number;
  adjustment_amount: number;
  patient_responsibility: number;
  allowed_amount: number | null;
  adjustment_reason_codes: AdjustmentReason[];
  check_number: string | null;
  payment_date: string | null;
  payer_claim_number: string | null;
  match_confidence: number;
  match_method: MatchMethod;
  posted_at: string;
  posted_by: string;
  tenant_id: string;
}

export interface AdjustmentReason {
  code: string;
  group: string;
  amount: number;
  description?: string;
}

export interface UnpostedRemittance {
  remittance_id: string;
  payer_name: string;
  received_at: string;
  total_paid: number;
  claim_count: number;
  posted_count: number;
  unposted_count: number;
}

export interface PaymentMatch {
  claim_id: string;
  control_number: string | null;
  payer_name: string | null;
  total_charge: number;
  paid_amount: number;
  adjustment_amount: number;
  patient_responsibility: number;
  match_confidence: number;
}

export interface PaymentPostRequest {
  claim_id: string;
  remittance_id: string | null;
  paid_amount: number;
  adjustment_amount: number;
  patient_responsibility: number;
  allowed_amount?: number;
  adjustment_reason_codes?: AdjustmentReason[];
  check_number?: string;
  payment_date?: string;
  payer_claim_number?: string;
  match_method: MatchMethod;
  match_confidence: number;
  tenant_id: string;
}

export interface PaymentStats {
  total_posted: number;
  total_paid_amount: number;
  total_adjustments: number;
  total_patient_responsibility: number;
  unposted_remittances: number;
  posted_today: number;
}

// =============================================================================
// DATABASE ROW INTERFACES
// =============================================================================

interface RemittanceRow {
  id: string;
  payer_id: string | null;
  received_at: string;
  summary: unknown;
  details: unknown;
  billing_payers: { name: string | null } | null;
}

interface ClaimPaymentRow {
  id: string;
  claim_id: string;
  remittance_id: string | null;
  paid_amount: number;
  adjustment_amount: number;
  patient_responsibility: number;
  allowed_amount: number | null;
  adjustment_reason_codes: unknown;
  check_number: string | null;
  payment_date: string | null;
  payer_claim_number: string | null;
  match_confidence: number;
  match_method: string;
  posted_at: string;
  posted_by: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

interface ClaimRow {
  id: string;
  control_number: string | null;
  total_charge: number | null;
  status: string;
  billing_payers: { name: string | null } | null;
}

// =============================================================================
// HELPERS
// =============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRemittanceSummary(raw: unknown): { total_paid: number; claim_count: number } {
  if (!raw || !isRecord(raw)) return { total_paid: 0, claim_count: 0 };
  return {
    total_paid: typeof raw.total_paid === 'number' ? raw.total_paid : 0,
    claim_count: typeof raw.claim_count === 'number' ? raw.claim_count : 0,
  };
}

function mapPaymentRow(row: ClaimPaymentRow): ClaimPayment {
  return {
    id: row.id,
    claim_id: row.claim_id,
    remittance_id: row.remittance_id,
    paid_amount: row.paid_amount ?? 0,
    adjustment_amount: row.adjustment_amount ?? 0,
    patient_responsibility: row.patient_responsibility ?? 0,
    allowed_amount: row.allowed_amount,
    adjustment_reason_codes: Array.isArray(row.adjustment_reason_codes)
      ? (row.adjustment_reason_codes as AdjustmentReason[])
      : [],
    check_number: row.check_number,
    payment_date: row.payment_date,
    payer_claim_number: row.payer_claim_number,
    match_confidence: row.match_confidence ?? 1,
    match_method: row.match_method as MatchMethod,
    posted_at: row.posted_at,
    posted_by: row.posted_by,
    tenant_id: row.tenant_id,
  };
}

// =============================================================================
// SERVICE
// =============================================================================

export const eraPaymentPostingService = {
  /**
   * Get remittances that have unposted claim payments.
   */
  async getUnpostedRemittances(): Promise<ServiceResult<UnpostedRemittance[]>> {
    try {
      const { data: remittances, error: remErr } = await supabase
        .from('remittances')
        .select('id, payer_id, received_at, summary, details, billing_payers(name)')
        .order('received_at', { ascending: false })
        .limit(100);

      if (remErr) {
        await auditLogger.error('ERA_UNPOSTED_FETCH_FAILED', 'Failed to fetch remittances', { context: 'getUnpostedRemittances' });
        return failure('DATABASE_ERROR', 'Failed to fetch remittances', remErr);
      }

      const rows = (remittances || []) as unknown as RemittanceRow[];
      const remittanceIds = rows.map(r => r.id);

      // Get posted payment counts per remittance
      const { data: paymentData } = await supabase
        .from('claim_payments')
        .select('remittance_id')
        .in('remittance_id', remittanceIds.length > 0 ? remittanceIds : ['__none__']);

      const postedCounts = new Map<string, number>();
      for (const p of (paymentData || []) as Array<{ remittance_id: string | null }>) {
        if (p.remittance_id) {
          postedCounts.set(p.remittance_id, (postedCounts.get(p.remittance_id) || 0) + 1);
        }
      }

      const result: UnpostedRemittance[] = rows.map(row => {
        const summary = parseRemittanceSummary(row.summary);
        const posted = postedCounts.get(row.id) || 0;

        return {
          remittance_id: row.id,
          payer_name: row.billing_payers?.name || 'Unknown Payer',
          received_at: row.received_at,
          total_paid: summary.total_paid,
          claim_count: summary.claim_count,
          posted_count: posted,
          unposted_count: Math.max(0, summary.claim_count - posted),
        };
      });

      // Filter to only show those with unposted items
      const unposted = result.filter(r => r.unposted_count > 0 || r.claim_count === 0);

      return success(unposted);
    } catch (err: unknown) {
      await auditLogger.error(
        'ERA_UNPOSTED_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getUnpostedRemittances' },
      );
      return failure('OPERATION_FAILED', 'Failed to fetch unposted remittances');
    }
  },

  /**
   * Post a payment to a claim, updating claim status to 'paid'.
   */
  async postPayment(request: PaymentPostRequest): Promise<ServiceResult<ClaimPayment>> {
    try {
      // 1. Verify claim exists and is in a postable state
      const { data: claim, error: claimErr } = await supabase
        .from('claims')
        .select('id, status')
        .eq('id', request.claim_id)
        .single();

      if (claimErr || !claim) {
        return failure('NOT_FOUND', 'Claim not found');
      }

      const claimData = claim as { id: string; status: string };
      const postableStatuses = ['submitted', 'accepted', 'generated'];
      if (!postableStatuses.includes(claimData.status) && claimData.status !== 'paid') {
        return failure('INVALID_STATE', `Claim status '${claimData.status}' is not eligible for payment posting`);
      }

      // 2. Insert payment record
      const { data: payment, error: payErr } = await supabase
        .from('claim_payments')
        .insert({
          claim_id: request.claim_id,
          remittance_id: request.remittance_id,
          paid_amount: request.paid_amount,
          adjustment_amount: request.adjustment_amount,
          patient_responsibility: request.patient_responsibility,
          allowed_amount: request.allowed_amount ?? null,
          adjustment_reason_codes: request.adjustment_reason_codes ?? [],
          check_number: request.check_number ?? null,
          payment_date: request.payment_date ?? null,
          payer_claim_number: request.payer_claim_number ?? null,
          match_confidence: request.match_confidence,
          match_method: request.match_method,
          tenant_id: request.tenant_id,
        })
        .select()
        .single();

      if (payErr || !payment) {
        await auditLogger.error('ERA_PAYMENT_INSERT_FAILED', 'Failed to insert payment', { claimId: request.claim_id });
        return failure('DATABASE_ERROR', 'Failed to post payment', payErr);
      }

      // 3. Update claim status to 'paid'
      await supabase
        .from('claims')
        .update({ status: 'paid' })
        .eq('id', request.claim_id);

      // 4. Record status transition
      await supabase
        .from('claim_status_history')
        .insert({
          claim_id: request.claim_id,
          from_status: claimData.status,
          to_status: 'paid',
          note: `Payment posted: $${request.paid_amount.toFixed(2)} via ${request.match_method} match`,
          created_by: (payment as ClaimPaymentRow).posted_by,
        });

      await auditLogger.clinical('ERA_PAYMENT_POSTED', true, {
        claimId: request.claim_id,
        paymentId: (payment as ClaimPaymentRow).id,
        paidAmount: request.paid_amount,
        adjustmentAmount: request.adjustment_amount,
        matchMethod: request.match_method,
        matchConfidence: request.match_confidence,
      });

      return success(mapPaymentRow(payment as ClaimPaymentRow));
    } catch (err: unknown) {
      await auditLogger.error(
        'ERA_PAYMENT_POST_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { claimId: request.claim_id },
      );
      return failure('OPERATION_FAILED', 'Failed to post payment');
    }
  },

  /**
   * Get payment posting stats.
   */
  async getPaymentStats(): Promise<ServiceResult<PaymentStats>> {
    try {
      const { data: payments, error: payErr } = await supabase
        .from('claim_payments')
        .select('id, paid_amount, adjustment_amount, patient_responsibility, posted_at');

      if (payErr) {
        return failure('DATABASE_ERROR', 'Failed to fetch payment stats', payErr);
      }

      const rows = (payments || []) as Array<{
        id: string;
        paid_amount: number;
        adjustment_amount: number;
        patient_responsibility: number;
        posted_at: string;
      }>;

      const today = new Date().toISOString().split('T')[0];

      const stats: PaymentStats = {
        total_posted: rows.length,
        total_paid_amount: 0,
        total_adjustments: 0,
        total_patient_responsibility: 0,
        unposted_remittances: 0,
        posted_today: 0,
      };

      for (const row of rows) {
        stats.total_paid_amount += row.paid_amount ?? 0;
        stats.total_adjustments += row.adjustment_amount ?? 0;
        stats.total_patient_responsibility += row.patient_responsibility ?? 0;
        if (row.posted_at.startsWith(today)) {
          stats.posted_today++;
        }
      }

      // Count unposted remittances
      const unpostedRes = await this.getUnpostedRemittances();
      if (unpostedRes.success) {
        stats.unposted_remittances = unpostedRes.data.length;
      }

      return success(stats);
    } catch (err: unknown) {
      await auditLogger.error(
        'ERA_PAYMENT_STATS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getPaymentStats' },
      );
      return failure('OPERATION_FAILED', 'Failed to compute payment stats');
    }
  },

  /**
   * Get all payments posted for a specific claim.
   */
  async getClaimPayments(claimId: string): Promise<ServiceResult<ClaimPayment[]>> {
    try {
      const { data, error } = await supabase
        .from('claim_payments')
        .select('*')
        .eq('claim_id', claimId)
        .order('posted_at', { ascending: false });

      if (error) {
        return failure('DATABASE_ERROR', 'Failed to fetch claim payments', error);
      }

      const rows = (data || []) as ClaimPaymentRow[];
      return success(rows.map(mapPaymentRow));
    } catch (err: unknown) {
      await auditLogger.error(
        'ERA_CLAIM_PAYMENTS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { claimId },
      );
      return failure('OPERATION_FAILED', 'Failed to fetch claim payments');
    }
  },

  /**
   * Get claims available for payment matching.
   */
  async getMatchableClaims(): Promise<ServiceResult<PaymentMatch[]>> {
    try {
      const { data, error } = await supabase
        .from('claims')
        .select('id, control_number, total_charge, status, billing_payers(name)')
        .in('status', ['submitted', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        return failure('DATABASE_ERROR', 'Failed to fetch matchable claims', error);
      }

      const rows = (data || []) as unknown as ClaimRow[];

      const matches: PaymentMatch[] = rows.map(row => ({
        claim_id: row.id,
        control_number: row.control_number,
        payer_name: row.billing_payers?.name || null,
        total_charge: row.total_charge ?? 0,
        paid_amount: 0,
        adjustment_amount: 0,
        patient_responsibility: 0,
        match_confidence: 0,
      }));

      return success(matches);
    } catch (err: unknown) {
      await auditLogger.error(
        'ERA_MATCHABLE_CLAIMS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getMatchableClaims' },
      );
      return failure('OPERATION_FAILED', 'Failed to fetch matchable claims');
    }
  },
};
