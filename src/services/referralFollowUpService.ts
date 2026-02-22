/**
 * Referral Follow-Up Service — aging queries, follow-up history, config CRUD
 *
 * Purpose: Manages referral aging analysis, follow-up audit trail,
 * and per-tenant configuration for automated follow-up reminders.
 *
 * Used by: ReferralAgingDashboard, send-referral-followup-reminders edge function
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

export interface AgingReferral {
  referral_id: string;
  referral_source_id: string | null;
  source_org_name: string | null;
  patient_phone: string | null;
  patient_email: string | null;
  patient_first_name: string | null;
  patient_last_name: string | null;
  referral_status: string;
  aging_days: number;
  last_follow_up_at: string | null;
  follow_up_count: number;
  tenant_id: string;
}

export interface ReferralAgingStats {
  bucket_0_3: number;
  bucket_3_7: number;
  bucket_7_14: number;
  bucket_14_plus: number;
  status_pending: number;
  status_invited: number;
  status_enrolled: number;
  total_aging: number;
}

export type FollowUpType = 'sms' | 'email' | 'push' | 'provider_task' | 'escalation';
export type FollowUpReason =
  | 'pending_no_response'
  | 'enrolled_no_activity'
  | 'active_gone_dormant'
  | 'specialist_no_confirmation'
  | 'specialist_completion_recorded';
export type DeliveryStatus = 'sent' | 'delivered' | 'failed' | 'bounced';

export interface FollowUpLogEntry {
  id: string;
  referral_id: string;
  referral_source_id: string | null;
  follow_up_type: FollowUpType;
  follow_up_reason: FollowUpReason;
  aging_days: number;
  recipient_phone: string | null;
  recipient_email: string | null;
  delivery_status: DeliveryStatus;
  error_message: string | null;
  tenant_id: string;
  created_at: string;
}

export interface ReferralAgingConfig {
  id: string;
  tenant_id: string;
  day_3_action: string;
  day_7_action: string;
  day_14_action: string;
  cooldown_hours: number;
  max_follow_ups: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgingConfigUpdate {
  day_3_action?: string;
  day_7_action?: string;
  day_14_action?: string;
  cooldown_hours?: number;
  max_follow_ups?: number;
  is_active?: boolean;
}

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Get aging referrals that need follow-up via DB function
 */
async function getAgingReferrals(
  tenantId?: string
): Promise<ServiceResult<AgingReferral[]>> {
  try {
    const { data, error } = await supabase.rpc('get_aging_referrals', {
      p_tenant_id: tenantId ?? null,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to fetch aging referrals', error);
    }

    return success((data ?? []) as AgingReferral[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('REFERRAL_AGING_FETCH_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to fetch aging referrals', err);
  }
}

/**
 * Get aging stats (bucket counts) via DB function
 */
async function getAgingStats(
  tenantId?: string
): Promise<ServiceResult<ReferralAgingStats>> {
  try {
    const { data, error } = await supabase.rpc('get_referral_aging_stats', {
      p_tenant_id: tenantId ?? null,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to fetch aging stats', error);
    }

    // RPC returns a single row
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return success({
        bucket_0_3: 0,
        bucket_3_7: 0,
        bucket_7_14: 0,
        bucket_14_plus: 0,
        status_pending: 0,
        status_invited: 0,
        status_enrolled: 0,
        total_aging: 0,
      });
    }

    return success({
      bucket_0_3: Number(row.bucket_0_3) || 0,
      bucket_3_7: Number(row.bucket_3_7) || 0,
      bucket_7_14: Number(row.bucket_7_14) || 0,
      bucket_14_plus: Number(row.bucket_14_plus) || 0,
      status_pending: Number(row.status_pending) || 0,
      status_invited: Number(row.status_invited) || 0,
      status_enrolled: Number(row.status_enrolled) || 0,
      total_aging: Number(row.total_aging) || 0,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('REFERRAL_AGING_STATS_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to fetch aging stats', err);
  }
}

/**
 * Get follow-up history for a specific referral
 */
async function getFollowUpHistory(
  referralId: string
): Promise<ServiceResult<FollowUpLogEntry[]>> {
  try {
    const { data, error } = await supabase
      .from('referral_follow_up_log')
      .select('id, referral_id, referral_source_id, follow_up_type, follow_up_reason, aging_days, recipient_phone, recipient_email, delivery_status, error_message, tenant_id, created_at')
      .eq('referral_id', referralId)
      .order('created_at', { ascending: false });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to fetch follow-up history', error);
    }

    return success((data ?? []) as FollowUpLogEntry[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('REFERRAL_FOLLOWUP_HISTORY_FAILED', error, { referralId });
    return failure('OPERATION_FAILED', 'Failed to fetch follow-up history', err);
  }
}

/**
 * Trigger a manual follow-up for a referral
 */
async function triggerManualFollowUp(
  referralId: string,
  followUpType: FollowUpType,
  tenantId: string
): Promise<ServiceResult<FollowUpLogEntry>> {
  try {
    const { data, error } = await supabase
      .from('referral_follow_up_log')
      .insert({
        referral_id: referralId,
        follow_up_type: followUpType,
        follow_up_reason: 'pending_no_response' as FollowUpReason,
        aging_days: 0,
        delivery_status: 'sent' as DeliveryStatus,
        tenant_id: tenantId,
      })
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to create manual follow-up', error);
    }

    await auditLogger.info('REFERRAL_MANUAL_FOLLOWUP', {
      referralId,
      followUpType,
      tenantId,
    });

    return success(data as FollowUpLogEntry);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('REFERRAL_MANUAL_FOLLOWUP_FAILED', error, { referralId });
    return failure('OPERATION_FAILED', 'Failed to create manual follow-up', err);
  }
}

/**
 * Get aging config for a tenant
 */
async function getAgingConfig(
  tenantId: string
): Promise<ServiceResult<ReferralAgingConfig>> {
  try {
    const { data, error } = await supabase
      .from('referral_aging_config')
      .select('id, tenant_id, day_3_action, day_7_action, day_14_action, cooldown_hours, max_follow_ups, is_active, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to fetch aging config', error);
    }

    return success(data as ReferralAgingConfig);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('REFERRAL_AGING_CONFIG_FETCH_FAILED', error, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to fetch aging config', err);
  }
}

/**
 * Update aging config for a tenant
 */
async function updateAgingConfig(
  tenantId: string,
  config: AgingConfigUpdate
): Promise<ServiceResult<ReferralAgingConfig>> {
  try {
    const { data, error } = await supabase
      .from('referral_aging_config')
      .update(config)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to update aging config', error);
    }

    await auditLogger.info('REFERRAL_AGING_CONFIG_UPDATED', {
      tenantId,
      changes: config,
    });

    return success(data as ReferralAgingConfig);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('REFERRAL_AGING_CONFIG_UPDATE_FAILED', error, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to update aging config', err);
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const referralFollowUpService = {
  getAgingReferrals,
  getAgingStats,
  getFollowUpHistory,
  triggerManualFollowUp,
  getAgingConfig,
  updateAgingConfig,
};

export default referralFollowUpService;
