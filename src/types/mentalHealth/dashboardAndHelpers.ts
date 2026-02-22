/**
 * Mental Health Dashboard Views, Quality Metrics, Constants & Helper Functions
 * Dashboard summary types, API response wrappers, display constants,
 * and clinical scoring/sorting utilities.
 */

import type {
  RiskLevel,
  SessionType,
  SessionStatus,
  ServiceRequestStatus,
  Priority,
  SuicidalIdeation,
  SuicidalPlan,
  SuicidalIntent,
  MeansAccess,
  PHQ9Severity,
  GAD7Severity,
} from './baseTypes';

import type { SafetyPlanContact } from './riskAndSafety';

// ============================================================================
// DASHBOARD VIEWS
// ============================================================================

export interface ActiveMentalHealthPatient {
  patient_id: string;
  first_name?: string;
  last_name?: string;
  mrn?: string;
  room_number?: string;
  service_request_id: string;
  service_request_status: ServiceRequestStatus;
  session_type: SessionType;
  priority: Priority;
  is_discharge_blocker: boolean;
  discharge_blocker_active: boolean;
  risk_level?: RiskLevel;
  last_risk_assessment_date?: string;
  session_status?: SessionStatus;
  next_session_scheduled?: string;
  discharge_ready?: boolean;
  active_flag?: string;
}

export interface PendingMentalHealthSession {
  session_id: string;
  patient_id: string;
  first_name?: string;
  last_name?: string;
  room_number?: string;
  status: SessionStatus;
  session_type: SessionType;
  session_number: number;
  is_discharge_required_session: boolean;
  scheduled_start?: string;
  scheduled_end?: string;
  therapist?: string;
  priority?: Priority;
  risk_level?: RiskLevel;
}

export interface DischargeBlocker {
  patient_id: string;
  first_name?: string;
  last_name?: string;
  mrn?: string;
  room_number?: string;
  service_request_id: string;
  session_type: SessionType;
  initial_therapy_session_completed: boolean;
  risk_assessment_completed: boolean;
  safety_plan_created: boolean;
  outpatient_therapy_scheduled: boolean;
  all_requirements_met: boolean;
  override_granted: boolean;
  override_reason?: string;
  active_flags?: string[];
}

// ============================================================================
// QUALITY METRICS
// ============================================================================

export interface MentalHealthQualityMetrics {
  id: string;
  created_at: string;

  // Time Period
  period_start: string;
  period_end: string;

  // Volume Metrics
  total_triggers: number;
  total_service_requests_created: number;
  total_sessions_scheduled: number;
  total_sessions_completed: number;

  // Completion Rates
  initial_session_completion_rate?: number;
  outpatient_session_completion_rate?: number;
  discharge_checklist_completion_rate?: number;

  // Timing Metrics
  avg_time_trigger_to_first_session_hours?: number;
  avg_session_duration_minutes?: number;

  // Risk Distribution
  low_risk_count: number;
  moderate_risk_count: number;
  high_risk_count: number;

  // Escalations
  total_escalations: number;
  psych_consults_ordered: number;

  // Exceptions
  duration_exceptions_count: number;
  patient_refusals_count: number;
  discharge_overrides_count: number;

  // Outcomes
  readmission_rate_30day?: number;

  // Metadata
  calculated_at: string;
  calculated_by?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface MentalHealthApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface MentalHealthDashboardSummary {
  active_patients: number;
  pending_sessions: number;
  discharge_blockers: number;
  high_risk_count: number;
  moderate_risk_count: number;
  low_risk_count: number;
  escalations_today: number;
  sessions_completed_today: number;
  avg_session_duration_today?: number;
  patients: ActiveMentalHealthPatient[];
  pending_sessions_list: PendingMentalHealthSession[];
  discharge_blockers_list: DischargeBlocker[];
}

// ============================================================================
// COLOR AND DISPLAY CONSTANTS
// ============================================================================

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  low: '#10b981', // green-500
  moderate: '#f59e0b', // amber-500
  high: '#ef4444', // red-500
};

export const RISK_LEVEL_BG_COLORS: Record<RiskLevel, string> = {
  low: '#d1fae5', // green-100
  moderate: '#fef3c7', // amber-100
  high: '#fee2e2', // red-100
};

export const RISK_LEVEL_ICONS: Record<RiskLevel, string> = {
  low: '\u2713',
  moderate: '\u26A0\uFE0F',
  high: '\uD83D\uDEA8',
};

export const RISK_LEVEL_DISPLAY: Record<RiskLevel, string> = {
  low: 'Low Risk',
  moderate: 'Moderate Risk',
  high: 'High Risk - Immediate Attention Required',
};

export const SESSION_STATUS_DISPLAY: Record<SessionStatus, string> = {
  planned: 'Scheduled',
  arrived: 'Patient Arrived',
  triaged: 'In Triage',
  'in-progress': 'Session In Progress',
  onleave: 'On Leave',
  finished: 'Completed',
  cancelled: 'Cancelled',
  'entered-in-error': 'Error',
  unknown: 'Unknown',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  routine: '#6b7280', // gray-500
  urgent: '#f59e0b', // amber-500
  asap: '#f97316', // orange-500
  stat: '#dc2626', // red-600
};

export const PRIORITY_DISPLAY: Record<Priority, string> = {
  routine: 'Routine',
  urgent: 'Urgent',
  asap: 'ASAP',
  stat: 'STAT',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getRiskLevelFromPhq9(score: number): RiskLevel {
  if (score >= 20) return 'high';
  if (score >= 10) return 'moderate';
  return 'low';
}

export function getPhq9Severity(score: number): PHQ9Severity {
  if (score >= 20) return 'severe';
  if (score >= 15) return 'moderately_severe';
  if (score >= 10) return 'moderate';
  if (score >= 5) return 'mild';
  return 'none';
}

export function getGad7Severity(score: number): GAD7Severity {
  if (score >= 15) return 'severe';
  if (score >= 10) return 'moderate';
  if (score >= 5) return 'mild';
  return 'none';
}

export function calculateOverallRisk(
  suicidalIdeation: SuicidalIdeation,
  suicidalPlan: SuicidalPlan,
  suicidalIntent: SuicidalIntent,
  meansAccess: MeansAccess,
  phq9Score?: number
): RiskLevel {
  // High risk if active ideation with plan and intent
  if (
    suicidalIdeation === 'active' &&
    suicidalPlan !== 'none' &&
    suicidalIntent !== 'none'
  ) {
    return 'high';
  }

  // High risk if active ideation with immediate means access
  if (suicidalIdeation === 'active' && meansAccess === 'immediate_access') {
    return 'high';
  }

  // Moderate risk if passive ideation or vague plan
  if (suicidalIdeation === 'passive' || suicidalPlan === 'vague') {
    return 'moderate';
  }

  // Consider PHQ-9 if available
  if (phq9Score !== undefined && phq9Score >= 15) {
    return 'moderate';
  }

  return 'low';
}

export function formatSessionDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function isSessionDurationValid(
  duration: number,
  minRequired: number
): boolean {
  return duration >= minRequired;
}

export function generateCrisisHotlines(): SafetyPlanContact[] {
  return [
    {
      name: '988 Suicide & Crisis Lifeline',
      phone: '988',
      available: '24/7',
    },
    {
      name: 'Crisis Text Line',
      phone: 'Text HOME to 741741',
      available: '24/7',
    },
    {
      name: 'Veterans Crisis Line',
      phone: '988 then press 1',
      available: '24/7',
    },
    {
      name: 'SAMHSA National Helpline',
      phone: '1-800-662-4357',
      available: '24/7',
    },
  ];
}

export function sortPatientsByPriority(
  patients: ActiveMentalHealthPatient[]
): ActiveMentalHealthPatient[] {
  const priorityOrder: Record<Priority, number> = {
    stat: 1,
    urgent: 2,
    asap: 3,
    routine: 4,
  };

  const riskOrder: Record<RiskLevel, number> = {
    high: 1,
    moderate: 2,
    low: 3,
  };

  return [...patients].sort((a, b) => {
    // First by priority
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by risk level
    if (a.risk_level && b.risk_level) {
      const riskDiff = riskOrder[a.risk_level] - riskOrder[b.risk_level];
      if (riskDiff !== 0) return riskDiff;
    }

    // Then by discharge blocker status
    if (a.discharge_blocker_active && !b.discharge_blocker_active) return -1;
    if (!a.discharge_blocker_active && b.discharge_blocker_active) return 1;

    return 0;
  });
}
