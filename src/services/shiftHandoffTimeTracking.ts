// ============================================================================
// Shift Handoff Time Tracking
// ============================================================================
// Extracted from shiftHandoffService.ts for 600-line compliance
// Purpose: Track and report time savings from AI-assisted handoffs
// ============================================================================

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';

/**
 * Industry benchmark: 30 minutes (1800 seconds) for shift handoff in legacy EHRs
 */
const INDUSTRY_HANDOFF_BENCHMARK_SECONDS = 1800;

export async function recordHandoffTimeSavings(
  actualTimeSeconds: number,
  patientCount: number,
  aiAssisted: boolean = true
): Promise<{
  time_saved_seconds: number;
  time_saved_minutes: number;
  efficiency_percent: number;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  if (profileError) {
    await auditLogger.warn('TIME_TRACKING_PROFILE_LOAD_FAILED', {
      error: profileError.message,
    });
  }

  const industryBenchmark = INDUSTRY_HANDOFF_BENCHMARK_SECONDS;
  const timeSaved = industryBenchmark - actualTimeSeconds;
  const efficiencyPercent = Math.round((1 - actualTimeSeconds / industryBenchmark) * 100);

  const { error } = await supabase
    .from('clinician_time_tracking')
    .insert({
      tenant_id: profile?.tenant_id || null,
      user_id: user.id,
      action_type: 'shift_handoff',
      actual_time_seconds: actualTimeSeconds,
      epic_benchmark_seconds: industryBenchmark,
      ai_assisted: aiAssisted,
      ai_confidence_score: aiAssisted ? 0.85 : null,
      patient_count: patientCount,
      complexity_level: patientCount > 15 ? 'high' : patientCount > 8 ? 'medium' : 'low',
    });

  if (error) {
    await auditLogger.warn('TIME_TRACKING_INSERT_FAILED', {
      error: error.message,
      actualTime: actualTimeSeconds,
    });
  }

  return {
    time_saved_seconds: Math.max(0, timeSaved),
    time_saved_minutes: Math.round(Math.max(0, timeSaved) / 60),
    efficiency_percent: Math.max(0, efficiencyPercent),
  };
}

/**
 * Get aggregate time savings for current user (last 30 days)
 */
export async function getMyTimeSavings(): Promise<{
  total_handoffs: number;
  total_time_saved_minutes: number;
  avg_time_per_handoff_minutes: number;
  efficiency_vs_epic_percent: number;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('clinician_time_tracking')
    .select('actual_time_seconds, epic_benchmark_seconds')
    .eq('user_id', user.id)
    .eq('action_type', 'shift_handoff')
    .gte('created_at', thirtyDaysAgo);

  if (error || !data || data.length === 0) {
    return {
      total_handoffs: 0,
      total_time_saved_minutes: 0,
      avg_time_per_handoff_minutes: 0,
      efficiency_vs_epic_percent: 0,
    };
  }

  const totalActual = data.reduce((sum, r) => sum + r.actual_time_seconds, 0);
  const totalBenchmark = data.reduce((sum, r) => sum + r.epic_benchmark_seconds, 0);
  const totalSaved = totalBenchmark - totalActual;

  return {
    total_handoffs: data.length,
    total_time_saved_minutes: Math.round(totalSaved / 60),
    avg_time_per_handoff_minutes: Math.round(totalActual / data.length / 60),
    efficiency_vs_epic_percent: Math.round((1 - totalActual / totalBenchmark) * 100),
  };
}
