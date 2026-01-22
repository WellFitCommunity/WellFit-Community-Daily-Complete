/**
 * Antimicrobial Use & Resistance (AU/AR) Surveillance Service
 *
 * ONC Criteria: 170.315(f)(4)
 * Purpose: Track antimicrobial usage and resistance patterns,
 * generate NHSN CDA documents for CDC reporting.
 *
 * Target: CDC National Healthcare Safety Network (NHSN)
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';

// =====================================================
// TYPES
// =====================================================

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

interface FacilityData {
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
interface UsageRow {
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

interface ResistanceRow {
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

interface SubmissionRow {
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

// =====================================================
// CONSTANTS
// =====================================================

// NHSN Configuration (used by edge function for production submission)
const _NHSN_CONFIG = {
  name: 'CDC_NHSN',
  endpoint: 'https://sams.cdc.gov/nhsn/api/upload', // Production endpoint
  testEndpoint: 'https://nhsn-staging.cdc.gov/api/upload',
};
export { _NHSN_CONFIG as NHSN_CONFIG };

// Antimicrobial classes and common drugs
const ANTIMICROBIAL_CLASSES: Record<string, string[]> = {
  'Penicillins': ['Amoxicillin', 'Ampicillin', 'Penicillin G', 'Piperacillin', 'Piperacillin-Tazobactam'],
  'Cephalosporins - 1st Gen': ['Cefazolin', 'Cephalexin'],
  'Cephalosporins - 2nd Gen': ['Cefuroxime', 'Cefoxitin', 'Cefaclor'],
  'Cephalosporins - 3rd Gen': ['Ceftriaxone', 'Cefotaxime', 'Ceftazidime', 'Cefpodoxime'],
  'Cephalosporins - 4th Gen': ['Cefepime'],
  'Cephalosporins - 5th Gen': ['Ceftaroline', 'Ceftobiprole'],
  'Carbapenems': ['Meropenem', 'Imipenem-Cilastatin', 'Ertapenem', 'Doripenem'],
  'Fluoroquinolones': ['Ciprofloxacin', 'Levofloxacin', 'Moxifloxacin', 'Ofloxacin'],
  'Aminoglycosides': ['Gentamicin', 'Tobramycin', 'Amikacin', 'Streptomycin'],
  'Macrolides': ['Azithromycin', 'Clarithromycin', 'Erythromycin'],
  'Tetracyclines': ['Doxycycline', 'Minocycline', 'Tetracycline', 'Tigecycline'],
  'Glycopeptides': ['Vancomycin', 'Teicoplanin', 'Dalbavancin', 'Oritavancin'],
  'Oxazolidinones': ['Linezolid', 'Tedizolid'],
  'Sulfonamides': ['Trimethoprim-Sulfamethoxazole', 'Sulfadiazine'],
  'Nitroimidazoles': ['Metronidazole'],
  'Polymyxins': ['Colistin', 'Polymyxin B'],
  'Antifungals - Azoles': ['Fluconazole', 'Voriconazole', 'Posaconazole', 'Itraconazole'],
  'Antifungals - Echinocandins': ['Caspofungin', 'Micafungin', 'Anidulafungin'],
  'Antifungals - Polyenes': ['Amphotericin B'],
};

// MDRO Types
const MDRO_TYPES: Record<string, string> = {
  'MRSA': 'Methicillin-resistant Staphylococcus aureus',
  'VRE': 'Vancomycin-resistant Enterococcus',
  'CRE': 'Carbapenem-resistant Enterobacteriaceae',
  'ESBL': 'Extended-Spectrum Beta-Lactamase Producer',
  'CRPA': 'Carbapenem-resistant Pseudomonas aeruginosa',
  'CRAB': 'Carbapenem-resistant Acinetobacter baumannii',
  'C.diff': 'Clostridioides difficile',
  'MDR-TB': 'Multi-drug resistant Tuberculosis',
};

// Code Systems
const CODE_SYSTEMS = {
  rxnorm: '2.16.840.1.113883.6.88',
  snomed: '2.16.840.1.113883.6.96',
  loinc: '2.16.840.1.113883.6.1',
  icd10: '2.16.840.1.113883.6.90',
};

// =====================================================
// NHSN CDA DOCUMENT GENERATION
// =====================================================

/**
 * Generate NHSN CDA document for Antimicrobial Use reporting
 */
export function generateAUDocument(options: {
  usageRecords: AntimicrobialUsageRecord[];
  facility: FacilityData;
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
}): string {
  const {
    usageRecords,
    facility,
    reportingPeriodStart,
    reportingPeriodEnd,
  } = options;

  const documentId = generateDocumentId();
  const effectiveTime = formatHL7DateTime(new Date());

  // Group by antimicrobial class for summary
  const byClass = groupByClass(usageRecords);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="CDA.xsl"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:sdtc="urn:hl7-org:sdtc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <!-- ********************************************************
       CDA Header - NHSN Antimicrobial Use Summary Report
       ******************************************************** -->
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>

  <!-- NHSN AU Summary Report Template -->
  <templateId root="2.16.840.1.113883.10.20.5.6.260"/>

  <!-- Document ID -->
  <id root="${documentId}"/>

  <!-- Document Code -->
  <code code="51897-7" codeSystem="${CODE_SYSTEMS.loinc}" codeSystemName="LOINC" displayName="Healthcare Associated Infection Report"/>

  <!-- Title -->
  <title>NHSN Antimicrobial Use Summary Report</title>

  <!-- Effective Time -->
  <effectiveTime value="${effectiveTime}"/>

  <!-- Confidentiality -->
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>

  <!-- Language -->
  <languageCode code="en-US"/>

  <!-- Reporting Period -->
  <documentationOf>
    <serviceEvent classCode="CASE">
      <effectiveTime>
        <low value="${formatHL7Date(reportingPeriodStart.toISOString())}"/>
        <high value="${formatHL7Date(reportingPeriodEnd.toISOString())}"/>
      </effectiveTime>
    </serviceEvent>
  </documentationOf>

  <!-- ********************************************************
       Custodian (Reporting Facility)
       ******************************************************** -->
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="2.16.840.1.113883.4.6" extension="${facility.npi || ''}"/>
        ${facility.nhsnOrgId ? `<id root="2.16.840.1.114222.4.1.214134" extension="${facility.nhsnOrgId}"/>` : ''}
        <name>${escapeXml(facility.name)}</name>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>

  <!-- ********************************************************
       Component (Body)
       ******************************************************** -->
  <component>
    <structuredBody>
      <!-- Summary Data Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.5.5.47"/>
          <code code="51899-3" codeSystem="${CODE_SYSTEMS.loinc}" displayName="Summary Data Section"/>
          <title>Antimicrobial Use Summary</title>
          <text>
            <table>
              <thead>
                <tr>
                  <th>Antimicrobial Class</th>
                  <th>Drug</th>
                  <th>Route</th>
                  <th>Therapy Type</th>
                  <th>Days of Therapy</th>
                  <th>Patient Count</th>
                </tr>
              </thead>
              <tbody>
                ${generateUsageSummaryRows(usageRecords)}
              </tbody>
            </table>
          </text>
          ${generateUsageEntries(usageRecords)}
        </section>
      </component>

      <!-- Summary by Class Section -->
      <component>
        <section>
          <code code="NHSN-AU-CLASS" codeSystem="2.16.840.1.114222.4.5.232" displayName="Antimicrobial Use by Class"/>
          <title>Summary by Antimicrobial Class</title>
          <text>
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Total Days of Therapy</th>
                  <th>Distinct Patients</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(byClass).map(([className, records]) => `
                <tr>
                  <td>${escapeXml(className)}</td>
                  <td>${records.reduce((sum, r) => sum + (r.durationDays || 0), 0)}</td>
                  <td>${new Set(records.map(r => r.patientId)).size}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </text>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>`;

  return xml;
}

/**
 * Generate NHSN CDA document for Antimicrobial Resistance reporting
 */
export function generateARDocument(options: {
  resistanceRecords: AntimicrobialResistanceRecord[];
  facility: FacilityData;
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
}): string {
  const {
    resistanceRecords,
    facility,
    reportingPeriodStart,
    reportingPeriodEnd,
  } = options;

  const documentId = generateDocumentId();
  const effectiveTime = formatHL7DateTime(new Date());

  // Group by organism and MDRO status
  const byOrganism = groupByOrganism(resistanceRecords);
  const mdroRecords = resistanceRecords.filter(r => r.isMdro);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="CDA.xsl"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:sdtc="urn:hl7-org:sdtc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <!-- ********************************************************
       CDA Header - NHSN Antimicrobial Resistance Summary Report
       ******************************************************** -->
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>

  <!-- NHSN AR Summary Report Template -->
  <templateId root="2.16.840.1.113883.10.20.5.6.261"/>

  <!-- Document ID -->
  <id root="${documentId}"/>

  <!-- Document Code -->
  <code code="51897-7" codeSystem="${CODE_SYSTEMS.loinc}" codeSystemName="LOINC" displayName="Healthcare Associated Infection Report"/>

  <!-- Title -->
  <title>NHSN Antimicrobial Resistance Summary Report</title>

  <!-- Effective Time -->
  <effectiveTime value="${effectiveTime}"/>

  <!-- Confidentiality -->
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>

  <!-- Language -->
  <languageCode code="en-US"/>

  <!-- Reporting Period -->
  <documentationOf>
    <serviceEvent classCode="CASE">
      <effectiveTime>
        <low value="${formatHL7Date(reportingPeriodStart.toISOString())}"/>
        <high value="${formatHL7Date(reportingPeriodEnd.toISOString())}"/>
      </effectiveTime>
    </serviceEvent>
  </documentationOf>

  <!-- ********************************************************
       Custodian (Reporting Facility)
       ******************************************************** -->
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="2.16.840.1.113883.4.6" extension="${facility.npi || ''}"/>
        ${facility.nhsnOrgId ? `<id root="2.16.840.1.114222.4.1.214134" extension="${facility.nhsnOrgId}"/>` : ''}
        <name>${escapeXml(facility.name)}</name>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>

  <!-- ********************************************************
       Component (Body)
       ******************************************************** -->
  <component>
    <structuredBody>
      <!-- Resistance Summary Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.5.5.48"/>
          <code code="18769-0" codeSystem="${CODE_SYSTEMS.loinc}" displayName="Microbiology Studies"/>
          <title>Antimicrobial Resistance Summary</title>
          <text>
            <table>
              <thead>
                <tr>
                  <th>Organism</th>
                  <th>Antimicrobial Tested</th>
                  <th>Interpretation</th>
                  <th>MIC</th>
                  <th>MDRO Type</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${generateResistanceSummaryRows(resistanceRecords)}
              </tbody>
            </table>
          </text>
          ${generateResistanceEntries(resistanceRecords)}
        </section>
      </component>

      <!-- MDRO Summary Section -->
      <component>
        <section>
          <code code="NHSN-MDRO" codeSystem="2.16.840.1.114222.4.5.232" displayName="Multi-Drug Resistant Organisms"/>
          <title>Multi-Drug Resistant Organisms (MDROs)</title>
          <text>
            <paragraph><content styleCode="Bold">Total MDRO Isolates:</content> ${mdroRecords.length}</paragraph>
            <table>
              <thead>
                <tr>
                  <th>MDRO Type</th>
                  <th>Count</th>
                  <th>Distinct Patients</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(groupByMdroType(mdroRecords)).map(([type, records]) => `
                <tr>
                  <td>${escapeXml(type)} - ${MDRO_TYPES[type] || 'Other'}</td>
                  <td>${records.length}</td>
                  <td>${new Set(records.map(r => r.patientId)).size}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </text>
        </section>
      </component>

      <!-- Summary by Organism Section -->
      <component>
        <section>
          <code code="NHSN-AR-ORG" codeSystem="2.16.840.1.114222.4.5.232" displayName="Resistance by Organism"/>
          <title>Summary by Organism</title>
          <text>
            <table>
              <thead>
                <tr>
                  <th>Organism</th>
                  <th>Total Isolates</th>
                  <th>Susceptible</th>
                  <th>Intermediate</th>
                  <th>Resistant</th>
                  <th>% Resistant</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(byOrganism).map(([organism, records]) => {
                  const susceptible = records.filter(r => r.interpretation === 'S').length;
                  const intermediate = records.filter(r => r.interpretation === 'I').length;
                  const resistant = records.filter(r => r.interpretation === 'R').length;
                  const resistantPct = records.length > 0 ? ((resistant / records.length) * 100).toFixed(1) : '0';
                  return `
                <tr>
                  <td>${escapeXml(organism)}</td>
                  <td>${records.length}</td>
                  <td>${susceptible}</td>
                  <td>${intermediate}</td>
                  <td>${resistant}</td>
                  <td>${resistantPct}%</td>
                </tr>`;
                }).join('')}
              </tbody>
            </table>
          </text>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>`;

  return xml;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function generateDocumentId(): string {
  return `2.16.840.1.113883.4.6.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
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

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function groupByClass(records: AntimicrobialUsageRecord[]): Record<string, AntimicrobialUsageRecord[]> {
  return records.reduce((acc, record) => {
    const key = record.antimicrobialClass;
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {} as Record<string, AntimicrobialUsageRecord[]>);
}

function groupByOrganism(records: AntimicrobialResistanceRecord[]): Record<string, AntimicrobialResistanceRecord[]> {
  return records.reduce((acc, record) => {
    const key = record.organismName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {} as Record<string, AntimicrobialResistanceRecord[]>);
}

function groupByMdroType(records: AntimicrobialResistanceRecord[]): Record<string, AntimicrobialResistanceRecord[]> {
  return records.reduce((acc, record) => {
    const key = record.mdroType || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {} as Record<string, AntimicrobialResistanceRecord[]>);
}

function generateUsageSummaryRows(records: AntimicrobialUsageRecord[]): string {
  return records.slice(0, 50).map(r => `
                <tr>
                  <td>${escapeXml(r.antimicrobialClass)}</td>
                  <td>${escapeXml(r.medicationName)}</td>
                  <td>${r.route}</td>
                  <td>${r.therapyType}</td>
                  <td>${r.durationDays || '-'}</td>
                  <td>1</td>
                </tr>`).join('');
}

function generateUsageEntries(records: AntimicrobialUsageRecord[]): string {
  return records.slice(0, 50).map(r => `
          <entry typeCode="DRIV">
            <substanceAdministration classCode="SBADM" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.16"/>
              <effectiveTime xsi:type="IVL_TS">
                <low value="${formatHL7Date(r.prescribedDate.toISOString())}"/>
                ${r.endDate ? `<high value="${formatHL7Date(r.endDate.toISOString())}"/>` : ''}
              </effectiveTime>
              <routeCode code="${r.route}" codeSystem="2.16.840.1.113883.5.112"/>
              <consumable>
                <manufacturedProduct classCode="MANU">
                  <manufacturedMaterial>
                    <code code="${r.medicationCode}" codeSystem="${CODE_SYSTEMS.rxnorm}" displayName="${escapeXml(r.medicationName)}"/>
                  </manufacturedMaterial>
                </manufacturedProduct>
              </consumable>
            </substanceAdministration>
          </entry>`).join('');
}

function generateResistanceSummaryRows(records: AntimicrobialResistanceRecord[]): string {
  return records.slice(0, 50).map(r => `
                <tr>
                  <td>${escapeXml(r.organismName)}</td>
                  <td>${escapeXml(r.antimicrobialTested)}</td>
                  <td>${r.interpretation}</td>
                  <td>${r.micValue ? `${r.micValue} ${r.micUnit || ''}` : '-'}</td>
                  <td>${r.mdroType || '-'}</td>
                  <td>${formatDisplayDate(r.specimenCollectionDate)}</td>
                </tr>`).join('');
}

function generateResistanceEntries(records: AntimicrobialResistanceRecord[]): string {
  return records.slice(0, 50).map(r => `
          <entry typeCode="DRIV">
            <observation classCode="OBS" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.2"/>
              <code code="18769-0" codeSystem="${CODE_SYSTEMS.loinc}" displayName="Microbiology study"/>
              <effectiveTime value="${formatHL7Date(r.specimenCollectionDate.toISOString())}"/>
              <value xsi:type="CD" code="${r.organismCode}" codeSystem="${CODE_SYSTEMS.snomed}" displayName="${escapeXml(r.organismName)}"/>
              <interpretationCode code="${r.interpretation}" codeSystem="2.16.840.1.113883.5.83"/>
            </observation>
          </entry>`).join('');
}

/**
 * Classify an antimicrobial by name
 */
export function classifyAntimicrobial(medicationName: string): string | null {
  const nameLower = medicationName.toLowerCase();
  for (const [className, drugs] of Object.entries(ANTIMICROBIAL_CLASSES)) {
    if (drugs.some(drug => nameLower.includes(drug.toLowerCase()))) {
      return className;
    }
  }
  return null;
}

// =====================================================
// SERVICE FUNCTIONS
// =====================================================

/**
 * Record antimicrobial usage
 */
export async function recordAntimicrobialUsage(
  tenantId: string,
  usage: Omit<AntimicrobialUsageRecord, 'id' | 'tenantId' | 'includedInNhsnReport' | 'nhsnSubmissionId'>
): Promise<ServiceResult<{ id: string }>> {
  try {
    // Auto-classify if not provided
    const antimicrobialClass = usage.antimicrobialClass || classifyAntimicrobial(usage.medicationName) || 'Other';

    const { data, error } = await supabase
      .from('antimicrobial_usage')
      .insert({
        tenant_id: tenantId,
        patient_id: usage.patientId,
        encounter_id: usage.encounterId,
        medication_code: usage.medicationCode,
        medication_code_system: usage.medicationCodeSystem,
        medication_name: usage.medicationName,
        antimicrobial_class: antimicrobialClass,
        antimicrobial_subclass: usage.antimicrobialSubclass,
        dose_quantity: usage.doseQuantity,
        dose_unit: usage.doseUnit,
        route: usage.route,
        frequency: usage.frequency,
        duration_days: usage.durationDays,
        indication_code: usage.indicationCode,
        indication_description: usage.indicationDescription,
        prescriber_npi: usage.prescriberNpi,
        prescribed_date: usage.prescribedDate.toISOString().split('T')[0],
        start_date: usage.startDate?.toISOString().split('T')[0],
        end_date: usage.endDate?.toISOString().split('T')[0],
        therapy_type: usage.therapyType,
        included_in_nhsn_report: false,
      })
      .select('id')
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('ANTIMICROBIAL_USAGE_RECORDED', {
      tenantId,
      usageId: data.id,
      medicationName: usage.medicationName,
      antimicrobialClass,
    });

    return success({ id: data.id });
  } catch (err: unknown) {
    await auditLogger.error(
      'ANTIMICROBIAL_USAGE_RECORD_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('OPERATION_FAILED', 'Failed to record antimicrobial usage');
  }
}

/**
 * Record antimicrobial resistance result
 */
export async function recordResistance(
  tenantId: string,
  resistance: Omit<AntimicrobialResistanceRecord, 'id' | 'tenantId' | 'includedInNhsnReport' | 'nhsnSubmissionId'>
): Promise<ServiceResult<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('antimicrobial_resistance')
      .insert({
        tenant_id: tenantId,
        patient_id: resistance.patientId,
        encounter_id: resistance.encounterId,
        specimen_id: resistance.specimenId,
        specimen_type: resistance.specimenType,
        specimen_collection_date: resistance.specimenCollectionDate.toISOString(),
        specimen_source: resistance.specimenSource,
        organism_code: resistance.organismCode,
        organism_code_system: resistance.organismCodeSystem,
        organism_name: resistance.organismName,
        antimicrobial_tested: resistance.antimicrobialTested,
        antimicrobial_code: resistance.antimicrobialCode,
        interpretation: resistance.interpretation,
        mic_value: resistance.micValue,
        mic_unit: resistance.micUnit,
        is_mdro: resistance.isMdro,
        mdro_type: resistance.mdroType,
        lab_name: resistance.labName,
        lab_npi: resistance.labNpi,
        result_date: resistance.resultDate?.toISOString().split('T')[0],
        included_in_nhsn_report: false,
      })
      .select('id')
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('ANTIMICROBIAL_RESISTANCE_RECORDED', {
      tenantId,
      resistanceId: data.id,
      organismName: resistance.organismName,
      interpretation: resistance.interpretation,
      isMdro: resistance.isMdro,
    });

    return success({ id: data.id });
  } catch (err: unknown) {
    await auditLogger.error(
      'ANTIMICROBIAL_RESISTANCE_RECORD_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('OPERATION_FAILED', 'Failed to record resistance');
  }
}

/**
 * Create NHSN submission
 */
export async function createNHSNSubmission(
  tenantId: string,
  submissionType: 'AU' | 'AR',
  reportingPeriodStart: Date,
  reportingPeriodEnd: Date,
  facility: FacilityData
): Promise<ServiceResult<NHSNSubmission>> {
  try {
    let cdaDocument: string;
    let usageRecordCount = 0;
    let resistanceRecordCount = 0;

    if (submissionType === 'AU') {
      // Get usage records for period
      const { data: usageData, error: usageError } = await supabase
        .from('antimicrobial_usage')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('included_in_nhsn_report', false)
        .gte('prescribed_date', reportingPeriodStart.toISOString().split('T')[0])
        .lte('prescribed_date', reportingPeriodEnd.toISOString().split('T')[0]);

      if (usageError) {
        return failure('DATABASE_ERROR', usageError.message);
      }

      const usageRecords: AntimicrobialUsageRecord[] = ((usageData || []) as UsageRow[]).map((row: UsageRow) => ({
        id: row.id,
        tenantId: row.tenant_id,
        patientId: row.patient_id,
        encounterId: row.encounter_id,
        medicationCode: row.medication_code,
        medicationCodeSystem: row.medication_code_system,
        medicationName: row.medication_name,
        antimicrobialClass: row.antimicrobial_class,
        antimicrobialSubclass: row.antimicrobial_subclass,
        doseQuantity: row.dose_quantity,
        doseUnit: row.dose_unit,
        route: row.route,
        frequency: row.frequency,
        durationDays: row.duration_days,
        indicationCode: row.indication_code,
        indicationDescription: row.indication_description,
        prescriberNpi: row.prescriber_npi,
        prescribedDate: new Date(row.prescribed_date),
        startDate: row.start_date ? new Date(row.start_date) : undefined,
        endDate: row.end_date ? new Date(row.end_date) : undefined,
        therapyType: row.therapy_type as 'empiric' | 'targeted' | 'prophylaxis',
        includedInNhsnReport: false,
      }));

      usageRecordCount = usageRecords.length;
      cdaDocument = generateAUDocument({
        usageRecords,
        facility,
        reportingPeriodStart,
        reportingPeriodEnd,
      });
    } else {
      // Get resistance records for period
      const { data: resistanceData, error: resistanceError } = await supabase
        .from('antimicrobial_resistance')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('included_in_nhsn_report', false)
        .gte('specimen_collection_date', reportingPeriodStart.toISOString())
        .lte('specimen_collection_date', reportingPeriodEnd.toISOString());

      if (resistanceError) {
        return failure('DATABASE_ERROR', resistanceError.message);
      }

      const resistanceRecords: AntimicrobialResistanceRecord[] = ((resistanceData || []) as ResistanceRow[]).map((row: ResistanceRow) => ({
        id: row.id,
        tenantId: row.tenant_id,
        patientId: row.patient_id,
        encounterId: row.encounter_id,
        specimenId: row.specimen_id,
        specimenType: row.specimen_type,
        specimenCollectionDate: new Date(row.specimen_collection_date),
        specimenSource: row.specimen_source,
        organismCode: row.organism_code,
        organismCodeSystem: row.organism_code_system,
        organismName: row.organism_name,
        antimicrobialTested: row.antimicrobial_tested,
        antimicrobialCode: row.antimicrobial_code,
        interpretation: row.interpretation as 'S' | 'I' | 'R',
        micValue: row.mic_value,
        micUnit: row.mic_unit,
        isMdro: row.is_mdro,
        mdroType: row.mdro_type,
        labName: row.lab_name,
        labNpi: row.lab_npi,
        resultDate: row.result_date ? new Date(row.result_date) : undefined,
        includedInNhsnReport: false,
      }));

      resistanceRecordCount = resistanceRecords.length;
      cdaDocument = generateARDocument({
        resistanceRecords,
        facility,
        reportingPeriodStart,
        reportingPeriodEnd,
      });
    }

    // Save submission
    const { data, error } = await supabase
      .from('nhsn_submissions')
      .insert({
        tenant_id: tenantId,
        submission_type: submissionType,
        reporting_period_start: reportingPeriodStart.toISOString().split('T')[0],
        reporting_period_end: reportingPeriodEnd.toISOString().split('T')[0],
        facility_id: facility.id,
        nhsn_org_id: facility.nhsnOrgId,
        nhsn_facility_id: facility.nhsnFacilityId,
        document_type: 'CDA',
        cda_document: cdaDocument,
        usage_record_count: usageRecordCount,
        resistance_record_count: resistanceRecordCount,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('NHSN_SUBMISSION_CREATED', {
      tenantId,
      submissionId: data.id,
      submissionType,
      usageRecordCount,
      resistanceRecordCount,
    });

    return success({
      id: data.id,
      tenantId: data.tenant_id,
      submissionType,
      reportingPeriodStart,
      reportingPeriodEnd,
      facilityId: data.facility_id,
      nhsnOrgId: data.nhsn_org_id,
      nhsnFacilityId: data.nhsn_facility_id,
      documentType: 'CDA',
      cdaDocument,
      usageRecordCount,
      resistanceRecordCount,
      status: 'pending',
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'NHSN_SUBMISSION_CREATE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, submissionType }
    );
    return failure('OPERATION_FAILED', 'Failed to create NHSN submission');
  }
}

/**
 * Record NHSN submission result
 */
export async function recordSubmissionResult(
  submissionId: string,
  result: {
    success: boolean;
    nhsnSubmissionId?: string;
    responseStatus?: string;
    responseMessage?: string;
    errorMessage?: string;
  }
): Promise<ServiceResult<void>> {
  try {
    const status = result.success ? 'accepted' : 'rejected';

    const { error } = await supabase
      .from('nhsn_submissions')
      .update({
        status,
        submitted_at: new Date().toISOString(),
        nhsn_submission_id: result.nhsnSubmissionId,
        response_status: result.responseStatus,
        response_message: result.responseMessage,
        error_message: result.errorMessage,
      })
      .eq('id', submissionId);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    // Mark included records
    if (result.success) {
      const { data: submission } = await supabase
        .from('nhsn_submissions')
        .select('submission_type, reporting_period_start, reporting_period_end, tenant_id')
        .eq('id', submissionId)
        .single();

      if (submission) {
        const tableName = submission.submission_type === 'AU' ? 'antimicrobial_usage' : 'antimicrobial_resistance';
        const dateField = submission.submission_type === 'AU' ? 'prescribed_date' : 'specimen_collection_date';

        await supabase
          .from(tableName)
          .update({ included_in_nhsn_report: true, nhsn_submission_id: submissionId })
          .eq('tenant_id', submission.tenant_id)
          .gte(dateField, submission.reporting_period_start)
          .lte(dateField, submission.reporting_period_end);
      }
    }

    await auditLogger.info('NHSN_SUBMISSION_RESULT', {
      submissionId,
      status,
      nhsnSubmissionId: result.nhsnSubmissionId,
    });

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'NHSN_RECORD_RESULT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { submissionId }
    );
    return failure('OPERATION_FAILED', 'Failed to record submission result');
  }
}

/**
 * Get submission history
 */
export async function getSubmissionHistory(
  tenantId: string,
  options?: {
    submissionType?: 'AU' | 'AR';
    status?: string;
    limit?: number;
  }
): Promise<ServiceResult<NHSNSubmission[]>> {
  try {
    let query = supabase
      .from('nhsn_submissions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.submissionType) {
      query = query.eq('submission_type', options.submissionType);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const submissions: NHSNSubmission[] = ((data || []) as SubmissionRow[]).map((row: SubmissionRow) => ({
      id: row.id,
      tenantId: row.tenant_id,
      submissionType: row.submission_type as 'AU' | 'AR',
      reportingPeriodStart: new Date(row.reporting_period_start),
      reportingPeriodEnd: new Date(row.reporting_period_end),
      facilityId: row.facility_id,
      nhsnOrgId: row.nhsn_org_id,
      nhsnFacilityId: row.nhsn_facility_id,
      documentType: row.document_type,
      cdaDocument: row.cda_document,
      usageRecordCount: row.usage_record_count,
      resistanceRecordCount: row.resistance_record_count,
      status: row.status as NHSNSubmission['status'],
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
      submissionMethod: row.submission_method,
      nhsnSubmissionId: row.nhsn_submission_id,
      responseStatus: row.response_status,
      responseMessage: row.response_message,
      errorMessage: row.error_message,
    }));

    return success(submissions);
  } catch (err: unknown) {
    await auditLogger.error(
      'NHSN_GET_HISTORY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to get submission history');
  }
}

/**
 * Get MDRO types reference
 */
export function getMDROTypes(): Record<string, string> {
  return { ...MDRO_TYPES };
}

/**
 * Get antimicrobial classes reference
 */
export function getAntimicrobialClasses(): Record<string, string[]> {
  return { ...ANTIMICROBIAL_CLASSES };
}

// Export service
export const AntimicrobialSurveillanceService = {
  generateAUDocument,
  generateARDocument,
  classifyAntimicrobial,
  recordAntimicrobialUsage,
  recordResistance,
  createNHSNSubmission,
  recordSubmissionResult,
  getSubmissionHistory,
  getMDROTypes,
  getAntimicrobialClasses,
};

export default AntimicrobialSurveillanceService;
