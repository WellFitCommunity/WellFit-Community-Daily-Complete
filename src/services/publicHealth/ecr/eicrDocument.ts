/**
 * Electronic Case Reporting (eCR) — eICR CDA document generation
 *
 * Extracted from ecrService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — generator + section builders + formatters moved verbatim.
 */

import type {
  ReportableCondition,
  CaseReportTrigger,
  PatientData,
  EncounterData,
  FacilityData,
} from './types';
import { EICR_TEMPLATE_IDS, CODE_SYSTEMS, getCodeSystemOid } from './constants';
import {
  generateDocumentId,
  formatHL7DateTime,
  formatHL7Date,
  formatDisplayDate,
  escapeXml,
} from '../cda/formatters';

// Re-exported so callers that imported generateDocumentId from this module
// (e.g. ecr/operations.ts) keep working after the RF-7 dedup.
export { generateDocumentId };

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
// generateDocumentId / formatHL7DateTime / formatHL7Date / formatDisplayDate /
// escapeXml now live in ../cda/formatters (RF-7 dedup). generateSetId is
// eICR-specific and stays here.

function generateSetId(): string {
  return `2.16.840.1.113883.4.6.SET.${Date.now()}`;
}
