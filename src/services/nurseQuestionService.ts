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

  /**
   * Get aggregated analytics metrics for the current tenant
   */
  async fetchMetrics(): Promise<ServiceResult<NurseQuestionMetrics>> {
    try {
      const { data, error } = await supabase.rpc('nurse_question_metrics');

      if (error) {
        await auditLogger.error(
          'NURSE_METRICS_FETCH_FAILED',
          new Error(error.message)
        );
        return failure('DATABASE_ERROR', error.message);
      }

      return success(data as NurseQuestionMetrics);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSE_METRICS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err))
      );
      return failure('UNKNOWN_ERROR', 'Failed to fetch metrics');
    }
  },

  /**
   * Notify patient that their question has been answered (SMS via edge function)
   */
  async notifyPatientAnswered(
    questionId: string,
    patientPhone: string,
    patientFirstName: string
  ): Promise<ServiceResult<void>> {
    try {
      if (!patientPhone) {
        return failure('VALIDATION_ERROR', 'No patient phone number available');
      }

      // Normalize phone to E.164 if not already
      const phone = patientPhone.startsWith('+') ? patientPhone : `+1${patientPhone.replace(/\D/g, '')}`;
      if (phone.length < 11) {
        return failure('VALIDATION_ERROR', 'Invalid phone number');
      }

      const message = `Hi ${patientFirstName || 'there'}, your care team has responded to your health question. Log in to WellFit to view the answer.`;

      const { error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: [phone],
          message,
          priority: 'normal' as const,
        },
      });

      if (error) {
        await auditLogger.error(
          'NURSE_PATIENT_SMS_FAILED',
          new Error(error.message),
          { questionId, phone: phone.slice(0, 6) + '****' }
        );
        return failure('EXTERNAL_SERVICE_ERROR', error.message);
      }

      await auditLogger.info('NURSE_PATIENT_ANSWER_NOTIFIED', {
        questionId,
        channel: 'sms',
      });
      return success(undefined);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSE_PATIENT_SMS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { questionId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to notify patient');
    }
  },

  /**
   * Subscribe to new questions in realtime (INSERT events on user_questions)
   * Returns cleanup function.
   */
  subscribeToNewQuestions(
    onNewQuestion: (question: RealtimeQuestionPayload) => void
  ): () => void {
    const channel = supabase
      .channel('nurse-question-inserts')
      .on(
        'postgres_changes' as const,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_questions',
        },
        (payload) => {
          const row = payload.new as unknown as RealtimeQuestionPayload;
          onNewQuestion(row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Subscribe to question status changes (UPDATE events)
   * Used for detecting auto-escalations and answers.
   */
  subscribeToQuestionUpdates(
    onUpdate: (question: RealtimeQuestionPayload) => void
  ): () => void {
    const channel = supabase
      .channel('nurse-question-updates')
      .on(
        'postgres_changes' as const,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_questions',
        },
        (payload) => {
          const row = payload.new as unknown as RealtimeQuestionPayload;
          onUpdate(row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};

/** Nurse question analytics metrics from nurse_question_metrics() RPC */
export interface NurseQuestionMetrics {
  total_questions: number;
  pending_count: number;
  claimed_count: number;
  answered_count: number;
  escalated_count: number;
  high_urgency_count: number;
  medium_urgency_count: number;
  low_urgency_count: number;
  avg_response_hours: number;
  median_response_hours: number;
  ai_acceptance_rate: number;
  ai_suggestions_accepted: number;
  total_answered_with_records: number;
  escalated_to_charge_nurse: number;
  escalated_to_supervisor: number;
  escalated_to_physician: number;
  questions_last_24h: number;
  questions_last_7d: number;
}

/** Payload shape from Supabase realtime for user_questions table */
export interface RealtimeQuestionPayload {
  id: string;
  user_id: string;
  question_text: string;
  category: string | null;
  urgency: string | null;
  status: string;
  assigned_nurse_id: string | null;
  tenant_id: string | null;
  created_at: string;
  claimed_at: string | null;
  escalation_level: string | null;
}
