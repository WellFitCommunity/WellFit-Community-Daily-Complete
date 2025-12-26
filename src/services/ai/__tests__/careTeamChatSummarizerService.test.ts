/**
 * Tests for Care Team Chat Summarizer Service
 *
 * Covers chat summarization, action item extraction, and sentiment analysis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CareTeamChatSummarizerService,
  ChatMessage,
  ChatSummaryRequest,
  ChatSummaryResponse,
  ActionItem,
} from '../careTeamChatSummarizerService';

// Mock supabaseClient
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    })),
  },
}));

// =====================================================
// MOCK DATA FACTORIES
// =====================================================

function createMockMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return {
    messageId: 'msg-123',
    timestamp: new Date().toISOString(),
    senderId: 'user-1',
    senderName: 'Dr. Smith',
    senderRole: 'physician',
    content: 'Patient vitals are stable',
    ...overrides,
  };
}

function createMockChatRequest(overrides?: Partial<ChatSummaryRequest>): ChatSummaryRequest {
  return {
    messages: [createMockMessage()],
    channelName: 'unit-3-care-team',
    summaryType: 'shift_handoff',
    tenantId: 'test-tenant',
    ...overrides,
  };
}

function createMockChatResponse(): ChatSummaryResponse {
  return {
    result: {
      summaryId: 'summary-123',
      periodStart: '2025-01-01T08:00:00Z',
      periodEnd: '2025-01-01T16:00:00Z',
      channelName: 'unit-3-care-team',
      messageCount: 25,
      participantCount: 5,
      participants: [
        { id: 'user-1', name: 'Dr. Smith', role: 'physician', messageCount: 10 },
      ],
      executiveSummary: 'Shift summary: All patients stable, 2 discharges pending.',
      keyTopics: [
        { topic: 'Patient vitals', messageCount: 5, importance: 'high' },
      ],
      patientMentions: [
        { patientId: 'P001', mentionCount: 3, context: 'Discharge planning' },
      ],
      keyDecisions: [
        {
          id: 'dec-1',
          decision: 'Proceed with discharge for P001',
          madeBy: 'Dr. Smith',
          timestamp: new Date().toISOString(),
          sourceMessageId: 'msg-5',
        },
      ],
      actionItems: [
        {
          id: 'action-1',
          action: 'Complete discharge paperwork',
          assignedTo: 'Nurse Jones',
          priority: 'high',
          status: 'pending',
          sourceMessageId: 'msg-10',
          context: 'Patient P001 discharge',
        },
      ],
      criticalUpdates: [],
      followUpRequired: [],
      sentimentAnalysis: {
        overallSentiment: 'positive',
        urgencyLevel: 'calm',
        teamMorale: 'high',
        stressIndicators: [],
        positiveIndicators: ['good teamwork'],
      },
      handoffNotes: ['All tasks completed for shift'],
      unansweredQuestions: [],
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'claude-haiku-4.5',
      responseTimeMs: 800,
      messagesProcessed: 25,
    },
  };
}

// =====================================================
// TESTS
// =====================================================

describe('CareTeamChatSummarizerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('summarizeChat', () => {
    it('should return failure when messages array is empty', async () => {
      const request = createMockChatRequest({ messages: [] });
      const result = await CareTeamChatSummarizerService.summarizeChat(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when messages is undefined', async () => {
      const request = createMockChatRequest({ messages: undefined as unknown as ChatMessage[] });
      const result = await CareTeamChatSummarizerService.summarizeChat(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should handle edge function errors gracefully', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Edge function error' },
      });

      const request = createMockChatRequest();
      const result = await CareTeamChatSummarizerService.summarizeChat(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SUMMARIZATION_FAILED');
    });

    it('should successfully summarize chat', async () => {
      const mockResponse = createMockChatResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockChatRequest();
      const result = await CareTeamChatSummarizerService.summarizeChat(request);

      expect(result.success).toBe(true);
      expect(result.data?.result.messageCount).toBe(25);
      expect(result.data?.result.actionItems.length).toBe(1);
    });
  });

  describe('saveSummary', () => {
    it('should save summary successfully', async () => {
      const request = createMockChatRequest();
      const response = createMockChatResponse();

      const result = await CareTeamChatSummarizerService.saveSummary(request, response);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test-id');
    });
  });

  describe('getChannelSummaries', () => {
    it('should fetch channel summaries', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = [{ result: createMockChatResponse().result }];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as never);

      const result = await CareTeamChatSummarizerService.getChannelSummaries(
        'unit-3-care-team',
        'tenant-123'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('getPendingActionItems', () => {
    it('should return pending action items sorted by priority', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockActionItems: ActionItem[] = [
        {
          id: '1',
          action: 'Task 1',
          assignedTo: 'User A',
          priority: 'medium',
          status: 'pending',
          sourceMessageId: 'msg-1',
          context: 'Context 1',
        },
        {
          id: '2',
          action: 'Task 2',
          assignedTo: 'User B',
          priority: 'urgent',
          status: 'pending',
          sourceMessageId: 'msg-2',
          context: 'Context 2',
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ action_items: mockActionItems }], error: null }),
      } as never);

      const result = await CareTeamChatSummarizerService.getPendingActionItems('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.[0].priority).toBe('urgent');
    });
  });

  describe('categorizeMessage', () => {
    it('should categorize urgent messages correctly', () => {
      const result = CareTeamChatSummarizerService.categorizeMessage('URGENT: Patient in distress');
      expect(result.category).toBe('urgent');
      expect(result.keywords).toContain('urgent');
    });

    it('should categorize clinical messages correctly', () => {
      const result = CareTeamChatSummarizerService.categorizeMessage('Patient vitals: BP 120/80');
      expect(result.category).toBe('clinical');
      expect(result.keywords).toContain('vitals');
    });

    it('should categorize questions correctly', () => {
      const result = CareTeamChatSummarizerService.categorizeMessage('Has anyone seen the lab results?');
      expect(result.category).toBe('question');
    });

    it('should categorize administrative messages correctly', () => {
      const result = CareTeamChatSummarizerService.categorizeMessage('Meeting at 3pm about shift schedule');
      expect(result.category).toBe('administrative');
    });

    it('should default to social for unclassified messages', () => {
      const result = CareTeamChatSummarizerService.categorizeMessage('Good morning everyone!');
      expect(result.category).toBe('social');
    });
  });

  describe('generateShiftHandoff', () => {
    it('should generate shift handoff summary', async () => {
      const mockResponse = createMockChatResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const messages = [createMockMessage()];
      const result = await CareTeamChatSummarizerService.generateShiftHandoff(
        messages,
        '2025-01-01T08:00:00Z',
        '2025-01-01T16:00:00Z',
        'tenant-123'
      );

      expect(result.success).toBe(true);
    });
  });
});
