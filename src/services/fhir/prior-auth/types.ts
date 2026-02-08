/**
 * FHIR Prior Authorization Types
 * CMS-0057-F Compliant Prior Authorization Type Definitions
 *
 * @see https://hl7.org/fhir/us/davinci-pas/
 * @see https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f
 */

// =====================================================
// Status & Enum Types
// =====================================================

export type PriorAuthStatus =
  | 'draft'
  | 'pending_submission'
  | 'submitted'
  | 'pending_review'
  | 'approved'
  | 'denied'
  | 'partial_approval'
  | 'pending_additional_info'
  | 'cancelled'
  | 'expired'
  | 'appealed';

export type PriorAuthUrgency = 'stat' | 'urgent' | 'routine';

export type PriorAuthDecisionType = 'approved' | 'denied' | 'partial_approval' | 'pended' | 'cancelled';

export type AppealStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'peer_to_peer_scheduled'
  | 'peer_to_peer_completed'
  | 'approved'
  | 'denied'
  | 'withdrawn';

// =====================================================
// Core Interfaces
// =====================================================

export interface PriorAuthServiceLine {
  line_number: number;
  cpt_code: string;
  cpt_description?: string;
  modifier_codes?: string[];
  diagnosis_pointers?: number[];
  requested_units: number;
  approved_units?: number;
  unit_type?: string;
  service_date?: string;
  service_start_date?: string;
  service_end_date?: string;
  line_status?: string;
  denial_reason?: string;
}

export interface PriorAuthorization {
  id: string;
  patient_id: string;
  encounter_id?: string;
  claim_id?: string;
  ordering_provider_npi?: string;
  rendering_provider_npi?: string;
  facility_npi?: string;
  payer_id: string;
  payer_name?: string;
  member_id?: string;
  group_number?: string;
  auth_number?: string;
  reference_number?: string;
  trace_number?: string;
  service_type_code?: string;
  service_type_description?: string;
  service_codes: string[];
  diagnosis_codes: string[];
  date_of_service?: string;
  service_start_date?: string;
  service_end_date?: string;
  submitted_at?: string;
  decision_due_at?: string;
  approved_at?: string;
  expires_at?: string;
  status: PriorAuthStatus;
  urgency: PriorAuthUrgency;
  clinical_notes?: string;
  clinical_summary?: string;
  documentation_submitted?: string[];
  requested_units?: number;
  approved_units?: number;
  unit_type?: string;
  fhir_resource_id?: string;
  fhir_resource_version?: number;
  lcd_references?: string[];
  ncd_references?: string[];
  response_time_hours?: number;
  sla_met?: boolean;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  service_lines?: PriorAuthServiceLine[];
}

export interface PriorAuthDecision {
  id: string;
  prior_auth_id: string;
  decision_type: PriorAuthDecisionType;
  decision_date: string;
  decision_reason?: string;
  decision_code?: string;
  auth_number?: string;
  approved_units?: number;
  approved_start_date?: string;
  approved_end_date?: string;
  denial_reason_code?: string;
  denial_reason_description?: string;
  appeal_deadline?: string;
  response_payload?: Record<string, unknown>;
  x12_278_response?: string;
  reviewer_name?: string;
  reviewer_npi?: string;
  created_at: string;
  tenant_id: string;
}

export interface PriorAuthAppeal {
  id: string;
  prior_auth_id: string;
  decision_id?: string;
  appeal_level: number;
  status: AppealStatus;
  appeal_reason: string;
  appeal_type?: string;
  submitted_at?: string;
  deadline_at?: string;
  resolved_at?: string;
  peer_to_peer_scheduled_at?: string;
  peer_to_peer_completed_at?: string;
  peer_to_peer_outcome?: string;
  additional_documentation?: string[];
  clinical_rationale?: string;
  outcome?: PriorAuthDecisionType;
  outcome_notes?: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
}

export interface PriorAuthDocument {
  id: string;
  prior_auth_id: string;
  document_type: string;
  document_name: string;
  document_description?: string;
  file_path?: string;
  file_size_bytes?: number;
  mime_type?: string;
  uploaded_at: string;
  submitted_to_payer: boolean;
  submitted_at?: string;
  tenant_id: string;
}

export interface PriorAuthStatusHistory {
  id: string;
  prior_auth_id: string;
  old_status?: PriorAuthStatus;
  new_status: PriorAuthStatus;
  status_reason?: string;
  changed_by?: string;
  changed_at: string;
  tenant_id: string;
}

export interface PriorAuthStatistics {
  total_submitted: number;
  total_approved: number;
  total_denied: number;
  total_pending: number;
  approval_rate: number;
  avg_response_hours: number;
  sla_compliance_rate: number;
  by_urgency: Record<string, { total: number; approved: number; denied: number }>;
}

export interface PriorAuthClaimCheck {
  requires_prior_auth: boolean;
  existing_auth_id?: string;
  existing_auth_number?: string;
  auth_status?: PriorAuthStatus;
  auth_expires_at?: string;
  missing_codes: string[];
}

export interface FHIRApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =====================================================
// Input Interfaces
// =====================================================

export interface CreatePriorAuthInput {
  patient_id: string;
  payer_id: string;
  service_codes: string[];
  diagnosis_codes: string[];
  urgency?: PriorAuthUrgency;
  ordering_provider_npi?: string;
  rendering_provider_npi?: string;
  facility_npi?: string;
  payer_name?: string;
  member_id?: string;
  group_number?: string;
  date_of_service?: string;
  service_start_date?: string;
  service_end_date?: string;
  clinical_notes?: string;
  clinical_summary?: string;
  requested_units?: number;
  unit_type?: string;
  encounter_id?: string;
  claim_id?: string;
  tenant_id: string;
  created_by?: string;
}

export interface SubmitPriorAuthInput {
  id: string;
  updated_by?: string;
}

export interface RecordDecisionInput {
  prior_auth_id: string;
  decision_type: PriorAuthDecisionType;
  decision_reason?: string;
  decision_code?: string;
  auth_number?: string;
  approved_units?: number;
  approved_start_date?: string;
  approved_end_date?: string;
  denial_reason_code?: string;
  denial_reason_description?: string;
  appeal_deadline?: string;
  response_payload?: Record<string, unknown>;
  x12_278_response?: string;
  reviewer_name?: string;
  reviewer_npi?: string;
  tenant_id: string;
  created_by?: string;
}

export interface CreateAppealInput {
  prior_auth_id: string;
  decision_id?: string;
  appeal_reason: string;
  appeal_type?: string;
  additional_documentation?: string[];
  clinical_rationale?: string;
  tenant_id: string;
  created_by?: string;
}
