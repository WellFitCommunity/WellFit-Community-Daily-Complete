// ============================================================================
// Shift Handoff Risk System - TypeScript Type Definitions
// ============================================================================
// Purpose: Smart shift handoff with AI auto-scoring + nurse oversight
// Use Case: Prioritize which hospital patients to see first during rounds
// ============================================================================

// ============================================================================
// PART 1: RISK SCORES
// ============================================================================

/**
 * Shift handoff risk score (auto-calculated + nurse-adjusted)
 */
export interface ShiftHandoffRiskScore {
  id: string; // UUID
  patient_id: string; // FK to auth.users
  admission_id?: string | null; // FK to patient_admissions

  // Shift metadata
  shift_date: string; // ISO 8601 date
  shift_type: 'day' | 'evening' | 'night';
  scoring_time: string; // ISO 8601 datetime

  // Auto-calculated scores (0-100)
  auto_medical_acuity_score: number | null;
  auto_stability_score: number | null;
  auto_early_warning_score: number | null; // MEWS/NEWS
  auto_event_risk_score: number | null;

  // Computed fields (database generated)
  auto_composite_score?: number; // Read-only, weighted average
  auto_risk_level?: RiskLevel; // Read-only

  // Nurse review
  nurse_reviewed: boolean;
  nurse_id?: string | null; // FK to auth.users
  nurse_reviewed_at?: string | null; // ISO 8601 datetime

  // Nurse adjustments
  nurse_risk_level?: RiskLevel | null; // Overrides auto if set
  nurse_adjustment_reason?: string | null;

  // Final risk level (computed: nurse override wins, else auto)
  final_risk_level?: RiskLevel; // Read-only

  // Risk factors
  risk_factors: string[]; // Array of flags like 'unstable_vitals', 'sepsis_risk'

  // Clinical snapshot
  clinical_snapshot: ClinicalSnapshot;

  // Handoff priority (1 = see first)
  handoff_priority: number | null;

  // Audit
  created_at: string;
  updated_at: string;
}

/**
 * Risk level enum
 */
export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Shift type enum
 */
export type ShiftType = 'day' | 'evening' | 'night';

/**
 * Clinical snapshot for handoff report
 */
export interface ClinicalSnapshot {
  bp_trend?: string; // "190/110 → 170/95 (improving)"
  o2_sat?: string; // "94% on 2L"
  heart_rate?: number;
  temp?: number;
  glucose?: number;
  recent_events?: string[]; // ["Confused at 1900", "Family reports agitation"]
  prn_meds_today?: number;
  last_assessment?: string; // "2 hours ago"
  diagnosis?: string; // "Post-stroke, day 3"
  room_number?: string;
  [key: string]: any; // Allow additional fields
}

// ============================================================================
// PART 2: SHIFT HANDOFF EVENTS
// ============================================================================

/**
 * Clinical event during shift that impacts risk
 */
export interface ShiftHandoffEvent {
  id: string; // UUID
  risk_score_id: string; // FK
  patient_id: string; // FK

  // Event metadata
  event_time: string; // ISO 8601 datetime
  event_type: EventType;

  // Event details
  event_severity: EventSeverity;
  event_description: string;

  // Impact
  increases_risk: boolean;
  risk_weight: number; // 0-100

  // Response
  action_taken?: string | null;
  action_by?: string | null; // FK to auth.users

  // Audit
  created_at: string;
  created_by: string; // FK to auth.users
}

/**
 * Event type enum
 */
export type EventType =
  | 'vital_change'
  | 'medication_given'
  | 'prn_administered'
  | 'lab_result'
  | 'imaging_ordered'
  | 'code_blue'
  | 'rapid_response'
  | 'fall'
  | 'neuro_change'
  | 'behavioral_issue'
  | 'family_concern'
  | 'other';

/**
 * Event severity enum
 */
export type EventSeverity = 'minor' | 'moderate' | 'major' | 'critical';

// ============================================================================
// PART 3: HANDOFF SUMMARY (UI Display Types)
// ============================================================================

/**
 * Current shift handoff summary (returned by get_current_shift_handoff function)
 */
export interface ShiftHandoffSummary {
  risk_score_id: string; // UUID of the risk score record for confirm/escalate actions
  patient_id: string;
  patient_name: string;
  room_number: string | null;
  final_risk_level: RiskLevel;
  auto_risk_level: RiskLevel;
  nurse_reviewed: boolean; // TRUE if nurse confirmed OR adjusted
  nurse_adjusted: boolean; // TRUE only if nurse changed the score
  handoff_priority: number | null;
  risk_factors: string[];
  clinical_snapshot: ClinicalSnapshot;
  recent_events: HandoffEvent[] | null; // Simplified events for display
}

/**
 * Simplified event for handoff display
 */
export interface HandoffEvent {
  event_time: string;
  event_type: EventType;
  event_severity: EventSeverity;
  event_description: string;
  action_taken?: string | null;
}

// ============================================================================
// PART 4: FORM INPUT TYPES
// ============================================================================

/**
 * Nurse review form input
 */
export interface NurseReviewInput {
  risk_score_id: string;
  nurse_risk_level?: RiskLevel | null; // NULL = confirm auto, else override
  nurse_adjustment_reason?: string | null;
}

/**
 * Manual event entry form
 */
export interface ManualEventInput {
  risk_score_id: string;
  patient_id: string;
  event_type: EventType;
  event_severity: EventSeverity;
  event_description: string;
  action_taken?: string;
}

/**
 * Early warning score input (vitals)
 */
export interface EarlyWarningScoreInput {
  systolic_bp: number;
  heart_rate: number;
  respiratory_rate: number;
  temperature: number; // Celsius
  oxygen_sat: number; // Percentage
}

// ============================================================================
// PART 5: DASHBOARD TYPES
// ============================================================================

/**
 * Handoff dashboard metrics
 */
export interface HandoffDashboardMetrics {
  total_patients: number;
  critical_patients: number;
  high_risk_patients: number;
  pending_nurse_review: number;
  nurse_adjusted_count: number;
  avg_auto_score: number;
}

/**
 * Patient risk trend (for charts)
 */
export interface PatientRiskTrend {
  patient_id: string;
  patient_name: string;
  risk_history: Array<{
    date: string;
    shift_type: ShiftType;
    risk_level: RiskLevel;
    composite_score: number;
  }>;
}

// ============================================================================
// PART 6: API RESPONSE TYPES
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface HandoffApiResponse<T> {
  data: T | null;
  error?: {
    message: string;
    code?: string;
  };
  metadata?: {
    timestamp: string;
    request_id?: string;
  };
}

// ============================================================================
// PART 7: CONSTANTS & ENUMS
// ============================================================================

/**
 * Risk level colors for UI
 */
export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-yellow-500 text-gray-900',
  LOW: 'bg-green-500 text-white',
};

/**
 * Risk level icons
 */
export const RISK_LEVEL_ICONS: Record<RiskLevel, string> = {
  CRITICAL: '🚨',
  HIGH: '⚠️',
  MEDIUM: '🟡',
  LOW: '✅',
};

/**
 * Event type labels
 */
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  vital_change: 'Vital Sign Change',
  medication_given: 'Medication Given',
  prn_administered: 'PRN Administered',
  lab_result: 'Lab Result',
  imaging_ordered: 'Imaging Ordered',
  code_blue: 'Code Blue',
  rapid_response: 'Rapid Response',
  fall: 'Fall',
  neuro_change: 'Neuro Change',
  behavioral_issue: 'Behavioral Issue',
  family_concern: 'Family Concern',
  other: 'Other Event',
};

/**
 * Event severity colors
 */
export const EVENT_SEVERITY_COLORS: Record<EventSeverity, string> = {
  critical: 'text-red-700 bg-red-50',
  major: 'text-orange-700 bg-orange-50',
  moderate: 'text-yellow-700 bg-yellow-50',
  minor: 'text-blue-700 bg-blue-50',
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if risk level is critical or high
 */
export function isHighPriority(risk: RiskLevel): boolean {
  return risk === 'CRITICAL' || risk === 'HIGH';
}

/**
 * Check if event is severe (major or critical)
 */
export function isSevereEvent(severity: EventSeverity): boolean {
  return severity === 'critical' || severity === 'major';
}

/**
 * Check if nurse has adjusted the score
 */
export function hasNurseOverride(score: ShiftHandoffRiskScore): boolean {
  return score.nurse_risk_level !== null && score.nurse_risk_level !== undefined;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get risk level from numeric score (0-100)
 */
export function getRiskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

/**
 * Calculate composite score from component scores
 */
export function calculateCompositeScore(
  medical_acuity: number,
  stability: number,
  early_warning: number,
  event_risk: number
): number {
  return Math.round(
    medical_acuity * 0.30 +
    stability * 0.25 +
    early_warning * 0.30 +
    event_risk * 0.15
  );
}

/**
 * Format time since event (e.g., "2 hours ago")
 */
export function formatTimeSince(timestamp: string): string {
  const now = new Date();
  const eventTime = new Date(timestamp);
  const diffMs = now.getTime() - eventTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) {
    return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

/**
 * Sort handoff summary by priority
 */
export function sortHandoffByPriority(
  summaries: ShiftHandoffSummary[]
): ShiftHandoffSummary[] {
  const riskOrder: Record<RiskLevel, number> = {
    CRITICAL: 1,
    HIGH: 2,
    MEDIUM: 3,
    LOW: 4,
  };

  return [...summaries].sort((a, b) => {
    // First by risk level
    const riskDiff = riskOrder[a.final_risk_level] - riskOrder[b.final_risk_level];
    if (riskDiff !== 0) return riskDiff;

    // Then by handoff priority (if set)
    if (a.handoff_priority && b.handoff_priority) {
      return a.handoff_priority - b.handoff_priority;
    }

    // Then by room number
    if (a.room_number && b.room_number) {
      return a.room_number.localeCompare(b.room_number);
    }

    return 0;
  });
}
