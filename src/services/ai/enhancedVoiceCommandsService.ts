/**
 * Enhanced Voice Commands Service
 *
 * Claude-powered natural language intent recognition for voice commands,
 * supporting complex queries and contextual understanding.
 *
 * Features:
 * - Natural language understanding
 * - Multi-intent detection
 * - Context-aware responses
 * - Entity extraction
 * - Command disambiguation
 * - Accessibility support
 *
 * @module enhancedVoiceCommandsService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IntentCategory =
  | 'navigation'
  | 'patient_lookup'
  | 'data_entry'
  | 'report_request'
  | 'schedule'
  | 'medication'
  | 'communication'
  | 'help'
  | 'settings'
  | 'unknown';

export interface ExtractedEntity {
  type: 'patient_name' | 'patient_id' | 'date' | 'time' | 'medication' | 'provider' | 'location' | 'number' | 'duration';
  value: string;
  normalized?: string;
  confidence: number;
  position: { start: number; end: number };
}

export interface DetectedIntent {
  intent: string;
  category: IntentCategory;
  confidence: number;
  parameters: Record<string, unknown>;
  requiredParameters: string[];
  missingParameters: string[];
}

export interface CommandAction {
  actionType: 'navigate' | 'search' | 'create' | 'update' | 'delete' | 'display' | 'speak' | 'confirm';
  target: string;
  parameters: Record<string, unknown>;
  confirmation?: {
    required: boolean;
    prompt: string;
  };
}

export interface VoiceCommandResult {
  transcription: string;
  correctedTranscription?: string;
  intents: DetectedIntent[];
  primaryIntent: DetectedIntent;
  entities: ExtractedEntity[];
  suggestedActions: CommandAction[];
  clarificationNeeded: boolean;
  clarificationPrompt?: string;
  alternativeInterpretations?: Array<{
    interpretation: string;
    confidence: number;
  }>;
  responseText: string;
  shouldSpeak: boolean;
  context: {
    previousCommands?: string[];
    currentPage?: string;
    activePatient?: string;
  };
}

export interface VoiceCommandRequest {
  transcription: string;
  context?: {
    currentPage?: string;
    activePatientId?: string;
    previousCommands?: string[];
    userRole?: string;
    userId?: string;
  };
  requireConfirmation?: boolean;
  tenantId?: string;
}

export interface VoiceCommandResponse {
  result: VoiceCommandResult;
  metadata: {
    generatedAt: string;
    model: string;
    responseTimeMs: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class EnhancedVoiceCommandsService {
  /**
   * Process voice command
   */
  static async processCommand(
    request: VoiceCommandRequest
  ): Promise<ServiceResult<VoiceCommandResponse>> {
    try {
      if (!request.transcription?.trim()) {
        return failure('INVALID_INPUT', 'Voice transcription is required');
      }

      const { data, error } = await supabase.functions.invoke('ai-enhanced-voice-commands', {
        body: {
          transcription: request.transcription,
          context: request.context || {},
          requireConfirmation: request.requireConfirmation ?? false,
          tenantId: request.tenantId,
        },
      });

      if (error) throw error;

      return success(data as VoiceCommandResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('PROCESSING_FAILED', error.message, error);
    }
  }

  /**
   * Quick intent detection (no API call, pattern-based)
   */
  static quickIntentDetect(transcription: string): {
    category: IntentCategory;
    confidence: number;
    suggestedAction?: string;
  } {
    const lower = transcription.toLowerCase().trim();

    // Navigation patterns
    const navPatterns: Record<string, string> = {
      'go to': 'navigate',
      'open': 'navigate',
      'show me': 'navigate',
      'take me to': 'navigate',
      'navigate to': 'navigate',
    };

    for (const [pattern, action] of Object.entries(navPatterns)) {
      if (lower.startsWith(pattern)) {
        return { category: 'navigation', confidence: 0.9, suggestedAction: action };
      }
    }

    // Patient lookup patterns
    const patientPatterns = ['find patient', 'look up', 'search for', 'patient', 'who is'];
    for (const pattern of patientPatterns) {
      if (lower.includes(pattern)) {
        return { category: 'patient_lookup', confidence: 0.85, suggestedAction: 'search' };
      }
    }

    // Schedule patterns
    const schedulePatterns = ['schedule', 'appointment', 'calendar', 'meeting', 'available'];
    for (const pattern of schedulePatterns) {
      if (lower.includes(pattern)) {
        return { category: 'schedule', confidence: 0.8, suggestedAction: 'view_schedule' };
      }
    }

    // Medication patterns
    const medPatterns = ['medication', 'medicine', 'prescription', 'drug', 'dose'];
    for (const pattern of medPatterns) {
      if (lower.includes(pattern)) {
        return { category: 'medication', confidence: 0.8 };
      }
    }

    // Report patterns
    const reportPatterns = ['report', 'summary', 'analytics', 'statistics', 'data'];
    for (const pattern of reportPatterns) {
      if (lower.includes(pattern)) {
        return { category: 'report_request', confidence: 0.8, suggestedAction: 'generate_report' };
      }
    }

    // Help patterns
    const helpPatterns = ['help', 'how do i', 'what is', 'explain', 'guide'];
    for (const pattern of helpPatterns) {
      if (lower.includes(pattern)) {
        return { category: 'help', confidence: 0.9, suggestedAction: 'show_help' };
      }
    }

    // Communication patterns
    const commPatterns = ['send', 'message', 'notify', 'alert', 'call', 'email'];
    for (const pattern of commPatterns) {
      if (lower.includes(pattern)) {
        return { category: 'communication', confidence: 0.8 };
      }
    }

    return { category: 'unknown', confidence: 0.3 };
  }

  /**
   * Extract entities from transcription
   */
  static extractEntities(transcription: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const lower = transcription.toLowerCase();

    // Date patterns
    const datePatterns = [
      /\b(today|tomorrow|yesterday)\b/gi,
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
      /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/g,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,?\s*\d{4})?\b/gi,
    ];

    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(transcription)) !== null) {
        entities.push({
          type: 'date',
          value: match[0],
          confidence: 0.9,
          position: { start: match.index, end: match.index + match[0].length },
        });
      }
    }

    // Time patterns
    const timePattern = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/gi;
    let match;
    while ((match = timePattern.exec(transcription)) !== null) {
      entities.push({
        type: 'time',
        value: match[0],
        confidence: 0.85,
        position: { start: match.index, end: match.index + match[0].length },
      });
    }

    // Number patterns
    const numberPattern = /\b(\d+(?:\.\d+)?)\b/g;
    while ((match = numberPattern.exec(transcription)) !== null) {
      // Avoid duplicating dates/times
      const isPartOfOther = entities.some(
        (e) => match!.index >= e.position.start && match!.index < e.position.end
      );
      if (!isPartOfOther) {
        entities.push({
          type: 'number',
          value: match[0],
          confidence: 0.8,
          position: { start: match.index, end: match.index + match[0].length },
        });
      }
    }

    return entities;
  }

  /**
   * Get command suggestions based on context
   */
  static getContextualSuggestions(context: {
    currentPage?: string;
    userRole?: string;
  }): string[] {
    const suggestions: string[] = [];

    // Universal suggestions
    suggestions.push('Go to dashboard');
    suggestions.push('Show today\'s schedule');
    suggestions.push('Find patient');

    // Page-specific suggestions
    if (context.currentPage?.includes('patient')) {
      suggestions.push('Show vitals');
      suggestions.push('View medications');
      suggestions.push('Open care plan');
      suggestions.push('View recent notes');
    }

    if (context.currentPage?.includes('schedule')) {
      suggestions.push('Show tomorrow\'s appointments');
      suggestions.push('Find next available slot');
      suggestions.push('Reschedule appointment');
    }

    // Role-specific suggestions
    if (context.userRole === 'physician') {
      suggestions.push('Sign orders');
      suggestions.push('Review labs');
      suggestions.push('Dictate note');
    }

    if (context.userRole === 'nurse') {
      suggestions.push('Document vitals');
      suggestions.push('View medication list');
      suggestions.push('Check alerts');
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Generate spoken response
   */
  static generateSpokenResponse(result: VoiceCommandResult): string {
    if (result.clarificationNeeded && result.clarificationPrompt) {
      return result.clarificationPrompt;
    }

    if (result.primaryIntent.category === 'unknown') {
      return 'I didn\'t understand that command. Try saying "help" for available commands.';
    }

    return result.responseText;
  }

  /**
   * Log voice command for analytics
   */
  static async logCommand(
    request: VoiceCommandRequest,
    response: VoiceCommandResponse,
    wasSuccessful: boolean
  ): Promise<ServiceResult<void>> {
    try {
      await supabase.from('voice_command_logs').insert({
        transcription: request.transcription,
        detected_intent: response.result.primaryIntent.intent,
        intent_category: response.result.primaryIntent.category,
        confidence: response.result.primaryIntent.confidence,
        entities: response.result.entities,
        was_successful: wasSuccessful,
        clarification_needed: response.result.clarificationNeeded,
        context: request.context,
        user_id: request.context?.userId,
        tenant_id: request.tenantId,
      });

      return success(undefined);
    } catch (err: unknown) {
      // Don't fail on logging errors
      return success(undefined);
    }
  }

  /**
   * Get popular commands
   */
  static async getPopularCommands(
    tenantId: string,
    limit: number = 10
  ): Promise<ServiceResult<Array<{ command: string; count: number }>>> {
    try {
      const { data, error } = await supabase
        .from('voice_command_logs')
        .select('detected_intent')
        .eq('tenant_id', tenantId)
        .eq('was_successful', true)
        .limit(1000);

      if (error) throw error;

      // Aggregate by intent
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        const intent = row.detected_intent;
        counts[intent] = (counts[intent] || 0) + 1;
      }

      const result = Object.entries(counts)
        .map(([command, count]) => ({ command, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return success(result);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }
}

export default EnhancedVoiceCommandsService;
