/**
 * Mental Health Service Requests & Therapy Sessions
 * FHIR-compliant types for service requests (FHIR ServiceRequest)
 * and therapy sessions (FHIR Encounter).
 */

import type {
  RiskLevel,
  SessionType,
  SessionStatus,
  ServiceRequestStatus,
  ServiceRequestIntent,
  Priority,
  Modality,
  OutcomeStatus,
  DurationExceptionCode,
} from './baseTypes';

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
