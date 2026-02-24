/**
 * Nurse Question Service
 *
 * Purpose: Backend operations for the Nurse Question Manager.
 * Handles queue management, question claiming, answering, notes, and escalation.
 *
 * Data source: user_questions, nurse_question_answers, nurse_question_notes tables
 * RPC functions: nurse_open_queue, nurse_claim_question, nurse_my_questions,
 *                nurse_submit_answer, nurse_add_note, nurse_escalate_question
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// ============================================================================
// Types
// ============================================================================

export interface QueueQuestion {
  question_id: string;
  user_id: string;
  question_text: string;
  category: string;
  urgency: string;
  status: string;
  created_at: string;
  patient_name: string;
  patient_phone: string;
}

export interface MyQuestion extends QueueQuestion {
  claimed_at: string | null;
  answer_count: number;
}

export interface QuestionNote {
  id: string;
  question_id: string;
  nurse_id: string;
  note_text: string;
  created_at: string;
}

export interface QuestionAnswer {
  id: string;
  question_id: string;
  nurse_id: string;
  answer_text: string;
  used_ai_suggestion: boolean;
  ai_suggestion_text: string | null;
  ai_confidence: number | null;
  created_at: string;
}

export interface SubmitAnswerParams {
  questionId: string;
  answerText: string;
  usedAiSuggestion?: boolean;
  aiSuggestionText?: string;
  aiConfidence?: number;
}

export type EscalationLevel = 'charge_nurse' | 'supervisor' | 'physician';

// ============================================================================
// Service
// ============================================================================

export const NurseQuestionService = {
  /**
   * Get unclaimed questions in the nurse's tenant (open queue)
   */
  async fetchOpenQueue(): Promise<ServiceResult<QueueQuestion[]>> {
    try {
      const { data, error } = await supabase.rpc('nurse_open_queue');

      if (error) {
        await auditLogger.error(
          'NURSE_QUEUE_FETCH_FAILED',
          new Error(error.message),
          { code: error.code }
        );
        return failure('DATABASE_ERROR', error.message);
      }

      return success((data || []) as QueueQuestion[]);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSE_QUEUE_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err))
      );
      return failure('UNKNOWN_ERROR', 'Failed to fetch open queue');
    }
  },

  /**
   * Claim a question — assigns it to the calling nurse
   */
  async claimQuestion(questionId: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc('nurse_claim_question', {
        p_question_id: questionId,
      });

      if (error) {
        await auditLogger.error(
          'NURSE_CLAIM_FAILED',
          new Error(error.message),
          { questionId }
        );
        return failure('OPERATION_FAILED', error.message);
      }

      await auditLogger.clinical('NURSE_QUESTION_CLAIMED', true, { questionId });
      return success(undefined);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSE_CLAIM_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { questionId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to claim question');
    }
  },

  /**
   * Get questions assigned to the calling nurse
   */
  async fetchMyQuestions(): Promise<ServiceResult<MyQuestion[]>> {
    try {
      const { data, error } = await supabase.rpc('nurse_my_questions');

      if (error) {
        await auditLogger.error(
          'NURSE_MY_QUESTIONS_FAILED',
          new Error(error.message)
        );
        return failure('DATABASE_ERROR', error.message);
      }

      return success((data || []) as MyQuestion[]);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSE_MY_QUESTIONS_FAILED',
        err instanceof Error ? err : new Error(String(err))
      );
      return failure('UNKNOWN_ERROR', 'Failed to fetch my questions');
    }
  },

  /**
   * Submit an answer to a claimed question
   */
  async submitAnswer(params: SubmitAnswerParams): Promise<ServiceResult<string>> {
    try {
      const { data, error } = await supabase.rpc('nurse_submit_answer', {
        p_question_id: params.questionId,
        p_answer_text: params.answerText,
        p_used_ai_suggestion: params.usedAiSuggestion ?? false,
        p_ai_suggestion_text: params.aiSuggestionText ?? null,
        p_ai_confidence: params.aiConfidence ?? null,
      });

      if (error) {
        await auditLogger.error(
          'NURSE_ANSWER_FAILED',
          new Error(error.message),
          { questionId: params.questionId }
        );
        return failure('OPERATION_FAILED', error.message);
      }

      await auditLogger.clinical('NURSE_QUESTION_ANSWERED', true, {
        questionId: params.questionId,
        usedAi: params.usedAiSuggestion ?? false,
      });

      return success(data as string);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSE_ANSWER_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { questionId: params.questionId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to submit answer');
    }
  },

  /**
   * Add an internal nurse note to a question (not visible to patient)
   */
  async addNote(questionId: string, noteText: string): Promise<ServiceResult<string>> {
    try {
      const { data, error } = await supabase.rpc('nurse_add_note', {
        p_question_id: questionId,
        p_note_text: noteText,
      });

      if (error) {
        await auditLogger.error(
          'NURSE_NOTE_FAILED',
          new Error(error.message),
          { questionId }
        );
        return failure('OPERATION_FAILED', error.message);
      }

      await auditLogger.info('NURSE_NOTE_ADDED', { questionId });
      return success(data as string);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSE_NOTE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { questionId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to add note');
    }
  },

  /**
   * Escalate a question to a higher authority
   */
  async escalateQuestion(
    questionId: string,
    level: EscalationLevel,
    reason?: string
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc('nurse_escalate_question', {
        p_question_id: questionId,
        p_escalation_level: level,
        p_reason: reason ?? null,
      });

      if (error) {
        await auditLogger.error(
          'NURSE_ESCALATION_FAILED',
          new Error(error.message),
          { questionId, level }
        );
        return failure('OPERATION_FAILED', error.message);
      }

      await auditLogger.warn('NURSE_QUESTION_ESCALATED', {
        questionId, level, reason,
      });
      return success(undefined);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSE_ESCALATION_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { questionId, level }
      );
      return failure('UNKNOWN_ERROR', 'Failed to escalate question');
    }
  },

  /**
   * Get notes for a question
   */
  async getQuestionNotes(questionId: string): Promise<ServiceResult<QuestionNote[]>> {
    try {
      const { data, error } = await supabase
        .from('nurse_question_notes')
        .select('id, question_id, nurse_id, note_text, created_at')
        .eq('question_id', questionId)
        .order('created_at', { ascending: true });

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      return success((data || []) as QuestionNote[]);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSE_NOTES_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { questionId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to fetch notes');
    }
  },

  /**
   * Get answers for a question
   */
  async getQuestionAnswers(questionId: string): Promise<ServiceResult<QuestionAnswer[]>> {
    try {
      const { data, error } = await supabase
        .from('nurse_question_answers')
        .select('id, question_id, nurse_id, answer_text, used_ai_suggestion, ai_suggestion_text, ai_confidence, created_at')
        .eq('question_id', questionId)
        .order('created_at', { ascending: true });

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      return success((data || []) as QuestionAnswer[]);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSE_ANSWERS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { questionId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to fetch answers');
    }
  },
};
