/**
 * Clinical Constraint Constants — Browser-side mirror
 *
 * IMPORTANT: These constants are mirrored from:
 *   supabase/functions/_shared/clinicalGroundingRules.ts
 *
 * If you update the edge function version, update this file to match.
 * The adversarial constraint test suite validates both copies stay in sync
 * by testing the constraint text content directly.
 *
 * Why mirrored: Vitest runs in Node/Vite, not Deno. Edge function imports
 * use Deno URL imports that Vitest cannot resolve. This module provides
 * the same exports for browser-side testing and potential future UI use
 * (e.g., displaying constraint categories in admin dashboards).
 */

export type ConstraintCategory =
  | 'universal'
  | 'grounding'
  | 'grounding_condensed'
  | 'billing'
  | 'sdoh'
  | 'drg'
  | 'escalation'
  | 'care_planning'
  | 'nurse_scope';

export const UNIVERSAL_CLINICAL_CONSTRAINTS = `
UNIVERSAL CLINICAL AI CONSTRAINTS — APPLY TO ALL FUNCTIONS:

1. Do NOT fabricate clinical findings not present in the source data.
2. Do NOT recommend care contradicting documented allergies or contraindications.
3. Do NOT assign confidence scores above 0.8 without explicit data support for every assertion.
4. Do NOT suppress required review flags — all clinical AI output requires human review.
5. Do NOT use patient names in AI output — use patient IDs only.
6. Do NOT infer diagnoses, risk factors, or social determinants not documented.
7. If uncertain about any clinical assertion, flag it for review — do NOT guess.
`;

export const CLINICAL_GROUNDING_RULES = `
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

export const CONDENSED_GROUNDING_RULES = `
GROUNDING (MANDATORY): Document ONLY what is in the transcript. Never infer vitals, labs, exam findings, doses, or history not stated. Tag assertions: [STATED] (from transcript), [INFERRED] (explain why), [GAP] (expected but missing). If unsure, write "[NOT DOCUMENTED — verify with provider]". Every billing code must cite specific transcript evidence. No fabrication — ever.
`;

export const NURSE_SCOPE_GUARD = `
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

export const BILLING_CODING_CONSTRAINTS = `
BILLING & CODING CONSTRAINTS — MANDATORY, NO EXCEPTIONS:

1. ICD-10 ONLY: Do NOT suggest ICD-9 codes under any circumstance. This system
   uses ICD-10-CM exclusively. V-codes (V60.0, etc.) are obsolete — use Z-codes.

2. DOCUMENTATION-DRIVEN CODING:
   - Do NOT suggest CPT codes for services not performed during the encounter
   - Do NOT suggest HCPCS codes for supplies not documented as administered
   - Do NOT fabricate modifier codes — only suggest modifiers with documented clinical justification
   - Do NOT assign codes based on historical patterns — each encounter stands on its own documentation
   - Do NOT suggest modifier 25 without a documented separate E/M service

3. NO UPCODING:
   - Do NOT recommend higher-specificity codes unless documentation contains the specific clinical finding
   - Do NOT suggest codes for revenue optimization if documentation does not support them
   - Do NOT present suggestions as final — always label as "advisory, requires coder review"
   - Do NOT auto-populate charge amounts — amounts come from fee schedules, not AI

4. EVERY CODE MUST CITE EVIDENCE: Include the specific documentation excerpt that
   supports each suggested code. If documentation is insufficient, say what is
   missing — do NOT fill the gap with assumptions.
`;

export const SDOH_CODING_CONSTRAINTS = `
SDOH Z-CODE CONSTRAINTS — MANDATORY:

1. Do NOT fabricate Z-codes that do not exist in the ICD-10-CM Z55-Z65 range.
2. Do NOT assign SDOH Z-codes unless social determinants are explicitly documented
   in clinical notes or patient-reported check-ins.
3. Do NOT infer housing insecurity, food insecurity, or transportation barriers
   from demographics alone — documentation must support each code.
4. Do NOT assign Z-codes based on neighborhood, zip code, or assumed socioeconomic status.
5. Do NOT suggest Z59-Z60 codes without a specific, documented patient statement
   or social work assessment.
6. CULTURAL CONTEXT IS NOT DIAGNOSIS: Cultural competency profiles inform screening
   priorities but do NOT justify code assignment without individual documentation.
`;

export const DRG_GROUPER_CONSTRAINTS = `
DRG GROUPER CONSTRAINTS — MANDATORY:

1. Do NOT fabricate ICD-10 codes not explicitly stated in the clinical documentation.
2. Do NOT infer a diagnosis the physician did not document — if it is not written, it does not exist.
3. Do NOT assign a DRG code that does not exist in the current fiscal year MS-DRG table.
4. Do NOT upgrade CC/MCC status based on suspected but undocumented conditions.
5. Do NOT suggest a higher-specificity code unless the documentation contains the specific clinical finding.
6. Do NOT generate a confidence score above 0.8 unless every extracted code has a direct documentation reference.
7. If uncertain, respond with "uncertain" and flag for human review — do NOT guess.
8. Do NOT omit the documentation reference for any suggested code.
9. All output is ADVISORY ONLY — requires certified coder review before use.
`;

export const ESCALATION_RISK_CONSTRAINTS = `
ESCALATION & RISK SCORING CONSTRAINTS — MANDATORY:

1. DATA-GROUNDED SCORING:
   - Do NOT assign risk factors not present in the patient data
   - Do NOT fabricate vital sign trends not present in the input
   - Do NOT escalate based on conditions not documented in the current encounter
   - Do NOT inflate risk scores based on assumed or suspected conditions

2. ESCALATION INTEGRITY:
   - Do NOT assign CRITICAL escalation status without specific, documented clinical triggers
   - Do NOT populate escalation queues with synthetic or assumed severity values
   - Do NOT escalate a patient based on data from a different patient
   - Every escalation must cite the specific data point that triggered it

3. PATIENT IDENTITY PROTECTION:
   - Do NOT use patient names in risk narratives or escalation lists
   - Use patient ID and room/bed number only
   - Do NOT include PHI in AI reasoning output

4. INTERVENTION SAFETY:
   - Do NOT recommend interventions that contradict the patient's documented condition
     (e.g., do NOT recommend increased unsupervised mobility for a HIGH fall-risk patient)
   - Do NOT suppress required review flags — all risk assessments require clinician review
`;

export const CARE_PLANNING_CONSTRAINTS = `
CARE PLANNING & RECOMMENDATION CONSTRAINTS — MANDATORY:

1. CONDITION-MATCHED CARE:
   - Do NOT recommend interventions for conditions the patient does not have
   - Do NOT prioritize billable activities over clinical necessity
   - Do NOT suggest timelines unsupported by evidence for the patient's condition
   - Do NOT create goals that reference undocumented patient preferences

2. GUIDELINE INTEGRITY:
   - Do NOT cite guidelines that do not exist or reference incorrect publication years
   - Do NOT recommend guideline-based care that contradicts documented contraindications
   - Do NOT apply guidelines designed for different populations without flagging the mismatch
   - If evidence grade is unknown, say "evidence level not verified" — do NOT invent one

3. MEDICATION SAFETY:
   - Do NOT recommend medications the patient is allergic to
   - Do NOT omit documented allergies from medication reconciliation
   - Do NOT recommend follow-up care the physician did not order (for discharge summaries)
   - Do NOT fabricate medication changes not documented in the encounter

4. ALL OUTPUT IS ADVISORY: Every recommendation requires clinician review before action.
`;

const CONSTRAINT_MAP: Record<ConstraintCategory, string> = {
  universal: UNIVERSAL_CLINICAL_CONSTRAINTS,
  grounding: CLINICAL_GROUNDING_RULES,
  grounding_condensed: CONDENSED_GROUNDING_RULES,
  billing: BILLING_CODING_CONSTRAINTS,
  sdoh: SDOH_CODING_CONSTRAINTS,
  drg: DRG_GROUPER_CONSTRAINTS,
  escalation: ESCALATION_RISK_CONSTRAINTS,
  care_planning: CARE_PLANNING_CONSTRAINTS,
  nurse_scope: NURSE_SCOPE_GUARD,
};

/**
 * Build a combined constraint block from selected categories.
 * Universal constraints are ALWAYS included unless explicitly excluded.
 *
 * @param categories - Array of constraint categories to include
 * @param includeUniversal - Whether to prepend universal constraints (default: true)
 */
export function buildConstraintBlock(
  categories: ConstraintCategory[],
  includeUniversal = true
): string {
  const blocks: string[] = [];

  if (includeUniversal && !categories.includes('universal')) {
    blocks.push(UNIVERSAL_CLINICAL_CONSTRAINTS);
  }

  for (const category of categories) {
    const block = CONSTRAINT_MAP[category];
    if (block) {
      blocks.push(block);
    }
  }

  return blocks.join('\n');
}
