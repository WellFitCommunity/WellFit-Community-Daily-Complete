/**
 * HL7/X12 Transformer MCP Client — shared types
 *
 * Extracted from mcpHL7X12Client.ts (CLAUDE.md Commandment #12).
 */

export type HL7MessageType = 'ADT' | 'ORU' | 'ORM' | 'ACK' | 'OTHER';

export interface HL7Segment {
  name: string;
  fieldCount: number;
}

export interface HL7ParsedMessage {
  success: boolean;
  messageType: string;
  messageControlId: string;
  version: string;
  sendingApplication: string;
  sendingFacility: string;
  segments: HL7Segment[];
  errors: string[];
  warnings: string[];
}

export interface HL7ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  messageType?: string;
  expectedType?: string;
  typeMatch?: boolean;
  segmentCount?: number;
}

export interface HL7ACK {
  ack_message: string;
  ack_code: string;
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
  control_numbers: {
    isa: string;
    gs: string;
    st: string;
  };
  segment_count: number;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
    segmentCount: number;
  };
}

export interface X12ParsedClaim {
  interchangeControlNumber: string;
  groupControlNumber: string;
  transactionSetControlNumber: string;
  claimId: string;
  totalCharges: number;
  diagnoses: string[];
  procedures: Array<{
    code: string;
    charges: number;
    units: number;
  }>;
  patientName: string;
  payerName: string;
  providerName: string;
  serviceDate: string;
}

export interface X12ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  segmentCount: number;
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
  hl7: {
    supported: string[];
    versions: string[];
  };
  x12: {
    supported: string[];
    versions: string[];
  };
  fhir: {
    supported: string[];
    version: string;
  };
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
