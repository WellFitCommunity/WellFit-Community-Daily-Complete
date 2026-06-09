/**
 * Immunization Registry — HL7 v2.5.1 VXU (Vaccination Update) message generation
 *
 * Builds MSH/PID/PD1/NK1/ORC/RXA/RXR/OBX segments for transmission to state IIS.
 * Extracted verbatim from immunizationRegistryService.ts (god-file decomposition).
 */

import { DEFAULT_DELIMITERS, type HL7Delimiters } from '../../../types/hl7v2';
import type {
  ImmunizationRecord,
  ImmunizationPatientData,
  FacilityData,
} from './types';
import {
  TX_IMMTRAC2_CONFIG,
  CVX_VACCINE_NAMES,
  MVX_MANUFACTURERS,
  ADMIN_SITE_CODES,
  ADMIN_ROUTE_CODES,
} from './constants';
import {
  generateMessageControlId,
  formatHL7DateTime,
  formatHL7Date,
  getRelationshipText,
  mapFundingSourceToVFC,
  getFundingSourceText,
} from './helpers';

/**
 * Generate HL7 v2.5.1 VXU (Vaccination Update) message
 */
export function generateVXUMessage(options: {
  immunization: ImmunizationRecord;
  patient: ImmunizationPatientData;
  facility: FacilityData;
  sendingApplication?: string;
  receivingApplication?: string;
  receivingFacility?: string;
}): string {
  const {
    immunization,
    patient,
    facility,
    sendingApplication = TX_IMMTRAC2_CONFIG.sendingApplication,
    receivingApplication = TX_IMMTRAC2_CONFIG.receivingApplication,
    receivingFacility = TX_IMMTRAC2_CONFIG.receivingFacility,
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
    messageControlId,
    processingId: 'P',
    versionId: TX_IMMTRAC2_CONFIG.hl7Version,
    delimiters,
  }));

  // PID - Patient Identification
  segments.push(buildPIDSegment({ patient, delimiters }));

  // PD1 - Patient Additional Demographic
  if (patient.guardianName) {
    segments.push(buildPD1Segment({ patient, delimiters }));
  }

  // NK1 - Next of Kin (guardian info for minors)
  if (patient.guardianName) {
    segments.push(buildNK1Segment({ patient, delimiters }));
  }

  // ORC - Common Order segment
  segments.push(buildORCSegment({
    immunization,
    facility,
    delimiters,
  }));

  // RXA - Pharmacy/Treatment Administration
  segments.push(buildRXASegment({
    immunization,
    delimiters,
  }));

  // RXR - Pharmacy/Treatment Route (if route/site specified)
  if (immunization.administrationRoute || immunization.administrationSite) {
    segments.push(buildRXRSegment({
      immunization,
      delimiters,
    }));
  }

  // OBX - Observation segments for VFC eligibility, funding source, etc.
  segments.push(...buildVaccineOBXSegments({
    immunization,
    delimiters,
  }));

  return segments.join('\r');
}

/**
 * Build MSH segment for VXU
 */
function buildMSHSegment(options: {
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  messageDateTime: string;
  messageControlId: string;
  processingId: string;
  versionId: string;
  delimiters: HL7Delimiters;
}): string {
  const d = options.delimiters;
  const fields = [
    'MSH',
    d.field,
    `${d.component}${d.repetition}${d.escape}${d.subComponent}`,
    options.sendingApplication,
    options.sendingFacility,
    options.receivingApplication,
    options.receivingFacility,
    options.messageDateTime,
    '',
    `VXU${d.component}V04${d.component}VXU_V04`,
    options.messageControlId,
    options.processingId,
    options.versionId,
    '',
    '',
    'ER',
    'AL',
    'USA',
    'UNICODE UTF-8',
    '',
    '',
    'Z22^CDCPHINVS', // CDC Implementation Guide profile
  ];

  return fields.join(d.field);
}

/**
 * Build PID segment
 */
function buildPIDSegment(options: {
  patient: ImmunizationPatientData;
  delimiters: HL7Delimiters;
}): string {
  const d = options.delimiters;
  const p = options.patient;

  const patientName = [
    p.lastName || '',
    p.firstName || '',
    p.middleName || '',
    '', '', '', 'L',
  ].join(d.component);

  const patientAddress = p.address ? [
    p.address.street || '',
    '',
    p.address.city || '',
    p.address.state || '',
    p.address.zipCode || '',
    'USA',
    'H',
    p.address.county || '',
  ].join(d.component) : '';

  const fields = [
    'PID',
    '1',
    '',
    `${p.mrn}${d.component}${d.component}${d.component}MR`,
    '',
    patientName,
    p.mothersMaidenName || '',
    formatHL7Date(p.dateOfBirth),
    p.gender,
    '',
    p.race || '',
    patientAddress,
    p.address?.county || '',
    p.phone || '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    p.ethnicity || '',
    '',
    p.multipleBirth ? 'Y' : '',
    p.birthOrder?.toString() || '',
  ];

  return fields.join(d.field);
}

/**
 * Build PD1 segment (Patient Additional Demographic)
 */
function buildPD1Segment(options: {
  patient: ImmunizationPatientData;
  delimiters: HL7Delimiters;
}): string {
  const d = options.delimiters;
  const fields = [
    'PD1',
    '', '', '',
    '', '', '', '', '', '', '',
    'Y', // Publicity code - allow release to registry
  ];

  return fields.join(d.field);
}

/**
 * Build NK1 segment (Next of Kin / Guardian)
 */
function buildNK1Segment(options: {
  patient: ImmunizationPatientData;
  delimiters: HL7Delimiters;
}): string {
  const d = options.delimiters;
  const p = options.patient;

  const relationshipCode = p.guardianRelationship || 'MTH'; // Default to mother

  const fields = [
    'NK1',
    '1',
    p.guardianName || '',
    `${relationshipCode}${d.component}${getRelationshipText(relationshipCode)}${d.component}HL70063`,
  ];

  return fields.join(d.field);
}

/**
 * Build ORC segment (Common Order)
 */
function buildORCSegment(options: {
  immunization: ImmunizationRecord;
  facility: FacilityData;
  delimiters: HL7Delimiters;
}): string {
  const d = options.delimiters;
  const imm = options.immunization;
  const fac = options.facility;

  const orderControl = imm.informationSource === '01' ? 'RE' : 'RE'; // RE = Observations/Performed Service to follow
  const orderingProvider = imm.administeredByNpi ? [
    imm.administeredByNpi,
    imm.administeredByName || '',
  ].join(d.component) : '';

  const fields = [
    'ORC',
    orderControl,
    '',
    imm.id, // Filler order number
    '', '', '', '', '',
    '', '', '',
    orderingProvider,
    '',
    '',
    '',
    '',
    `${fac.name}${d.component}${d.component}${d.component}${d.component}${d.component}${d.component}XX${d.component}${fac.immtracPinNumber || ''}`,
  ];

  return fields.join(d.field);
}

/**
 * Build RXA segment (Pharmacy/Treatment Administration)
 */
function buildRXASegment(options: {
  immunization: ImmunizationRecord;
  delimiters: HL7Delimiters;
}): string {
  const d = options.delimiters;
  const imm = options.immunization;

  const adminDate = formatHL7DateTime(imm.administrationDate);
  const vaccineName = CVX_VACCINE_NAMES[imm.vaccineCvxCode] || imm.vaccineName;

  // CVX coded vaccine
  const administeredCode = [
    imm.vaccineCvxCode,
    vaccineName,
    'CVX',
  ].join(d.component);

  // Manufacturer (MVX)
  const manufacturer = imm.manufacturerMvxCode ? [
    imm.manufacturerMvxCode,
    MVX_MANUFACTURERS[imm.manufacturerMvxCode] || imm.manufacturerName || '',
    'MVX',
  ].join(d.component) : '';

  // Completion status
  const completionStatus = 'CP'; // Completed

  // Information source (reserved for RXA.9 when supported by registry)
  const _infoSource = imm.informationSource === '01' ? '01^Historical information - source unspecified^NIP001' : '00^New immunization record^NIP001';
  void _infoSource; // Will be used in RXA.9 field when registry supports it

  const fields = [
    'RXA',
    '0',                                        // RXA.1 - Give Sub-ID Counter
    '1',                                        // RXA.2 - Administration Sub-ID Counter
    adminDate,                                  // RXA.3 - Date/Time Start
    adminDate,                                  // RXA.4 - Date/Time End
    administeredCode,                           // RXA.5 - Administered Code
    '999',                                      // RXA.6 - Administered Amount (999=unknown)
    '',                                         // RXA.7 - Administered Units
    '',                                         // RXA.8 - Administered Dosage Form
    '',                                         // RXA.9 - Administration Notes
    imm.administeredByNpi ? `${imm.administeredByNpi}${d.component}${imm.administeredByName || ''}` : '', // RXA.10
    '',                                         // RXA.11 - Administered-at Location
    '',                                         // RXA.12 - Administered Per (Time Unit)
    '',                                         // RXA.13 - Administered Strength
    '',                                         // RXA.14 - Administered Strength Units
    imm.lotNumber || '',                        // RXA.15 - Substance Lot Number
    imm.expirationDate ? formatHL7Date(imm.expirationDate.toISOString()) : '', // RXA.16 - Substance Expiration Date
    manufacturer,                               // RXA.17 - Substance Manufacturer Name
    '',                                         // RXA.18 - Substance/Treatment Refusal Reason
    '',                                         // RXA.19 - Indication
    completionStatus,                           // RXA.20 - Completion Status
    'A',                                        // RXA.21 - Action Code (A=Add)
    '',                                         // RXA.22 - System Entry Date/Time
    '',                                         // RXA.23 - Administered Drug Strength Volume
    '',                                         // RXA.24 - Administered Drug Strength Volume Units
    '',                                         // RXA.25 - Administered Barcode Identifier
    '',                                         // RXA.26 - Pharmacy Order Type
  ];

  return fields.join(d.field);
}

/**
 * Build RXR segment (Route)
 */
function buildRXRSegment(options: {
  immunization: ImmunizationRecord;
  delimiters: HL7Delimiters;
}): string {
  const d = options.delimiters;
  const imm = options.immunization;

  const route = imm.administrationRoute ? [
    imm.administrationRoute,
    ADMIN_ROUTE_CODES[imm.administrationRoute] || '',
    'HL70162',
  ].join(d.component) : '';

  const site = imm.administrationSite ? [
    imm.administrationSite,
    ADMIN_SITE_CODES[imm.administrationSite] || '',
    'HL70163',
  ].join(d.component) : '';

  const fields = [
    'RXR',
    route,                                      // RXR.1 - Route
    site,                                       // RXR.2 - Administration Site
  ];

  return fields.join(d.field);
}

/**
 * Build OBX segments for vaccine-related observations
 */
function buildVaccineOBXSegments(options: {
  immunization: ImmunizationRecord;
  delimiters: HL7Delimiters;
}): string[] {
  const d = options.delimiters;
  const imm = options.immunization;
  const segments: string[] = [];
  let setId = 1;

  // OBX for VFC Eligibility (required for pediatric vaccines)
  if (imm.fundingSource) {
    const vfcCode = mapFundingSourceToVFC(imm.fundingSource);
    segments.push([
      'OBX',
      setId.toString(),
      'CE',
      `64994-7${d.component}Vaccine funding program eligibility category${d.component}LN`,
      '1',
      `${vfcCode}${d.component}${getFundingSourceText(vfcCode)}${d.component}HL70064`,
      '', '', '', '', '',
      'F', // Final
    ].join(d.field));
    setId++;
  }

  // OBX for Dose Number in Series
  if (imm.doseNumber) {
    segments.push([
      'OBX',
      setId.toString(),
      'NM',
      `30973-2${d.component}Dose number in series${d.component}LN`,
      '1',
      imm.doseNumber.toString(),
      '', '', '', '', '',
      'F',
    ].join(d.field));
    setId++;
  }

  return segments;
}
