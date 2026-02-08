/**
 * QRDA Category I Export — Patient-Level
 *
 * ONC Criteria: 170.315(c)(2)
 */

import { supabase } from '../../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../../_base';
import { auditLogger } from '../../auditLogger';
import type { QRDAExportOptions, QRDAExportResult, PatientData, MeasureResult } from './types';
import { generateUUID, formatHL7Date, formatHL7DateOnly, escapeXml, generatePopulationComponents } from './qrdaHelpers';

/**
 * Generate QRDA Category I (patient-level) document
 */
export async function exportQRDAI(
  options: QRDAExportOptions & { patientId: string }
): Promise<ServiceResult<QRDAExportResult>> {
  const { tenantId, patientId, measureIds, reportingPeriodStart, reportingPeriodEnd } = options;

  try {
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, mrn, first_name, last_name, date_of_birth, gender, address_line1, city, state, postal_code')
      .eq('id', patientId)
      .eq('tenant_id', tenantId)
      .single();

    if (patientError || !patient) {
      return failure('NOT_FOUND', 'Patient not found');
    }

    const { data: results, error: resultsError } = await supabase
      .from('ecqm_patient_results')
      .select('measure_id, initial_population, denominator, denominator_exclusion, denominator_exception, numerator, numerator_exclusion')
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .in('measure_id', measureIds)
      .eq('reporting_period_start', reportingPeriodStart.toISOString().split('T')[0]);

    if (resultsError) {
      return failure('DATABASE_ERROR', resultsError.message);
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, npi')
      .eq('id', tenantId)
      .single();

    const documentId = generateUUID();
    const xml = generateQRDAIDocument(
      patient,
      results || [],
      measureIds,
      reportingPeriodStart,
      reportingPeriodEnd,
      documentId,
      tenant
    );

    const { data: exportRecord, error: exportError } = await supabase
      .from('ecqm_qrda_exports')
      .insert({
        tenant_id: tenantId,
        export_type: 'QRDA_I',
        measure_ids: measureIds,
        patient_id: patientId,
        reporting_period_start: reportingPeriodStart,
        reporting_period_end: reportingPeriodEnd,
        validation_status: 'pending'
      })
      .select()
      .single();

    if (exportError) {
      return failure('DATABASE_ERROR', exportError.message);
    }

    await auditLogger.info('QRDA_I_EXPORT_CREATED', {
      tenantId,
      patientId,
      exportId: exportRecord.id,
      measureCount: measureIds.length
    });

    return success({
      exportId: exportRecord.id,
      xml,
      measureIds,
      exportType: 'QRDA_I',
      validationStatus: 'pending'
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'QRDA_I_EXPORT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId, measureIds }
    );
    return failure('OPERATION_FAILED', 'Failed to generate QRDA I');
  }
}

/**
 * Generate QRDA Category I XML document
 */
function generateQRDAIDocument(
  patient: PatientData,
  results: MeasureResult[],
  measureIds: string[],
  periodStart: Date,
  periodEnd: Date,
  documentId: string,
  tenant: { name: string; npi?: string } | null
): string {
  const effectiveTime = formatHL7Date(new Date());
  const periodStartHL7 = formatHL7DateOnly(periodStart);
  const periodEndHL7 = formatHL7DateOnly(periodEnd);
  const birthDate = formatHL7DateOnly(patient.date_of_birth);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:sdtc="urn:hl7-org:sdtc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <!-- QRDA Category I Report -->
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>

  <!-- QRDA Category I R1 STU5.2 template -->
  <templateId root="2.16.840.1.113883.10.20.24.1.1" extension="2019-12-01"/>
  <!-- QDM-based QRDA template -->
  <templateId root="2.16.840.1.113883.10.20.24.1.2" extension="2019-12-01"/>

  <id root="${documentId}"/>
  <code code="55182-0" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Quality Measure Report"/>
  <title>QRDA Category I Patient Level Report</title>
  <effectiveTime value="${effectiveTime}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="en"/>

  <!-- Record Target (Patient) -->
  <recordTarget>
    <patientRole>
      <id root="2.16.840.1.113883.4.572" extension="${escapeXml(patient.mrn || patient.id)}"/>
      ${patient.address_line1 ? `
      <addr use="HP">
        <streetAddressLine>${escapeXml(patient.address_line1)}</streetAddressLine>
        ${patient.city ? `<city>${escapeXml(patient.city)}</city>` : ''}
        ${patient.state ? `<state>${escapeXml(patient.state)}</state>` : ''}
        ${patient.postal_code ? `<postalCode>${escapeXml(patient.postal_code)}</postalCode>` : ''}
        <country>US</country>
      </addr>` : ''}
      <patient>
        <name>
          <given>${escapeXml(patient.first_name)}</given>
          <family>${escapeXml(patient.last_name)}</family>
        </name>
        <administrativeGenderCode code="${patient.gender === 'male' || patient.gender === 'M' ? 'M' : 'F'}" codeSystem="2.16.840.1.113883.5.1"/>
        <birthTime value="${birthDate}"/>
      </patient>
    </patientRole>
  </recordTarget>

  <!-- Author (System) -->
  <author>
    <time value="${effectiveTime}"/>
    <assignedAuthor>
      <id root="2.16.840.1.113883.4.6" extension="${tenant?.npi || 'UNKNOWN'}"/>
      <assignedAuthoringDevice>
        <softwareName>Envision Atlus EHR</softwareName>
      </assignedAuthoringDevice>
      <representedOrganization>
        <name>${escapeXml(tenant?.name || 'Healthcare Organization')}</name>
      </representedOrganization>
    </assignedAuthor>
  </author>

  <!-- Custodian -->
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="2.16.840.1.113883.4.6" extension="${tenant?.npi || 'UNKNOWN'}"/>
        <name>${escapeXml(tenant?.name || 'Healthcare Organization')}</name>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>

  <!-- Reporting Period -->
  <documentationOf>
    <serviceEvent classCode="PCPR">
      <effectiveTime>
        <low value="${periodStartHL7}"/>
        <high value="${periodEndHL7}"/>
      </effectiveTime>
    </serviceEvent>
  </documentationOf>

  <!-- Structured Body -->
  <component>
    <structuredBody>
      <!-- Measure Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.24.2.2"/>
          <templateId root="2.16.840.1.113883.10.20.24.2.3"/>
          <code code="55186-1" codeSystem="2.16.840.1.113883.6.1"/>
          <title>Measure Section</title>
          <text>
            <table border="1">
              <thead>
                <tr>
                  <th>Measure</th>
                  <th>Initial Population</th>
                  <th>Denominator</th>
                  <th>Numerator</th>
                </tr>
              </thead>
              <tbody>`;

  for (const measureId of measureIds) {
    const result = results.find(r => r.measure_id === measureId);
    xml += `
                <tr>
                  <td>${escapeXml(measureId)}</td>
                  <td>${result?.initial_population ? 'Yes' : 'No'}</td>
                  <td>${result?.denominator ? 'Yes' : 'No'}</td>
                  <td>${result?.numerator ? 'Yes' : 'No'}</td>
                </tr>`;
  }

  xml += `
              </tbody>
            </table>
          </text>`;

  for (const measureId of measureIds) {
    const result = results.find(r => r.measure_id === measureId);
    xml += `
          <entry>
            <organizer classCode="CLUSTER" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.24.3.98"/>
              <templateId root="2.16.840.1.113883.10.20.27.3.1" extension="2016-09-01"/>
              <id root="${generateUUID()}"/>
              <statusCode code="completed"/>
              <reference typeCode="REFR">
                <externalDocument classCode="DOC" moodCode="EVN">
                  <id root="2.16.840.1.113883.4.738" extension="${escapeXml(measureId)}"/>
                  <text>${escapeXml(measureId)}</text>
                </externalDocument>
              </reference>
              ${result ? generatePopulationComponents(result) : ''}
            </organizer>
          </entry>`;
  }

  xml += `
        </section>
      </component>

      <!-- Reporting Parameters Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.17.2.1"/>
          <code code="55187-9" codeSystem="2.16.840.1.113883.6.1"/>
          <title>Reporting Parameters</title>
          <text>
            <list>
              <item>Reporting Period: ${periodStart.toISOString().split('T')[0]} - ${periodEnd.toISOString().split('T')[0]}</item>
            </list>
          </text>
          <entry typeCode="DRIV">
            <act classCode="ACT" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.17.3.8"/>
              <id root="${generateUUID()}"/>
              <code code="252116004" codeSystem="2.16.840.1.113883.6.96" displayName="Observation Parameters"/>
              <effectiveTime>
                <low value="${periodStartHL7}"/>
                <high value="${periodEndHL7}"/>
              </effectiveTime>
            </act>
          </entry>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>`;

  return xml;
}
