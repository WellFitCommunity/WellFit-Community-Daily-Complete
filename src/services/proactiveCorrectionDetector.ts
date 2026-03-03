/**
 * Proactive Correction Detector
 *
 * Per-session tracker: when the same phrase appears 3+ times in a recording
 * without a high-confidence voice correction, it surfaces the phrase for
 * physician review ("Did Riley mishear this?").
 *
 * Uses the factory pattern for clean session isolation and testability.
 *
 * Part of Compass Riley Ambient Learning Session 3 (3.2 — Proactive Suggestions).
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import type { ProviderVoiceProfile } from './voiceLearningService';
import { auditLogger } from './auditLogger';

// ============================================================================
// Constants
// ============================================================================

const PHRASE_HIT_THRESHOLD = 3;
const MIN_WORD_LENGTH = 4;
const MAX_SUGGESTIONS = 3;
const HIGH_CONFIDENCE_THRESHOLD = 0.5;

// ============================================================================
// Types
// ============================================================================

export interface ProactiveCorrectionDetector {
  /** Record words from a transcript chunk into session hit counts. */
  trackChunk: (transcriptChunk: string) => void;
  /**
   * Return phrases that appear >= 3 times this session and either lack a
   * voice-profile correction or have one with confidence < 0.5.
   */
  detectSuggestedReviews: (voiceProfile: ProviderVoiceProfile | null) => string[];
  /** Clear all counts — call at the start of each recording session. */
  reset: () => void;
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new detector instance for a recording session.
 * Each session should use its own instance to avoid cross-session contamination.
 */
export function createProactiveCorrectionDetector(): ProactiveCorrectionDetector {
  const phraseHits = new Map<string, number>();

  function trackChunk(transcriptChunk: string): void {
    const words = transcriptChunk.toLowerCase().trim().split(/\s+/);
    for (const word of words) {
      const cleaned = word.replace(/[^a-z0-9]/g, '');
      if (cleaned.length >= MIN_WORD_LENGTH) {
        phraseHits.set(cleaned, (phraseHits.get(cleaned) ?? 0) + 1);
      }
    }
  }

  function detectSuggestedReviews(voiceProfile: ProviderVoiceProfile | null): string[] {
    const suggestions: string[] = [];

    for (const [phrase, count] of phraseHits.entries()) {
      if (count < PHRASE_HIT_THRESHOLD) continue;

      if (!voiceProfile) {
        suggestions.push(phrase);
        continue;
      }

      // Skip if this phrase already has a high-confidence learned correction
      const correction = voiceProfile.corrections.find(
        c => c.heard.toLowerCase().replace(/[^a-z0-9]/g, '') === phrase
      );
      if (!correction || correction.confidence < HIGH_CONFIDENCE_THRESHOLD) {
        suggestions.push(phrase);
      }
    }

    const result = suggestions.slice(0, MAX_SUGGESTIONS);
    if (result.length > 0) {
      auditLogger.debug('PROACTIVE_SUGGESTIONS_DETECTED', { count: result.length });
    }
    return result;
  }

  function reset(): void {
    phraseHits.clear();
  }

  return { trackChunk, detectSuggestedReviews, reset };
}
