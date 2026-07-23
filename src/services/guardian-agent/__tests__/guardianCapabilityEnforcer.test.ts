/**
 * RUNTIME_HEALER_CAPABILITY tests — proves the RuntimeHealer's DECLARED database
 * footprint matches its real usage and is binding: it may read `profiles` and
 * write `security_notifications`, and NOTHING else. If the healer's real table
 * usage ever drifts from this declaration, these tests are the tripwire.
 *
 * Uses a fresh enforcer + mock sink (not the shared singleton) so no real
 * security_alerts row is written during tests.
 */
import { vi, describe, it, expect } from 'vitest';

// The shared module wraps the ambient supabase client at import time; mock it so
// importing RUNTIME_HEALER_CAPABILITY pulls no real client.
vi.mock('../../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }));

import { CapabilityEnforcer, CapabilityViolationError } from '../CapabilityEnforcer';
import { RUNTIME_HEALER_CAPABILITY } from '../guardianCapabilityEnforcer';

function fakeClient() {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
  };
  return { client: { from: vi.fn(() => builder) }, builder };
}

describe('RUNTIME_HEALER_CAPABILITY', () => {
  it('allows reading profiles (health probe)', () => {
    const enforcer = new CapabilityEnforcer({ sink: vi.fn() });
    const { client, builder } = fakeClient();
    const db = enforcer.wrapDatabaseClient(RUNTIME_HEALER_CAPABILITY, client);

    expect(() => db.from('profiles').select('id').limit(1)).not.toThrow();
    expect(builder.select).toHaveBeenCalled();
  });

  it('allows writing security_notifications (in-app alert panel)', () => {
    const enforcer = new CapabilityEnforcer({ sink: vi.fn() });
    const { client, builder } = fakeClient();
    const db = enforcer.wrapDatabaseClient(RUNTIME_HEALER_CAPABILITY, client);

    expect(() => db.from('security_notifications').insert({ type: 'x' })).not.toThrow();
    expect(builder.insert).toHaveBeenCalled();
  });

  it('DENIES writing profiles (declared read-only)', () => {
    const enforcer = new CapabilityEnforcer({ sink: vi.fn() });
    const { client, builder } = fakeClient();
    const db = enforcer.wrapDatabaseClient(RUNTIME_HEALER_CAPABILITY, client);

    expect(() => db.from('profiles').insert({ id: 'x' })).toThrow(CapabilityViolationError);
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it('DENIES touching any undeclared table (e.g. audit_logs, security_alerts)', () => {
    const enforcer = new CapabilityEnforcer({ sink: vi.fn() });
    const { client } = fakeClient();
    const db = enforcer.wrapDatabaseClient(RUNTIME_HEALER_CAPABILITY, client);

    expect(() => db.from('audit_logs')).toThrow(CapabilityViolationError);
    expect(() => db.from('patients')).toThrow(CapabilityViolationError);
  });
});
