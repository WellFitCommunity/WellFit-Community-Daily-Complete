/**
 * HL7/X12 Transformer MCP Client
 *
 * Browser-safe client for HL7 v2.x and X12 healthcare message transformations.
 * Provides bidirectional conversion between HL7, X12, and FHIR formats.
 *
 * Tools available:
 * - parse_hl7: Parse HL7 v2.x messages to structured data
 * - hl7_to_fhir: Convert HL7 to FHIR R4 Bundle
 * - generate_hl7_ack: Generate ACK responses
 * - validate_hl7: Validate HL7 message structure
 * - generate_837p: Generate X12 837P claims
 * - validate_x12: Validate X12 structure
 * - parse_x12: Parse X12 to structured data
 * - x12_to_fhir: Convert X12 to FHIR Claim
 * - get_message_types: Get supported message types
 */

// =====================================================
// Types
// =====================================================

export type HL7MessageType = 'ADT' | 'ORU' | 'ORM' | 'ACK' | 'OTHER';

export interface HL7Segment {
  name: string;
  fields: (string | string[])[];
}

export interface HL7ParsedMessage {
  message_type: string;
  event_type: string;
  control_id: string;
  version: string;
  sending_application: string;
  sending_facility: string;
  receiving_application: string;
  receiving_facility: string;
  timestamp: string;
  segments: HL7Segment[];
  patient?: {
    id: string;
    name: {
      family: string;
      given: string;
    };
    dob?: string;
    gender?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  };
  encounter?: {
    id: string;
    class: string;
    location?: string;
    admit_date?: string;
    attending_physician?: string;
  };
}

export interface HL7ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  message_type?: string;
  segment_count?: number;
}

export interface HL7ACK {
  message: string;
  control_id: string;
  ack_code: 'AA' | 'AE' | 'AR';
  text_message?: string;
}

export interface X12ClaimData {
  claim_id: string;
  claim_type: 'professional' | 'institutional';
  subscriber: {
    id: string;
    first_name: string;
    last_name: string;
    dob: string;
    gender: 'M' | 'F' | 'U';
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    payer_id: string;
    payer_name: string;
    group_number?: string;
  };
  patient?: {
    relationship: string;
    first_name: string;
    last_name: string;
    dob: string;
    gender: 'M' | 'F' | 'U';
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  provider: {
    npi: string;
    name: string;
    tax_id: string;
    taxonomy?: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  services: Array<{
    line_number: number;
    date_from: string;
    date_to?: string;
    place_of_service: string;
    cpt_code: string;
    modifiers?: string[];
    diagnosis_pointers: number[];
    units: number;
    charge_amount: number;
  }>;
  diagnoses: Array<{
    code: string;
    type: 'principal' | 'admitting' | 'other';
    sequence: number;
  }>;
  total_charge: number;
  billing_provider?: {
    npi: string;
    name: string;
    tax_id: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  };
}

export interface X12GeneratedClaim {
  x12_content: string;
  control_number: string;
  claim_id: string;
  total_charge: number;
  service_line_count: number;
}

export interface X12ParsedClaim {
  control_number: string;
  transaction_type: string;
  submitter?: {
    name: string;
    id: string;
  };
  receiver?: {
    name: string;
    id: string;
  };
  subscriber?: {
    id: string;
    name: string;
    dob?: string;
  };
  patient?: {
    name: string;
    relationship?: string;
  };
  claims: Array<{
    claim_id: string;
    total_charge: number;
    place_of_service?: string;
    service_lines: Array<{
      line_number: number;
      cpt_code: string;
      charge_amount: number;
      units: number;
      date_of_service?: string;
    }>;
    diagnoses: string[];
  }>;
  loop_count: number;
  segment_count: number;
}

export interface X12ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  transaction_type?: string;
  segment_count?: number;
  loop_count?: number;
}

export interface FHIRBundle {
  resourceType: 'Bundle';
  type: string;
  timestamp: string;
  total: number;
  entry: Array<{
    fullUrl?: string;
    resource: Record<string, unknown>;
  }>;
}

export interface FHIRClaim {
  resourceType: 'Claim';
  id: string;
  status: string;
  type: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  patient: {
    reference: string;
  };
  provider: {
    reference: string;
  };
  priority: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  insurance: Array<{
    sequence: number;
    focal: boolean;
    coverage: {
      reference: string;
    };
  }>;
  item: Array<{
    sequence: number;
    productOrService: {
      coding: Array<{
        system: string;
        code: string;
      }>;
    };
    servicedDate?: string;
    unitPrice?: {
      value: number;
      currency: string;
    };
    quantity?: {
      value: number;
    };
    net?: {
      value: number;
      currency: string;
    };
  }>;
  total: {
    value: number;
    currency: string;
  };
}

export interface MessageTypeInfo {
  hl7_types: Array<{
    type: string;
    events: string[];
    description: string;
  }>;
  x12_types: Array<{
    type: string;
    description: string;
  }>;
}

// =====================================================
// X12 278 Prior Authorization Types (CMS-0057-F)
// =====================================================

export type X12278ActionCode = 'A1' | 'A2' | 'A3' | 'A4' | 'A6' | 'CT';
export type X12278CertificationType = 'I' | 'R' | 'S' | 'E' | 'A';
export type X12278DecisionCode = 'A1' | 'A2' | 'A3' | 'A4' | 'A6' | 'CT' | 'D' | 'P';

export interface X12278Request {
  // Transaction info
  transaction_set_id: string;
  control_number: string;

  // Submitter/Receiver
  submitter: {
    name: string;
    id: string;
    contact_name?: string;
    contact_phone?: string;
  };
  receiver: {
    name: string;
    id: string;
  };

  // Patient/Subscriber
  subscriber: {
    member_id: string;
    first_name: string;
    last_name: string;
    dob: string;
    gender: 'M' | 'F' | 'U';
    group_number?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  patient?: {
    relationship: string;
    first_name: string;
    last_name: string;
    dob: string;
    gender: 'M' | 'F' | 'U';
  };

  // Providers
  requesting_provider: {
    npi: string;
    name: string;
    taxonomy?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    contact_name?: string;
    contact_phone?: string;
  };
  rendering_provider?: {
    npi: string;
    name: string;
    taxonomy?: string;
  };
  facility?: {
    npi: string;
    name: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  };

  // Service info
  certification_type: X12278CertificationType;
  service_type_code: string;
  level_of_service?: string;

  // Dates
  admission_date?: string;
  discharge_date?: string;
  service_date_from: string;
  service_date_to?: string;

  // Clinical info
  diagnoses: Array<{
    code: string;
    code_type: 'ABK' | 'BK'; // ICD-10 or ICD-9
    qualifier: 'ABF' | 'ABJ' | 'ABN'; // Principal, Admitting, Reason for Visit
  }>;
  procedures: Array<{
    code: string;
    code_type: 'HC' | 'IV'; // CPT/HCPCS or ICD-10-PCS
    modifier_codes?: string[];
    quantity: number;
    unit_type: string;
    description?: string;
  }>;

  // Urgency
  urgency_code?: 'EL' | 'EM' | 'UR'; // Elective, Emergency, Urgent

  // Supporting info
  attachments?: Array<{
    type: string;
    transmission_code: string;
    control_number?: string;
  }>;
  notes?: string;
}

export interface X12278Response {
  // Transaction info
  transaction_set_id: string;
  control_number: string;
  original_control_number: string;

  // Status
  action_code: X12278ActionCode;
  decision_reason_code?: string;

  // Authorization
  auth_number?: string;
  certification_type?: X12278CertificationType;

  // Dates
  effective_date_from?: string;
  effective_date_to?: string;

  // Decision details
  approved_quantity?: number;
  approved_unit_type?: string;

  // Provider response
  payer: {
    name: string;
    id: string;
  };
  reviewer?: {
    name?: string;
    npi?: string;
    phone?: string;
  };

  // Additional info
  follow_up_action_code?: string;
  notes?: string;
  denial_reason?: {
    code: string;
    description: string;
  };

  // Segment data (for debugging)
  raw_segments?: string[];
  loop_count?: number;
  segment_count?: number;
}

export interface X12278Generated {
  x12_content: string;
  control_number: string;
  transaction_set_id: string;
  segment_count: number;
}

export interface HL7X12Result<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    tool: string;
    executionTimeMs: number;
    requestId?: string;
  };
}

// =====================================================
// Client Class
// =====================================================

export class HL7X12MCPClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-hl7-x12-server`;
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
  private async request<T>(tool: string, params: Record<string, unknown> = {}): Promise<HL7X12Result<T>> {
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
        return {
          success: true,
          data: content.data as T,
          metadata: result.result?.metadata
        };
      } else if (content?.type === 'text') {
        try {
          return {
            success: true,
            data: JSON.parse(content.text) as T,
            metadata: result.result?.metadata
          };
        } catch {
          return {
            success: true,
            data: content.text as unknown as T,
            metadata: result.result?.metadata
          };
        }
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
  // HL7 Operations
  // =====================================================

  /**
   * Parse an HL7 v2.x message into structured data
   */
  async parseHL7(message: string): Promise<HL7X12Result<HL7ParsedMessage>> {
    return this.request<HL7ParsedMessage>('parse_hl7', { message });
  }

  /**
   * Convert HL7 v2.x message to FHIR R4 Bundle
   */
  async hl7ToFHIR(message: string): Promise<HL7X12Result<FHIRBundle>> {
    return this.request<FHIRBundle>('hl7_to_fhir', { message });
  }

  /**
   * Generate HL7 ACK response for a message
   */
  async generateHL7ACK(
    originalControlId: string,
    ackCode: 'AA' | 'AE' | 'AR',
    textMessage?: string
  ): Promise<HL7X12Result<HL7ACK>> {
    return this.request<HL7ACK>('generate_hl7_ack', {
      original_control_id: originalControlId,
      ack_code: ackCode,
      text_message: textMessage
    });
  }

  /**
   * Validate HL7 v2.x message structure
   */
  async validateHL7(message: string): Promise<HL7X12Result<HL7ValidationResult>> {
    return this.request<HL7ValidationResult>('validate_hl7', { message });
  }

  // =====================================================
  // X12 Operations
  // =====================================================

  /**
   * Generate X12 837P claim from claim data
   */
  async generate837P(claimData: X12ClaimData): Promise<HL7X12Result<X12GeneratedClaim>> {
    return this.request<X12GeneratedClaim>('generate_837p', { claim_data: claimData });
  }

  /**
   * Validate X12 837P structure and content
   */
  async validateX12(x12Content: string): Promise<HL7X12Result<X12ValidationResult>> {
    return this.request<X12ValidationResult>('validate_x12', { x12_content: x12Content });
  }

  /**
   * Parse X12 837P into structured data
   */
  async parseX12(x12Content: string): Promise<HL7X12Result<X12ParsedClaim>> {
    return this.request<X12ParsedClaim>('parse_x12', { x12_content: x12Content });
  }

  /**
   * Convert X12 837P to FHIR Claim resource
   */
  async x12ToFHIR(x12Content: string): Promise<HL7X12Result<FHIRClaim>> {
    return this.request<FHIRClaim>('x12_to_fhir', { x12_content: x12Content });
  }

  // =====================================================
  // X12 278 Prior Authorization Operations
  // =====================================================

  /**
   * Generate X12 278 prior authorization request
   * CMS-0057-F compliant
   */
  async generate278Request(request: X12278Request): Promise<HL7X12Result<X12278Generated>> {
    return this.request<X12278Generated>('generate_278_request', { request_data: request });
  }

  /**
   * Parse X12 278 prior authorization response
   */
  async parse278Response(x12Content: string): Promise<HL7X12Result<X12278Response>> {
    return this.request<X12278Response>('parse_278_response', { x12_content: x12Content });
  }

  /**
   * Validate X12 278 message structure
   */
  async validate278(x12Content: string): Promise<HL7X12Result<X12ValidationResult>> {
    return this.request<X12ValidationResult>('validate_278', { x12_content: x12Content });
  }

  // =====================================================
  // Utility Operations
  // =====================================================

  /**
   * Get supported message types for HL7 and X12
   */
  async getMessageTypes(): Promise<HL7X12Result<MessageTypeInfo>> {
    return this.request<MessageTypeInfo>('get_message_types', {});
  }
}

// =====================================================
// Singleton Instance
// =====================================================

export const hl7x12MCP = new HL7X12MCPClient();

// =====================================================
// Convenience Functions
// =====================================================

/**
 * Parse HL7 v2.x message
 */
export async function parseHL7Message(message: string): Promise<HL7X12Result<HL7ParsedMessage>> {
  return hl7x12MCP.parseHL7(message);
}

/**
 * Convert HL7 message to FHIR Bundle
 */
export async function convertHL7ToFHIR(message: string): Promise<HL7X12Result<FHIRBundle>> {
  return hl7x12MCP.hl7ToFHIR(message);
}

/**
 * Validate HL7 message structure
 */
export async function validateHL7Message(message: string): Promise<HL7X12Result<HL7ValidationResult>> {
  return hl7x12MCP.validateHL7(message);
}

/**
 * Generate HL7 ACK response
 */
export async function generateACK(
  controlId: string,
  ackCode: 'AA' | 'AE' | 'AR',
  errorText?: string
): Promise<HL7X12Result<HL7ACK>> {
  return hl7x12MCP.generateHL7ACK(controlId, ackCode, errorText);
}

/**
 * Generate X12 837P professional claim
 */
export async function generate837PClaim(claimData: X12ClaimData): Promise<HL7X12Result<X12GeneratedClaim>> {
  return hl7x12MCP.generate837P(claimData);
}

/**
 * Parse X12 837P claim
 */
export async function parseX12Claim(x12Content: string): Promise<HL7X12Result<X12ParsedClaim>> {
  return hl7x12MCP.parseX12(x12Content);
}

/**
 * Validate X12 837P claim
 */
export async function validateX12Claim(x12Content: string): Promise<HL7X12Result<X12ValidationResult>> {
  return hl7x12MCP.validateX12(x12Content);
}

/**
 * Convert X12 claim to FHIR format
 */
export async function convertX12ToFHIR(x12Content: string): Promise<HL7X12Result<FHIRClaim>> {
  return hl7x12MCP.x12ToFHIR(x12Content);
}

/**
 * Get all supported message types
 */
export async function getSupportedMessageTypes(): Promise<HL7X12Result<MessageTypeInfo>> {
  return hl7x12MCP.getMessageTypes();
}

// =====================================================
// X12 278 Prior Authorization Convenience Functions
// =====================================================

/**
 * Generate X12 278 prior authorization request
 * CMS-0057-F compliant for January 2027 mandate
 */
export async function generate278PriorAuthRequest(request: X12278Request): Promise<HL7X12Result<X12278Generated>> {
  return hl7x12MCP.generate278Request(request);
}

/**
 * Parse X12 278 prior authorization response from payer
 */
export async function parse278PriorAuthResponse(x12Content: string): Promise<HL7X12Result<X12278Response>> {
  return hl7x12MCP.parse278Response(x12Content);
}

/**
 * Validate X12 278 message structure
 */
export async function validate278Message(x12Content: string): Promise<HL7X12Result<X12ValidationResult>> {
  return hl7x12MCP.validate278(x12Content);
}

// =====================================================
// Common HL7 Message Templates
// =====================================================

export const HL7_TEMPLATES = {
  /**
   * ADT^A01 - Admit a patient
   */
  ADT_A01: (params: {
    controlId: string;
    sendingApp: string;
    sendingFacility: string;
    patientId: string;
    patientName: { family: string; given: string };
    dob: string;
    gender: 'M' | 'F' | 'O' | 'U';
    encounterId: string;
    admitDate: string;
  }) => {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    return [
      `MSH|^~\\&|${params.sendingApp}|${params.sendingFacility}|RECEIVING_APP|RECEIVING_FAC|${timestamp}||ADT^A01|${params.controlId}|P|2.4`,
      `EVN|A01|${timestamp}`,
      `PID|1||${params.patientId}||${params.patientName.family}^${params.patientName.given}|||${params.gender}`,
      `PV1|1|I|UNIT^ROOM^BED||||ATTENDING^PHYSICIAN|||||||||||${params.encounterId}||||||||||||||||||||||||${params.admitDate}`
    ].join('\r');
  },

  /**
   * ADT^A03 - Discharge a patient
   */
  ADT_A03: (params: {
    controlId: string;
    sendingApp: string;
    sendingFacility: string;
    patientId: string;
    encounterId: string;
    dischargeDate: string;
  }) => {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    return [
      `MSH|^~\\&|${params.sendingApp}|${params.sendingFacility}|RECEIVING_APP|RECEIVING_FAC|${timestamp}||ADT^A03|${params.controlId}|P|2.4`,
      `EVN|A03|${timestamp}`,
      `PID|1||${params.patientId}`,
      `PV1|1|I|||||||||||||||||${params.encounterId}|||||||||||||||||||||||||||${params.dischargeDate}`
    ].join('\r');
  },

  /**
   * ORU^R01 - Observation result
   */
  ORU_R01: (params: {
    controlId: string;
    sendingApp: string;
    sendingFacility: string;
    patientId: string;
    observationCode: string;
    observationValue: string;
    observationUnit: string;
    observationDate: string;
  }) => {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    return [
      `MSH|^~\\&|${params.sendingApp}|${params.sendingFacility}|RECEIVING_APP|RECEIVING_FAC|${timestamp}||ORU^R01|${params.controlId}|P|2.4`,
      `PID|1||${params.patientId}`,
      `OBR|1|||${params.observationCode}|||${params.observationDate}`,
      `OBX|1|NM|${params.observationCode}||${params.observationValue}|${params.observationUnit}|||N|||F`
    ].join('\r');
  }
};

// =====================================================
// Common X12 Segment Helpers
// =====================================================

export const X12_HELPERS = {
  /**
   * Format date for X12 (CCYYMMDD)
   */
  formatDate: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  },

  /**
   * Format time for X12 (HHMM)
   */
  formatTime: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().slice(11, 16).replace(':', '');
  },

  /**
   * Format currency for X12 (no decimal, whole cents)
   */
  formatAmount: (amount: number): string => {
    return Math.round(amount * 100).toString();
  },

  /**
   * Parse X12 date to Date object
   */
  parseDate: (x12Date: string): Date => {
    if (x12Date.length === 8) {
      const year = x12Date.slice(0, 4);
      const month = x12Date.slice(4, 6);
      const day = x12Date.slice(6, 8);
      return new Date(`${year}-${month}-${day}`);
    }
    throw new Error(`Invalid X12 date format: ${x12Date}`);
  },

  /**
   * Get place of service code description
   */
  getPlaceOfServiceName: (code: string): string => {
    const codes: Record<string, string> = {
      '11': 'Office',
      '12': 'Home',
      '21': 'Inpatient Hospital',
      '22': 'Outpatient Hospital',
      '23': 'Emergency Room',
      '24': 'Ambulatory Surgical Center',
      '31': 'Skilled Nursing Facility',
      '32': 'Nursing Facility',
      '34': 'Hospice',
      '41': 'Ambulance - Land',
      '42': 'Ambulance - Air or Water',
      '50': 'Federally Qualified Health Center',
      '51': 'Inpatient Psychiatric Facility',
      '52': 'Psychiatric Facility Partial Hospitalization',
      '53': 'Community Mental Health Center',
      '61': 'Comprehensive Inpatient Rehab Facility',
      '62': 'Comprehensive Outpatient Rehab Facility',
      '65': 'End-Stage Renal Disease Treatment Facility',
      '71': 'State/Local Public Health Clinic',
      '72': 'Rural Health Clinic',
      '81': 'Independent Laboratory'
    };
    return codes[code] || `Unknown (${code})`;
  }
};

// =====================================================
// X12 278 Action Codes (CMS-0057-F)
// =====================================================

export const X12_278_ACTION_CODES: Record<string, { code: X12278ActionCode; description: string }> = {
  APPROVED: { code: 'A1', description: 'Certified in total' },
  APPROVED_MODIFIED: { code: 'A2', description: 'Certified - Modified' },
  APPROVED_PARTIAL: { code: 'A3', description: 'Certified - Partial' },
  PENDING: { code: 'A4', description: 'Pending - Additional Information Requested' },
  DENIED: { code: 'A6', description: 'Not Certified' },
  CONTACT_PAYER: { code: 'CT', description: 'Contact Payer' }
};

export const X12_278_CERTIFICATION_TYPES: Record<string, { code: X12278CertificationType; description: string }> = {
  INITIAL: { code: 'I', description: 'Initial' },
  RENEWAL: { code: 'R', description: 'Renewal/Recertification' },
  REVISED: { code: 'S', description: 'Revised' },
  EXTENSION: { code: 'E', description: 'Extension' },
  APPEAL: { code: 'A', description: 'Appeal' }
};

export const X12_278_SERVICE_TYPE_CODES: Record<string, string> = {
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
  '18': 'DME Rental',
  '20': 'Second Surgical Opinion',
  '21': 'Third Surgical Opinion',
  '23': 'Diagnostic Dental',
  '24': 'Periodontics',
  '25': 'Restorative',
  '26': 'Endodontics',
  '27': 'Maxillofacial Prosthetics',
  '28': 'Adjunctive Dental Services',
  '33': 'Chiropractic',
  '34': 'Chiropractic Office Visits',
  '35': 'Dental Care',
  '36': 'Dental Crowns',
  '37': 'Dental Accident',
  '38': 'Orthodontics',
  '39': 'Prosthodontics',
  '40': 'Oral Surgery',
  '41': 'Routine (Preventive) Dental',
  '42': 'Home Health Care',
  '43': 'Home Health Prescriptions',
  '45': 'Hospice',
  '48': 'Hospital - Inpatient',
  '50': 'Hospital - Outpatient',
  '51': 'Hospital - Emergency Accident',
  '52': 'Hospital - Emergency Medical',
  '53': 'Hospital - Ambulatory Surgical',
  '54': 'Long Term Care',
  '55': 'Major Medical',
  '56': 'Medically Related Transportation',
  '57': 'Air Transportation',
  '58': 'Cabulance',
  '59': 'Licensed Ambulance',
  '60': 'General Benefits',
  '61': 'In-vitro Fertilization',
  '62': 'MRI/CAT Scan',
  '63': 'Donor Procedures',
  '64': 'Acupuncture',
  '65': 'Newborn Care',
  '66': 'Pathology',
  '67': 'Smoking Cessation',
  '68': 'Well Baby Care',
  '69': 'Maternity',
  '70': 'Transplants',
  '71': 'Audiology Exam',
  '72': 'Inhalation Therapy',
  '73': 'Diagnostic Medical',
  '74': 'Private Duty Nursing',
  '75': 'Prosthetic Device',
  '76': 'Dialysis',
  '77': 'Otological Exam',
  '78': 'Chemotherapy',
  '79': 'Allergy Testing',
  '80': 'Immunizations',
  '81': 'Routine Physical',
  '82': 'Family Planning',
  '83': 'Infertility',
  '84': 'Abortion',
  '85': 'AIDS',
  '86': 'Emergency Services',
  '87': 'Cancer',
  '88': 'Pharmacy',
  '89': 'Free Standing Prescription Drug',
  '90': 'Mail Order Prescription Drug',
  '91': 'Brand Name Prescription Drug',
  '92': 'Generic Prescription Drug',
  '93': 'Podiatry',
  '94': 'Podiatry - Office Visits',
  '95': 'Podiatry - Nursing Home Visits',
  '96': 'Professional (Physician)',
  '98': 'Professional (Physician) - Office Visits',
  'A0': 'Psychiatric',
  'A1': 'Psychiatric - Room and Board',
  'A2': 'Psychotherapy',
  'A3': 'Psychiatric - Inpatient',
  'A4': 'Psychiatric - Outpatient',
  'A5': 'Psychiatric - Partial Hospitalization',
  'A6': 'Psychopharmacology',
  'A7': 'Rehabilitation',
  'A8': 'Rehabilitation - Room and Board',
  'A9': 'Rehabilitation - Inpatient',
  'AA': 'Rehabilitation - Outpatient',
  'AB': 'Occupational Therapy',
  'AC': 'Physical Therapy',
  'AD': 'Speech Therapy',
  'AE': 'Skilled Nursing Care',
  'AF': 'Skilled Nursing Care - Room and Board',
  'AG': 'Substance Abuse',
  'AH': 'Substance Abuse - Inpatient',
  'AI': 'Substance Abuse - Outpatient',
  'AJ': 'Vision (Optometry)',
  'AK': 'Frames',
  'AL': 'Routine Eye Exam',
  'AM': 'Lenses'
};
