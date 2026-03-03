/**
 * Cultural Competency MCP Server — Session 2 Tests
 *
 * SDOH codes, drug interactions, trust factors, clinical accuracy,
 * anti-stereotyping safeguards, and 8-population completeness checks.
 *
 * Split from culturalCompetencyMCP.test.ts to stay under 600 lines.
 */

import { describe, it, expect } from 'vitest';
import { PROFILES, resolveProfile } from './culturalCompetencyFixtures';

describe('Cultural Competency MCP Server — Session 2', () => {
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

    it('isolated elderly includes Z60.2 (living alone) and Z74.2 (need for home assistance)', () => {
      const codes = PROFILES.isolated_elderly.sdohCodes.map((c) => c.code);
      expect(codes).toContain('Z60.2');
      expect(codes).toContain('Z74.2');
    });

    it('indigenous profile includes food insecurity Z-code', () => {
      const codes = PROFILES.indigenous.sdohCodes.map((c) => c.code);
      expect(codes).toContain('Z59.41');
    });

    it('immigrant/refugee includes acculturation difficulty', () => {
      const codes = PROFILES.immigrant_refugee.sdohCodes.map((c) => c.code);
      expect(codes).toContain('Z60.3');
    });

    it('LGBTQ+ elderly includes discrimination and living alone codes', () => {
      const codes = PROFILES.lgbtq_elderly.sdohCodes.map((c) => c.code);
      expect(codes).toContain('Z60.5');
      expect(codes).toContain('Z60.2');
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

    it('isolated elderly flags OTC medication accumulation as warning', () => {
      const otc = PROFILES.isolated_elderly.culturalRemedies.find(
        (r) => r.remedy.toLowerCase().includes('over-the-counter')
      );
      expect(otc).toBeDefined();
      expect(otc?.warningLevel).toBe('warning');
    });

    it('indigenous smudging is info level (generally safe)', () => {
      const smudging = PROFILES.indigenous.culturalRemedies.find(
        (r) => r.remedy.toLowerCase().includes('sage') || r.remedy.toLowerCase().includes('smudging')
      );
      expect(smudging).toBeDefined();
      expect(smudging?.warningLevel).toBe('info');
    });

    it('immigrant/refugee flags Ayurvedic heavy metal risk as warning', () => {
      const ayurvedic = PROFILES.immigrant_refugee.culturalRemedies.find(
        (r) => r.remedy.toLowerCase().includes('ayurvedic')
      );
      expect(ayurvedic).toBeDefined();
      expect(ayurvedic?.warningLevel).toBe('warning');
    });

    it('LGBTQ+ elderly flags poppers + PDE5 inhibitor as FATAL interaction', () => {
      const poppers = PROFILES.lgbtq_elderly.culturalRemedies.find(
        (r) => r.remedy.toLowerCase().includes('poppers')
      );
      expect(poppers).toBeDefined();
      expect(poppers?.warningLevel).toBe('warning');
      expect(poppers?.potentialInteractions.some((i) => i.includes('FATAL'))).toBe(true);
    });

    it('LGBTQ+ elderly flags unsupervised hormone therapy', () => {
      const hormones = PROFILES.lgbtq_elderly.culturalRemedies.find(
        (r) => r.remedy.toLowerCase().includes('hormone')
      );
      expect(hormones).toBeDefined();
      expect(hormones?.warningLevel).toBe('warning');
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

    it('isolated elderly addresses nursing home fears', () => {
      const factors = PROFILES.isolated_elderly.trustFactors.map((tf) => tf.factor);
      expect(factors.some((f) => f.toLowerCase().includes('nursing home'))).toBe(true);
    });

    it('indigenous profile addresses boarding school and forced sterilization', () => {
      const factors = PROFILES.indigenous.trustFactors.map((tf) => tf.factor);
      expect(factors.some((f) => f.toLowerCase().includes('boarding school'))).toBe(true);
      expect(factors.some((f) => f.toLowerCase().includes('sterilization'))).toBe(true);
    });

    it('immigrant/refugee addresses government persecution', () => {
      const factors = PROFILES.immigrant_refugee.trustFactors.map((tf) => tf.factor);
      expect(factors.some((f) => f.toLowerCase().includes('persecution') || f.toLowerCase().includes('government'))).toBe(true);
    });

    it('LGBTQ+ elderly references DSM classification and AIDS crisis', () => {
      const factors = PROFILES.lgbtq_elderly.trustFactors.map((tf) => tf.factor);
      expect(factors.some((f) => f.includes('DSM') || f.includes('mental illness'))).toBe(true);
      expect(factors.some((f) => f.includes('AIDS'))).toBe(true);
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

    it('isolated elderly social isolation notes 50% dementia risk increase', () => {
      const isolation = PROFILES.isolated_elderly.clinicalConsiderations.find(
        (cc) => cc.condition.includes('Social Isolation')
      );
      expect(isolation?.clinicalNote).toContain('dementia by 50%');
    });

    it('isolated elderly polypharmacy references AGS Beers Criteria', () => {
      const polypharm = PROFILES.isolated_elderly.clinicalConsiderations.find(
        (cc) => cc.condition.includes('Polypharmacy')
      );
      expect(polypharm?.screeningRecommendation).toContain('Beers');
    });

    it('indigenous diabetes note links to colonization and dietary changes', () => {
      const diabetes = PROFILES.indigenous.clinicalConsiderations.find(
        (cc) => cc.condition.includes('Diabetes')
      );
      expect(diabetes?.clinicalNote).toContain('colonization');
    });

    it('immigrant/refugee PTSD prevalence reflects refugee-specific range', () => {
      const ptsd = PROFILES.immigrant_refugee.clinicalConsiderations.find(
        (cc) => cc.condition.includes('PTSD') || cc.condition.includes('Trauma')
      );
      expect(ptsd?.prevalence).toContain('30-86%');
    });

    it('LGBTQ+ elderly HIV note addresses accelerated aging in long-term survivors', () => {
      const hiv = PROFILES.lgbtq_elderly.clinicalConsiderations.find(
        (cc) => cc.condition.includes('HIV')
      );
      expect(hiv?.clinicalNote).toContain('accelerated aging');
    });

    it('LGBTQ+ elderly mental health note addresses minority stress model', () => {
      const mental = PROFILES.lgbtq_elderly.clinicalConsiderations.find(
        (cc) => cc.condition.includes('Mental health')
      );
      expect(mental?.clinicalNote).toContain('minority stress');
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

    it('new profiles also prevent harmful communication', () => {
      // Isolated elderly: don't assume family help
      expect(PROFILES.isolated_elderly.communication.avoidPhrases.some(
        (p) => p.toLowerCase().includes('family')
      )).toBe(true);

      // Indigenous: don't use "spirit animal"
      expect(PROFILES.indigenous.communication.avoidPhrases.some(
        (p) => p.toLowerCase().includes('spirit')
      )).toBe(true);

      // Immigrant/refugee: don't ask about papers
      expect(PROFILES.immigrant_refugee.communication.avoidPhrases.some(
        (p) => p.toLowerCase().includes('legal') || p.toLowerCase().includes('lucky')
      )).toBe(true);

      // LGBTQ+ elderly: don't use "lifestyle"
      expect(PROFILES.lgbtq_elderly.communication.avoidPhrases.some(
        (p) => p.toLowerCase().includes('lifestyle') || p.toLowerCase().includes('preference')
      )).toBe(true);
    });
  });

  // ---------------------------------------------------
  // All 8 Populations — Completeness Check
  // ---------------------------------------------------
  describe('All 8 populations complete', () => {
    const expectedPopulations = [
      'veterans', 'unhoused', 'latino', 'black_aa',
      'isolated_elderly', 'indigenous', 'immigrant_refugee', 'lgbtq_elderly',
    ];

    it('all 8 populations are registered', () => {
      for (const key of expectedPopulations) {
        expect(PROFILES[key]).toBeDefined();
        expect(PROFILES[key].populationKey).toBe(key);
      }
    });

    it('all 8 populations resolve via lookup function', () => {
      for (const key of expectedPopulations) {
        const profile = resolveProfile(key);
        expect(profile).not.toBeNull();
      }
    });

    it('total profile count is exactly 8', () => {
      expect(Object.keys(PROFILES)).toHaveLength(8);
    });
  });
});
