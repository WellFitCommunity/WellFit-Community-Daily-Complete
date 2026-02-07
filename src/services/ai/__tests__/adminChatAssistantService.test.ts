/**
 * Tests for Admin Chat Assistant Service
 *
 * @skill #59 - Admin Chat Assistant
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminChatAssistantService } from '../adminChatAssistantService';
import type {
  AdminContext,
  AdminChatRequest,
} from '../adminChatAssistantService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
    })),
  },
}));

// Mock audit logger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AdminChatAssistantService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('chat method validation', () => {
    it('should reject empty query', async () => {
      const request: AdminChatRequest = {
        query: '',
        adminId: 'test-admin',
        adminContext: { role: 'super_admin' },
      };

      const result = await AdminChatAssistantService.chat(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing admin ID', async () => {
      const request: AdminChatRequest = {
        query: 'How do I create a user?',
        adminId: '',
        adminContext: { role: 'super_admin' },
      };

      const result = await AdminChatAssistantService.chat(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing admin context', async () => {
      const request = {
        query: 'How do I create a user?',
        adminId: 'test-admin',
        adminContext: null,
      } as unknown as AdminChatRequest;

      const result = await AdminChatAssistantService.chat(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('startSession method', () => {
    it('should create a session with valid parameters', async () => {
      const adminId = 'test-admin';
      const adminContext: AdminContext = {
        role: 'tenant_admin',
        tenantId: 'test-tenant',
      };

      const result = await AdminChatAssistantService.startSession(adminId, adminContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.sessionId).toBeDefined();
      expect(result.data?.adminId).toBe(adminId);
      expect(result.data?.messageCount).toBe(0);
      expect(result.data?.resolved).toBe(false);
    });

    it('should generate unique session IDs', async () => {
      const adminContext: AdminContext = { role: 'super_admin' };

      const result1 = await AdminChatAssistantService.startSession('admin1', adminContext);
      const result2 = await AdminChatAssistantService.startSession('admin2', adminContext);

      expect(result1.data?.sessionId).not.toBe(result2.data?.sessionId);
    });
  });

  describe('getSuggestedQueries method', () => {
    it('should return suggestions for super_admin', async () => {
      const adminContext: AdminContext = { role: 'super_admin' };

      const result = await AdminChatAssistantService.getSuggestedQueries(adminContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBeGreaterThan(0);
      expect(result.data?.length).toBeLessThanOrEqual(6);
    });

    it('should return suggestions for billing_admin', async () => {
      const adminContext: AdminContext = { role: 'billing_admin' };

      const result = await AdminChatAssistantService.getSuggestedQueries(adminContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      // Billing admin should see billing-related suggestions
      const hasBillingSuggestion = result.data?.some(
        (s) => s.toLowerCase().includes('invoice') || s.toLowerCase().includes('billing')
      );
      expect(hasBillingSuggestion).toBe(true);
    });

    it('should return suggestions for compliance_officer', async () => {
      const adminContext: AdminContext = { role: 'compliance_officer' };

      const result = await AdminChatAssistantService.getSuggestedQueries(adminContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      // Compliance officer should see compliance-related suggestions
      const hasComplianceSuggestion = result.data?.some(
        (s) =>
          s.toLowerCase().includes('hipaa') ||
          s.toLowerCase().includes('compliance') ||
          s.toLowerCase().includes('audit')
      );
      expect(hasComplianceSuggestion).toBe(true);
    });

    it('should return suggestions for it_admin', async () => {
      const adminContext: AdminContext = { role: 'it_admin' };

      const result = await AdminChatAssistantService.getSuggestedQueries(adminContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should include page-specific suggestions when currentPage provided', async () => {
      const adminContext: AdminContext = { role: 'general_admin' };

      const result = await AdminChatAssistantService.getSuggestedQueries(
        adminContext,
        '/admin/users'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      // Should include user management suggestions for the users page
      const hasUserSuggestion = result.data?.some(
        (s) => s.toLowerCase().includes('user') || s.toLowerCase().includes('bulk')
      );
      expect(hasUserSuggestion).toBe(true);
    });

    it('should return default suggestions for general_admin', async () => {
      const adminContext: AdminContext = { role: 'general_admin' };

      const result = await AdminChatAssistantService.getSuggestedQueries(adminContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBeGreaterThan(0);
    });
  });

  describe('rateResponse method', () => {
    it('should accept helpful rating', async () => {
      const result = await AdminChatAssistantService.rateResponse(
        'test-session',
        0,
        'helpful'
      );

      expect(result.success).toBe(true);
    });

    it('should accept not_helpful rating', async () => {
      const result = await AdminChatAssistantService.rateResponse(
        'test-session',
        1,
        'not_helpful'
      );

      expect(result.success).toBe(true);
    });

    it('should accept optional feedback', async () => {
      const result = await AdminChatAssistantService.rateResponse(
        'test-session',
        0,
        'helpful',
        'This was very helpful for understanding the workflow'
      );

      expect(result.success).toBe(true);
    });
  });

});
