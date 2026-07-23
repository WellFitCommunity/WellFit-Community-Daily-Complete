/**
 * CapabilityEnforcer tests — runtime enforcement of declared tool capabilities.
 *
 * Deletion test: every case here fails if the enforcer stops enforcing (e.g. if
 * wrapDatabaseClient returned the client untouched, or assertEgressAllowed became
 * a no-op). These assert denials/allows and the quarantine escalation, not shape.
 */
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import {
  CapabilityEnforcer,
  CapabilityViolationError,
  type CapabilityViolation,
} from '../CapabilityEnforcer';
import type { ToolMetadata, ToolCapabilities } from '../ToolRegistry';

// Synthetic tool metadata — obviously fake, no PHI.
function makeTool(id: string, capabilities: Partial<ToolCapabilities>): ToolMetadata {
  return {
    id,
    name: `Test Tool ${id}`,
    version: '1.0.0',
    description: 'synthetic test tool',
    requiredScopes: [],
    capabilities: {
      reads: [],
      writes: [],
      egress: [],
      databaseTables: [],
      ...capabilities,
    },
    checksum: 'a'.repeat(64),
    author: 'test',
    lastUpdated: new Date('2000-01-01'),
    approved: true,
    timeout: 1000,
    maxConcurrency: 1,
  };
}

/** Minimal Supabase-shaped fake: `.from(t)` → builder with select/insert/etc. */
function makeFakeClient() {
  const calls: string[] = [];
  // Rest params so call sites like .select('id') / .insert({...}) typecheck —
  // vi.fn(() => builder) infers a ZERO-argument signature (TS2554 at call sites).
  const builder = {
    select: vi.fn((..._args: unknown[]) => { calls.push('select'); return builder; }),
    insert: vi.fn((..._args: unknown[]) => { calls.push('insert'); return builder; }),
    update: vi.fn((..._args: unknown[]) => { calls.push('update'); return builder; }),
    delete: vi.fn((..._args: unknown[]) => { calls.push('delete'); return builder; }),
    eq: vi.fn((..._args: unknown[]) => builder),
  };
  const from = vi.fn((_table: string) => builder);
  return { client: { from }, from, builder, calls };
}

describe('CapabilityEnforcer — database table gating', () => {
  let sink: Mock<(v: CapabilityViolation) => void>;
  let violations: CapabilityViolation[];
  let enforcer: CapabilityEnforcer;

  beforeEach(() => {
    violations = [];
    sink = vi.fn((v: CapabilityViolation) => { violations.push(v); });
    enforcer = new CapabilityEnforcer({ sink });
  });

  it('allows reading a table the tool declared', () => {
    const tool = makeTool('reader', { databaseTables: ['guardian_cron_log'] });
    const { client } = makeFakeClient();
    const scoped = enforcer.wrapDatabaseClient(tool, client);

    expect(() => scoped.from('guardian_cron_log').select('id')).not.toThrow();
    expect(sink).not.toHaveBeenCalled();
  });

  it('DENIES touching a table the tool did not declare', () => {
    const tool = makeTool('reader', { databaseTables: ['guardian_cron_log'] });
    const { client } = makeFakeClient();
    const scoped = enforcer.wrapDatabaseClient(tool, client);

    expect(() => scoped.from('profiles')).toThrow(CapabilityViolationError);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ toolId: 'reader', kind: 'db-table', resource: 'profiles' });
  });

  it('allows a mutation only when the table is declared writable', () => {
    const tool = makeTool('writer', {
      databaseTables: ['guardian_cron_log'],
      writes: ['guardian_cron_log'],
    });
    const { client, builder } = makeFakeClient();
    const scoped = enforcer.wrapDatabaseClient(tool, client);

    expect(() => scoped.from('guardian_cron_log').insert({ x: 1 })).not.toThrow();
    expect(builder.insert).toHaveBeenCalledTimes(1);
    expect(sink).not.toHaveBeenCalled();
  });

  it('DENIES a mutation on a readable-but-not-writable table', () => {
    const tool = makeTool('reader', { databaseTables: ['guardian_cron_log'] }); // no writes
    const { client, builder } = makeFakeClient();
    const scoped = enforcer.wrapDatabaseClient(tool, client);

    expect(() => scoped.from('guardian_cron_log').insert({ x: 1 })).toThrow(CapabilityViolationError);
    expect(builder.insert).not.toHaveBeenCalled(); // blocked BEFORE the real insert ran
    expect(violations[0]).toMatchObject({ kind: 'db-write', resource: 'guardian_cron_log' });
  });

  it('still allows SELECT on a writable table (reading a writable table is fine)', () => {
    const tool = makeTool('rw', {
      databaseTables: ['guardian_cron_log'],
      writes: ['guardian_cron_log'],
    });
    const { client, builder } = makeFakeClient();
    const scoped = enforcer.wrapDatabaseClient(tool, client);

    expect(() => scoped.from('guardian_cron_log').select('id')).not.toThrow();
    expect(builder.select).toHaveBeenCalledTimes(1);
  });
});

describe('CapabilityEnforcer — egress gating', () => {
  let enforcer: CapabilityEnforcer;
  let violations: CapabilityViolation[];

  beforeEach(() => {
    violations = [];
    enforcer = new CapabilityEnforcer({ sink: (v) => { violations.push(v); } });
  });

  it('allows a host in the declared egress list', () => {
    const tool = makeTool('caller', { egress: ['api.github.com'] });
    expect(() => enforcer.assertEgressAllowed(tool, 'https://api.github.com/repos/x/y')).not.toThrow();
  });

  it('DENIES a host not in the declared egress list', () => {
    const tool = makeTool('caller', { egress: ['api.github.com'] });
    expect(() => enforcer.assertEgressAllowed(tool, 'https://evil.example.com/steal')).toThrow(
      CapabilityViolationError,
    );
    expect(violations[0]).toMatchObject({ kind: 'egress', resource: 'evil.example.com' });
  });

  it('DENIES an empty egress list (fail closed)', () => {
    const tool = makeTool('caller', { egress: [] });
    expect(() => enforcer.assertEgressAllowed(tool, 'https://api.github.com')).toThrow(
      CapabilityViolationError,
    );
  });

  it('honors an explicit wildcard egress declaration', () => {
    const tool = makeTool('caller', { egress: ['*'] });
    expect(() => enforcer.assertEgressAllowed(tool, 'https://anything.example.com')).not.toThrow();
  });
});

describe('CapabilityEnforcer — quarantine escalation', () => {
  it('quarantines a tool after the threshold of violations', () => {
    const enforcer = new CapabilityEnforcer({ sink: () => {}, quarantineThreshold: 3 });
    const tool = makeTool('bad', { databaseTables: ['allowed'] });
    const { client } = makeFakeClient();
    const scoped = enforcer.wrapDatabaseClient(tool, client);

    const attemptForbidden = () => {
      try { scoped.from('forbidden'); } catch { /* expected */ }
    };

    attemptForbidden();
    expect(enforcer.isQuarantined('bad')).toBe(false);
    attemptForbidden();
    expect(enforcer.isQuarantined('bad')).toBe(false);
    attemptForbidden();
    expect(enforcer.isQuarantined('bad')).toBe(true);
    expect(enforcer.getViolationCount('bad')).toBe(3);
  });

  it('clearTool resets violations and lifts quarantine (human re-approval)', () => {
    const enforcer = new CapabilityEnforcer({ sink: () => {}, quarantineThreshold: 1 });
    const tool = makeTool('bad', { databaseTables: ['allowed'] });
    const { client } = makeFakeClient();
    const scoped = enforcer.wrapDatabaseClient(tool, client);

    try { scoped.from('forbidden'); } catch { /* expected */ }
    expect(enforcer.isQuarantined('bad')).toBe(true);

    enforcer.clearTool('bad');
    expect(enforcer.isQuarantined('bad')).toBe(false);
    expect(enforcer.getViolationCount('bad')).toBe(0);
  });
});
