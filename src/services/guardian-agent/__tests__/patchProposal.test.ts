/**
 * patchProposal tests — Guardian Option B Session 3.
 * Pins the auto_patch client leg: proposals go through the guardian-agent
 * propose_pr relay (never direct code changes, never the PR-service secret).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeMock(...args) } },
}));

const auditInfoMock = vi.fn().mockResolvedValue(undefined);
const auditErrorMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: (...args: unknown[]) => auditInfoMock(...args),
    error: (...args: unknown[]) => auditErrorMock(...args),
  },
}));

import { proposePatchPr } from '../patchProposal';
import type { HealingStep, DetectedIssue } from '../types';

const STEP: HealingStep = {
  id: 'patch-1-test',
  order: 1,
  action: 'apply_patch',
  target: 'src/services/exampleService.ts',
  parameters: { patchType: 'null_check', location: 'src/services/exampleService.ts:42' },
  validation: { type: 'assertion', condition: 'patch.applied === true' },
  timeout: 10000,
};

const ISSUE = {
  id: 'issue-test-123',
  timestamp: new Date('2026-07-23T12:00:00Z'),
  signature: {
    id: 'sig-1',
    category: 'null_reference',
    pattern: 'x',
    severity: 'medium',
    description: 'Null reference in example service',
    commonCauses: [],
    healingStrategies: [],
    estimatedImpact: {},
  },
  context: {
    component: 'exampleService',
    filePath: 'src/services/exampleService.ts',
    lineNumber: 42,
    environmentState: {},
    recentActions: ['clicked save'],
  },
  severity: 'medium',
  affectedResources: ['exampleService'],
  stackTrace: 'Error: boom',
  metadata: {},
} as unknown as DetectedIssue;

beforeEach(() => {
  invokeMock.mockReset();
  auditInfoMock.mockClear();
  auditErrorMock.mockClear();
});

describe('proposePatchPr', () => {
  it('routes the proposal through the guardian-agent propose_pr relay', async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, ticketId: 'ticket-1', prUrl: 'https://github.com/x/pull/9' },
      error: null,
    });

    const result = await proposePatchPr(STEP, ISSUE);

    expect(result.success).toBe(true);
    expect(result.message).toContain('https://github.com/x/pull/9');
    expect(invokeMock).toHaveBeenCalledWith('guardian-agent', expect.objectContaining({
      body: expect.objectContaining({
        action: 'propose_pr',
        data: expect.objectContaining({
          issue: expect.objectContaining({
            id: 'issue-test-123',
            category: 'null_reference',
            severity: 'medium',
          }),
          healing: expect.objectContaining({ strategy: 'auto_patch' }),
        }),
      }),
    }));
  });

  it('reports dedupe without treating it as failure', async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, ticketId: 'ticket-1', deduped: true },
      error: null,
    });
    const result = await proposePatchPr(STEP, ISSUE);
    expect(result.success).toBe(true);
    expect(result.message).toContain('already proposed');
  });

  it('reports the open-PR cap without treating it as failure', async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, ticketId: 'ticket-2', rateLimited: true },
      error: null,
    });
    const result = await proposePatchPr(STEP, ISSUE);
    expect(result.success).toBe(true);
    expect(result.message).toContain('cap reached');
  });

  it('fails loud when the relay errors (no silent success)', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'relay down' } });
    const result = await proposePatchPr(STEP, ISSUE);
    expect(result.success).toBe(false);
    expect(auditErrorMock).toHaveBeenCalled();
  });

  it('never sends file contents or repo paths of its own choosing', async () => {
    invokeMock.mockResolvedValue({ data: { success: true, ticketId: 't' }, error: null });
    await proposePatchPr(STEP, ISSUE);
    const body = invokeMock.mock.calls[0][1] as { body: { data: Record<string, unknown> } };
    // The relay constructs the proposal file path server-side; the client must
    // not pass one (a compromised client choosing repo paths is the threat).
    expect(JSON.stringify(body)).not.toContain('docs/guardian/proposals');
    expect(body.body.data).not.toHaveProperty('changes');
    expect(body.body.data).not.toHaveProperty('filePathOverride');
  });
});
