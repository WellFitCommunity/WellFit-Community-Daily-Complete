// services/engagementTracking.ts
// Purpose: Track all senior engagement activities for admin visibility and risk assessment

import { SupabaseClient } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/getErrorMessage';

export interface TriviaGameResult {
  user_id: string;
  game_date?: string;
  started_at?: string;
  completed_at?: string;
  completion_time_seconds?: number;
  score: number;
  total_questions: number;
  difficulty_breakdown?: Record<string, number>;
  questions_attempted?: string[];
  average_response_time_seconds?: number;
  completion_status?: 'completed' | 'abandoned' | 'incomplete';
}

export interface WordGameResult {
  user_id: string;
  game_date?: string;
  started_at?: string;
  completed_at?: string;
  completion_time_seconds?: number;
  words_found: number;
  total_words: number;
  hints_used?: number;
  difficulty_level?: string;
  completion_status?: 'completed' | 'abandoned' | 'incomplete';
  puzzle_id?: string;
}

export interface UserQuestion {
  user_id: string;
  question_text: string;
  category?: 'general' | 'health' | 'technical' | 'account' | 'emergency';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface SelfReportSubmission {
  user_id: string;
  submission_date?: string;
  report_data: Record<string, unknown>;
  completion_percentage?: number;
  time_spent_seconds?: number;
}

export interface QuestionResponse {
  question_id: string;
  response_text: string;
  responded_by: string;
}

type DbRow = Record<string, unknown>;
type DbResult<T> = { data: T | null; error: Error | null };
type DbListResult<T> = { data: T[]; error: Error | null };

/**
 * A user question row as returned by loadUserQuestions.
 * Minimum-necessary column set for question/answer display — intentionally
 * excludes nurse-queue internals (nurse_notes, ai_suggestions, ai_urgency_score,
 * patient_context, assignment/escalation fields), which nurse workflows query directly.
 */
export interface UserQuestionRow {
  id: string;
  user_id: string;
  question_text: string;
  category: string | null;
  priority: string | null;
  urgency: string | null;
  status: string | null;
  response_text: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
}

/**
 * A patient engagement score row (patient_engagement_scores materialized view).
 * Column set live-verified 2026-07-23; matches what PatientEngagementDashboard renders.
 */
export interface PatientEngagementScoreRow {
  user_id: string;
  email: string;
  check_ins_30d: number;
  trivia_games_30d: number;
  word_games_30d: number;
  self_reports_30d: number;
  questions_asked_30d: number;
  check_ins_7d: number;
  trivia_games_7d: number;
  last_check_in: string | null;
  last_trivia_game: string | null;
  last_word_game: string | null;
  last_self_report: string | null;
  avg_trivia_score_pct: number | null;
  avg_trivia_completion_time: number | null;
  avg_mood_score_30d: number | null;
  latest_mood: string | null;
  negative_moods_30d: number;
  symptom_reports_30d: number;
  engagement_score: number;
}

const ENGAGEMENT_SCORE_COLUMNS =
  'user_id, email, check_ins_30d, trivia_games_30d, word_games_30d, self_reports_30d, ' +
  'questions_asked_30d, check_ins_7d, trivia_games_7d, last_check_in, last_trivia_game, ' +
  'last_word_game, last_self_report, avg_trivia_score_pct, avg_trivia_completion_time, ' +
  'avg_mood_score_30d, latest_mood, negative_moods_30d, symptom_reports_30d, engagement_score';

/**
 * Save trivia game results to database
 */
export async function saveTriviaGameResult(
  supabase: SupabaseClient,
  result: TriviaGameResult
): Promise<DbResult<DbRow>> {
  try {
    const { data, error } = await supabase
      .from('trivia_game_results')
      .insert({
        user_id: result.user_id,
        game_date: result.game_date || new Date().toISOString().split('T')[0],
        started_at: result.started_at || new Date().toISOString(),
        completed_at: result.completed_at,
        completion_time_seconds: result.completion_time_seconds,
        score: result.score,
        total_questions: result.total_questions,
        difficulty_breakdown: result.difficulty_breakdown || {},
        questions_attempted: result.questions_attempted || [],
        average_response_time_seconds: result.average_response_time_seconds,
        completion_status: result.completion_status || 'completed'
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as DbRow) ?? null, error: null };
  } catch (err: unknown) {
    return { data: null, error: new Error(getErrorMessage(err)) };
  }
}

/**
 * Save word game results to database
 */
export async function saveWordGameResult(
  supabase: SupabaseClient,
  result: WordGameResult
): Promise<DbResult<DbRow>> {
  try {
    const { data, error } = await supabase
      .from('word_game_results')
      .insert({
        user_id: result.user_id,
        game_date: result.game_date || new Date().toISOString().split('T')[0],
        started_at: result.started_at || new Date().toISOString(),
        completed_at: result.completed_at,
        completion_time_seconds: result.completion_time_seconds,
        words_found: result.words_found,
        total_words: result.total_words,
        hints_used: result.hints_used || 0,
        difficulty_level: result.difficulty_level,
        completion_status: result.completion_status || 'completed',
        puzzle_id: result.puzzle_id
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as DbRow) ?? null, error: null };
  } catch (err: unknown) {
    return { data: null, error: new Error(getErrorMessage(err)) };
  }
}

/**
 * Submit a user question
 */
export async function submitUserQuestion(
  supabase: SupabaseClient,
  question: UserQuestion
): Promise<DbResult<DbRow>> {
  try {
    const { data, error } = await supabase
      .from('user_questions')
      .insert({
        user_id: question.user_id,
        question_text: question.question_text,
        category: question.category || 'general',
        priority: question.priority || 'normal',
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as DbRow) ?? null, error: null };
  } catch (err: unknown) {
    return { data: null, error: new Error(getErrorMessage(err)) };
  }
}

/**
 * Respond to a user question (admin/nurse only)
 */
export async function respondToUserQuestion(
  supabase: SupabaseClient,
  response: QuestionResponse
): Promise<DbResult<DbRow>> {
  try {
    const { data, error } = await supabase
      .from('user_questions')
      .update({
        response_text: response.response_text,
        responded_by: response.responded_by,
        responded_at: new Date().toISOString(),
        status: 'answered'
      })
      .eq('id', response.question_id)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as DbRow) ?? null, error: null };
  } catch (err: unknown) {
    return { data: null, error: new Error(getErrorMessage(err)) };
  }
}

/**
 * Load user questions (for both users and admins)
 */
export async function loadUserQuestions(
  supabase: SupabaseClient,
  userId?: string,
  isAdmin: boolean = false
): Promise<DbListResult<UserQuestionRow>> {
  try {
    let query = supabase
      .from('user_questions')
      .select(`
        id, user_id, question_text, category, priority, urgency, status,
        response_text, responded_by, responded_at, created_at, updated_at,
        profiles:user_id (
          first_name,
          last_name,
          phone
        )
      `)
      .order('created_at', { ascending: false });

    // If not admin, filter by user_id
    if (!isAdmin && userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error: new Error(error.message) };
    }

    return { data: (data as unknown as UserQuestionRow[]) || [], error: null };
  } catch (err: unknown) {
    return { data: [], error: new Error(getErrorMessage(err)) };
  }
}

/**
 * Save self-report submission
 */
export async function saveSelfReportSubmission(
  supabase: SupabaseClient,
  submission: SelfReportSubmission
): Promise<DbResult<DbRow>> {
  try {
    const { data, error } = await supabase
      .from('self_report_submissions')
      .insert({
        user_id: submission.user_id,
        submission_date: submission.submission_date || new Date().toISOString().split('T')[0],
        submitted_at: new Date().toISOString(),
        report_data: submission.report_data,
        completion_percentage: submission.completion_percentage,
        time_spent_seconds: submission.time_spent_seconds
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as DbRow) ?? null, error: null };
  } catch (err: unknown) {
    return { data: null, error: new Error(getErrorMessage(err)) };
  }
}

/**
 * Get patient engagement score
 */
export async function getPatientEngagementScore(
  supabase: SupabaseClient,
  userId: string
): Promise<DbResult<PatientEngagementScoreRow>> {
  try {
    const { data, error } = await supabase
      .from('patient_engagement_scores')
      .select(ENGAGEMENT_SCORE_COLUMNS)
      .eq('user_id', userId)
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as unknown as PatientEngagementScoreRow) ?? null, error: null };
  } catch (err: unknown) {
    return { data: null, error: new Error(getErrorMessage(err)) };
  }
}

/**
 * Get all patient engagement scores (admin only)
 */
export async function getAllPatientEngagementScores(
  supabase: SupabaseClient
): Promise<DbListResult<PatientEngagementScoreRow>> {
  try {
    const { data, error } = await supabase
      .from('patient_engagement_scores')
      .select(ENGAGEMENT_SCORE_COLUMNS)
      .order('engagement_score', { ascending: false });

    if (error) {
      return { data: [], error: new Error(error.message) };
    }

    return { data: (data as unknown as PatientEngagementScoreRow[]) || [], error: null };
  } catch (err: unknown) {
    return { data: [], error: new Error(getErrorMessage(err)) };
  }
}
