/**
 * Syndromic Surveillance — HL7 v2.5.1 ADT message generation
 *
 * Builds MSH/EVN/PID/PV1/PV2/DG1 segments for transmission to ESSENCE (TX DSHS).
 * Extracted verbatim from syndromicSurveillanceService.ts (god-file decomposition).
 */

import { DEFAULT_DELIMITERS, type HL7Delimiters } from '../../../types/hl7v2';
import type {
  SyndromicEncounter,
  SyndromicPatientData,
  FacilityData,
  ADTMessageOptions,
} from './types';
import { TX_DSHS_CONFIG } from './constants';
import { generateMessageControlId, formatHL7DateTime, formatHL7Date } from './helpers';

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
