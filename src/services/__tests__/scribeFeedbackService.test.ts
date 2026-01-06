/**
 * Scribe Feedback Service Tests
 *
 * Tests for transcription quality feedback:
 * - Feedback submission
 * - Provider statistics retrieval
 * - Voice training suggestions
 * - Recent feedback queries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  submitScribeFeedback,
  getProviderFeedbackStats,
  shouldSuggestVoiceTraining,
  getRecentFeedback,
} from '../scribeFeedbackService';

// Mock Supabase client
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      select: mockSelect,
    })),
  },
}));

// Mock audit logger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('scribeFeedbackService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default chain setup
    mockInsert.mockReturnValue({ error: null });
    mockSelect.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
      limit: mockLimit,
      data: [],
      error: null,
    });
    mockOrder.mockReturnValue({
      limit: mockLimit,
      data: [],
      error: null,
    });
    mockLimit.mockReturnValue({
      data: [],
      error: null,
    });
  });

  describe('submitScribeFeedback', () => {
    it('should submit positive feedback successfully', async () => {
      mockInsert.mockReturnValue({ error: null });

      const result = await submitScribeFeedback({
        providerId: 'provider-123',
        rating: 'positive',
        scribeMode: 'smartscribe',
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should submit negative feedback with issues', async () => {
      mockInsert.mockReturnValue({ error: null });

      const result = await submitScribeFeedback({
        providerId: 'provider-123',
        rating: 'negative',
        issues: ['missed_words', 'accent_issues'],
        scribeMode: 'compass-riley',
      });

      expect(result.success).toBe(true);
    });

    it('should include optional session data', async () => {
      mockInsert.mockReturnValue({ error: null });

      await submitScribeFeedback({
        sessionId: 'session-456',
        providerId: 'provider-123',
        rating: 'positive',
        scribeMode: 'smartscribe',
        sessionDurationSeconds: 300,
        comment: 'Great transcription!',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'session-456',
          session_duration_seconds: 300,
          comment: 'Great transcription!',
        })
      );
    });

    it('should return error on database failure', async () => {
      mockInsert.mockReturnValue({ error: { message: 'Database error' } });

      const result = await submitScribeFeedback({
        providerId: 'provider-123',
        rating: 'positive',
        scribeMode: 'smartscribe',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('getProviderFeedbackStats', () => {
    it('should calculate correct statistics', async () => {
      mockEq.mockReturnValue({
        data: [
          { rating: 'positive', issues: null },
          { rating: 'positive', issues: null },
          { rating: 'negative', issues: ['missed_words'] },
          { rating: 'positive', issues: null },
          { rating: 'negative', issues: ['missed_words', 'accent_issues'] },
        ],
        error: null,
      });

      const stats = await getProviderFeedbackStats('provider-123');

      expect(stats).not.toBeNull();
      expect(stats?.totalSessions).toBe(5);
      expect(stats?.positiveCount).toBe(3);
      expect(stats?.negativeCount).toBe(2);
      expect(stats?.positiveRate).toBe(0.6);
    });

    it('should count common issues correctly', async () => {
      mockEq.mockReturnValue({
        data: [
          { rating: 'negative', issues: ['missed_words'] },
          { rating: 'negative', issues: ['missed_words', 'accent_issues'] },
          { rating: 'negative', issues: ['accent_issues'] },
        ],
        error: null,
      });

      const stats = await getProviderFeedbackStats('provider-123');

      expect(stats?.commonIssues).toHaveLength(2);
      expect(stats?.commonIssues[0]).toEqual({ issue: 'missed_words', count: 2 });
      expect(stats?.commonIssues[1]).toEqual({ issue: 'accent_issues', count: 2 });
    });

    it('should return null on error', async () => {
      mockEq.mockReturnValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const stats = await getProviderFeedbackStats('provider-123');

      expect(stats).toBeNull();
    });

    it('should handle empty results', async () => {
      mockEq.mockReturnValue({
        data: [],
        error: null,
      });

      const stats = await getProviderFeedbackStats('provider-123');

      expect(stats?.totalSessions).toBe(0);
      expect(stats?.positiveRate).toBe(0);
    });
  });

  describe('shouldSuggestVoiceTraining', () => {
    it('should return true when 3+ negatives in last 10 sessions', async () => {
      mockLimit.mockReturnValue({
        data: [
          { rating: 'negative' },
          { rating: 'positive' },
          { rating: 'negative' },
          { rating: 'positive' },
          { rating: 'negative' },
          { rating: 'positive' },
        ],
        error: null,
      });

      const shouldSuggest = await shouldSuggestVoiceTraining('provider-123');

      expect(shouldSuggest).toBe(true);
    });

    it('should return false when fewer than 3 negatives', async () => {
      mockLimit.mockReturnValue({
        data: [
          { rating: 'positive' },
          { rating: 'positive' },
          { rating: 'negative' },
          { rating: 'positive' },
          { rating: 'negative' },
        ],
        error: null,
      });

      const shouldSuggest = await shouldSuggestVoiceTraining('provider-123');

      expect(shouldSuggest).toBe(false);
    });

    it('should return false on error', async () => {
      mockLimit.mockReturnValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const shouldSuggest = await shouldSuggestVoiceTraining('provider-123');

      expect(shouldSuggest).toBe(false);
    });
  });

  describe('getRecentFeedback', () => {
    it('should return recent feedback records', async () => {
      const mockRecords = [
        { id: '1', rating: 'positive', provider_id: 'p1', created_at: '2026-01-06' },
        { id: '2', rating: 'negative', provider_id: 'p2', created_at: '2026-01-05' },
      ];

      mockLimit.mockReturnValue({
        data: mockRecords,
        error: null,
      });

      const feedback = await getRecentFeedback(50);

      expect(feedback).toHaveLength(2);
      expect(feedback[0].id).toBe('1');
    });

    it('should return empty array on error', async () => {
      mockLimit.mockReturnValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const feedback = await getRecentFeedback();

      expect(feedback).toEqual([]);
    });

    it('should use default limit of 50', async () => {
      mockLimit.mockReturnValue({ data: [], error: null });

      await getRecentFeedback();

      expect(mockLimit).toHaveBeenCalledWith(50);
    });
  });
});
