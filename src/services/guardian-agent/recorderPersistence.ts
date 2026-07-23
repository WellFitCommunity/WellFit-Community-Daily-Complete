/**
 * recorderPersistence - Database + edge persistence for Guardian Eyes recordings.
 *
 * Extracted from AISystemRecorder (600-line limit) and repaired 2026-07-23:
 * Guardian Eyes had persisted ZERO rows since inception because
 *   1. system_recordings writes used upsert({ onConflict: 'session_id' }) against a
 *      table with no unique constraint on session_id — a hard Postgres error every
 *      flush. The table's natural shape is one row per flush batch, so we insert.
 *   2. Writes omitted tenant_id, which the tables' RLS policies require.
 *   3. session_recordings writes included columns that didn't exist (added by
 *      migration 20260723170000).
 *   4. Every failure was swallowed by empty catch blocks.
 *
 * Used by: AISystemRecorder (Guardian Eyes).
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { resolveTenantId } from './tenantResolver';
import type { SystemSnapshot, SessionRecording } from './AISystemRecorder';

/**
 * Persist a batch of system snapshots (one row per flush batch).
 * Returns true on success so the caller can re-buffer the batch on failure.
 */
export async function persistSnapshotBatch(
  sessionId: string,
  snapshots: SystemSnapshot[]
): Promise<boolean> {
  try {
    const tenantId = await resolveTenantId();
    const { error } = await supabase.from('system_recordings').insert({
      session_id: sessionId,
      snapshots,
      tenant_id: tenantId,
      recorded_at: new Date().toISOString(),
    });

    if (error) {
      await auditLogger.warn('GUARDIAN_EYES_SNAPSHOT_PERSIST_FAILED', {
        message: error.message,
        session_id: sessionId,
        snapshot_count: snapshots.length,
      });
      return false;
    }
    return true;
  } catch (err: unknown) {
    await auditLogger.error(
      'GUARDIAN_EYES_SNAPSHOT_PERSIST_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { session_id: sessionId }
    );
    return false;
  }
}

/**
 * Open the session row when recording STARTS. This must happen before any
 * snapshot batch is flushed: system_recordings.session_id has a foreign key to
 * session_recordings(session_id), so batches written before the session row
 * exists are rejected (one of the reasons Guardian Eyes never persisted a row).
 */
export async function openSessionRecording(recording: SessionRecording): Promise<void> {
  try {
    const tenantId = recording.tenant_id ?? (await resolveTenantId());
    const { error } = await supabase.from('session_recordings').insert({
      session_id: recording.session_id,
      user_id: recording.user_id,
      tenant_id: tenantId,
      start_time: recording.start_time,
      snapshot_count: 0,
    });

    if (error) {
      await auditLogger.warn('GUARDIAN_EYES_SESSION_OPEN_FAILED', {
        message: error.message,
        session_id: recording.session_id,
      });
    }
  } catch (err: unknown) {
    await auditLogger.error(
      'GUARDIAN_EYES_SESSION_OPEN_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { session_id: recording.session_id }
    );
  }
}

/**
 * Finalize the session row when recording STOPS (counts, summary, URL).
 */
export async function finalizeSessionRecording(recording: SessionRecording): Promise<void> {
  try {
    const { error } = await supabase
      .from('session_recordings')
      .update({
        end_time: recording.end_time,
        snapshot_count: recording.snapshots.length,
        rrweb_event_count: recording.rrweb_events.length,
        recording_url: recording.recording_url,
        ai_summary: recording.ai_summary,
        metadata: {
          duration_seconds: recording.end_time
            ? (Date.parse(recording.end_time) - Date.parse(recording.start_time)) / 1000
            : 0,
        },
      })
      .eq('session_id', recording.session_id);

    if (error) {
      await auditLogger.warn('GUARDIAN_EYES_SESSION_PERSIST_FAILED', {
        message: error.message,
        session_id: recording.session_id,
      });
    }
  } catch (err: unknown) {
    await auditLogger.error(
      'GUARDIAN_EYES_SESSION_PERSIST_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { session_id: recording.session_id }
    );
  }
}

/**
 * Send a critical snapshot to the guardian-agent edge function's `record` action
 * so it lands in guardian_eyes_recordings and feeds the daily analyze cron.
 * Fire-and-forget from capture paths — failures are logged, never thrown.
 */
export async function sendSnapshotToGuardian(
  snapshot: SystemSnapshot,
  severity: 'critical' | 'high' | 'medium' | 'low'
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('guardian-agent', {
      body: {
        action: 'record',
        data: {
          timestamp: snapshot.timestamp,
          type: snapshot.type,
          component: snapshot.component,
          action: snapshot.action ?? snapshot.type,
          severity,
          metadata: snapshot.metadata,
          session_id: snapshot.metadata.session_id,
          user_id: snapshot.metadata.user_id,
        },
      },
    });

    if (error) {
      await auditLogger.warn('GUARDIAN_EYES_EDGE_RECORD_FAILED', {
        message: error.message,
        component: snapshot.component,
        type: snapshot.type,
      });
    }
  } catch (err: unknown) {
    await auditLogger.error(
      'GUARDIAN_EYES_EDGE_RECORD_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { component: snapshot.component }
    );
  }
}
