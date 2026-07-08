/**
 * Tests for the chainable Supabase mock helper.
 *
 * These assert the helper's actual contract — the whole point is that a test
 * built on it survives query-chain refactors. So the key cases prove that the
 * SAME configured result comes back regardless of which chain shape the caller
 * uses (the exact brittleness that broke VoiceProfileMaturity).
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect } from 'vitest';
import { createQueryBuilder, createSupabaseMock } from '../supabaseMock';

describe('createQueryBuilder', () => {
  it('resolves the configured data whether the chain ends in .single() or .maybeSingle()', async () => {
    const row = { id: 'x1', name: 'Test Alpha' };

    const viaSingle = await createQueryBuilder({ data: row })
      .select('id, name').eq('id', 'x1').single();
    const viaMaybeSingle = await createQueryBuilder({ data: row })
      .select('id, name').eq('id', 'x1').maybeSingle();

    // Same result both ways — this is what makes it refactor-proof.
    expect(viaSingle.data).toEqual(row);
    expect(viaMaybeSingle.data).toEqual(row);
    expect(viaSingle.error).toBeNull();
  });

  it('resolves when the builder is awaited directly (no terminal method)', async () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    const res = await createQueryBuilder({ data: rows })
      .select('id').eq('tenant_id', 't1').order('created_at', { ascending: false }).limit(50);

    expect(res.data).toEqual(rows);
    expect(res.error).toBeNull();
  });

  it('survives an arbitrarily reordered / extended chain', async () => {
    const row = { id: 'z' };
    const res = await createQueryBuilder({ data: row })
      .select('*').eq('a', 1).in('b', [1, 2]).gte('c', 0).order('d').limit(1).maybeSingle();
    expect(res.data).toEqual(row);
  });

  it('passes through errors so the failure path can be tested', async () => {
    const res = await createQueryBuilder({ error: { code: 'PGRST116', message: 'no rows' } })
      .select('*').eq('id', 'missing').single();
    expect(res.data).toBeNull();
    expect(res.error?.code).toBe('PGRST116');
    expect(res.status).toBe(400);
  });

  it('exposes count for head/count queries', async () => {
    const res = await createQueryBuilder({ count: 42 })
      .select('id', { count: 'exact', head: true }).eq('user_id', 'u1');
    expect(res.count).toBe(42);
  });

  it('supports write chains (insert/update/delete) resolving to the row', async () => {
    const saved = { id: 'new', status: 'active' };
    const inserted = await createQueryBuilder({ data: saved }).insert(saved).select().single();
    expect(inserted.data).toEqual(saved);

    const deleted = await createQueryBuilder({ data: null }).delete().eq('id', 'new');
    expect(deleted.error).toBeNull();
  });
});

describe('createSupabaseMock', () => {
  it('routes .from(table) to per-table results and .rpc(name) to keyed results', async () => {
    const supabase = createSupabaseMock({
      profiles: { data: { user_id: 'u1', role: 'admin' } },
      audit_logs: { data: [] },
      get_current_tenant_id: { data: 'tenant-1' },
    });

    const profile = await supabase.from('profiles').select('role').eq('user_id', 'u1').single();
    const logs = await supabase.from('audit_logs').select('*');
    const tenant = await supabase.rpc('get_current_tenant_id');

    expect(profile.data).toEqual({ user_id: 'u1', role: 'admin' });
    expect(logs.data).toEqual([]);
    expect(tenant.data).toBe('tenant-1');
  });

  it('falls back for unmatched tables', async () => {
    const supabase = createSupabaseMock({}, { data: [] });
    const res = await supabase.from('anything').select('*');
    expect(res.data).toEqual([]);
  });
});
