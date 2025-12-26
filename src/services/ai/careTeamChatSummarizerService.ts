/**
 * Care Team Chat Summarizer Service
 *
 * Summarizes care team communications, extracts action items,
 * and highlights critical patient updates for shift handoffs.
 *
 * Features:
 * - Thread/channel summarization
 * - Action item extraction
 * - Critical update identification
 * - Sentiment analysis
 * - Decision tracking
 * - Follow-up reminders
 *
 * @module careTeamChatSummarizerService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  messageId: string;
  timestamp: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  mentions?: string[];
  attachments?: Array<{ type: string; name: string }>;
  replyTo?: string;
  reactions?: Array<{ emoji: string; count: number }>;
}

export interface ActionItem {
  id: string;
  action: string;
  assignedTo: string;
  assignedToRole?: string;
  dueDate?: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  sourceMessageId: string;
  context: string;
}

export interface CriticalUpdate {
  id: string;
  updateType: 'vital_change' | 'medication_change' | 'condition_change' | 'care_plan_change' | 'alert' | 'escalation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  details: string;
  patientId?: string;
  sourceMessageIds: string[];
  requiresAcknowledgment: boolean;
}

export interface KeyDecision {
  id: string;
  decision: string;
  madeBy: string;
  timestamp: string;
  rationale?: string;
  affectedPatients?: string[];
  sourceMessageId: string;
}

export interface FollowUpItem {
  id: string;
  item: string;
  reason: string;
  suggestedTime?: string;
  relatedPatientId?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface SentimentAnalysis {
  overallSentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  urgencyLevel: 'calm' | 'moderate' | 'elevated' | 'urgent';
  teamMorale: 'high' | 'moderate' | 'low';
  stressIndicators: string[];
  positiveIndicators: string[];
}

export interface ChatSummaryResult {
  summaryId: string;
  periodStart: string;
  periodEnd: string;
  channelName?: string;
  messageCount: number;
  participantCount: number;
  participants: Array<{ id: string; name: string; role: string; messageCount: number }>;
  executiveSummary: string;
  keyTopics: Array<{ topic: string; messageCount: number; importance: 'high' | 'medium' | 'low' }>;
  patientMentions: Array<{ patientId: string; mentionCount: number; context: string }>;
  keyDecisions: KeyDecision[];
  actionItems: ActionItem[];
  criticalUpdates: CriticalUpdate[];
  followUpRequired: FollowUpItem[];
  sentimentAnalysis: SentimentAnalysis;
  handoffNotes: string[];
  unansweredQuestions: Array<{ question: string; askedBy: string; timestamp: string }>;
}

export interface ChatSummaryRequest {
  messages: ChatMessage[];
  channelName?: string;
  patientId?: string;
  periodStart?: string;
  periodEnd?: string;
  summaryType?: 'shift_handoff' | 'daily' | 'weekly' | 'patient_focused';
  tenantId?: string;
}

export interface ChatSummaryResponse {
  result: ChatSummaryResult;
  metadata: {
    generatedAt: string;
    model: string;
    responseTimeMs: number;
    messagesProcessed: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class CareTeamChatSummarizerService {
  /**
   * Generate chat summary
   */
  static async summarizeChat(
    request: ChatSummaryRequest
  ): Promise<ServiceResult<ChatSummaryResponse>> {
    try {
      if (!request.messages || request.messages.length === 0) {
        return failure('INVALID_INPUT', 'At least one message is required');
      }

      const { data, error } = await supabase.functions.invoke('ai-care-team-chat-summarizer', {
        body: {
          messages: request.messages,
          channelName: request.channelName,
          patientId: request.patientId,
          periodStart: request.periodStart,
          periodEnd: request.periodEnd,
          summaryType: request.summaryType || 'shift_handoff',
          tenantId: request.tenantId,
        },
      });

      if (error) throw error;

      return success(data as ChatSummaryResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('SUMMARIZATION_FAILED', error.message, error);
    }
  }

  /**
   * Save summary to database
   */
  static async saveSummary(
    request: ChatSummaryRequest,
    response: ChatSummaryResponse
  ): Promise<ServiceResult<{ id: string }>> {
    try {
      const { data, error } = await supabase
        .from('ai_care_team_chat_summaries')
        .insert({
          summary_id: response.result.summaryId,
          patient_id: request.patientId,
          chat_channel: request.channelName,
          period_start: response.result.periodStart,
          period_end: response.result.periodEnd,
          message_count: response.result.messageCount,
          participant_count: response.result.participantCount,
          summary_text: response.result.executiveSummary,
          key_decisions: response.result.keyDecisions,
          action_items: response.result.actionItems,
          critical_updates: response.result.criticalUpdates,
          follow_up_required: response.result.followUpRequired,
          sentiment_analysis: response.result.sentimentAnalysis,
          result: response.result,
          tenant_id: request.tenantId,
        })
        .select('id')
        .single();

      if (error) throw error;

      return success({ id: data.id });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Get recent summaries for a channel
   */
  static async getChannelSummaries(
    channelName: string,
    tenantId: string,
    limit: number = 10
  ): Promise<ServiceResult<ChatSummaryResult[]>> {
    try {
      const { data, error } = await supabase
        .from('ai_care_team_chat_summaries')
        .select('result')
        .eq('tenant_id', tenantId)
        .eq('chat_channel', channelName)
        .order('period_end', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return success((data || []).map((d) => d.result as ChatSummaryResult));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Get patient-focused summaries
   */
  static async getPatientSummaries(
    patientId: string,
    tenantId: string,
    limit: number = 10
  ): Promise<ServiceResult<ChatSummaryResult[]>> {
    try {
      const { data, error } = await supabase
        .from('ai_care_team_chat_summaries')
        .select('result')
        .eq('tenant_id', tenantId)
        .eq('patient_id', patientId)
        .order('period_end', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return success((data || []).map((d) => d.result as ChatSummaryResult));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Get pending action items
   */
  static async getPendingActionItems(
    tenantId: string,
    assignedTo?: string
  ): Promise<ServiceResult<ActionItem[]>> {
    try {
      const { data, error } = await supabase
        .from('ai_care_team_chat_summaries')
        .select('action_items')
        .eq('tenant_id', tenantId)
        .order('period_end', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Flatten and filter action items
      const allItems: ActionItem[] = [];
      for (const row of data || []) {
        const items = row.action_items as ActionItem[];
        for (const item of items) {
          if (item.status === 'pending' || item.status === 'in_progress') {
            if (!assignedTo || item.assignedTo === assignedTo) {
              allItems.push(item);
            }
          }
        }
      }

      // Sort by priority
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      allItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      return success(allItems);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Get critical updates requiring acknowledgment
   */
  static async getUnacknowledgedUpdates(
    tenantId: string
  ): Promise<ServiceResult<CriticalUpdate[]>> {
    try {
      const { data, error } = await supabase
        .from('ai_care_team_chat_summaries')
        .select('critical_updates')
        .eq('tenant_id', tenantId)
        .order('period_end', { ascending: false })
        .limit(10);

      if (error) throw error;

      const updates: CriticalUpdate[] = [];
      for (const row of data || []) {
        const items = row.critical_updates as CriticalUpdate[];
        for (const item of items) {
          if (item.requiresAcknowledgment) {
            updates.push(item);
          }
        }
      }

      return success(updates);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Generate shift handoff summary
   */
  static async generateShiftHandoff(
    messages: ChatMessage[],
    shiftStart: string,
    shiftEnd: string,
    tenantId: string
  ): Promise<ServiceResult<ChatSummaryResponse>> {
    return this.summarizeChat({
      messages,
      periodStart: shiftStart,
      periodEnd: shiftEnd,
      summaryType: 'shift_handoff',
      tenantId,
    });
  }

  /**
   * Quick message categorization
   */
  static categorizeMessage(content: string): {
    category: 'clinical' | 'administrative' | 'social' | 'urgent' | 'question';
    keywords: string[];
  } {
    const lowerContent = content.toLowerCase();
    const keywords: string[] = [];

    // Check for urgent indicators
    const urgentPatterns = ['urgent', 'asap', 'emergency', 'immediately', 'critical', 'stat'];
    for (const pattern of urgentPatterns) {
      if (lowerContent.includes(pattern)) {
        keywords.push(pattern);
      }
    }
    if (keywords.length > 0) {
      return { category: 'urgent', keywords };
    }

    // Check for clinical content
    const clinicalPatterns = ['vitals', 'medication', 'bp', 'heart rate', 'temp', 'pain', 'symptom', 'diagnosis', 'treatment'];
    for (const pattern of clinicalPatterns) {
      if (lowerContent.includes(pattern)) {
        keywords.push(pattern);
      }
    }
    if (keywords.length > 0) {
      return { category: 'clinical', keywords };
    }

    // Check for questions
    if (content.includes('?')) {
      return { category: 'question', keywords: ['inquiry'] };
    }

    // Check for administrative
    const adminPatterns = ['schedule', 'meeting', 'shift', 'coverage', 'paperwork', 'documentation'];
    for (const pattern of adminPatterns) {
      if (lowerContent.includes(pattern)) {
        keywords.push(pattern);
      }
    }
    if (keywords.length > 0) {
      return { category: 'administrative', keywords };
    }

    return { category: 'social', keywords: [] };
  }
}

export default CareTeamChatSummarizerService;
