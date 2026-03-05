// =====================================================
// MCP HL7/X12 Server — Shared Type Definitions
// =====================================================

/** Generic FHIR resource with required resourceType and id */
export interface FHIRResource {
  resourceType: string;
  id: string;
  [key: string]: unknown;
}

/** FHIR Bundle (collection of resources) */
export interface FHIRBundle {
  resourceType: 'Bundle';
  type: string;
  timestamp?: string;
  entry?: Array<{ fullUrl?: string; resource: FHIRResource }>;
}

/** FHIR Claim resource (extends FHIRResource) */
export interface FHIRClaim extends FHIRResource {
  resourceType: 'Claim';
  status: string;
  type: { coding: Array<{ system: string; code: string }> };
  use: string;
  created: string;
  provider: { display: string };
  insurer: { display: string };
  patient: { display: string };
  total: { value: number; currency: string };
  diagnosis: Array<{
    sequence: number;
    diagnosisCodeableConcept: {
      coding: Array<{ system: string; code: string }>;
    };
  }>;
  item: Array<{
    sequence: number;
    productOrService: {
      coding: Array<{ system: string; code: string }>;
    };
    unitPrice: { value: number; currency: string };
  }>;
}

// =====================================================
// HL7 v2.x Types
// =====================================================

/** Single HL7 segment (e.g., MSH, PID, PV1) */
export interface HL7Segment {
  name: string;
  fields: string[];
}

/** Parsed HL7 v2.x message */
export interface HL7Message {
  segments: HL7Segment[];
  messageType: string;
  messageControlId: string;
  version: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  dateTime: string;
}

/** Result of parsing an HL7 message */
export interface ParseResult {
  success: boolean;
  message?: HL7Message;
  errors: string[];
  warnings: string[];
}

// =====================================================
// X12 Types
// =====================================================

/** Input data for generating an 837P claim */
export interface ClaimData {
  claimId: string;
  encounterId: string;
  patientId: string;
  // Patient info
  patientFirstName: string;
  patientLastName: string;
  patientDob: string;
  patientGender: string;
  patientAddress?: string;
  patientCity?: string;
  patientState?: string;
  patientZip?: string;
  // Subscriber info
  subscriberId: string;
  subscriberFirstName?: string;
  subscriberLastName?: string;
  subscriberRelation: string;
  // Payer info
  payerId: string;
  payerName: string;
  // Provider info
  providerId: string;
  providerNpi: string;
  providerName: string;
  providerTaxId: string;
  providerTaxonomy?: string;
  providerAddress?: string;
  providerCity?: string;
  providerState?: string;
  providerZip?: string;
  // Claim details
  serviceDate: string;
  totalCharges: number;
  placeOfService: string;
  // Diagnoses (ICD-10)
  diagnoses: Array<{ code: string; sequence: number }>;
  // Procedures
  procedures: Array<{
    code: string;
    modifiers?: string[];
    units: number;
    charges: number;
    diagnosisPointers: number[];
  }>;
}

/** X12 control numbers for ISA/GS/ST segments */
export interface ControlNumbers {
  isa: string;
  gs: string;
  st: string;
}

/** Result of X12 validation */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  segmentCount: number;
}

// =====================================================
// X12 278 Prior Authorization Types (CMS-0057-F)
// =====================================================

/** Input data for generating a 278 prior auth request */
export interface PriorAuthRequestData {
  transaction_set_id: string;
  control_number: string;
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
  subscriber: {
    member_id: string;
    first_name: string;
    last_name: string;
    dob: string;
    gender: 'M' | 'F' | 'U';
    group_number?: string;
    address?: { street: string; city: string; state: string; zip: string };
  };
  patient?: {
    relationship: string;
    first_name: string;
    last_name: string;
    dob: string;
    gender: 'M' | 'F' | 'U';
  };
  requesting_provider: {
    npi: string;
    name: string;
    taxonomy?: string;
    address?: { street: string; city: string; state: string; zip: string };
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
    address?: { street: string; city: string; state: string; zip: string };
  };
  certification_type: 'I' | 'R' | 'S' | 'E' | 'A';
  service_type_code: string;
  level_of_service?: string;
  admission_date?: string;
  discharge_date?: string;
  service_date_from: string;
  service_date_to?: string;
  diagnoses: Array<{
    code: string;
    code_type: 'ABK' | 'BK';
    qualifier: 'ABF' | 'ABJ' | 'ABN';
  }>;
  procedures: Array<{
    code: string;
    code_type: 'HC' | 'IV';
    modifier_codes?: string[];
    quantity: number;
    unit_type: string;
    description?: string;
  }>;
  urgency_code?: 'EL' | 'EM' | 'UR';
  attachments?: Array<{
    type: string;
    transmission_code: string;
    control_number?: string;
  }>;
  notes?: string;
}

/** Parsed X12 278 response data */
export interface PriorAuth278Response {
  transaction_set_id: string;
  control_number: string;
  original_control_number: string;
  action_code: string;
  decision_reason_code?: string;
  auth_number?: string;
  certification_type?: string;
  effective_date_from?: string;
  effective_date_to?: string;
  approved_quantity?: number;
  approved_unit_type?: string;
  payer: { name: string; id: string };
  reviewer?: { name?: string; npi?: string; phone?: string };
  follow_up_action_code?: string;
  notes?: string;
  denial_reason?: { code: string; description: string };
  raw_segments?: string[];
  loop_count?: number;
  segment_count?: number;
}

/** Result of generating a 278 request */
export interface Generated278Result {
  x12_content: string;
  control_number: string;
  transaction_set_id: string;
  segment_count: number;
}

/** Parsed X12 837P data */
export interface X12ParsedData {
  interchangeControlNumber: string;
  groupControlNumber: string;
  transactionSetControlNumber: string;
  claimId: string;
  totalCharges: number;
  diagnoses: string[];
  procedures: Array<{ code: string; charges: number; units: number }>;
  patientName: string;
  payerName: string;
  providerName: string;
  serviceDate: string;
}
