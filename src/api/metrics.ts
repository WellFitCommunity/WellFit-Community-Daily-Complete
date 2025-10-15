// src/api/metrics.ts
// Fetch tenant-scoped patient engagement metrics via the RPC we created.

import { SupabaseClient } from '@supabase/supabase-js';

export type PatientEngagementMetric = {
  // Add/adjust fields to match your view columns.
  user_id: string;
  // example fields — keep or remove based on your view:
  last_check_in_at?: string | null;
  check_in_count?: number | null;
  engagement_score?: number | null;
  // the wrapper view adds this:
  tenant_id: string;
};

export async function fetchPatientEngagementMetrics(
  supabase: SupabaseClient,
  params: { tenantId: string; userId?: string | null }
): Promise<PatientEngagementMetric[]> {
  const { tenantId, userId = null } = params;

  const { data, error } = await supabase.rpc('get_patient_engagement_metrics', {
    _tenant: tenantId,
    _user: userId,
  });

  if (error) {
    // surface a clear error up the stack
    throw new Error(`RPC get_patient_engagement_metrics failed: ${error.message}`);
  }
  return (data ?? []) as PatientEngagementMetric[];
}
