/**
 * Cultural Competency MCP Server — Behavioral Tests
 *
 * Tests the population profile data structures, tool handler logic,
 * and cultural context retrieval. Validates clinical accuracy of
 * profile data and handler edge cases.
 *
 * Session 1: Veterans, Unhoused, Latino, Black/AA (4 profiles)
 * Session 2: Remaining 4 profiles + AI skill integration
 */

import { describe, it, expect } from 'vitest';
import { PROFILES, resolveProfile } from './culturalCompetencyFixtures';

describe('Cultural Competency MCP Server', () => {
  // ---------------------------------------------------
  // Profile Data Structure Validation
  // ---------------------------------------------------
  describe('Profile data structure', () => {
    it.each(Object.keys(PROFILES))('profile "%s" has all required sections', (key) => {
      const profile = PROFILES[key];
      expect(profile.populationKey).toBeTruthy();
      expect(profile.displayName).toBeTruthy();
      expect(profile.description).toBeTruthy();
      expect(profile.caveat).toBeTruthy();
      expect(profile.communication).toBeDefined();
      expect(profile.communication.languagePreferences.length).toBeGreaterThan(0);
      expect(profile.communication.keyPhrases.length).toBeGreaterThan(0);
      expect(profile.communication.avoidPhrases.length).toBeGreaterThan(0);
      expect(profile.clinicalConsiderations.length).toBeGreaterThan(0);
      expect(profile.barriers.length).toBeGreaterThan(0);
      expect(profile.trustFactors.length).toBeGreaterThan(0);
      expect(profile.sdohCodes.length).toBeGreaterThan(0);
      expect(profile.culturalRemedies.length).toBeGreaterThan(0);
    });

    it('every clinical consideration has prevalence data and screening recommendation', () => {
      for (const profile of Object.values(PROFILES)) {
        for (const cc of profile.clinicalConsiderations) {
          expect(cc.condition).toBeTruthy();
          expect(cc.prevalence).toBeTruthy();
          expect(cc.screeningRecommendation).toBeTruthy();
          expect(cc.clinicalNote).toBeTruthy();
        }
      }
    });

    it('every barrier has impact and mitigation', () => {
      for (const profile of Object.values(PROFILES)) {
        for (const barrier of profile.barriers) {
          expect(barrier.barrier).toBeTruthy();
          expect(barrier.impact).toBeTruthy();
          expect(barrier.mitigation).toBeTruthy();
        }
      }
    });

    it('every SDOH code is a valid ICD-10 Z-code format', () => {
      const zCodePattern = /^Z\d{2}(\.\d{1,2})?$/;
      for (const profile of Object.values(PROFILES)) {
        for (const code of profile.sdohCodes) {
          expect(code.code).toMatch(zCodePattern);
          expect(code.description).toBeTruthy();
        }
      }
    });

    it('every cultural remedy has a warning level', () => {
      const validLevels = ['info', 'caution', 'warning'];
      for (const profile of Object.values(PROFILES)) {
        for (const remedy of profile.culturalRemedies) {
          expect(validLevels).toContain(remedy.warningLevel);
          expect(remedy.potentialInteractions.length).toBeGreaterThan(0);
        }
      }
    });

    it('every profile includes a caveat against stereotyping', () => {
      for (const profile of Object.values(PROFILES)) {
        expect(profile.caveat.length).toBeGreaterThanOrEqual(30);
      }
    });
  });

  // ---------------------------------------------------
  // Tool Handler: get_cultural_context
  // ---------------------------------------------------
  describe('get_cultural_context', () => {
    it('returns full profile for valid population', () => {
      const profile = resolveProfile('veterans');
      expect(profile).not.toBeNull();
      expect(profile?.populationKey).toBe('veterans');
      expect(profile?.displayName).toContain('Veterans');
    });

    it('returns null for unknown population', () => {
      const profile = resolveProfile('martians');
      expect(profile).toBeNull();
    });

    it('normalizes population key with spaces and hyphens', () => {
      const byUnderscore = resolveProfile('black_aa');
      const byHyphen = resolveProfile('black-aa');
      const bySpace = resolveProfile('black aa');
      expect(byUnderscore).not.toBeNull();
      expect(byHyphen).not.toBeNull();
      expect(bySpace).not.toBeNull();
      expect(byUnderscore?.populationKey).toBe(byHyphen?.populationKey);
    });

    it('is case-insensitive', () => {
      const lower = resolveProfile('veterans');
      const upper = resolveProfile('VETERANS');
      const mixed = resolveProfile('Veterans');
      expect(lower).not.toBeNull();
      expect(upper).not.toBeNull();
      expect(mixed).not.toBeNull();
    });
  });

  // ---------------------------------------------------
  // Tool Handler: get_communication_guidance
  // ---------------------------------------------------
  describe('get_communication_guidance', () => {
    it('returns context-specific guidance when context is provided', () => {
      const profile = resolveProfile('veterans');
      expect(profile).not.toBeNull();
      const medicationGuidance = profile?.communication.contextSpecific.medication;
      expect(medicationGuidance).toBeTruthy();
      expect(medicationGuidance).toContain('medication');
    });

    it('returns general guidance fields for all populations', () => {
      for (const profile of Object.values(PROFILES)) {
        expect(profile.communication.formalityLevel).toMatch(/^(formal|moderate|informal)$/);
        expect(profile.communication.familyInvolvementNorm).toBeTruthy();
      }
    });

    it('formality levels match cultural expectations', () => {
      expect(PROFILES.veterans.communication.formalityLevel).toBe('moderate');
      expect(PROFILES.unhoused.communication.formalityLevel).toBe('informal');
      expect(PROFILES.latino.communication.formalityLevel).toBe('formal');
      expect(PROFILES.black_aa.communication.formalityLevel).toBe('moderate');
    });
  });

  // ---------------------------------------------------
  // Tool Handler: get_clinical_considerations
  // ---------------------------------------------------
  describe('get_clinical_considerations', () => {
    it('returns all considerations when no filter', () => {
      const profile = resolveProfile('veterans');
      expect(profile?.clinicalConsiderations.length).toBeGreaterThanOrEqual(3);
    });

    it('filters by condition keyword', () => {
      const profile = resolveProfile('veterans');
      const ptsd = profile?.clinicalConsiderations.filter((cc) =>
        cc.condition.toLowerCase().includes('ptsd')
      );
      expect(ptsd?.length).toBeGreaterThanOrEqual(1);
    });

    it('veterans profile includes PTSD, TBI, and toxic exposure screenings', () => {
      const conditions = PROFILES.veterans.clinicalConsiderations.map((cc) => cc.condition);
      expect(conditions.some((c) => c.includes('PTSD'))).toBe(true);
      expect(conditions.some((c) => c.includes('TBI'))).toBe(true);
      expect(conditions.some((c) => c.includes('Toxic'))).toBe(true);
    });

    it('Black/AA profile includes hypertension, sickle cell, and maternal mortality', () => {
      const conditions = PROFILES.black_aa.clinicalConsiderations.map((cc) => cc.condition);
      expect(conditions.some((c) => c.includes('Hypertension'))).toBe(true);
      expect(conditions.some((c) => c.includes('Sickle Cell'))).toBe(true);
      expect(conditions.some((c) => c.includes('Maternal Mortality'))).toBe(true);
    });

    it('unhoused profile includes foot conditions and respiratory illness', () => {
      const conditions = PROFILES.unhoused.clinicalConsiderations.map((cc) => cc.condition);
      expect(conditions.some((c) => c.includes('Foot'))).toBe(true);
      expect(conditions.some((c) => c.includes('Respiratory'))).toBe(true);
    });

    it('Latino profile includes diabetes screening', () => {
      const conditions = PROFILES.latino.clinicalConsiderations.map((cc) => cc.condition);
      expect(conditions.some((c) => c.includes('Diabetes'))).toBe(true);
    });
  });

  // ---------------------------------------------------
  // Tool Handler: get_barriers_to_care
  // ---------------------------------------------------
  describe('get_barriers_to_care', () => {
    it('unhoused profile addresses medication storage barriers', () => {
      const refrigerationBarrier = PROFILES.unhoused.barriers.find(
        (b) => b.barrier.toLowerCase().includes('refrigeration')
      );
      expect(refrigerationBarrier).toBeDefined();
      expect(refrigerationBarrier?.mitigation).toContain('room-temperature');
    });

    it('Latino profile addresses language and immigration barriers', () => {
      const langBarrier = PROFILES.latino.barriers.find(
        (b) => b.barrier.toLowerCase().includes('language')
      );
      const immigrationBarrier = PROFILES.latino.barriers.find(
        (b) => b.barrier.toLowerCase().includes('immigration')
      );
      expect(langBarrier).toBeDefined();
      expect(immigrationBarrier).toBeDefined();
    });

    it('Black/AA profile addresses medical mistrust', () => {
      const mistrustBarrier = PROFILES.black_aa.barriers.find(
        (b) => b.barrier.toLowerCase().includes('mistrust')
      );
      expect(mistrustBarrier).toBeDefined();
    });

    it('veteran profile addresses stigma barrier with delay quantification', () => {
      const stigmaBarrier = PROFILES.veterans.barriers.find(
        (b) => b.barrier.toLowerCase().includes('stigma')
      );
      expect(stigmaBarrier).toBeDefined();
      expect(stigmaBarrier?.impact).toContain('6-8 years');
    });
  });

  // ---------------------------------------------------
  // Tool Handler: get_sdoh_codes
  // ---------------------------------------------------
  describe('get_sdoh_codes', () => {
    it('unhoused profile includes Z59.00 (homelessness)', () => {
      const codes = PROFILES.unhoused.sdohCodes.map((c) => c.code);
      expect(codes).toContain('Z59.00');
    });

    it('veterans profile includes Z91.82 (military deployment)', () => {
      const codes = PROFILES.veterans.sdohCodes.map((c) => c.code);
      expect(codes).toContain('Z91.82');
    });

    it('unhoused profile distinguishes sheltered vs unsheltered', () => {
      const codes = PROFILES.unhoused.sdohCodes.map((c) => c.code);
      expect(codes).toContain('Z59.01');
      expect(codes).toContain('Z59.02');
    });
  });

  // ---------------------------------------------------
  // Tool Handler: check_drug_interaction_cultural
  // ---------------------------------------------------
  describe('check_drug_interaction_cultural', () => {
    it('veteran remedies include kratom with warning level', () => {
      const kratom = PROFILES.veterans.culturalRemedies.find(
        (r) => r.remedy.toLowerCase().includes('kratom')
      );
      expect(kratom).toBeDefined();
      expect(kratom?.warningLevel).toBe('warning');
      expect(kratom?.potentialInteractions.some((i) => i.toLowerCase().includes('opioid'))).toBe(true);
    });

    it('Latino remedies include ruda with abortifacient warning', () => {
      const ruda = PROFILES.latino.culturalRemedies.find(
        (r) => r.remedy.toLowerCase().includes('ruda')
      );
      expect(ruda).toBeDefined();
      expect(ruda?.warningLevel).toBe('warning');
      expect(ruda?.potentialInteractions.some((i) => i.includes('ABORTIFACIENT'))).toBe(true);
    });

    it('unhoused remedies flag alcohol self-medication', () => {
      const alcohol = PROFILES.unhoused.culturalRemedies.find(
        (r) => r.remedy.toLowerCase().includes('alcohol')
      );
      expect(alcohol).toBeDefined();
      expect(alcohol?.warningLevel).toBe('warning');
    });

    it('Black/AA remedies include castor oil with caution level', () => {
      const castor = PROFILES.black_aa.culturalRemedies.find(
        (r) => r.remedy.toLowerCase().includes('castor')
      );
      expect(castor).toBeDefined();
      expect(castor?.warningLevel).toBe('caution');
    });

    it('chamomile tea has info level (low risk)', () => {
      const chamomile = PROFILES.latino.culturalRemedies.find(
        (r) => r.remedy.toLowerCase().includes('manzanilla')
      );
      expect(chamomile).toBeDefined();
      expect(chamomile?.warningLevel).toBe('info');
    });
  });

  // ---------------------------------------------------
  // Tool Handler: get_trust_building_guidance
  // ---------------------------------------------------
  describe('get_trust_building_guidance', () => {
    it('Black/AA profile references Tuskegee and Henrietta Lacks', () => {
      const factors = PROFILES.black_aa.trustFactors.map((tf) => tf.factor);
      expect(factors.some((f) => f.includes('Tuskegee'))).toBe(true);
      expect(factors.some((f) => f.includes('Henrietta Lacks'))).toBe(true);
    });

    it('veteran profile references VA scandals', () => {
      const factors = PROFILES.veterans.trustFactors.map((tf) => tf.factor);
      expect(factors.some((f) => f.includes('VA'))).toBe(true);
    });

    it('unhoused profile addresses institutional trauma', () => {
      const factors = PROFILES.unhoused.trustFactors.map((tf) => tf.factor);
      expect(factors.some((f) => f.includes('Institutional'))).toBe(true);
    });

    it('Latino profile addresses forced sterilization history', () => {
      const factors = PROFILES.latino.trustFactors.map((tf) => tf.factor);
      expect(factors.some((f) => f.includes('sterilization'))).toBe(true);
    });

    it('every trust factor includes a building strategy', () => {
      for (const profile of Object.values(PROFILES)) {
        for (const tf of profile.trustFactors) {
          expect(tf.trustBuildingStrategy).toBeTruthy();
          expect(tf.trustBuildingStrategy.length).toBeGreaterThan(10);
        }
      }
    });
  });

  // ---------------------------------------------------
  // Clinical Accuracy Checks
  // ---------------------------------------------------
  describe('Clinical accuracy', () => {
    it('hypertension note acknowledges evolving race-based prescribing guidelines', () => {
      const htn = PROFILES.black_aa.clinicalConsiderations.find(
        (cc) => cc.condition.includes('Hypertension')
      );
      expect(htn?.clinicalNote).toContain('no longer recommend race-based');
    });

    it('maternal mortality note states disparity persists across income levels', () => {
      const maternal = PROFILES.black_aa.clinicalConsiderations.find(
        (cc) => cc.condition.includes('Maternal Mortality')
      );
      expect(maternal?.clinicalNote).toContain('ALL income and education levels');
    });

    it('sickle cell note addresses undertreated pain', () => {
      const scd = PROFILES.black_aa.clinicalConsiderations.find(
        (cc) => cc.condition.includes('Sickle Cell')
      );
      expect(scd?.clinicalNote).toContain('undertreated');
    });

    it('PTSD screening uses PC-PTSD-5 (current validated tool)', () => {
      const ptsd = PROFILES.veterans.clinicalConsiderations.find(
        (cc) => cc.condition.includes('PTSD')
      );
      expect(ptsd?.screeningRecommendation).toContain('PC-PTSD-5');
    });

    it('TB screening for unhoused uses IGRA (preferred over TST)', () => {
      const tb = PROFILES.unhoused.clinicalConsiderations.find(
        (cc) => cc.condition.includes('Respiratory')
      );
      expect(tb?.screeningRecommendation).toContain('IGRA');
    });
  });

  // ---------------------------------------------------
  // Anti-Stereotyping Safeguards
  // ---------------------------------------------------
  describe('Anti-stereotyping safeguards', () => {
    it('every profile has a non-trivial caveat warning against assumptions', () => {
      for (const profile of Object.values(PROFILES)) {
        expect(profile.caveat.length).toBeGreaterThanOrEqual(30);
        const lowerCaveat = profile.caveat.toLowerCase();
        const hasWarning =
          lowerCaveat.includes('not') ||
          lowerCaveat.includes('avoid') ||
          lowerCaveat.includes('varies') ||
          lowerCaveat.includes('ask');
        expect(hasWarning).toBe(true);
      }
    });

    it('avoid phrases prevent harmful communication', () => {
      expect(PROFILES.veterans.communication.avoidPhrases.some(
        (p) => p.toLowerCase().includes('kill')
      )).toBe(true);

      expect(PROFILES.latino.communication.avoidPhrases.some(
        (p) => p.toLowerCase().includes('legal') || p.toLowerCase().includes('papers')
      )).toBe(true);

      expect(PROFILES.black_aa.communication.avoidPhrases.some(
        (p) => p.toLowerCase().includes('you people')
      )).toBe(true);

      expect(PROFILES.unhoused.communication.avoidPhrases.some(
        (p) => p.toLowerCase().includes('non-compliant') || p.toLowerCase().includes('compliant')
      )).toBe(true);
    });
  });
});
