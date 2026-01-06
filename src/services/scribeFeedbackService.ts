/**
 * Scribe Feedback Service
 *
 * Purpose: Store and retrieve session feedback ratings for transcription quality
 * Used by: RealTimeSmartScribe SessionFeedback component
 *
 * Tracks:
 * - Thumbs up/down ratings per session
 * - Issue categories when negative
 * - Quality metrics over time per provider
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';

export type FeedbackRating = 'positive' | 'negative';

export type FeedbackIssue =
  | 'missed_words'
  | 'wrong_medical_terms'
  | 'accent_issues'
  | 'background_noise'
  | 'other';

export interface ScribeFeedback {
  sessionId?: string;
  providerId: string;
  rating: FeedbackRating;
  issues?: FeedbackIssue[];
  comment?: string;
  scribeMode: 'smartscribe' | 'compass-riley';
  sessionDurationSeconds?: number;
}

// Alias for component-side usage
export interface SessionFeedbackData {
  rating: 'positive' | 'negative' | null;
  issues?: FeedbackIssue[];
  comment?: string;
}

export interface FeedbackStats {
  totalSessions: number;
  positiveCount: number;
  negativeCount: number;
  positiveRate: number;
  commonIssues: { issue: FeedbackIssue; count: number }[];
}

interface FeedbackRecord {
  id: string;
  provider_id: string;
  session_id: string | null;
  rating: string;
  issues: string[] | null;
  comment: string | null;
  scribe_mode: string;
  session_duration_seconds: number | null;
  created_at: string;
}

/**
 * Submit feedback for a scribe session
 */
export async function submitScribeFeedback(
  feedback: ScribeFeedback
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('scribe_session_feedback')
      .insert({
        provider_id: feedback.providerId,
        session_id: feedback.sessionId || null,
        rating: feedback.rating,
        issues: feedback.issues || null,
        comment: feedback.comment || null,
        scribe_mode: feedback.scribeMode,
        session_duration_seconds: feedback.sessionDurationSeconds || null,
      });

    if (error) {
      auditLogger.error('SCRIBE_FEEDBACK_SUBMIT_FAILED', error, {
        providerId: feedback.providerId,
        rating: feedback.rating,
      });
      return { success: false, error: error.message };
    }

    auditLogger.info('SCRIBE_FEEDBACK_SUBMITTED', {
      providerId: feedback.providerId,
      rating: feedback.rating,
      scribeMode: feedback.scribeMode,
      issueCount: feedback.issues?.length || 0,
    });

    return { success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    auditLogger.error(
      'SCRIBE_FEEDBACK_SUBMIT_EXCEPTION',
      err instanceof Error ? err : new Error(String(err)),
      { providerId: feedback.providerId }
    );
    return { success: false, error: errorMessage };
  }
}

/**
 * Get feedback statistics for a provider
 */
export async function getProviderFeedbackStats(
  providerId: string
): Promise<FeedbackStats | null> {
  try {
    const { data, error } = await supabase
      .from('scribe_session_feedback')
      .select('rating, issues')
      .eq('provider_id', providerId);

    if (error) {
      auditLogger.error('SCRIBE_FEEDBACK_STATS_FAILED', error, { providerId });
      return null;
    }

    const records = (data || []) as Pick<FeedbackRecord, 'rating' | 'issues'>[];
    const totalSessions = records.length;
    const positiveCount = records.filter(r => r.rating === 'positive').length;
    const negativeCount = records.filter(r => r.rating === 'negative').length;

    // Count issues
    const issueCounts: Record<string, number> = {};
    records.forEach(r => {
      if (r.issues && Array.isArray(r.issues)) {
        r.issues.forEach((issue: string) => {
          issueCounts[issue] = (issueCounts[issue] || 0) + 1;
        });
      }
    });

    const commonIssues = Object.entries(issueCounts)
      .map(([issue, count]) => ({ issue: issue as FeedbackIssue, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalSessions,
      positiveCount,
      negativeCount,
      positiveRate: totalSessions > 0 ? positiveCount / totalSessions : 0,
      commonIssues,
    };
  } catch (err: unknown) {
    auditLogger.error(
      'SCRIBE_FEEDBACK_STATS_EXCEPTION',
      err instanceof Error ? err : new Error(String(err)),
      { providerId }
    );
    return null;
  }
}

/**
 * Check if a provider needs voice training based on feedback
 * Returns true if they have 3+ negative ratings in the last 10 sessions
 */
export async function shouldSuggestVoiceTraining(
  providerId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('scribe_session_feedback')
      .select('rating')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !data) return false;

    const records = data as Pick<FeedbackRecord, 'rating'>[];
    const negativeCount = records.filter(r => r.rating === 'negative').length;
    return negativeCount >= 3;
  } catch {
    return false;
  }
}

/**
 * Get recent feedback for admin dashboard
 */
export async function getRecentFeedback(
  limit: number = 50
): Promise<FeedbackRecord[]> {
  try {
    const { data, error } = await supabase
      .from('scribe_session_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      auditLogger.error('SCRIBE_FEEDBACK_RECENT_FAILED', error, {});
      return [];
    }

    return (data || []) as FeedbackRecord[];
  } catch (err: unknown) {
    auditLogger.error(
      'SCRIBE_FEEDBACK_RECENT_EXCEPTION',
      err instanceof Error ? err : new Error(String(err)),
      {}
    );
    return [];
  }
}
