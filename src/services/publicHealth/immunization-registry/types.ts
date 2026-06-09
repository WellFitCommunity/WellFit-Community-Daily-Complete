/**
 * Immunization Registry — Types
 *
 * ONC Criteria: 170.315(f)(1) — HL7 VXU immunization submission to state IIS.
 * Extracted from immunizationRegistryService.ts (god-file decomposition).
 */

export interface ImmunizationRecord {
  id: string;
  patientId: string;
  vaccineCvxCode: string;
  vaccineName: string;
  administrationDate: Date;
  lotNumber?: string;
  expirationDate?: Date;
  manufacturerMvxCode?: string;
  manufacturerName?: string;
  administeredByNpi?: string;
  administeredByName?: string;
  administrationSite?: string; // LA, RA, LLFA, etc.
  administrationRoute?: string; // IM, SC, ID, PO, etc.
  doseNumber?: number;
  seriesName?: string;
  fundingSource?: string; // VFC, Private, State, etc.
  informationSource?: string; // 00=new admin, 01=historical
}

export interface ImmunizationPatientData {
  patientId: string;
  mrn: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: 'M' | 'F' | 'O' | 'U';
  mothersMaidenName?: string;
  birthOrder?: number;
  multipleBirth?: boolean;
  race?: string;
  ethnicity?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    county?: string;
  };
  phone?: string;
  guardianName?: string;
  guardianRelationship?: string;
}

export interface ImmunizationSubmission {
  id: string;
  tenantId: string;
  patientId: string;
  immunizationId: string;
  vaccineCvxCode: string;
  vaccineName: string;
  administrationDate: Date;
  registryName: string;
  messageControlId: string;
  hl7Message: string;
  status: 'pending' | 'sent' | 'accepted' | 'rejected' | 'error';
  sentAt?: Date;
  responseCode?: string;
  responseMessage?: string;
  errorMessage?: string;
}

export interface FacilityData {
  id: string;
  name: string;
  npi?: string;
  immtracPinNumber?: string; // Texas-specific
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export interface RegistryConfig {
  name: string;
  endpoint: string;
  sendingApplication: string;
  receivingApplication: string;
  receivingFacility: string;
  hl7Version: string;
}

// Database row interface
export interface SubmissionRow {
  id: string;
  tenant_id: string;
  patient_id: string;
  immunization_id: string;
  vaccine_cvx_code: string;
  vaccine_name: string;
  administration_date: string;
  registry_name: string;
  message_control_id: string;
  hl7_message: string;
  status: string;
  sent_at?: string;
  response_code?: string;
  response_message?: string;
  error_message?: string;
}
