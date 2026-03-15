/**
 * Claude-in-Claude Triage Intelligence — Type Definitions
 *
 * P0-5: Types for meta-triage, alert consolidation, confidence calibration,
 * and handoff narrative synthesis.
 *
 * These types define the structured JSON schemas that all triage tools
 * must use for input and output. No free-text parsing.
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

// ============================================================================
// Shared Enums & Primitives
// ============================================================================

/** Escalation levels used across the triage system */
export type EscalationLevel =
  | "none"
  | "monitor"
  | "notify"
  | "escalate"
  | "emergency";

/** Urgency for clinical response SLAs */
export type UrgencyLevel =
  | "routine"
  | "elevated"
  | "urgent"
  | "critical";

/** Trend direction for patient status */
export type TrendDirection =
  | "improving"
  | "stable"
  | "declining"
  | "rapidly_declining";

/** Data source reliability assessment */
export type DataReliability =
  | "high"       // Device-measured vitals, lab results
  | "moderate"   // Clinician-documented observations
  | "low"        // Patient self-report, proxy report
  | "unknown";   // Source not identified

/** Alert disposition after consolidation */
export type AlertDisposition =
  | "consolidated"   // Merged into root cause
  | "standalone"     // Kept as separate alert
  | "suppressed"     // Duplicate or noise — hidden but logged
  | "elevated";      // Upgraded due to pattern recognition

// ============================================================================
// P1: Escalation Conflict Resolution — evaluate-escalation-conflict
// ============================================================================

/** A signal from one AI skill about a patient's status */
export interface EscalationSignal {
  /** Which AI skill produced this signal */
  skill_key: string;
  /** The escalation level this skill recommends */
  recommended_level: EscalationLevel;
  /** 0-1 confidence from the original skill */
  confidence: number;
  /** Key factors driving this recommendation */
  factors: string[];
  /** Source data type (vitals, self_report, lab, clinical_note, etc.) */
  data_source: string;
  /** When this signal was generated (ISO 8601) */
  generated_at: string;
}

/** Input for evaluate-escalation-conflict tool */
export interface EscalationConflictInput {
  /** Patient identifier (never PHI — ID only) */
  patient_id: string;
  /** Tenant for RLS scoping */
  tenant_id: string;
  /** Array of conflicting signals from different AI skills */
  signals: EscalationSignal[];
  /** Current escalation decision (before meta-triage) */
  current_decision: EscalationLevel;
  /** Optional: patient demographics for population context (de-identified) */
  patient_demographics?: {
    age_range?: string;       // "65-74", "75-84", etc.
    risk_tier?: string;       // "low", "medium", "high"
    days_since_admission?: number;
    active_conditions_count?: number;
  };
}

/** Trust weight assigned to each data source during conflict resolution */
export interface TrustWeight {
  /** Which signal this trust weight applies to */
  skill_key: string;
  /** 0-1 trust weight (higher = more trusted) */
  weight: number;
  /** Why this weight was assigned */
  reasoning: string;
  /** Reliability of the underlying data */
  data_reliability: DataReliability;
}

/** Output from evaluate-escalation-conflict tool */
export interface EscalationConflictOutput {
  /** The resolved escalation level after meta-triage */
  resolved_level: EscalationLevel;
  /** 0-1 confidence in the resolved decision */
  confidence: number;
  /** Urgency for clinical response */
  urgency: UrgencyLevel;
  /** Human-readable reasoning for the resolution */
  reasoning: string;
  /** Trust weights assigned to each input signal */
  trust_weights: TrustWeight[];
  /** Whether conflicting signals were detected */
  conflict_detected: boolean;
  /** Specific conflict description (if any) */
  conflict_summary: string | null;
  /** Recommended actions for the care team */
  recommended_actions: string[];
  /** Whether this decision requires clinician review */
  requires_review: boolean;
}

// ============================================================================
// P2: Alert Consolidation — consolidate-alerts
// ============================================================================

/** A single alert from any AI skill */
export interface PatientAlert {
  /** Unique alert identifier */
  alert_id: string;
  /** Which AI skill generated this alert */
  skill_key: string;
  /** Alert severity */
  severity: EscalationLevel;
  /** What the alert is about */
  summary: string;
  /** Detailed alert data */
  details: Record<string, unknown>;
  /** When the alert was generated */
  generated_at: string;
  /** Category (vitals, medication, fall_risk, readmission, engagement, etc.) */
  category: string;
}

/** Input for consolidate-alerts tool */
export interface AlertConsolidationInput {
  /** Patient identifier */
  patient_id: string;
  /** Tenant for RLS scoping */
  tenant_id: string;
  /** Array of active alerts to consolidate */
  alerts: PatientAlert[];
  /** Time window these alerts were collected in (ISO 8601 duration, e.g., "PT1H") */
  collection_window: string;
}

/** Root cause identified during consolidation */
export interface RootCause {
  /** Root cause description */
  description: string;
  /** Which alerts are symptoms of this root cause */
  related_alert_ids: string[];
  /** Confidence in this root cause identification */
  confidence: number;
  /** Recommended intervention for this root cause */
  recommended_intervention: string;
}

/** Individual alert disposition after consolidation */
export interface AlertDispositionRecord {
  /** The original alert ID */
  alert_id: string;
  /** What happened to this alert */
  disposition: AlertDisposition;
  /** Why this disposition was chosen */
  reasoning: string;
  /** If consolidated, which root cause it was merged into */
  root_cause_index: number | null;
}

/** Output from consolidate-alerts tool */
export interface AlertConsolidationOutput {
  /** Consolidated severity (highest justified level) */
  consolidated_severity: EscalationLevel;
  /** Single actionable summary for clinician */
  actionable_summary: string;
  /** Root causes identified */
  root_causes: RootCause[];
  /** Disposition of each individual alert */
  alert_dispositions: AlertDispositionRecord[];
  /** Total alerts processed */
  total_alerts: number;
  /** How many were consolidated vs standalone */
  consolidated_count: number;
  /** Whether this consolidation requires clinician review */
  requires_review: boolean;
}

// ============================================================================
// P3: Confidence Calibration — calibrate-confidence
// ============================================================================

/** A factor contributing to a risk score */
export interface RiskFactor {
  /** Factor name (e.g., "hypertension", "missed_checkins", "lives_alone") */
  name: string;
  /** Weight in the original scoring (0-1) */
  original_weight: number;
  /** Category: clinical, sdoh, behavioral, demographic */
  category: string;
  /** Source of data for this factor */
  data_source: string;
  /** When data was last updated */
  data_freshness: string;
}

/** Input for calibrate-confidence tool */
export interface ConfidenceCalibrationInput {
  /** Patient identifier */
  patient_id: string;
  /** Tenant for RLS scoping */
  tenant_id: string;
  /** Which AI skill produced the original score */
  skill_key: string;
  /** Original risk score (0-100) */
  original_score: number;
  /** Original confidence (0-1) */
  original_confidence: number;
  /** Factors that contributed to the score */
  factors: RiskFactor[];
  /** Population context for calibration */
  population_context?: {
    /** Primary language spoken */
    primary_language?: string;
    /** Cultural/community group identifier (de-identified) */
    community_group?: string;
    /** Rural/urban/suburban */
    setting?: string;
    /** Insurance type */
    insurance_category?: string;
  };
}

/** Calibrated reliability for each factor */
export interface FactorReliability {
  /** Factor name (matches input factor) */
  factor_name: string;
  /** Reliability of this factor for this population */
  reliability: DataReliability;
  /** Adjusted weight after calibration */
  adjusted_weight: number;
  /** Why the weight was adjusted */
  adjustment_reasoning: string;
}

/** Output from calibrate-confidence tool */
export interface ConfidenceCalibrationOutput {
  /** Calibrated risk score (0-100) */
  calibrated_score: number;
  /** Calibrated confidence (0-1) */
  calibrated_confidence: number;
  /** Direction of adjustment */
  adjustment_direction: "increased" | "decreased" | "unchanged";
  /** Magnitude of score change */
  score_delta: number;
  /** Human-readable reasoning for calibration */
  adjustment_reasoning: string;
  /** Per-factor reliability assessments */
  factor_reliability: FactorReliability[];
  /** Recommended next action based on calibrated score */
  recommended_action: string;
  /** Whether a caregiver/family interview would improve confidence */
  needs_additional_data: boolean;
  /** What additional data would help (if needs_additional_data is true) */
  additional_data_suggestions: string[];
}

// ============================================================================
// P4: Handoff Narrative Synthesis — synthesize-handoff-narrative
// ============================================================================

/** An escalation event within the shift */
export interface ShiftEscalationEvent {
  /** When the event occurred */
  timestamp: string;
  /** Event type */
  event_type: string;
  /** Severity at time of event */
  severity: EscalationLevel;
  /** Brief description */
  description: string;
  /** Current status: active, resolved, monitoring */
  status: "active" | "resolved" | "monitoring";
  /** Resolution details (if resolved) */
  resolution?: string;
}

/** Care plan change during the shift */
export interface CarePlanChange {
  /** What changed */
  change_description: string;
  /** Who made the change (role, not name) */
  changed_by_role: string;
  /** When */
  timestamp: string;
  /** Why */
  reason: string;
}

/** Pending action that needs attention next shift */
export interface PendingAction {
  /** What needs to be done */
  action: string;
  /** Priority */
  priority: UrgencyLevel;
  /** When it's due */
  due_by: string;
  /** Who should do it (role) */
  assigned_role: string;
  /** Additional context */
  context: string;
}

/** Input for synthesize-handoff-narrative tool */
export interface HandoffNarrativeInput {
  /** Unit/floor identifier */
  unit_id: string;
  /** Tenant for RLS scoping */
  tenant_id: string;
  /** Shift window start (ISO 8601) */
  shift_start: string;
  /** Shift window end (ISO 8601) */
  shift_end: string;
  /** Patient IDs on this unit (never names) */
  patient_ids: string[];
  /** Escalation events during the shift */
  escalation_events: ShiftEscalationEvent[];
  /** Care plan changes during the shift */
  care_plan_changes: CarePlanChange[];
  /** Pending actions for next shift */
  pending_actions: PendingAction[];
}

/** A critical item the next shift must know about */
export interface CriticalItem {
  /** Patient ID */
  patient_id: string;
  /** What's critical */
  description: string;
  /** Why it's critical */
  reasoning: string;
  /** Urgency */
  urgency: UrgencyLevel;
  /** Recommended first action */
  recommended_action: string;
}

/** Output from synthesize-handoff-narrative tool */
export interface HandoffNarrativeOutput {
  /** "What matters most" narrative for the incoming shift */
  narrative: string;
  /** Critical items requiring immediate attention */
  critical_items: CriticalItem[];
  /** What was resolved during this shift (good news) */
  resolved_since_last_shift: string[];
  /** Items to watch but not act on immediately */
  watch_items: string[];
  /** Overall unit status assessment */
  unit_status: "stable" | "busy" | "high_acuity" | "critical";
  /** Estimated complexity for incoming shift */
  incoming_complexity: "light" | "moderate" | "heavy";
}
