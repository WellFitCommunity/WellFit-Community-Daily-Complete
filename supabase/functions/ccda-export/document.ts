/**
 * C-CDA Export — top-level Continuity of Care Document assembler.
 *
 * Builds the CDA header (record target, author, custodian) and stitches
 * together the eight structured-body sections from sections.ts.
 */

import { CCDA_VERSION, type CCDAData, TEMPLATE_OID } from './types.ts';
import { escapeXml, formatHL7Date, formatHL7DateTime, mapGenderCode } from './helpers.ts';
import {
  generateAllergiesSection,
  generateImmunizationsSection,
  generateMedicationsSection,
  generatePlanOfCareSection,
  generateProblemsSection,
  generateProceduresSection,
  generateResultsSection,
  generateVitalSignsSection,
} from './sections.ts';

export function generateCCDA(data: CCDAData): string {
  const { profile, medications, allergies, conditions, procedures,
          immunizations, observations, labResults, carePlans, documentId, createdAt } = data;

  const patientId = profile?.user_id || 'unknown';
  const effectiveTime = formatHL7DateTime(createdAt);
  const dob = profile?.dob ? formatHL7Date(profile.dob) : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="CDA.xsl"?>
<ClinicalDocument xmlns="urn:hl7-org:v3"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:sdtc="urn:hl7-org:sdtc">

  <!-- ********************************************************
       CDA Header
       ******************************************************** -->
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>

  <!-- CCD Template -->
  <templateId root="${TEMPLATE_OID.CCD}" extension="2015-08-01"/>

  <id root="2.16.840.1.113883.19" extension="${escapeXml(documentId)}"/>
  <code code="34133-9" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Summarization of Episode Note"/>
  <title>Continuity of Care Document</title>
  <effectiveTime value="${effectiveTime}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="en-US"/>

  <!-- Record Target (Patient) -->
  <recordTarget>
    <patientRole>
      <id root="2.16.840.1.113883.19.5" extension="${escapeXml(patientId)}"/>
      ${profile?.address ? `<addr use="HP"><streetAddressLine>${escapeXml(profile.address)}</streetAddressLine></addr>` : '<addr nullFlavor="NI"/>'}
      ${profile?.phone ? `<telecom use="HP" value="tel:${escapeXml(profile.phone)}"/>` : ''}
      ${profile?.email ? `<telecom use="HP" value="mailto:${escapeXml(profile.email)}"/>` : ''}
      <patient>
        <name>
          ${profile?.first_name ? `<given>${escapeXml(profile.first_name)}</given>` : ''}
          ${profile?.last_name ? `<family>${escapeXml(profile.last_name)}</family>` : ''}
        </name>
        ${profile?.gender ? `<administrativeGenderCode code="${mapGenderCode(profile.gender)}" codeSystem="2.16.840.1.113883.5.1"/>` : ''}
        ${dob ? `<birthTime value="${dob}"/>` : '<birthTime nullFlavor="NI"/>'}
      </patient>
    </patientRole>
  </recordTarget>

  <!-- Author -->
  <author>
    <time value="${effectiveTime}"/>
    <assignedAuthor>
      <id root="2.16.840.1.113883.19" extension="wellfit-system"/>
      <assignedAuthoringDevice>
        <manufacturerModelName>WellFit Community Health Platform</manufacturerModelName>
        <softwareName>WellFit C-CDA Export v${CCDA_VERSION}</softwareName>
      </assignedAuthoringDevice>
      <representedOrganization>
        <name>WellFit Community</name>
      </representedOrganization>
    </assignedAuthor>
  </author>

  <!-- Custodian -->
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="2.16.840.1.113883.19" extension="wellfit"/>
        <name>WellFit Community</name>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>

  <!-- ********************************************************
       CDA Body - Structured Sections
       ******************************************************** -->
  <component>
    <structuredBody>

      <!-- Allergies Section -->
      ${generateAllergiesSection(allergies)}

      <!-- Medications Section -->
      ${generateMedicationsSection(medications)}

      <!-- Problems Section -->
      ${generateProblemsSection(conditions)}

      <!-- Procedures Section -->
      ${generateProceduresSection(procedures)}

      <!-- Immunizations Section -->
      ${generateImmunizationsSection(immunizations)}

      <!-- Vital Signs Section -->
      ${generateVitalSignsSection(observations)}

      <!-- Results Section -->
      ${generateResultsSection(labResults)}

      <!-- Plan of Care Section -->
      ${generatePlanOfCareSection(carePlans)}

    </structuredBody>
  </component>
</ClinicalDocument>`;
}
