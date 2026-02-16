/**
 * Referral Completion Service — specialist confirmation tracking
 *
 * Purpose: Records specialist completion, queries awaiting/overdue referrals,
 * and provides completion stats for the ReferralCompletionDashboard.
 *
 * Separate from referralFollowUpService.ts — different domain concern
 * (completion confirmation vs. follow-up reminders).
 *
 * Used by: ReferralCompletionDashboard, ReferralCompletionModals
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';
import type { FollowUpLogEntry } from './referralFollowUpService';

// =============================================================================
// TYPES
// =============================================================================

export interface AwaitingReferral {
  referral_id: string;
  referral_source_id: string | null;
  source_org_name: string | null;
  patient_first_name: string | null;
  patient_last_name: string | null;
  referral_status: string;
  referral_reason: string | null;
  created_at: string;
  days_waiting: number;
  specialist_completion_status: string;
  specialist_name: string | null;
  specialist_completion_date: string | null;
  specialist_confirmed_at: string | null;
  tenant_id: string;
}

export interface CompletionStats {
  total_awaiting: number;
  total_overdue: number;
  confirmed_this_month: number;
  avg_days_to_confirm: number | null;
}

export interface RecordCompletionInput {
  referral_id: string;
  specialist_name: string;
  completion_date: string;
  report?: string;
  recommendations?: string;
}

export interface CompletionResult {
  success: boolean;
  referral_id: string;
  confirmed_at: string;
  confirmed_by: string;
}

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Get referrals awaiting specialist confirmation via RPC
 */
async function getAwaitingConfirmation(
  tenantId?: string
): Promise<ServiceResult<AwaitingReferral[]>> {
  try {
    const { data, error } = await supabase.rpc('get_referrals_awaiting_confirmation', {
      p_tenant_id: tenantId ?? null,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to fetch awaiting referrals', error);
    }

    return success((data ?? []) as AwaitingReferral[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('REFERRAL_COMPLETION_FETCH_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to fetch awaiting referrals', err);
  }
}

/**
 * Get completion stats (KPI metrics) via RPC
 */
async function getCompletionStats(
  tenantId?: string
): Promise<ServiceResult<CompletionStats>> {
  try {
    const { data, error } = await supabase.rpc('get_referral_completion_stats', {
      p_tenant_id: tenantId ?? null,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to fetch completion stats', error);
    }

    // RPC returns a single row
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return success({
        total_awaiting: 0,
        total_overdue: 0,
        confirmed_this_month: 0,
        avg_days_to_confirm: null,
      });
    }

    return success({
      total_awaiting: Number(row.total_awaiting) || 0,
      total_overdue: Number(row.total_overdue) || 0,
      confirmed_this_month: Number(row.confirmed_this_month) || 0,
      avg_days_to_confirm: row.avg_days_to_confirm != null
        ? Number(row.avg_days_to_confirm)
        : null,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('REFERRAL_COMPLETION_STATS_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to fetch completion stats', err);
  }
}

/**
 * Record specialist completion via RPC
 */
async function recordCompletion(
  input: RecordCompletionInput
): Promise<ServiceResult<CompletionResult>> {
  try {
    const { data, error } = await supabase.rpc('record_specialist_completion', {
      p_referral_id: input.referral_id,
      p_specialist_name: input.specialist_name,
      p_completion_date: input.completion_date,
      p_report: input.report ?? null,
      p_recommendations: input.recommendations ?? null,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to record specialist completion', error);
    }

    const result = data as Record<string, unknown>;
    if (!result?.success) {
      return failure(
        'VALIDATION_ERROR',
        (result?.error as string) || 'Failed to record specialist completion'
      );
    }

    await auditLogger.info('SPECIALIST_COMPLETION_RECORDED', {
      referralId: input.referral_id,
      specialistName: input.specialist_name,
      completionDate: input.completion_date,
    });

    return success({
      success: true,
      referral_id: result.referral_id as string,
      confirmed_at: result.confirmed_at as string,
      confirmed_by: result.confirmed_by as string,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('SPECIALIST_COMPLETION_RECORD_FAILED', error, {
      referralId: input.referral_id,
    });
    return failure('OPERATION_FAILED', 'Failed to record specialist completion', err);
  }
}

/**
 * Get completion history from follow-up log (specialist-related entries)
 */
async function getCompletionHistory(
  referralId: string
): Promise<ServiceResult<FollowUpLogEntry[]>> {
  try {
    const { data, error } = await supabase
      .from('referral_follow_up_log')
      .select('*')
      .eq('referral_id', referralId)
      .in('follow_up_reason', ['specialist_no_confirmation', 'specialist_completion_recorded'])
      .order('created_at', { ascending: false });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to fetch completion history', error);
    }

    return success((data ?? []) as FollowUpLogEntry[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('REFERRAL_COMPLETION_HISTORY_FAILED', error, { referralId });
    return failure('OPERATION_FAILED', 'Failed to fetch completion history', err);
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const referralCompletionService = {
  getAwaitingConfirmation,
  getCompletionStats,
  recordCompletion,
  getCompletionHistory,
};

export default referralCompletionService;
