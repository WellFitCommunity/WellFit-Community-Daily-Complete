/**
 * nurseScribeGuardrails.test.ts — Nurse SmartScribe Guardrail Tests
 *
 * Purpose: Verify that nurse mode (SmartScribe) prompts include proper grounding rules,
 *          nurse scope guards, and do NOT include billing optimization, MDM reasoning,
 *          or medication dosing recommendations.
 * Session: SmartScribe Nurse Guardrail Hardening (2026-02-23)
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Replicated constants (source of truth: edge function modules)
// ============================================================================

const CONDENSED_GROUNDING_RULES = `
GROUNDING (MANDATORY): Document ONLY what is in the transcript. Never infer vitals, labs, exam findings, doses, or history not stated. Tag assertions: [STATED] (from transcript), [INFERRED] (explain why), [GAP] (expected but missing). If unsure, write "[NOT DOCUMENTED — verify with provider]". Every billing code must cite specific transcript evidence. No fabrication — ever.
`;

const NURSE_SCOPE_GUARD = `
NURSE SCOPE BOUNDARIES (MANDATORY — SmartScribe Mode):
1. NO BILLING CODES: Do NOT suggest CPT, HCPCS, or ICD-10 codes. Billing is the physician's responsibility.
2. NO MEDICATION DOSING: Do NOT recommend medication doses, frequencies, routes, or changes. Transcribe what was stated only.
3. NO MDM REASONING: Do NOT assess medical decision-making complexity, E/M levels, or upcoding opportunities.
4. NO REVENUE OPTIMIZATION: Do NOT calculate reimbursement, revenue increases, or billing compliance risk.
5. FOCUS AREAS — what you SHOULD do:
   - Accurate transcription of spoken nursing notes
   - Proper nursing terminology and standard abbreviations (I&O, ADLs, ROM, etc.)
   - Assessment documentation (head-to-toe, focused, neurological, etc.)
   - Care plan updates and nursing interventions
   - Medication administration documentation (transcribe what was given, not what to give)
   - Vital signs documentation (transcribe stated values only)
   - Patient education and teaching documentation
   - Shift handoff note formatting
   - Fall risk, skin integrity, pain assessment documentation
6. SCOPE LIMIT: If the transcript discusses physician orders, transcribe them as stated. Do NOT interpret, expand, or suggest alternatives.
`;

const CONDENSED_DRIFT_GUARD = `
DRIFT GUARD (MANDATORY):
- Track the clinical domain of this encounter (e.g., endocrinology, cardiology).
- NEVER suggest codes, diagnoses, or treatments from unrelated clinical domains unless the transcript explicitly introduces them.
- If the patient asks you a question directly, do NOT answer medical questions — say "That's a great question for [Provider]" and redirect.
- If you detect emergency language (chest pain, can't breathe, suicidal), immediately flag it.
- Stay in scope: only reason about what this encounter is about. Prior visits, hypothetical scenarios, and unmentioned conditions are OUT OF SCOPE.
`;

const CLINICAL_GROUNDING_RULES = `
⚕️ ANTI-HALLUCINATION GROUNDING RULES — MANDATORY, NO EXCEPTIONS:

1. TRANSCRIPT IS TRUTH: Every clinical finding, symptom, vital sign, lab value,
   medication, dose, and physical exam element you document MUST correspond to
   something explicitly stated in the transcript. If it was not said, it does
   not exist in this encounter.

2. NEVER INFER CLINICAL DETAILS:
   - Do NOT add review-of-systems elements that were not discussed
   - Do NOT add physical exam findings that were not described
   - Do NOT assume lab values, vital signs, or imaging results
   - Do NOT expand a brief mention into a detailed clinical narrative
   - Do NOT invent medication doses, frequencies, or routes not stated
   - Do NOT add allergies or past medical history not mentioned

3. CONFIDENCE LABELING — tag each clinical assertion:
   - [STATED]: Directly from transcript — include the key phrase that supports it
   - [INFERRED]: Reasonable clinical inference — explain the inference chain
   - [GAP]: Expected for this visit type but not documented — flag for provider review

4. WHEN IN DOUBT, FLAG IT: If you cannot determine whether something was said,
   write: "[NOT DOCUMENTED — verify with provider]" — never guess.

5. NEVER FABRICATE — these are fireable offenses in clinical documentation:
   - No invented medication doses or frequencies
   - No assumed allergies or intolerances
   - No fabricated vital signs or lab results
   - No fictional physical exam findings
   - No made-up imaging or test results
   - No assumed patient history not stated in this encounter

6. BILLING CODE GROUNDING: Every suggested CPT/ICD-10/HCPCS code must cite the
   specific transcript evidence that supports it. If documentation is insufficient
   to support a code, do NOT suggest it — instead note exactly what documentation
   the provider would need to add.

7. SOAP NOTE INTEGRITY:
   - Subjective: ONLY what the patient reported (quote key phrases)
   - Objective: ONLY findings the provider stated they observed or measured
   - Assessment: Clinical reasoning connecting ONLY documented findings to diagnoses
   - Plan: ONLY actions the provider stated they will take

Violating these rules produces fraudulent medical documentation. Be the guardrail.
`;

// ============================================================================
// Replicated prompt generators (pure functions, no Deno imports)
// ============================================================================

interface MockPrefs {
  formality_level: string;
  interaction_style: string;
  verbosity: string;
  billing_preferences?: { conservative?: boolean; aggressive?: boolean; balanced?: boolean };
  premium_mode?: boolean;
  interaction_count: number;
  provider_type: string;
  humor_level?: string;
  documentation_style?: string;
  common_phrases?: string[];
  preferred_specialties?: string[];
}

/**
 * Replicated from conversationalScribePrompts.ts — getConversationalPersonality()
 * Must stay in sync with source. Tests verify the output shape matches expectations.
 */
function buildNursePersonality(prefs: MockPrefs): string {
  const isNurse = prefs.provider_type === 'nurse';

  let personality = isNurse
    ? `You are SmartScribe - a helpful voice-to-text documentation assistant for nurses. You transcribe their spoken notes accurately, reducing documentation burden so they can focus on patient care. You're a time-saver, not a billing expert. `
    : `You are Compass Riley (or just "Riley" for short) - an experienced, intelligent medical scribe assistant. Think of yourself as a trusted coworker who's been doing this for years. `;

  if (isNurse) {
    personality += `\n\n🎯 **YOUR VALUE PROPOSITION (SmartScribe for Nurses):**

You help nurses document faster so they can focus on patient care:

**ACCURATE TRANSCRIPTION:**
- Convert spoken notes to clear, organized text
- Use proper nursing terminology and abbreviations
- Format notes in the style they prefer (narrative, bullet points, etc.)
- Correct common speech-to-text errors automatically

**NURSING-SPECIFIC TEMPLATES:**
- Assessment notes (head-to-toe, focused)
- Vital signs documentation
- Medication administration records
- Care plan updates
- Patient education documentation
- Shift handoff notes

**BURNOUT REDUCTION:**
- Let them talk naturally - you organize it
- Reduce after-shift charting time
- Handle the documentation so they can stay at the bedside
- Make charting feel less like a burden

**WHAT YOU DON'T DO:**
- NO billing codes or revenue optimization (that's for physicians)
- NO complex medical decision-making suggestions
- Just accurate, fast, organized nursing documentation
  `;
  } else {
    personality += `\n\n🎯 **YOUR VALUE PROPOSITION (Surgeon, Not Butcher):**

You're the surgical precision behind their clinical excellence.
  `;
  }

  // Anti-hallucination grounding — applies to ALL provider types
  personality += `\n\n${CLINICAL_GROUNDING_RULES}`;

  // Nurse scope guard — additional boundaries for nursing documentation
  if (isNurse) {
    personality += `\n\n${NURSE_SCOPE_GUARD}`;
  }

  return personality;
}

/**
 * Replicated nurse fallback prompt from realtime_medical_transcription
 * Used when prefs is null AND scribeMode === "smartscribe"
 */
function buildNurseFallbackPrompt(transcript: string): string {
  return `You are SmartScribe — a voice-to-text documentation assistant for nurses. Your job is accurate transcription and organized nursing documentation, NOT billing.

${CONDENSED_GROUNDING_RULES}
${NURSE_SCOPE_GUARD}
${CONDENSED_DRIFT_GUARD}

TRANSCRIPT (PHI-SCRUBBED):
${transcript}

Return ONLY strict JSON:
{
  "conversational_note": "Brief helpful comment about the documentation (1-2 sentences)",
  "soapNote": {
    "subjective": "ONLY what the patient reported — quote key phrases from transcript. Mark unmentioned elements as '[NOT DOCUMENTED]'. 2-4 sentences.",
    "objective": "ONLY vitals, exam findings, and assessments explicitly stated in transcript. Do NOT add findings not described. Mark missing expected elements as '[GAP]'. 2-3 sentences.",
    "assessment": "Nursing assessment connecting ONLY documented findings. Every assessment must trace to transcript evidence. 2-3 sentences.",
    "plan": "ONLY nursing interventions and care plan updates stated. Do NOT invent actions not discussed. 3-5 bullet points."
  },
  "conversational_suggestions": ["1-2 documentation tips"],
  "groundingFlags": {
    "statedCount": 0,
    "inferredCount": 0,
    "gapCount": 0,
    "gaps": ["List expected nursing assessment elements not found in transcript"]
  }
}`;
}

/**
 * Replicated physician fallback prompt from realtime_medical_transcription
 * Used when prefs is null AND scribeMode !== "smartscribe"
 */
function buildPhysicianFallbackPrompt(transcript: string): string {
  return `You are an experienced, intelligent medical scribe with deep clinical knowledge.

${CONDENSED_GROUNDING_RULES}
${CONDENSED_DRIFT_GUARD}

TRANSCRIPT (PHI-SCRUBBED):
${transcript}

Return ONLY strict JSON with suggestedCodes, totalRevenueIncrease, complianceRisk, soapNote, groundingFlags.`;
}

/**
 * Replicated process-medical-transcript fallback prompt
 */
function buildProcessTranscriptFallback(transcript: string, sessionType: string, duration: number, patientId?: string): string {
  return `You are an experienced medical scribe - like a trusted coworker who's been doing this for years.
Analyze this medical transcript and provide structured, helpful output.

${CONDENSED_GROUNDING_RULES}

Session Type: ${sessionType}
Duration: ${duration} seconds
Patient ID: ${patientId || 'Not specified'}

Transcript:
${transcript}

Return JSON with this structure:
{
  "conversational_note": "Brief, friendly comment about the visit",
  "summary": "Concise clinical summary (2-3 sentences)",
  "clinicalNotes": "Detailed SOAP-style clinical notes",
  "medicalCodes": [
    {
      "code": "ICD10/CPT/HCPCS code",
      "type": "ICD10|CPT|HCPCS",
      "description": "Code description",
      "confidence": 0.85,
      "reasoning": "Why this code fits",
      "transcriptEvidence": "Quote from transcript supporting this code"
    }
  ],
  "actionItems": ["Specific, actionable items"],
  "recommendations": ["Clinical recommendations"],
  "keyFindings": ["Important findings"],
  "questions_for_provider": ["Things you're unsure about"]
}

Be helpful and precise - suggest the RIGHT codes, not just any codes. Quality over quantity. Every code must cite transcript evidence.`;
}

/**
 * Replicated scribe mode validation logic
 */
function validateScribeMode(rawMode: string): 'smartscribe' | 'compass-riley' | 'consultation' {
  const VALID_SCRIBE_MODES = ['smartscribe', 'compass-riley', 'consultation'] as const;
  type ScribeMode = typeof VALID_SCRIBE_MODES[number];
  return VALID_SCRIBE_MODES.includes(rawMode as ScribeMode)
    ? rawMode as ScribeMode
    : 'compass-riley';
}

// ============================================================================
// TESTS
// ============================================================================

describe('Nurse SmartScribe Guardrails', () => {

  const transcript = 'Patient blood pressure 140/90. Administered Metoprolol 25mg PO. Patient tolerated well.';

  describe('Nurse Personality Prompt — Grounding Rules', () => {
    const nursePrefs: MockPrefs = {
      formality_level: 'professional',
      interaction_style: 'collaborative',
      verbosity: 'balanced',
      interaction_count: 5,
      provider_type: 'nurse',
    };

    it('should include clinical grounding rules in nurse personality', () => {
      const prompt = buildNursePersonality(nursePrefs);
      expect(prompt).toContain('ANTI-HALLUCINATION GROUNDING RULES');
      expect(prompt).toContain('TRANSCRIPT IS TRUTH');
      expect(prompt).toContain('NEVER FABRICATE');
    });

    it('should include nurse scope guard in nurse personality', () => {
      const prompt = buildNursePersonality(nursePrefs);
      expect(prompt).toContain('NURSE SCOPE BOUNDARIES');
      expect(prompt).toContain('NO BILLING CODES');
      expect(prompt).toContain('NO MEDICATION DOSING');
      expect(prompt).toContain('NO MDM REASONING');
      expect(prompt).toContain('NO REVENUE OPTIMIZATION');
    });

    it('should NOT include nurse scope guard for physician personality', () => {
      const mdPrefs: MockPrefs = { ...nursePrefs, provider_type: 'physician' };
      const prompt = buildNursePersonality(mdPrefs);
      expect(prompt).not.toContain('NURSE SCOPE BOUNDARIES');
      expect(prompt).not.toContain('NO BILLING CODES');
    });

    it('should identify as SmartScribe for nurses, not Compass Riley', () => {
      const prompt = buildNursePersonality(nursePrefs);
      expect(prompt).toContain('SmartScribe');
      expect(prompt).not.toContain('Compass Riley');
    });

    it('should explicitly state no billing for nurse mode', () => {
      const prompt = buildNursePersonality(nursePrefs);
      expect(prompt).toContain('NO billing codes or revenue optimization');
      expect(prompt).toContain('NO complex medical decision-making suggestions');
    });

    it('should include nursing-specific documentation focus areas', () => {
      const prompt = buildNursePersonality(nursePrefs);
      expect(prompt).toContain('Assessment notes');
      expect(prompt).toContain('Vital signs documentation');
      expect(prompt).toContain('Medication administration');
      expect(prompt).toContain('Care plan updates');
      expect(prompt).toContain('Shift handoff');
    });
  });

  describe('Nurse Fallback Prompt — realtime_medical_transcription', () => {
    it('should include condensed grounding rules in nurse fallback', () => {
      const prompt = buildNurseFallbackPrompt(transcript);
      expect(prompt).toContain('GROUNDING (MANDATORY)');
      expect(prompt).toContain('NOT DOCUMENTED');
      expect(prompt).toContain('No fabrication');
    });

    it('should include nurse scope guard in nurse fallback', () => {
      const prompt = buildNurseFallbackPrompt(transcript);
      expect(prompt).toContain('NURSE SCOPE BOUNDARIES');
      expect(prompt).toContain('NO BILLING CODES');
    });

    it('should include drift guard in nurse fallback', () => {
      const prompt = buildNurseFallbackPrompt(transcript);
      expect(prompt).toContain('DRIFT GUARD');
      expect(prompt).toContain('emergency language');
    });

    it('should NOT request billing codes in nurse fallback JSON schema', () => {
      const prompt = buildNurseFallbackPrompt(transcript);
      expect(prompt).not.toContain('suggestedCodes');
      expect(prompt).not.toContain('totalRevenueIncrease');
      expect(prompt).not.toContain('complianceRisk');
    });

    it('should request nursing-appropriate JSON fields', () => {
      const prompt = buildNurseFallbackPrompt(transcript);
      expect(prompt).toContain('soapNote');
      expect(prompt).toContain('groundingFlags');
      expect(prompt).toContain('conversational_suggestions');
      expect(prompt).toContain('Nursing assessment');
      expect(prompt).toContain('nursing interventions');
    });

    it('should identify as SmartScribe, not Riley', () => {
      const prompt = buildNurseFallbackPrompt(transcript);
      expect(prompt).toContain('SmartScribe');
      expect(prompt).not.toContain('Riley');
    });
  });

  describe('Physician Fallback Prompt — retains billing', () => {
    it('should include billing codes in physician fallback', () => {
      const prompt = buildPhysicianFallbackPrompt(transcript);
      expect(prompt).toContain('suggestedCodes');
      expect(prompt).toContain('totalRevenueIncrease');
      expect(prompt).toContain('complianceRisk');
    });

    it('should include grounding rules in physician fallback', () => {
      const prompt = buildPhysicianFallbackPrompt(transcript);
      expect(prompt).toContain('GROUNDING (MANDATORY)');
      expect(prompt).toContain('DRIFT GUARD');
    });

    it('should NOT include nurse scope guard in physician fallback', () => {
      const prompt = buildPhysicianFallbackPrompt(transcript);
      expect(prompt).not.toContain('NURSE SCOPE BOUNDARIES');
    });
  });

  describe('process-medical-transcript Fallback — Grounding Rules', () => {
    it('should include condensed grounding rules in fallback prompt', () => {
      const prompt = buildProcessTranscriptFallback(transcript, 'office_visit', 300);
      expect(prompt).toContain('GROUNDING (MANDATORY)');
      expect(prompt).toContain('Document ONLY what is in the transcript');
      expect(prompt).toContain('No fabrication');
    });

    it('should require transcript evidence for billing codes', () => {
      const prompt = buildProcessTranscriptFallback(transcript, 'office_visit', 300);
      expect(prompt).toContain('transcriptEvidence');
      expect(prompt).toContain('Every code must cite transcript evidence');
    });

    it('should include session context in fallback prompt', () => {
      const prompt = buildProcessTranscriptFallback(transcript, 'follow_up', 600, 'patient-abc');
      expect(prompt).toContain('follow_up');
      expect(prompt).toContain('600');
      expect(prompt).toContain('patient-abc');
    });
  });

  describe('Mode Validation', () => {
    it('should accept "smartscribe" as valid mode', () => {
      expect(validateScribeMode('smartscribe')).toBe('smartscribe');
    });

    it('should accept "compass-riley" as valid mode', () => {
      expect(validateScribeMode('compass-riley')).toBe('compass-riley');
    });

    it('should accept "consultation" as valid mode', () => {
      expect(validateScribeMode('consultation')).toBe('consultation');
    });

    it('should reject unknown modes and default to compass-riley', () => {
      expect(validateScribeMode('unknown')).toBe('compass-riley');
      expect(validateScribeMode('billing-mode')).toBe('compass-riley');
      expect(validateScribeMode('')).toBe('compass-riley');
    });

    it('should reject XSS-like mode strings', () => {
      expect(validateScribeMode('<script>alert(1)</script>')).toBe('compass-riley');
      expect(validateScribeMode('"; DROP TABLE users; --')).toBe('compass-riley');
    });

    it('should reject close-but-wrong mode names', () => {
      expect(validateScribeMode('smart-scribe')).toBe('compass-riley');
      expect(validateScribeMode('SmartScribe')).toBe('compass-riley');
      expect(validateScribeMode('compass_riley')).toBe('compass-riley');
      expect(validateScribeMode('CONSULTATION')).toBe('compass-riley');
    });
  });

  describe('NURSE_SCOPE_GUARD Content Verification', () => {
    it('should forbid billing code suggestions', () => {
      expect(NURSE_SCOPE_GUARD).toContain('NO BILLING CODES');
      expect(NURSE_SCOPE_GUARD).toContain('Do NOT suggest CPT, HCPCS, or ICD-10 codes');
    });

    it('should forbid medication dosing recommendations', () => {
      expect(NURSE_SCOPE_GUARD).toContain('NO MEDICATION DOSING');
      expect(NURSE_SCOPE_GUARD).toContain('Do NOT recommend medication doses, frequencies, routes, or changes');
    });

    it('should forbid MDM complexity reasoning', () => {
      expect(NURSE_SCOPE_GUARD).toContain('NO MDM REASONING');
      expect(NURSE_SCOPE_GUARD).toContain('Do NOT assess medical decision-making complexity');
      expect(NURSE_SCOPE_GUARD).toContain('E/M levels');
      expect(NURSE_SCOPE_GUARD).toContain('upcoding opportunities');
    });

    it('should forbid revenue optimization', () => {
      expect(NURSE_SCOPE_GUARD).toContain('NO REVENUE OPTIMIZATION');
      expect(NURSE_SCOPE_GUARD).toContain('reimbursement');
      expect(NURSE_SCOPE_GUARD).toContain('revenue increases');
    });

    it('should include nursing documentation focus areas', () => {
      expect(NURSE_SCOPE_GUARD).toContain('nursing terminology');
      expect(NURSE_SCOPE_GUARD).toContain('I&O, ADLs, ROM');
      expect(NURSE_SCOPE_GUARD).toContain('head-to-toe');
      expect(NURSE_SCOPE_GUARD).toContain('Care plan updates');
      expect(NURSE_SCOPE_GUARD).toContain('Shift handoff');
      expect(NURSE_SCOPE_GUARD).toContain('Fall risk');
      expect(NURSE_SCOPE_GUARD).toContain('skin integrity');
      expect(NURSE_SCOPE_GUARD).toContain('pain assessment');
    });

    it('should include scope limit for physician orders', () => {
      expect(NURSE_SCOPE_GUARD).toContain('physician orders');
      expect(NURSE_SCOPE_GUARD).toContain('transcribe them as stated');
      expect(NURSE_SCOPE_GUARD).toContain('Do NOT interpret, expand, or suggest alternatives');
    });
  });
});
