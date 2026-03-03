/**
 * voiceLearningLifecycle tests — behavioral coverage for VoiceLearningService.
 *
 * Deletion Test: Every test fails if the service methods are empty stubs.
 *
 * Tests:
 *   - applyCorrections: applies high-confidence corrections to transcript (Tier 1)
 *   - applyCorrections: skips corrections with confidence < 0.5 (Tier 1)
 *   - applyCorrections: specialty-aware sort promotes specialty-matching corrections (Tier 1)
 *   - addCorrection: new correction stored with frequency=1, confidence=0.8 (Tier 2)
 *   - addCorrection: existing correction frequency++, confidence += 0.1 (Tier 2)
 *   - decayOldCorrections: removes old low-frequency corrections (Tier 2)
 *   - decayOldCorrections: keeps high-frequency old corrections, reduces confidence (Tier 2)
 *   - updateAccuracy: sets baseline on first session, runs average thereafter (Tier 2)
 *   - Edge: null profile returns unchanged transcript from applyCorrections (Tier 4)
 *   - Edge: non-existent provider returns 0 from decayOldCorrections (Tier 4)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    clinical: vi.fn(),
    ai: vi.fn(),
  },
}));

// Mock idb to avoid IndexedDB (unavailable in test environment)
vi.mock('idb', () => ({
  openDB: vi.fn().mockResolvedValue({
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Mock supabase (loadVoiceProfile falls back to it)
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
      upsert: vi.fn().mockReturnValue({
        then: vi.fn(),
      }),
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

import { VoiceLearningService } from '../voiceLearningService';
import type { ProviderVoiceProfile, VoiceCorrection } from '../voiceLearningService';

// ============================================================================
// HELPERS
// ============================================================================

function makeProfile(corrections: Partial<VoiceCorrection>[]): ProviderVoiceProfile {
  const now = new Date().toISOString();
  return {
    providerId: 'provider-test',
    corrections: corrections.map(c => ({
      heard: c.heard ?? 'unknown',
      correct: c.correct ?? 'UNKNOWN',
      frequency: c.frequency ?? 1,
      lastUsed: c.lastUsed ?? now,
      confidence: c.confidence ?? 0.8,
      medicalDomain: c.medicalDomain,
    })),
    totalSessions: 3,
    accuracyBaseline: 0.8,
    accuracyCurrent: 0.82,
    createdAt: now,
    updatedAt: now,
  };
}

function makeOldDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

// ============================================================================
// TESTS
// ============================================================================

describe('VoiceLearningService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // applyCorrections — synchronous, no mock needed
  // ──────────────────────────────────────────────────────────────────────────

  describe('applyCorrections — basic correction application', () => {
    it('replaces matched words in transcript using learned corrections', () => {
      const profile = makeProfile([
        { heard: 'httn', correct: 'HTN', frequency: 3, confidence: 0.9 },
        { heard: 'a fib', correct: 'atrial fibrillation', frequency: 2, confidence: 0.8 },
      ]);

      const result = VoiceLearningService.applyCorrections(
        'Patient has httn and a fib.',
        profile
      );

      expect(result.corrected).toContain('HTN');
      expect(result.corrected).toContain('atrial fibrillation');
      expect(result.appliedCount).toBe(2);
      expect(result.appliedCorrections).toContain('HTN');
      expect(result.appliedCorrections).toContain('atrial fibrillation');
    });

    it('skips corrections with confidence below 0.5', () => {
      const profile = makeProfile([
        { heard: 'lowconf', correct: 'LOWCONF', frequency: 5, confidence: 0.4 },
      ]);

      const result = VoiceLearningService.applyCorrections(
        'Patient has lowconf diagnosis.',
        profile
      );

      expect(result.corrected).toContain('lowconf');
      expect(result.appliedCount).toBe(0);
    });

    it('applies longer phrases before shorter ones (specificity ordering)', () => {
      const profile = makeProfile([
        { heard: 'chest pain', correct: 'thoracic pain', frequency: 2, confidence: 0.9 },
        { heard: 'chest', correct: 'CHEST', frequency: 3, confidence: 0.95 },
      ]);

      // "chest pain" is 2 words, "chest" is 1 word — longer phrase applies first
      const result = VoiceLearningService.applyCorrections(
        'Patient reports chest pain.',
        profile
      );

      // The 2-word phrase "chest pain" should be replaced, not just "chest"
      expect(result.corrected).toContain('thoracic pain');
      expect(result.corrected).not.toContain('CHEST pain');
    });
  });

  describe('applyCorrections — specialty-aware sorting', () => {
    it('promotes cardiology-tagged correction over general when specialtyContext is cardiology', () => {
      // Two same-length corrections for the same phrase:
      // A: heard='blood pressure', correct='hypertension', freq=3, confidence=0.9, domain=general → score=2.7
      // B: heard='blood pressure', correct='BP', freq=2, confidence=0.8, domain=cardiology → boosted: 3.2
      //
      // Without specialty: A wins (2.7 > 1.6), applies A.correct ('hypertension')
      //   → then B looks for 'blood pressure' but it's gone → only 'hypertension' in result
      // With specialtyContext=cardiology: B wins (3.2 > 2.7), applies B.correct ('BP')
      //   → then A looks for 'blood pressure' but it's gone → only 'BP' in result
      const profile = makeProfile([
        {
          heard: 'blood pressure',
          correct: 'hypertension',
          frequency: 3,
          confidence: 0.9,
          medicalDomain: 'general',
        },
        {
          heard: 'blood pressure',
          correct: 'BP',
          frequency: 2,
          confidence: 0.8,
          medicalDomain: 'cardiology',
        },
      ]);

      const withoutSpecialty = VoiceLearningService.applyCorrections(
        'Patient blood pressure is elevated.',
        profile
      );
      const withSpecialty = VoiceLearningService.applyCorrections(
        'Patient blood pressure is elevated.',
        profile,
        'cardiology'
      );

      // Without specialty context: general correction wins → 'hypertension'
      expect(withoutSpecialty.corrected).toContain('hypertension');
      expect(withoutSpecialty.corrected).not.toContain('blood pressure');
      // With cardiology context: cardiology correction wins → 'BP'
      expect(withSpecialty.corrected).toContain('BP');
      expect(withSpecialty.corrected).not.toContain('blood pressure');
    });
  });

  describe('applyCorrections — null profile edge case', () => {
    it('returns unchanged transcript when profile is null', () => {
      const result = VoiceLearningService.applyCorrections(
        'Patient reports chest pain.',
        null
      );

      expect(result.corrected).toBe('Patient reports chest pain.');
      expect(result.appliedCount).toBe(0);
      expect(result.appliedCorrections).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // addCorrection — async, spies on loadVoiceProfile / saveVoiceProfile
  // ──────────────────────────────────────────────────────────────────────────

  describe('addCorrection — new correction', () => {
    it('stores new correction with confidence=0.8 and frequency=1', async () => {
      vi.spyOn(VoiceLearningService, 'loadVoiceProfile').mockResolvedValue(null);
      const saveSpy = vi
        .spyOn(VoiceLearningService, 'saveVoiceProfile')
        .mockResolvedValue(undefined);

      await VoiceLearningService.addCorrection('p1', 'httn', 'HTN', 'cardiology');

      expect(saveSpy).toHaveBeenCalledOnce();
      const saved = saveSpy.mock.calls[0][0];
      const correction = saved.corrections.find((c: VoiceCorrection) => c.heard === 'httn');
      expect(correction).toBeDefined();
      expect(correction?.correct).toBe('HTN');
      expect(correction?.confidence).toBe(0.8);
      expect(correction?.frequency).toBe(1);
      expect(correction?.medicalDomain).toBe('cardiology');
    });
  });

  describe('addCorrection — existing correction', () => {
    it('increments frequency and bumps confidence by 0.1 for known correction', async () => {
      const existing = makeProfile([
        { heard: 'httn', correct: 'HTN', frequency: 2, confidence: 0.85 },
      ]);
      vi.spyOn(VoiceLearningService, 'loadVoiceProfile').mockResolvedValue(existing);
      const saveSpy = vi
        .spyOn(VoiceLearningService, 'saveVoiceProfile')
        .mockResolvedValue(undefined);

      await VoiceLearningService.addCorrection('p1', 'httn', 'HTN');

      const saved = saveSpy.mock.calls[0][0];
      const correction = saved.corrections.find((c: VoiceCorrection) => c.heard === 'httn');
      expect(correction?.frequency).toBe(3);
      expect(correction?.confidence).toBeCloseTo(0.95, 5); // 0.85 + 0.1
    });

    it('caps confidence at 1.0 when adding 0.1 would exceed it', async () => {
      const existing = makeProfile([
        { heard: 'ecg', correct: 'ECG', frequency: 10, confidence: 0.95 },
      ]);
      vi.spyOn(VoiceLearningService, 'loadVoiceProfile').mockResolvedValue(existing);
      const saveSpy = vi
        .spyOn(VoiceLearningService, 'saveVoiceProfile')
        .mockResolvedValue(undefined);

      await VoiceLearningService.addCorrection('p1', 'ecg', 'ECG');

      const saved = saveSpy.mock.calls[0][0];
      const correction = saved.corrections.find((c: VoiceCorrection) => c.heard === 'ecg');
      expect(correction?.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // decayOldCorrections
  // ──────────────────────────────────────────────────────────────────────────

  describe('decayOldCorrections', () => {
    it('removes old corrections with frequency < 3 (stale, rarely used)', async () => {
      const profile = makeProfile([
        { heard: 'rare', correct: 'RARE', frequency: 1, lastUsed: makeOldDate(70) },
        { heard: 'recent', correct: 'RECENT', frequency: 1, lastUsed: new Date().toISOString() },
      ]);
      vi.spyOn(VoiceLearningService, 'loadVoiceProfile').mockResolvedValue(profile);
      const saveSpy = vi
        .spyOn(VoiceLearningService, 'saveVoiceProfile')
        .mockResolvedValue(undefined);

      const decayedCount = await VoiceLearningService.decayOldCorrections('p1', 60);

      expect(decayedCount).toBe(1);
      const saved = saveSpy.mock.calls[0][0];
      expect(saved.corrections.find((c: VoiceCorrection) => c.heard === 'rare')).toBeUndefined();
      expect(saved.corrections.find((c: VoiceCorrection) => c.heard === 'recent')).toBeDefined();
    });

    it('keeps high-frequency old corrections but reduces their confidence by 0.9x', async () => {
      // Include one low-frequency correction so decayedCount > 0 and saveVoiceProfile is called.
      // The high-frequency correction is kept but has its confidence reduced.
      const profile = makeProfile([
        { heard: 'rare', correct: 'RARE', frequency: 1, lastUsed: makeOldDate(70) },
        { heard: 'common', correct: 'COMMON', frequency: 5, confidence: 0.9, lastUsed: makeOldDate(70) },
      ]);
      vi.spyOn(VoiceLearningService, 'loadVoiceProfile').mockResolvedValue(profile);
      const saveSpy = vi
        .spyOn(VoiceLearningService, 'saveVoiceProfile')
        .mockResolvedValue(undefined);

      const decayedCount = await VoiceLearningService.decayOldCorrections('p1', 60);

      // 'rare' is removed (frequency < 3), 'common' is kept
      expect(decayedCount).toBe(1);
      expect(saveSpy).toHaveBeenCalledOnce();
      const saved = saveSpy.mock.calls[0][0];
      expect(saved.corrections.find((c: VoiceCorrection) => c.heard === 'rare')).toBeUndefined();
      const common = saved.corrections.find((c: VoiceCorrection) => c.heard === 'common');
      expect(common).toBeDefined();
      expect(common?.confidence).toBeCloseTo(0.9 * 0.9, 5); // reduced by 0.9x
    });

    it('does not call saveVoiceProfile when no corrections are decayed', async () => {
      const profile = makeProfile([
        { heard: 'fresh', correct: 'FRESH', frequency: 1, lastUsed: new Date().toISOString() },
      ]);
      vi.spyOn(VoiceLearningService, 'loadVoiceProfile').mockResolvedValue(profile);
      const saveSpy = vi
        .spyOn(VoiceLearningService, 'saveVoiceProfile')
        .mockResolvedValue(undefined);

      await VoiceLearningService.decayOldCorrections('p1', 60);

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('returns 0 when provider has no profile', async () => {
      vi.spyOn(VoiceLearningService, 'loadVoiceProfile').mockResolvedValue(null);

      const count = await VoiceLearningService.decayOldCorrections('unknown-provider');

      expect(count).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // updateAccuracy
  // ──────────────────────────────────────────────────────────────────────────

  describe('updateAccuracy', () => {
    it('sets accuracyBaseline on the very first session (baseline was 0)', async () => {
      const freshProfile = makeProfile([]);
      freshProfile.accuracyBaseline = 0;
      freshProfile.accuracyCurrent = 0;
      freshProfile.totalSessions = 0;

      vi.spyOn(VoiceLearningService, 'loadVoiceProfile').mockResolvedValue(freshProfile);
      const saveSpy = vi
        .spyOn(VoiceLearningService, 'saveVoiceProfile')
        .mockResolvedValue(undefined);

      await VoiceLearningService.updateAccuracy('p1', 0.75);

      const saved = saveSpy.mock.calls[0][0];
      expect(saved.accuracyBaseline).toBe(0.75);
      expect(saved.totalSessions).toBe(1);
    });

    it('computes running average accuracy across multiple sessions', async () => {
      // After first session accuracy=0.75 → baseline=0.75, current=0.75, sessions=1
      // On second call: current = (0.75*1 + 0.85) / (1+1) = 1.60/2 = 0.80
      const profileAfterSession1 = makeProfile([]);
      profileAfterSession1.accuracyBaseline = 0.75;
      profileAfterSession1.accuracyCurrent = 0.75;
      profileAfterSession1.totalSessions = 1;

      vi.spyOn(VoiceLearningService, 'loadVoiceProfile').mockResolvedValue(profileAfterSession1);
      const saveSpy = vi
        .spyOn(VoiceLearningService, 'saveVoiceProfile')
        .mockResolvedValue(undefined);

      await VoiceLearningService.updateAccuracy('p1', 0.85);

      const saved = saveSpy.mock.calls[0][0];
      expect(saved.accuracyCurrent).toBeCloseTo(0.80, 5);
      expect(saved.totalSessions).toBe(2);
      // Baseline stays at original value
      expect(saved.accuracyBaseline).toBe(0.75);
    });
  });
});
