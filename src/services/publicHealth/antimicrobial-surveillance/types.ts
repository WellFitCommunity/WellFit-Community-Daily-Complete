/**
 * Antimicrobial Surveillance — shared types
 *
 * Extracted from antimicrobialSurveillanceService.ts (CLAUDE.md Commandment #12).
 */

export interface AntimicrobialUsageRecord {
  id: string;
  tenantId: string;
  patientId: string;
  encounterId?: string;
  medicationCode: string;
  medicationCodeSystem: string;
  medicationName: string;
  antimicrobialClass: string;
  antimicrobialSubclass?: string;
  doseQuantity?: number;
  doseUnit?: string;
  route: string;
  frequency?: string;
  durationDays?: number;
  indicationCode?: string;
  indicationDescription?: string;
  prescriberNpi?: string;
  prescribedDate: Date;
  startDate?: Date;
  endDate?: Date;
  therapyType: 'empiric' | 'targeted' | 'prophylaxis';
  includedInNhsnReport: boolean;
  nhsnSubmissionId?: string;
}

export interface AntimicrobialResistanceRecord {
  id: string;
  tenantId: string;
  patientId: string;
  encounterId?: string;
  specimenId?: string;
  specimenType: string;
  specimenCollectionDate: Date;
  specimenSource?: string;
  organismCode: string;
  organismCodeSystem: string;
  organismName: string;
  antimicrobialTested: string;
  antimicrobialCode?: string;
  interpretation: 'S' | 'I' | 'R'; // Susceptible, Intermediate, Resistant
  micValue?: number;
  micUnit?: string;
  isMdro: boolean;
  mdroType?: string;
  labName?: string;
  labNpi?: string;
  resultDate?: Date;
  includedInNhsnReport: boolean;
  nhsnSubmissionId?: string;
}

export interface NHSNSubmission {
  id: string;
  tenantId: string;
  submissionType: 'AU' | 'AR';
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  facilityId?: string;
  nhsnOrgId?: string;
  nhsnFacilityId?: string;
  documentType: string;
  cdaDocument: string;
  usageRecordCount: number;
  resistanceRecordCount: number;
  status: 'pending' | 'submitted' | 'accepted' | 'rejected' | 'error';
  submittedAt?: Date;
  submissionMethod?: string;
  nhsnSubmissionId?: string;
  responseStatus?: string;
  responseMessage?: string;
  errorMessage?: string;
}

export interface FacilityData {
  id: string;
  name: string;
  npi?: string;
  nhsnOrgId?: string;
  nhsnFacilityId?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

// Database row interfaces
export interface UsageRow {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id?: string;
  medication_code: string;
  medication_code_system: string;
  medication_name: string;
  antimicrobial_class: string;
  antimicrobial_subclass?: string;
  dose_quantity?: number;
  dose_unit?: string;
  route: string;
  frequency?: string;
  duration_days?: number;
  indication_code?: string;
  indication_description?: string;
  prescriber_npi?: string;
  prescribed_date: string;
  start_date?: string;
  end_date?: string;
  therapy_type: string;
  included_in_nhsn_report: boolean;
  nhsn_submission_id?: string;
}

export interface ResistanceRow {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id?: string;
  specimen_id?: string;
  specimen_type: string;
  specimen_collection_date: string;
  specimen_source?: string;
  organism_code: string;
  organism_code_system: string;
  organism_name: string;
  antimicrobial_tested: string;
  antimicrobial_code?: string;
  interpretation: string;
  mic_value?: number;
  mic_unit?: string;
  is_mdro: boolean;
  mdro_type?: string;
  lab_name?: string;
  lab_npi?: string;
  result_date?: string;
  included_in_nhsn_report: boolean;
  nhsn_submission_id?: string;
}

export interface SubmissionRow {
  id: string;
  tenant_id: string;
  submission_type: string;
  reporting_period_start: string;
  reporting_period_end: string;
  facility_id?: string;
  nhsn_org_id?: string;
  nhsn_facility_id?: string;
  document_type: string;
  cda_document: string;
  usage_record_count: number;
  resistance_record_count: number;
  status: string;
  submitted_at?: string;
  submission_method?: string;
  nhsn_submission_id?: string;
  response_status?: string;
  response_message?: string;
  error_message?: string;
}
