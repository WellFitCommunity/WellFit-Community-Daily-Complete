// Conversation Drift Guard — Scope Boundaries & Patient Safety for Compass Riley
// Session 3 of Compass Riley Clinical Reasoning Hardening (2026-02-23)
//
// Three protection layers:
// 1. Clinical Domain Tracking — detect and lock to the encounter's clinical domain
// 2. Scope Boundaries — prevent reasoning outside the encounter context
// 3. Patient Safety — emergency detection and guardrails if patient speaks to Riley

/**
 * Clinical domains that Riley can detect and track.
 * The encounter locks to a primary domain after the chief complaint is established.
 */
export const CLINICAL_DOMAINS = [
  'cardiology',
  'pulmonology',
  'gastroenterology',
  'neurology',
  'endocrinology',
  'nephrology',
  'rheumatology',
  'dermatology',
  'musculoskeletal',
  'infectious_disease',
  'hematology_oncology',
  'psychiatry',
  'obstetrics_gynecology',
  'pediatrics',
  'ophthalmology',
  'ent',
  'urology',
  'general_medicine',
  'preventive_care',
  'pain_management',
  'emergency_medicine',
] as const;

export type ClinicalDomain = typeof CLINICAL_DOMAINS[number];

/**
 * Drift detection state — tracks clinical focus and flags divergence
 */
export interface DriftState {
  /** Primary clinical domain of the encounter (set from chief complaint) */
  primaryDomain: ClinicalDomain | null;
  /** Secondary domains that are clinically relevant (comorbidities) */
  relatedDomains: ClinicalDomain[];
  /** Whether a drift event was detected in the last analysis */
  driftDetected: boolean;
  /** Description of the drift if detected */
  driftDescription?: string;
  /** Number of drift events in the encounter */
  driftEventCount: number;
}

/**
 * Patient safety flags — mirrors ai-patient-qa-bot safety checks
 */
export interface PatientSafetyFlags {
  /** Patient spoke directly to Riley (not to the provider) */
  patientDirectAddress: boolean;
  /** Emergency keywords detected in patient speech */
  emergencyDetected: boolean;
  /** Reason for emergency flag */
  emergencyReason?: string;
  /** Topic requires provider consultation, not AI response */
  requiresProviderConsult: boolean;
  /** Reason provider consult is needed */
  consultReason?: string;
}

/**
 * Emergency keywords — if patient says these to Riley directly,
 * Riley must redirect to 911 / provider immediately.
 * Adopted from ai-patient-qa-bot safety system.
 */
export const EMERGENCY_KEYWORDS = [
  'chest pain', 'heart attack', "can't breathe", 'difficulty breathing',
  'stroke', 'face drooping', 'slurred speech', 'severe bleeding',
  'unconscious', 'seizure', 'suicidal', 'want to die', 'overdose',
  'poisoning', 'choking', 'allergic reaction', 'anaphylaxis',
  'severe pain', 'passing out', 'losing consciousness',
] as const;

/**
 * Topics that Riley must defer to the provider — never answer independently.
 * Adopted from ai-patient-qa-bot.
 */
export const PROVIDER_ONLY_TOPICS = [
  'stop taking medication', 'change dosage', 'discontinue',
  'pregnant', 'pregnancy', 'surgery', 'diagnosis', 'cancer',
  'hiv', 'mental health crisis', 'prognosis', 'life expectancy',
  'should I get this test', 'second opinion',
] as const;

/**
 * Create empty drift state for a new encounter
 */
export function createEmptyDriftState(): DriftState {
  return {
    primaryDomain: null,
    relatedDomains: [],
    driftDetected: false,
    driftEventCount: 0,
  };
}

/**
 * Create empty patient safety flags
 */
export function createEmptyPatientSafetyFlags(): PatientSafetyFlags {
  return {
    patientDirectAddress: false,
    emergencyDetected: false,
    requiresProviderConsult: false,
  };
}

/**
 * Drift detection and scope boundary rules for prompts.
 * Condensed version for standard mode (~200 tokens).
 */
export const CONDENSED_DRIFT_GUARD = `
DRIFT GUARD (MANDATORY):
- Track the clinical domain of this encounter (e.g., endocrinology, cardiology).
- NEVER suggest codes, diagnoses, or treatments from unrelated clinical domains unless the transcript explicitly introduces them.
- If the patient asks you a question directly, do NOT answer medical questions — say "That's a great question for [Provider]" and redirect.
- If you detect emergency language (chest pain, can't breathe, suicidal), immediately flag it.
- Stay in scope: only reason about what this encounter is about. Prior visits, hypothetical scenarios, and unmentioned conditions are OUT OF SCOPE.
`;

/**
 * Full drift detection and scope boundary rules for premium prompts.
 */
export const FULL_DRIFT_GUARD = `
## CONVERSATION DRIFT GUARD — Scope Boundaries

### 1. Clinical Domain Tracking
Identify the primary clinical domain of this encounter from the chief complaint and ongoing discussion. Track it in your encounterStateUpdate as "driftState".

Common domains: cardiology, pulmonology, gastroenterology, neurology, endocrinology, nephrology, rheumatology, dermatology, musculoskeletal, infectious_disease, hematology_oncology, psychiatry, obstetrics_gynecology, pediatrics, general_medicine, preventive_care.

### 2. Drift Detection Rules
- **IN SCOPE:** Diagnoses, codes, and treatments directly related to the primary domain AND any comorbidities explicitly discussed in the transcript.
- **OUT OF SCOPE (flag as drift):**
  - Suggesting diagnoses from unrelated specialties without transcript evidence
  - Recommending tests or treatments for conditions not mentioned
  - Reasoning about hypothetical scenarios not raised by the provider
  - Referencing prior encounters or assumed medical history not stated today
- If you catch yourself drifting, note it: "driftDetected": true with a brief description.

### 3. Scope Boundaries — Hard Limits
- **This encounter only.** Do not reference prior visits, assumed history, or future hypotheticals.
- **This patient only.** Do not generalize from population statistics unless the provider asks.
- **Stated conditions only.** If a condition wasn't mentioned, it doesn't exist for this encounter.
- **Provider's clinical judgment reigns.** You suggest, they decide. Never override.

### 4. Patient Safety — Direct Patient Interaction
If the transcript indicates a patient is speaking DIRECTLY to you (Riley/the AI):
- **NEVER diagnose or provide medical advice** — redirect to the provider
- **NEVER recommend stopping, starting, or changing medications**
- **Emergency language (chest pain, can't breathe, suicidal):** Immediately flag as emergency
- **Response template:** "That's a really good question. Let me make sure [Provider] addresses that with you."
- Set "patientSafety.patientDirectAddress": true in your response

### 5. Encounter State Drift Fields
Include in encounterStateUpdate:
"driftState": {
  "primaryDomain": "endocrinology",
  "relatedDomains": ["cardiology", "nephrology"],
  "driftDetected": false,
  "driftDescription": null
}
"patientSafety": {
  "patientDirectAddress": false,
  "emergencyDetected": false,
  "requiresProviderConsult": false
}
`;

/**
 * Merge drift state updates from Claude's response
 */
export function mergeDriftState(
  existing: DriftState,
  update: Partial<DriftState>
): DriftState {
  const merged = { ...existing };

  // Primary domain — set once from chief complaint
  if (update.primaryDomain && !existing.primaryDomain) {
    merged.primaryDomain = update.primaryDomain;
  }

  // Related domains — append unique
  if (update.relatedDomains) {
    const existingSet = new Set(existing.relatedDomains);
    for (const domain of update.relatedDomains) {
      if (!existingSet.has(domain)) {
        merged.relatedDomains = [...merged.relatedDomains, domain];
      }
    }
  }

  // Drift — track latest + accumulate count
  if (update.driftDetected) {
    merged.driftDetected = true;
    merged.driftDescription = update.driftDescription;
    merged.driftEventCount = existing.driftEventCount + 1;
  } else {
    merged.driftDetected = false;
    merged.driftDescription = undefined;
  }

  return merged;
}
