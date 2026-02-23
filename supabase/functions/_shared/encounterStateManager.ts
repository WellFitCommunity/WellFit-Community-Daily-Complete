// Encounter State Manager — Progressive Clinical Reasoning for Compass Riley
// Session 2 of Compass Riley Clinical Reasoning Hardening (2026-02-23)
//
// Maintains a running clinical picture across the encounter instead of
// processing 15-second transcript chunks independently. Tracks HPI elements,
// ROS, exam, diagnoses, MDM complexity, and clinical completeness in real-time.

/**
 * HPI Elements (OLDCARTS mnemonic)
 * Standard elements that build the History of Present Illness
 */
export interface HPIElements {
  onset: string | null;
  location: string | null;
  duration: string | null;
  character: string | null;
  aggravating: string | null;
  relieving: string | null;
  timing: string | null;
  severity: string | null;
}

/**
 * Vital signs captured during the encounter
 */
export interface VitalSigns {
  bp?: string;
  hr?: string;
  temp?: string;
  rr?: string;
  spo2?: string;
  weight?: string;
  bmi?: string;
  glucose?: string;
}

/**
 * A diagnosis or differential with supporting/refuting evidence
 */
export interface DiagnosisEntry {
  condition: string;
  icd10?: string;
  confidence: number;
  supportingEvidence: string[];
  refutingEvidence: string[];
  status: 'active' | 'ruled_out' | 'working';
}

/**
 * A medication discussed during the encounter
 */
export interface MedicationEntry {
  name: string;
  action: 'new' | 'adjusted' | 'continued' | 'discontinued' | 'reviewed';
  details?: string;
}

/**
 * MDM Complexity per 2021 E/M Guidelines
 *
 * Medical Decision Making has 3 elements:
 * 1. Number and complexity of problems addressed
 * 2. Amount and/or complexity of data to be reviewed and analyzed
 * 3. Risk of complications and/or morbidity or mortality of patient management
 *
 * Two of three must meet or exceed the level to qualify.
 */
export interface MDMComplexity {
  /** Number of problems addressed in the visit */
  problemCount: number;
  /** Complexity classification of problems */
  problemComplexity: 'minimal' | 'low' | 'moderate' | 'high';
  /** Data elements reviewed (labs, imaging, records, etc.) */
  dataReviewed: string[];
  /** Data complexity level */
  dataComplexity: 'minimal' | 'limited' | 'moderate' | 'extensive';
  /** Risk level based on management decisions */
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high';
  /** Overall MDM level (2 of 3 elements must meet) */
  overallLevel: 'straightforward' | 'low' | 'moderate' | 'high';
  /** Suggested E/M code based on MDM */
  suggestedEMCode: string;
  /** What's needed to reach the next level */
  nextLevelGap?: string;
}

/**
 * Clinical completeness tracking — what's documented vs. what's expected
 */
export interface ClinicalCompleteness {
  /** HPI element count (4+ = extended, 1-3 = brief) */
  hpiElementCount: number;
  hpiLevel: 'none' | 'brief' | 'extended';
  /** ROS systems count (2-9 = pertinent, 10+ = complete) */
  rosSystemCount: number;
  rosLevel: 'none' | 'pertinent' | 'complete';
  /** Exam component count */
  examComponentCount: number;
  /** Key documentation present */
  hasAssessment: boolean;
  hasPlan: boolean;
  hasMedReconciliation: boolean;
  /** Expected elements that are missing */
  expectedButMissing: string[];
  /** Overall completeness percentage (0-100) */
  overallPercent: number;
}

/**
 * The encounter phase tracks where we are in the visit flow
 */
export type EncounterPhase =
  | 'greeting'
  | 'chief_complaint'
  | 'history'
  | 'review_of_systems'
  | 'exam'
  | 'assessment'
  | 'plan'
  | 'counseling'
  | 'closing';

/**
 * The complete encounter state — maintained across all analysis chunks
 */
export interface EncounterState {
  /** Chief complaint as stated by the patient */
  chiefComplaint: string | null;

  /** HPI elements tracked by OLDCARTS */
  hpiElements: HPIElements;

  /** ROS systems reviewed and their findings */
  rosSystemsReviewed: string[];
  rosFindings: Record<string, string[]>;

  /** Physical exam components and findings */
  examComponents: Record<string, string[]>;

  /** Vital signs captured */
  vitals: VitalSigns;

  /** Active diagnoses and differentials */
  diagnoses: DiagnosisEntry[];

  /** Medications discussed */
  medications: MedicationEntry[];

  /** Plan items */
  planItems: string[];

  /** MDM complexity tracking (2021 E/M) */
  mdmComplexity: MDMComplexity;

  /** Clinical completeness */
  completeness: ClinicalCompleteness;

  /** Current encounter phase */
  currentPhase: EncounterPhase;

  /** How many analysis chunks have been processed */
  analysisCount: number;

  /** Timestamp of last update */
  lastUpdated: string;

  /** Total transcript words analyzed so far */
  transcriptWordCount: number;
}

/**
 * Create a fresh encounter state for a new recording session
 */
export function createEmptyEncounterState(): EncounterState {
  return {
    chiefComplaint: null,
    hpiElements: {
      onset: null,
      location: null,
      duration: null,
      character: null,
      aggravating: null,
      relieving: null,
      timing: null,
      severity: null,
    },
    rosSystemsReviewed: [],
    rosFindings: {},
    examComponents: {},
    vitals: {},
    diagnoses: [],
    medications: [],
    planItems: [],
    mdmComplexity: {
      problemCount: 0,
      problemComplexity: 'minimal',
      dataReviewed: [],
      dataComplexity: 'minimal',
      riskLevel: 'minimal',
      overallLevel: 'straightforward',
      suggestedEMCode: '99212',
    },
    completeness: {
      hpiElementCount: 0,
      hpiLevel: 'none',
      rosSystemCount: 0,
      rosLevel: 'none',
      examComponentCount: 0,
      hasAssessment: false,
      hasPlan: false,
      hasMedReconciliation: false,
      expectedButMissing: [
        'Chief complaint',
        'HPI',
        'Review of systems',
        'Physical exam',
        'Assessment',
        'Plan',
      ],
      overallPercent: 0,
    },
    currentPhase: 'greeting',
    analysisCount: 0,
    lastUpdated: new Date().toISOString(),
    transcriptWordCount: 0,
  };
}

/**
 * Merge Claude's encounter state update into the existing state.
 * Claude returns a partial update; we merge non-null fields additively.
 *
 * Rules:
 * - Arrays: append new unique items (no duplicates)
 * - Objects/records: merge keys (new keys added, existing keys updated)
 * - Scalars: overwrite if the new value is non-null
 * - MDM: always overwrite (Claude recalculates from full picture)
 * - Completeness: always overwrite (Claude recalculates)
 */
export function mergeEncounterState(
  existing: EncounterState,
  update: Partial<EncounterState>
): EncounterState {
  const merged = { ...existing };

  // Chief complaint — set once, don't overwrite
  if (update.chiefComplaint && !existing.chiefComplaint) {
    merged.chiefComplaint = update.chiefComplaint;
  }

  // HPI elements — fill in nulls only
  if (update.hpiElements) {
    merged.hpiElements = { ...existing.hpiElements };
    for (const key of Object.keys(update.hpiElements) as Array<keyof HPIElements>) {
      if (update.hpiElements[key] && !existing.hpiElements[key]) {
        merged.hpiElements[key] = update.hpiElements[key];
      }
    }
  }

  // ROS — append new systems
  if (update.rosSystemsReviewed) {
    const existingSet = new Set(existing.rosSystemsReviewed);
    for (const sys of update.rosSystemsReviewed) {
      if (!existingSet.has(sys)) {
        merged.rosSystemsReviewed = [...merged.rosSystemsReviewed, sys];
      }
    }
  }

  // ROS findings — merge per system
  if (update.rosFindings) {
    merged.rosFindings = { ...existing.rosFindings };
    for (const [system, findings] of Object.entries(update.rosFindings)) {
      const existingFindings = new Set(existing.rosFindings[system] || []);
      const newFindings = findings.filter((f: string) => !existingFindings.has(f));
      merged.rosFindings[system] = [...(existing.rosFindings[system] || []), ...newFindings];
    }
  }

  // Exam components — merge per system
  if (update.examComponents) {
    merged.examComponents = { ...existing.examComponents };
    for (const [system, findings] of Object.entries(update.examComponents)) {
      const existingFindings = new Set(existing.examComponents[system] || []);
      const newFindings = findings.filter((f: string) => !existingFindings.has(f));
      merged.examComponents[system] = [...(existing.examComponents[system] || []), ...newFindings];
    }
  }

  // Vitals — fill in new values, don't overwrite
  if (update.vitals) {
    merged.vitals = { ...existing.vitals };
    for (const key of Object.keys(update.vitals) as Array<keyof VitalSigns>) {
      if (update.vitals[key] && !existing.vitals[key]) {
        merged.vitals[key] = update.vitals[key];
      }
    }
  }

  // Diagnoses — merge by condition name
  if (update.diagnoses) {
    merged.diagnoses = [...existing.diagnoses];
    for (const newDx of update.diagnoses) {
      const existingIdx = merged.diagnoses.findIndex(
        d => d.condition.toLowerCase() === newDx.condition.toLowerCase()
      );
      if (existingIdx >= 0) {
        // Update existing — merge evidence, update confidence
        const existingDx = merged.diagnoses[existingIdx];
        const supportingSet = new Set(existingDx.supportingEvidence);
        const refutingSet = new Set(existingDx.refutingEvidence);
        merged.diagnoses[existingIdx] = {
          ...existingDx,
          confidence: newDx.confidence,
          status: newDx.status,
          icd10: newDx.icd10 || existingDx.icd10,
          supportingEvidence: [
            ...existingDx.supportingEvidence,
            ...newDx.supportingEvidence.filter(e => !supportingSet.has(e)),
          ],
          refutingEvidence: [
            ...existingDx.refutingEvidence,
            ...newDx.refutingEvidence.filter(e => !refutingSet.has(e)),
          ],
        };
      } else {
        merged.diagnoses.push(newDx);
      }
    }
  }

  // Medications — merge by name
  if (update.medications) {
    merged.medications = [...existing.medications];
    for (const newMed of update.medications) {
      const existingIdx = merged.medications.findIndex(
        m => m.name.toLowerCase() === newMed.name.toLowerCase()
      );
      if (existingIdx >= 0) {
        merged.medications[existingIdx] = newMed; // overwrite with latest
      } else {
        merged.medications.push(newMed);
      }
    }
  }

  // Plan items — append unique
  if (update.planItems) {
    const existingSet = new Set(existing.planItems.map(p => p.toLowerCase()));
    for (const item of update.planItems) {
      if (!existingSet.has(item.toLowerCase())) {
        merged.planItems = [...merged.planItems, item];
      }
    }
  }

  // MDM — always overwrite (Claude recalculates from full picture)
  if (update.mdmComplexity) {
    merged.mdmComplexity = update.mdmComplexity;
  }

  // Completeness — always overwrite (Claude recalculates)
  if (update.completeness) {
    merged.completeness = update.completeness;
  }

  // Phase — overwrite
  if (update.currentPhase) {
    merged.currentPhase = update.currentPhase;
  }

  // Metadata
  merged.analysisCount = existing.analysisCount + 1;
  merged.lastUpdated = new Date().toISOString();
  if (update.transcriptWordCount) {
    merged.transcriptWordCount = update.transcriptWordCount;
  }

  return merged;
}

/**
 * Serialize encounter state for inclusion in the prompt.
 * Token-optimized: only includes non-empty fields.
 */
export function serializeEncounterStateForPrompt(state: EncounterState): string {
  const parts: string[] = [];

  // Only include after the first analysis
  if (state.analysisCount === 0) {
    return '';
  }

  parts.push('## ENCOUNTER STATE (Running Clinical Picture)');
  parts.push(`Analysis #${state.analysisCount + 1} | Phase: ${state.currentPhase}`);

  if (state.chiefComplaint) {
    parts.push(`\nCC: ${state.chiefComplaint}`);
  }

  // HPI
  const hpiEntries = Object.entries(state.hpiElements)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`);
  if (hpiEntries.length > 0) {
    parts.push(`\nHPI (${hpiEntries.length}/8 OLDCARTS): ${hpiEntries.join(' | ')}`);
  }

  // Vitals
  const vitalEntries = Object.entries(state.vitals)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`);
  if (vitalEntries.length > 0) {
    parts.push(`\nVitals: ${vitalEntries.join(', ')}`);
  }

  // ROS
  if (state.rosSystemsReviewed.length > 0) {
    parts.push(`\nROS (${state.rosSystemsReviewed.length} systems): ${state.rosSystemsReviewed.join(', ')}`);
  }

  // Exam
  const examSystems = Object.keys(state.examComponents);
  if (examSystems.length > 0) {
    parts.push(`\nExam (${examSystems.length} systems): ${examSystems.join(', ')}`);
  }

  // Diagnoses
  const activeDx = state.diagnoses.filter(d => d.status !== 'ruled_out');
  if (activeDx.length > 0) {
    const dxList = activeDx.map(d =>
      `${d.condition}${d.icd10 ? ` (${d.icd10})` : ''} [${Math.round(d.confidence * 100)}%]`
    ).join(', ');
    parts.push(`\nDx: ${dxList}`);
  }

  // Medications
  if (state.medications.length > 0) {
    const medList = state.medications.map(m => `${m.name} (${m.action})`).join(', ');
    parts.push(`\nMeds: ${medList}`);
  }

  // Plan
  if (state.planItems.length > 0) {
    parts.push(`\nPlan: ${state.planItems.join('; ')}`);
  }

  // MDM
  parts.push(`\nMDM: ${state.mdmComplexity.overallLevel} → ${state.mdmComplexity.suggestedEMCode}`);
  if (state.mdmComplexity.nextLevelGap) {
    parts.push(`  Gap to next level: ${state.mdmComplexity.nextLevelGap}`);
  }

  // Completeness
  parts.push(`\nCompleteness: ${state.completeness.overallPercent}%`);
  if (state.completeness.expectedButMissing.length > 0) {
    parts.push(`  Missing: ${state.completeness.expectedButMissing.join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Generate the encounter state update instructions for the prompt.
 * This tells Claude what to return alongside its normal response.
 */
export function getEncounterStatePromptInstructions(): string {
  return `
## PROGRESSIVE REASONING — Update Running Clinical Picture

You are maintaining a running clinical picture across this entire encounter. Each analysis builds on what came before. You MUST include an "encounterStateUpdate" field in your JSON response.

ENCOUNTER STATE UPDATE FORMAT:
"encounterStateUpdate": {
  "chiefComplaint": "only set if newly identified in THIS chunk",
  "hpiElements": {"onset": "2 days ago", "severity": "7/10"},
  "rosSystemsReviewed": ["cardiovascular", "respiratory"],
  "rosFindings": {"cardiovascular": ["denies chest pain", "denies palpitations"]},
  "examComponents": {"cardiovascular": ["regular rate and rhythm", "no murmurs"]},
  "vitals": {"bp": "138/85", "hr": "78"},
  "diagnoses": [
    {
      "condition": "Type 2 diabetes",
      "icd10": "E11.65",
      "confidence": 0.92,
      "supportingEvidence": ["A1C 7.8%", "fasting glucose 140-150"],
      "refutingEvidence": [],
      "status": "active"
    }
  ],
  "medications": [
    {"name": "Metformin", "action": "adjusted", "details": "500mg BID -> 850mg BID"}
  ],
  "planItems": ["Increase Metformin", "Refer to nutritionist"],
  "currentPhase": "assessment",
  "mdmComplexity": {
    "problemCount": 3,
    "problemComplexity": "moderate",
    "dataReviewed": ["A1C lab results", "lipid panel", "eGFR"],
    "dataComplexity": "moderate",
    "riskLevel": "moderate",
    "overallLevel": "moderate",
    "suggestedEMCode": "99214",
    "nextLevelGap": "Document 3+ management options considered or complications risk for 99215"
  },
  "completeness": {
    "hpiElementCount": 4,
    "hpiLevel": "extended",
    "rosSystemCount": 3,
    "rosLevel": "pertinent",
    "examComponentCount": 2,
    "hasAssessment": true,
    "hasPlan": true,
    "hasMedReconciliation": true,
    "expectedButMissing": ["Allergies not reviewed", "Social history not discussed"],
    "overallPercent": 72
  }
}

RULES FOR ENCOUNTER STATE:
- Only include fields that have NEW information from THIS transcript chunk
- Do NOT repeat information already in the encounter state above
- Diagnoses: update confidence as evidence accumulates, add refuting evidence when applicable
- MDM: recalculate from the FULL picture (existing state + new information)
- Completeness: recalculate percentages from the FULL picture
- Phase: update to reflect where we are NOW in the encounter flow
- If a diagnosis should be ruled out based on new evidence, set status to "ruled_out"`;
}
