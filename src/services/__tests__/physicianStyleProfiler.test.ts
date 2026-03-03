/**
 * physicianStyleProfiler tests — behavioral coverage for style profiling.
 *
 * Deletion Test: Every test fails if updateStyleProfile returns null or an unpopulated profile.
 *
 * Tests:
 *   - Verbosity classification: verbose/terse/moderate based on EMA score (Tier 1)
 *   - EMA verbosity score update: alpha=0.2 blending computation (Tier 2)
 *   - Terminology override merge: new term added, existing frequency incremented (Tier 2)
 *   - Specialty detection: cardiology keywords produce 'cardiology' (Tier 1)
 *   - Fresh provider profile (null existing) initializes correctly (Tier 4)
 *   - sessionsAnalyzed increments on each update (Tier 2)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS (variables named mock* are hoisted by Vitest)
// ============================================================================

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockUpsert = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      upsert: mockUpsert,
    })),
  },
}));

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

import { updateStyleProfile, MIN_SESSIONS_FOR_DISPLAY } from '../physicianStyleProfiler';
import type { SOAPEditAnalysis } from '../soapNoteEditObserver';

// ============================================================================
// HELPERS
// ============================================================================

function makeEditAnalysis(
  overallVerbosityDelta: number,
  overrides: Array<{ aiTerm: string; physicianTerm: string }> = []
): SOAPEditAnalysis {
  return {
    sessionId: 'test-session',
    providerId: 'provider-test',
    timestamp: new Date().toISOString(),
    sectionDiffs: overrides.map(o => ({
      section: 'assessment' as const,
      originalText: o.aiTerm,
      editedText: o.physicianTerm,
      wordCountDelta: 0,
      addedPhrases: [o.physicianTerm],
      removedPhrases: [o.aiTerm],
      terminologyReplacements: [{ aiTerm: o.aiTerm, physicianTerm: o.physicianTerm }],
      wasModified: true,
    })),
    overallVerbosityDelta,
    sectionsModified: (overrides.length > 0 ? ['assessment'] : []) as SOAPEditAnalysis['sectionsModified'],
    sectionsExpanded: (overallVerbosityDelta > 0 ? ['assessment'] : []) as SOAPEditAnalysis['sectionsExpanded'],
    sectionsCondensed: (overallVerbosityDelta < 0 ? ['assessment'] : []) as SOAPEditAnalysis['sectionsCondensed'],
    totalTerminologyReplacements: overrides.length,
  };
}

interface MockProfileRow {
  verbosity_score: number;
  overrides?: Array<{ aiTerm: string; physicianPreferred: string }>;
  sessions?: number;
}

function mockExistingProfile({ verbosity_score, overrides = [], sessions = 5 }: MockProfileRow) {
  const label = verbosity_score < -15 ? 'terse' : verbosity_score > 15 ? 'verbose' : 'moderate';
  mockMaybeSingle.mockResolvedValueOnce({
    data: {
      provider_id: 'provider-test',
      preferred_verbosity: label,
      verbosity_score,
      section_emphasis: { subjective: 0, objective: 0, assessment: 0, plan: 0, hpi: 0, ros: 0 },
      terminology_overrides: overrides.map(o => ({
        ...o,
        frequency: 1,
        lastSeen: new Date().toISOString(),
      })),
      avg_note_word_count: 100,
      avg_edit_time_seconds: 0,
      specialty_detected: null,
      sessions_analyzed: sessions,
      last_analyzed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    error: null,
  });
}

function mockNoProfile() {
  mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
}

// ============================================================================
// TESTS
// ============================================================================

describe('physicianStyleProfiler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockUpsert.mockResolvedValue({ error: null });
  });

  describe('Verbosity classification from EMA score', () => {
    it('classifies as verbose when accumulated score exceeds +15', async () => {
      // prevScore=18, delta=5 → EMA: 0.2*5 + 0.8*18 = 1 + 14.4 = 15.4 → verbose
      mockExistingProfile({ verbosity_score: 18 });

      const result = await updateStyleProfile('provider-test', makeEditAnalysis(5));

      expect(result).not.toBeNull();
      expect(result?.preferredVerbosity).toBe('verbose');
      expect(result?.verbosityScore).toBeGreaterThan(15);
    });

    it('classifies as terse when accumulated score falls below -15', async () => {
      // prevScore=-18, delta=-5 → EMA: 0.2*(-5) + 0.8*(-18) = -1 + (-14.4) = -15.4 → terse
      mockExistingProfile({ verbosity_score: -18 });

      const result = await updateStyleProfile('provider-test', makeEditAnalysis(-5));

      expect(result).not.toBeNull();
      expect(result?.preferredVerbosity).toBe('terse');
      expect(result?.verbosityScore).toBeLessThan(-15);
    });

    it('classifies as moderate when score stays within [-15, +15]', async () => {
      // No existing profile, delta=3 → EMA: 0.2*3 + 0.8*0 = 0.6 → moderate
      mockNoProfile();

      const result = await updateStyleProfile('provider-test', makeEditAnalysis(3));

      expect(result).not.toBeNull();
      expect(result?.preferredVerbosity).toBe('moderate');
    });
  });

  describe('EMA verbosity score computation (alpha = 0.2)', () => {
    it('applies 20% weight to new value and 80% to existing score', async () => {
      // prevScore=10, delta=30 → 0.2*30 + 0.8*10 = 6 + 8 = 14
      mockExistingProfile({ verbosity_score: 10 });

      const result = await updateStyleProfile('provider-test', makeEditAnalysis(30));

      expect(result?.verbosityScore).toBeCloseTo(14, 5);
    });

    it('initializes score from first-session delta when no profile exists', async () => {
      // No existing profile → prev=0, delta=20 → 0.2*20 + 0.8*0 = 4
      mockNoProfile();

      const result = await updateStyleProfile('provider-test', makeEditAnalysis(20));

      expect(result?.verbosityScore).toBeCloseTo(4, 5);
      expect(result?.sessionsAnalyzed).toBe(1);
    });
  });

  describe('Terminology override merging', () => {
    it('adds a new override when the aiTerm/physicianTerm pair is unseen', async () => {
      mockNoProfile();

      const result = await updateStyleProfile(
        'provider-test',
        makeEditAnalysis(0, [{ aiTerm: 'hypertension', physicianTerm: 'HTN' }])
      );

      expect(result?.terminologyOverrides).toHaveLength(1);
      expect(result?.terminologyOverrides[0].aiTerm).toBe('hypertension');
      expect(result?.terminologyOverrides[0].physicianPreferred).toBe('HTN');
      expect(result?.terminologyOverrides[0].frequency).toBe(1);
    });

    it('increments frequency when the same pair appears again', async () => {
      mockExistingProfile({
        verbosity_score: 0,
        overrides: [{ aiTerm: 'hypertension', physicianPreferred: 'HTN' }],
      });

      const result = await updateStyleProfile(
        'provider-test',
        makeEditAnalysis(0, [{ aiTerm: 'hypertension', physicianTerm: 'HTN' }])
      );

      const override = result?.terminologyOverrides.find(o => o.aiTerm === 'hypertension');
      expect(override?.frequency).toBe(2);
    });
  });

  describe('Specialty detection from terminology keywords', () => {
    it('detects cardiology when multiple cardiology keywords appear in overrides', async () => {
      // detectSpecialty requires: overrides.length >= 5 AND >= 3 keyword matches
      mockNoProfile();

      const result = await updateStyleProfile(
        'provider-test',
        makeEditAnalysis(0, [
          { aiTerm: 'irregular heartbeat', physicianTerm: 'afib' },
          { aiTerm: 'heart attack', physicianTerm: 'mi' },
          { aiTerm: 'high blood pressure', physicianTerm: 'htn' },
          { aiTerm: 'cardiac catheterization', physicianTerm: 'cath' },
          { aiTerm: 'heart sounds abnormal', physicianTerm: 'murmur' },
        ])
      );

      expect(result?.specialtyDetected).toBe('cardiology');
    });

    it('returns null specialty when fewer than 5 overrides exist', async () => {
      mockNoProfile();

      const result = await updateStyleProfile(
        'provider-test',
        makeEditAnalysis(0, [{ aiTerm: 'htn term', physicianTerm: 'HTN' }])
      );

      expect(result?.specialtyDetected).toBeNull();
    });
  });

  describe('Session tracking', () => {
    it('increments sessionsAnalyzed by 1 on each update', async () => {
      mockExistingProfile({ verbosity_score: 0, sessions: 5 });

      const result = await updateStyleProfile('provider-test', makeEditAnalysis(0));

      expect(result?.sessionsAnalyzed).toBe(6);
    });

    it('starts at 1 for a brand-new provider', async () => {
      mockNoProfile();

      const result = await updateStyleProfile('provider-test', makeEditAnalysis(0));

      expect(result?.sessionsAnalyzed).toBe(1);
    });
  });

  describe('Constants', () => {
    it('exports MIN_SESSIONS_FOR_DISPLAY = 3', () => {
      expect(MIN_SESSIONS_FOR_DISPLAY).toBe(3);
    });
  });
});
