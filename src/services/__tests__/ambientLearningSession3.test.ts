/**
 * Ambient Learning Session 3 — Intuitive Adaptation Engine
 *
 * Tests for:
 *   3.1 - computeAutoCalibration (auto-calibrating assistance level)
 *   3.2 - createProactiveCorrectionDetector (proactive phrase correction)
 */

import { describe, it, expect, vi } from 'vitest';
import { computeAutoCalibration } from '../../components/smart/hooks/useScribePreferences';
import { createProactiveCorrectionDetector } from '../proactiveCorrectionDetector';
import type { ProviderVoiceProfile } from '../voiceLearningService';

// auditLogger.debug is called inside detectSuggestedReviews — mock it for tests
vi.mock('../auditLogger', () => ({
  auditLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================================================
// Helpers
// ============================================================================

function makeVoiceProfile(
  corrections: Array<{ heard: string; correct: string; confidence: number }> = []
): ProviderVoiceProfile {
  return {
    providerId: 'test-provider-001',
    corrections: corrections.map(c => ({
      heard: c.heard,
      correct: c.correct,
      confidence: c.confidence,
      frequency: 1,
      lastUsed: new Date().toISOString(),
    })),
    totalSessions: 5,
    accuracyBaseline: 0.90,
    accuracyCurrent: 0.95,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// 3.1 — computeAutoCalibration
// ============================================================================

describe('computeAutoCalibration', () => {
  it('returns null when fewer than 10 sessions have been analyzed', () => {
    const result = computeAutoCalibration('verbose', 9, 5);
    expect(result).toBeNull();
  });

  it('returns null when 0 sessions analyzed', () => {
    const result = computeAutoCalibration('verbose', 0, 7);
    expect(result).toBeNull();
  });

  it('suggests level 8 when verbose style and current level is 7 or below', () => {
    const result = computeAutoCalibration('verbose', 15, 7);
    expect(result).not.toBeNull();
    if (!result) throw new Error('Expected calibration hint');
    expect(result.suggestedLevel).toBe(8);
    expect(result.reason).toContain('15');
  });

  it('does not suggest higher level when verbose style but already at level 8', () => {
    const result = computeAutoCalibration('verbose', 15, 8);
    expect(result).toBeNull();
  });

  it('suggests level 3 when terse style and current level is 5 or above', () => {
    const result = computeAutoCalibration('terse', 20, 5);
    expect(result).not.toBeNull();
    if (!result) throw new Error('Expected calibration hint');
    expect(result.suggestedLevel).toBe(3);
    expect(result.reason).toContain('20');
  });

  it('does not suggest lower level when terse style but already at level 3', () => {
    const result = computeAutoCalibration('terse', 20, 3);
    expect(result).toBeNull();
  });

  it('returns null for moderate verbosity regardless of assistance level', () => {
    expect(computeAutoCalibration('moderate', 25, 3)).toBeNull();
    expect(computeAutoCalibration('moderate', 25, 5)).toBeNull();
    expect(computeAutoCalibration('moderate', 25, 8)).toBeNull();
  });
});

// ============================================================================
// 3.2 — createProactiveCorrectionDetector
// ============================================================================

describe('createProactiveCorrectionDetector', () => {
  it('returns empty suggestions when phrases have fewer than 3 hits', () => {
    const detector = createProactiveCorrectionDetector();
    detector.trackChunk('metformin');
    detector.trackChunk('metformin');
    // threshold is 3 — still below
    const suggestions = detector.detectSuggestedReviews(null);
    expect(suggestions).toHaveLength(0);
  });

  it('surfaces a phrase once it reaches the hit threshold of 3', () => {
    const detector = createProactiveCorrectionDetector();
    detector.trackChunk('metformin');
    detector.trackChunk('metformin');
    detector.trackChunk('metformin');
    const suggestions = detector.detectSuggestedReviews(null);
    expect(suggestions).toContain('metformin');
  });

  it('skips a phrase that already has a high-confidence voice correction (>= 0.5)', () => {
    const profile = makeVoiceProfile([
      { heard: 'metformin', correct: 'Metformin', confidence: 0.9 },
    ]);
    const detector = createProactiveCorrectionDetector();
    detector.trackChunk('metformin');
    detector.trackChunk('metformin');
    detector.trackChunk('metformin');
    // High-confidence correction exists — should NOT be surfaced
    expect(detector.detectSuggestedReviews(profile)).not.toContain('metformin');
  });

  it('surfaces a phrase with a low-confidence voice correction (< 0.5)', () => {
    const profile = makeVoiceProfile([
      { heard: 'lisinopril', correct: 'Lisinopril', confidence: 0.3 },
    ]);
    const detector = createProactiveCorrectionDetector();
    detector.trackChunk('lisinopril');
    detector.trackChunk('lisinopril');
    detector.trackChunk('lisinopril');
    // Low-confidence correction — still worth surfacing for review
    expect(detector.detectSuggestedReviews(profile)).toContain('lisinopril');
  });

  it('caps results at 3 suggestions even when many phrases exceed the threshold', () => {
    const detector = createProactiveCorrectionDetector();
    const terms = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
    for (const term of terms) {
      detector.trackChunk(term);
      detector.trackChunk(term);
      detector.trackChunk(term);
    }
    const suggestions = detector.detectSuggestedReviews(null);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it('reset clears all phrase hits so subsequent detection returns empty', () => {
    const detector = createProactiveCorrectionDetector();
    detector.trackChunk('atorvastatin');
    detector.trackChunk('atorvastatin');
    detector.trackChunk('atorvastatin');
    detector.reset();
    expect(detector.detectSuggestedReviews(null)).toHaveLength(0);
  });

  it('ignores words shorter than the minimum word length of 4 characters', () => {
    const detector = createProactiveCorrectionDetector();
    // 'bp' is 2 chars — below MIN_WORD_LENGTH (4)
    detector.trackChunk('bp bp bp bp');
    expect(detector.detectSuggestedReviews(null)).not.toContain('bp');
  });
});
