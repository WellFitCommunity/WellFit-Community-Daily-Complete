/**
 * Registry-side signature gate tests (Session 2).
 * Pins: enforce mode rejects unsigned tools at registerWithExecutor AND
 * getExecutor; warn mode registers but reports; off mode (no key) is untouched.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyMock = vi.fn();
const reportMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../toolSignatureGate', () => ({
  verifyToolSignature: (...args: unknown[]) => verifyMock(...args),
  reportToolSignatureFailure: (...args: unknown[]) => reportMock(...args),
}));

vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

import { ToolRegistry } from '../ToolRegistry';
import type { ToolMetadata } from '../ToolRegistry';

function makeMetadata(id: string): ToolMetadata {
  return {
    id,
    name: 'Test Tool',
    version: '1.0.0',
    description: 'test',
    requiredScopes: [],
    capabilities: { reads: [], writes: [], egress: [] },
    checksum: 'a'.repeat(64),
    author: 'test',
    lastUpdated: new Date(),
    approved: true,
    timeout: 1000,
    maxConcurrency: 1,
  } as unknown as ToolMetadata;
}

beforeEach(() => {
  verifyMock.mockReset();
  reportMock.mockClear();
});

describe('ToolRegistry signature gate', () => {
  it('off mode: unsigned tools register and execute unchanged', async () => {
    verifyMock.mockResolvedValue({ valid: false, mode: 'off', reason: 'signing key not provisioned' });
    const registry = new ToolRegistry();
    await registry.registerWithExecutor(makeMetadata('t.off'), async () => 'ok');
    const { valid } = await registry.getExecutor('t.off');
    expect(valid).toBe(true);
    expect(reportMock).not.toHaveBeenCalled();
  });

  it('warn mode: unsigned tool registers but the failure is reported', async () => {
    verifyMock.mockResolvedValue({ valid: false, mode: 'warn', reason: 'no signature on file' });
    const registry = new ToolRegistry();
    await registry.registerWithExecutor(makeMetadata('t.warn'), async () => 'ok');
    const { valid } = await registry.getExecutor('t.warn');
    expect(valid).toBe(true);
    expect(reportMock).toHaveBeenCalledWith('t.warn', expect.objectContaining({ mode: 'warn' }));
  });

  it('enforce mode: unsigned tool is REJECTED at registerWithExecutor and unregistered', async () => {
    verifyMock.mockResolvedValue({ valid: false, mode: 'enforce', reason: 'no signature on file' });
    const registry = new ToolRegistry();
    await expect(
      registry.registerWithExecutor(makeMetadata('t.enforce'), async () => 'ok')
    ).rejects.toThrow(/rejected/);
    expect(registry.get('t.enforce')).toBeUndefined();
    expect(reportMock).toHaveBeenCalled();
  });

  it('enforce mode: a validly signed tool registers and executes', async () => {
    verifyMock.mockResolvedValue({ valid: true, mode: 'enforce' });
    const registry = new ToolRegistry();
    await registry.registerWithExecutor(makeMetadata('t.signed'), async () => 'ok');
    const { valid } = await registry.getExecutor('t.signed');
    expect(valid).toBe(true);
    expect(reportMock).not.toHaveBeenCalled();
  });

  it('executor tampering is still caught by the existing checksum gate', async () => {
    verifyMock.mockResolvedValue({ valid: true, mode: 'enforce' });
    const registry = new ToolRegistry();
    const executor = async () => 'ok';
    await registry.registerWithExecutor(makeMetadata('t.tamper'), executor);
    // simulate post-registration tampering by swapping the executor reference
    const entry = (registry as unknown as {
      tools: Map<string, { executor?: unknown; executorChecksum?: string }>;
    }).tools.get('t.tamper');
    if (!entry) throw new Error('tool missing');
    entry.executor = async () => 'evil';
    const { valid, error } = await registry.getExecutor('t.tamper');
    expect(valid).toBe(false);
    expect(error).toContain('tampered');
  });
});
