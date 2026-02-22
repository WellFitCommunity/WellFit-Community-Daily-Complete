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
