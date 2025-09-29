// Comprehensive billing system types for WellFit Community
// Production-grade TypeScript definitions

export interface BillingProvider {
  id: string;
  user_id?: string | null;
  npi: string;
  taxonomy_code?: string | null;
  organization_name?: string | null;
  ein?: string | null;
  submitter_id?: string | null;
  contact_phone?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BillingPayer {
  id: string;
  name: string;
  payer_id?: string | null;
  receiver_id?: string | null;
  clearinghouse_id?: string | null;
  notes?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CodeCPT {
  code: string;
  short_desc?: string | null;
  long_desc?: string | null;
  status: string;
  effective_from?: string | null;
  effective_to?: string | null;
}

export interface CodeHCPCS {
  code: string;
  desc?: string | null;
  status: string;
  effective_from?: string | null;
  effective_to?: string | null;
}

export interface CodeICD10 {
  code: string;
  desc?: string | null;
  chapter?: string | null;
  billable: boolean;
  status: string;
  effective_from?: string | null;
  effective_to?: string | null;
}

export interface CodeModifier {
  code: string;
  desc?: string | null;
  status: string;
  effective_from?: string | null;
  effective_to?: string | null;
}

export interface FeeSchedule {
  id: string;
  name: string;
  payer_id?: string | null;
  provider_id?: string | null;
  effective_from: string;
  effective_to?: string | null;
  notes?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FeeScheduleItem {
  id: string;
  fee_schedule_id: string;
  code_system: 'CPT' | 'HCPCS';
  code: string;
  modifier1?: string | null;
  modifier2?: string | null;
  modifier3?: string | null;
  modifier4?: string | null;
  price: number;
  unit: string;
  created_at: string;
  updated_at: string;
}

export interface Claim {
  id: string;
  encounter_id: string;
  payer_id?: string | null;
  billing_provider_id?: string | null;
  claim_type: string;
  status: ClaimStatus;
  control_number?: string | null;
  segment_count?: number | null;
  total_charge?: number | null;
  x12_content?: string | null;
  response_payload?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ClaimStatus =
  | 'generated'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'paid'
  | 'void';

export interface ClaimLine {
  id: string;
  claim_id: string;
  code_system: 'CPT' | 'HCPCS';
  procedure_code: string;
  modifiers: string[];
  units: number;
  charge_amount: number;
  diagnosis_pointers: number[];
  service_date?: string | null;
  position?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimStatusHistory {
  id: string;
  claim_id: string;
  from_status?: string | null;
  to_status: string;
  note?: string | null;
  payload?: Record<string, any> | null;
  created_by: string;
  created_at: string;
}

export interface ClaimAttachment {
  id: string;
  claim_id: string;
  doc_type?: string | null;
  storage_path?: string | null;
  note?: string | null;
  created_by: string;
  created_at: string;
}

export interface ClearinghouseBatch {
  id: string;
  batch_ref: string;
  status: BatchStatus;
  file_content?: string | null;
  response_payload?: string | null;
  submitted_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type BatchStatus =
  | 'created'
  | 'submitted'
  | 'acknowledged'
  | 'rejected'
  | 'completed';

export interface ClearinghouseBatchItem {
  id: string;
  batch_id: string;
  claim_id: string;
  st_control_number?: string | null;
  status: BatchItemStatus;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export type BatchItemStatus =
  | 'queued'
  | 'sent'
  | 'ack'
  | 'err';

export interface Remittance {
  id: string;
  payer_id?: string | null;
  received_at: string;
  file_content?: string | null;
  summary?: Record<string, any> | null;
  details?: Record<string, any> | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CodingRecommendation {
  id: string;
  encounter_id: string;
  patient_id?: string | null;
  payload: CodingSuggestion;
  confidence?: number | null;
  created_at: string;
  created_by?: string | null;
}

export interface CodingAudit {
  id: string;
  encounter_id?: string | null;
  model: string;
  success: boolean;
  confidence?: number | null;
  error_message?: string | null;
  processing_time_ms?: number | null;
  created_at: string;
  created_by?: string | null;
}

export interface CodingSuggestion {
  cpt?: Array<{
    code: string;
    modifiers?: string[];
    rationale?: string;
  }>;
  hcpcs?: Array<{
    code: string;
    modifiers?: string[];
    rationale?: string;
  }>;
  icd10?: Array<{
    code: string;
    rationale?: string;
    principal?: boolean;
  }>;
  notes?: string;
  confidence?: number;
}

// Encounter-related types for billing integration
export interface EncounterProcedure {
  code: string;
  charge_amount?: number | null;
  units?: number | null;
  modifiers?: string[] | null;
  service_date?: string | null;
  diagnosis_pointers?: number[] | null;
}

export interface EncounterDiagnosis {
  code: string;
  sequence?: number | null;
}

export interface Patient {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  dob?: string | null;
  gender?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  member_id?: string | null;
  ssn?: string | null;
  phone?: string | null;
}

export interface Encounter {
  id: string;
  patient_id: string;
  date_of_service: string;
  claim_frequency_code?: string | null;
  subscriber_relation_code?: string | null;
  payer_id: string;
  patient?: Patient;
  provider?: BillingProvider;
  procedures?: EncounterProcedure[];
  diagnoses?: EncounterDiagnosis[];
}

// API request/response types
export interface ClaimGenerationRequest {
  encounterId: string;
  billingProviderId: string;
}

export interface ClaimGenerationResponse {
  claimId: string;
  x12Content: string;
  controlNumber?: string;
}

export interface CodingSuggestionRequest {
  encounter: {
    id: string;
    diagnoses?: Array<{ term: string }>;
    procedures?: Array<{ code: string; units: number }>;
  };
}

// Utility types
export type CreateBillingProvider = Omit<BillingProvider, 'id' | 'created_at' | 'updated_at' | 'created_by'>;
export type UpdateBillingProvider = Partial<CreateBillingProvider>;

export type CreateClaim = Omit<Claim, 'id' | 'created_at' | 'updated_at' | 'created_by'>;
export type UpdateClaim = Partial<CreateClaim>;

export type CreateEncounter = Omit<Encounter, 'id' | 'patient' | 'provider' | 'procedures' | 'diagnoses'>;