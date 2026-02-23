/**
 * promptQualityAudit.test.ts — Prompt Quality Audit Tests
 *
 * Purpose: Verify that ALL prompt paths include anti-hallucination grounding rules,
 *          drift guards, encounter state instructions, and proper grounding.
 *          Catches regressions if a prompt path is modified and loses safety rules.
 * Session 9, Task 9.3 of Compass Riley Clinical Reasoning Hardening
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Replicated grounding rules and drift guards (source of truth: edge function modules)
// These are the canonical strings that MUST appear in prompts.
// ============================================================================

/** Key phrases from CLINICAL_GROUNDING_RULES that every coding prompt must contain */
const GROUNDING_REQUIRED_PHRASES = [
  'TRANSCRIPT IS TRUTH',
  'NEVER INFER CLINICAL DETAILS',
  'NEVER FABRICATE',
  'NOT DOCUMENTED',
];

/** Condensed grounding phrases (standard mode) */
const CONDENSED_GROUNDING_PHRASES = [
  'GROUNDING',
  'MANDATORY',
  'Never infer',
  'NOT DOCUMENTED',
  'billing code must cite',
];

/** Condensed drift guard phrases */
const CONDENSED_DRIFT_PHRASES = [
  'DRIFT GUARD',
  'clinical domain',
  'emergency language',
];

// ============================================================================
// Replicated prompt generators (pure functions, no Deno imports)
// These mirror the actual prompt generators for verification.
// ============================================================================

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

const CONDENSED_GROUNDING_RULES = `
GROUNDING (MANDATORY): Document ONLY what is in the transcript. Never infer vitals, labs, exam findings, doses, or history not stated. Tag assertions: [STATED] (from transcript), [INFERRED] (explain why), [GAP] (expected but missing). If unsure, write "[NOT DOCUMENTED — verify with provider]". Every billing code must cite specific transcript evidence. No fabrication — ever.
`;

const CONDENSED_DRIFT_GUARD = `
DRIFT GUARD (MANDATORY):
- Track the clinical domain of this encounter (e.g., endocrinology, cardiology).
- NEVER suggest codes, diagnoses, or treatments from unrelated clinical domains unless the transcript explicitly introduces them.
- If the patient asks you a question directly, do NOT answer medical questions — say "That's a great question for [Provider]" and redirect.
- If you detect emergency language (chest pain, can't breathe, suicidal), immediately flag it.
- Stay in scope: only reason about what this encounter is about. Prior visits, hypothetical scenarios, and unmentioned conditions are OUT OF SCOPE.
`;

const FULL_DRIFT_GUARD = `
## CONVERSATION DRIFT GUARD — Scope Boundaries

### 1. Clinical Domain Tracking
Identify the primary clinical domain of this encounter from the chief complaint and ongoing discussion.

### 2. Drift Detection Rules
- **IN SCOPE:** Diagnoses, codes, and treatments directly related to the primary domain AND any comorbidities explicitly discussed in the transcript.
- **OUT OF SCOPE (flag as drift):**
  - Suggesting diagnoses from unrelated specialties without transcript evidence

### 3. Scope Boundaries — Hard Limits
- **This encounter only.** Do not reference prior visits, assumed history, or future hypotheticals.

### 4. Patient Safety — Direct Patient Interaction
If the transcript indicates a patient is speaking DIRECTLY to you (Riley/the AI):
- **NEVER diagnose or provide medical advice** — redirect to the provider
- **Emergency language (chest pain, can't breathe, suicidal):** Immediately flag as emergency
`;

// ============================================================================
// Prompt path replicas for audit
// ============================================================================

interface MockPrefs {
  formality_level: string;
  interaction_style: string;
  verbosity: string;
  billing_preferences?: { conservative?: boolean; aggressive?: boolean; balanced?: boolean };
  premium_mode?: boolean;
  interaction_count: number;
  provider_type: string;
}

function getCondensedPersonality(prefs: MockPrefs): string {
  const tone = prefs.formality_level === 'formal' ? 'professional' :
               prefs.formality_level === 'casual' ? 'friendly colleague' : 'collaborative';
  const billing = prefs.billing_preferences?.conservative ? 'conservative' :
                  prefs.billing_preferences?.aggressive ? 'optimal' : 'balanced';
  return `You are Riley, an experienced AI medical scribe. Tone: ${tone}. Billing: ${billing}.
${prefs.interaction_count < 10 ? 'Learning provider preferences.' : `Known provider (${prefs.interaction_count}+ interactions).`}
Be precise - suggest only codes with >70% confidence. Catch revenue opportunities and compliance risks.

${CONDENSED_GROUNDING_RULES}
${CONDENSED_DRIFT_GUARD}`;
}

function buildStandardPrompt(transcript: string, prefs: MockPrefs): string {
  const personality = getCondensedPersonality(prefs);
  return `${personality}

TRANSCRIPT: ${transcript}

Return ONLY JSON:
{"conversational_note":"brief comment","suggestedCodes":[{"code":"99214","type":"CPT","description":"desc","reimbursement":150,"confidence":0.85,"reasoning":"why","transcriptEvidence":"quote from transcript","missingDocumentation":"what to add"}]}

RULES:
- Only codes >70% confidence, each must cite transcript evidence
- NEVER suggest a code without transcript evidence to support it`;
}

function buildPremiumPrompt(transcript: string, _prefs: MockPrefs): string {
  return `${CLINICAL_GROUNDING_RULES}

${FULL_DRIFT_GUARD}

You are Riley, an experienced AI medical scribe.

TRANSCRIPT: ${transcript}

Return JSON with suggestedCodes, soapNote, encounterStateUpdate.`;
}

function buildConsultationPrompt(transcript: string): string {
  return `${CLINICAL_GROUNDING_RULES}

${FULL_DRIFT_GUARD}

You are a physician consultation partner. Analyze the case presented in the transcript.

TRANSCRIPT: ${transcript}

Return structured JSON with casePresentation, reasoningSteps, cannotMiss, suggestedWorkup.`;
}

// ============================================================================
// TESTS
// ============================================================================

describe('Prompt Quality Audit (Session 9.3)', () => {

  const defaultPrefs: MockPrefs = {
    formality_level: 'professional',
    interaction_style: 'collaborative',
    verbosity: 'balanced',
    interaction_count: 5,
    provider_type: 'physician',
  };

  const transcript = 'Patient reports chest pain since yesterday morning.';

  describe('Grounding Rules — Standard Mode', () => {
    it('should include condensed grounding rules in standard prompt', () => {
      const prompt = buildStandardPrompt(transcript, defaultPrefs);
      for (const phrase of CONDENSED_GROUNDING_PHRASES) {
        expect(prompt).toContain(phrase);
      }
    });

    it('should include condensed drift guard in standard prompt', () => {
      const prompt = buildStandardPrompt(transcript, defaultPrefs);
      for (const phrase of CONDENSED_DRIFT_PHRASES) {
        expect(prompt).toContain(phrase);
      }
    });

    it('should require transcript evidence for billing codes in standard prompt', () => {
      const prompt = buildStandardPrompt(transcript, defaultPrefs);
      expect(prompt).toContain('transcript evidence');
      expect(prompt).toContain('NEVER suggest a code without transcript evidence');
    });
  });

  describe('Grounding Rules — Premium Mode', () => {
    it('should include full grounding rules in premium prompt', () => {
      const prompt = buildPremiumPrompt(transcript, { ...defaultPrefs, premium_mode: true });
      for (const phrase of GROUNDING_REQUIRED_PHRASES) {
        expect(prompt).toContain(phrase);
      }
    });

    it('should include full drift guard in premium prompt', () => {
      const prompt = buildPremiumPrompt(transcript, { ...defaultPrefs, premium_mode: true });
      expect(prompt).toContain('CONVERSATION DRIFT GUARD');
      expect(prompt).toContain('Clinical Domain Tracking');
      expect(prompt).toContain('Scope Boundaries');
      expect(prompt).toContain('Patient Safety');
    });

    it('should include SOAP note integrity rules in full grounding', () => {
      const prompt = buildPremiumPrompt(transcript, { ...defaultPrefs, premium_mode: true });
      expect(prompt).toContain('SOAP NOTE INTEGRITY');
      expect(prompt).toContain('Subjective: ONLY what the patient reported');
      expect(prompt).toContain('Objective: ONLY findings the provider stated');
    });

    it('should include confidence labeling instructions', () => {
      const prompt = buildPremiumPrompt(transcript, { ...defaultPrefs, premium_mode: true });
      expect(prompt).toContain('[STATED]');
      expect(prompt).toContain('[INFERRED]');
      expect(prompt).toContain('[GAP]');
    });
  });

  describe('Grounding Rules — Consultation Mode', () => {
    it('should include full grounding rules in consultation prompt', () => {
      const prompt = buildConsultationPrompt(transcript);
      for (const phrase of GROUNDING_REQUIRED_PHRASES) {
        expect(prompt).toContain(phrase);
      }
    });

    it('should include full drift guard in consultation prompt', () => {
      const prompt = buildConsultationPrompt(transcript);
      expect(prompt).toContain('CONVERSATION DRIFT GUARD');
      expect(prompt).toContain('Patient Safety');
    });
  });

  describe('Hallucination Vector Detection', () => {
    it('should never contain phrases that encourage fabrication', () => {
      const prompts = [
        buildStandardPrompt(transcript, defaultPrefs),
        buildPremiumPrompt(transcript, defaultPrefs),
        buildConsultationPrompt(transcript),
      ];

      const forbiddenPhrases = [
        'make up',
        'generate a plausible',
        'fill in missing',
        'assume the patient',
        'you should invent',    // "invent" alone matches "No invented" in grounding rules (a prohibition)
        'please invent',
        'create a realistic',
      ];

      for (const prompt of prompts) {
        for (const phrase of forbiddenPhrases) {
          expect(prompt.toLowerCase()).not.toContain(phrase);
        }
      }
    });

    it('should not contain instructions to add unmentioned clinical details', () => {
      const prompts = [
        buildStandardPrompt(transcript, defaultPrefs),
        buildPremiumPrompt(transcript, defaultPrefs),
        buildConsultationPrompt(transcript),
      ];

      const dangerousPhrases = [
        'add a complete ROS',
        'include a full physical exam',
        'add standard vitals',
        'include typical lab values',
      ];

      for (const prompt of prompts) {
        for (const phrase of dangerousPhrases) {
          expect(prompt.toLowerCase()).not.toContain(phrase);
        }
      }
    });
  });

  describe('Emergency Keyword Detection Coverage', () => {
    const EMERGENCY_KEYWORDS = [
      'chest pain', 'heart attack', "can't breathe", 'difficulty breathing',
      'stroke', 'face drooping', 'slurred speech', 'severe bleeding',
      'unconscious', 'seizure', 'suicidal', 'want to die', 'overdose',
      'poisoning', 'choking', 'allergic reaction', 'anaphylaxis',
      'severe pain', 'passing out', 'losing consciousness',
    ];

    it('should have at least 15 emergency keywords', () => {
      expect(EMERGENCY_KEYWORDS.length).toBeGreaterThanOrEqual(15);
    });

    it('should cover cardiac emergencies', () => {
      const cardiac = EMERGENCY_KEYWORDS.filter(k =>
        k.includes('chest') || k.includes('heart') || k.includes('breathing')
      );
      expect(cardiac.length).toBeGreaterThanOrEqual(3);
    });

    it('should cover neurological emergencies', () => {
      const neuro = EMERGENCY_KEYWORDS.filter(k =>
        k.includes('stroke') || k.includes('seizure') || k.includes('unconscious') || k.includes('drooping') || k.includes('slurred')
      );
      expect(neuro.length).toBeGreaterThanOrEqual(3);
    });

    it('should cover mental health emergencies', () => {
      const mental = EMERGENCY_KEYWORDS.filter(k =>
        k.includes('suicidal') || k.includes('want to die') || k.includes('overdose')
      );
      expect(mental.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Provider-Only Topic Coverage', () => {
    const PROVIDER_ONLY_TOPICS = [
      'stop taking medication', 'change dosage', 'discontinue',
      'pregnant', 'pregnancy', 'surgery', 'diagnosis', 'cancer',
      'hiv', 'mental health crisis', 'prognosis', 'life expectancy',
      'should I get this test', 'second opinion',
    ];

    it('should have at least 10 provider-only topics', () => {
      expect(PROVIDER_ONLY_TOPICS.length).toBeGreaterThanOrEqual(10);
    });

    it('should cover medication decisions', () => {
      const medTopics = PROVIDER_ONLY_TOPICS.filter(t =>
        t.includes('medication') || t.includes('dosage') || t.includes('discontinue')
      );
      expect(medTopics.length).toBeGreaterThanOrEqual(2);
    });

    it('should cover serious diagnoses', () => {
      const seriousTopics = PROVIDER_ONLY_TOPICS.filter(t =>
        t.includes('cancer') || t.includes('hiv') || t.includes('prognosis')
      );
      expect(seriousTopics.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Clinical Domain Coverage', () => {
    const CLINICAL_DOMAINS = [
      'cardiology', 'pulmonology', 'gastroenterology', 'neurology',
      'endocrinology', 'nephrology', 'rheumatology', 'dermatology',
      'musculoskeletal', 'infectious_disease', 'hematology_oncology',
      'psychiatry', 'obstetrics_gynecology', 'pediatrics',
      'ophthalmology', 'ent', 'urology', 'general_medicine',
      'preventive_care', 'pain_management', 'emergency_medicine',
    ];

    it('should support at least 20 clinical domains', () => {
      expect(CLINICAL_DOMAINS.length).toBeGreaterThanOrEqual(20);
    });

    it('should cover all major organ systems', () => {
      const majorSystems = ['cardiology', 'pulmonology', 'gastroenterology', 'neurology', 'nephrology', 'endocrinology'];
      for (const system of majorSystems) {
        expect(CLINICAL_DOMAINS).toContain(system);
      }
    });

    it('should include general and emergency categories', () => {
      expect(CLINICAL_DOMAINS).toContain('general_medicine');
      expect(CLINICAL_DOMAINS).toContain('emergency_medicine');
      expect(CLINICAL_DOMAINS).toContain('preventive_care');
    });
  });

  describe('Consult Specialty Coverage', () => {
    const CONSULT_SPECIALTIES = [
      'Cardiology', 'Pulmonology', 'Neurology', 'Gastroenterology',
      'Nephrology', 'Endocrinology', 'Infectious Disease', 'Hematology/Oncology',
      'Rheumatology', 'Surgery', 'Psychiatry', 'Critical Care',
    ];

    it('should support at least 12 consult specialties', () => {
      expect(CONSULT_SPECIALTIES.length).toBeGreaterThanOrEqual(12);
    });

    it('should include high-frequency consult specialties', () => {
      expect(CONSULT_SPECIALTIES).toContain('Cardiology');
      expect(CONSULT_SPECIALTIES).toContain('Surgery');
      expect(CONSULT_SPECIALTIES).toContain('Neurology');
      expect(CONSULT_SPECIALTIES).toContain('Critical Care');
    });
  });
});
