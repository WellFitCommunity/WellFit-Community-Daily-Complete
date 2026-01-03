/**
 * Mental Health Intervention System Types
 * Enterprise-grade TypeScript types for FHIR-compliant mental health support
 *
 * Clinical Standards: Joint Commission, CMS CoP, Evidence-based suicide prevention
 * Compliance: HIPAA, Texas Health & Safety Code §161.0075
 */

// ============================================================================
// BASE TYPES
// ============================================================================

export type RiskLevel = 'low' | 'moderate' | 'high';
export type SessionType = 'inpatient' | 'outpatient' | 'telehealth';
export type SessionStatus = 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
export type ServiceRequestStatus = 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
export type ServiceRequestIntent = 'proposal' | 'plan' | 'directive' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
export type Priority = 'routine' | 'urgent' | 'asap' | 'stat';

export type SuicidalIdeation = 'none' | 'passive' | 'active';
export type SuicidalPlan = 'none' | 'vague' | 'specific';
export type SuicidalIntent = 'none' | 'uncertain' | 'present';
export type MeansAccess = 'no_access' | 'potential_access' | 'immediate_access';

export type PHQ9Severity = 'none' | 'mild' | 'moderate' | 'moderately_severe' | 'severe';
export type GAD7Severity = 'none' | 'mild' | 'moderate' | 'severe';
export type AdjustmentResponse = 'adaptive' | 'maladaptive' | 'mixed';
export type PatientEngagement = 'engaged' | 'ambivalent' | 'resistant';

export type EscalationLevel = 'moderate' | 'high' | 'stat';
export type EscalationStatus = 'active' | 'in-progress' | 'resolved' | 'cancelled';

export type FlagType = 'suicide_risk' | 'active_monitoring' | 'psychiatric_consult_pending' | 'discharge_hold' | 'safety_plan_required' | 'high_risk_alert';
export type FlagStatus = 'active' | 'inactive' | 'entered-in-error';

export type Modality = 'in-person' | 'telehealth-video' | 'telehealth-phone';
export type OutcomeStatus = 'completed' | 'incomplete' | 'refused' | 'rescheduled';
export type DurationExceptionCode = 'patient_unstable' | 'patient_refused' | 'patient_distress' | 'emergency_intervention' | 'other';

// ============================================================================
// TRIGGER CONDITIONS
// ============================================================================

export interface MentalHealthTriggerCondition {
  id: string;
  created_at: string;
  updated_at: string;

  condition_type: 'diagnosis' | 'procedure' | 'functional_decline' | 'icu_stay' | 'dme_order';
  icd10_code?: string;
  cpt_code?: string;
  snomed_code?: string;
  description: string;
  risk_level: RiskLevel;

  is_active: boolean;
  auto_create_service_request: boolean;
  priority: Priority;

  rationale?: string;
  evidence_basis?: string;

  created_by?: string;
  updated_by?: string;
}

// ============================================================================
// SERVICE REQUEST (FHIR ServiceRequest)
// ============================================================================

export interface MentalHealthServiceRequest {
  id: string;
  fhir_id: string;
  created_at: string;
  updated_at: string;

  // FHIR fields
  status: ServiceRequestStatus;
  intent: ServiceRequestIntent;
  priority: Priority;

  // Subject
  patient_id: string;
  encounter_id?: string;

  // Code
  code_system: string;
  code: string;
  code_display: string;

  // Category
  category: string[];

  // Requester
  requester_type?: string;
  requester_id?: string;
  requester_display?: string;

  // Performer
  performer_type?: string;
  performer_id?: string;
  performer_display?: string;

  // Reason
  reason_code?: string[];
  reason_display?: string[];
  reason_reference_type?: string;
  reason_reference_id?: string;

  // Timing
  occurrence_datetime?: string;
  occurrence_period_start?: string;
  occurrence_period_end?: string;
  authored_on: string;

  // Session Requirements
  session_type: SessionType;
  session_number: number;
  total_sessions_required: number;
  min_duration_minutes: number;

  // Discharge Blocker
  is_discharge_blocker: boolean;
  discharge_blocker_active: boolean;
  discharge_blocker_override_by?: string;
  discharge_blocker_override_reason?: string;
  discharge_blocker_override_at?: string;

  // Notes
  note?: string;
  supporting_info?: string[];

  // Completion
  completed_at?: string;
  completed_by?: string;
  outcome?: string;

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface CreateMentalHealthServiceRequest {
  patient_id: string;
  encounter_id?: string;
  status?: ServiceRequestStatus;
  intent?: ServiceRequestIntent;
  priority?: Priority;
  session_type: SessionType;
  reason_code?: string[];
  reason_display?: string[];
  is_discharge_blocker?: boolean;
  note?: string;
}

// ============================================================================
// THERAPY SESSION (FHIR Encounter)
// ============================================================================

export interface MentalHealthTherapySession {
  id: string;
  fhir_id: string;
  created_at: string;
  updated_at: string;

  // FHIR Encounter fields
  status: SessionStatus;
  class: string;

  // Subject
  patient_id: string;
  service_request_id?: string;

  // Type
  type_code: string;
  type_display: string;

  // Session Details
  session_number: number;
  session_type: SessionType;
  is_first_session: boolean;
  is_discharge_required_session: boolean;

  // Timing
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  duration_minutes?: number;

  // Duration Validation
  min_duration_met: boolean;
  min_duration_required: number;
  duration_exception_reason?: string;
  duration_exception_code?: DurationExceptionCode;

  // Participant (Therapist)
  participant_type?: string;
  participant_id?: string;
  participant_display?: string;

  // Location
  location_type?: string;
  location_display?: string;
  room_number?: string;

  // Modality
  modality: Modality;

  // Clinical Documentation
  chief_complaint?: string;
  history_of_present_illness?: string;
  assessment?: string;
  plan?: string;

  // Billing
  billing_code: string;
  billing_modifier?: string;
  billing_status: 'pending' | 'submitted' | 'paid' | 'denied';

  // Outcome
  outcome_status?: OutcomeStatus;
  outcome_note?: string;

  // Follow-up
  follow_up_needed: boolean;
  follow_up_scheduled: boolean;
  follow_up_date?: string;

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface CreateTherapySession {
  patient_id: string;
  service_request_id?: string;
  session_number: number;
  session_type: SessionType;
  is_first_session?: boolean;
  is_discharge_required_session?: boolean;
  scheduled_start: string;
  scheduled_end: string;
  participant_id?: string;
  participant_display?: string;
  modality: Modality;
  location_display?: string;
  room_number?: string;
}

export interface CompleteTherapySession {
  actual_start: string;
  actual_end: string;
  status: 'finished' | 'cancelled' | 'entered-in-error';
  outcome_status: OutcomeStatus;
  chief_complaint?: string;
  history_of_present_illness?: string;
  assessment: string;
  plan: string;
  outcome_note?: string;
  duration_exception_reason?: string;
  duration_exception_code?: DurationExceptionCode;
}

// ============================================================================
// RISK ASSESSMENT (FHIR Observation)
// ============================================================================

export interface MentalHealthRiskAssessment {
  id: string;
  fhir_id: string;
  created_at: string;
  updated_at: string;

  // FHIR Observation fields
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';

  // Subject
  patient_id: string;
  therapy_session_id?: string;

  // Code
  code_system: string;
  code: string;
  code_display: string;

  // Category
  category: string[];

  // Timing
  effective_datetime: string;
  issued: string;

  // Performer
  performer_type?: string;
  performer_id?: string;
  performer_display?: string;

  // RISK LEVEL (Primary Value)
  risk_level: RiskLevel;

  // Suicide Screening Components
  suicidal_ideation?: SuicidalIdeation;
  suicidal_plan?: SuicidalPlan;
  suicidal_intent?: SuicidalIntent;
  means_access?: MeansAccess;

  // Depression Screening (PHQ-9)
  phq9_score?: number;
  phq9_severity?: PHQ9Severity;

  // Anxiety Screening (GAD-7)
  gad7_score?: number;
  gad7_severity?: GAD7Severity;

  // Clinical Impression
  clinical_impression: string;
  adjustment_response?: AdjustmentResponse;
  coping_mechanisms?: string[];
  support_system_adequate?: boolean;
  patient_engagement?: PatientEngagement;

  // Protective/Risk Factors
  protective_factors?: string[];
  risk_factors?: string[];

  // Interpretation
  interpretation_code?: 'L' | 'N' | 'H' | 'HH';
  interpretation_display?: string;

  // Notes
  note?: string;

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface CreateRiskAssessment {
  patient_id: string;
  therapy_session_id: string;
  risk_level: RiskLevel;
  suicidal_ideation: SuicidalIdeation;
  suicidal_plan: SuicidalPlan;
  suicidal_intent: SuicidalIntent;
  means_access: MeansAccess;
  phq9_score?: number;
  gad7_score?: number;
  clinical_impression: string;
  adjustment_response?: AdjustmentResponse;
  coping_mechanisms?: string[];
  support_system_adequate?: boolean;
  patient_engagement?: PatientEngagement;
  protective_factors?: string[];
  risk_factors?: string[];
  note?: string;
}

// ============================================================================
// SAFETY PLAN (FHIR DocumentReference)
// ============================================================================

export interface SafetyPlanContact {
  name: string;
  phone: string;
  relationship?: string;
  role?: string;
  available?: string;
}

export interface MentalHealthSafetyPlan {
  id: string;
  fhir_id: string;
  created_at: string;
  updated_at: string;

  // FHIR DocumentReference fields
  status: 'current' | 'superseded' | 'entered-in-error';

  // Subject
  patient_id: string;
  risk_assessment_id?: string;
  therapy_session_id?: string;

  // Document Type
  type_code: string;
  type_display: string;
  category: string[];

  // Security
  security_label: 'normal' | 'sensitive' | 'restricted' | 'very-restricted';

  // Date
  date: string;

  // Author
  author_type?: string;
  author_id?: string;
  author_display?: string;

  // SAFETY PLAN CONTENT (Stanley-Brown Model)
  // Step 1: Warning signs
  warning_signs: string[];

  // Step 2: Internal coping strategies
  internal_coping_strategies: string[];

  // Step 3: People and social settings for distraction
  social_distraction_people?: string[];
  social_distraction_places?: string[];

  // Step 4: People to ask for help
  people_to_contact?: SafetyPlanContact[];

  // Step 5: Professionals and agencies to contact
  professional_contacts: SafetyPlanContact[];
  crisis_hotlines: SafetyPlanContact[];

  // Step 6: Making environment safe
  means_restriction_steps: string[];
  lethal_means_addressed: boolean;

  // Additional Content
  scheduled_follow_ups?: string[];
  patient_signature_obtained: boolean;
  patient_signature_date?: string;
  patient_verbalized_understanding: boolean;

  // Distribution
  copy_given_to_patient: boolean;
  copy_given_to_family: boolean;
  copy_in_chart: boolean;

  // Notes
  note?: string;

  // Document Storage
  document_url?: string;
  content_type: string;

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface CreateSafetyPlan {
  patient_id: string;
  risk_assessment_id: string;
  therapy_session_id: string;
  warning_signs: string[];
  internal_coping_strategies: string[];
  social_distraction_people?: string[];
  social_distraction_places?: string[];
  people_to_contact?: SafetyPlanContact[];
  professional_contacts: SafetyPlanContact[];
  crisis_hotlines: SafetyPlanContact[];
  means_restriction_steps: string[];
  lethal_means_addressed: boolean;
  patient_verbalized_understanding: boolean;
  copy_given_to_patient?: boolean;
  copy_given_to_family?: boolean;
  note?: string;
}

// ============================================================================
// ESCALATIONS & ALERTS
// ============================================================================

export interface NotificationRecord {
  recipient: string;
  role: string;
  method: 'page' | 'sms' | 'email' | 'in-app';
  sent_at: string;
  delivered: boolean;
}

export interface MentalHealthEscalation {
  id: string;
  created_at: string;
  updated_at: string;

  // Subject
  patient_id: string;
  risk_assessment_id?: string;
  therapy_session_id?: string;

  // Escalation Details
  escalation_level: EscalationLevel;
  escalation_reason: string;
  trigger_criteria: string[];

  // Actions Taken
  actions_required: string[];
  psych_consult_ordered: boolean;
  psych_consult_id?: string;
  one_to_one_observation_recommended: boolean;
  safety_plan_created: boolean;
  attending_notified: boolean;
  attending_notified_at?: string;
  attending_notified_by?: string;

  // Notifications
  notifications_sent?: NotificationRecord[];

  // Status
  status: EscalationStatus;
  resolved_at?: string;
  resolved_by?: string;
  resolution_note?: string;

  // Audit
  created_by?: string;
  updated_by?: string;
}

// ============================================================================
// FLAGS (FHIR Flag)
// ============================================================================

export interface MentalHealthFlag {
  id: string;
  fhir_id: string;
  created_at: string;
  updated_at: string;

  // FHIR Flag fields
  status: FlagStatus;

  // Subject
  patient_id: string;

  // Category & Code
  category: string[];
  code_system: string;
  code: string;
  code_display: string;

  // Period
  period_start: string;
  period_end?: string;

  // Author
  author_type?: string;
  author_id?: string;
  author_display?: string;

  // Flag Details
  flag_type: FlagType;
  severity?: 'low' | 'medium' | 'high' | 'critical';

  // Alert Behavior
  show_on_banner: boolean;
  alert_frequency: 'once' | 'daily' | 'always';

  // Notes
  note?: string;

  // Audit
  created_by?: string;
  updated_by?: string;
}

// ============================================================================
// DISCHARGE CHECKLIST
// ============================================================================

export interface MentalHealthDischargeChecklist {
  id: string;
  created_at: string;
  updated_at: string;

  // Patient
  patient_id: string;
  encounter_id?: string;

  // Checklist Items
  initial_therapy_session_completed: boolean;
  initial_therapy_session_id?: string;
  risk_assessment_completed: boolean;
  risk_assessment_id?: string;
  safety_plan_created: boolean;
  safety_plan_id?: string;
  outpatient_therapy_scheduled: boolean;
  outpatient_first_appt_date?: string;
  resources_provided: boolean;
  patient_education_completed: boolean;

  // High Risk Additional Requirements
  psychiatric_clearance_obtained: boolean;
  psychiatric_clearance_by?: string;
  psychiatric_clearance_date?: string;
  family_support_engaged: boolean;
  crisis_plan_provided: boolean;

  // Overall Status
  all_requirements_met: boolean;
  discharge_cleared: boolean;
  discharge_cleared_by?: string;
  discharge_cleared_at?: string;

  // Override
  override_required: boolean;
  override_granted: boolean;
  override_by?: string;
  override_reason?: string;
  override_at?: string;

  // Notes
  note?: string;

  // Audit
  created_by?: string;
  updated_by?: string;
}

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
  low: '✓',
  moderate: '⚠️',
  high: '🚨',
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
