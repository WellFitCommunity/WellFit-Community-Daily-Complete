/**
 * Antimicrobial Surveillance — NHSN CDA document generation
 *
 * Extracted from antimicrobialSurveillanceService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — generators + formatter helpers moved verbatim.
 */

import type {
  AntimicrobialUsageRecord,
  AntimicrobialResistanceRecord,
  FacilityData,
} from './types';
import { CODE_SYSTEMS, MDRO_TYPES } from './constants';

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
