/**
 * Tests for recorderPersistence — Guardian Eyes DB/edge persistence.
 *
 * These exist because Guardian Eyes persisted ZERO rows since inception:
 * broken onConflict upsert, missing tenant_id (RLS), missing columns, and
 * empty catch blocks hiding all of it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQueryBuilder } from '../../../test-utils';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  invoke: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: mocks.from,
    functions: { invoke: mocks.invoke },
  },
}));

vi.mock('../../auditLogger', () => ({
  auditLogger: { info: vi.fn(), warn: mocks.warn, error: mocks.error },
}));

vi.mock('../tenantResolver', () => ({
  resolveTenantId: vi.fn().mockResolvedValue('tenant-uuid-1'),
}));

import {
  persistSnapshotBatch,
  openSessionRecording,
  finalizeSessionRecording,
  sendSnapshotToGuardian,
} from '../recorderPersistence';
import type { SystemSnapshot, SessionRecording } from '../AISystemRecorder';

const snapshot: SystemSnapshot = {
  id: 'snap-1',
  timestamp: '2026-07-23T12:00:00.000Z',
  type: 'error',
  component: 'TestComponent',
  action: 'render',
  metadata: { session_id: 'session-abc', user_id: 'user-1' },
};

const recording: SessionRecording = {
  session_id: 'session-abc',
  tenant_id: 'tenant-uuid-1',
  user_id: 'user-1',
  start_time: '2026-07-23T12:00:00.000Z',
  end_time: '2026-07-23T12:05:00.000Z',
  snapshots: [snapshot],
  rrweb_events: [{ type: 3, data: {}, timestamp: 1 } as never],
  recording_url: 'https://example.test/guardian-eyes/session-abc/',
};

describe('recorderPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue(createQueryBuilder({}));
    mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  describe('persistSnapshotBatch', () => {
    it('inserts one row per batch with session_id and tenant_id (RLS requirement)', async () => {
      const qb = createQueryBuilder({});
      mocks.from.mockReturnValue(qb);

      const ok = await persistSnapshotBatch('session-abc', [snapshot]);

      expect(ok).toBe(true);
      expect(mocks.from).toHaveBeenCalledWith('system_recordings');
      expect(qb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'session-abc',
          tenant_id: 'tenant-uuid-1',
          snapshots: [snapshot],
        })
      );
    });

    it('returns false and logs when the insert fails (no more silent drops)', async () => {
      mocks.from.mockReturnValue(createQueryBuilder({ error: { message: 'permission denied' } }));

      const ok = await persistSnapshotBatch('session-abc', [snapshot]);

      expect(ok).toBe(false);
      expect(mocks.warn).toHaveBeenCalledWith(
        'GUARDIAN_EYES_SNAPSHOT_PERSIST_FAILED',
        expect.objectContaining({ message: 'permission denied' })
      );
    });
  });

  describe('openSessionRecording', () => {
    it('inserts the session row at start with session_id and tenant_id (FK target for batches)', async () => {
      const qb = createQueryBuilder({});
      mocks.from.mockReturnValue(qb);

      await openSessionRecording(recording);

      expect(mocks.from).toHaveBeenCalledWith('session_recordings');
      expect(qb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'session-abc',
          tenant_id: 'tenant-uuid-1',
          start_time: '2026-07-23T12:00:00.000Z',
        })
      );
    });

    it('logs when the open insert fails instead of swallowing it', async () => {
      mocks.from.mockReturnValue(createQueryBuilder({ error: { message: 'nope' } }));

      await openSessionRecording(recording);

      expect(mocks.warn).toHaveBeenCalledWith(
        'GUARDIAN_EYES_SESSION_OPEN_FAILED',
        expect.objectContaining({ message: 'nope' })
      );
    });
  });

  describe('finalizeSessionRecording', () => {
    it('updates the session row with counts, summary fields and recording_url', async () => {
      const qb = createQueryBuilder({});
      mocks.from.mockReturnValue(qb);

      await finalizeSessionRecording(recording);

      expect(mocks.from).toHaveBeenCalledWith('session_recordings');
      expect(qb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshot_count: 1,
          rrweb_event_count: 1,
          recording_url: 'https://example.test/guardian-eyes/session-abc/',
        })
      );
      expect(qb.eq).toHaveBeenCalledWith('session_id', 'session-abc');
    });

    it('logs when the finalize update fails instead of swallowing it', async () => {
      mocks.from.mockReturnValue(createQueryBuilder({ error: { message: 'nope' } }));

      await finalizeSessionRecording(recording);

      expect(mocks.warn).toHaveBeenCalledWith(
        'GUARDIAN_EYES_SESSION_PERSIST_FAILED',
        expect.objectContaining({ message: 'nope' })
      );
    });
  });

  describe('sendSnapshotToGuardian', () => {
    it('posts the snapshot to the guardian-agent record action', async () => {
      await sendSnapshotToGuardian(snapshot, 'high');

      expect(mocks.invoke).toHaveBeenCalledWith('guardian-agent', {
        body: {
          action: 'record',
          data: expect.objectContaining({
            type: 'error',
            component: 'TestComponent',
            action: 'render',
            severity: 'high',
            session_id: 'session-abc',
          }),
        },
      });
    });

    it('logs invoke failures instead of throwing into capture paths', async () => {
      mocks.invoke.mockResolvedValue({ data: null, error: { message: 'edge down' } });

      await expect(sendSnapshotToGuardian(snapshot, 'high')).resolves.toBeUndefined();

      expect(mocks.warn).toHaveBeenCalledWith(
        'GUARDIAN_EYES_EDGE_RECORD_FAILED',
        expect.objectContaining({ message: 'edge down' })
      );
    });
  });
});
