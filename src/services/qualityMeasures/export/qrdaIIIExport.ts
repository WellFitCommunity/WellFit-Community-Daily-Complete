/**
 * QRDA Category III Export — Aggregate
 *
 * ONC Criteria: 170.315(c)(3)
 */

import { supabase } from '../../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../../_base';
import { auditLogger } from '../../auditLogger';
import type { QRDAExportOptions, QRDAExportResult, AggregateData } from './types';
import { generateUUID, formatHL7Date, formatHL7DateOnly, escapeXml, generateMeasureEntry } from './qrdaHelpers';

/**
 * Generate QRDA Category III (aggregate) document
 */
export async function exportQRDAIII(
  options: QRDAExportOptions
): Promise<ServiceResult<QRDAExportResult>> {
  const { tenantId, measureIds, reportingPeriodStart, reportingPeriodEnd } = options;

  try {
    const { data: aggregates, error: aggError } = await supabase
      .from('ecqm_aggregate_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('measure_id', measureIds)
      .eq('reporting_period_start', reportingPeriodStart.toISOString().split('T')[0]);

    if (aggError) {
      return failure('DATABASE_ERROR', aggError.message);
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, npi')
      .eq('id', tenantId)
      .single();

    const documentId = generateUUID();
    const xml = generateQRDAIIIDocument(
      aggregates || [],
      measureIds,
      reportingPeriodStart,
      reportingPeriodEnd,
      documentId,
      tenant
    );

    const patientCount = aggregates?.reduce((max: number, a: { patient_count?: number }) => Math.max(max, a.patient_count || 0), 0) || 0;

    const { data: exportRecord, error: exportError } = await supabase
      .from('ecqm_qrda_exports')
      .insert({
        tenant_id: tenantId,
        export_type: 'QRDA_III',
        measure_ids: measureIds,
        patient_count: patientCount,
        reporting_period_start: reportingPeriodStart,
        reporting_period_end: reportingPeriodEnd,
        validation_status: 'pending'
      })
      .select()
      .single();

    if (exportError) {
      return failure('DATABASE_ERROR', exportError.message);
    }

    await auditLogger.info('QRDA_III_EXPORT_CREATED', {
      tenantId,
      exportId: exportRecord.id,
      measureCount: measureIds.length,
      patientCount
    });

    return success({
      exportId: exportRecord.id,
      xml,
      measureIds,
      exportType: 'QRDA_III',
      patientCount,
      validationStatus: 'pending'
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'QRDA_III_EXPORT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, measureIds }
    );
    return failure('OPERATION_FAILED', 'Failed to generate QRDA III');
  }
}

/**
 * Generate QRDA Category III XML document
 */
function generateQRDAIIIDocument(
  aggregates: AggregateData[],
  measureIds: string[],
  periodStart: Date,
  periodEnd: Date,
  documentId: string,
  tenant: { name: string; npi?: string } | null
): string {
  const effectiveTime = formatHL7Date(new Date());
  const periodStartHL7 = formatHL7DateOnly(periodStart);
  const periodEndHL7 = formatHL7DateOnly(periodEnd);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:sdtc="urn:hl7-org:sdtc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <!-- QRDA Category III Report -->
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>

  <!-- QRDA Category III R2.1 template -->
  <templateId root="2.16.840.1.113883.10.20.27.1.1" extension="2017-06-01"/>
  <!-- CMS QRDA III template -->
  <templateId root="2.16.840.1.113883.10.20.27.1.2" extension="2020-12-01"/>

  <id root="${documentId}"/>
  <code code="55184-6" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Quality Reporting Document Architecture Calculated Summary Report"/>
  <title>QRDA Category III Aggregate Report</title>
  <effectiveTime value="${effectiveTime}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="en"/>

  <!-- Record Target (Aggregate - no individual patient) -->
  <recordTarget>
    <patientRole>
      <id nullFlavor="NA"/>
    </patientRole>
  </recordTarget>

  <!-- Author -->
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

  <!-- Legal Authenticator -->
  <legalAuthenticator>
    <time value="${effectiveTime}"/>
    <signatureCode code="S"/>
    <assignedEntity>
      <id root="2.16.840.1.113883.4.6" extension="${tenant?.npi || 'UNKNOWN'}"/>
      <representedOrganization>
        <name>${escapeXml(tenant?.name || 'Healthcare Organization')}</name>
      </representedOrganization>
    </assignedEntity>
  </legalAuthenticator>

  <!-- Reporting Period -->
  <documentationOf>
    <serviceEvent classCode="PCPR">
      <effectiveTime>
        <low value="${periodStartHL7}"/>
        <high value="${periodEndHL7}"/>
      </effectiveTime>
      <performer typeCode="PRF">
        <time>
          <low value="${periodStartHL7}"/>
          <high value="${periodEndHL7}"/>
        </time>
        <assignedEntity>
          <id root="2.16.840.1.113883.4.6" extension="${tenant?.npi || 'UNKNOWN'}"/>
          <representedOrganization>
            <name>${escapeXml(tenant?.name || 'Healthcare Organization')}</name>
          </representedOrganization>
        </assignedEntity>
      </performer>
    </serviceEvent>
  </documentationOf>

  <component>
    <structuredBody>
      <!-- Measure Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.27.2.1" extension="2017-06-01"/>
          <templateId root="2.16.840.1.113883.10.20.24.2.2"/>
          <code code="55186-1" codeSystem="2.16.840.1.113883.6.1"/>
          <title>Measure Section</title>
          <text>
            <table border="1">
              <thead>
                <tr>
                  <th>Measure</th>
                  <th>Initial Population</th>
                  <th>Denominator</th>
                  <th>Exclusions</th>
                  <th>Numerator</th>
                  <th>Performance Rate</th>
                </tr>
              </thead>
              <tbody>`;

  for (const measureId of measureIds) {
    const agg = aggregates.find(a => a.measure_id === measureId);
    xml += `
                <tr>
                  <td>${escapeXml(measureId)}</td>
                  <td>${agg?.initial_population_count || 0}</td>
                  <td>${agg?.denominator_count || 0}</td>
                  <td>${agg?.denominator_exclusion_count || 0}</td>
                  <td>${agg?.numerator_count || 0}</td>
                  <td>${agg?.performance_rate !== null && agg?.performance_rate !== undefined ? (agg.performance_rate * 100).toFixed(2) + '%' : 'N/A'}</td>
                </tr>`;
  }

  xml += `
              </tbody>
            </table>
          </text>`;

  for (const measureId of measureIds) {
    const agg = aggregates.find(a => a.measure_id === measureId);
    xml += generateMeasureEntry(measureId, agg);
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
