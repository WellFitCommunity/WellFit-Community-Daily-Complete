// Comprehensive billing service for WellFit Community
// Production-grade database operations and business logic
// HIPAA §164.312(b): PHI access logging enabled for patient-related operations

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { PAGINATION_LIMITS, applyLimit } from '../utils/pagination';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';
import type {
  BillingProvider,
  BillingPayer,
  Claim,
  ClaimLine,
  ClaimStatus,
  ClaimStatusHistory,
  CodingRecommendation,
  CodingSuggestion,
  FeeSchedule,
  FeeScheduleItem,
  ClearinghouseBatch,
  BatchStatus,
  CreateBillingProvider,
  UpdateBillingProvider,
  CreateClaim
} from '../types/billing';

export class BillingService {
  // Billing Providers
  static async createProvider(provider: CreateBillingProvider): Promise<BillingProvider> {
    const { data, error } = await supabase
      .from('billing_providers')
      .insert(provider)
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to create provider: ${error?.message ?? 'no data returned'}`);
    return data;
  }

  static async getProvider(id: string): Promise<BillingProvider> {
    const { data, error } = await supabase
      .from('billing_providers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new Error(`Failed to get provider: ${error?.message ?? 'not found'}`);
    return data;
  }

  static async getProviders(): Promise<BillingProvider[]> {
    const query = supabase
      .from('billing_providers')
      .select('*')
      .order('organization_name');

    return applyLimit<BillingProvider>(query, PAGINATION_LIMITS.PROVIDERS);
  }

  static async updateProvider(id: string, updates: UpdateBillingProvider): Promise<BillingProvider> {
    const { data, error } = await supabase
      .from('billing_providers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update provider: ${error.message}`);
    return data;
  }

  static async deleteProvider(id: string): Promise<void> {
    const { error } = await supabase
      .from('billing_providers')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete provider: ${error.message}`);
  }

  // Billing Payers
  static async createPayer(payer: Omit<BillingPayer, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<BillingPayer> {
    const { data, error } = await supabase
      .from('billing_payers')
      .insert(payer)
      .select()
      .single();

    if (error) throw new Error(`Failed to create payer: ${error.message}`);
    return data;
  }

  static async getPayers(): Promise<BillingPayer[]> {
    const query = supabase
      .from('billing_payers')
      .select('*')
      .order('name');

    return applyLimit<BillingPayer>(query, PAGINATION_LIMITS.PROVIDERS);
  }

  static async getPayer(id: string): Promise<BillingPayer> {
    const { data, error } = await supabase
      .from('billing_payers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`Failed to get payer: ${error.message}`);
    return data;
  }

  // Claims Management
  static async createClaim(claim: CreateClaim): Promise<Claim> {
    const { data, error } = await supabase
      .from('claims')
      .insert(claim)
      .select()
      .single();

    if (error) throw new Error(`Failed to create claim: ${error.message}`);
    return data;
  }

  static async getClaim(id: string): Promise<Claim> {
    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`Failed to get claim: ${error.message}`);
    return data;
  }

  static async getClaimsByEncounter(encounterId: string): Promise<Claim[]> {
    const query = supabase
      .from('claims')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false });

    // Encounters typically have 1-5 claims, but cap at reasonable limit
    return applyLimit<Claim>(query, 20);
  }

  static async updateClaimStatus(claimId: string, status: ClaimStatus, note?: string): Promise<Claim> {
    // First get current claim
    const currentClaim = await this.getClaim(claimId);

    // Update claim status
    const { data: updatedClaim, error: updateError } = await supabase
      .from('claims')
      .update({ status })
      .eq('id', claimId)
      .select()
      .single();

    if (updateError) throw new Error(`Failed to update claim status: ${updateError.message}`);

    // Log status change
    await this.logClaimStatusChange(claimId, currentClaim.status, status, note);

    return updatedClaim;
  }

  static async logClaimStatusChange(
    claimId: string,
    fromStatus: ClaimStatus,
    toStatus: ClaimStatus,
    note?: string,
    payload?: Record<string, unknown>
  ): Promise<ClaimStatusHistory> {
    const { data, error } = await supabase
      .from('claim_status_history')
      .insert({
        claim_id: claimId,
        from_status: fromStatus,
        to_status: toStatus,
        note,
        payload,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to log status change: ${error.message}`);
    return data;
  }

  // Claim Lines
  static async addClaimLine(claimLine: Omit<ClaimLine, 'id' | 'created_at' | 'updated_at'>): Promise<ClaimLine> {
    const { data, error } = await supabase
      .from('claim_lines')
      .insert(claimLine)
      .select()
      .single();

    if (error) throw new Error(`Failed to add claim line: ${error.message}`);
    return data;
  }

  static async getClaimLines(claimId: string): Promise<ClaimLine[]> {
    const query = supabase
      .from('claim_lines')
      .select('*')
      .eq('claim_id', claimId)
      .order('position');

    // Claims typically have 1-50 line items, use reasonable limit
    return applyLimit<ClaimLine>(query, PAGINATION_LIMITS.CLAIM_LINES);
  }

  // Fee Schedules
  static async getFeeSchedules(): Promise<FeeSchedule[]> {
    const query = supabase
      .from('fee_schedules')
      .select('*')
      .order('name');

    return applyLimit<FeeSchedule>(query, PAGINATION_LIMITS.FEE_SCHEDULES);
  }

  static async getFeeScheduleItems(scheduleId: string): Promise<FeeScheduleItem[]> {
    const query = supabase
      .from('fee_schedule_items')
      .select('*')
      .eq('fee_schedule_id', scheduleId)
      .order('code');

    // CRITICAL: Fee schedules contain 10,000+ CPT/HCPCS codes
    // Apply limit to prevent memory exhaustion
    return applyLimit<FeeScheduleItem>(query, PAGINATION_LIMITS.FEE_SCHEDULE_ITEMS);
  }

  static async lookupFee(
    scheduleId: string,
    codeSystem: 'CPT' | 'HCPCS',
    code: string,
    modifiers?: string[]
  ): Promise<number | null> {
    let query = supabase
      .from('fee_schedule_items')
      .select('price')
      .eq('fee_schedule_id', scheduleId)
      .eq('code_system', codeSystem)
      .eq('code', code);

    // Handle modifiers matching
    if (modifiers && modifiers.length > 0) {
      query = query
        .eq('modifier1', modifiers[0] || null)
        .eq('modifier2', modifiers[1] || null)
        .eq('modifier3', modifiers[2] || null)
        .eq('modifier4', modifiers[3] || null);
    } else {
      query = query
        .is('modifier1', null)
        .is('modifier2', null)
        .is('modifier3', null)
        .is('modifier4', null);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to lookup fee: ${error.message}`);
    }

    return data?.price || null;
  }

  // Coding Recommendations
  static async saveCodingRecommendation(
    encounterId: string,
    patientId: string | null,
    suggestion: CodingSuggestion,
    confidence?: number
  ): Promise<CodingRecommendation> {
    // HIPAA §164.312(b): Log PHI access
    if (patientId) {
      await auditLogger.phi('CODING_RECOMMENDATION_CREATE', patientId, {
        resourceType: 'CodingRecommendation',
        operation: 'saveCodingRecommendation',
        encounterId,
        confidence,
      });
    }

    const { data, error } = await supabase
      .from('coding_recommendations')
      .insert({
        encounter_id: encounterId,
        patient_id: patientId,
        payload: suggestion,
        confidence,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to save coding recommendation: ${error.message}`);
    return data;
  }

  static async getCodingRecommendations(encounterId: string): Promise<CodingRecommendation[]> {
    const query = supabase
      .from('coding_recommendations')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false });

    // Encounters typically have 1-10 coding recommendations
    return applyLimit<CodingRecommendation>(query, 20);
  }

  // X12 Generation
  static async generateX12Claim(encounterId: string, billingProviderId: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('generate-837p', {
      body: { encounterId, billingProviderId },
    });

    if (error) throw new Error(`Failed to generate X12 claim: ${error.message}`);

    if (typeof data === 'string') {
      return data;
    } else if (data && typeof data === 'object' && data.x12) {
      return data.x12;
    }

    throw new Error('Invalid X12 response format');
  }

  // Coding Suggestions
  static async getCodingSuggestions(encounterId: string): Promise<CodingSuggestion> {
    const { data, error } = await supabase.functions.invoke('coding-suggest', {
      body: {
        encounter: {
          id: encounterId,
        },
      },
    });

    if (error) throw new Error(`Failed to get coding suggestions: ${error.message}`);
    return data;
  }

  // Clearinghouse Batches
  static async createBatch(batchRef: string): Promise<ClearinghouseBatch> {
    const { data, error } = await supabase
      .from('clearinghouse_batches')
      .insert({
        batch_ref: batchRef,
        status: 'created',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create batch: ${error.message}`);
    return data;
  }

  static async addClaimToBatch(batchId: string, claimId: string, stControlNumber?: string): Promise<void> {
    const { error } = await supabase
      .from('clearinghouse_batch_items')
      .insert({
        batch_id: batchId,
        claim_id: claimId,
        st_control_number: stControlNumber,
        status: 'queued',
      });

    if (error) throw new Error(`Failed to add claim to batch: ${error.message}`);
  }

  static async updateBatchStatus(batchId: string, status: BatchStatus): Promise<void> {
    const { error } = await supabase
      .from('clearinghouse_batches')
      .update({ status })
      .eq('id', batchId);

    if (error) throw new Error(`Failed to update batch status: ${error.message}`);
  }

  // Utility Functions
  static async getClaimMetrics(providerId?: string): Promise<{
    total: number;
    byStatus: Record<ClaimStatus, number>;
    totalAmount: number;
  }> {
    // Use PostgreSQL aggregate function for accurate metrics across all claims
    // This replaces the previous client-side calculation which was limited by pagination
    const { data, error } = await supabase.rpc('get_claim_metrics', {
      p_provider_id: providerId || null,
    });

    if (error) {
      throw new Error(`Failed to get claim metrics: ${error.message}`);
    }

    const metrics = {
      total: 0,
      byStatus: {} as Record<ClaimStatus, number>,
      totalAmount: 0,
    };

    // Aggregate the results from the database function
    (data || []).forEach((row: { status: string; count: number; total_amount: number }) => {
      const status = row.status as ClaimStatus;
      metrics.byStatus[status] = Number(row.count);
      metrics.total += Number(row.count);
      metrics.totalAmount += Number(row.total_amount || 0);
    });

    return metrics;
  }

  static async searchClaims(filters: {
    status?: ClaimStatus;
    providerId?: string;
    payerId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<Claim[]> {
    let query = supabase.from('claims').select('*');

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.providerId) query = query.eq('billing_provider_id', filters.providerId);
    if (filters.payerId) query = query.eq('payer_id', filters.payerId);
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

    if (filters.limit) query = query.limit(filters.limit);

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw new Error(`Failed to search claims: ${error.message}`);
    return data || [];
  }

  // ==================== Superbill Approval Gate ====================

  /**
   * Approve a superbill (claim) for submission to clearinghouse.
   * Calls the atomic approve_superbill RPC function.
   */
  static async approveSuperbill(
    claimId: string,
    providerId: string,
    notes?: string
  ): Promise<ServiceResult<{ claim_id: string; approved_by: string; approved_at: string }>> {
    try {
      const { data, error } = await supabase.rpc('approve_superbill', {
        p_claim_id: claimId,
        p_provider_id: providerId,
        p_notes: notes || null,
      });

      if (error) {
        return failure('SUPERBILL_APPROVAL_FAILED', error.message, error);
      }

      await auditLogger.clinical('SUPERBILL_APPROVED', false, {
        claim_id: claimId,
        approved_by: providerId,
      });

      return success(data as { claim_id: string; approved_by: string; approved_at: string });
    } catch (err: unknown) {
      await auditLogger.error(
        'SUPERBILL_APPROVAL_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { claim_id: claimId, provider_id: providerId }
      );
      return failure('SUPERBILL_APPROVAL_FAILED', 'Failed to approve superbill');
    }
  }

  /**
   * Return a superbill for revision with a required reason.
   */
  static async rejectSuperbill(
    claimId: string,
    providerId: string,
    reason: string
  ): Promise<ServiceResult<{ claim_id: string }>> {
    try {
      if (!reason || reason.trim().length < 10) {
        return failure('SUPERBILL_REJECTION_FAILED', 'Rejection reason must be at least 10 characters');
      }

      const { data, error } = await supabase.rpc('reject_superbill', {
        p_claim_id: claimId,
        p_provider_id: providerId,
        p_reason: reason.trim(),
      });

      if (error) {
        return failure('SUPERBILL_REJECTION_FAILED', error.message, error);
      }

      await auditLogger.clinical('SUPERBILL_RETURNED', false, {
        claim_id: claimId,
        returned_by: providerId,
        reason: reason.trim(),
      });

      return success(data as { claim_id: string });
    } catch (err: unknown) {
      await auditLogger.error(
        'SUPERBILL_REJECTION_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { claim_id: claimId, provider_id: providerId }
      );
      return failure('SUPERBILL_REJECTION_FAILED', 'Failed to return superbill for revision');
    }
  }

  /**
   * Get claims awaiting provider approval.
   */
  static async getClaimsAwaitingApproval(
    providerId?: string,
    limit: number = 50
  ): Promise<Claim[]> {
    let query = supabase
      .from('claims')
      .select('*')
      .eq('approval_status', 'pending')
      .eq('status', 'generated')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (providerId) {
      query = query.eq('billing_provider_id', providerId);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to get claims awaiting approval: ${error.message}`);
    return data || [];
  }
}

export default BillingService;