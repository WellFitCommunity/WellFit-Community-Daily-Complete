/**
 * Communication Silence Window Algorithm Types
 *
 * Patent Pending - WellFit Community / Envision VirtualEdge Group LLC
 *
 * A novel predictive factor that detects engagement gaps indicating
 * elevated readmission risk. This proprietary algorithm monitors patient
 * communication patterns to trigger proactive interventions.
 *
 * HIPAA Compliance: All data uses patient IDs/tokens, never PHI in browser
 */

// =====================================================
// SILENCE WINDOW INPUT TYPES
// =====================================================

/**
 * Input data for silence window calculation
 * Aggregates communication metrics from multiple sources
 */
export interface SilenceWindowInput {
  /** Patient identifier (UUID, never PHI) */
  patientId: string;

  /** Days since last successful contact with patient */
  daysSinceLastContact: number;

  /** Count of outreach calls not answered or returned */
  missedOutreachCalls: number;

  /** Count of scheduled appointments not attended */
  missedAppointments: number;

  /** Count of messages sent to patient that remain unread */
  unreadMessages: number;

  /** Optional: Days since last check-in completion */
  daysSinceLastCheckIn?: number;

  /** Optional: Count of messages sent by patient in last 30 days */
  patientMessagesSent30Day?: number;

  /** Optional: Count of portal logins in last 30 days */
  portalLogins30Day?: number;

  /** Assessment date for historical calculations */
  assessmentDate?: string;
}

/**
 * Configurable weights for silence window scoring
 * Evidence-based defaults can be tuned per tenant/population
 */
export interface SilenceWindowWeights {
  /** Weight for days since contact (default: 0.35) */
  daysSinceContact: number;

  /** Weight for missed outreach calls (default: 0.25) */
  missedCalls: number;

  /** Weight for missed appointments (default: 0.25) */
  missedAppointments: number;

  /** Weight for unread messages (default: 0.15) */
  unreadMessages: number;
}

/**
 * Default evidence-based weights for silence window calculation
 * Validated through clinical observation and CMS quality measures
 */
export const DEFAULT_SILENCE_WINDOW_WEIGHTS: SilenceWindowWeights = {
  daysSinceContact: 0.35,  // Primary indicator of disengagement
  missedCalls: 0.25,       // Active avoidance signal
  missedAppointments: 0.25, // Strong predictor of health decline
  unreadMessages: 0.15     // Passive disengagement indicator
} as const;

/**
 * Normalization thresholds for silence window scoring
 * Values above these are scored at maximum (100)
 */
export const SILENCE_WINDOW_THRESHOLDS = {
  maxDaysSinceContact: 30,   // 30+ days = max score
  maxMissedCalls: 5,         // 5+ missed calls = max score
  maxMissedAppointments: 3,  // 3+ missed appointments = max score
  maxUnreadMessages: 10      // 10+ unread messages = max score
} as const;

// =====================================================
// SILENCE WINDOW OUTPUT TYPES
// =====================================================

/**
 * Risk level classification for silence window
 */
export type SilenceWindowRiskLevel = 'normal' | 'elevated' | 'critical';

/**
 * Component scores breakdown for transparency
 */
export interface SilenceWindowComponents {
  /** Normalized score for days since contact (0-100) */
  dayScore: number;

  /** Normalized score for missed calls (0-100) */
  callScore: number;

  /** Normalized score for missed appointments (0-100) */
  apptScore: number;

  /** Normalized score for unread messages (0-100) */
  msgScore: number;
}

/**
 * Complete result from silence window calculation
 */
export interface SilenceWindowResult {
  /** Patient identifier */
  patientId: string;

  /** Overall silence window score (0-100) */
  score: number;

  /** Risk level classification */
  riskLevel: SilenceWindowRiskLevel;

  /** Whether score triggers an intervention alert */
  alertTriggered: boolean;

  /** Individual component scores for transparency */
  components: SilenceWindowComponents;

  /** Weights used in calculation */
  weightsApplied: SilenceWindowWeights;

  /** Recommended actions based on score */
  recommendedActions: SilenceWindowAction[];

  /** Timestamp of calculation */
  calculatedAt: string;

  /** Data completeness indicator (0-100) */
  dataConfidence: number;
}

/**
 * Recommended action based on silence window score
 */
export interface SilenceWindowAction {
  /** Action identifier */
  actionId: string;

  /** Human-readable action description */
  description: string;

  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'urgent';

  /** Timeframe for action */
  timeframe: string;

  /** Responsible role */
  responsibleRole: 'care_coordinator' | 'nurse' | 'chw' | 'social_worker' | 'physician';

  /** Specific steps to take */
  steps: string[];

  /** Expected impact on engagement */
  expectedImpact: string;
}

/**
 * Risk thresholds for silence window scoring
 */
export const SILENCE_WINDOW_RISK_THRESHOLDS = {
  critical: 70,   // >= 70 = critical risk, immediate intervention
  elevated: 40,   // >= 40 = elevated risk, proactive outreach
  normal: 0       // < 40 = normal, continue monitoring
} as const;

// =====================================================
// SILENCE WINDOW TREND TYPES
// =====================================================

/**
 * Historical silence window score for trend analysis
 */
export interface SilenceWindowHistoryEntry {
  /** Date of assessment */
  date: string;

  /** Score at that date */
  score: number;

  /** Risk level at that date */
  riskLevel: SilenceWindowRiskLevel;

  /** Whether alert was triggered */
  alertTriggered: boolean;
}

/**
 * Trend analysis result
 */
export interface SilenceWindowTrend {
  /** Patient identifier */
  patientId: string;

  /** Current score */
  currentScore: number;

  /** Average score over 30 days */
  averageScore30Day: number;

  /** Score 7 days ago (for comparison) */
  score7DaysAgo?: number;

  /** Trend direction */
  trendDirection: 'improving' | 'stable' | 'worsening';

  /** Percent change from 7 days ago */
  changePercent7Day: number;

  /** Is score deteriorating rapidly? */
  isRapidDeterioration: boolean;

  /** Historical scores */
  history: SilenceWindowHistoryEntry[];
}

// =====================================================
// INTEGRATION WITH READMISSION RISK
// =====================================================

/**
 * Silence window contribution to readmission risk
 * Used when integrating with comprehensive risk prediction
 */
export interface SilenceWindowRiskContribution {
  /** Raw silence window score (0-100) */
  silenceScore: number;

  /** Normalized contribution to readmission risk (0-1) */
  riskContribution: number;

  /** Weight applied in readmission model */
  weight: number;

  /** Whether this factor triggered high-risk classification */
  triggeredHighRisk: boolean;

  /** Explanation for clinical staff */
  explanation: string;
}

/**
 * Database schema for silence window tracking
 * Matches the PostgreSQL table structure
 */
export interface SilenceWindowRecord {
  id: string;
  patient_id: string;
  tenant_id: string;
  assessment_date: string;

  // Input metrics
  days_since_last_contact: number;
  missed_outreach_calls: number;
  missed_appointments: number;
  unread_messages: number;
  days_since_last_check_in: number | null;
  patient_messages_sent_30_day: number | null;
  portal_logins_30_day: number | null;

  // Calculated scores
  silence_score: number;
  risk_level: SilenceWindowRiskLevel;
  alert_triggered: boolean;

  // Component scores
  day_score: number;
  call_score: number;
  appt_score: number;
  msg_score: number;

  // Metadata
  data_confidence: number;
  weights_applied: SilenceWindowWeights;
  recommended_actions: SilenceWindowAction[];

  created_at: string;
  updated_at: string;
}

/**
 * Parameters for fetching silence window data
 */
export interface SilenceWindowQueryParams {
  patientId: string;
  startDate?: string;
  endDate?: string;
  includeHistory?: boolean;
  includeTrend?: boolean;
}

/**
 * Bulk assessment input for processing multiple patients
 */
export interface BulkSilenceWindowInput {
  tenantId: string;
  patientIds: string[];
  assessmentDate?: string;
  useCache?: boolean;
}

/**
 * Bulk assessment result
 */
export interface BulkSilenceWindowResult {
  tenantId: string;
  assessmentDate: string;
  totalPatients: number;
  assessedPatients: number;
  skippedPatients: number;
  results: SilenceWindowResult[];
  criticalAlerts: number;
  elevatedAlerts: number;
  processingTimeMs: number;
}
