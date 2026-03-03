// Tree Trigger Engine — Compass Riley V2
//
// Evaluates ReasoningEncounterInput against 4 trigger categories with
// sensitivity-adjusted thresholds. Returns TriggerResult with
// escalate boolean and reason codes.
//
// Trigger categories:
//   1. Anomaly / Conflict — contradictory clinical data
//   2. Ambiguity — multiple plausible paths
//   3. High-Stakes — red flag symptoms, complex medication reconciliation
//   4. Low-Confidence — aggregate confidence below tenant threshold

import type { TriggerResult, ReasonCode, ConfidenceThresholds, ReasoningEncounterInput } from './types.ts';

/** Red flag symptoms that warrant expanded analysis */
const RED_FLAG_SYMPTOMS = [
  'chest pain',
  'sudden neuro',
  'suicidal ideation',
  'shortness of breath',
  'syncope',
  'hemodynamic instability',
  'acute abdomen',
  'altered mental status',
  'anaphylaxis',
  'seizure',
  'stroke',
  'hemorrhage',
  'sepsis',
] as const;

/** Medication count that triggers complex reconciliation */
const HIGH_MED_COUNT = 5;

/** Minimum transcript words before sparse data is meaningful */
const SPARSE_TRANSCRIPT_THRESHOLD = 30;

/** Working diagnosis count that signals ambiguity */
const AMBIGUITY_DIAGNOSIS_COUNT = 3;

/** Completeness percentage below which assessment is premature */
const LOW_COMPLETENESS_THRESHOLD = 40;

/**
 * Evaluate all trigger categories against the current encounter state.
 * Returns TriggerResult with escalate=true if ANY trigger fires.
 */
export function evaluateTriggers(
  encounterState: ReasoningEncounterInput,
  thresholds: ConfidenceThresholds
): TriggerResult {
  const reasonCodes: ReasonCode[] = [];
  const triggerDescriptions: string[] = [];

  const confidenceScore = computeAggregateConfidence(encounterState);

  checkAnomalyTriggers(encounterState, reasonCodes, triggerDescriptions);
  checkAmbiguityTriggers(encounterState, reasonCodes, triggerDescriptions);
  checkHighStakesTriggers(encounterState, reasonCodes, triggerDescriptions);
  checkLowConfidenceTriggers(
    encounterState, thresholds, confidenceScore, reasonCodes, triggerDescriptions
  );

  // Enrich trigger descriptions with cultural context when available
  if (encounterState.culturalContext && encounterState.culturalContext.populations.length > 0) {
    const cc = encounterState.culturalContext;
    triggerDescriptions.push(
      `Cultural context active: ${cc.populations.join(", ")}`
    );
    if (cc.barriers.length > 0) {
      triggerDescriptions.push(
        `Population barriers: ${cc.barriers.slice(0, 3).join("; ")}`
      );
    }
    if (cc.clinicalNotes.length > 0) {
      triggerDescriptions.push(
        `Clinical considerations: ${cc.clinicalNotes.slice(0, 3).join("; ")}`
      );
    }
  }

  return {
    escalate: reasonCodes.length > 0,
    reasonCodes,
    confidenceScore,
    triggerDescriptions,
  };
}

/**
 * Compute aggregate confidence from active diagnoses (0-100 scale).
 * DiagnosisEntry.confidence is 0-1, we normalize to 0-100.
 * Returns 50 if no active diagnoses (uncertain baseline).
 */
export function computeAggregateConfidence(state: ReasoningEncounterInput): number {
  const active = state.diagnoses.filter(d => d.status !== 'ruled_out');
  if (active.length === 0) return 50;

  const sum = active.reduce((acc, d) => acc + d.confidence, 0);
  return Math.round((sum / active.length) * 100);
}

// ─── Trigger Category 1: Anomaly / Conflict ───────────────────────

function checkAnomalyTriggers(
  state: ReasoningEncounterInput,
  codes: ReasonCode[],
  descriptions: string[]
): void {
  // Working diagnosis with both supporting AND refuting evidence
  for (const dx of state.diagnoses) {
    if (
      dx.status === 'working' &&
      dx.supportingEvidence.length > 0 &&
      dx.refutingEvidence.length > 0
    ) {
      addCode(codes, 'CONFLICTING_SIGNALS');
      descriptions.push(
        `Conflicting evidence for ${dx.condition}: ` +
        `${dx.supportingEvidence.length} supporting, ${dx.refutingEvidence.length} refuting`
      );
      break; // One conflict is enough to trigger
    }
  }

  // Drift detected (conversation veered off clinical topic)
  if (state.driftState.driftDetected) {
    addCode(codes, 'VERIFICATION_FAILED');
    descriptions.push(
      `Conversation drift detected: ${state.driftState.driftDescription || 'topic changed'}`
    );
  }
}

// ─── Trigger Category 2: Ambiguity ────────────────────────────────

function checkAmbiguityTriggers(
  state: ReasoningEncounterInput,
  codes: ReasonCode[],
  descriptions: string[]
): void {
  const workingDiagnoses = state.diagnoses.filter(d => d.status === 'working');

  // Multiple working diagnoses with no clear leader
  if (workingDiagnoses.length >= AMBIGUITY_DIAGNOSIS_COUNT) {
    addCode(codes, 'AMBIGUOUS_REQUIREMENTS');
    descriptions.push(
      `${workingDiagnoses.length} working diagnoses — multiple plausible paths`
    );
  }

  // Assessment made with low documentation completeness
  if (
    state.completeness.overallPercent < LOW_COMPLETENESS_THRESHOLD &&
    state.diagnoses.length > 0
  ) {
    addCode(codes, 'AMBIGUOUS_REQUIREMENTS');
    descriptions.push(
      `Assessment at ${state.completeness.overallPercent}% completeness — ` +
      `missing: ${state.completeness.expectedButMissing.slice(0, 3).join(', ')}`
    );
  }
}

// ─── Trigger Category 3: High-Stakes ──────────────────────────────

function checkHighStakesTriggers(
  state: ReasoningEncounterInput,
  codes: ReasonCode[],
  descriptions: string[]
): void {
  const chiefComplaint = (state.chiefComplaint || '').toLowerCase();

  // Red flag symptoms in chief complaint
  for (const flag of RED_FLAG_SYMPTOMS) {
    if (chiefComplaint.includes(flag)) {
      addCode(codes, 'HIGH_BLAST_RADIUS');
      descriptions.push(`Red flag in chief complaint: ${flag}`);
      break;
    }
  }

  // Emergency detected by patient safety system
  if (state.patientSafety.emergencyDetected) {
    addCode(codes, 'HIGH_BLAST_RADIUS');
    descriptions.push(
      `Emergency: ${state.patientSafety.emergencyReason || 'patient safety concern'}`
    );
  }

  // High-risk MDM
  if (state.mdmComplexity.riskLevel === 'high') {
    addCode(codes, 'HIGH_BLAST_RADIUS');
    descriptions.push('High-risk medical decision making');
  }

  // Complex medication reconciliation (5+ active meds)
  const activeMeds = state.medications.filter(
    m => m.action !== 'discontinued'
  );
  if (activeMeds.length >= HIGH_MED_COUNT) {
    addCode(codes, 'HIGH_BLAST_RADIUS');
    descriptions.push(
      `${activeMeds.length} active medications — complex reconciliation`
    );
  }
}

// ─── Trigger Category 4: Low-Confidence ───────────────────────────

function checkLowConfidenceTriggers(
  state: ReasoningEncounterInput,
  thresholds: ConfidenceThresholds,
  confidenceScore: number,
  codes: ReasonCode[],
  descriptions: string[]
): void {
  // Aggregate confidence below tree threshold
  if (confidenceScore < thresholds.treeThreshold) {
    addCode(codes, 'LOW_CONFIDENCE');
    descriptions.push(
      `Aggregate confidence ${confidenceScore}% below threshold ${thresholds.treeThreshold}%`
    );
  }

  // Sparse transcript with at least one analysis cycle completed
  if (
    state.transcriptWordCount < SPARSE_TRANSCRIPT_THRESHOLD &&
    state.analysisCount > 0
  ) {
    addCode(codes, 'LOW_CONFIDENCE');
    descriptions.push(
      `Sparse transcript (${state.transcriptWordCount} words) — insufficient for confident assessment`
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Add a reason code only if not already present */
function addCode(codes: ReasonCode[], code: ReasonCode): void {
  if (!codes.includes(code)) {
    codes.push(code);
  }
}
