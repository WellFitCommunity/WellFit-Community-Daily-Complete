/**
 * Tests for tenantResolver — the tenant resolution + cache used by all Guardian
 * browser-side writers (guardian_telemetry, system_recordings, session_recordings).
 *
 * These exist because the previous hardcoded 'wellfit-primary' tenant slug made
 * every non-super-admin Guardian write fail RLS silently (telemetry dead 2026-07-10).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQueryBuilder } from '../../../test-utils';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}));

vi.mock('../../auditLogger', () => ({
  auditLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { resolveTenantId, getCachedTenantId, _resetTenantCache } from '../tenantResolver';

const TENANT_UUID = '2b902657-6a20-4435-a78a-576f397517ca';

describe('tenantResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetTenantCache();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.from.mockReturnValue(createQueryBuilder({ data: { tenant_id: TENANT_UUID } }));
  });

  it('resolves the tenant_id from the profiles table for the signed-in user', async () => {
    const tenantId = await resolveTenantId();

    expect(tenantId).toBe(TENANT_UUID);
    expect(mocks.from).toHaveBeenCalledWith('profiles');
  });

  it('returns null when there is no signed-in user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const tenantId = await resolveTenantId();

    expect(tenantId).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('caches the resolution per user (no repeat profile queries)', async () => {
    await resolveTenantId();
    await resolveTenantId();

    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it('re-resolves when the signed-in user changes', async () => {
    await resolveTenantId();

    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null });
    mocks.from.mockReturnValue(createQueryBuilder({ data: { tenant_id: 'other-tenant' } }));

    const tenantId = await resolveTenantId();

    expect(tenantId).toBe('other-tenant');
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });

  it('returns null (not a fake slug) when the profile lookup errors', async () => {
    mocks.from.mockReturnValue(createQueryBuilder({ error: { message: 'boom' } }));

    const tenantId = await resolveTenantId();

    expect(tenantId).toBeNull();
  });

  it('exposes the cached value synchronously after resolution', async () => {
    expect(getCachedTenantId()).toBeNull();

    await resolveTenantId();

    expect(getCachedTenantId()).toBe(TENANT_UUID);
  });
});
