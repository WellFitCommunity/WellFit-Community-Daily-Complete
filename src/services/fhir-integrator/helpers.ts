/**
 * FHIR Integrator — sync-log persistence + small pure helpers
 *
 * Extracted from fhirInteroperabilityIntegrator.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — moved verbatim from private methods (no `this` used).
 */

import { supabase } from '../../lib/supabaseClient';
import type { SyncResult, FHIRConnection, UnknownRecord } from './types';

export async function logSyncResult(result: SyncResult): Promise<void> {
  await supabase.from('fhir_sync_logs').insert({
    connection_id: result.connectionId,
    sync_type: result.syncType,
    direction: result.direction,
    status: result.status,
    records_processed: result.recordsProcessed,
    records_succeeded: result.recordsSucceeded,
    records_failed: result.recordsFailed,
    errors: result.errors,
    summary: result.summary,
    started_at: result.startTime,
    completed_at: result.endTime
  });
}

export function getIntervalMs(frequency: FHIRConnection['syncFrequency']): number {
  switch (frequency) {
    case 'realtime': return 5 * 60 * 1000; // 5 minutes
    case 'hourly': return 60 * 60 * 1000; // 1 hour
    case 'daily': return 24 * 60 * 60 * 1000; // 24 hours
    case 'manual': return 0;
    default: return 0;
  }
}

export function mapConnectionFromDB(data: UnknownRecord): FHIRConnection {
  return {
    id: data.id as string,
    name: data.name as string,
    fhirServerUrl: data.fhir_server_url as string,
    ehrSystem: data.ehr_system as FHIRConnection['ehrSystem'],
    clientId: data.client_id as string,
    status: data.status as FHIRConnection['status'],
    lastSync: data.last_sync as string | undefined,
    syncFrequency: data.sync_frequency as FHIRConnection['syncFrequency'],
    syncDirection: data.sync_direction as FHIRConnection['syncDirection'],
    accessToken: data.access_token as string | undefined,
    refreshToken: data.refresh_token as string | undefined,
    tokenExpiry: data.token_expiry as string | undefined,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string
  };
}
