/**
 * Fetch patient self-report history (in-depth daily health assessments)
 *
 * Self-reports are the detailed daily assessments submitted by community
 * members — separate from the quick daily check-in on the landing page.
 * Includes mood, symptoms, vitals, activity, and social engagement.
 *
 * @module patient-context/fetchSelfReports
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import type { PatientId, SelfReportSummary } from '../../types/patientContext';
import type { FetchResult } from './types';

/** Columns to select from self_reports table (no SELECT *) */
const SELF_REPORT_COLUMNS = [
  'id',
  'user_id',
  'mood',
  'symptoms',
  'activity_description',
  'bp_systolic',
  'bp_diastolic',
  'heart_rate',
  'blood_sugar',
  'blood_oxygen',
  'weight',
  'physical_activity',
  'social_engagement',
  'created_at',
  'reviewed_at',
  'reviewed_by_name',
].join(', ');

/**
 * Fetch self-report history for a patient
 *
 * @param patientId - Patient UUID
 * @param limit - Maximum reports to return (default 10)
 * @returns FetchResult with SelfReportSummary
 */
export async function fetchSelfReports(
  patientId: PatientId,
  limit: number = 10
): Promise<FetchResult<SelfReportSummary>> {
  const fetchedAt = new Date().toISOString();

  try {
    // Fetch recent self-reports
    const { data, error } = await supabase
      .from('self_reports')
      .select(SELF_REPORT_COLUMNS)
      .eq('user_id', patientId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return {
        success: false,
        data: null,
        source: {
          source: 'self_reports',
          fetched_at: fetchedAt,
          success: false,
          record_count: 0,
          note: error.message,
        },
      };
    }

    // Get total count (head-only query)
    const { count } = await supabase
      .from('self_reports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', patientId);

    const summary: SelfReportSummary = {
      recent_reports: (data ?? []) as unknown as SelfReportSummary['recent_reports'],
      total_count: count ?? 0,
    };

    return {
      success: true,
      data: summary,
      source: {
        source: 'self_reports',
        fetched_at: fetchedAt,
        success: true,
        record_count: summary.recent_reports.length,
        note: null,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      data: null,
      source: {
        source: 'self_reports',
        fetched_at: fetchedAt,
        success: false,
        record_count: 0,
        note: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}
