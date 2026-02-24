/**
 * NurseQuestionService Tests
 *
 * Purpose: Queue management for nurse question workflow — fetch, claim, answer, note, escalate
 * Tests: Open queue fetch, claim question, my questions, submit answer, add note,
 *        escalate question, get notes, get answers, error handling
 *
 * Deletion Test: Every test verifies specific ServiceResult behavior unique to NurseQuestionService.
 * An empty object would fail all tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock functions
const { mockRpc, mockFrom, mockAuditLogger } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockAuditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    clinical: vi.fn(),
    auth: vi.fn(),
  },
}));

// Mock Supabase
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

// Mock audit logger
vi.mock('../auditLogger', () => ({
  auditLogger: mockAuditLogger,
}));

import { NurseQuestionService } from '../nurseQuestionService';

describe('NurseQuestionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // fetchOpenQueue
  // ============================================================================

  describe('fetchOpenQueue', () => {
    it('returns queue questions on successful RPC call', async () => {
      const mockData = [
        {
          question_id: 'q-001',
          user_id: 'user-001',
          question_text: 'Test question alpha',
          category: 'health',
          urgency: 'high',
          status: 'pending',
          created_at: '2026-02-24T10:00:00Z',
          patient_name: 'Test Patient Alpha',
          patient_phone: '555-0100',
        },
      ];
      mockRpc.mockResolvedValue({ data: mockData, error: null });

      const result = await NurseQuestionService.fetchOpenQueue();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].question_id).toBe('q-001');
        expect(result.data[0].patient_name).toBe('Test Patient Alpha');
      }
      expect(mockRpc).toHaveBeenCalledWith('nurse_open_queue');
    });

    it('returns failure on RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'DB connection failed', code: '08006' },
      });

      const result = await NurseQuestionService.fetchOpenQueue();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
      expect(mockAuditLogger.error).toHaveBeenCalledWith(
        'NURSE_QUEUE_FETCH_FAILED',
        expect.any(Error),
        expect.objectContaining({ code: '08006' })
      );
    });

    it('returns empty array when no questions in queue', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const result = await NurseQuestionService.fetchOpenQueue();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });
  });

  // ============================================================================
  // claimQuestion
  // ============================================================================

  describe('claimQuestion', () => {
    it('claims a question successfully and logs audit event', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await NurseQuestionService.claimQuestion('q-001');

      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('nurse_claim_question', {
        p_question_id: 'q-001',
      });
      expect(mockAuditLogger.clinical).toHaveBeenCalledWith(
        'NURSE_QUESTION_CLAIMED',
        true,
        { questionId: 'q-001' }
      );
    });

    it('returns failure when question is already claimed', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Question not available for claiming' },
      });

      const result = await NurseQuestionService.claimQuestion('q-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OPERATION_FAILED');
        expect(result.error.message).toContain('not available');
      }
    });
  });

  // ============================================================================
  // fetchMyQuestions
  // ============================================================================

  describe('fetchMyQuestions', () => {
    it('returns assigned questions with answer counts', async () => {
      const mockData = [
        {
          question_id: 'q-002',
          user_id: 'user-002',
          question_text: 'Medication question',
          category: 'medication',
          urgency: 'medium',
          status: 'claimed',
          created_at: '2026-02-24T09:00:00Z',
          claimed_at: '2026-02-24T09:15:00Z',
          patient_name: 'Test Patient Bravo',
          patient_phone: '555-0200',
          answer_count: 0,
        },
      ];
      mockRpc.mockResolvedValue({ data: mockData, error: null });

      const result = await NurseQuestionService.fetchMyQuestions();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].status).toBe('claimed');
        expect(result.data[0].answer_count).toBe(0);
      }
      expect(mockRpc).toHaveBeenCalledWith('nurse_my_questions');
    });
  });

  // ============================================================================
  // submitAnswer
  // ============================================================================

  describe('submitAnswer', () => {
    it('submits answer and logs clinical audit event', async () => {
      mockRpc.mockResolvedValue({ data: 'answer-uuid-001', error: null });

      const result = await NurseQuestionService.submitAnswer({
        questionId: 'q-001',
        answerText: 'Take your medication with food.',
        usedAiSuggestion: true,
        aiSuggestionText: 'AI suggested: Take with food',
        aiConfidence: 0.92,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('answer-uuid-001');
      }
      expect(mockRpc).toHaveBeenCalledWith('nurse_submit_answer', {
        p_question_id: 'q-001',
        p_answer_text: 'Take your medication with food.',
        p_used_ai_suggestion: true,
        p_ai_suggestion_text: 'AI suggested: Take with food',
        p_ai_confidence: 0.92,
      });
      expect(mockAuditLogger.clinical).toHaveBeenCalledWith(
        'NURSE_QUESTION_ANSWERED',
        true,
        { questionId: 'q-001', usedAi: true }
      );
    });

    it('defaults usedAiSuggestion to false when not provided', async () => {
      mockRpc.mockResolvedValue({ data: 'answer-uuid-002', error: null });

      await NurseQuestionService.submitAnswer({
        questionId: 'q-002',
        answerText: 'Rest and hydrate.',
      });

      expect(mockRpc).toHaveBeenCalledWith('nurse_submit_answer', {
        p_question_id: 'q-002',
        p_answer_text: 'Rest and hydrate.',
        p_used_ai_suggestion: false,
        p_ai_suggestion_text: null,
        p_ai_confidence: null,
      });
    });

    it('returns failure when question not assigned to nurse', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Question not found or not assigned to you' },
      });

      const result = await NurseQuestionService.submitAnswer({
        questionId: 'q-999',
        answerText: 'test',
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // addNote
  // ============================================================================

  describe('addNote', () => {
    it('adds a nurse note and logs info event', async () => {
      mockRpc.mockResolvedValue({ data: 'note-uuid-001', error: null });

      const result = await NurseQuestionService.addNote('q-001', 'Patient seemed confused about dosage');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('note-uuid-001');
      }
      expect(mockRpc).toHaveBeenCalledWith('nurse_add_note', {
        p_question_id: 'q-001',
        p_note_text: 'Patient seemed confused about dosage',
      });
      expect(mockAuditLogger.info).toHaveBeenCalledWith(
        'NURSE_NOTE_ADDED',
        { questionId: 'q-001' }
      );
    });
  });

  // ============================================================================
  // escalateQuestion
  // ============================================================================

  describe('escalateQuestion', () => {
    it('escalates to charge nurse and logs warn-level audit', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await NurseQuestionService.escalateQuestion(
        'q-001',
        'charge_nurse',
        'Patient reports worsening symptoms'
      );

      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('nurse_escalate_question', {
        p_question_id: 'q-001',
        p_escalation_level: 'charge_nurse',
        p_reason: 'Patient reports worsening symptoms',
      });
      expect(mockAuditLogger.warn).toHaveBeenCalledWith(
        'NURSE_QUESTION_ESCALATED',
        expect.objectContaining({
          questionId: 'q-001',
          level: 'charge_nurse',
          reason: 'Patient reports worsening symptoms',
        })
      );
    });

    it('escalates to physician without reason', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await NurseQuestionService.escalateQuestion('q-002', 'physician');

      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('nurse_escalate_question', {
        p_question_id: 'q-002',
        p_escalation_level: 'physician',
        p_reason: null,
      });
    });
  });

  // ============================================================================
  // getQuestionNotes
  // ============================================================================

  describe('getQuestionNotes', () => {
    it('fetches notes for a question ordered by created_at', async () => {
      const mockNotes = [
        { id: 'n-1', question_id: 'q-001', nurse_id: 'nurse-1', note_text: 'First note', created_at: '2026-02-24T10:00:00Z' },
        { id: 'n-2', question_id: 'q-001', nurse_id: 'nurse-1', note_text: 'Second note', created_at: '2026-02-24T10:30:00Z' },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockNotes, error: null }),
      };
      mockFrom.mockReturnValue(mockChain);

      const result = await NurseQuestionService.getQuestionNotes('q-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].note_text).toBe('First note');
      }
      expect(mockFrom).toHaveBeenCalledWith('nurse_question_notes');
    });
  });

  // ============================================================================
  // getQuestionAnswers
  // ============================================================================

  describe('getQuestionAnswers', () => {
    it('fetches answers for a question with AI tracking fields', async () => {
      const mockAnswers = [
        {
          id: 'a-1',
          question_id: 'q-001',
          nurse_id: 'nurse-1',
          answer_text: 'Take medication with food.',
          used_ai_suggestion: true,
          ai_suggestion_text: 'AI: Take with food',
          ai_confidence: 0.85,
          created_at: '2026-02-24T11:00:00Z',
        },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockAnswers, error: null }),
      };
      mockFrom.mockReturnValue(mockChain);

      const result = await NurseQuestionService.getQuestionAnswers('q-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].used_ai_suggestion).toBe(true);
        expect(result.data[0].ai_confidence).toBe(0.85);
      }
      expect(mockFrom).toHaveBeenCalledWith('nurse_question_answers');
    });
  });

  // ============================================================================
  // Error handling
  // ============================================================================

  describe('error handling', () => {
    it('handles thrown exceptions in fetchOpenQueue', async () => {
      mockRpc.mockRejectedValue(new Error('Network timeout'));

      const result = await NurseQuestionService.fetchOpenQueue();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNKNOWN_ERROR');
      }
      expect(mockAuditLogger.error).toHaveBeenCalled();
    });

    it('handles thrown exceptions in claimQuestion', async () => {
      mockRpc.mockRejectedValue(new Error('Connection lost'));

      const result = await NurseQuestionService.claimQuestion('q-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Failed to claim question');
      }
    });

    it('handles thrown exceptions in submitAnswer', async () => {
      mockRpc.mockRejectedValue(new Error('Timeout'));

      const result = await NurseQuestionService.submitAnswer({
        questionId: 'q-001',
        answerText: 'test',
      });

      expect(result.success).toBe(false);
    });
  });
});
