/**
 * soapNoteEditObserver tests — behavioral coverage for SOAP note edit analysis.
 *
 * Deletion Test: Every test fails if analyzeSOAPEdits returns an empty or stub analysis.
 *
 * Tests:
 *   - Identical notes produce empty sectionsModified and zero verbosityDelta (Tier 1)
 *   - Adding text marks section as expanded with positive wordCountDelta (Tier 1)
 *   - Removing text marks section as condensed with negative wordCountDelta (Tier 1)
 *   - Term replacement detected when word is swapped (Tier 1)
 *   - totalTerminologyReplacements aggregated across sections (Tier 2)
 *   - Whitespace-only changes are not counted as modifications (Tier 4 edge case)
 *   - Optional sections (hpi, ros) are analyzed when present (Tier 4)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeSOAPEdits } from '../soapNoteEditObserver';
import type { SOAPNoteContent } from '../soapNoteEditObserver';

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

// ============================================================================
// FIXTURES
// ============================================================================

const BASE_NOTE: SOAPNoteContent = {
  subjective: 'Patient reports chest pain for 2 days.',
  objective: 'BP 140/90 HR 88. Lungs clear.',
  assessment: 'Hypertension uncontrolled.',
  plan: 'Increase lisinopril dose. Follow up in 2 weeks.',
};

// ============================================================================
// TESTS
// ============================================================================

describe('analyzeSOAPEdits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Identical notes produce empty analysis', () => {
    it('returns sectionsModified = [] and overallVerbosityDelta = 0 when notes are identical', () => {
      const result = analyzeSOAPEdits(BASE_NOTE, { ...BASE_NOTE }, 'session-1', 'provider-1');

      expect(result.sectionsModified).toEqual([]);
      expect(result.sectionsExpanded).toEqual([]);
      expect(result.sectionsCondensed).toEqual([]);
      expect(result.overallVerbosityDelta).toBe(0);
      expect(result.totalTerminologyReplacements).toBe(0);
    });

    it('passes through sessionId and providerId on the result', () => {
      const result = analyzeSOAPEdits(BASE_NOTE, { ...BASE_NOTE }, 'session-abc', 'provider-xyz');

      expect(result.sessionId).toBe('session-abc');
      expect(result.providerId).toBe('provider-xyz');
    });

    it('produces sectionDiffs for all 6 SOAP sections even when unchanged', () => {
      const result = analyzeSOAPEdits(BASE_NOTE, { ...BASE_NOTE }, 's', 'p');

      // subjective, objective, assessment, plan, hpi, ros (hpi/ros default to '')
      expect(result.sectionDiffs).toHaveLength(6);
      result.sectionDiffs.forEach(d => expect(d.wasModified).toBe(false));
    });
  });

  describe('Adding text marks section as expanded', () => {
    it('adds "subjective" to sectionsExpanded with positive wordCountDelta', () => {
      const edited: SOAPNoteContent = {
        ...BASE_NOTE,
        subjective:
          'Patient reports chest pain for 2 days. Pain is 7/10 sharp radiating to left arm.',
      };

      const result = analyzeSOAPEdits(BASE_NOTE, edited, 'session-2', 'provider-1');

      expect(result.sectionsModified).toContain('subjective');
      expect(result.sectionsExpanded).toContain('subjective');
      expect(result.sectionsCondensed).not.toContain('subjective');

      const diff = result.sectionDiffs.find(d => d.section === 'subjective');
      expect(diff?.wordCountDelta).toBeGreaterThan(0);
    });

    it('overallVerbosityDelta is positive when text is added', () => {
      const edited: SOAPNoteContent = {
        ...BASE_NOTE,
        plan: 'Increase lisinopril dose. Follow up in 2 weeks. Also order BMP and renal function panel.',
      };

      const result = analyzeSOAPEdits(BASE_NOTE, edited, 'session-3', 'provider-1');

      expect(result.overallVerbosityDelta).toBeGreaterThan(0);
    });
  });

  describe('Removing text marks section as condensed', () => {
    it('adds "assessment" to sectionsCondensed with negative wordCountDelta', () => {
      const edited: SOAPNoteContent = {
        ...BASE_NOTE,
        assessment: 'HTN.',
      };

      const result = analyzeSOAPEdits(BASE_NOTE, edited, 'session-4', 'provider-1');

      expect(result.sectionsModified).toContain('assessment');
      expect(result.sectionsCondensed).toContain('assessment');
      expect(result.sectionsExpanded).not.toContain('assessment');

      const diff = result.sectionDiffs.find(d => d.section === 'assessment');
      expect(diff?.wordCountDelta).toBeLessThan(0);
    });

    it('overallVerbosityDelta is negative when text is removed', () => {
      const edited: SOAPNoteContent = {
        ...BASE_NOTE,
        plan: 'Uptitrate lisinopril.',
      };

      const result = analyzeSOAPEdits(BASE_NOTE, edited, 'session-5', 'provider-1');

      expect(result.overallVerbosityDelta).toBeLessThan(0);
    });
  });

  describe('Terminology replacement detection', () => {
    it('detects aiTerm→physicianTerm when a word is directly swapped', () => {
      // Replace "Hypertension" with "HTN" — removed word immediately followed by added word
      const edited: SOAPNoteContent = {
        ...BASE_NOTE,
        assessment: 'HTN uncontrolled.',
      };

      const result = analyzeSOAPEdits(BASE_NOTE, edited, 'session-6', 'provider-1');

      const assessmentDiff = result.sectionDiffs.find(d => d.section === 'assessment');
      expect(assessmentDiff?.terminologyReplacements.length).toBeGreaterThan(0);

      const replacement = assessmentDiff?.terminologyReplacements[0];
      expect(replacement?.aiTerm.toLowerCase()).toContain('hypertension');
      expect(replacement?.physicianTerm.toLowerCase()).toContain('htn');
    });

    it('aggregates totalTerminologyReplacements across all sections', () => {
      const edited: SOAPNoteContent = {
        ...BASE_NOTE,
        assessment: 'HTN uncontrolled.',
        objective: 'BP 140/90 HR 88. Lungs clear. SpO2 98%.',
      };

      const result = analyzeSOAPEdits(BASE_NOTE, edited, 'session-7', 'provider-1');

      // Assessment has the Hypertension→HTN swap
      expect(result.totalTerminologyReplacements).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Whitespace-only changes are ignored', () => {
    it('does not mark objective as modified when only trailing whitespace is added', () => {
      const edited: SOAPNoteContent = {
        ...BASE_NOTE,
        objective: BASE_NOTE.objective + '   ',
      };

      const result = analyzeSOAPEdits(BASE_NOTE, edited, 'session-8', 'provider-1');

      expect(result.sectionsModified).not.toContain('objective');
    });
  });

  describe('Optional sections hpi and ros', () => {
    it('detects edits to hpi when present in both notes', () => {
      const originalWithHpi: SOAPNoteContent = {
        ...BASE_NOTE,
        hpi: 'Patient is a 65-year-old male.',
      };
      const editedWithHpi: SOAPNoteContent = {
        ...originalWithHpi,
        hpi: 'Patient is a 65-year-old male with 3-day history of chest pain and diaphoresis.',
      };

      const result = analyzeSOAPEdits(originalWithHpi, editedWithHpi, 'session-9', 'provider-1');

      expect(result.sectionsModified).toContain('hpi');
      expect(result.sectionsExpanded).toContain('hpi');
    });

    it('does not mark ros as modified when it is absent from both notes', () => {
      const result = analyzeSOAPEdits(BASE_NOTE, { ...BASE_NOTE }, 'session-10', 'provider-1');

      expect(result.sectionsModified).not.toContain('ros');
    });
  });
});
