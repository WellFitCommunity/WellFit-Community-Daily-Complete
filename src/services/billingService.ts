// Comprehensive billing service for WellFit Community
// Production-grade database operations and business logic

import { supabase } from '../lib/supabaseClient';
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

    if (error) throw new Error(`Failed to create provider: ${error.message}`);
    return data;
  }

  static async getProvider(id: string): Promise<BillingProvider> {
    const { data, error } = await supabase
      .from('billing_providers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`Failed to get provider: ${error.message}`);
    return data;
  }

  static async getProviders(): Promise<BillingProvider[]> {
    const { data, error } = await supabase
      .from('billing_providers')
      .select('*')
      .order('organization_name');

    if (error) throw new Error(`Failed to get providers: ${error.message}`);
    return data || [];
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
    const { data, error } = await supabase
      .from('billing_payers')
      .select('*')
      .order('name');

    if (error) throw new Error(`Failed to get payers: ${error.message}`);
    return data || [];
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
    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get claims: ${error.message}`);
    return data || [];
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
    payload?: Record<string, any>
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
    const { data, error } = await supabase
      .from('claim_lines')
      .select('*')
      .eq('claim_id', claimId)
      .order('position');

    if (error) throw new Error(`Failed to get claim lines: ${error.message}`);
    return data || [];
  }

  // Fee Schedules
  static async getFeeSchedules(): Promise<FeeSchedule[]> {
    const { data, error } = await supabase
      .from('fee_schedules')
      .select('*')
      .order('name');

    if (error) throw new Error(`Failed to get fee schedules: ${error.message}`);
    return data || [];
  }

  static async getFeeScheduleItems(scheduleId: string): Promise<FeeScheduleItem[]> {
    const { data, error } = await supabase
      .from('fee_schedule_items')
      .select('*')
      .eq('fee_schedule_id', scheduleId)
      .order('code');

    if (error) throw new Error(`Failed to get fee schedule items: ${error.message}`);
    return data || [];
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
    const { data, error } = await supabase
      .from('coding_recommendations')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get coding recommendations: ${error.message}`);
    return data || [];
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
    let query = supabase.from('claims').select('status, total_charge');

    if (providerId) {
      query = query.eq('billing_provider_id', providerId);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to get claim metrics: ${error.message}`);

    const metrics = {
      total: data?.length || 0,
      byStatus: {} as Record<ClaimStatus, number>,
      totalAmount: 0,
    };

    data?.forEach((claim) => {
      const status = claim.status as ClaimStatus;
      metrics.byStatus[status] = (metrics.byStatus[status] || 0) + 1;
      metrics.totalAmount += Number(claim.total_charge || 0);
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
}

export default BillingService;