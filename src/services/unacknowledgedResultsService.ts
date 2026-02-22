/**
 * Unacknowledged Results Service
 *
 * Purpose: Track and manage unacknowledged diagnostic report results.
 * Queries the v_unacknowledged_results view for aging/priority data,
 * and inserts into result_acknowledgments for clinician review tracking.
 *
 * Used by: UnacknowledgedResultsDashboard (admin panel, patient-care category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type AgingStatus = 'critical' | 'overdue' | 'warning' | 'normal';
export type AcknowledgmentType = 'read_only' | 'reviewed' | 'action_taken' | 'escalated';

export interface UnacknowledgedResult {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  code_display: string;
  category: string[];
  status: string;
  report_priority: string | null;
  issued: string;
  conclusion: string | null;
  tenant_id: string | null;
  hours_since_issued: number;
  aging_status: AgingStatus;
}

export interface ResultMetrics {
  total_unacknowledged: number;
  critical_count: number;
  overdue_count: number;
  warning_count: number;
  by_category: { category: string; count: number }[];
  by_priority: { priority: string; count: number }[];
}

export interface Acknowledgment {
  id: string;
  report_id: string;
  acknowledged_by: string;
  acknowledged_at: string;
  acknowledgment_type: AcknowledgmentType;
  notes: string | null;
}

export interface UnacknowledgedResultsFilters {
  priority?: string;
  category?: string;
  aging_status?: AgingStatus;
}

// =============================================================================
// SERVICE
// =============================================================================

/**
 * Get unacknowledged diagnostic results from the view.
 * Supports optional filters for priority, category, and aging status.
 */
async function getUnacknowledgedResults(
  filters?: UnacknowledgedResultsFilters
): Promise<ServiceResult<UnacknowledgedResult[]>> {
  try {
    const { data, error } = await supabase
      .from('v_unacknowledged_results')
      .select('id, patient_id, first_name, last_name, code_display, category, status, report_priority, issued, conclusion, tenant_id, hours_since_issued, aging_status')
      .order('issued', { ascending: true });

    if (error) {
      await auditLogger.error('UNACK_RESULTS_FETCH_FAILED', error);
      return failure('DATABASE_ERROR', 'Failed to load unacknowledged results');
    }

    let results = (data ?? []) as unknown as UnacknowledgedResult[];

    // Apply client-side filters (view returns all; filters are lightweight)
    if (filters?.priority) {
      results = results.filter(r => r.report_priority === filters.priority);
    }
    if (filters?.category) {
      results = results.filter(r => r.category.includes(filters.category as string));
    }
    if (filters?.aging_status) {
      results = results.filter(r => r.aging_status === filters.aging_status);
    }

    return success(results);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('UNACK_RESULTS_FETCH_FAILED', error);
    return failure('UNKNOWN_ERROR', 'Failed to load unacknowledged results');
  }
}

/**
 * Compute aggregated metrics from unacknowledged results.
 */
async function getResultMetrics(): Promise<ServiceResult<ResultMetrics>> {
  try {
    const { data, error } = await supabase
      .from('v_unacknowledged_results')
      .select('id, patient_id, first_name, last_name, code_display, category, status, report_priority, issued, conclusion, tenant_id, hours_since_issued, aging_status');

    if (error) {
      await auditLogger.error('UNACK_METRICS_FETCH_FAILED', error);
      return failure('DATABASE_ERROR', 'Failed to load result metrics');
    }

    const results = (data ?? []) as unknown as UnacknowledgedResult[];

    const critical_count = results.filter(r => r.aging_status === 'critical').length;
    const overdue_count = results.filter(r => r.aging_status === 'overdue').length;
    const warning_count = results.filter(r => r.aging_status === 'warning').length;

    // Aggregate by category
    const categoryMap = new Map<string, number>();
    for (const r of results) {
      for (const cat of r.category) {
        categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
      }
    }
    const by_category = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
    }));

    // Aggregate by priority
    const priorityMap = new Map<string, number>();
    for (const r of results) {
      const prio = r.report_priority ?? 'unspecified';
      priorityMap.set(prio, (priorityMap.get(prio) ?? 0) + 1);
    }
    const by_priority = Array.from(priorityMap.entries()).map(([priority, count]) => ({
      priority,
      count,
    }));

    return success({
      total_unacknowledged: results.length,
      critical_count,
      overdue_count,
      warning_count,
      by_category,
      by_priority,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('UNACK_METRICS_FETCH_FAILED', error);
    return failure('UNKNOWN_ERROR', 'Failed to load result metrics');
  }
}

/**
 * Acknowledge a diagnostic report result.
 * Inserts an immutable record into result_acknowledgments.
 */
async function acknowledgeResult(
  reportId: string,
  userId: string,
  type: AcknowledgmentType,
  notes?: string
): Promise<ServiceResult<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('result_acknowledgments')
      .insert({
        report_id: reportId,
        acknowledged_by: userId,
        acknowledgment_type: type,
        notes: notes ?? null,
      })
      .select('id')
      .single();

    if (error) {
      await auditLogger.error('RESULT_ACKNOWLEDGE_FAILED', error);
      return failure('DATABASE_ERROR', 'Failed to acknowledge result');
    }

    await auditLogger.clinical('RESULT_ACKNOWLEDGED', true, {
      reportId,
      acknowledgedBy: userId,
      acknowledgmentType: type,
    });

    return success({ id: data.id as string });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('RESULT_ACKNOWLEDGE_FAILED', error);
    return failure('UNKNOWN_ERROR', 'Failed to acknowledge result');
  }
}

/**
 * Get acknowledgment history for a specific report.
 */
async function getAcknowledgmentHistory(
  reportId: string
): Promise<ServiceResult<Acknowledgment[]>> {
  try {
    const { data, error } = await supabase
      .from('result_acknowledgments')
      .select('id, report_id, acknowledged_by, acknowledged_at, acknowledgment_type, notes')
      .eq('report_id', reportId)
      .order('acknowledged_at', { ascending: false });

    if (error) {
      await auditLogger.error('ACK_HISTORY_FETCH_FAILED', error);
      return failure('DATABASE_ERROR', 'Failed to load acknowledgment history');
    }

    return success((data ?? []) as Acknowledgment[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ACK_HISTORY_FETCH_FAILED', error);
    return failure('UNKNOWN_ERROR', 'Failed to load acknowledgment history');
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const unacknowledgedResultsService = {
  getUnacknowledgedResults,
  getResultMetrics,
  acknowledgeResult,
  getAcknowledgmentHistory,
};
