/**
 * Cultural Competency MCP Server — Handler Tests (Session 1)
 *
 * Tests the population profile data structures, tool handler logic,
 * and cultural context retrieval for all 8 profiles.
 *
 * Session 2 tests (SDOH, drug interactions, trust, clinical accuracy,
 * anti-stereotyping, completeness) in culturalCompetencyMCPSession2.test.ts.
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

    it('isolated elderly profile includes falls, polypharmacy, and social isolation', () => {
      const conditions = PROFILES.isolated_elderly.clinicalConsiderations.map((cc) => cc.condition);
      expect(conditions.some((c) => c.includes('Falls'))).toBe(true);
      expect(conditions.some((c) => c.includes('Polypharmacy'))).toBe(true);
      expect(conditions.some((c) => c.includes('Social Isolation'))).toBe(true);
    });

    it('indigenous profile includes diabetes as highest-rate population', () => {
      const diabetes = PROFILES.indigenous.clinicalConsiderations.find(
        (cc) => cc.condition.includes('Diabetes')
      );
      expect(diabetes).toBeDefined();
      expect(diabetes?.prevalence).toContain('2.5x');
    });

    it('indigenous profile includes suicide risk for youth', () => {
      const suicide = PROFILES.indigenous.clinicalConsiderations.find(
        (cc) => cc.condition.includes('Suicide')
      );
      expect(suicide).toBeDefined();
      expect(suicide?.prevalence).toContain('highest');
    });

    it('immigrant/refugee profile includes infectious disease screening and PTSD', () => {
      const conditions = PROFILES.immigrant_refugee.clinicalConsiderations.map((cc) => cc.condition);
      expect(conditions.some((c) => c.includes('Infectious') || c.includes('disease'))).toBe(true);
      expect(conditions.some((c) => c.includes('PTSD') || c.includes('Trauma'))).toBe(true);
    });

    it('LGBTQ+ elderly profile includes HIV long-term survivors and transgender aging', () => {
      const conditions = PROFILES.lgbtq_elderly.clinicalConsiderations.map((cc) => cc.condition);
      expect(conditions.some((c) => c.includes('HIV'))).toBe(true);
      expect(conditions.some((c) => c.toLowerCase().includes('transgender'))).toBe(true);
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

    it('isolated elderly addresses technology barriers', () => {
      const techBarrier = PROFILES.isolated_elderly.barriers.find(
        (b) => b.barrier.toLowerCase().includes('technology')
      );
      expect(techBarrier).toBeDefined();
      expect(techBarrier?.mitigation).toContain('Phone');
    });

    it('indigenous profile addresses IHS funding gap', () => {
      const fundingBarrier = PROFILES.indigenous.barriers.find(
        (b) => b.barrier.toLowerCase().includes('ihs') || b.barrier.toLowerCase().includes('funding')
      );
      expect(fundingBarrier).toBeDefined();
    });

    it('immigrant/refugee profile addresses language and fear barriers', () => {
      const langBarrier = PROFILES.immigrant_refugee.barriers.find(
        (b) => b.barrier.toLowerCase().includes('language')
      );
      const fearBarrier = PROFILES.immigrant_refugee.barriers.find(
        (b) => b.barrier.toLowerCase().includes('fear') || b.barrier.toLowerCase().includes('immigration')
      );
      expect(langBarrier).toBeDefined();
      expect(fearBarrier).toBeDefined();
    });

    it('LGBTQ+ elderly addresses discrimination in healthcare and long-term care', () => {
      const healthcareBarrier = PROFILES.lgbtq_elderly.barriers.find(
        (b) => b.barrier.toLowerCase().includes('discrimination')
      );
      const ltcBarrier = PROFILES.lgbtq_elderly.barriers.find(
        (b) => b.barrier.toLowerCase().includes('long-term care')
      );
      expect(healthcareBarrier).toBeDefined();
      expect(ltcBarrier).toBeDefined();
    });
  });
});
