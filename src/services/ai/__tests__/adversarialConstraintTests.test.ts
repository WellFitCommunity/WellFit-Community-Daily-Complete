/**
 * Adversarial Constraint Test Suite — P1-6
 *
 * Proves that AI clinical guardrails (constraint text) contain the specific
 * "do NOT" phrases a compliance officer would check. Validates that
 * buildConstraintBlock() assembles the correct constraint categories and
 * that no guardrail language is accidentally removed during refactoring.
 *
 * These tests do NOT test AI behavior — they test that the constraint TEXT
 * fed into AI prompts contains the required safety language.
 */

import { describe, it, expect } from 'vitest';
import {
  buildConstraintBlock,
  UNIVERSAL_CLINICAL_CONSTRAINTS,
  CLINICAL_GROUNDING_RULES,
  CONDENSED_GROUNDING_RULES,
  NURSE_SCOPE_GUARD,
  BILLING_CODING_CONSTRAINTS,
  SDOH_CODING_CONSTRAINTS,
  DRG_GROUPER_CONSTRAINTS,
  ESCALATION_RISK_CONSTRAINTS,
  CARE_PLANNING_CONSTRAINTS,
} from '../clinicalConstraintConstants';

// ==========================================================================
// 1. Constraint Assembly Tests
// ==========================================================================

describe('Constraint Assembly — buildConstraintBlock', () => {
  it('includes UNIVERSAL + BILLING when billing is requested', () => {
    const result = buildConstraintBlock(['billing']);
    expect(result).toContain('UNIVERSAL CLINICAL AI CONSTRAINTS');
    expect(result).toContain('BILLING & CODING CONSTRAINTS');
  });

  it('includes UNIVERSAL + BILLING + SDOH when both are requested', () => {
    const result = buildConstraintBlock(['billing', 'sdoh']);
    expect(result).toContain('UNIVERSAL CLINICAL AI CONSTRAINTS');
    expect(result).toContain('BILLING & CODING CONSTRAINTS');
    expect(result).toContain('SDOH Z-CODE CONSTRAINTS');
  });

  it('includes UNIVERSAL + ESCALATION when escalation is requested', () => {
    const result = buildConstraintBlock(['escalation']);
    expect(result).toContain('UNIVERSAL CLINICAL AI CONSTRAINTS');
    expect(result).toContain('ESCALATION & RISK SCORING CONSTRAINTS');
  });

  it('includes UNIVERSAL + CARE_PLANNING when care_planning is requested', () => {
    const result = buildConstraintBlock(['care_planning']);
    expect(result).toContain('UNIVERSAL CLINICAL AI CONSTRAINTS');
    expect(result).toContain('CARE PLANNING & RECOMMENDATION CONSTRAINTS');
  });

  it('includes UNIVERSAL + DRG when drg is requested', () => {
    const result = buildConstraintBlock(['drg']);
    expect(result).toContain('UNIVERSAL CLINICAL AI CONSTRAINTS');
    expect(result).toContain('DRG GROUPER CONSTRAINTS');
  });

  it('includes UNIVERSAL + GROUNDING when grounding is requested', () => {
    const result = buildConstraintBlock(['grounding']);
    expect(result).toContain('UNIVERSAL CLINICAL AI CONSTRAINTS');
    expect(result).toContain('ANTI-HALLUCINATION GROUNDING RULES');
  });

  it('includes NURSE_SCOPE guard when nurse_scope is requested', () => {
    const result = buildConstraintBlock(['nurse_scope']);
    expect(result).toContain('UNIVERSAL CLINICAL AI CONSTRAINTS');
    expect(result).toContain('NURSE SCOPE BOUNDARIES');
  });

  it('returns empty string when no categories and universal excluded', () => {
    const result = buildConstraintBlock([], false);
    expect(result).toBe('');
  });

  it('always includes universal constraints when includeUniversal is true (default)', () => {
    const result = buildConstraintBlock([]);
    expect(result).toContain('UNIVERSAL CLINICAL AI CONSTRAINTS');
  });

  it('does not duplicate universal when explicitly included in categories', () => {
    const result = buildConstraintBlock(['universal']);
    const universalCount = (
      result.match(/UNIVERSAL CLINICAL AI CONSTRAINTS/g) || []
    ).length;
    expect(universalCount).toBe(1);
  });

  it('combines all categories without losing any block', () => {
    const result = buildConstraintBlock([
      'grounding',
      'billing',
      'sdoh',
      'drg',
      'escalation',
      'care_planning',
      'nurse_scope',
    ]);
    expect(result).toContain('UNIVERSAL CLINICAL AI CONSTRAINTS');
    expect(result).toContain('ANTI-HALLUCINATION GROUNDING RULES');
    expect(result).toContain('BILLING & CODING CONSTRAINTS');
    expect(result).toContain('SDOH Z-CODE CONSTRAINTS');
    expect(result).toContain('DRG GROUPER CONSTRAINTS');
    expect(result).toContain('ESCALATION & RISK SCORING CONSTRAINTS');
    expect(result).toContain('CARE PLANNING & RECOMMENDATION CONSTRAINTS');
    expect(result).toContain('NURSE SCOPE BOUNDARIES');
  });
});

// ==========================================================================
// 2. Billing Constraint Verification
// ==========================================================================

describe('Billing Constraints — compliance language', () => {
  it('prohibits ICD-9 code suggestions', () => {
    expect(BILLING_CODING_CONSTRAINTS).toContain(
      'Do NOT suggest ICD-9 codes'
    );
  });

  it('prohibits CPT codes for unperformed services', () => {
    expect(BILLING_CODING_CONSTRAINTS).toContain(
      'Do NOT suggest CPT codes for services not performed'
    );
  });

  it('prohibits upcoding via higher-specificity codes', () => {
    expect(BILLING_CODING_CONSTRAINTS).toContain(
      'Do NOT recommend higher-specificity codes'
    );
  });

  it('labels output as advisory requiring coder review', () => {
    expect(BILLING_CODING_CONSTRAINTS).toContain(
      'advisory, requires coder review'
    );
  });

  it('prohibits auto-populating charge amounts', () => {
    expect(BILLING_CODING_CONSTRAINTS).toContain(
      'Do NOT auto-populate charge amounts'
    );
  });

  it('prohibits fabricating modifier codes', () => {
    expect(BILLING_CODING_CONSTRAINTS).toContain(
      'Do NOT fabricate modifier codes'
    );
  });

  it('prohibits assigning codes from historical patterns', () => {
    expect(BILLING_CODING_CONSTRAINTS).toContain(
      'Do NOT assign codes based on historical patterns'
    );
  });

  it('requires every code to cite evidence', () => {
    expect(BILLING_CODING_CONSTRAINTS).toContain(
      'EVERY CODE MUST CITE EVIDENCE'
    );
  });
});

// ==========================================================================
// 3. SDOH Constraint Verification
// ==========================================================================

describe('SDOH Constraints — compliance language', () => {
  it('prohibits fabricating Z-codes', () => {
    expect(SDOH_CODING_CONSTRAINTS).toContain(
      'Do NOT fabricate Z-codes'
    );
  });

  it('prohibits inferring housing insecurity from demographics', () => {
    expect(SDOH_CODING_CONSTRAINTS).toContain(
      'Do NOT infer housing insecurity'
    );
  });

  it('prohibits assigning Z-codes based on neighborhood', () => {
    expect(SDOH_CODING_CONSTRAINTS).toContain(
      'Do NOT assign Z-codes based on neighborhood'
    );
  });

  it('prohibits Z-code assignment without documented social determinants', () => {
    expect(SDOH_CODING_CONSTRAINTS).toContain(
      'Do NOT assign SDOH Z-codes unless social determinants are explicitly documented'
    );
  });

  it('states cultural context is not diagnosis', () => {
    expect(SDOH_CODING_CONSTRAINTS).toContain(
      'CULTURAL CONTEXT IS NOT DIAGNOSIS'
    );
  });
});

// ==========================================================================
// 4. DRG Constraint Verification
// ==========================================================================

describe('DRG Constraints — compliance language', () => {
  it('prohibits fabricating ICD-10 codes', () => {
    expect(DRG_GROUPER_CONSTRAINTS).toContain(
      'Do NOT fabricate ICD-10 codes'
    );
  });

  it('prohibits inferring undocumented diagnoses', () => {
    expect(DRG_GROUPER_CONSTRAINTS).toContain(
      'Do NOT infer a diagnosis'
    );
  });

  it('prohibits upgrading CC/MCC status without documentation', () => {
    expect(DRG_GROUPER_CONSTRAINTS).toContain(
      'Do NOT upgrade CC/MCC status'
    );
  });

  it('caps confidence scores at 0.8 without full references', () => {
    expect(DRG_GROUPER_CONSTRAINTS).toContain(
      'confidence score above 0.8'
    );
  });

  it('requires current fiscal year MS-DRG table', () => {
    expect(DRG_GROUPER_CONSTRAINTS).toContain(
      'current fiscal year MS-DRG table'
    );
  });

  it('labels output as requiring certified coder review', () => {
    expect(DRG_GROUPER_CONSTRAINTS).toContain(
      'requires certified coder review'
    );
  });
});

// ==========================================================================
// 5. Escalation & Risk Constraint Verification
// ==========================================================================

describe('Escalation & Risk Constraints — compliance language', () => {
  it('prohibits assigning absent risk factors', () => {
    expect(ESCALATION_RISK_CONSTRAINTS).toContain(
      'Do NOT assign risk factors not present'
    );
  });

  it('prohibits fabricating vital sign trends', () => {
    expect(ESCALATION_RISK_CONSTRAINTS).toContain(
      'Do NOT fabricate vital sign trends'
    );
  });

  it('prohibits CRITICAL escalation without documented triggers', () => {
    expect(ESCALATION_RISK_CONSTRAINTS).toContain(
      'Do NOT assign CRITICAL escalation status without'
    );
  });

  it('prohibits using patient names in risk narratives', () => {
    expect(ESCALATION_RISK_CONSTRAINTS).toContain(
      'Do NOT use patient names'
    );
  });

  it('prohibits inflating risk scores', () => {
    expect(ESCALATION_RISK_CONSTRAINTS).toContain(
      'Do NOT inflate risk scores'
    );
  });

  it('prohibits recommending contradictory interventions', () => {
    expect(ESCALATION_RISK_CONSTRAINTS).toContain(
      'Do NOT recommend interventions that contradict'
    );
  });

  it('prohibits suppressing required review flags', () => {
    expect(ESCALATION_RISK_CONSTRAINTS).toContain(
      'Do NOT suppress required review flags'
    );
  });

  it('requires clinician review for all risk assessments', () => {
    expect(ESCALATION_RISK_CONSTRAINTS).toContain('clinician review');
  });
});

// ==========================================================================
// 6. Care Planning Constraint Verification
// ==========================================================================

describe('Care Planning Constraints — compliance language', () => {
  it('prohibits recommending interventions for absent conditions', () => {
    expect(CARE_PLANNING_CONSTRAINTS).toContain(
      'Do NOT recommend interventions for conditions the patient does not have'
    );
  });

  it('prohibits citing nonexistent guidelines', () => {
    expect(CARE_PLANNING_CONSTRAINTS).toContain(
      'Do NOT cite guidelines that do not exist'
    );
  });

  it('prohibits recommending allergenic medications', () => {
    expect(CARE_PLANNING_CONSTRAINTS).toContain(
      'Do NOT recommend medications the patient is allergic to'
    );
  });

  it('prohibits fabricating medication changes', () => {
    expect(CARE_PLANNING_CONSTRAINTS).toContain(
      'Do NOT fabricate medication changes'
    );
  });

  it('prohibits recommending unordered follow-up care', () => {
    expect(CARE_PLANNING_CONSTRAINTS).toContain(
      'Do NOT recommend follow-up care the physician did not order'
    );
  });

  it('requires unknown evidence levels to be flagged', () => {
    expect(CARE_PLANNING_CONSTRAINTS).toContain(
      'evidence level not verified'
    );
  });

  it('prohibits care that contradicts documented contraindications', () => {
    expect(CARE_PLANNING_CONSTRAINTS).toContain(
      'contradicts documented contraindications'
    );
  });

  it('labels all output as advisory', () => {
    expect(CARE_PLANNING_CONSTRAINTS).toContain('ADVISORY');
  });
});

// ==========================================================================
// 7. Grounding Rule Verification
// ==========================================================================

describe('Grounding Rules — compliance language', () => {
  it('establishes transcript as truth', () => {
    expect(CLINICAL_GROUNDING_RULES).toContain('TRANSCRIPT IS TRUTH');
  });

  it('requires STATED confidence label', () => {
    expect(CLINICAL_GROUNDING_RULES).toContain('[STATED]');
  });

  it('requires INFERRED confidence label', () => {
    expect(CLINICAL_GROUNDING_RULES).toContain('[INFERRED]');
  });

  it('requires GAP confidence label', () => {
    expect(CLINICAL_GROUNDING_RULES).toContain('[GAP]');
  });

  it('prohibits adding undiscussed review-of-systems elements', () => {
    expect(CLINICAL_GROUNDING_RULES).toContain(
      'Do NOT add review-of-systems elements'
    );
  });

  it('prohibits inventing medication doses', () => {
    expect(CLINICAL_GROUNDING_RULES).toContain(
      'Do NOT invent medication doses'
    );
  });

  it('enforces SOAP note integrity', () => {
    expect(CLINICAL_GROUNDING_RULES).toContain('SOAP NOTE INTEGRITY');
  });
});

describe('Condensed Grounding Rules — compliance language', () => {
  it('contains the never-infer-vitals directive', () => {
    expect(CONDENSED_GROUNDING_RULES).toContain('Never infer vitals');
  });

  it('contains confidence labeling tags', () => {
    expect(CONDENSED_GROUNDING_RULES).toContain('[STATED]');
    expect(CONDENSED_GROUNDING_RULES).toContain('[INFERRED]');
    expect(CONDENSED_GROUNDING_RULES).toContain('[GAP]');
  });
});

// ==========================================================================
// 8. Nurse Scope Guard Verification
// ==========================================================================

describe('Nurse Scope Guard — compliance language', () => {
  it('prohibits billing codes', () => {
    expect(NURSE_SCOPE_GUARD).toContain('NO BILLING CODES');
  });

  it('prohibits medication dosing recommendations', () => {
    expect(NURSE_SCOPE_GUARD).toContain('NO MEDICATION DOSING');
  });

  it('prohibits MDM reasoning', () => {
    expect(NURSE_SCOPE_GUARD).toContain('NO MDM REASONING');
  });

  it('prohibits revenue optimization', () => {
    expect(NURSE_SCOPE_GUARD).toContain('NO REVENUE OPTIMIZATION');
  });
});

// ==========================================================================
// 9. Universal Constraint Verification
// ==========================================================================

describe('Universal Constraints — compliance language', () => {
  it('prohibits fabricating clinical findings', () => {
    expect(UNIVERSAL_CLINICAL_CONSTRAINTS).toContain(
      'Do NOT fabricate clinical findings'
    );
  });

  it('caps confidence scores at 0.8', () => {
    expect(UNIVERSAL_CLINICAL_CONSTRAINTS).toContain(
      'confidence scores above 0.8'
    );
  });

  it('prohibits using patient names in output', () => {
    expect(UNIVERSAL_CLINICAL_CONSTRAINTS).toContain(
      'Do NOT use patient names'
    );
  });

  it('prohibits suppressing required review flags', () => {
    expect(UNIVERSAL_CLINICAL_CONSTRAINTS).toContain(
      'Do NOT suppress required review flags'
    );
  });

  it('requires human review for all output', () => {
    expect(UNIVERSAL_CLINICAL_CONSTRAINTS).toContain('human review');
  });
});
