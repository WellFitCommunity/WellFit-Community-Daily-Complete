// src/api/scores.ts
import { SupabaseClient } from '@supabase/supabase-js';

export type PatientEngagementScore = {
  user_id: string;
  tenant_id: string;
  // Add/adjust to match your columns:
  engagement_score?: number | null;
  score_band?: string | null;
  last_scored_at?: string | null;
};

export async function fetchPatientEngagementScores(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string | null = null
): Promise<PatientEngagementScore[]> {
  const { data, error } = await supabase.rpc('get_patient_engagement_scores', {
    _tenant: tenantId,
    _user: userId,
  });
  if (error) throw new Error(`RPC get_patient_engagement_scores failed: ${error.message}`);
  return (data ?? []) as PatientEngagementScore[];
}
