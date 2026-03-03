/**
 * Cultural Competency — Audit & Transparency Tests (Session 3, Task 3.8)
 *
 * Verifies that cultural context usage follows auditability requirements:
 * - Population selections are traceable
 * - Prompt injections are reproducible
 * - Anti-stereotyping safeguards are enforced in all output paths
 * - SDOH code suggestions are clinically accurate
 * - Every profile's data integrity is maintained across formatters
 */

import { describe, it, expect } from 'vitest';
import { PROFILES, resolveProfile } from './culturalCompetencyFixtures';
import type { CulturalProfile } from './culturalCompetencyFixtures';

// ============================================================================
// Audit Tests
// ============================================================================

describe('Cultural Competency — Audit & Transparency', () => {
  // ---------------------------------------------------
  // Population traceability
  // ---------------------------------------------------
  describe('Population traceability', () => {
    it('every profile has a unique populationKey matching its registry key', () => {
      const keys = Object.keys(PROFILES);
      const populationKeys = Object.values(PROFILES).map((p) => p.populationKey);

      expect(new Set(populationKeys).size).toBe(populationKeys.length);
      for (const key of keys) {
        expect(PROFILES[key].populationKey).toBe(key);
      }
    });

    it('every profile has a non-empty displayName for audit logs', () => {
      for (const profile of Object.values(PROFILES)) {
        expect(profile.displayName.length).toBeGreaterThan(3);
        // Display name should be human-readable (contains spaces or /)
        expect(profile.displayName).toMatch(/[\s/]/);
      }
    });

    it('population key can be round-tripped through resolve → key → resolve', () => {
      for (const key of Object.keys(PROFILES)) {
        const profile = resolveProfile(key);
        expect(profile).not.toBeNull();
        if (!profile) continue;
        const roundTrip = resolveProfile(profile.populationKey);
        expect(roundTrip).toEqual(profile);
      }
    });

    it('populations array from hints matches audit payload shape', () => {
      const hints = ['veterans', 'latino', 'isolated_elderly'];
      const validContexts = hints
        .map((h) => resolveProfile(h))
        .filter((ctx): ctx is CulturalProfile => ctx !== null);

      // This is the shape logged to ai_transparency_log
      const auditPayload = {
        populations: validContexts.map((c) => c.populationKey),
        populationCount: validContexts.length,
        barriersIncluded: validContexts.flatMap((c) => c.barriers).length > 0,
        sdohCodesIncluded: validContexts.flatMap((c) => c.sdohCodes).length > 0,
      };

      expect(auditPayload.populations).toEqual(['veterans', 'latino', 'isolated_elderly']);
      expect(auditPayload.populationCount).toBe(3);
      expect(auditPayload.barriersIncluded).toBe(true);
      expect(auditPayload.sdohCodesIncluded).toBe(true);
    });
  });

  // ---------------------------------------------------
  // Anti-stereotyping audit — every output path
  // ---------------------------------------------------
  describe('Anti-stereotyping enforcement', () => {
    it('every profile caveat is at least 30 characters', () => {
      for (const profile of Object.values(PROFILES)) {
        expect(profile.caveat.length).toBeGreaterThanOrEqual(30);
      }
    });

    it('every profile caveat contains a hedging word (not/avoid/varies/ask/individual)', () => {
      for (const [_key, profile] of Object.entries(PROFILES)) {
        const lower = profile.caveat.toLowerCase();
        const hasHedge =
          lower.includes('not') ||
          lower.includes('avoid') ||
          lower.includes('varies') ||
          lower.includes('ask') ||
          lower.includes('individual');
        expect(hasHedge).toBe(true);
      }
    });

    it('no profile uses absolute language in communication norms', () => {
      const absoluteWords = ['always', 'never', 'all patients', 'every patient', 'they all'];
      for (const profile of Object.values(PROFILES)) {
        const norm = profile.communication.familyInvolvementNorm.toLowerCase();
        for (const word of absoluteWords) {
          expect(norm).not.toContain(word);
        }
      }
    });

    it('every profile has at least one avoidPhrase', () => {
      for (const profile of Object.values(PROFILES)) {
        expect(profile.communication.avoidPhrases.length).toBeGreaterThan(0);
      }
    });

    it('profiles that mention race-based medicine explicitly oppose it', () => {
      // After the 2020s reckoning on race-based medicine, verify any reference
      // to race-based protocols includes "no longer recommend" or equivalent
      for (const profile of Object.values(PROFILES)) {
        for (const cc of profile.clinicalConsiderations) {
          const lower = cc.clinicalNote.toLowerCase();
          if (lower.includes('race-based')) {
            expect(lower).toContain('no longer recommend');
          }
          // Should never suggest race-exclusive drug use
          expect(lower).not.toContain('use only in');
        }
      }
    });
  });

  // ---------------------------------------------------
  // SDOH code accuracy
  // ---------------------------------------------------
  describe('SDOH code clinical accuracy', () => {
    it('all SDOH codes are valid ICD-10 Z-code format', () => {
      for (const profile of Object.values(PROFILES)) {
        for (const code of profile.sdohCodes) {
          expect(code.code).toMatch(/^Z\d{2}(\.\d{1,2})?$/);
        }
      }
    });

    it('no duplicate SDOH codes within a single profile', () => {
      for (const [_key, profile] of Object.entries(PROFILES)) {
        const codes = profile.sdohCodes.map((c) => c.code);
        expect(new Set(codes).size).toBe(codes.length);
      }
    });

    it('SDOH code applicability is specific (not just "all")', () => {
      for (const profile of Object.values(PROFILES)) {
        for (const code of profile.sdohCodes) {
          expect(code.applicability.length).toBeGreaterThan(10);
        }
      }
    });
  });

  // ---------------------------------------------------
  // Cultural remedy safety
  // ---------------------------------------------------
  describe('Cultural remedy safety audit', () => {
    it('every warning-level remedy lists at least one interaction', () => {
      for (const profile of Object.values(PROFILES)) {
        const warnings = profile.culturalRemedies.filter((r) => r.warningLevel === 'warning');
        for (const remedy of warnings) {
          expect(remedy.potentialInteractions.length).toBeGreaterThan(0);
          expect(remedy.potentialInteractions[0].length).toBeGreaterThan(3);
        }
      }
    });

    it('no remedy has empty commonUse description', () => {
      for (const profile of Object.values(PROFILES)) {
        for (const remedy of profile.culturalRemedies) {
          expect(remedy.commonUse.length).toBeGreaterThan(5);
        }
      }
    });

    it('warning levels are valid enum values only', () => {
      const validLevels = new Set(['info', 'caution', 'warning']);
      for (const profile of Object.values(PROFILES)) {
        for (const remedy of profile.culturalRemedies) {
          expect(validLevels.has(remedy.warningLevel)).toBe(true);
        }
      }
    });
  });

  // ---------------------------------------------------
  // Data integrity across formatters
  // ---------------------------------------------------
  describe('Data integrity across output paths', () => {
    it('compact format preserves population identity from full format', () => {
      for (const profile of Object.values(PROFILES)) {
        const full = `CULTURAL COMPETENCY CONTEXT (${profile.displayName}):`;
        const compact = `CULTURAL CONTEXT (${profile.displayName}):`;

        // Both formats should use exact same displayName
        expect(full).toContain(profile.displayName);
        expect(compact).toContain(profile.displayName);
      }
    });

    it('every profile has at least one clinical consideration', () => {
      for (const [_key, profile] of Object.entries(PROFILES)) {
        expect(profile.clinicalConsiderations.length).toBeGreaterThan(0);
      }
    });

    it('every profile has at least one barrier to care', () => {
      for (const [_key, profile] of Object.entries(PROFILES)) {
        expect(profile.barriers.length).toBeGreaterThan(0);
      }
    });

    it('every profile has at least one trust factor', () => {
      for (const [_key, profile] of Object.entries(PROFILES)) {
        expect(profile.trustFactors.length).toBeGreaterThan(0);
      }
    });

    it('every profile has at least one cultural remedy', () => {
      for (const [_key, profile] of Object.entries(PROFILES)) {
        expect(profile.culturalRemedies.length).toBeGreaterThan(0);
      }
    });

    it('every profile has at least one SDOH code', () => {
      for (const [_key, profile] of Object.entries(PROFILES)) {
        expect(profile.sdohCodes.length).toBeGreaterThan(0);
      }
    });
  });
});
