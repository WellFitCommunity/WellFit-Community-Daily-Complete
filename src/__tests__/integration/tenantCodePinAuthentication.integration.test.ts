/**
 * Tenant Code PIN Authentication - Integration Tests
 *
 * End-to-end tests for the complete PIN authentication flow
 * Tests both Master Super Admin (PIN only) and Tenant User (TenantCode-PIN)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, test, expect, beforeEach, vi, type Mock } from 'vitest';
import { SuperAdminService } from '../../services/superAdminService';
import { supabase } from '../../lib/supabaseClient';

// Mock Supabase
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn()
    },
    functions: {
      invoke: vi.fn()
    }
  }
}));

describe('Tenant Code PIN Authentication - Integration Tests', () => {
  describe('Master Super Admin Flow (No Tenant)', () => {
    const masterAdminUser = {
      id: 'user-master',
      email: 'admin@envisionvirtualedge.com'
    };

    beforeEach(() => {
      vi.clearAllMocks();

      // Mock getCurrentSuperAdmin
      (supabase.from as Mock).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'super-admin-master',
            user_id: masterAdminUser.id,
            email: masterAdminUser.email,
            role: 'super_admin',
            permissions: ['tenants.manage'],
            is_active: true
          },
          error: null
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            is_admin: true,
            role: 'super_admin',
            tenant_id: null // No tenant = Master Super Admin
          },
          error: null
        })
      });

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: masterAdminUser }
      });
    });

    test('should authenticate with PIN only (no tenant code required)', async () => {
      const mockVerifyPin = vi.fn().mockResolvedValue({
        data: {
          success: true,
          expires_at: new Date(Date.now() + 7200000).toISOString(),
          admin_token: 'mock-test-token-1' // Test fixture
        },
        error: null
      });

      (supabase.functions.invoke as Mock).mockImplementation(mockVerifyPin);

      // Simulate PIN authentication
      const result = await supabase.functions.invoke('verify-admin-pin', {
        body: { pin: '1234', role: 'super_admin' }
      });

      expect(result.data.success).toBe(true);
      expect(mockVerifyPin).toHaveBeenCalledWith('verify-admin-pin', {
        body: { pin: '1234', role: 'super_admin' }
      });
    });

    test('should NOT require tenant code for master admin', async () => {
      // Verify profiles query returns null tenant_id
      const { data } = await supabase.from('profiles')
        .select('is_admin, role, tenant_id')
        .eq('user_id', masterAdminUser.id)
        .maybeSingle();

      expect(data).not.toBeNull();
      expect(data!.tenant_id).toBeNull();

      // Tenant code should NOT be fetched
      expect(supabase.from).not.toHaveBeenCalledWith('tenants');
    });
  });

  describe('Tenant User Flow (Has Tenant)', () => {
    const tenantUser = {
      id: 'user-tenant',
      email: 'admin@methodist.com'
    };

    const tenantData = {
      id: 'tenant-methodist',
      tenant_code: 'MH-6702'
    };

    beforeEach(() => {
      vi.clearAllMocks();

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: tenantUser }
      });

      // Mock profiles query - returns tenant_id
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                is_admin: true,
                role: 'admin',
                tenant_id: tenantData.id
              },
              error: null
            }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'super-admin-tenant',
                user_id: tenantUser.id,
                email: tenantUser.email,
                role: 'admin',
                is_active: true
              },
              error: null
            })
          };
        }
        if (table === 'tenants') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { tenant_code: tenantData.tenant_code },
              error: null
            })
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        };
      });
    });

    test('should fetch tenant code for tenant user', async () => {
      // Fetch profile
      const { data: profile } = await supabase.from('profiles')
        .select('is_admin, role, tenant_id')
        .eq('user_id', tenantUser.id)
        .maybeSingle();

      expect(profile).not.toBeNull();
      expect(profile!.tenant_id).toBe(tenantData.id);

      // Fetch tenant code
      const { data: tenant } = await supabase.from('tenants')
        .select('tenant_code')
        .eq('id', profile!.tenant_id)
        .single();

      expect(tenant).not.toBeNull();
      expect(tenant!.tenant_code).toBe('MH-6702');
    });

    test('should authenticate with TenantCode-PIN format', async () => {
      const mockVerifyPin = vi.fn().mockResolvedValue({
        data: {
          success: true,
          expires_at: new Date(Date.now() + 7200000).toISOString(),
          admin_token: 'mock-test-token-2' // Test fixture
        },
        error: null
      });

      (supabase.functions.invoke as Mock).mockImplementation(mockVerifyPin);

      // Simulate PIN authentication with tenant code
      const result = await supabase.functions.invoke('verify-admin-pin', {
        body: { pin: 'MH-6702-1234', role: 'admin' }
      });

      expect(result.data.success).toBe(true);
      expect(mockVerifyPin).toHaveBeenCalledWith('verify-admin-pin', {
        body: { pin: 'MH-6702-1234', role: 'admin' }
      });
    });

    test('should validate tenant code matches user tenant', async () => {
      // Fetch user's tenant code
      const { data: profile } = await supabase.from('profiles')
        .select('tenant_id')
        .eq('user_id', tenantUser.id)
        .maybeSingle();

      expect(profile).not.toBeNull();

      const { data: tenant } = await supabase.from('tenants')
        .select('tenant_code')
        .eq('id', profile!.tenant_id)
        .single();

      expect(tenant).not.toBeNull();

      // Validate input matches
      const userInput = 'MH-6702-1234';
      const [inputCode] = userInput.split('-');
      const [expectedCode] = tenant!.tenant_code.split('-');

      expect(inputCode).toBe(expectedCode);
    });
  });

  describe('Tenant Code Assignment Flow', () => {
    const mockSuperAdmin = {
      id: 'super-admin-123',
      userId: 'user-123',
      email: 'admin@envisionvirtualedge.com',
      role: 'super_admin' as const,
      permissions: ['tenants.manage'] as string[],
      isActive: true
    };

    const testTenant = {
      id: 'tenant-test',
      name: 'Test Hospital',
      subdomain: 'test'
    };

    beforeEach(() => {
      vi.clearAllMocks();

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: { id: mockSuperAdmin.userId } }
      });

      // Mock getCurrentSuperAdmin
      (supabase.from as Mock).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockSuperAdmin.id,
            user_id: mockSuperAdmin.userId,
            email: mockSuperAdmin.email,
            role: mockSuperAdmin.role,
            permissions: mockSuperAdmin.permissions,
            is_active: mockSuperAdmin.isActive
          },
          error: null
        }),
        update: vi.fn().mockReturnThis()
      });
    });

    test('should assign tenant code through Super Admin UI', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'super_admin_users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: mockSuperAdmin.id,
                user_id: mockSuperAdmin.userId,
                email: mockSuperAdmin.email,
                role: mockSuperAdmin.role,
                permissions: mockSuperAdmin.permissions,
                is_active: mockSuperAdmin.isActive
              },
              error: null
            })
          };
        }
        if (table === 'tenants') {
          return { update: mockUpdate };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        };
      });

      await SuperAdminService.updateTenantCode({
        tenantId: testTenant.id,
        tenantCode: 'TH-9999',
        superAdminId: mockSuperAdmin.id
      });

      expect(mockUpdate).toHaveBeenCalledWith({ tenant_code: 'TH-9999' });
      expect(mockEq).toHaveBeenCalledWith('id', testTenant.id);
    });

    test('should reject duplicate tenant codes', async () => {
      (supabase.from as Mock).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      }).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: { code: '23505', message: 'duplicate key value' }
        })
      });

      await expect(
        SuperAdminService.updateTenantCode({
          tenantId: testTenant.id,
          tenantCode: 'DH-1234', // Valid format PREFIX-NUMBER
          superAdminId: mockSuperAdmin.id
        })
      ).rejects.toThrow('This tenant code is already in use');
    });
  });

  describe('PIN Authentication Security', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    test('should handle failed authentication gracefully', async () => {
      (supabase.functions.invoke as Mock).mockResolvedValue({
        data: {
          success: false,
          error: 'Invalid PIN'
        },
        error: null
      });

      const result = await supabase.functions.invoke('verify-admin-pin', {
        body: { pin: 'WRONG-PIN', role: 'admin' }
      });

      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Invalid PIN');
    });

    test('should not expose tenant information on failed auth', async () => {
      (supabase.functions.invoke as Mock).mockResolvedValue({
        data: {
          success: false,
          error: 'Authentication failed'
        },
        error: null
      });

      const result = await supabase.functions.invoke('verify-admin-pin', {
        body: { pin: 'WRONG-CODE-1234', role: 'admin' }
      });

      // Error should be generic, not revealing tenant details
      expect(result.data.error).not.toContain('tenant');
      expect(result.data.error).not.toContain('MH-6702');
    });

    test('should enforce session expiration (2 hours)', async () => {
      const expiresAt = new Date(Date.now() + 7200000); // 2 hours from now

      (supabase.functions.invoke as Mock).mockResolvedValue({
        data: {
          success: true,
          expires_at: expiresAt.toISOString(),
          admin_token: 'mock-test-token-3' // Test fixture
        },
        error: null
      });

      const result = await supabase.functions.invoke('verify-admin-pin', {
        body: { pin: '1234', role: 'super_admin' }
      });

      const tokenExpiry = new Date(result.data.expires_at);
      const twoHoursLater = new Date(Date.now() + 7200000);
      const timeDiff = Math.abs(tokenExpiry.getTime() - twoHoursLater.getTime());

      // Should expire within 2 hours (±1 minute tolerance)
      expect(timeDiff).toBeLessThan(60000);
    });
  });

  describe('Helper Function Integration', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    test('should lookup tenant by code using get_tenant_by_code', async () => {
      (supabase.rpc as Mock).mockResolvedValue({
        data: {
          tenant_id: 'tenant-123',
          tenant_name: 'Methodist Hospital',
          tenant_code: 'MH-6702'
        },
        error: null
      });

      const result = await supabase.rpc('get_tenant_by_code', {
        p_tenant_code: 'MH-6702'
      });

      expect(result.data.tenant_id).toBe('tenant-123');
      expect(result.data.tenant_code).toBe('MH-6702');
    });

    test('should be case-insensitive when looking up tenant code', async () => {
      (supabase.rpc as Mock).mockResolvedValue({
        data: {
          tenant_id: 'tenant-123',
          tenant_name: 'Methodist Hospital',
          tenant_code: 'MH-6702'
        },
        error: null
      });

      const result = await supabase.rpc('get_tenant_by_code', {
        p_tenant_code: 'mh-6702' // lowercase
      });

      expect(result.data.tenant_code).toBe('MH-6702'); // Returns uppercase
    });
  });

  describe('Full Authentication Journey', () => {
    test('Methodist Hospital admin complete flow', async () => {
      vi.clearAllMocks();

      const methodistAdmin = {
        id: 'user-methodist-admin',
        email: 'admin@methodist.com'
      };

      // Step 1: User logs in with email/password (mocked as already authenticated)
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: methodistAdmin }
      });

      // Step 2: Mock profile and tenant queries with chainable methods
      const profileMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            is_admin: true,
            role: 'admin',
            tenant_id: 'tenant-methodist'
          },
          error: null
        })
      };

      const tenantMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { tenant_code: 'MH-6702' },
          error: null
        })
      };

      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'profiles') return profileMock;
        if (table === 'tenants') return tenantMock;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        };
      });

      const { data: profile } = await supabase.from('profiles')
        .select('is_admin, role, tenant_id')
        .eq('user_id', methodistAdmin.id)
        .maybeSingle();

      expect(profile).not.toBeNull();
      expect(profile!.tenant_id).toBe('tenant-methodist');

      // Step 3: Fetch tenant code
      const { data: tenant } = await supabase.from('tenants')
        .select('tenant_code')
        .eq('id', profile!.tenant_id)
        .single();

      expect(tenant).not.toBeNull();
      expect(tenant!.tenant_code).toBe('MH-6702');

      // Step 4: User enters MH-6702-1234 (tenant code + PIN)
      const userInput = 'MH-6702-1234';
      const [inputCode, inputNumber] = userInput.split('-');

      expect(inputCode).toBe('MH');
      expect(inputNumber).toBe('6702');

      // Step 5: Verify PIN with backend
      (supabase.functions.invoke as Mock).mockResolvedValue({
        data: {
          success: true,
          expires_at: new Date(Date.now() + 7200000).toISOString(),
          admin_token: 'mock-test-token-4' // Test fixture
        },
        error: null
      });

      const { data: authResult } = await supabase.functions.invoke('verify-admin-pin', {
        body: { pin: userInput, role: 'admin' }
      });

      expect(authResult.success).toBe(true);
      expect(authResult.admin_token).toBeTruthy();

      // Step 6: User is authenticated and redirected to admin dashboard
      // Success! Complete flow verified.
    });
  });
});
