/**
 * Syndromic Surveillance — Types
 *
 * ONC Criteria: 170.315(f)(2) — HL7 ADT syndromic surveillance to public health agencies.
 * Extracted from syndromicSurveillanceService.ts (god-file decomposition).
 */

import type { ADTEventType } from '../../../types/hl7v2';

export interface SyndromicEncounter {
  id: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  encounterDate: Date;
  encounterType: 'ED' | 'UC' | 'AMB'; // Emergency Dept, Urgent Care, Ambulatory
  facilityId?: string;
  chiefComplaint?: string;
  chiefComplaintCode?: string;
  chiefComplaintCodeSystem?: string;
  diagnosisCodes: string[];
  diagnosisDescriptions: string[];
  dispositionCode?: string;
  dispositionDescription?: string;
  surveillanceCategory?: string;
  status: 'pending' | 'transmitted' | 'failed' | 'excluded';
}

export interface SyndromicPatientData {
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
}

export interface SyndromicTransmission {
  id: string;
  tenantId: string;
  destinationAgency: string;
  messageType: ADTEventType;
  messageControlId: string;
  hl7Message: string;
  encounterCount: number;
  encounterIds: string[];
  status: 'pending' | 'sent' | 'acknowledged' | 'rejected' | 'error';
  sentAt?: Date;
  acknowledgmentCode?: string;
  acknowledgmentMessage?: string;
  errorMessage?: string;
}

export interface ADTMessageOptions {
  eventType: ADTEventType;
  encounter: SyndromicEncounter;
  patient: SyndromicPatientData;
  facility: FacilityData;
  sendingApplication?: string;
  receivingApplication?: string;
  receivingFacility?: string;
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
  };
}

export interface TransmissionConfig {
  agency: string;
  endpoint: string;
  sendingApplication: string;
  receivingApplication: string;
  receivingFacility: string;
  hl7Version: string;
}

// Database row interfaces
export interface EncounterRow {
  id: string;
  tenant_id: string;
  encounter_id: string;
  patient_id: string;
  encounter_date: string;
  encounter_type: string;
  facility_id?: string;
  chief_complaint?: string;
  chief_complaint_code?: string;
  chief_complaint_code_system?: string;
  diagnosis_codes?: string[];
  diagnosis_descriptions?: string[];
  disposition_code?: string;
  disposition_description?: string;
  surveillance_category?: string;
  status: string;
  transmission_id?: string;
}

export interface TransmissionRow {
  id: string;
  tenant_id: string;
  destination_agency: string;
  message_type: string;
  message_control_id: string;
  hl7_message: string;
  encounter_count: number;
  encounter_ids: string[];
  status: string;
  sent_at?: string;
  acknowledgment_code?: string;
  acknowledgment_message?: string;
  error_message?: string;
}
