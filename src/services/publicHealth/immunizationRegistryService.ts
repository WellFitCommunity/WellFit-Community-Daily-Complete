/**
 * Immunization Registry Service
 *
 * ONC Criteria: 170.315(f)(1)
 * Purpose: Generate and transmit HL7 VXU (Vaccination Update) messages
 * to state immunization information systems (IIS)
 *
 * Target: Texas ImmTrac2 (DSHS Immunization Registry)
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { DEFAULT_DELIMITERS, type HL7Delimiters } from '../../types/hl7v2';

// =====================================================
// TYPES
// =====================================================

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

interface FacilityData {
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

interface RegistryConfig {
  name: string;
  endpoint: string;
  sendingApplication: string;
  receivingApplication: string;
  receivingFacility: string;
  hl7Version: string;
}

// Database row interfaces
interface SubmissionRow {
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

// =====================================================
// CONSTANTS
// =====================================================

// Texas ImmTrac2 configuration
const TX_IMMTRAC2_CONFIG: RegistryConfig = {
  name: 'TX_IMMTRAC2',
  endpoint: 'https://immtrac.dshs.texas.gov/hl7', // Production endpoint
  sendingApplication: 'WELLFIT_EHR',
  receivingApplication: 'IMMTRAC2',
  receivingFacility: 'TX_DSHS',
  hl7Version: '2.5.1',
};

// CVX Code to vaccine name mapping (common vaccines)
const CVX_VACCINE_NAMES: Record<string, string> = {
  '03': 'MMR',
  '08': 'Hepatitis B, adolescent or pediatric',
  '09': 'Td (adult)',
  '10': 'IPV',
  '20': 'DTaP',
  '21': 'Varicella',
  '33': 'Pneumococcal polysaccharide PPV23',
  '43': 'Hepatitis B, adult',
  '44': 'Hepatitis B, dialysis',
  '45': 'Hepatitis B, unspecified',
  '48': 'Hib (PRP-T)',
  '49': 'Hib (PRP-OMP)',
  '52': 'Hepatitis A, adult',
  '83': 'Hepatitis A, pediatric',
  '88': 'Influenza, unspecified',
  '94': 'MMRV',
  '104': 'Hepatitis A and Hepatitis B',
  '110': 'DTaP-Hep B-IPV',
  '113': 'Td (adult)',
  '114': 'Meningococcal MCV4P',
  '115': 'Tdap',
  '116': 'Rotavirus, pentavalent',
  '118': 'HPV, bivalent',
  '119': 'Rotavirus, monovalent',
  '120': 'DTaP-Hib-IPV',
  '121': 'Zoster, live',
  '133': 'PCV13',
  '136': 'Meningococcal MCV4O',
  '140': 'Influenza, seasonal, injectable',
  '141': 'Influenza, seasonal, intranasal',
  '149': 'Influenza, live, intranasal, quadrivalent',
  '150': 'Influenza, injectable, quadrivalent',
  '158': 'Influenza, injectable, quadrivalent',
  '161': 'Influenza, injectable, quadrivalent (trivalent)',
  '162': 'Meningococcal B, recombinant',
  '163': 'Meningococcal B, OMV',
  '165': 'HPV9',
  '185': 'Influenza, quadrivalent, recombinant',
  '187': 'Zoster, recombinant',
  '189': 'Hepatitis B, recombinant',
  '197': 'Influenza, high dose, quadrivalent',
  '207': 'COVID-19, mRNA, LNP-S, PF, 100 mcg/0.5 mL',
  '208': 'COVID-19, mRNA, LNP-S, PF, 30 mcg/0.3 mL',
  '210': 'COVID-19, viral vector',
  '211': 'COVID-19, mRNA',
  '212': 'COVID-19, viral vector',
  '213': 'COVID-19, mRNA',
  '217': 'COVID-19, mRNA, LNP-S, PF, pediatric',
  '218': 'COVID-19, mRNA, LNP-S, PF, 50 mcg/0.25 mL',
  '219': 'COVID-19, mRNA, LNP-S, PF, 3 mcg',
  '221': 'COVID-19, mRNA, LNP-S, bivalent',
  '228': 'COVID-19, mRNA, LNP-S, bivalent',
  '229': 'COVID-19, mRNA, LNP-S, bivalent',
  '230': 'COVID-19, mRNA, LNP-S, bivalent',
  '300': 'COVID-19, mRNA, LNP-S, 2023-2024',
  '301': 'COVID-19, mRNA, LNP-S, 2023-2024',
  '302': 'COVID-19, mRNA, LNP-S, 2023-2024',
};

// MVX (Manufacturer) codes
const MVX_MANUFACTURERS: Record<string, string> = {
  'AB': 'Abbott',
  'ALP': 'Alpha Therapeutic Corp',
  'AVI': 'Aviron',
  'BA': 'Baxter Healthcare',
  'BAY': 'Bayer Corp',
  'BPC': 'Berna Products Corp',
  'BN': 'Bharat Biotech',
  'CNJ': 'Cangene Corp',
  'CON': 'Connaught',
  'CMP': 'Celltech Medeva Pharmaceuticals',
  'EVN': 'Evans Medical Ltd',
  'GEO': 'GeoVax Labs',
  'GRE': 'Greer Labs',
  'GSK': 'GlaxoSmithKline',
  'IDB': 'ID Biomedical',
  'IUS': 'Immuno-US',
  'JNJ': 'Johnson & Johnson',
  'JPN': 'Japanese Manufacturer',
  'KGC': 'Korea Green Cross',
  'LED': 'Lederle',
  'MBL': 'Massachusetts Biological Labs',
  'MED': 'MedImmune',
  'MSD': 'Merck & Co',
  'NAB': 'NABI',
  'NOV': 'Novartis',
  'NVX': 'Novavax',
  'OTC': 'Organon Teknika Corp',
  'ORT': 'Ortho Clinical Diagnostics',
  'PD': 'Parke-Davis',
  'PFR': 'Pfizer',
  'PMC': 'sanofi pasteur',
  'PRX': 'Protein Sciences',
  'SCL': 'Sclavo',
  'SKB': 'SmithKline Beecham',
  'SOL': 'Solvay Pharmaceuticals',
  'TAL': 'Talecris Biotherapeutics',
  'USA': 'US Army Medical R&D Command',
  'VXG': 'VaxGen',
  'WAL': 'Wyeth-Ayerst',
  'WY': 'Wyeth',
  'MOD': 'Moderna',
  'JSN': 'Janssen',
  'ASZ': 'AstraZeneca',
  'BNT': 'BioNTech',
  'PFE': 'Pfizer',
};

// Administration site codes (HL7 Table 0163)
const ADMIN_SITE_CODES: Record<string, string> = {
  'LA': 'Left Arm',
  'RA': 'Right Arm',
  'LT': 'Left Thigh',
  'RT': 'Right Thigh',
  'LLFA': 'Left Lower Forearm',
  'RLFA': 'Right Lower Forearm',
  'LD': 'Left Deltoid',
  'RD': 'Right Deltoid',
  'LG': 'Left Gluteus Medius',
  'RG': 'Right Gluteus Medius',
  'LVL': 'Left Vastus Lateralis',
  'RVL': 'Right Vastus Lateralis',
};

// Administration route codes (NCI/HL7)
const ADMIN_ROUTE_CODES: Record<string, string> = {
  'IM': 'Intramuscular',
  'SC': 'Subcutaneous',
  'ID': 'Intradermal',
  'PO': 'Oral',
  'IN': 'Intranasal',
  'IV': 'Intravenous',
  'TD': 'Transdermal',
};

// =====================================================
// HL7 VXU MESSAGE GENERATION
// =====================================================

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

  // Information source
  const infoSource = imm.informationSource === '01' ? '01^Historical information - source unspecified^NIP001' : '00^New immunization record^NIP001';

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

function getRelationshipText(code: string): string {
  const relationships: Record<string, string> = {
    'MTH': 'Mother',
    'FTH': 'Father',
    'GRD': 'Guardian',
    'SEL': 'Self',
    'SPO': 'Spouse',
    'OTH': 'Other',
  };
  return relationships[code] || 'Other';
}

function mapFundingSourceToVFC(source: string): string {
  const mapping: Record<string, string> = {
    'VFC': 'V01',
    'Private': 'V02',
    'State': 'V03',
    'Military': 'V04',
    'Indian Health': 'V05',
    'Not Insured': 'V06',
    'Unknown': 'V00',
  };
  return mapping[source] || 'V00';
}

function getFundingSourceText(code: string): string {
  const texts: Record<string, string> = {
    'V00': 'Unknown',
    'V01': 'Not VFC eligible',
    'V02': 'VFC eligible - Medicaid/Medicaid Managed Care',
    'V03': 'VFC eligible - Uninsured',
    'V04': 'VFC eligible - American Indian/Alaska Native',
    'V05': 'VFC eligible - Federally Qualified Health Center Patient',
    'V06': 'Not VFC eligible',
  };
  return texts[code] || 'Unknown';
}

// =====================================================
// SERVICE FUNCTIONS
// =====================================================

/**
 * Submit immunization to registry
 */
export async function submitImmunization(
  tenantId: string,
  immunization: ImmunizationRecord,
  patient: ImmunizationPatientData,
  facility: FacilityData
): Promise<ServiceResult<ImmunizationSubmission>> {
  try {
    // Generate VXU message
    const hl7Message = generateVXUMessage({
      immunization,
      patient,
      facility,
    });

    const messageControlId = generateMessageControlId();

    // Save submission record
    const { data, error } = await supabase
      .from('immunization_registry_submissions')
      .insert({
        tenant_id: tenantId,
        patient_id: patient.patientId,
        immunization_id: immunization.id,
        vaccine_cvx_code: immunization.vaccineCvxCode,
        vaccine_name: immunization.vaccineName,
        administration_date: immunization.administrationDate.toISOString().split('T')[0],
        lot_number: immunization.lotNumber,
        expiration_date: immunization.expirationDate?.toISOString().split('T')[0],
        manufacturer_mvx_code: immunization.manufacturerMvxCode,
        administered_by_npi: immunization.administeredByNpi,
        administration_site: immunization.administrationSite,
        administration_route: immunization.administrationRoute,
        dose_number: immunization.doseNumber,
        series_name: immunization.seriesName,
        registry_name: TX_IMMTRAC2_CONFIG.name,
        registry_endpoint: TX_IMMTRAC2_CONFIG.endpoint,
        message_type: 'VXU_V04',
        message_control_id: messageControlId,
        hl7_message: hl7Message,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('IMMUNIZATION_SUBMISSION_CREATED', {
      tenantId,
      submissionId: data.id,
      patientId: patient.patientId,
      vaccineCvx: immunization.vaccineCvxCode,
    });

    return success({
      id: data.id,
      tenantId: data.tenant_id,
      patientId: data.patient_id,
      immunizationId: data.immunization_id,
      vaccineCvxCode: data.vaccine_cvx_code,
      vaccineName: data.vaccine_name,
      administrationDate: new Date(data.administration_date),
      registryName: data.registry_name,
      messageControlId: data.message_control_id,
      hl7Message: data.hl7_message,
      status: 'pending',
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'IMMUNIZATION_SUBMISSION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId: patient.patientId }
    );
    return failure('OPERATION_FAILED', 'Failed to submit immunization');
  }
}

/**
 * Record submission result (registry response)
 */
export async function recordSubmissionResult(
  submissionId: string,
  result: {
    success: boolean;
    responseCode?: string;
    responseMessage?: string;
    errorCode?: string;
    errorMessage?: string;
  }
): Promise<ServiceResult<void>> {
  try {
    const status = result.success ? 'accepted' : 'rejected';

    const { error } = await supabase
      .from('immunization_registry_submissions')
      .update({
        status,
        sent_at: new Date().toISOString(),
        response_received_at: new Date().toISOString(),
        response_code: result.responseCode,
        response_message: result.responseMessage,
        error_code: result.errorCode,
        error_message: result.errorMessage,
      })
      .eq('id', submissionId);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('IMMUNIZATION_SUBMISSION_RESULT', {
      submissionId,
      status,
      responseCode: result.responseCode,
    });

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'IMMUNIZATION_RECORD_RESULT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { submissionId }
    );
    return failure('OPERATION_FAILED', 'Failed to record submission result');
  }
}

/**
 * Get submission history for a patient
 */
export async function getPatientSubmissionHistory(
  tenantId: string,
  patientId: string,
  limit = 50
): Promise<ServiceResult<ImmunizationSubmission[]>> {
  try {
    const { data, error } = await supabase
      .from('immunization_registry_submissions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('patient_id', patientId)
      .order('administration_date', { ascending: false })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const submissions: ImmunizationSubmission[] = ((data || []) as SubmissionRow[]).map((row: SubmissionRow) => ({
      id: row.id,
      tenantId: row.tenant_id,
      patientId: row.patient_id,
      immunizationId: row.immunization_id,
      vaccineCvxCode: row.vaccine_cvx_code,
      vaccineName: row.vaccine_name,
      administrationDate: new Date(row.administration_date),
      registryName: row.registry_name,
      messageControlId: row.message_control_id,
      hl7Message: row.hl7_message,
      status: row.status as ImmunizationSubmission['status'],
      sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
      responseCode: row.response_code,
      responseMessage: row.response_message,
      errorMessage: row.error_message,
    }));

    return success(submissions);
  } catch (err: unknown) {
    await auditLogger.error(
      'IMMUNIZATION_GET_HISTORY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId }
    );
    return failure('FETCH_FAILED', 'Failed to get submission history');
  }
}

/**
 * Get pending submissions
 */
export async function getPendingSubmissions(
  tenantId: string,
  limit = 100
): Promise<ServiceResult<ImmunizationSubmission[]>> {
  try {
    const { data, error } = await supabase
      .from('immunization_registry_submissions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const submissions: ImmunizationSubmission[] = ((data || []) as SubmissionRow[]).map((row: SubmissionRow) => ({
      id: row.id,
      tenantId: row.tenant_id,
      patientId: row.patient_id,
      immunizationId: row.immunization_id,
      vaccineCvxCode: row.vaccine_cvx_code,
      vaccineName: row.vaccine_name,
      administrationDate: new Date(row.administration_date),
      registryName: row.registry_name,
      messageControlId: row.message_control_id,
      hl7Message: row.hl7_message,
      status: 'pending',
    }));

    return success(submissions);
  } catch (err: unknown) {
    await auditLogger.error(
      'IMMUNIZATION_GET_PENDING_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to get pending submissions');
  }
}

/**
 * Get CVX code information
 */
export function getCVXVaccineName(cvxCode: string): string | null {
  return CVX_VACCINE_NAMES[cvxCode] || null;
}

/**
 * Get MVX manufacturer name
 */
export function getMVXManufacturerName(mvxCode: string): string | null {
  return MVX_MANUFACTURERS[mvxCode] || null;
}

// Export service
export const ImmunizationRegistryService = {
  generateVXUMessage,
  submitImmunization,
  recordSubmissionResult,
  getPatientSubmissionHistory,
  getPendingSubmissions,
  getCVXVaccineName,
  getMVXManufacturerName,
};

export default ImmunizationRegistryService;
