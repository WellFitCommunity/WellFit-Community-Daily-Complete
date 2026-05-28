/**
 * userRoleManagementService.assignRole — role_id synchronization
 *
 * Regression guard for the pre-go-live role-reconciliation fix (2026-05-28):
 * assignRole must resolve role_id from the canonical `roles` table and write
 * it to profiles.role_id (the column the database RLS policies enforce on).
 * Previously it updated only role + role_code, leaving role_id stale, so a
 * role change silently failed to change the user's RLS-enforced access.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  state: {
    rolesLookup: { data: { id: 99 } as { id: number } | null, error: null as null | { message: string } },
    capturedProfileUpdate: null as Record<string, unknown> | null,
    capturedUserRolesUpsert: null as Record<string, unknown> | null,
    profilesSelectCall: 0,
  },
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'roles') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve(h.state.rolesLookup) }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => {
                h.state.profilesSelectCall++;
                if (h.state.profilesSelectCall === 1) {
                  return Promise.resolve({
                    data: { role: 'nurse', role_code: 3, first_name: 'Test', last_name: 'User' },
                    error: null,
                  });
                }
                return Promise.resolve({
                  data: {
                    user_id: 'u1', first_name: 'Test', last_name: 'User', email: 't@example.com',
                    role: 'department_head', role_code: 11, department: null, is_active: true,
                    created_at: '2026-01-01T00:00:00Z', last_sign_in_at: null,
                  },
                  error: null,
                });
              },
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            h.state.capturedProfileUpdate = payload;
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }
      if (table === 'user_roles') {
        return {
          upsert: (payload: Record<string, unknown>) => {
            h.state.capturedUserRolesUpsert = payload;
            return Promise.resolve({ error: null });
          },
        };
      }
      return {};
    },
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: { info: () => Promise.resolve(), error: () => Promise.resolve() },
}));

import { userRoleManagementService } from '../userRoleManagementService';

beforeEach(() => {
  h.state.rolesLookup = { data: { id: 99 }, error: null };
  h.state.capturedProfileUpdate = null;
  h.state.capturedUserRolesUpsert = null;
  h.state.profilesSelectCall = 0;
});

describe('userRoleManagementService.assignRole — role_id sync', () => {
  it('writes role_id resolved from the roles table into the profiles update (the RLS-enforced column)', async () => {
    const result = await userRoleManagementService.assignRole(
      { user_id: 'u1', new_role: 'department_head', reason: 'promotion' },
      'super_admin',
      'admin-1'
    );

    expect(result.success).toBe(true);
    expect(h.state.capturedProfileUpdate).not.toBeNull();
    // The fix: role_id (not just role/role_code) is written, resolved from roles.id
    expect(h.state.capturedProfileUpdate?.role_id).toBe(99);
    expect(h.state.capturedProfileUpdate?.role).toBe('department_head');
    // user_roles is kept in sync with the same role_id
    expect(h.state.capturedUserRolesUpsert?.role_id).toBe(99);
  });

  it('refuses to assign (and writes nothing) when the role has no row in the roles table', async () => {
    h.state.rolesLookup = { data: null, error: null };

    const result = await userRoleManagementService.assignRole(
      { user_id: 'u1', new_role: 'department_head', reason: 'promotion' },
      'super_admin',
      'admin-1'
    );

    expect(result.success).toBe(false);
    // Critical: we must NOT write a stale/garbage role_id — the profile update never runs
    expect(h.state.capturedProfileUpdate).toBeNull();
  });
});
