// src/api/scores.ts
import { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceResult } from '../services/_base/ServiceResult';
import { success, failure } from '../services/_base/ServiceResult';

export type PatientEngagementScore = {
  user_id: string;
  tenant_id: string;
  engagement_score?: number | null;
  score_band?: string | null;
  last_scored_at?: string | null;
};

export async function fetchPatientEngagementScores(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string | null = null
): Promise<ServiceResult<PatientEngagementScore[]>> {
  try {
    const { data, error } = await supabase.rpc('get_patient_engagement_scores', {
      _tenant: tenantId,
      _user: userId,
    });
    if (error) return failure('DATABASE_ERROR', `RPC get_patient_engagement_scores failed: ${error.message}`, error);
    return success((data ?? []) as PatientEngagementScore[]);
  } catch (err: unknown) {
    return failure('UNKNOWN_ERROR', 'Failed to fetch engagement scores', err);
  }
}
