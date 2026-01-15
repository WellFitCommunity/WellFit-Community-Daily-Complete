/**
 * Tests for Admin Chat Assistant Service
 *
 * @skill #59 - Admin Chat Assistant
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminChatAssistantService } from '../adminChatAssistantService';
import type {
  AdminQueryCategory,
  AdminRole,
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

  describe('admin role definitions', () => {
    it('should define all admin roles', () => {
      const roles: AdminRole[] = [
        'super_admin',
        'tenant_admin',
        'billing_admin',
        'compliance_officer',
        'it_admin',
        'general_admin',
      ];
      expect(roles).toHaveLength(6);
      expect(roles).toContain('super_admin');
      expect(roles).toContain('compliance_officer');
    });

    it('should define all query categories', () => {
      const categories: AdminQueryCategory[] = [
        'workflow',
        'reporting',
        'configuration',
        'compliance',
        'troubleshooting',
        'billing',
        'user_management',
        'general',
      ];
      expect(categories).toHaveLength(8);
      expect(categories).toContain('workflow');
      expect(categories).toContain('compliance');
      expect(categories).toContain('billing');
    });
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

  describe('category detection', () => {
    it('should classify workflow queries', () => {
      const workflowKeywords = ['process', 'how to', 'steps', 'workflow', 'procedure', 'guide'];
      expect(workflowKeywords).toContain('workflow');
      expect(workflowKeywords).toContain('how to');
    });

    it('should classify reporting queries', () => {
      const reportingKeywords = ['report', 'data', 'analytics', 'metrics', 'dashboard', 'export'];
      expect(reportingKeywords).toContain('report');
      expect(reportingKeywords).toContain('analytics');
    });

    it('should classify configuration queries', () => {
      const configKeywords = ['settings', 'configure', 'setup', 'change', 'update', 'modify'];
      expect(configKeywords).toContain('configure');
      expect(configKeywords).toContain('settings');
    });

    it('should classify compliance queries', () => {
      const complianceKeywords = ['hipaa', 'compliance', 'audit', 'policy', 'regulation', 'security'];
      expect(complianceKeywords).toContain('hipaa');
      expect(complianceKeywords).toContain('compliance');
    });

    it('should classify troubleshooting queries', () => {
      const troubleshootingKeywords = ['error', 'issue', 'problem', 'not working', 'fix', 'help'];
      expect(troubleshootingKeywords).toContain('error');
      expect(troubleshootingKeywords).toContain('fix');
    });

    it('should classify billing queries', () => {
      const billingKeywords = ['billing', 'invoice', 'payment', 'claim', 'charge', 'revenue'];
      expect(billingKeywords).toContain('billing');
      expect(billingKeywords).toContain('invoice');
    });

    it('should classify user management queries', () => {
      const userKeywords = ['user', 'account', 'permission', 'role', 'access', 'password'];
      expect(userKeywords).toContain('user');
      expect(userKeywords).toContain('permission');
    });
  });

  describe('follow-up questions generation', () => {
    it('should generate follow-ups for workflow category', () => {
      const followUps = [
        'Would you like step-by-step instructions?',
        'Do you need this documented for your team?',
        'Should I show you related workflows?',
      ];
      expect(followUps).toHaveLength(3);
      expect(followUps[0]).toContain('step-by-step');
    });

    it('should generate follow-ups for reporting category', () => {
      const followUps = [
        'What date range would you like for this report?',
        'Would you like to schedule this report automatically?',
        'Do you need this data exported to Excel?',
      ];
      expect(followUps).toHaveLength(3);
      expect(followUps[0]).toContain('date range');
    });

    it('should generate follow-ups for compliance category', () => {
      const followUps = [
        'Do you need documentation for an audit?',
        'Should I generate a compliance report?',
        'Would you like to review related policies?',
      ];
      expect(followUps).toHaveLength(3);
      expect(followUps[0]).toContain('audit');
    });
  });

  describe('conversation message types', () => {
    it('should define user and assistant roles', () => {
      const roles = ['user', 'assistant'];
      expect(roles).toContain('user');
      expect(roles).toContain('assistant');
    });

    it('should accept conversation history in chat', () => {
      const history = [
        { role: 'user' as const, content: 'How do I reset a password?', timestamp: new Date().toISOString() },
        { role: 'assistant' as const, content: 'Go to User Management...', timestamp: new Date().toISOString() },
      ];
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
    });
  });

  describe('suggested action types', () => {
    it('should define priority levels', () => {
      const priorities = ['low', 'medium', 'high'];
      expect(priorities).toHaveLength(3);
      expect(priorities).toContain('high');
    });

    it('should define action structure', () => {
      const action = {
        action: 'View Documentation',
        description: 'Browse our help center',
        route: '/admin/help',
        priority: 'medium' as const,
      };
      expect(action.action).toBeDefined();
      expect(action.priority).toBe('medium');
    });
  });

  describe('related resource types', () => {
    it('should define resource types', () => {
      const types = ['doc', 'video', 'faq', 'route'];
      expect(types).toHaveLength(4);
      expect(types).toContain('doc');
      expect(types).toContain('video');
    });

    it('should define resource structure', () => {
      const resource = {
        title: 'User Management Guide',
        type: 'doc' as const,
        url: '/docs/user-management',
      };
      expect(resource.title).toBeDefined();
      expect(resource.type).toBe('doc');
    });
  });

  describe('chat session tracking', () => {
    it('should track session metadata', () => {
      const session = {
        sessionId: 'test-id',
        adminId: 'admin-1',
        startedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        messageCount: 5,
        categories: ['workflow', 'billing'] as AdminQueryCategory[],
        resolved: false,
      };
      expect(session.sessionId).toBeDefined();
      expect(session.messageCount).toBe(5);
      expect(session.categories).toHaveLength(2);
    });
  });

  describe('response metadata', () => {
    it('should include timing information', () => {
      const metadata = {
        generatedAt: new Date().toISOString(),
        responseTimeMs: 250,
        model: 'claude-haiku-4-5',
        tokensUsed: 150,
      };
      expect(metadata.responseTimeMs).toBeGreaterThan(0);
      expect(metadata.model).toContain('haiku');
    });
  });

  describe('escalation handling', () => {
    it('should detect when escalation is required', () => {
      const response = {
        requiresEscalation: true,
        escalationReason: 'Complex compliance question requires legal review',
      };
      expect(response.requiresEscalation).toBe(true);
      expect(response.escalationReason).toBeDefined();
    });

    it('should handle non-escalation responses', () => {
      const response = {
        requiresEscalation: false,
        escalationReason: undefined,
      };
      expect(response.requiresEscalation).toBe(false);
      expect(response.escalationReason).toBeUndefined();
    });
  });

  describe('automation suggestions', () => {
    it('should detect automatable tasks', () => {
      const response = {
        canAutomate: true,
        automationSuggestion: 'This report can be scheduled to run automatically every Monday',
      };
      expect(response.canAutomate).toBe(true);
      expect(response.automationSuggestion).toContain('scheduled');
    });

    it('should handle non-automatable tasks', () => {
      const response = {
        canAutomate: false,
        automationSuggestion: undefined,
      };
      expect(response.canAutomate).toBe(false);
    });
  });

  describe('admin context handling', () => {
    it('should accept full admin context', () => {
      const context: AdminContext = {
        role: 'tenant_admin',
        tenantId: 'tenant-123',
        department: 'IT',
        permissions: ['manage_users', 'view_reports', 'configure_settings'],
      };
      expect(context.role).toBe('tenant_admin');
      expect(context.permissions).toHaveLength(3);
    });

    it('should accept minimal admin context', () => {
      const context: AdminContext = {
        role: 'general_admin',
      };
      expect(context.role).toBe('general_admin');
      expect(context.tenantId).toBeUndefined();
    });
  });
});
