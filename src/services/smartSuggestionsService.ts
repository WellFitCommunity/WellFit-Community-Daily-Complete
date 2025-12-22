/**
 * Smart Suggestions Service
 *
 * Fetches AI-powered wellness suggestions from the Edge Function.
 * Falls back to local random selection if Edge Function is unavailable.
 */

import { supabase } from '../lib/supabaseClient';
import { getRandomSuggestions, MOOD_TO_CATEGORY } from '../data/moodSuggestions';
import { auditLogger } from './auditLogger';

export interface SmartSuggestion {
  id?: string;
  text: string;
  type: string;
}

export interface SmartSuggestionsResponse {
  mood: string;
  category: string;
  suggestions: SmartSuggestion[];
  source: 'haiku' | 'fallback' | 'local';
}

/**
 * Get smart suggestions for a mood using Haiku AI
 */
export async function getSmartSuggestions(
  mood: string,
  options?: {
    symptoms?: string;
    notes?: string;
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
  }
): Promise<SmartSuggestionsResponse> {
  try {
    // Determine time of day if not provided
    const hour = new Date().getHours();
    const timeOfDay = options?.timeOfDay ||
      (hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening');

    // Call the Edge Function
    const { data, error } = await supabase.functions.invoke('smart-mood-suggestions', {
      body: {
        mood,
        symptoms: options?.symptoms,
        notes: options?.notes,
        timeOfDay,
      },
    });

    if (error) {
      throw error;
    }

    if (data?.suggestions && data.suggestions.length > 0) {
      return {
        mood,
        category: data.category || MOOD_TO_CATEGORY[mood] || 'neutral',
        suggestions: data.suggestions,
        source: data.source || 'haiku',
      };
    }

    // If no suggestions returned, fall back to local
    throw new Error('No suggestions returned from Edge Function');

  } catch (err: unknown) {
    // Edge Function failed - fall back to local random selection
    auditLogger.warn('SMART_SUGGESTIONS_FALLBACK', {
      mood,
      reason: err instanceof Error ? err.message : 'Unknown error',
    });

    const localSuggestions = getRandomSuggestions(mood, 3);

    return {
      mood,
      category: MOOD_TO_CATEGORY[mood] || 'neutral',
      suggestions: localSuggestions.map(s => ({
        id: s.id,
        text: s.text,
        type: s.type,
      })),
      source: 'local',
    };
  }
}

/**
 * Get suggestions synchronously (from local pool only)
 * Use this when you need immediate results without waiting for AI
 */
export function getLocalSuggestions(mood: string, count: number = 3): SmartSuggestion[] {
  const suggestions = getRandomSuggestions(mood, count);
  return suggestions.map(s => ({
    id: s.id,
    text: s.text,
    type: s.type,
  }));
}

export default { getSmartSuggestions, getLocalSuggestions };
