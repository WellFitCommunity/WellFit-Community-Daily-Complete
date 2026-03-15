/**
 * Triage-Specific Clinical Grounding Rules
 *
 * P0-2: Clinical grounding for Claude-in-Claude meta-triage tools.
 * Extends the shared clinicalGroundingRules.ts with triage-specific
 * anti-hallucination constraints.
 *
 * These rules are injected into Claude's system prompt when any triage
 * tool is called, ensuring meta-reasoning is data-grounded.
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import {
  buildConstraintBlock,
  ESCALATION_RISK_CONSTRAINTS,
} from "../_shared/clinicalGroundingRules.ts";

// ============================================================================
// Meta-Triage Specific Constraints
// ============================================================================

/**
 * Constraints specific to meta-triage reasoning.
 * These go BEYOND the escalation constraints because meta-triage
 * reasons about OTHER AI outputs, not raw patient data.
 */
export const META_TRIAGE_CONSTRAINTS = `
META-TRIAGE REASONING CONSTRAINTS — MANDATORY:

1. SOURCE HIERARCHY: When AI skills conflict, weight data sources in this order:
   a) Device-measured vitals (highest reliability — objective, timestamped)
   b) Lab results (high reliability — verified by lab)
   c) Clinician-documented observations (moderate — professional judgment)
   d) Patient self-report (lower — subjective, may reflect desire/anxiety)
   e) Proxy/caregiver report (lower — secondhand observation)
   f) AI-inferred patterns (lowest — model output, not ground truth)

2. CONFLICT RESOLUTION RULES:
   - When vitals contradict self-report: ALWAYS flag for clinician review.
     Do NOT resolve the conflict yourself — present both with trust weights.
   - When two clinical AI skills disagree on escalation level: Choose the
     HIGHER level and flag the disagreement. Do NOT average or split the difference.
   - When engagement data contradicts clinical data: Clinical data takes precedence
     for escalation decisions. Engagement data informs outreach, not triage.

3. NEVER DOWNGRADE WITHOUT EVIDENCE:
   - Do NOT reduce escalation level below ANY individual skill's recommendation
     unless you can cite a specific data point that invalidates that skill's reasoning.
   - Do NOT suppress alerts because "too many alerts" — consolidation reduces noise,
     but does NOT reduce severity.
   - A patient with 5 moderate alerts is NOT moderate — pattern recognition may
     indicate the situation is WORSE than any individual alert suggests.

4. CONFIDENCE CALIBRATION INTEGRITY:
   - Do NOT assign calibrated confidence above the MAXIMUM of input confidence scores.
   - Do NOT present calibrated scores as more certain than the underlying data supports.
   - If data is stale (>24h for vitals, >7d for labs), reduce confidence accordingly.
   - If population context is sparse, say so — do NOT compensate with assumptions.

5. TRANSPARENCY IN META-REASONING:
   - Every resolved decision must cite which input signals were used and why.
   - Every suppressed or downgraded signal must have an explicit justification.
   - Every trust weight must have a reasoning string — no opaque numbers.
   - If your meta-reasoning is uncertain, say: "[META-TRIAGE UNCERTAIN — clinician review required]"

6. PATIENT IDENTITY PROTECTION:
   - Input signals reference patient_id only — never names, DOB, SSN.
   - Output must use patient_id only.
   - Do NOT reconstruct patient identity from signal patterns.
`;

/**
 * Alert consolidation constraints.
 */
export const ALERT_CONSOLIDATION_CONSTRAINTS = `
ALERT CONSOLIDATION CONSTRAINTS — MANDATORY:

1. CONSOLIDATION IS ADDITIVE, NOT REDUCTIVE:
   - Original alerts are PRESERVED — consolidation adds a summary layer.
   - Do NOT delete, hide, or suppress alerts that represent genuine clinical concerns.
   - "Suppressed" alerts are still logged — suppression means "de-prioritized in UI", not "discarded."

2. ROOT CAUSE IDENTIFICATION:
   - A root cause must connect at least 2 alerts with a plausible clinical mechanism.
   - Do NOT fabricate root causes — if alerts are genuinely unrelated, say so.
   - Do NOT force-fit alerts into a single root cause for simplicity.
   - Confidence in root cause identification must be ≤ the minimum confidence of the contributing alerts.

3. SEVERITY ESCALATION:
   - Consolidated severity must be ≥ the maximum severity of any constituent alert.
   - Multiple moderate alerts MAY justify elevating to "escalate" if a pattern is detected.
   - Document the pattern that justifies elevation.

4. ACTIONABLE SUMMARIES:
   - The summary must be readable by a busy clinician in <15 seconds.
   - Lead with the most critical item.
   - Use clinical language, not AI jargon.
   - End with specific recommended actions, not vague suggestions.
`;

/**
 * Confidence calibration constraints.
 */
export const CONFIDENCE_CALIBRATION_CONSTRAINTS = `
CONFIDENCE CALIBRATION CONSTRAINTS — MANDATORY:

1. CALIBRATION BOUNDS:
   - Calibrated score must remain in [0, 100] range.
   - Score adjustments >20 points require explicit justification for each point of change.
   - Do NOT calibrate a score to exactly 50 (the "I don't know" default).

2. POPULATION CONTEXT RULES:
   - Population context informs factor weighting, not score direction.
   - Do NOT assume higher risk because of demographics alone.
   - Do NOT reduce risk because of demographics alone.
   - Cultural barriers affect INTERVENTION choice, not risk level.
   - SDOH factors affect BOTH risk and intervention — weight them appropriately.

3. DATA FRESHNESS PENALTIES:
   - Vitals >24h old: reduce that factor's weight by 25%.
   - Labs >7d old: reduce that factor's weight by 15%.
   - Self-report >48h old: reduce that factor's weight by 30%.
   - Engagement data >7d old: reduce that factor's weight by 20%.
   - Document all freshness penalties applied.

4. ADDITIONAL DATA RECOMMENDATIONS:
   - If needs_additional_data is true, be SPECIFIC about what data and why.
   - "Get more data" is not acceptable — say exactly what (e.g., "24h blood pressure series
     from home monitor would reduce BP factor uncertainty from 40% to <10%").
`;

/**
 * Handoff narrative synthesis constraints.
 */
export const HANDOFF_NARRATIVE_CONSTRAINTS = `
HANDOFF NARRATIVE SYNTHESIS CONSTRAINTS — MANDATORY:

1. NARRATIVE STRUCTURE:
   - Lead with critical items (immediate patient safety concerns).
   - Then resolved items (what improved — reduces anxiety for incoming shift).
   - Then watch items (monitor but no immediate action needed).
   - End with unit status assessment.

2. BREVITY REQUIREMENTS:
   - Narrative body: maximum 500 words for up to 10 patients.
   - Critical items: maximum 3 sentences each.
   - Each item must be actionable — "watch" is acceptable, "maybe check" is not.

3. NO FABRICATION:
   - Do NOT invent escalation events not in the input data.
   - Do NOT add care plan changes not in the input data.
   - Do NOT create pending actions not in the input data.
   - If data is sparse, say "limited data for this shift" — do NOT fill gaps with assumptions.

4. ROLE-APPROPRIATE LANGUAGE:
   - Use nursing/clinical terminology appropriate for shift handoff.
   - Do NOT use AI/ML jargon (no "model confidence", "prediction threshold").
   - Refer to patients by room/bed number, not patient_id (for readability).
   - Room/bed mapping must come from input data — do NOT fabricate assignments.
`;

// ============================================================================
// Constraint Builders for Each Triage Tool
// ============================================================================

/**
 * Build the system prompt constraint block for the escalation conflict tool.
 * Includes: universal + escalation + meta-triage constraints.
 */
export function buildEscalationConflictConstraints(): string {
  const base = buildConstraintBlock(['escalation']);
  return `${base}\n${META_TRIAGE_CONSTRAINTS}`;
}

/**
 * Build the system prompt constraint block for the alert consolidation tool.
 * Includes: universal + escalation + alert consolidation constraints.
 */
export function buildAlertConsolidationConstraints(): string {
  const base = buildConstraintBlock(['escalation']);
  return `${base}\n${ALERT_CONSOLIDATION_CONSTRAINTS}`;
}

/**
 * Build the system prompt constraint block for the confidence calibration tool.
 * Includes: universal + escalation + confidence calibration constraints.
 */
export function buildConfidenceCalibrationConstraints(): string {
  const base = buildConstraintBlock(['escalation']);
  return `${base}\n${CONFIDENCE_CALIBRATION_CONSTRAINTS}`;
}

/**
 * Build the system prompt constraint block for the handoff narrative tool.
 * Includes: universal + care planning + handoff narrative constraints.
 */
export function buildHandoffNarrativeConstraints(): string {
  const base = buildConstraintBlock(['escalation', 'care_planning']);
  return `${base}\n${HANDOFF_NARRATIVE_CONSTRAINTS}`;
}
