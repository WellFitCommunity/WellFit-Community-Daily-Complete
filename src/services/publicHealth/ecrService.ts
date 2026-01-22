/**
 * Electronic Case Reporting (eCR) Service
 *
 * ONC Criteria: 170.315(f)(3)
 * Purpose: Generate and submit eICR (electronic Initial Case Report) documents
 * to public health agencies via the AIMS (Association of Public Health Laboratories
 * Informatics Messaging Services) platform.
 *
 * Document Standard: HL7 CDA R2 (Clinical Document Architecture)
 * Profile: eICR R3.1 (HL7 Implementation Guide for CDA® R2: Public Health Case Report)
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';

// =====================================================
// TYPES
// =====================================================

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
    county?: string;
  };
  phone?: string;
}

// Database row interfaces
interface ReportableConditionRow {
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

interface CaseReportRow {
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

// =====================================================
// CONSTANTS
// =====================================================

// eICR Template IDs
const EICR_TEMPLATE_IDS = {
  document: '2.16.840.1.113883.10.20.15.2',
  documentVersion: '2017-04-01',
  patientSection: '2.16.840.1.113883.10.20.22.2.6.1',
  problemSection: '2.16.840.1.113883.10.20.22.2.5.1',
  resultsSection: '2.16.840.1.113883.10.20.22.2.3.1',
  socialHistorySection: '2.16.840.1.113883.10.20.22.2.17',
  encounterSection: '2.16.840.1.113883.10.20.22.2.22.1',
};

// AIMS Platform configuration
const AIMS_CONFIG = {
  name: 'AIMS',
  endpoint: 'https://aims.aphl.org/api/eicr', // Production endpoint
  testEndpoint: 'https://aims-staging.aphl.org/api/eicr',
};

// Code Systems
const CODE_SYSTEMS = {
  icd10: '2.16.840.1.113883.6.90',
  snomed: '2.16.840.1.113883.6.96',
  loinc: '2.16.840.1.113883.6.1',
  rxnorm: '2.16.840.1.113883.6.88',
  cpt: '2.16.840.1.113883.6.12',
};

// =====================================================
// eICR CDA DOCUMENT GENERATION
// =====================================================

/**
 * Generate eICR CDA document
 */
export function generateEICRDocument(options: {
  trigger: CaseReportTrigger;
  condition: ReportableCondition;
  patient: PatientData;
  encounter: EncounterData;
  facility: FacilityData;
  reportType?: 'initial' | 'update' | 'cancel';
}): string {
  const {
    trigger,
    condition,
    patient,
    encounter,
    facility,
    reportType = 'initial',
  } = options;

  const documentId = generateDocumentId();
  const effectiveTime = formatHL7DateTime(new Date());
  const setId = generateSetId();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="CDA.xsl"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:sdtc="urn:hl7-org:sdtc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <!-- ********************************************************
       CDA Header
       ******************************************************** -->
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>

  <!-- eICR R3.1 Template -->
  <templateId root="${EICR_TEMPLATE_IDS.document}" extension="${EICR_TEMPLATE_IDS.documentVersion}"/>

  <!-- Document ID -->
  <id root="${documentId}"/>

  <!-- Document Code: Public Health Case Report -->
  <code code="55751-2" codeSystem="${CODE_SYSTEMS.loinc}" codeSystemName="LOINC" displayName="Public Health Case Report"/>

  <!-- Document Title -->
  <title>Initial Public Health Case Report - ${condition.conditionName}</title>

  <!-- Effective Time -->
  <effectiveTime value="${effectiveTime}"/>

  <!-- Confidentiality Code -->
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25" displayName="Normal"/>

  <!-- Language -->
  <languageCode code="en-US"/>

  <!-- Set ID and Version -->
  <setId root="${setId}"/>
  <versionNumber value="${reportType === 'initial' ? '1' : '2'}"/>

  <!-- ********************************************************
       Record Target (Patient)
       ******************************************************** -->
  <recordTarget>
    <patientRole>
      <id extension="${patient.mrn}" root="2.16.840.1.113883.4.1"/>
      ${generatePatientAddress(patient)}
      ${generatePatientTelecom(patient)}
      <patient>
        <name>
          <given>${escapeXml(patient.firstName)}</given>
          ${patient.middleName ? `<given>${escapeXml(patient.middleName)}</given>` : ''}
          <family>${escapeXml(patient.lastName)}</family>
        </name>
        <administrativGenderCode code="${patient.gender}" codeSystem="2.16.840.1.113883.5.1"/>
        <birthTime value="${formatHL7Date(patient.dateOfBirth)}"/>
        ${patient.race ? `<raceCode code="${patient.race}" codeSystem="2.16.840.1.113883.6.238"/>` : ''}
        ${patient.ethnicity ? `<ethnicGroupCode code="${patient.ethnicity}" codeSystem="2.16.840.1.113883.6.238"/>` : ''}
        ${patient.preferredLanguage ? `
        <languageCommunication>
          <languageCode code="${patient.preferredLanguage}"/>
        </languageCommunication>` : ''}
      </patient>
    </patientRole>
  </recordTarget>

  <!-- ********************************************************
       Author (System)
       ******************************************************** -->
  <author>
    <time value="${effectiveTime}"/>
    <assignedAuthor>
      <id root="2.16.840.1.113883.4.6" extension="${facility.npi || 'UNKNOWN'}"/>
      <assignedAuthoringDevice>
        <manufacturerModelName>WellFit EHR</manufacturerModelName>
        <softwareName>WellFit Community eCR Module</softwareName>
      </assignedAuthoringDevice>
      <representedOrganization>
        <name>${escapeXml(facility.name)}</name>
      </representedOrganization>
    </assignedAuthor>
  </author>

  <!-- ********************************************************
       Custodian
       ******************************************************** -->
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="${facility.oid || '2.16.840.1.113883.4.6'}" extension="${facility.npi || ''}"/>
        <name>${escapeXml(facility.name)}</name>
        ${generateFacilityAddress(facility)}
        ${facility.phone ? `<telecom value="tel:${facility.phone}" use="WP"/>` : ''}
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>

  <!-- ********************************************************
       Component (Body)
       ******************************************************** -->
  <component>
    <structuredBody>
      <!-- Encounters Section -->
      ${generateEncountersSection(encounter)}

      <!-- Reason for Visit / Chief Complaint -->
      ${generateReasonForVisitSection(trigger, condition)}

      <!-- Problems Section -->
      ${generateProblemsSection(encounter.diagnoses)}

      <!-- Results Section -->
      ${encounter.labResults ? generateResultsSection(encounter.labResults) : ''}

      <!-- Medications Section -->
      ${encounter.medications ? generateMedicationsSection(encounter.medications) : ''}

      <!-- Social History Section -->
      ${generateSocialHistorySection(patient)}

      <!-- Plan of Treatment Section -->
      ${generatePlanOfTreatmentSection()}

      <!-- Reportability Response Information Section (placeholder) -->
      ${generateReportabilityResponseSection()}
    </structuredBody>
  </component>
</ClinicalDocument>`;

  return xml;
}

/**
 * Generate patient address element
 */
function generatePatientAddress(patient: PatientData): string {
  if (!patient.address) return '';
  return `
      <addr use="H">
        <streetAddressLine>${escapeXml(patient.address.street)}</streetAddressLine>
        <city>${escapeXml(patient.address.city)}</city>
        <state>${patient.address.state}</state>
        <postalCode>${patient.address.zipCode}</postalCode>
        <country>US</country>
        ${patient.address.county ? `<county>${escapeXml(patient.address.county)}</county>` : ''}
      </addr>`;
}

/**
 * Generate patient telecom element
 */
function generatePatientTelecom(patient: PatientData): string {
  let telecom = '';
  if (patient.phone) {
    telecom += `\n      <telecom value="tel:${patient.phone}" use="HP"/>`;
  }
  if (patient.email) {
    telecom += `\n      <telecom value="mailto:${patient.email}"/>`;
  }
  return telecom;
}

/**
 * Generate facility address element
 */
function generateFacilityAddress(facility: FacilityData): string {
  if (!facility.address) return '';
  return `
        <addr>
          <streetAddressLine>${escapeXml(facility.address.street)}</streetAddressLine>
          <city>${escapeXml(facility.address.city)}</city>
          <state>${facility.address.state}</state>
          <postalCode>${facility.address.zipCode}</postalCode>
          <country>US</country>
        </addr>`;
}

/**
 * Generate Encounters Section
 */
function generateEncountersSection(encounter: EncounterData): string {
  return `
      <!-- Encounters Section -->
      <component>
        <section>
          <templateId root="${EICR_TEMPLATE_IDS.encounterSection}"/>
          <code code="46240-8" codeSystem="${CODE_SYSTEMS.loinc}" displayName="History of Encounters"/>
          <title>Encounters</title>
          <text>
            <table>
              <thead>
                <tr><th>Date</th><th>Type</th><th>Facility</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>${formatDisplayDate(encounter.encounterDate)}</td>
                  <td>${escapeXml(encounter.encounterType)}</td>
                  <td>${escapeXml(encounter.facilityName)}</td>
                </tr>
              </tbody>
            </table>
          </text>
          <entry typeCode="DRIV">
            <encounter classCode="ENC" moodCode="EVN">
              <id root="${generateDocumentId()}"/>
              <effectiveTime value="${formatHL7DateTime(encounter.encounterDate)}"/>
              ${encounter.responsibleProvider ? `
              <performer>
                <assignedEntity>
                  <id root="2.16.840.1.113883.4.6" extension="${encounter.responsibleProvider.npi}"/>
                  <assignedPerson>
                    <name>${escapeXml(encounter.responsibleProvider.name)}</name>
                  </assignedPerson>
                </assignedEntity>
              </performer>` : ''}
            </encounter>
          </entry>
        </section>
      </component>`;
}

/**
 * Generate Reason for Visit Section
 */
function generateReasonForVisitSection(trigger: CaseReportTrigger, condition: ReportableCondition): string {
  return `
      <!-- Reason for Visit Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.12"/>
          <code code="29299-5" codeSystem="${CODE_SYSTEMS.loinc}" displayName="Reason for Visit"/>
          <title>Reason for Visit / Chief Complaint</title>
          <text>
            <paragraph>
              <content styleCode="Bold">Reportable Condition:</content> ${escapeXml(condition.conditionName)}
            </paragraph>
            <paragraph>
              <content styleCode="Bold">Trigger:</content> ${escapeXml(trigger.description)}
            </paragraph>
          </text>
          <entry>
            <observation classCode="OBS" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.15.2.3.3"/>
              <code code="RR4" codeSystem="2.16.840.1.114222.4.5.232" displayName="Reportability Trigger"/>
              <value xsi:type="CD" code="${trigger.code}" codeSystem="${getCodeSystemOid(trigger.codeSystem)}" displayName="${escapeXml(trigger.description)}"/>
            </observation>
          </entry>
        </section>
      </component>`;
}

/**
 * Generate Problems Section
 */
function generateProblemsSection(diagnoses: EncounterData['diagnoses']): string {
  const problemsText = diagnoses.map(d =>
    `<tr><td>${d.code}</td><td>${escapeXml(d.description)}</td><td>${formatDisplayDate(d.diagnosisDate)}</td></tr>`
  ).join('\n                ');

  const problemEntries = diagnoses.map(d => `
          <entry typeCode="DRIV">
            <act classCode="ACT" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.3"/>
              <id root="${generateDocumentId()}"/>
              <code code="CONC" codeSystem="2.16.840.1.113883.5.6"/>
              <statusCode code="active"/>
              <effectiveTime><low value="${formatHL7Date(d.diagnosisDate.toISOString())}"/></effectiveTime>
              <entryRelationship typeCode="SUBJ">
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.22.4.4"/>
                  <code code="55607006" codeSystem="${CODE_SYSTEMS.snomed}" displayName="Problem"/>
                  <statusCode code="completed"/>
                  <effectiveTime><low value="${formatHL7Date(d.diagnosisDate.toISOString())}"/></effectiveTime>
                  <value xsi:type="CD" code="${d.code}" codeSystem="${getCodeSystemOid(d.codeSystem)}" displayName="${escapeXml(d.description)}"/>
                </observation>
              </entryRelationship>
            </act>
          </entry>`).join('');

  return `
      <!-- Problems Section -->
      <component>
        <section>
          <templateId root="${EICR_TEMPLATE_IDS.problemSection}"/>
          <code code="11450-4" codeSystem="${CODE_SYSTEMS.loinc}" displayName="Problem List"/>
          <title>Problems / Diagnoses</title>
          <text>
            <table>
              <thead>
                <tr><th>Code</th><th>Description</th><th>Date</th></tr>
              </thead>
              <tbody>
                ${problemsText}
              </tbody>
            </table>
          </text>${problemEntries}
        </section>
      </component>`;
}

/**
 * Generate Results Section
 */
function generateResultsSection(labResults: EncounterData['labResults']): string {
  if (!labResults || labResults.length === 0) return '';

  const resultsText = labResults.map(r =>
    `<tr><td>${r.code}</td><td>${escapeXml(r.description)}</td><td>${escapeXml(r.value)} ${r.unit || ''}</td><td>${r.interpretation || ''}</td><td>${formatDisplayDate(r.resultDate)}</td></tr>`
  ).join('\n                ');

  return `
      <!-- Results Section -->
      <component>
        <section>
          <templateId root="${EICR_TEMPLATE_IDS.resultsSection}"/>
          <code code="30954-2" codeSystem="${CODE_SYSTEMS.loinc}" displayName="Relevant Diagnostic Tests"/>
          <title>Lab Results</title>
          <text>
            <table>
              <thead>
                <tr><th>Code</th><th>Test</th><th>Value</th><th>Interpretation</th><th>Date</th></tr>
              </thead>
              <tbody>
                ${resultsText}
              </tbody>
            </table>
          </text>
        </section>
      </component>`;
}

/**
 * Generate Medications Section
 */
function generateMedicationsSection(medications: EncounterData['medications']): string {
  if (!medications || medications.length === 0) return '';

  const medsText = medications.map(m =>
    `<tr><td>${m.code}</td><td>${escapeXml(m.name)}</td><td>${formatDisplayDate(m.startDate)}</td></tr>`
  ).join('\n                ');

  return `
      <!-- Medications Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.1.1"/>
          <code code="10160-0" codeSystem="${CODE_SYSTEMS.loinc}" displayName="History of Medication Use"/>
          <title>Medications</title>
          <text>
            <table>
              <thead>
                <tr><th>Code</th><th>Medication</th><th>Start Date</th></tr>
              </thead>
              <tbody>
                ${medsText}
              </tbody>
            </table>
          </text>
        </section>
      </component>`;
}

/**
 * Generate Social History Section
 */
function generateSocialHistorySection(patient: PatientData): string {
  return `
      <!-- Social History Section -->
      <component>
        <section>
          <templateId root="${EICR_TEMPLATE_IDS.socialHistorySection}"/>
          <code code="29762-2" codeSystem="${CODE_SYSTEMS.loinc}" displayName="Social History"/>
          <title>Social History</title>
          <text>
            ${patient.occupation ? `<paragraph><content styleCode="Bold">Occupation:</content> ${escapeXml(patient.occupation)}</paragraph>` : ''}
            ${patient.employer ? `<paragraph><content styleCode="Bold">Employer:</content> ${escapeXml(patient.employer)}</paragraph>` : ''}
          </text>
        </section>
      </component>`;
}

/**
 * Generate Plan of Treatment Section
 */
function generatePlanOfTreatmentSection(): string {
  return `
      <!-- Plan of Treatment Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.10"/>
          <code code="18776-5" codeSystem="${CODE_SYSTEMS.loinc}" displayName="Plan of Treatment"/>
          <title>Plan of Treatment</title>
          <text>
            <paragraph>Case report submitted to public health authorities for review and follow-up.</paragraph>
          </text>
        </section>
      </component>`;
}

/**
 * Generate Reportability Response Section (placeholder for RR)
 */
function generateReportabilityResponseSection(): string {
  return `
      <!-- Reportability Response Information Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.15.2.2.4"/>
          <code code="88085-6" codeSystem="${CODE_SYSTEMS.loinc}" displayName="Reportability Response Information Section"/>
          <title>Reportability Response Information</title>
          <text>
            <paragraph>Awaiting reportability response from public health authorities.</paragraph>
          </text>
        </section>
      </component>`;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function generateDocumentId(): string {
  return `2.16.840.1.113883.4.6.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
}

function generateSetId(): string {
  return `2.16.840.1.113883.4.6.SET.${Date.now()}`;
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

function getCodeSystemOid(codeSystem: string): string {
  const systems: Record<string, string> = {
    'ICD10': CODE_SYSTEMS.icd10,
    'ICD-10': CODE_SYSTEMS.icd10,
    'ICD10-CM': CODE_SYSTEMS.icd10,
    'SNOMED': CODE_SYSTEMS.snomed,
    'SNOMED-CT': CODE_SYSTEMS.snomed,
    'LOINC': CODE_SYSTEMS.loinc,
    'RXNORM': CODE_SYSTEMS.rxnorm,
    'CPT': CODE_SYSTEMS.cpt,
  };
  return systems[codeSystem.toUpperCase()] || CODE_SYSTEMS.snomed;
}

// =====================================================
// SERVICE FUNCTIONS
// =====================================================

/**
 * Get all active reportable conditions
 */
export async function getReportableConditions(
  jurisdiction?: string
): Promise<ServiceResult<ReportableCondition[]>> {
  try {
    let query = supabase
      .from('reportable_conditions')
      .select('*')
      .eq('is_active', true);

    if (jurisdiction) {
      query = query.contains('reporting_jurisdiction', [jurisdiction]);
    }

    const { data, error } = await query.order('condition_name');

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const conditions: ReportableCondition[] = ((data || []) as ReportableConditionRow[]).map((row: ReportableConditionRow) => ({
      id: row.id,
      conditionCode: row.condition_code,
      conditionCodeSystem: row.condition_code_system,
      conditionName: row.condition_name,
      rckmsOid: row.rckms_oid,
      reportingJurisdiction: row.reporting_jurisdiction,
      reportingTimeframe: row.reporting_timeframe,
      isNationallyNotifiable: row.is_nationally_notifiable,
      conditionCategory: row.condition_category,
      triggerCodes: row.trigger_codes,
    }));

    return success(conditions);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECR_GET_CONDITIONS_FAILED',
      err instanceof Error ? err : new Error(String(err))
    );
    return failure('FETCH_FAILED', 'Failed to get reportable conditions');
  }
}

/**
 * Detect if a diagnosis code triggers a reportable condition
 */
export async function detectReportableCondition(
  diagnosisCode: string,
  jurisdiction = 'TX'
): Promise<ServiceResult<ReportableCondition | null>> {
  try {
    const { data, error } = await supabase
      .from('reportable_conditions')
      .select('*')
      .eq('is_active', true)
      .contains('trigger_codes', [diagnosisCode])
      .contains('reporting_jurisdiction', [jurisdiction]);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    if (!data || data.length === 0) {
      return success(null);
    }

    const row = data[0] as ReportableConditionRow;
    return success({
      id: row.id,
      conditionCode: row.condition_code,
      conditionCodeSystem: row.condition_code_system,
      conditionName: row.condition_name,
      rckmsOid: row.rckms_oid,
      reportingJurisdiction: row.reporting_jurisdiction,
      reportingTimeframe: row.reporting_timeframe,
      isNationallyNotifiable: row.is_nationally_notifiable,
      conditionCategory: row.condition_category,
      triggerCodes: row.trigger_codes,
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'ECR_DETECT_CONDITION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { diagnosisCode }
    );
    return failure('OPERATION_FAILED', 'Failed to detect reportable condition');
  }
}

/**
 * Create and save an electronic case report
 */
export async function createCaseReport(
  tenantId: string,
  trigger: CaseReportTrigger,
  condition: ReportableCondition,
  patient: PatientData,
  encounter: EncounterData,
  facility: FacilityData
): Promise<ServiceResult<ElectronicCaseReport>> {
  try {
    // Generate eICR document
    const eicrDocument = generateEICRDocument({
      trigger,
      condition,
      patient,
      encounter,
      facility,
    });

    const eicrDocumentId = generateDocumentId();

    // Save case report
    const { data, error } = await supabase
      .from('electronic_case_reports')
      .insert({
        tenant_id: tenantId,
        patient_id: patient.patientId,
        trigger_encounter_id: trigger.encounterId,
        trigger_condition_id: condition.id,
        trigger_type: trigger.type,
        trigger_code: trigger.code,
        trigger_description: trigger.description,
        trigger_date: trigger.triggerDate.toISOString(),
        report_type: 'initial',
        eicr_document_id: eicrDocumentId,
        eicr_version: '3.1',
        eicr_document: eicrDocument,
        destination: AIMS_CONFIG.name,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('ECR_CASE_REPORT_CREATED', {
      tenantId,
      reportId: data.id,
      conditionName: condition.conditionName,
      patientId: patient.patientId,
    });

    return success({
      id: data.id,
      tenantId: data.tenant_id,
      patientId: data.patient_id,
      triggerEncounterId: data.trigger_encounter_id,
      triggerConditionId: data.trigger_condition_id,
      triggerType: data.trigger_type,
      triggerCode: data.trigger_code,
      triggerDescription: data.trigger_description,
      triggerDate: new Date(data.trigger_date),
      reportType: 'initial',
      eicrDocumentId: data.eicr_document_id,
      eicrVersion: data.eicr_version,
      eicrDocument: data.eicr_document,
      destination: data.destination,
      status: 'pending',
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'ECR_CREATE_REPORT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId: patient.patientId }
    );
    return failure('OPERATION_FAILED', 'Failed to create case report');
  }
}

/**
 * Record AIMS submission result
 */
export async function recordSubmissionResult(
  reportId: string,
  result: {
    success: boolean;
    aimsTransactionId?: string;
    errorCode?: string;
    errorMessage?: string;
  }
): Promise<ServiceResult<void>> {
  try {
    const status = result.success ? 'submitted' : 'rejected';

    const { error } = await supabase
      .from('electronic_case_reports')
      .update({
        status,
        submitted_at: new Date().toISOString(),
        aims_transaction_id: result.aimsTransactionId,
        error_code: result.errorCode,
        error_message: result.errorMessage,
      })
      .eq('id', reportId);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('ECR_SUBMISSION_RESULT', {
      reportId,
      status,
      aimsTransactionId: result.aimsTransactionId,
    });

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECR_RECORD_RESULT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { reportId }
    );
    return failure('OPERATION_FAILED', 'Failed to record submission result');
  }
}

/**
 * Record Reportability Response (RR)
 */
export async function recordReportabilityResponse(
  reportId: string,
  response: {
    rrDocument: string;
    determination: string;
    routingEntities: string[];
  }
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('electronic_case_reports')
      .update({
        status: 'rr_received',
        rr_received_at: new Date().toISOString(),
        rr_document: response.rrDocument,
        rr_determination: response.determination,
        rr_routing_entities: response.routingEntities,
      })
      .eq('id', reportId);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('ECR_RR_RECEIVED', {
      reportId,
      determination: response.determination,
      routingEntities: response.routingEntities,
    });

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECR_RECORD_RR_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { reportId }
    );
    return failure('OPERATION_FAILED', 'Failed to record reportability response');
  }
}

/**
 * Get pending case reports
 */
export async function getPendingReports(
  tenantId: string,
  limit = 100
): Promise<ServiceResult<ElectronicCaseReport[]>> {
  try {
    const { data, error } = await supabase
      .from('electronic_case_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const reports: ElectronicCaseReport[] = ((data || []) as CaseReportRow[]).map((row: CaseReportRow) => ({
      id: row.id,
      tenantId: row.tenant_id,
      patientId: row.patient_id,
      triggerEncounterId: row.trigger_encounter_id,
      triggerConditionId: row.trigger_condition_id,
      triggerType: row.trigger_type,
      triggerCode: row.trigger_code,
      triggerDescription: row.trigger_description,
      triggerDate: new Date(row.trigger_date),
      reportType: row.report_type as 'initial' | 'update' | 'cancel',
      eicrDocumentId: row.eicr_document_id,
      eicrVersion: row.eicr_version,
      eicrDocument: row.eicr_document,
      destination: row.destination,
      aimsTransactionId: row.aims_transaction_id,
      status: row.status as ElectronicCaseReport['status'],
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
      errorMessage: row.error_message,
    }));

    return success(reports);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECR_GET_PENDING_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to get pending reports');
  }
}

/**
 * Get case report history
 */
export async function getCaseReportHistory(
  tenantId: string,
  options?: {
    patientId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<ServiceResult<ElectronicCaseReport[]>> {
  try {
    let query = supabase
      .from('electronic_case_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.patientId) {
      query = query.eq('patient_id', options.patientId);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.startDate) {
      query = query.gte('trigger_date', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('trigger_date', options.endDate.toISOString());
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const reports: ElectronicCaseReport[] = ((data || []) as CaseReportRow[]).map((row: CaseReportRow) => ({
      id: row.id,
      tenantId: row.tenant_id,
      patientId: row.patient_id,
      triggerEncounterId: row.trigger_encounter_id,
      triggerConditionId: row.trigger_condition_id,
      triggerType: row.trigger_type,
      triggerCode: row.trigger_code,
      triggerDescription: row.trigger_description,
      triggerDate: new Date(row.trigger_date),
      reportType: row.report_type as 'initial' | 'update' | 'cancel',
      eicrDocumentId: row.eicr_document_id,
      eicrVersion: row.eicr_version,
      eicrDocument: row.eicr_document,
      destination: row.destination,
      aimsTransactionId: row.aims_transaction_id,
      status: row.status as ElectronicCaseReport['status'],
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
      rrReceivedAt: row.rr_received_at ? new Date(row.rr_received_at) : undefined,
      rrDocument: row.rr_document,
      rrDetermination: row.rr_determination,
      rrRoutingEntities: row.rr_routing_entities,
      errorMessage: row.error_message,
    }));

    return success(reports);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECR_GET_HISTORY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to get case report history');
  }
}

// Export service
export const ECRService = {
  generateEICRDocument,
  getReportableConditions,
  detectReportableCondition,
  createCaseReport,
  recordSubmissionResult,
  recordReportabilityResponse,
  getPendingReports,
  getCaseReportHistory,
};

export default ECRService;
