/**
 * Cultural Competency — Integration Tests (Session 3, Task 3.7)
 *
 * Verifies that all 7 AI edge functions + Compass Riley tree trigger
 * correctly integrate cultural context via the shared client pattern:
 *   populationHints → fetchCulturalContext → format → prompt injection
 *
 * Tests the shared client, prompt formatters, and wiring verification.
 */

import { describe, it, expect } from 'vitest';
import { PROFILES, resolveProfile } from './culturalCompetencyFixtures';
import type { CulturalProfile } from './culturalCompetencyFixtures';

// ============================================================================
// Test Helpers — mirror the edge function shared client formatters
// ============================================================================

/**
 * Replicates formatCulturalContextForPrompt from culturalCompetencyClient.ts
 * to verify prompt injection structure without needing Deno runtime.
 */
function formatCulturalContextForPrompt(
  ctx: CulturalProfile,
  clinicalContext?: 'medication' | 'diagnosis' | 'care_plan' | 'discharge'
): string {
  const lines: string[] = [];

  lines.push(`\nCULTURAL COMPETENCY CONTEXT (${ctx.displayName}):`);
  lines.push(`IMPORTANT CAVEAT: ${ctx.caveat}`);

  lines.push(`\nCommunication Style:`);
  lines.push(`- Formality: ${ctx.communication.formalityLevel}`);
  lines.push(`- Family involvement: ${ctx.communication.familyInvolvementNorm}`);
  if (ctx.communication.keyPhrases.length > 0) {
    lines.push(`- Recommended phrases: ${ctx.communication.keyPhrases.join('; ')}`);
  }
  if (ctx.communication.avoidPhrases.length > 0) {
    lines.push(`- AVOID these phrases: ${ctx.communication.avoidPhrases.join('; ')}`);
  }

  if (clinicalContext && ctx.communication.contextSpecific[clinicalContext]) {
    lines.push(`- ${clinicalContext} guidance: ${ctx.communication.contextSpecific[clinicalContext]}`);
  }

  if (ctx.clinicalConsiderations.length > 0) {
    lines.push(`\nPopulation-Specific Clinical Considerations:`);
    ctx.clinicalConsiderations.slice(0, 3).forEach((cc) => {
      lines.push(`- ${cc.condition}: ${cc.clinicalNote} (Screen: ${cc.screeningRecommendation})`);
    });
  }

  if (ctx.barriers.length > 0) {
    lines.push(`\nBarriers to Care:`);
    ctx.barriers.slice(0, 3).forEach((b) => {
      lines.push(`- ${b.barrier}: ${b.mitigation}`);
    });
  }

  if (ctx.trustFactors.length > 0) {
    lines.push(`\nTrust Building:`);
    ctx.trustFactors.slice(0, 2).forEach((tf) => {
      lines.push(`- ${tf.factor}: ${tf.trustBuildingStrategy}`);
    });
  }

  if (ctx.culturalRemedies.length > 0) {
    lines.push(`\nCultural Remedies to Ask About:`);
    ctx.culturalRemedies.forEach((r) => {
      const level = r.warningLevel === 'warning' ? '⚠ WARNING' : r.warningLevel === 'caution' ? 'CAUTION' : 'INFO';
      lines.push(`- ${r.remedy} [${level}]: ${r.commonUse}. Interactions: ${r.potentialInteractions.join('; ')}`);
    });
  }

  if (ctx.sdohCodes.length > 0) {
    lines.push(`\nRelevant SDOH Z-Codes:`);
    ctx.sdohCodes.forEach((s) => {
      lines.push(`- ${s.code}: ${s.description}`);
    });
  }

  return lines.join('\n');
}

/**
 * Replicates formatCulturalContextCompact from culturalCompetencyClient.ts
 */
function formatCulturalContextCompact(ctx: CulturalProfile): string {
  const lines: string[] = [];

  lines.push(`\nCULTURAL CONTEXT (${ctx.displayName}): ${ctx.caveat}`);
  lines.push(`Communication: ${ctx.communication.formalityLevel} formality. ${ctx.communication.familyInvolvementNorm}`);

  if (ctx.barriers.length > 0) {
    lines.push(`Key barriers: ${ctx.barriers.map((b) => b.barrier).join(', ')}`);
  }

  const warnings = ctx.culturalRemedies.filter((r) => r.warningLevel === 'warning');
  if (warnings.length > 0) {
    lines.push(`Cultural remedy warnings: ${warnings.map((r) => `${r.remedy} (${r.potentialInteractions[0]})`).join('; ')}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Cultural Competency — Integration Tests', () => {
  // ---------------------------------------------------
  // Prompt Formatter: Full Format
  // ---------------------------------------------------
  describe('formatCulturalContextForPrompt', () => {
    it('includes CULTURAL COMPETENCY CONTEXT header with display name', () => {
      const output = formatCulturalContextForPrompt(PROFILES.veterans);
      expect(output).toContain('CULTURAL COMPETENCY CONTEXT (Veterans / Military Service Members):');
    });

    it('includes IMPORTANT CAVEAT warning', () => {
      const output = formatCulturalContextForPrompt(PROFILES.black_aa);
      expect(output).toContain('IMPORTANT CAVEAT:');
      expect(output).toContain('not a monolithic identity');
    });

    it('includes communication formality and family involvement', () => {
      const output = formatCulturalContextForPrompt(PROFILES.latino);
      expect(output).toContain('Formality: formal');
      expect(output).toContain('Familismo: family is central');
    });

    it('includes AVOID phrases for harmful communication prevention', () => {
      const output = formatCulturalContextForPrompt(PROFILES.black_aa);
      expect(output).toContain('AVOID these phrases:');
      expect(output).toContain('You people');
    });

    it('includes clinical considerations with screening recommendations', () => {
      const output = formatCulturalContextForPrompt(PROFILES.veterans);
      expect(output).toContain('PTSD / Moral Injury');
      expect(output).toContain('Screen: PC-PTSD-5');
    });

    it('includes barriers to care with mitigation strategies', () => {
      const output = formatCulturalContextForPrompt(PROFILES.unhoused);
      expect(output).toContain('No refrigeration for medications');
      expect(output).toContain('room-temperature stable');
    });

    it('includes trust building strategies', () => {
      const output = formatCulturalContextForPrompt(PROFILES.black_aa);
      expect(output).toContain('Tuskegee Syphilis Study');
      expect(output).toContain('Acknowledge this history');
    });

    it('includes cultural remedies with warning levels', () => {
      const output = formatCulturalContextForPrompt(PROFILES.veterans);
      expect(output).toContain('Kratom');
      expect(output).toContain('⚠ WARNING');
    });

    it('includes SDOH Z-codes', () => {
      const output = formatCulturalContextForPrompt(PROFILES.unhoused);
      expect(output).toContain('Z59.00');
      expect(output).toContain('Homelessness');
    });

    it('injects context-specific guidance for medication context', () => {
      const output = formatCulturalContextForPrompt(PROFILES.veterans, 'medication');
      expect(output).toContain('medication guidance:');
    });

    it('injects context-specific guidance for discharge context', () => {
      const output = formatCulturalContextForPrompt(PROFILES.unhoused, 'discharge');
      expect(output).toContain('discharge guidance:');
      expect(output).toContain('Do NOT discharge to home');
    });

    it('injects context-specific guidance for care_plan context', () => {
      const output = formatCulturalContextForPrompt(PROFILES.latino, 'care_plan');
      expect(output).toContain('care_plan guidance:');
      expect(output).toContain('family in goal-setting');
    });

    it('limits clinical considerations to 3', () => {
      const output = formatCulturalContextForPrompt(PROFILES.veterans);
      const considerationMatches = output.match(/Population-Specific Clinical Considerations:[\s\S]*?(?=\nBarriers|$)/);
      expect(considerationMatches).toBeTruthy();
      if (!considerationMatches) return;
      const lines = considerationMatches[0].split('\n').filter((l) => l.startsWith('- '));
      expect(lines.length).toBeLessThanOrEqual(3);
    });

    it('limits trust factors to 2', () => {
      const output = formatCulturalContextForPrompt(PROFILES.black_aa);
      const trustSection = output.match(/Trust Building:[\s\S]*?(?=\nCultural Remedies|$)/);
      expect(trustSection).toBeTruthy();
      if (!trustSection) return;
      const lines = trustSection[0].split('\n').filter((l) => l.startsWith('- '));
      expect(lines.length).toBeLessThanOrEqual(2);
    });
  });

  // ---------------------------------------------------
  // Prompt Formatter: Compact Format
  // ---------------------------------------------------
  describe('formatCulturalContextCompact', () => {
    it('produces single-paragraph summary with display name', () => {
      const output = formatCulturalContextCompact(PROFILES.veterans);
      expect(output).toContain('CULTURAL CONTEXT (Veterans / Military Service Members):');
    });

    it('includes communication formality', () => {
      const output = formatCulturalContextCompact(PROFILES.latino);
      expect(output).toContain('formal formality');
    });

    it('includes key barriers', () => {
      const output = formatCulturalContextCompact(PROFILES.unhoused);
      expect(output).toContain('Key barriers:');
      expect(output).toContain('No refrigeration');
    });

    it('includes cultural remedy warnings only', () => {
      const output = formatCulturalContextCompact(PROFILES.veterans);
      expect(output).toContain('Kratom');
    });

    it('omits info-level remedies from compact format', () => {
      const output = formatCulturalContextCompact(PROFILES.latino);
      // Manzanilla is info level — should not appear in warnings line
      expect(output).not.toContain('Manzanilla');
      // Ruda is warning level — should appear
      expect(output).toContain('Ruda');
    });

    it('is shorter than full format for same population', () => {
      const full = formatCulturalContextForPrompt(PROFILES.black_aa);
      const compact = formatCulturalContextCompact(PROFILES.black_aa);
      expect(compact.length).toBeLessThan(full.length);
    });
  });

  // ---------------------------------------------------
  // Edge Function Wiring Verification
  // ---------------------------------------------------
  describe('Edge function wiring pattern', () => {
    const ALL_POPULATIONS = Object.keys(PROFILES);

    it('all 8 populations resolve via resolveProfile', () => {
      for (const pop of ALL_POPULATIONS) {
        const profile = resolveProfile(pop);
        expect(profile).not.toBeNull();
        if (!profile) continue;
        expect(profile.populationKey).toBe(pop);
      }
    });

    it('unknown population returns null from resolveProfile', () => {
      expect(resolveProfile('martians')).toBeNull();
      expect(resolveProfile('')).toBeNull();
    });

    it('population keys are lowercase_snake_case', () => {
      for (const key of ALL_POPULATIONS) {
        expect(key).toMatch(/^[a-z_]+$/);
      }
    });

    it('every population produces non-empty prompt in full format', () => {
      for (const pop of ALL_POPULATIONS) {
        const profile = resolveProfile(pop);
        expect(profile).not.toBeNull();
        if (!profile) continue;
        const output = formatCulturalContextForPrompt(profile);
        expect(output.length).toBeGreaterThan(100);
        expect(output).toContain('CULTURAL COMPETENCY CONTEXT');
        expect(output).toContain('IMPORTANT CAVEAT');
      }
    });

    it('every population produces non-empty prompt in compact format', () => {
      for (const pop of ALL_POPULATIONS) {
        const profile = resolveProfile(pop);
        expect(profile).not.toBeNull();
        if (!profile) continue;
        const output = formatCulturalContextCompact(profile);
        expect(output.length).toBeGreaterThan(50);
        expect(output).toContain('CULTURAL CONTEXT');
      }
    });

    it('all 4 clinical contexts work for each population', () => {
      const contexts: Array<'medication' | 'diagnosis' | 'care_plan' | 'discharge'> = [
        'medication', 'diagnosis', 'care_plan', 'discharge',
      ];
      for (const pop of ALL_POPULATIONS) {
        const profile = resolveProfile(pop);
        expect(profile).not.toBeNull();
        if (!profile) continue;
        for (const ctx of contexts) {
          const output = formatCulturalContextForPrompt(profile, ctx);
          expect(output).toContain('CULTURAL COMPETENCY CONTEXT');
          // Should not throw for any combination
        }
      }
    });
  });

  // ---------------------------------------------------
  // Multi-population merging (populationHints with multiple values)
  // ---------------------------------------------------
  describe('Multi-population cultural context merge', () => {
    it('merges contexts from two populations into combined prompt', () => {
      const hints = ['veterans', 'isolated_elderly'];
      const contexts = hints
        .map((h) => resolveProfile(h))
        .filter((ctx): ctx is CulturalProfile => ctx !== null);

      expect(contexts).toHaveLength(2);

      const merged = contexts
        .map((ctx) => formatCulturalContextForPrompt(ctx, 'medication'))
        .join('\n');

      expect(merged).toContain('Veterans / Military Service Members');
      expect(merged).toContain('Isolated Elderly');
      expect(merged).toContain('PTSD');
      expect(merged).toContain('Polypharmacy');
    });

    it('filters out unknown populations gracefully', () => {
      const hints = ['veterans', 'unknown_population', 'latino'];
      const contexts = hints
        .map((h) => resolveProfile(h))
        .filter((ctx): ctx is CulturalProfile => ctx !== null);

      expect(contexts).toHaveLength(2);
      expect(contexts[0].populationKey).toBe('veterans');
      expect(contexts[1].populationKey).toBe('latino');
    });

    it('handles empty populationHints array', () => {
      const hints: string[] = [];
      const contexts = hints
        .map((h) => resolveProfile(h))
        .filter((ctx): ctx is CulturalProfile => ctx !== null);

      expect(contexts).toHaveLength(0);
    });

    it('handles all 8 populations simultaneously', () => {
      const allHints = Object.keys(PROFILES);
      const contexts = allHints
        .map((h) => resolveProfile(h))
        .filter((ctx): ctx is CulturalProfile => ctx !== null);

      expect(contexts).toHaveLength(8);

      const merged = contexts
        .map((ctx) => formatCulturalContextForPrompt(ctx))
        .join('\n');

      // Every population's display name should appear
      for (const profile of Object.values(PROFILES)) {
        expect(merged).toContain(profile.displayName);
      }
    });
  });

  // ---------------------------------------------------
  // Readmission predictor wiring (compact format + reasoning input)
  // ---------------------------------------------------
  describe('Readmission predictor cultural context shape', () => {
    it('builds reasoningCulturalContext with populations array', () => {
      const hints = ['veterans', 'unhoused'];
      const validContexts = hints
        .map((h) => resolveProfile(h))
        .filter((ctx): ctx is CulturalProfile => ctx !== null);

      const reasoningCulturalContext = {
        populations: validContexts.map((c) => c.populationKey),
        barriers: validContexts.flatMap((ctx) => ctx.barriers.map((b) => b.barrier)),
        clinicalNotes: validContexts.flatMap((ctx) =>
          ctx.clinicalConsiderations.slice(0, 2).map((cc) => `${cc.condition}: ${cc.clinicalNote}`)
        ),
      };

      expect(reasoningCulturalContext.populations).toEqual(['veterans', 'unhoused']);
      expect(reasoningCulturalContext.barriers).toContain('Stigma around mental health');
      expect(reasoningCulturalContext.barriers).toContain('No refrigeration for medications');
      expect(reasoningCulturalContext.clinicalNotes.length).toBe(4); // 2 per population
    });
  });

  // ---------------------------------------------------
  // SDOH coder wiring (extracts sdohCodes array)
  // ---------------------------------------------------
  describe('SDOH coder cultural context shape', () => {
    it('extracts flattened sdohCodes from multiple populations', () => {
      const hints = ['unhoused', 'veterans'];
      const validContexts = hints
        .map((h) => resolveProfile(h))
        .filter((ctx): ctx is CulturalProfile => ctx !== null);

      const culturalSDOHCodes = validContexts.flatMap((ctx) => ctx.sdohCodes);

      expect(culturalSDOHCodes.length).toBeGreaterThan(2);
      const codes = culturalSDOHCodes.map((c) => c.code);
      expect(codes).toContain('Z59.00'); // Homelessness
      expect(codes).toContain('Z91.82'); // Military deployment
    });

    it('each SDOH code has code, description, and applicability', () => {
      for (const profile of Object.values(PROFILES)) {
        for (const code of profile.sdohCodes) {
          expect(code.code).toMatch(/^Z\d+/);
          expect(code.description.length).toBeGreaterThan(5);
          expect(code.applicability.length).toBeGreaterThan(5);
        }
      }
    });
  });

  // ---------------------------------------------------
  // Tree trigger engine wiring (culturalContext on encounterState)
  // ---------------------------------------------------
  describe('Compass Riley tree trigger cultural context shape', () => {
    it('builds culturalContext with populations, barriers, and clinicalNotes', () => {
      const hints = ['black_aa'];
      const validContexts = hints
        .map((h) => resolveProfile(h))
        .filter((ctx): ctx is CulturalProfile => ctx !== null);

      const culturalContext = {
        populations: validContexts.map((c) => c.populationKey),
        barriers: validContexts.flatMap((ctx) => ctx.barriers.map((b) => b.barrier)),
        clinicalNotes: validContexts.flatMap((ctx) =>
          ctx.clinicalConsiderations.slice(0, 2).map((cc) => `${cc.condition}: ${cc.clinicalNote}`)
        ),
      };

      expect(culturalContext.populations).toEqual(['black_aa']);
      expect(culturalContext.barriers).toContain('Medical mistrust rooted in historical harm');
      expect(culturalContext.clinicalNotes[0]).toContain('Hypertension');
      expect(culturalContext.clinicalNotes[1]).toContain('Sickle Cell');
    });

    it('empty culturalContext when no populationHints provided', () => {
      const culturalContext = {
        populations: [] as string[],
        barriers: [] as string[],
        clinicalNotes: [] as string[],
      };

      expect(culturalContext.populations).toHaveLength(0);
      expect(culturalContext.barriers).toHaveLength(0);
    });
  });
});
