/**
 * userRoleManagementService.assignRole — admin_assign_role RPC wiring
 *
 * Regression guard for the pre-go-live role-assignment fix (2026-05-29):
 * assignRole must delegate to the admin_assign_role SECURITY DEFINER RPC, NOT
 * do a direct profiles UPDATE. The profiles UPDATE RLS policy is own-row only
 * (user_id = auth.uid()), so an admin updating ANOTHER user's row silently
 * affects zero rows — the role change appeared to succeed but did nothing.
 * The RPC is the authoritative admin write path (resolves role_id, enforces
 * authority/tenant/no-self-assign server-side, syncs user_roles via trigger).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  state: {
    rpcResult: { error: null as null | { message: string; code?: string } },
    capturedRpc: null as { name: string; params: Record<string, unknown> } | null,
    profilesSelectCall: 0,
  },
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: (name: string, params: Record<string, unknown>) => {
      h.state.capturedRpc = { name, params };
      return Promise.resolve(h.state.rpcResult);
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => {
                h.state.profilesSelectCall++;
                if (h.state.profilesSelectCall === 1) {
                  // current role (for audit trail)
                  return Promise.resolve({
                    data: { role: 'nurse', role_code: 3, first_name: 'Test', last_name: 'User' },
                    error: null,
                  });
                }
                // re-fetch after assignment
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
  h.state.rpcResult = { error: null };
  h.state.capturedRpc = null;
  h.state.profilesSelectCall = 0;
});

describe('userRoleManagementService.assignRole — admin_assign_role RPC wiring', () => {
  it('delegates to the admin_assign_role RPC with the target user, role name, and role code', async () => {
    const result = await userRoleManagementService.assignRole(
      { user_id: 'u1', new_role: 'department_head', reason: 'promotion' },
      'super_admin',
      'admin-1'
    );

    expect(result.success).toBe(true);
    // The fix: assignment goes through the RPC, not a (silently no-op) direct UPDATE.
    expect(h.state.capturedRpc?.name).toBe('admin_assign_role');
    expect(h.state.capturedRpc?.params.p_target_user_id).toBe('u1');
    expect(h.state.capturedRpc?.params.p_role_name).toBe('department_head');
    // role_code is resolved from ROLE_TO_CODE and passed through.
    expect(h.state.capturedRpc?.params).toHaveProperty('p_role_code');
  });

  it('returns a mapped failure (not success) when the RPC rejects the assignment', async () => {
    h.state.rpcResult = { error: { message: 'CROSS_TENANT_DENIED: cannot assign roles outside your tenant' } };

    const result = await userRoleManagementService.assignRole(
      { user_id: 'u1', new_role: 'department_head', reason: 'promotion' },
      'super_admin',
      'admin-1'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('You cannot assign roles to users outside your organization.');
    }
  });

  it('blocks assigning a role outside the admin hierarchy WITHOUT calling the RPC', async () => {
    // A nurse cannot assign super_admin; the pre-flight guard must short-circuit.
    const result = await userRoleManagementService.assignRole(
      { user_id: 'u1', new_role: 'super_admin', reason: 'attempted escalation' },
      'nurse',
      'admin-1'
    );

    expect(result.success).toBe(false);
    // Critical: the RPC must never be reached for an out-of-scope assignment.
    expect(h.state.capturedRpc).toBeNull();
  });

  it('refuses self-assignment WITHOUT calling the RPC', async () => {
    const result = await userRoleManagementService.assignRole(
      { user_id: 'admin-1', new_role: 'department_head', reason: 'self promotion' },
      'super_admin',
      'admin-1'
    );

    expect(result.success).toBe(false);
    expect(h.state.capturedRpc).toBeNull();
  });
});
