/**
 * Admin Chat Assistant Service
 *
 * Frontend service for AI-powered conversational admin assistance.
 * Provides intelligent help for administrative tasks:
 * - Workflow guidance and process explanations
 * - Report generation and data queries
 * - System configuration assistance
 * - Compliance and policy questions
 * - Troubleshooting common issues
 *
 * Uses Claude Haiku 4.5 for fast, cost-effective responses.
 *
 * @module adminChatAssistantService
 * @skill #59 - Admin Chat Assistant
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base/ServiceResult';
import { auditLogger } from '../auditLogger';

// ============================================================================
// Types
// ============================================================================

export type AdminQueryCategory =
  | 'workflow'
  | 'reporting'
  | 'configuration'
  | 'compliance'
  | 'troubleshooting'
  | 'billing'
  | 'user_management'
  | 'general';

export type AdminRole =
  | 'super_admin'
  | 'tenant_admin'
  | 'billing_admin'
  | 'compliance_officer'
  | 'it_admin'
  | 'general_admin';

export interface AdminContext {
  role: AdminRole;
  tenantId?: string;
  department?: string;
  permissions?: string[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  category?: AdminQueryCategory;
}

export interface SuggestedAction {
  action: string;
  description: string;
  route?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface RelatedResource {
  title: string;
  type: 'doc' | 'video' | 'faq' | 'route';
  url?: string;
  route?: string;
}

export interface AdminChatRequest {
  query: string;
  adminId: string;
  adminContext: AdminContext;
  conversationHistory?: ConversationMessage[];
  tenantId?: string;
  currentPage?: string;
}

export interface AdminChatResponse {
  response: string;
  category: AdminQueryCategory;
  confidence: number;
  suggestedActions: SuggestedAction[];
  relatedResources: RelatedResource[];
  followUpQuestions: string[];
  requiresEscalation: boolean;
  escalationReason?: string;
  canAutomate: boolean;
  automationSuggestion?: string;
  metadata: {
    generatedAt: string;
    responseTimeMs: number;
    model: string;
    tokensUsed: number;
  };
}

export interface ChatSession {
  sessionId: string;
  adminId: string;
  startedAt: string;
  lastActiveAt: string;
  messageCount: number;
  categories: AdminQueryCategory[];
  resolved: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_KEYWORDS: Record<AdminQueryCategory, string[]> = {
  workflow: ['process', 'how to', 'steps', 'workflow', 'procedure', 'guide'],
  reporting: ['report', 'data', 'analytics', 'metrics', 'dashboard', 'export'],
  configuration: ['settings', 'configure', 'setup', 'change', 'update', 'modify'],
  compliance: ['hipaa', 'compliance', 'audit', 'policy', 'regulation', 'security'],
  troubleshooting: ['error', 'issue', 'problem', 'not working', 'fix', 'help'],
  billing: ['billing', 'invoice', 'payment', 'claim', 'charge', 'revenue'],
  user_management: ['user', 'account', 'permission', 'role', 'access', 'password'],
  general: [],
};

// ============================================================================
// Helper Functions
// ============================================================================

function detectCategory(query: string): AdminQueryCategory {
  const lowerQuery = query.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
      return category as AdminQueryCategory;
    }
  }

  return 'general';
}

function generateFollowUpQuestions(
  category: AdminQueryCategory,
  query: string
): string[] {
  const followUps: Record<AdminQueryCategory, string[]> = {
    workflow: [
      'Would you like step-by-step instructions?',
      'Do you need this documented for your team?',
      'Should I show you related workflows?',
    ],
    reporting: [
      'What date range would you like for this report?',
      'Would you like to schedule this report automatically?',
      'Do you need this data exported to Excel?',
    ],
    configuration: [
      'Would you like me to walk you through the settings?',
      'Should I save the current settings before making changes?',
      'Do you want to test this in a sandbox first?',
    ],
    compliance: [
      'Do you need documentation for an audit?',
      'Should I generate a compliance report?',
      'Would you like to review related policies?',
    ],
    troubleshooting: [
      'Can you describe when this issue started?',
      'Has this happened before?',
      'Would you like me to check the system logs?',
    ],
    billing: [
      'Would you like a breakdown of the charges?',
      'Do you need to generate an invoice?',
      'Should I check for any pending claims?',
    ],
    user_management: [
      'What permissions does this user need?',
      'Should I send a password reset email?',
      'Do you want to review the user activity log?',
    ],
    general: [
      'Can you tell me more about what you need?',
      'Would you like me to search our help documentation?',
      'Should I connect you with a specific department?',
    ],
  };

  return followUps[category] || followUps.general;
}

// ============================================================================
// Service
// ============================================================================

export const AdminChatAssistantService = {
  /**
   * Send a query to the admin chat assistant
   */
  async chat(
    request: AdminChatRequest
  ): Promise<ServiceResult<AdminChatResponse>> {
    const startTime = Date.now();

    try {
      const {
        query,
        adminId,
        adminContext,
        conversationHistory,
        tenantId,
        currentPage,
      } = request;

      if (!query || !adminId || !adminContext) {
        return failure(
          'VALIDATION_ERROR',
          'Query, Admin ID, and Admin Context are required'
        );
      }

      // Detect query category locally for fast response
      const detectedCategory = detectCategory(query);

      // Build conversation context for AI
      const conversationContext =
        conversationHistory
          ?.slice(-5)
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n') || '';

      // Call edge function for AI response
      const { data, error } = await supabase.functions.invoke(
        'ai-admin-chat-assistant',
        {
          body: {
            query,
            adminRole: adminContext.role,
            department: adminContext.department,
            permissions: adminContext.permissions,
            conversationContext,
            currentPage,
            detectedCategory,
            tenantId: tenantId || adminContext.tenantId,
          },
        }
      );

      if (error) {
        await auditLogger.error(
          'ADMIN_CHAT_EDGE_FUNCTION_ERROR',
          error instanceof Error ? error : new Error(String(error)),
          { adminId, query: query.substring(0, 100) }
        );

        // Provide fallback response for common queries
        const fallbackResponse = generateFallbackResponse(
          query,
          detectedCategory,
          adminContext
        );
        return success(fallbackResponse);
      }

      const response = data as AdminChatResponse;

      // Enhance response with local suggestions
      response.followUpQuestions = generateFollowUpQuestions(
        response.category || detectedCategory,
        query
      );

      // Log successful interaction
      await auditLogger.info('ADMIN_CHAT_QUERY', {
        adminId,
        category: response.category,
        confidence: response.confidence,
        responseTimeMs: Date.now() - startTime,
      });

      return success({
        ...response,
        metadata: {
          ...response.metadata,
          responseTimeMs: Date.now() - startTime,
        },
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'ADMIN_CHAT_SERVICE_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { query: request.query.substring(0, 100) }
      );

      return failure('OPERATION_FAILED', 'Failed to process admin chat request');
    }
  },

  /**
   * Start a new chat session
   */
  async startSession(
    adminId: string,
    adminContext: AdminContext
  ): Promise<ServiceResult<ChatSession>> {
    try {
      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      const session: ChatSession = {
        sessionId,
        adminId,
        startedAt: now,
        lastActiveAt: now,
        messageCount: 0,
        categories: [],
        resolved: false,
      };

      // Store session in database
      const { error } = await supabase.from('admin_chat_sessions').insert({
        id: sessionId,
        admin_id: adminId,
        admin_role: adminContext.role,
        tenant_id: adminContext.tenantId,
        started_at: now,
        last_active_at: now,
        message_count: 0,
        categories: [],
        resolved: false,
      });

      if (error) {
        await auditLogger.error(
          'ADMIN_CHAT_SESSION_CREATE_ERROR',
          error instanceof Error ? error : new Error(String(error)),
          { adminId }
        );
        // Continue without persistence
      }

      await auditLogger.info('ADMIN_CHAT_SESSION_STARTED', {
        sessionId,
        adminId,
        adminRole: adminContext.role,
      });

      return success(session);
    } catch (err: unknown) {
      await auditLogger.error(
        'ADMIN_CHAT_SESSION_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { adminId }
      );

      return failure('OPERATION_FAILED', 'Failed to start chat session');
    }
  },

  /**
   * Get suggested queries based on current page and role
   */
  async getSuggestedQueries(
    adminContext: AdminContext,
    currentPage?: string
  ): Promise<ServiceResult<string[]>> {
    try {
      const suggestions: Record<AdminRole, string[]> = {
        super_admin: [
          'Show me system health overview',
          'Generate compliance report for this month',
          'What tenants have the highest activity?',
          'How do I configure SSO settings?',
        ],
        tenant_admin: [
          'Show me user activity for this week',
          'How do I add a new department?',
          'Generate monthly usage report',
          'What are the pending approvals?',
        ],
        billing_admin: [
          'Show unpaid invoices',
          'How do I process a refund?',
          'Generate revenue report for Q4',
          'What claims are pending review?',
        ],
        compliance_officer: [
          'Run HIPAA compliance check',
          'Show audit log for today',
          'Generate SOC2 report',
          'What are the open security findings?',
        ],
        it_admin: [
          'Show system performance metrics',
          'How do I reset user MFA?',
          'Check integration status',
          'What are the recent error logs?',
        ],
        general_admin: [
          'How do I create a new user?',
          'Where can I find reports?',
          'How do I update my profile?',
          'What are my pending tasks?',
        ],
      };

      // Add page-specific suggestions
      const pageSuggestions: Record<string, string[]> = {
        '/admin/users': [
          'How do I bulk import users?',
          'What permissions does each role have?',
        ],
        '/admin/billing': [
          'How do I apply a discount?',
          'What are the payment terms?',
        ],
        '/admin/settings': [
          'How do I enable two-factor authentication?',
          'What settings affect all users?',
        ],
      };

      let allSuggestions = suggestions[adminContext.role] || suggestions.general_admin;

      if (currentPage && pageSuggestions[currentPage]) {
        allSuggestions = [...pageSuggestions[currentPage], ...allSuggestions];
      }

      return success(allSuggestions.slice(0, 6));
    } catch (err: unknown) {
      await auditLogger.error(
        'ADMIN_CHAT_SUGGESTIONS_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { adminRole: adminContext.role }
      );

      return failure('OPERATION_FAILED', 'Failed to get suggestions');
    }
  },

  /**
   * Rate a response for feedback
   */
  async rateResponse(
    sessionId: string,
    messageIndex: number,
    rating: 'helpful' | 'not_helpful',
    feedback?: string
  ): Promise<ServiceResult<void>> {
    try {
      await supabase.from('admin_chat_feedback').insert({
        session_id: sessionId,
        message_index: messageIndex,
        rating,
        feedback,
        created_at: new Date().toISOString(),
      });

      await auditLogger.info('ADMIN_CHAT_FEEDBACK', {
        sessionId,
        rating,
        hasFeedback: !!feedback,
      });

      return success(undefined);
    } catch (err: unknown) {
      await auditLogger.error(
        'ADMIN_CHAT_FEEDBACK_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { sessionId }
      );

      return failure('DATABASE_ERROR', 'Failed to save feedback');
    }
  },
};

// ============================================================================
// Fallback Response Generator
// ============================================================================

function generateFallbackResponse(
  query: string,
  category: AdminQueryCategory,
  adminContext: AdminContext
): AdminChatResponse {
  const fallbackResponses: Record<AdminQueryCategory, string> = {
    workflow:
      'I can help you with workflows! For step-by-step guidance, please check our documentation or use the suggested actions below.',
    reporting:
      'For reports, navigate to the Reports section in your dashboard. You can customize date ranges and export formats.',
    configuration:
      'System configuration can be found in Settings. Make sure you have the required permissions for the changes you want to make.',
    compliance:
      'For compliance questions, I recommend reviewing our HIPAA Compliance Guide or running the /security-scan command.',
    troubleshooting:
      'I understand you\'re having an issue. Please check the System Status page or contact support if the problem persists.',
    billing:
      'For billing inquiries, visit the Billing Dashboard. You can view invoices, process payments, and manage claims there.',
    user_management:
      'User management is available in the Users section. You can add, edit, and manage permissions from there.',
    general:
      'I\'m here to help! Please provide more details about what you need, or try one of the suggested actions below.',
  };

  const suggestedActions: SuggestedAction[] = [
    {
      action: 'View Documentation',
      description: 'Browse our help center for detailed guides',
      route: '/admin/help',
      priority: 'medium',
    },
    {
      action: 'Contact Support',
      description: 'Get help from our support team',
      route: '/admin/support',
      priority: 'low',
    },
  ];

  return {
    response: fallbackResponses[category],
    category,
    confidence: 0.6,
    suggestedActions,
    relatedResources: [],
    followUpQuestions: generateFollowUpQuestions(category, query),
    requiresEscalation: false,
    canAutomate: false,
    metadata: {
      generatedAt: new Date().toISOString(),
      responseTimeMs: 50,
      model: 'fallback',
      tokensUsed: 0,
    },
  };
}

export default AdminChatAssistantService;
