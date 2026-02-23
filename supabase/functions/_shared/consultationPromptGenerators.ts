// Consultation Prompt Generators — Compass Riley Physician Consultation Mode
// Sessions 7–8 of Compass Riley Clinical Reasoning Hardening (2026-02-23)
//
// A second operating mode beyond scribe — Riley becomes a clinical reasoning
// partner for complex cases, structured case presentations, and Socratic reasoning.
// Session 8: Enhanced differentials, structured cannot-miss, peer consult prep.
// All guardrails from Sessions 1–3 enforced: anti-hallucination, drift guard, patient safety.

import type { ProviderPreferences, ConversationContext } from './conversationalScribePrompts.ts';
import { getVerbosityInstruction } from './conversationalScribePrompts.ts';
import { CLINICAL_GROUNDING_RULES, CONDENSED_GROUNDING_RULES } from './clinicalGroundingRules.ts';
import { FULL_DRIFT_GUARD, CONDENSED_DRIFT_GUARD } from './conversationDriftGuard.ts';
import type { EncounterState } from './encounterStateManager.ts';
import { serializeEncounterStateForPrompt } from './encounterStateManager.ts';

/**
 * Structured case presentation — the standard format physicians use to present
 * cases to colleagues, consultants, and during morning report.
 */
export interface CasePresentation {
  /** One-liner: Age/sex with chief complaint */
  oneLiner: string;
  /** History of present illness (narrative) */
  hpi: string;
  /** Past medical/surgical history */
  pastMedicalHistory: string[];
  /** Current medications */
  medications: string[];
  /** Allergies */
  allergies: string[];
  /** Social history highlights */
  socialHistory: string[];
  /** Family history highlights */
  familyHistory: string[];
  /** Relevant review of systems findings */
  ros: string[];
  /** Physical exam findings */
  physicalExam: Record<string, string[]>;
  /** Labs and diagnostics */
  diagnostics: string[];
  /** Assessment with differential diagnosis */
  assessment: string;
  /** Working diagnoses ranked by probability */
  differentials: Array<{
    diagnosis: string;
    icd10?: string;
    probability: 'high' | 'moderate' | 'low';
    supporting: string[];
    against: string[];
    /** Session 8: Red flag symptoms that would escalate this diagnosis */
    redFlags?: string[];
    /** Session 8: The single most discriminating test for this diagnosis */
    keyTest?: string;
    /** Session 8: Brief PubMed-sourced note when available */
    literatureNote?: string;
  }>;
  /** Plan items */
  plan: string[];
}

/**
 * Socratic reasoning step — structured clinical reasoning output
 */
export interface SocraticReasoningStep {
  /** The reasoning question posed */
  question: string;
  /** Clinical reasoning analysis */
  analysis: string;
  /** Key considerations the physician should weigh */
  considerations: string[];
  /** What data/findings would change the assessment */
  pivotPoints: string[];
}

/**
 * Session 8: Structured cannot-miss diagnosis — not just a name,
 * but WHY it's dangerous, HOW to distinguish it, and WHAT test rules it out.
 */
export interface CannotMissDiagnosis {
  /** The dangerous diagnosis */
  diagnosis: string;
  /** How lethal/urgent this is */
  severity: 'life-threatening' | 'emergent' | 'urgent';
  /** Why missing this would be catastrophic */
  whyDangerous: string;
  /** Key features that would distinguish this from the working diagnosis */
  distinguishingFeatures: string[];
  /** The one test that rules this in or out */
  ruleOutTest: string;
  /** Clinical timeframe for action (e.g., "within 1 hour", "before discharge") */
  timeframe: string;
}

/**
 * Session 8: Peer consultation summary — tailored to receiving specialty.
 * Generated on-demand when physician requests consult prep.
 */
export interface PeerConsultSummary {
  /** Target specialty (e.g., "Cardiology", "Neurology") */
  targetSpecialty: string;
  /** SBAR-formatted summary: Situation */
  situation: string;
  /** SBAR: Background */
  background: string;
  /** SBAR: Assessment */
  assessment: string;
  /** SBAR: Recommendation — what you want from the consultant */
  recommendation: string;
  /** Key data points the consultant will want */
  criticalData: string[];
  /** The specific question for the consultant */
  consultQuestion: string;
  /** Urgency level */
  urgency: 'stat' | 'urgent' | 'routine';
}

/**
 * Full consultation response sent back to the client
 */
export interface ConsultationResponse {
  /** Structured case presentation */
  casePresentation: CasePresentation;
  /** Socratic reasoning steps */
  reasoningSteps: SocraticReasoningStep[];
  /** Critical "what am I missing?" items — structured for Session 8 */
  cannotMiss: CannotMissDiagnosis[];
  /** Suggested additional workup */
  suggestedWorkup: string[];
  /** Guideline-based recommendations with citations */
  guidelineNotes: string[];
  /** Confidence calibration — what Riley is certain vs uncertain about */
  confidenceCalibration: {
    highConfidence: string[];
    uncertain: string[];
    insufficientData: string[];
  };
  /** Grounding flags from anti-hallucination system */
  groundingFlags: {
    statedCount: number;
    inferredCount: number;
    gapCount: number;
    gaps: string[];
  };
}

/**
 * Generate the consultation mode prompt for a complex case analysis.
 * Riley becomes a clinical reasoning partner, not a scribe.
 *
 * @param transcript De-identified transcript of the encounter
 * @param prefs Provider preferences for tone/style
 * @param encounterState Running clinical picture from the encounter
 * @param context Optional conversation context
 */
export function getConsultationPrompt(
  transcript: string,
  prefs: ProviderPreferences,
  encounterState?: EncounterState,
  context?: ConversationContext
): string {
  const isNewProvider = prefs.interaction_count < 10;
  const stateContext = encounterState ? serializeEncounterStateForPrompt(encounterState) : '';

  // Tone calibration
  const toneInstruction = prefs.formality_level === 'formal'
    ? 'Maintain a professional, evidence-based tone. Structure responses as you would for a clinical conference.'
    : prefs.formality_level === 'casual'
      ? 'Be conversational but rigorous — like a smart colleague thinking through a case over coffee.'
      : 'Be professional but approachable — the attending you actually want to discuss cases with.';

  // Premium vs standard
  if (prefs.premium_mode) {
    return getFullConsultationPrompt(transcript, prefs, toneInstruction, stateContext, isNewProvider);
  }

  return getCondensedConsultationPrompt(transcript, prefs, toneInstruction, stateContext);
}

/**
 * Standard (token-optimized) consultation prompt
 */
function getCondensedConsultationPrompt(
  transcript: string,
  prefs: ProviderPreferences,
  toneInstruction: string,
  stateContext: string
): string {
  return `You are Compass Riley in CONSULTATION MODE — a clinical reasoning partner, not a scribe.
${toneInstruction}

${CONDENSED_GROUNDING_RULES}
${CONDENSED_DRIFT_GUARD}
${stateContext ? `\n${stateContext}\n` : ''}
TRANSCRIPT: ${transcript}

Return ONLY JSON matching this schema:
{
  "casePresentation": {
    "oneLiner": "Age/sex with CC — one sentence",
    "hpi": "Narrative HPI from transcript ONLY",
    "pastMedicalHistory": ["condition1"],
    "medications": ["med1"],
    "allergies": ["allergy1"],
    "socialHistory": ["relevant items"],
    "familyHistory": ["relevant items"],
    "ros": ["positive/negative findings ONLY if discussed"],
    "physicalExam": {"system": ["findings"]},
    "diagnostics": ["lab/imaging results mentioned"],
    "assessment": "Clinical synthesis — connect findings to diagnoses",
    "differentials": [
      {"diagnosis":"name","icd10":"code","probability":"high|moderate|low","supporting":["evidence"],"against":["evidence"],"redFlags":["red flag symptoms"],"keyTest":"single most discriminating test","literatureNote":"brief evidence note if available"}
    ],
    "plan": ["plan items from transcript"]
  },
  "reasoningSteps": [
    {"question":"Clinical reasoning question","analysis":"Reasoning","considerations":["key points"],"pivotPoints":["what would change assessment"]}
  ],
  "cannotMiss": [{"diagnosis":"name","severity":"life-threatening|emergent|urgent","whyDangerous":"why missing this is catastrophic","distinguishingFeatures":["key distinguishing features"],"ruleOutTest":"the one test to rule this out","timeframe":"clinical timeframe for action"}],
  "suggestedWorkup": ["Tests/studies that would clarify the picture"],
  "guidelineNotes": ["Guideline-based recommendations with source"],
  "confidenceCalibration": {
    "highConfidence": ["assertions well-supported by transcript"],
    "uncertain": ["areas needing clarification"],
    "insufficientData": ["expected data not in transcript"]
  },
  "groundingFlags": {"statedCount":0,"inferredCount":0,"gapCount":0,"gaps":[]}
}

RULES:
- ${getVerbosityInstruction(prefs.verbosity)}
- NEVER fabricate clinical details — all assertions must trace to transcript
- Differentials: rank by probability, include supporting AND refuting evidence, add redFlags and keyTest
- cannotMiss: structured — include severity, why dangerous, distinguishing features, rule-out test, timeframe
- reasoningSteps: Socratic — pose the questions a senior attending would ask
- confidenceCalibration: separate what you KNOW from what you're GUESSING`;
}

/**
 * Premium (full verbose) consultation prompt — maximum clinical detail
 */
function getFullConsultationPrompt(
  transcript: string,
  prefs: ProviderPreferences,
  toneInstruction: string,
  stateContext: string,
  isNewProvider: boolean
): string {
  return `## COMPASS RILEY — CONSULTATION MODE

You are Compass Riley operating as a **clinical reasoning partner**. This is NOT scribe mode. You are helping this physician THINK THROUGH a case — like a senior attending or a sharp colleague during a curbside consult.

${toneInstruction}

${isNewProvider ? '**New provider relationship — be thorough and explain your reasoning. They\'re learning how you think.**' : '**Established provider — they trust your clinical reasoning. Be efficient but thorough.**'}

---

${CLINICAL_GROUNDING_RULES}

${FULL_DRIFT_GUARD}

---
${stateContext ? `\n${stateContext}\n\n---\n` : ''}
## ENCOUNTER TRANSCRIPT (De-identified PHI)

${transcript}

---

## YOUR TASK: Clinical Reasoning Partner

Think through this case systematically. You are NOT documenting — you are REASONING. Help the physician see what they might be missing, consider alternative diagnoses, and think through the next steps.

### 1. STRUCTURED CASE PRESENTATION

Present this case as a physician would to a colleague:
- **One-liner**: Age/sex + chief complaint in one sentence
- **HPI**: Narrative from transcript ONLY (use OLDCARTS if elements are present)
- **PMH/PSH**: Only what's mentioned in transcript
- **Medications**: Only what's mentioned
- **Allergies**: Only what's mentioned (or [NOT DOCUMENTED])
- **Social/Family Hx**: Only what's mentioned
- **ROS**: Only systems actually discussed
- **Physical Exam**: Only findings actually described
- **Diagnostics**: Only results mentioned
- **Assessment**: Your clinical synthesis — connect findings to diagnoses
- **Differentials**: Ranked by probability with evidence for/against each, red flags, key discriminating test, and brief literature note

### 2. SOCRATIC CLINICAL REASONING

Think like a senior attending. Pose 2-4 reasoning questions that help the physician think more deeply about this case:
- "What would you expect to see if this were [diagnosis X]?"
- "Given the [finding], have you considered [alternative]?"
- "What's the one test that would most change your management?"

For each question, provide your own analysis and the key pivot points.

### 3. CANNOT-MISS DIAGNOSES (Structured)

For each dangerous diagnosis that MUST be ruled out, provide:
- **Diagnosis** and **severity** (life-threatening, emergent, or urgent)
- **Why dangerous** — what happens if missed
- **Distinguishing features** — key findings that would point to this over the working diagnosis
- **Rule-out test** — the single most important test to confirm or exclude
- **Timeframe** — how quickly must this be acted on

Think worst-case-first. A good doctor doesn't just diagnose what's likely — they rule out what's lethal.

### 4. SUGGESTED WORKUP

Based on the differential, what additional tests, imaging, or consultations would clarify the clinical picture? Only suggest what's clinically indicated, not a shotgun workup.

### 5. GUIDELINE-BASED NOTES

Reference relevant clinical guidelines (ADA, ACC/AHA, GOLD, etc.) where applicable. Include the guideline name and key recommendation.

### 6. CONFIDENCE CALIBRATION

Be honest about what you know vs. what you're guessing:
- **High Confidence**: Assertions well-supported by transcript evidence
- **Uncertain**: Areas where the data is ambiguous
- **Insufficient Data**: Expected information that's missing from the transcript

---

Return ONLY valid JSON:

\`\`\`json
{
  "casePresentation": {
    "oneLiner": "string",
    "hpi": "string",
    "pastMedicalHistory": ["string"],
    "medications": ["string"],
    "allergies": ["string"],
    "socialHistory": ["string"],
    "familyHistory": ["string"],
    "ros": ["string"],
    "physicalExam": {"system": ["findings"]},
    "diagnostics": ["string"],
    "assessment": "string",
    "differentials": [
      {
        "diagnosis": "string",
        "icd10": "string or null",
        "probability": "high | moderate | low",
        "supporting": ["evidence from transcript"],
        "against": ["evidence against or missing evidence"],
        "redFlags": ["red flag symptoms that would escalate this diagnosis"],
        "keyTest": "single most discriminating test for this diagnosis",
        "literatureNote": "brief PubMed-sourced note if available"
      }
    ],
    "plan": ["string"]
  },
  "reasoningSteps": [
    {
      "question": "Socratic clinical question",
      "analysis": "Your reasoning",
      "considerations": ["key points"],
      "pivotPoints": ["what would change the assessment"]
    }
  ],
  "cannotMiss": [
    {
      "diagnosis": "string",
      "severity": "life-threatening | emergent | urgent",
      "whyDangerous": "why missing this would be catastrophic",
      "distinguishingFeatures": ["key features that distinguish from working dx"],
      "ruleOutTest": "the one test that rules this in or out",
      "timeframe": "clinical timeframe for action (e.g., within 1 hour)"
    }
  ],
  "suggestedWorkup": ["Clinically indicated tests/studies"],
  "guidelineNotes": ["Guideline references with recommendations"],
  "confidenceCalibration": {
    "highConfidence": ["well-supported assertions"],
    "uncertain": ["ambiguous areas"],
    "insufficientData": ["missing expected data"]
  },
  "groundingFlags": {
    "statedCount": 0,
    "inferredCount": 0,
    "gapCount": 0,
    "gaps": ["expected elements not in transcript"]
  }
}
\`\`\`

---

**Remember:**
- You are a THINKING partner, not a documentation tool
- NEVER fabricate clinical details — if it wasn't in the transcript, say so
- Differentials: clinically thoughtful, include redFlags and keyTest for each
- cannotMiss: structured with severity, danger, distinguishing features, rule-out test, and timeframe
- ${getVerbosityInstruction(prefs.verbosity)}
- Include groundingFlags — the physician needs to know what's documented vs. gaps
- Think like the attending everyone wants to work with — sharp, thorough, humble about uncertainty`;
}

// =====================================================
// Session 8: Peer Consult Prep Prompt
// =====================================================

/** Supported specialties for consult prep framing */
export const CONSULT_SPECIALTIES = [
  'Cardiology', 'Pulmonology', 'Neurology', 'Gastroenterology',
  'Nephrology', 'Endocrinology', 'Infectious Disease', 'Hematology/Oncology',
  'Rheumatology', 'Surgery', 'Psychiatry', 'Critical Care',
] as const;

export type ConsultSpecialty = typeof CONSULT_SPECIALTIES[number];

/**
 * Generate a peer consult prep prompt — physician says "I need to call cardiology"
 * and Riley generates a structured SBAR summary tailored to that specialty.
 */
export function getConsultPrepPrompt(
  transcript: string,
  specialty: string,
  consultationResponse: ConsultationResponse | null,
  prefs: ProviderPreferences,
  encounterState?: EncounterState
): string {
  const stateContext = encounterState ? serializeEncounterStateForPrompt(encounterState) : '';

  // If we already have a consultation response, include its key findings
  const priorAnalysis = consultationResponse
    ? `\n## PRIOR CONSULTATION ANALYSIS (from this encounter)\nOne-liner: ${consultationResponse.casePresentation.oneLiner}\nAssessment: ${consultationResponse.casePresentation.assessment}\nDifferentials: ${consultationResponse.casePresentation.differentials.map(d => `${d.diagnosis} (${d.probability})`).join(', ')}\nCannot-miss: ${consultationResponse.cannotMiss.map(c => c.diagnosis).join(', ')}\n`
    : '';

  return `## COMPASS RILEY — PEER CONSULT PREP MODE

You are Compass Riley helping a physician prepare a **curbside consult with ${specialty}**. Generate a crisp, specialty-appropriate SBAR summary that respects the consultant's time and gives them exactly what they need.

${CONDENSED_GROUNDING_RULES}
${stateContext ? `\n${stateContext}\n` : ''}
${priorAnalysis}
## ENCOUNTER TRANSCRIPT (De-identified)
${transcript}

---

## YOUR TASK: Prepare a Consult Summary for ${specialty}

Generate a structured SBAR summary tailored to what a **${specialty} consultant** would want to hear. Think about:
- What data points does this specialty care about most?
- What have you already done that they'd want to know?
- What specific question are you asking them?

Return ONLY valid JSON:

\`\`\`json
{
  "targetSpecialty": "${specialty}",
  "situation": "Brief: who is the patient and why are you calling (1-2 sentences)",
  "background": "Relevant history, meds, labs — filtered for what ${specialty} needs",
  "assessment": "Your clinical impression and why you need ${specialty} input",
  "recommendation": "What you want from the consultant — specific ask",
  "criticalData": ["Key data points the consultant will want immediately"],
  "consultQuestion": "The specific clinical question for the consultant",
  "urgency": "stat | urgent | routine"
}
\`\`\`

**Rules:**
- ${getVerbosityInstruction(prefs.verbosity)}
- NEVER fabricate — only include data from the transcript
- Filter for ${specialty}-relevant information — don't dump the whole chart
- consultQuestion should be specific and answerable: "Does this patient need emergent cath?" not "What do you think?"
- urgency: stat = needs action now, urgent = within hours, routine = can wait
- Think SBAR: the consultant is busy, be concise and actionable`;
}
