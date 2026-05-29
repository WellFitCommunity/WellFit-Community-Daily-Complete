/**
 * emergencyAccessService — ONC (d)(6) break-the-glass
 *
 * Exercises the real service logic (the actual functions run; only the
 * Supabase RPC boundary is faked). Each test passes the deletion test:
 * remove the behavior under test and the assertion fails.
 *
 * NOTE: this is a regression guard for the service's mapping/guard logic, not
 * proof the live RPC works — that round-trip requires an authenticated app
 * session (auth.uid()) and is verified in-app.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  state: {
    rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
    rpcResult: { data: null as unknown, error: null as null | { message: string } },
    invokeCalls: [] as Array<{ fn: string; body: Record<string, unknown> }>,
  },
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      h.state.rpcCalls.push({ fn, args });
      return Promise.resolve(h.state.rpcResult);
    },
    functions: {
      invoke: (fn: string, opts: { body: Record<string, unknown> }) => {
        h.state.invokeCalls.push({ fn, body: opts.body });
        return Promise.resolve({ data: null, error: null });
      },
    },
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: { info: () => Promise.resolve(), error: () => Promise.resolve() },
}));

import { emergencyAccessService } from '../emergencyAccessService';

beforeEach(() => {
  h.state.rpcCalls = [];
  h.state.rpcResult = { data: null, error: null };
  h.state.invokeCalls = [];
});

describe('emergencyAccessService.grantAccess', () => {
  it('refuses an empty reason without calling the RPC', async () => {
    const result = await emergencyAccessService.grantAccess({ patientId: 'p1', reason: '   ' });
    expect(result.success).toBe(false);
    expect(h.state.rpcCalls).toHaveLength(0); // never hit the database
  });

  it('calls grant_emergency_access with the trimmed reason + duration and maps the grant', async () => {
    h.state.rpcResult = {
      data: {
        access_id: 'acc-1',
        accessing_user_name: 'Dr Test',
        patient_name: 'Patient Alpha',
        tenant_id: 't1',
        granted_at: '2026-05-28T00:00:00Z',
        expires_at: '2026-05-28T01:00:00Z',
        duration_minutes: 60,
        should_notify_supervisor: true,
      },
      error: null,
    };

    const result = await emergencyAccessService.grantAccess({
      patientId: 'p1',
      reason: '  unconscious patient, no chart access ',
      durationMinutes: 60,
    });

    expect(result.success).toBe(true);
    const call = h.state.rpcCalls[0];
    expect(call.fn).toBe('grant_emergency_access');
    expect(call.args.p_patient_id).toBe('p1');
    expect(call.args.p_access_reason).toBe('unconscious patient, no chart access');
    expect(call.args.p_duration_minutes).toBe(60);
    if (result.success) {
      expect(result.data.accessId).toBe('acc-1');
      expect(result.data.expiresAt).toBe('2026-05-28T01:00:00Z');
      expect(result.data.shouldNotifySupervisor).toBe(true);
    }
    // ONC (d)(6): a successful grant dispatches the supervisor notification.
    const notify = h.state.invokeCalls.find((c) => c.fn === 'notify-emergency-access');
    expect(notify?.body.access_id).toBe('acc-1');
  });

  it('returns failure when the RPC errors', async () => {
    h.state.rpcResult = { data: null, error: { message: 'NOT_AUTHORIZED' } };
    const result = await emergencyAccessService.grantAccess({ patientId: 'p1', reason: 'test' });
    expect(result.success).toBe(false);
  });

  it('does not dispatch a notification when the reason is empty (no grant occurs)', async () => {
    const result = await emergencyAccessService.grantAccess({ patientId: 'p1', reason: '  ' });
    expect(result.success).toBe(false);
    expect(h.state.invokeCalls).toHaveLength(0);
  });
});

describe('emergencyAccessService.hasActiveAccess', () => {
  it('returns true only when the RPC returns true', async () => {
    h.state.rpcResult = { data: true, error: null };
    const active = await emergencyAccessService.hasActiveAccess('p1');
    expect(active.success && active.data).toBe(true);

    h.state.rpcResult = { data: false, error: null };
    const inactive = await emergencyAccessService.hasActiveAccess('p1');
    expect(inactive.success && inactive.data).toBe(false);
  });
});
