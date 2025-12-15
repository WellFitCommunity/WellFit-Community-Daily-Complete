/**
 * Clearinghouse MCP Client
 *
 * Browser-safe client for healthcare clearinghouse operations:
 * - Claim submission (837P/837I)
 * - Claim status inquiry (276/277)
 * - Eligibility verification (270/271)
 * - Remittance processing (835)
 * - Prior authorization (278)
 * - Connection testing and configuration
 *
 * Supports: Waystar, Change Healthcare, Availity
 */

// =====================================================
// Types
// =====================================================

export type ClearinghouseProvider = 'waystar' | 'change_healthcare' | 'availity';

export type ClaimType = '837P' | '837I';

export type ClaimStatus =
  | 'accepted'
  | 'in_review'
  | 'pending_info'
  | 'paid'
  | 'denied'
  | 'partial_pay'
  | 'rejected';

export type PriorAuthUrgency = 'routine' | 'urgent' | 'stat';

export type PayerType = 'commercial' | 'medicare' | 'medicaid' | 'tricare' | 'workers_comp';

export type RejectionCategory = 'patient' | 'provider' | 'coding' | 'timing' | 'authorization' | 'other';

// Claim Submission Types
export interface ClaimSubmissionData {
  claim_id: string;
  x12_content: string;
  claim_type: ClaimType;
  payer_id: string;
  payer_name?: string;
  patient_id: string;
  total_charge: number;
}

export interface ClaimSubmissionResult {
  success: boolean;
  submission_id: string;
  claim_id: string;
  status: string;
  submitted_at: string;
  estimated_processing_time: string;
  next_steps: string[];
  tracking: {
    submission_id: string;
    payer_id: string;
    total_charge: number;
    claim_type: ClaimType;
  };
}

// Claim Status Types
export interface ClaimStatusRequest {
  payer_id: string;
  claim_id?: string;
  patient_id?: string;
  provider_npi: string;
  date_of_service_from: string;
  date_of_service_to?: string;
  trace_number?: string;
}

export interface ClaimStatusResponse {
  claim_id?: string;
  payer_id: string;
  status: ClaimStatus;
  status_code: string;
  status_date: string;
  status_category: string;
  status_category_description: string;
  adjudication_date?: string;
  payment_amount?: number;
  patient_responsibility?: number;
  remittance_trace_number?: string;
}

// Eligibility Types
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

export interface EligibilityResponse {
  active: boolean;
  subscriber: {
    id: string;
    name: string;
    dob: string;
  };
  payer: {
    id: string;
    name: string;
  };
  plan: {
    name: string;
    group_number?: string;
    effective_date: string;
    term_date?: string;
  };
  coverage: {
    individual_deductible?: number;
    individual_deductible_met?: number;
    family_deductible?: number;
    family_deductible_met?: number;
    individual_oop_max?: number;
    individual_oop_met?: number;
    office_visit_copay?: number;
    specialist_copay?: number;
    er_copay?: number;
    inpatient_coinsurance?: number;
  };
  pcp_required: boolean;
  pcp_name?: string;
  pcp_npi?: string;
  prior_auth_required_services?: string[];
}

// Remittance Types
export interface RemittanceClaimAdjustment {
  group_code: string;
  reason_code: string;
  amount: number;
  reason_description: string;
}

export interface RemittanceClaim {
  claim_id: string;
  claim_status: string;
  charge_amount: number;
  paid_amount: number;
  patient_responsibility: number;
  claim_filing_indicator: string;
  adjustments: RemittanceClaimAdjustment[];
}

export interface RemittanceResult {
  control_number: string;
  total_payment: number;
  payment_method: string;
  payment_date: string;
  claim_count: number;
  claims: RemittanceClaim[];
  summary: {
    total_charges: number;
    total_paid: number;
    total_adjustments: number;
    total_patient_responsibility: number;
  };
}

// Prior Authorization Types
export interface PriorAuthRequest {
  payer_id: string;
  patient_id: string;
  subscriber_id: string;
  provider_npi: string;
  service_type: string;
  service_codes: string[];
  diagnosis_codes: string[];
  date_of_service: string;
  urgency: PriorAuthUrgency;
  clinical_notes?: string;
}

export interface PriorAuthResult {
  auth_number: string;
  status: string;
  submitted_at: string;
  payer_id: string;
  patient_id: string;
  service_type: string;
  service_codes: string[];
  urgency: PriorAuthUrgency;
  expected_response_time: string;
  tracking: {
    trace_number: string;
    submission_method: string;
    can_check_status: boolean;
  };
  next_steps: string[];
}

// Connection Test Types
export interface ConnectionTestResult {
  success: boolean;
  connected: boolean;
  provider?: ClearinghouseProvider;
  tested_at?: string;
  capabilities?: {
    '837P_submission': boolean;
    '837I_submission': boolean;
    '270_271_eligibility': boolean;
    '276_277_status': boolean;
    '278_prior_auth': boolean;
    '835_remittance': boolean;
  };
  error?: string;
  guidance?: Record<string, string>;
  providers?: Array<{
    name: string;
    description: string;
    cost: string;
    contact: string;
  }>;
  troubleshooting?: string[];
}

// Payer Types
export interface PayerInfo {
  id: string;
  name: string;
  type: PayerType;
  states: string[];
}

// Submission Stats Types
export interface SubmissionStats {
  period: {
    from: string;
    to: string;
  };
  submissions: {
    total: number;
    accepted: number;
    rejected: number;
    pending: number;
    acceptance_rate: number;
  };
  payments: {
    total_charges: number;
    total_paid: number;
    total_adjustments: number;
    total_patient_responsibility: number;
    collection_rate: number;
  };
  timing: {
    avg_days_to_payment: number;
    avg_days_to_first_response: number;
  };
  top_rejection_reasons: Array<{
    code: string;
    description: string;
    count: number;
  }>;
  by_payer: Array<{
    payer: string;
    submissions: number;
    paid: number;
    pending: number;
    denied: number;
  }>;
}

// Rejection Reason Types
export interface RejectionReason {
  code: string;
  category: RejectionCategory;
  description: string;
  remediation: string;
}

export interface RejectionGuidance {
  reasons: RejectionReason[];
  total: number;
  categories: RejectionCategory[];
  appeal_guidance: {
    timeframe: string;
    process: string[];
    tips: string[];
  };
}

// Result wrapper
export interface ClearinghouseResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  demo_mode?: boolean;
  metadata?: {
    tool: string;
    executionTimeMs: number;
  };
}

// =====================================================
// Client Class
// =====================================================

export class ClearinghouseMCPClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-clearinghouse-server`;
  }

  /**
   * Get authentication token from localStorage
   */
  private getAuthToken(): string | null {
    const authData = localStorage.getItem('sb-xkybsjnvuohpqpbkikyn-auth-token');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        return parsed.access_token;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Make authenticated request to MCP server
   */
  private async request<T>(tool: string, params: Record<string, unknown> = {}): Promise<ClearinghouseResult<T>> {
    const token = this.getAuthToken();
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: tool,
            arguments: params
          },
          id: Date.now()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error?.message || `HTTP ${response.status}`
        };
      }

      const result = await response.json();

      if (result.error) {
        return {
          success: false,
          error: result.error.message || 'MCP call failed'
        };
      }

      // Extract data from MCP response format
      const content = result.result?.content?.[0];
      if (content?.type === 'json') {
        const data = content.data as Record<string, unknown>;
        return {
          success: data.success !== false,
          data: data as T,
          demo_mode: data.demo_mode === true,
          metadata: result.result?.metadata
        };
      }

      return {
        success: true,
        data: result.result as T,
        metadata: result.result?.metadata
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  // =====================================================
  // Claim Operations
  // =====================================================

  /**
   * Submit a claim to the clearinghouse
   */
  async submitClaim(claim: ClaimSubmissionData): Promise<ClearinghouseResult<ClaimSubmissionResult>> {
    return this.request<ClaimSubmissionResult>('submit_claim', { claim });
  }

  /**
   * Check claim status (276/277)
   */
  async checkClaimStatus(request: ClaimStatusRequest): Promise<ClearinghouseResult<{ status_response: ClaimStatusResponse }>> {
    return this.request<{ status_response: ClaimStatusResponse }>('check_claim_status', { request });
  }

  // =====================================================
  // Eligibility Operations
  // =====================================================

  /**
   * Verify patient eligibility (270/271)
   */
  async verifyEligibility(request: EligibilityRequest): Promise<ClearinghouseResult<{ eligibility: EligibilityResponse }>> {
    return this.request<{ eligibility: EligibilityResponse }>('verify_eligibility', { request });
  }

  // =====================================================
  // Remittance Operations
  // =====================================================

  /**
   * Process ERA/835 remittance advice
   */
  async processRemittance(x12Content: string): Promise<ClearinghouseResult<{ remittance: RemittanceResult }>> {
    return this.request<{ remittance: RemittanceResult }>('process_remittance', { x12_content: x12Content });
  }

  // =====================================================
  // Prior Authorization Operations
  // =====================================================

  /**
   * Submit prior authorization request (278)
   */
  async submitPriorAuth(request: PriorAuthRequest): Promise<ClearinghouseResult<{ prior_auth: PriorAuthResult }>> {
    return this.request<{ prior_auth: PriorAuthResult }>('submit_prior_auth', { request });
  }

  // =====================================================
  // Configuration & Utility Operations
  // =====================================================

  /**
   * Test clearinghouse connection
   */
  async testConnection(): Promise<ClearinghouseResult<ConnectionTestResult>> {
    return this.request<ConnectionTestResult>('test_connection', {});
  }

  /**
   * Get list of supported payers
   */
  async getPayerList(options?: {
    search?: string;
    state?: string;
    type?: PayerType;
  }): Promise<ClearinghouseResult<{ payers: PayerInfo[]; total: number }>> {
    return this.request<{ payers: PayerInfo[]; total: number }>('get_payer_list', options || {});
  }

  /**
   * Get submission statistics
   */
  async getSubmissionStats(options?: {
    date_from?: string;
    date_to?: string;
    payer_id?: string;
  }): Promise<ClearinghouseResult<{ stats: SubmissionStats }>> {
    return this.request<{ stats: SubmissionStats }>('get_submission_stats', options || {});
  }

  /**
   * Get rejection reasons and remediation guidance
   */
  async getRejectionReasons(options?: {
    rejection_code?: string;
    category?: RejectionCategory;
  }): Promise<ClearinghouseResult<RejectionGuidance>> {
    return this.request<RejectionGuidance>('get_rejection_reasons', options || {});
  }
}

// =====================================================
// Singleton Instance
// =====================================================

export const clearinghouseMCP = new ClearinghouseMCPClient();

// =====================================================
// Convenience Functions
// =====================================================

/**
 * Submit an 837P claim
 */
export async function submitClaim(claim: ClaimSubmissionData): Promise<ClearinghouseResult<ClaimSubmissionResult>> {
  return clearinghouseMCP.submitClaim(claim);
}

/**
 * Check claim status
 */
export async function checkClaimStatus(
  payerId: string,
  providerNpi: string,
  dateOfServiceFrom: string,
  options?: {
    claimId?: string;
    patientId?: string;
    dateOfServiceTo?: string;
    traceNumber?: string;
  }
): Promise<ClearinghouseResult<{ status_response: ClaimStatusResponse }>> {
  return clearinghouseMCP.checkClaimStatus({
    payer_id: payerId,
    provider_npi: providerNpi,
    date_of_service_from: dateOfServiceFrom,
    ...options
  });
}

/**
 * Verify patient eligibility
 */
export async function verifyPatientEligibility(
  payerId: string,
  subscriberId: string,
  subscriberFirstName: string,
  subscriberLastName: string,
  subscriberDob: string,
  providerNpi: string,
  dateOfService: string,
  options?: {
    providerName?: string;
    serviceTypeCodes?: string[];
    dependent?: {
      first_name: string;
      last_name: string;
      dob: string;
      relationship_code: string;
    };
  }
): Promise<ClearinghouseResult<{ eligibility: EligibilityResponse }>> {
  return clearinghouseMCP.verifyEligibility({
    payer_id: payerId,
    subscriber_id: subscriberId,
    subscriber_first_name: subscriberFirstName,
    subscriber_last_name: subscriberLastName,
    subscriber_dob: subscriberDob,
    provider_npi: providerNpi,
    date_of_service: dateOfService,
    provider_name: options?.providerName,
    service_type_codes: options?.serviceTypeCodes,
    dependent: options?.dependent
  });
}

/**
 * Process remittance/ERA
 */
export async function processRemittanceAdvice(x12Content: string): Promise<ClearinghouseResult<{ remittance: RemittanceResult }>> {
  return clearinghouseMCP.processRemittance(x12Content);
}

/**
 * Submit prior authorization
 */
export async function submitPriorAuthorization(
  payerId: string,
  patientId: string,
  subscriberId: string,
  providerNpi: string,
  serviceType: string,
  serviceCodes: string[],
  diagnosisCodes: string[],
  dateOfService: string,
  urgency: PriorAuthUrgency,
  clinicalNotes?: string
): Promise<ClearinghouseResult<{ prior_auth: PriorAuthResult }>> {
  return clearinghouseMCP.submitPriorAuth({
    payer_id: payerId,
    patient_id: patientId,
    subscriber_id: subscriberId,
    provider_npi: providerNpi,
    service_type: serviceType,
    service_codes: serviceCodes,
    diagnosis_codes: diagnosisCodes,
    date_of_service: dateOfService,
    urgency,
    clinical_notes: clinicalNotes
  });
}

/**
 * Test clearinghouse connection
 */
export async function testClearinghouseConnection(): Promise<ClearinghouseResult<ConnectionTestResult>> {
  return clearinghouseMCP.testConnection();
}

/**
 * Search for payers
 */
export async function searchPayers(
  searchTerm?: string,
  state?: string,
  type?: PayerType
): Promise<ClearinghouseResult<{ payers: PayerInfo[]; total: number }>> {
  return clearinghouseMCP.getPayerList({ search: searchTerm, state, type });
}

/**
 * Get billing statistics
 */
export async function getBillingStats(
  dateFrom?: string,
  dateTo?: string,
  payerId?: string
): Promise<ClearinghouseResult<{ stats: SubmissionStats }>> {
  return clearinghouseMCP.getSubmissionStats({ date_from: dateFrom, date_to: dateTo, payer_id: payerId });
}

/**
 * Look up rejection reason
 */
export async function lookupRejectionReason(code: string): Promise<ClearinghouseResult<RejectionGuidance>> {
  return clearinghouseMCP.getRejectionReasons({ rejection_code: code });
}

/**
 * Get rejection reasons by category
 */
export async function getRejectionsByCategory(category: RejectionCategory): Promise<ClearinghouseResult<RejectionGuidance>> {
  return clearinghouseMCP.getRejectionReasons({ category });
}

// =====================================================
// Service Type Codes Reference
// =====================================================

export const SERVICE_TYPE_CODES = {
  '1': 'Medical Care',
  '2': 'Surgical',
  '3': 'Consultation',
  '4': 'Diagnostic X-Ray',
  '5': 'Diagnostic Lab',
  '6': 'Radiation Therapy',
  '7': 'Anesthesia',
  '8': 'Surgical Assistance',
  '12': 'Durable Medical Equipment Purchase',
  '14': 'Renal Supplies in the Home',
  '18': 'Durable Medical Equipment Rental',
  '30': 'Health Benefit Plan Coverage',
  '33': 'Chiropractic',
  '35': 'Dental Care',
  '36': 'Vision (Optometry)',
  '37': 'Eye',
  '38': 'Dental Accident',
  '39': 'Mental Health',
  '40': 'Social Work',
  '42': 'Home Health Care',
  '45': 'Hospice',
  '47': 'Hospital',
  '48': 'Hospital - Inpatient',
  '50': 'Hospital - Outpatient',
  '51': 'Hospital - Emergency Accident',
  '52': 'Hospital - Emergency Medical',
  '53': 'Hospital - Ambulatory Surgical',
  '54': 'Long Term Care',
  '55': 'Major Medical',
  '56': 'Medically Related Transportation',
  '60': 'Private Duty Nursing',
  '62': 'Skilled Nursing Care',
  '65': 'Skilled Nursing Care - Room and Board',
  '67': 'Pregnancy',
  '68': 'Physical Medicine',
  '69': 'Podiatry',
  '70': 'Prescription Drug',
  '73': 'Rehabilitation',
  '76': 'Respiratory Therapy',
  '81': 'Dialysis',
  '82': 'Chemotherapy',
  '83': 'Well Baby Care',
  '84': 'Well Child Care',
  '86': 'Urgent Care',
  '88': 'Pharmacy',
  '98': 'Professional (Physician) Visit - Office',
  'A4': 'Psychiatric',
  'A6': 'Psychotherapy',
  'A7': 'Psychiatric - Inpatient',
  'A8': 'Psychiatric - Outpatient',
  'AD': 'Occupational Therapy',
  'AE': 'Physical Therapy',
  'AF': 'Speech Therapy',
  'AG': 'Skilled Nursing Facility',
  'AI': 'Substance Abuse',
  'BB': 'Partial Hospitalization (Psychiatric)',
  'UC': 'Urgent Care'
};

// =====================================================
// Relationship Codes Reference
// =====================================================

export const RELATIONSHIP_CODES = {
  '01': 'Spouse',
  '04': 'Grandfather or Grandmother',
  '05': 'Grandson or Granddaughter',
  '07': 'Nephew or Niece',
  '10': 'Foster Child',
  '15': 'Ward',
  '17': 'Stepson or Stepdaughter',
  '18': 'Self',
  '19': 'Child',
  '20': 'Employee',
  '21': 'Unknown',
  '22': 'Handicapped Dependent',
  '23': 'Sponsored Dependent',
  '24': 'Dependent of a Minor Dependent',
  '29': 'Significant Other',
  '32': 'Mother',
  '33': 'Father',
  '34': 'Other Adult',
  '36': 'Emancipated Minor',
  '39': 'Organ Donor',
  '40': 'Cadaver Donor',
  '41': 'Injured Plaintiff',
  '43': 'Child Where Insured Has No Financial Responsibility',
  '53': 'Life Partner',
  '76': 'Dependent'
};

// =====================================================
// Adjustment Reason Codes Reference
// =====================================================

export const ADJUSTMENT_REASON_CODES = {
  // Contractual Obligations (CO)
  'CO-4': 'Procedure code inconsistent with modifier or diagnosis',
  'CO-16': 'Claim lacks required information',
  'CO-18': 'Exact duplicate claim',
  'CO-22': 'Coordination of benefits',
  'CO-45': 'Charges exceed fee schedule maximum',
  'CO-50': 'Non-covered service',
  'CO-96': 'Non-covered charge',
  'CO-97': 'Payment adjusted',
  'CO-109': 'Not covered by this payer',
  'CO-167': 'Diagnosis not covered',
  'CO-197': 'Prior authorization required',

  // Patient Responsibility (PR)
  'PR-1': 'Deductible',
  'PR-2': 'Coinsurance',
  'PR-3': 'Copay',
  'PR-26': 'Expenses incurred prior to coverage',
  'PR-27': 'Expenses incurred after coverage terminated',
  'PR-29': 'Time limit for filing has expired',
  'PR-31': 'Patient cannot be identified',
  'PR-100': 'Payment made to patient',
  'PR-101': 'Predetermination - not billed',
  'PR-119': 'Benefit maximum reached',

  // Other Adjustments (OA)
  'OA-23': 'Payment adjusted due to prior payer',
  'OA-24': 'Charges covered under capitation',
  'OA-100': 'Payment made to patient',
  'OA-121': 'Indemnification adjustment',
  'OA-128': 'Newborn\'s services billed separately'
};
