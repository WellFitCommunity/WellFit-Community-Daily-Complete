// =====================================================
// MCP Clearinghouse Server — Shared Type Definitions
// Purpose: All interfaces used across clearinghouse modules
// =====================================================

/** Supported clearinghouse provider identifiers */
export type ClearinghouseProvider = 'waystar' | 'change_healthcare' | 'availity';

/** Configuration for a clearinghouse connection */
export interface ClearinghouseConfig {
  provider: ClearinghouseProvider;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  submitterId: string;
}

/** Data required to submit a claim */
export interface ClaimSubmission {
  claim_id: string;
  x12_content: string;
  claim_type: '837P' | '837I';
  payer_id: string;
  payer_name?: string;
  patient_id: string;
  total_charge: number;
}

/** Request to check claim status (X12 276/277) */
export interface ClaimStatusRequest {
  payer_id: string;
  claim_id?: string;
  patient_id?: string;
  provider_npi: string;
  date_of_service_from: string;
  date_of_service_to?: string;
  trace_number?: string;
}

/** Request to verify patient eligibility (X12 270/271) */
export interface EligibilityRequest {
  payer_id: string;
  subscriber_id: string;
  subscriber_first_name: string;
  subscriber_last_name: string;
  subscriber_dob: string;
  provider_npi: string;
  provider_name?: string;
  service_type_codes?: string[];
  date_of_service: string;
  dependent?: {
    first_name: string;
    last_name: string;
    dob: string;
    relationship_code: string;
  };
}

/** Request for prior authorization (X12 278) */
export interface PriorAuthRequest {
  payer_id: string;
  patient_id: string;
  subscriber_id: string;
  provider_npi: string;
  service_type: string;
  service_codes: string[];
  diagnosis_codes: string[];
  date_of_service: string;
  urgency: 'routine' | 'urgent' | 'stat';
  clinical_notes?: string;
}

/** MCP tool definition shape (matches MCP protocol) */
export interface ToolDefinition {
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}
