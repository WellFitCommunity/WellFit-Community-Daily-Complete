/**
 * Syndromic Surveillance Service
 *
 * ONC Criteria: 170.315(f)(2)
 * Purpose: Generate and transmit HL7 ADT messages to public health agencies
 * for real-time syndromic surveillance (emergency department, urgent care visits)
 *
 * Target: Texas DSHS (Department of State Health Services)
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import {
  DEFAULT_DELIMITERS,
  type HL7Delimiters,
  type ADTEventType,
} from '../../types/hl7v2';

// =====================================================
// TYPES
// =====================================================

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

interface FacilityData {
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

interface TransmissionConfig {
  agency: string;
  endpoint: string;
  sendingApplication: string;
  receivingApplication: string;
  receivingFacility: string;
  hl7Version: string;
}

// Database row interfaces
interface EncounterRow {
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

interface TransmissionRow {
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

// =====================================================
// CONSTANTS
// =====================================================

// Texas DSHS syndromic surveillance configuration
const TX_DSHS_CONFIG: TransmissionConfig = {
  agency: 'TX_DSHS',
  endpoint: 'https://syndromic.dshs.texas.gov/hl7', // Production endpoint
  sendingApplication: 'WELLFIT_EHR',
  receivingApplication: 'ESSENCE',
  receivingFacility: 'TX_DSHS',
  hl7Version: '2.5.1',
};

// Surveillance categories based on chief complaint / diagnosis
const SURVEILLANCE_CATEGORIES: Record<string, string[]> = {
  'Respiratory': ['J00', 'J01', 'J02', 'J03', 'J04', 'J05', 'J06', 'J09', 'J10', 'J11', 'J12', 'J13', 'J14', 'J15', 'J16', 'J17', 'J18', 'J20', 'J21', 'J22', 'R05', 'R06'],
  'Gastrointestinal': ['A00', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'K52', 'R11', 'R19'],
  'Fever': ['R50'],
  'Neurological': ['G00', 'G01', 'G02', 'G03', 'G04', 'G05', 'R40', 'R41', 'R56'],
  'Rash': ['R21', 'B01', 'B05', 'B06', 'B08', 'B09'],
  'Hemorrhagic': ['D65', 'D68', 'R58'],
  'Sepsis': ['A40', 'A41', 'R65'],
};

// =====================================================
// HL7 ADT MESSAGE GENERATION
// =====================================================

/**
 * Generate HL7 v2.5.1 ADT message for syndromic surveillance
 */
export function generateADTMessage(options: ADTMessageOptions): string {
  const {
    eventType,
    encounter,
    patient,
    facility,
    sendingApplication = TX_DSHS_CONFIG.sendingApplication,
    receivingApplication = TX_DSHS_CONFIG.receivingApplication,
    receivingFacility = TX_DSHS_CONFIG.receivingFacility,
  } = options;

  const delimiters = DEFAULT_DELIMITERS;
  const messageControlId = generateMessageControlId();
  const messageDateTime = formatHL7DateTime(new Date());
  const segments: string[] = [];

  // MSH - Message Header
  segments.push(buildMSHSegment({
    sendingApplication,
    sendingFacility: facility.name,
    receivingApplication,
    receivingFacility,
    messageDateTime,
    messageType: 'ADT',
    triggerEvent: eventType,
    messageControlId,
    processingId: 'P', // Production
    versionId: TX_DSHS_CONFIG.hl7Version,
    delimiters,
  }));

  // EVN - Event Type
  segments.push(buildEVNSegment({
    eventTypeCode: eventType,
    recordedDateTime: messageDateTime,
    eventFacility: facility.name,
    delimiters,
  }));

  // PID - Patient Identification
  segments.push(buildPIDSegment({
    patient,
    delimiters,
  }));

  // PV1 - Patient Visit
  segments.push(buildPV1Segment({
    encounter,
    facility,
    delimiters,
  }));

  // PV2 - Patient Visit Additional Info (chief complaint)
  if (encounter.chiefComplaint) {
    segments.push(buildPV2Segment({
      chiefComplaint: encounter.chiefComplaint,
      chiefComplaintCode: encounter.chiefComplaintCode,
      chiefComplaintCodeSystem: encounter.chiefComplaintCodeSystem,
      delimiters,
    }));
  }

  // DG1 - Diagnosis segments
  encounter.diagnosisCodes.forEach((code, index) => {
    segments.push(buildDG1Segment({
      setId: index + 1,
      diagnosisCode: code,
      diagnosisDescription: encounter.diagnosisDescriptions[index] || '',
      diagnosisType: index === 0 ? 'A' : 'W', // A=Admitting, W=Working
      delimiters,
    }));
  });

  // Join segments with carriage return
  return segments.join('\r');
}

/**
 * Build MSH segment
 */
function buildMSHSegment(options: {
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  messageDateTime: string;
  messageType: string;
  triggerEvent: string;
  messageControlId: string;
  processingId: string;
  versionId: string;
  delimiters: HL7Delimiters;
}): string {
  const d = options.delimiters;
  const fields = [
    'MSH',
    d.field,                                    // MSH.1 - Field Separator
    `${d.component}${d.repetition}${d.escape}${d.subComponent}`, // MSH.2 - Encoding Characters
    options.sendingApplication,                 // MSH.3 - Sending Application
    options.sendingFacility,                    // MSH.4 - Sending Facility
    options.receivingApplication,               // MSH.5 - Receiving Application
    options.receivingFacility,                  // MSH.6 - Receiving Facility
    options.messageDateTime,                    // MSH.7 - Date/Time of Message
    '',                                         // MSH.8 - Security
    `${options.messageType}${d.component}${options.triggerEvent}${d.component}${options.messageType}_${options.triggerEvent}`, // MSH.9
    options.messageControlId,                   // MSH.10 - Message Control ID
    options.processingId,                       // MSH.11 - Processing ID
    options.versionId,                          // MSH.12 - Version ID
    '',                                         // MSH.13 - Sequence Number
    '',                                         // MSH.14 - Continuation Pointer
    'AL',                                       // MSH.15 - Accept Ack Type
    'NE',                                       // MSH.16 - Application Ack Type
    'USA',                                      // MSH.17 - Country Code
    'UNICODE UTF-8',                            // MSH.18 - Character Set
    '',                                         // MSH.19 - Principal Language
    '',                                         // MSH.20 - Alternate Character Set
    '2.16.840.1.113883.9.11',                  // MSH.21 - Message Profile Identifier (Syndromic Surveillance)
  ];

  return fields.join(d.field);
}

/**
 * Build EVN segment
 */
function buildEVNSegment(options: {
  eventTypeCode: string;
  recordedDateTime: string;
  eventFacility: string;
  delimiters: HL7Delimiters;
}): string {
  const d = options.delimiters;
  const fields = [
    'EVN',
    options.eventTypeCode,                      // EVN.1 - Event Type Code
    options.recordedDateTime,                   // EVN.2 - Recorded Date/Time
    '',                                         // EVN.3 - Date/Time Planned Event
    '',                                         // EVN.4 - Event Reason Code
    '',                                         // EVN.5 - Operator ID
    '',                                         // EVN.6 - Event Occurred
    options.eventFacility,                      // EVN.7 - Event Facility
  ];

  return fields.join(d.field);
}

/**
 * Build PID segment
 */
function buildPIDSegment(options: {
  patient: SyndromicPatientData;
  delimiters: HL7Delimiters;
}): string {
  const d = options.delimiters;
  const p = options.patient;

  // Build patient name (XPN format)
  const patientName = [
    p.lastName || '',
    p.firstName || '',
    p.middleName || '',
    '',  // Suffix
    '',  // Prefix
    '',  // Degree
    'L', // Legal name
  ].join(d.component);

  // Build patient address (XAD format)
  const patientAddress = p.address ? [
    p.address.street || '',
    '',  // Other designation
    p.address.city || '',
    p.address.state || '',
    p.address.zipCode || '',
    'USA',
    'H',  // Home address
    p.address.county || '',
  ].join(d.component) : '';

  // Map gender
  const genderMap: Record<string, string> = { 'M': 'M', 'F': 'F', 'O': 'O', 'U': 'U' };

  const fields = [
    'PID',
    '1',                                        // PID.1 - Set ID
    '',                                         // PID.2 - Patient ID (external)
    `${p.mrn}${d.component}${d.component}${d.component}MR`, // PID.3 - Patient Identifier List
    '',                                         // PID.4 - Alternate Patient ID
    patientName,                                // PID.5 - Patient Name
    '',                                         // PID.6 - Mother's Maiden Name
    formatHL7Date(p.dateOfBirth),               // PID.7 - Date of Birth
    genderMap[p.gender] || 'U',                 // PID.8 - Administrative Sex
    '',                                         // PID.9 - Patient Alias
    p.race || '',                               // PID.10 - Race
    patientAddress,                             // PID.11 - Patient Address
    p.address?.county || '',                    // PID.12 - County Code
    p.phone || '',                              // PID.13 - Phone Number - Home
    '',                                         // PID.14 - Phone Number - Business
    '',                                         // PID.15 - Primary Language
    '',                                         // PID.16 - Marital Status
    '',                                         // PID.17 - Religion
    '',                                         // PID.18 - Patient Account Number
    '',                                         // PID.19 - SSN (NEVER SEND)
    '',                                         // PID.20 - Driver's License
    '',                                         // PID.21 - Mother's Identifier
    p.ethnicity || '',                          // PID.22 - Ethnic Group
  ];

  return fields.join(d.field);
}

/**
 * Build PV1 segment
 */
function buildPV1Segment(options: {
  encounter: SyndromicEncounter;
  facility: FacilityData;
  delimiters: HL7Delimiters;
}): string {
  const d = options.delimiters;
  const e = options.encounter;
  const f = options.facility;

  // Map encounter type to patient class
  const patientClassMap: Record<string, string> = {
    'ED': 'E',   // Emergency
    'UC': 'O',   // Outpatient (Urgent Care)
    'AMB': 'O',  // Outpatient (Ambulatory)
  };

  const fields = [
    'PV1',
    '1',                                        // PV1.1 - Set ID
    patientClassMap[e.encounterType] || 'O',    // PV1.2 - Patient Class
    `${d.component}${d.component}${d.component}${f.name}`, // PV1.3 - Assigned Patient Location
    '',                                         // PV1.4 - Admission Type
    '',                                         // PV1.5 - Preadmit Number
    '',                                         // PV1.6 - Prior Patient Location
    '',                                         // PV1.7 - Attending Doctor
    '',                                         // PV1.8 - Referring Doctor
    '',                                         // PV1.9 - Consulting Doctor
    '',                                         // PV1.10 - Hospital Service
    '',                                         // PV1.11 - Temporary Location
    '',                                         // PV1.12 - Preadmit Test Indicator
    '',                                         // PV1.13 - Re-admission Indicator
    '',                                         // PV1.14 - Admit Source
    '',                                         // PV1.15 - Ambulatory Status
    '',                                         // PV1.16 - VIP Indicator
    '',                                         // PV1.17 - Admitting Doctor
    '',                                         // PV1.18 - Patient Type
    e.encounterId,                              // PV1.19 - Visit Number
    '',                                         // PV1.20 - Financial Class
    '',                                         // PV1.21-35 (skip)
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    e.dispositionCode || '',                    // PV1.36 - Discharge Disposition
    e.dispositionDescription || '',             // PV1.37 - Discharged to Location
    '',                                         // PV1.38 - Diet Type
    '',                                         // PV1.39 - Servicing Facility
    '',                                         // PV1.40 - Bed Status
    '',                                         // PV1.41 - Account Status
    '',                                         // PV1.42 - Pending Location
    '',                                         // PV1.43 - Prior Temporary Location
    formatHL7DateTime(e.encounterDate),         // PV1.44 - Admit Date/Time
  ];

  return fields.join(d.field);
}

/**
 * Build PV2 segment (chief complaint)
 */
function buildPV2Segment(options: {
  chiefComplaint: string;
  chiefComplaintCode?: string;
  chiefComplaintCodeSystem?: string;
  delimiters: HL7Delimiters;
}): string {
  const d = options.delimiters;

  // Build coded chief complaint if available
  let codedComplaint = options.chiefComplaint;
  if (options.chiefComplaintCode) {
    codedComplaint = [
      options.chiefComplaintCode,
      options.chiefComplaint,
      options.chiefComplaintCodeSystem || 'ICD10',
    ].join(d.component);
  }

  const fields = [
    'PV2',
    '',                                         // PV2.1 - Prior Pending Location
    '',                                         // PV2.2 - Accommodation Code
    codedComplaint,                             // PV2.3 - Admit Reason (Chief Complaint)
  ];

  return fields.join(d.field);
}

/**
 * Build DG1 segment
 */
function buildDG1Segment(options: {
  setId: number;
  diagnosisCode: string;
  diagnosisDescription: string;
  diagnosisType: string;
  delimiters: HL7Delimiters;
}): string {
  const d = options.delimiters;

  const codedDiagnosis = [
    options.diagnosisCode,
    options.diagnosisDescription,
    'I10',  // ICD-10
  ].join(d.component);

  const fields = [
    'DG1',
    options.setId.toString(),                   // DG1.1 - Set ID
    'I10',                                      // DG1.2 - Diagnosis Coding Method
    codedDiagnosis,                             // DG1.3 - Diagnosis Code
    options.diagnosisDescription,               // DG1.4 - Diagnosis Description
    formatHL7DateTime(new Date()),              // DG1.5 - Diagnosis Date/Time
    options.diagnosisType,                      // DG1.6 - Diagnosis Type
  ];

  return fields.join(d.field);
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function generateMessageControlId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `WF${timestamp}${random}`.toUpperCase();
}

function formatHL7DateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function formatHL7Date(dateStr: string): string {
  const date = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/**
 * Determine surveillance category based on diagnosis codes
 */
export function determineSurveillanceCategory(diagnosisCodes: string[]): string | null {
  for (const [category, codePatterns] of Object.entries(SURVEILLANCE_CATEGORIES)) {
    for (const code of diagnosisCodes) {
      const codePrefix = code.substring(0, 3);
      if (codePatterns.some(pattern => code.startsWith(pattern) || codePrefix === pattern)) {
        return category;
      }
    }
  }
  return null;
}

// =====================================================
// SERVICE FUNCTIONS
// =====================================================

/**
 * Flag an encounter for syndromic surveillance
 */
export async function flagEncounterForSurveillance(
  tenantId: string,
  encounterId: string,
  encounterData: Omit<SyndromicEncounter, 'id' | 'tenantId' | 'encounterId' | 'status' | 'surveillanceCategory'>
): Promise<ServiceResult<{ id: string; surveillanceCategory: string | null }>> {
  try {
    // Determine surveillance category
    const surveillanceCategory = determineSurveillanceCategory(encounterData.diagnosisCodes);

    const { data, error } = await supabase
      .from('syndromic_surveillance_encounters')
      .insert({
        tenant_id: tenantId,
        encounter_id: encounterId,
        patient_id: encounterData.patientId,
        encounter_date: encounterData.encounterDate.toISOString(),
        encounter_type: encounterData.encounterType,
        facility_id: encounterData.facilityId,
        chief_complaint: encounterData.chiefComplaint,
        chief_complaint_code: encounterData.chiefComplaintCode,
        chief_complaint_code_system: encounterData.chiefComplaintCodeSystem,
        diagnosis_codes: encounterData.diagnosisCodes,
        diagnosis_descriptions: encounterData.diagnosisDescriptions,
        disposition_code: encounterData.dispositionCode,
        disposition_description: encounterData.dispositionDescription,
        surveillance_category: surveillanceCategory,
        is_reportable: surveillanceCategory !== null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('SYNDROMIC_ENCOUNTER_FLAGGED', {
      tenantId,
      encounterId,
      surveillanceCategory,
    });

    return success({ id: data.id, surveillanceCategory });
  } catch (err: unknown) {
    await auditLogger.error(
      'SYNDROMIC_FLAG_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, encounterId }
    );
    return failure('OPERATION_FAILED', 'Failed to flag encounter');
  }
}

/**
 * Get pending encounters for transmission
 */
export async function getPendingEncounters(
  tenantId: string,
  limit = 100
): Promise<ServiceResult<SyndromicEncounter[]>> {
  try {
    const { data, error } = await supabase
      .from('syndromic_surveillance_encounters')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .eq('is_reportable', true)
      .order('encounter_date', { ascending: true })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const encounters: SyndromicEncounter[] = ((data || []) as EncounterRow[]).map((row: EncounterRow) => ({
      id: row.id,
      tenantId: row.tenant_id,
      encounterId: row.encounter_id,
      patientId: row.patient_id,
      encounterDate: new Date(row.encounter_date),
      encounterType: row.encounter_type as 'ED' | 'UC' | 'AMB',
      facilityId: row.facility_id,
      chiefComplaint: row.chief_complaint,
      chiefComplaintCode: row.chief_complaint_code,
      chiefComplaintCodeSystem: row.chief_complaint_code_system,
      diagnosisCodes: row.diagnosis_codes || [],
      diagnosisDescriptions: row.diagnosis_descriptions || [],
      dispositionCode: row.disposition_code,
      dispositionDescription: row.disposition_description,
      surveillanceCategory: row.surveillance_category,
      status: row.status as 'pending' | 'transmitted' | 'failed' | 'excluded',
    }));

    return success(encounters);
  } catch (err: unknown) {
    await auditLogger.error(
      'SYNDROMIC_GET_PENDING_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to get pending encounters');
  }
}

/**
 * Create and record a syndromic surveillance transmission
 */
export async function createTransmission(
  tenantId: string,
  encounter: SyndromicEncounter,
  patient: SyndromicPatientData,
  facility: FacilityData,
  eventType: ADTEventType = 'A04'
): Promise<ServiceResult<SyndromicTransmission>> {
  try {
    // Generate HL7 message
    const hl7Message = generateADTMessage({
      eventType,
      encounter,
      patient,
      facility,
    });

    const messageControlId = generateMessageControlId();

    // Save transmission record
    const { data, error } = await supabase
      .from('syndromic_surveillance_transmissions')
      .insert({
        tenant_id: tenantId,
        destination_agency: TX_DSHS_CONFIG.agency,
        destination_endpoint: TX_DSHS_CONFIG.endpoint,
        message_type: eventType,
        message_control_id: messageControlId,
        hl7_version: TX_DSHS_CONFIG.hl7Version,
        hl7_message: hl7Message,
        encounter_count: 1,
        encounter_ids: [encounter.id],
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    // Update encounter with transmission ID
    await supabase
      .from('syndromic_surveillance_encounters')
      .update({ transmission_id: data.id })
      .eq('id', encounter.id);

    await auditLogger.info('SYNDROMIC_TRANSMISSION_CREATED', {
      tenantId,
      transmissionId: data.id,
      messageControlId,
      encounterId: encounter.id,
    });

    return success({
      id: data.id,
      tenantId: data.tenant_id,
      destinationAgency: data.destination_agency,
      messageType: eventType,
      messageControlId: data.message_control_id,
      hl7Message: data.hl7_message,
      encounterCount: 1,
      encounterIds: [encounter.id],
      status: 'pending',
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'SYNDROMIC_TRANSMISSION_CREATE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, encounterId: encounter.id }
    );
    return failure('OPERATION_FAILED', 'Failed to create transmission');
  }
}

/**
 * Record transmission result (acknowledgment)
 */
export async function recordTransmissionResult(
  transmissionId: string,
  result: {
    success: boolean;
    acknowledgmentCode?: string;
    acknowledgmentMessage?: string;
    errorCode?: string;
    errorMessage?: string;
  }
): Promise<ServiceResult<void>> {
  try {
    const status = result.success ? 'acknowledged' : 'rejected';

    const { error } = await supabase
      .from('syndromic_surveillance_transmissions')
      .update({
        status,
        sent_at: new Date().toISOString(),
        acknowledgment_received_at: new Date().toISOString(),
        acknowledgment_code: result.acknowledgmentCode,
        acknowledgment_message: result.acknowledgmentMessage,
        error_code: result.errorCode,
        error_message: result.errorMessage,
      })
      .eq('id', transmissionId);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    // Update associated encounters
    const { data: transmission } = await supabase
      .from('syndromic_surveillance_transmissions')
      .select('encounter_ids')
      .eq('id', transmissionId)
      .single();

    if (transmission?.encounter_ids) {
      await supabase
        .from('syndromic_surveillance_encounters')
        .update({ status: result.success ? 'transmitted' : 'failed' })
        .in('id', transmission.encounter_ids);
    }

    await auditLogger.info('SYNDROMIC_TRANSMISSION_RESULT', {
      transmissionId,
      status,
      acknowledgmentCode: result.acknowledgmentCode,
    });

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'SYNDROMIC_RECORD_RESULT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { transmissionId }
    );
    return failure('OPERATION_FAILED', 'Failed to record transmission result');
  }
}

/**
 * Get transmission history
 */
export async function getTransmissionHistory(
  tenantId: string,
  options?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<ServiceResult<SyndromicTransmission[]>> {
  try {
    let query = supabase
      .from('syndromic_surveillance_transmissions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const transmissions: SyndromicTransmission[] = ((data || []) as TransmissionRow[]).map((row: TransmissionRow) => ({
      id: row.id,
      tenantId: row.tenant_id,
      destinationAgency: row.destination_agency,
      messageType: row.message_type as ADTEventType,
      messageControlId: row.message_control_id,
      hl7Message: row.hl7_message,
      encounterCount: row.encounter_count,
      encounterIds: row.encounter_ids,
      status: row.status as SyndromicTransmission['status'],
      sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
      acknowledgmentCode: row.acknowledgment_code,
      acknowledgmentMessage: row.acknowledgment_message,
      errorMessage: row.error_message,
    }));

    return success(transmissions);
  } catch (err: unknown) {
    await auditLogger.error(
      'SYNDROMIC_GET_HISTORY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to get transmission history');
  }
}

/**
 * Get surveillance statistics
 */
export async function getSurveillanceStats(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<ServiceResult<{
  totalEncounters: number;
  reportableEncounters: number;
  transmittedCount: number;
  failedCount: number;
  pendingCount: number;
  byCategory: Record<string, number>;
}>> {
  try {
    const { data: encounters, error } = await supabase
      .from('syndromic_surveillance_encounters')
      .select('status, surveillance_category, is_reportable')
      .eq('tenant_id', tenantId)
      .gte('encounter_date', startDate.toISOString())
      .lte('encounter_date', endDate.toISOString());

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    interface EncounterStats {
      status: string;
      surveillance_category?: string;
      is_reportable: boolean;
    }

    const stats = {
      totalEncounters: encounters?.length || 0,
      reportableEncounters: encounters?.filter((e: EncounterStats) => e.is_reportable).length || 0,
      transmittedCount: encounters?.filter((e: EncounterStats) => e.status === 'transmitted').length || 0,
      failedCount: encounters?.filter((e: EncounterStats) => e.status === 'failed').length || 0,
      pendingCount: encounters?.filter((e: EncounterStats) => e.status === 'pending').length || 0,
      byCategory: {} as Record<string, number>,
    };

    // Count by category
    encounters?.forEach((e: EncounterStats) => {
      if (e.surveillance_category) {
        stats.byCategory[e.surveillance_category] = (stats.byCategory[e.surveillance_category] || 0) + 1;
      }
    });

    return success(stats);
  } catch (err: unknown) {
    await auditLogger.error(
      'SYNDROMIC_STATS_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to get surveillance stats');
  }
}

// Export service
export const SyndromicSurveillanceService = {
  generateADTMessage,
  determineSurveillanceCategory,
  flagEncounterForSurveillance,
  getPendingEncounters,
  createTransmission,
  recordTransmissionResult,
  getTransmissionHistory,
  getSurveillanceStats,
};

export default SyndromicSurveillanceService;
