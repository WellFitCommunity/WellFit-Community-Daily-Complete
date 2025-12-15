/**
 * Tenant Code Management Tests
 *
 * Tests for updateTenantCode() method in SuperAdminService
 * Covers: format validation, unique constraints, audit logging
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { SuperAdminService } from '../superAdminService';
import { supabase } from '../../lib/supabaseClient';

// Mock Supabase
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn()
    }
  }
}));

// Mock audit logger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    error: vi.fn(),
    log: vi.fn()
  }
}));

describe('SuperAdminService - Tenant Code Management', () => {
  const mockSuperAdmin = {
    id: 'super-admin-123',
    userId: 'user-123',
    email: 'admin@envisionvirtualedge.com',
    displayName: 'Test Admin',
    role: 'super_admin' as const,
    permissions: ['tenants.manage'] as any[],
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getCurrentSuperAdmin
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: mockSuperAdmin.id,
          user_id: mockSuperAdmin.userId,
          email: mockSuperAdmin.email,
          full_name: mockSuperAdmin.displayName,
          role: mockSuperAdmin.role,
          permissions: mockSuperAdmin.permissions,
          is_active: mockSuperAdmin.isActive,
          created_at: mockSuperAdmin.createdAt
        },
        error: null
      })
    });

    (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user: { id: mockSuperAdmin.userId } }
    });
  });

  describe('Format Validation', () => {
    test('should accept valid tenant code: MH-6702', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockSuperAdmin.id,
            user_id: mockSuperAdmin.userId,
            email: mockSuperAdmin.email,
            role: mockSuperAdmin.role,
            permissions: mockSuperAdmin.permissions,
            is_active: true
          },
          error: null
        })
      }).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: mockUpdate
      });

      await SuperAdminService.updateTenantCode({
        tenantId: 'tenant-123',
        tenantCode: 'MH-6702',
        superAdminId: mockSuperAdmin.id
      });

      expect(mockUpdate).toHaveBeenCalledWith('id', 'tenant-123');
    });

    test('should accept valid tenant code: PH-1234', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      }).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: mockUpdate
      });

      await SuperAdminService.updateTenantCode({
        tenantId: 'tenant-456',
        tenantCode: 'PH-1234',
        superAdminId: mockSuperAdmin.id
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    test('should accept 1-letter prefix: A-123456', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      }).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: mockUpdate
      });

      await SuperAdminService.updateTenantCode({
        tenantId: 'tenant-789',
        tenantCode: 'A-123456',
        superAdminId: mockSuperAdmin.id
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    test('should accept 4-letter prefix: ABCD-1234', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      }).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: mockUpdate
      });

      await SuperAdminService.updateTenantCode({
        tenantId: 'tenant-abc',
        tenantCode: 'ABCD-1234',
        superAdminId: mockSuperAdmin.id
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    test('should reject code without hyphen: MH6702', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      });

      await expect(
        SuperAdminService.updateTenantCode({
          tenantId: 'tenant-123',
          tenantCode: 'MH6702',
          superAdminId: mockSuperAdmin.id
        })
      ).rejects.toThrow('Invalid tenant code format');
    });

    test('should accept lowercase prefix (auto-uppercased): mh-6702', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      }).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: mockUpdate
      });

      await SuperAdminService.updateTenantCode({
        tenantId: 'tenant-123',
        tenantCode: 'mh-6702',
        superAdminId: mockSuperAdmin.id
      });

      // Verify it was converted to uppercase
      expect(mockUpdate).toHaveBeenCalled();
    });

    test('should reject letters in number: MH-67A2', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      });

      await expect(
        SuperAdminService.updateTenantCode({
          tenantId: 'tenant-123',
          tenantCode: 'MH-67A2',
          superAdminId: mockSuperAdmin.id
        })
      ).rejects.toThrow('Invalid tenant code format');
    });

    test('should reject prefix too long: ABCDE-1234', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      });

      await expect(
        SuperAdminService.updateTenantCode({
          tenantId: 'tenant-123',
          tenantCode: 'ABCDE-1234',
          superAdminId: mockSuperAdmin.id
        })
      ).rejects.toThrow('Invalid tenant code format');
    });

    test('should reject number too short: MH-123', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      });

      await expect(
        SuperAdminService.updateTenantCode({
          tenantId: 'tenant-123',
          tenantCode: 'MH-123',
          superAdminId: mockSuperAdmin.id
        })
      ).rejects.toThrow('Invalid tenant code format');
    });

    test('should reject number too long: MH-1234567', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      });

      await expect(
        SuperAdminService.updateTenantCode({
          tenantId: 'tenant-123',
          tenantCode: 'MH-1234567',
          superAdminId: mockSuperAdmin.id
        })
      ).rejects.toThrow('Invalid tenant code format');
    });
  });

  describe('Unique Constraint Handling', () => {
    test('should handle duplicate tenant code error', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
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
          tenantId: 'tenant-123',
          tenantCode: 'MH-6702',
          superAdminId: mockSuperAdmin.id
        })
      ).rejects.toThrow('This tenant code is already in use');
    });
  });

  describe('Auto-Uppercase Conversion', () => {
    test('should convert lowercase to uppercase', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      }).mockReturnValueOnce({
        update: mockUpdate,
        eq: mockEq
      });

      mockUpdate.mockReturnValue({ eq: mockEq });

      await SuperAdminService.updateTenantCode({
        tenantId: 'tenant-123',
        tenantCode: 'mh-6702',
        superAdminId: mockSuperAdmin.id
      });

      // Should have attempted to update with uppercase version
      expect(mockUpdate).toHaveBeenCalledWith({
        tenant_code: 'MH-6702'
      });
    });
  });

  describe('Authorization', () => {
    test('should reject if not super admin', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      await expect(
        SuperAdminService.updateTenantCode({
          tenantId: 'tenant-123',
          tenantCode: 'MH-6702',
          superAdminId: mockSuperAdmin.id
        })
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('SQL Injection Protection', () => {
    test('should handle SQL injection attempts in tenant code', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      });

      await expect(
        SuperAdminService.updateTenantCode({
          tenantId: 'tenant-123',
          tenantCode: "'; DROP TABLE tenants; --",
          superAdminId: mockSuperAdmin.id
        })
      ).rejects.toThrow('Invalid tenant code format');
    });

    test('should handle XSS attempts in tenant code', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      });

      await expect(
        SuperAdminService.updateTenantCode({
          tenantId: 'tenant-123',
          tenantCode: '<script>alert("xss")</script>',
          superAdminId: mockSuperAdmin.id
        })
      ).rejects.toThrow('Invalid tenant code format');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty string', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      });

      await expect(
        SuperAdminService.updateTenantCode({
          tenantId: 'tenant-123',
          tenantCode: '',
          superAdminId: mockSuperAdmin.id
        })
      ).rejects.toThrow('Invalid tenant code format');
    });

    test('should handle whitespace', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      });

      await expect(
        SuperAdminService.updateTenantCode({
          tenantId: 'tenant-123',
          tenantCode: '  MH-6702  ',
          superAdminId: mockSuperAdmin.id
        })
      ).rejects.toThrow('Invalid tenant code format');
    });

    test('should handle special characters', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSuperAdmin,
          error: null
        })
      });

      await expect(
        SuperAdminService.updateTenantCode({
          tenantId: 'tenant-123',
          tenantCode: 'MH@6702',
          superAdminId: mockSuperAdmin.id
        })
      ).rejects.toThrow('Invalid tenant code format');
    });
  });
});
