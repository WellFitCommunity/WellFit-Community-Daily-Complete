/**
 * Electronic Case Reporting (eCR) — shared types
 *
 * Extracted from ecrService.ts (CLAUDE.md Commandment #12).
 */

export interface ReportableCondition {
  id: string;
  conditionCode: string;
  conditionCodeSystem: string;
  conditionName: string;
  rckmsOid?: string;
  reportingJurisdiction: string[];
  reportingTimeframe: string;
  isNationallyNotifiable: boolean;
  conditionCategory: string;
  triggerCodes: string[];
}

export interface CaseReportTrigger {
  type: 'diagnosis' | 'lab_result' | 'provider_reported';
  code: string;
  codeSystem: string;
  description: string;
  triggerDate: Date;
  encounterId?: string;
  conditionId: string;
}

export interface ElectronicCaseReport {
  id: string;
  tenantId: string;
  patientId: string;
  triggerEncounterId?: string;
  triggerConditionId: string;
  triggerType: string;
  triggerCode: string;
  triggerDescription: string;
  triggerDate: Date;
  reportType: 'initial' | 'update' | 'cancel';
  eicrDocumentId: string;
  eicrVersion: string;
  eicrDocument: string;
  destination: string;
  aimsTransactionId?: string;
  status: 'pending' | 'submitted' | 'accepted' | 'rejected' | 'rr_received';
  submittedAt?: Date;
  rrReceivedAt?: Date;
  rrDocument?: string;
  rrDetermination?: string;
  rrRoutingEntities?: string[];
  errorMessage?: string;
}

export interface PatientData {
  patientId: string;
  mrn: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: 'M' | 'F' | 'O' | 'U';
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
  email?: string;
  preferredLanguage?: string;
  occupation?: string;
  employer?: string;
}

export interface EncounterData {
  encounterId: string;
  encounterDate: Date;
  encounterType: string;
  facilityName: string;
  facilityAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  responsibleProvider?: {
    npi: string;
    name: string;
  };
  diagnoses: Array<{
    code: string;
    codeSystem: string;
    description: string;
    diagnosisDate: Date;
  }>;
  labResults?: Array<{
    code: string;
    codeSystem: string;
    description: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    interpretation?: string;
    resultDate: Date;
  }>;
  medications?: Array<{
    code: string;
    codeSystem: string;
    name: string;
    startDate: Date;
    endDate?: Date;
  }>;
}

export interface FacilityData {
  id: string;
  name: string;
  npi?: string;
  oid?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    county?: string;
  };
  phone?: string;
}

// Database row interfaces
export interface ReportableConditionRow {
  id: string;
  condition_code: string;
  condition_code_system: string;
  condition_name: string;
  rckms_oid?: string;
  reporting_jurisdiction: string[];
  reporting_timeframe: string;
  is_nationally_notifiable: boolean;
  condition_category: string;
  trigger_codes: string[];
  is_active: boolean;
}

export interface CaseReportRow {
  id: string;
  tenant_id: string;
  patient_id: string;
  trigger_encounter_id?: string;
  trigger_condition_id: string;
  trigger_type: string;
  trigger_code: string;
  trigger_description: string;
  trigger_date: string;
  report_type: string;
  eicr_document_id: string;
  eicr_version: string;
  eicr_document: string;
  destination: string;
  aims_transaction_id?: string;
  status: string;
  submitted_at?: string;
  rr_received_at?: string;
  rr_document?: string;
  rr_determination?: string;
  rr_routing_entities?: string[];
  error_message?: string;
}
