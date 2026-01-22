/**
 * QRDA Export Service
 *
 * ONC Criteria: 170.315(c)(2), (c)(3)
 * Purpose: Generate QRDA Category I and Category III documents for CMS submission
 *
 * QRDA I = Patient-level quality reporting data
 * QRDA III = Aggregate quality reporting data
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';

// =====================================================
// TYPES
// =====================================================

export interface QRDAExportOptions {
  tenantId: string;
  measureIds: string[];
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  exportType: 'QRDA_I' | 'QRDA_III';
  patientId?: string; // Required for QRDA I
}

export interface QRDAExportResult {
  exportId: string;
  xml: string;
  measureIds: string[];
  exportType: 'QRDA_I' | 'QRDA_III';
  patientCount?: number;
  validationStatus: 'pending' | 'valid' | 'invalid';
  validationErrors?: string[];
}

interface PatientData {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  address_line1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
}

interface MeasureResult {
  measure_id: string;
  initial_population: boolean;
  denominator: boolean;
  denominator_exclusion: boolean;
  denominator_exception: boolean;
  numerator: boolean;
  numerator_exclusion: boolean;
}

interface AggregateData {
  measure_id: string;
  initial_population_count: number;
  denominator_count: number;
  denominator_exclusion_count: number;
  denominator_exception_count: number;
  numerator_count: number;
  performance_rate: number | null;
}

interface ExportHistoryRow {
  id: string;
  export_type: string;
  measure_ids: string[];
  created_at: string;
  validation_status: string;
  patient_count: number;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatHL7Date(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0];
}

function formatHL7DateOnly(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0].replace(/-/g, '');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// =====================================================
// QRDA CATEGORY I EXPORT
// =====================================================

/**
 * Generate QRDA Category I (patient-level) document
 */
export async function exportQRDAI(
  options: QRDAExportOptions & { patientId: string }
): Promise<ServiceResult<QRDAExportResult>> {
  const { tenantId, patientId, measureIds, reportingPeriodStart, reportingPeriodEnd } = options;

  try {
    // Get patient data
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, mrn, first_name, last_name, date_of_birth, gender, address_line1, city, state, postal_code')
      .eq('id', patientId)
      .eq('tenant_id', tenantId)
      .single();

    if (patientError || !patient) {
      return failure('NOT_FOUND', 'Patient not found');
    }

    // Get measure results
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

    // Get tenant info for author
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, npi')
      .eq('id', tenantId)
      .single();

    // Generate QRDA I XML
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

    // Save export record
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

  // Add measure entries
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

  // Add measure reference entries
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

/**
 * Generate population component entries for a measure result
 */
function generatePopulationComponents(result: MeasureResult): string {
  let components = '';

  // Initial Population
  components += `
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.5" extension="2016-09-01"/>
                  <code code="IPOP" codeSystem="2.16.840.1.113883.5.4" displayName="Initial Population"/>
                  <value xsi:type="CD" code="${result.initial_population ? '1' : '0'}" codeSystem="2.16.840.1.113883.5.1063"/>
                </observation>
              </component>`;

  // Denominator
  components += `
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.5" extension="2016-09-01"/>
                  <code code="DENOM" codeSystem="2.16.840.1.113883.5.4" displayName="Denominator"/>
                  <value xsi:type="CD" code="${result.denominator ? '1' : '0'}" codeSystem="2.16.840.1.113883.5.1063"/>
                </observation>
              </component>`;

  // Numerator
  components += `
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.5" extension="2016-09-01"/>
                  <code code="NUMER" codeSystem="2.16.840.1.113883.5.4" displayName="Numerator"/>
                  <value xsi:type="CD" code="${result.numerator ? '1' : '0'}" codeSystem="2.16.840.1.113883.5.1063"/>
                </observation>
              </component>`;

  return components;
}

// =====================================================
// QRDA CATEGORY III EXPORT
// =====================================================

/**
 * Generate QRDA Category III (aggregate) document
 */
export async function exportQRDAIII(
  options: QRDAExportOptions
): Promise<ServiceResult<QRDAExportResult>> {
  const { tenantId, measureIds, reportingPeriodStart, reportingPeriodEnd } = options;

  try {
    // Get aggregate results
    const { data: aggregates, error: aggError } = await supabase
      .from('ecqm_aggregate_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('measure_id', measureIds)
      .eq('reporting_period_start', reportingPeriodStart.toISOString().split('T')[0]);

    if (aggError) {
      return failure('DATABASE_ERROR', aggError.message);
    }

    // Get tenant info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, npi')
      .eq('id', tenantId)
      .single();

    // Generate QRDA III XML
    const documentId = generateUUID();
    const xml = generateQRDAIIIDocument(
      aggregates || [],
      measureIds,
      reportingPeriodStart,
      reportingPeriodEnd,
      documentId,
      tenant
    );

    // Calculate total patient count
    const patientCount = aggregates?.reduce((max: number, a: { patient_count?: number }) => Math.max(max, a.patient_count || 0), 0) || 0;

    // Save export record
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

  // Add summary table
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

  // Add measure entries
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

/**
 * Generate measure entry for QRDA III
 */
function generateMeasureEntry(measureId: string, agg: AggregateData | undefined): string {
  return `
          <entry>
            <organizer classCode="CLUSTER" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.27.3.1" extension="2016-09-01"/>
              <id root="${generateUUID()}"/>
              <statusCode code="completed"/>
              <reference typeCode="REFR">
                <externalDocument classCode="DOC" moodCode="EVN">
                  <id root="2.16.840.1.113883.4.738" extension="${escapeXml(measureId)}"/>
                </externalDocument>
              </reference>

              <!-- Initial Population -->
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.5" extension="2016-09-01"/>
                  <code code="IPOP" codeSystem="2.16.840.1.113883.5.4" displayName="Initial Population"/>
                  <statusCode code="completed"/>
                  <value xsi:type="INT" value="${agg?.initial_population_count || 0}"/>
                </observation>
              </component>

              <!-- Denominator -->
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.5" extension="2016-09-01"/>
                  <code code="DENOM" codeSystem="2.16.840.1.113883.5.4" displayName="Denominator"/>
                  <statusCode code="completed"/>
                  <value xsi:type="INT" value="${agg?.denominator_count || 0}"/>
                </observation>
              </component>

              <!-- Denominator Exclusion -->
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.5" extension="2016-09-01"/>
                  <code code="DENEX" codeSystem="2.16.840.1.113883.5.4" displayName="Denominator Exclusion"/>
                  <statusCode code="completed"/>
                  <value xsi:type="INT" value="${agg?.denominator_exclusion_count || 0}"/>
                </observation>
              </component>

              <!-- Numerator -->
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.5" extension="2016-09-01"/>
                  <code code="NUMER" codeSystem="2.16.840.1.113883.5.4" displayName="Numerator"/>
                  <statusCode code="completed"/>
                  <value xsi:type="INT" value="${agg?.numerator_count || 0}"/>
                </observation>
              </component>

              <!-- Performance Rate -->
              ${agg?.performance_rate !== null ? `
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.14" extension="2016-09-01"/>
                  <code code="72510-1" codeSystem="2.16.840.1.113883.6.1" displayName="Performance Rate"/>
                  <statusCode code="completed"/>
                  <value xsi:type="REAL" value="${agg?.performance_rate ?? 0}"/>
                </observation>
              </component>` : ''}
            </organizer>
          </entry>`;
}

// =====================================================
// VALIDATION
// =====================================================

/**
 * Validate QRDA document (basic validation)
 */
export async function validateQRDADocument(
  exportId: string
): Promise<ServiceResult<{ valid: boolean; errors: string[] }>> {
  try {
    const { data: exportRecord, error } = await supabase
      .from('ecqm_qrda_exports')
      .select('*')
      .eq('id', exportId)
      .single();

    if (error || !exportRecord) {
      return failure('NOT_FOUND', 'Export record not found');
    }

    const errors: string[] = [];

    // Basic validation checks
    if (!exportRecord.measure_ids || exportRecord.measure_ids.length === 0) {
      errors.push('No measures specified in export');
    }

    if (!exportRecord.reporting_period_start || !exportRecord.reporting_period_end) {
      errors.push('Missing reporting period dates');
    }

    if (exportRecord.export_type === 'QRDA_I' && !exportRecord.patient_id) {
      errors.push('QRDA I export requires a patient ID');
    }

    // Update validation status
    const validationStatus = errors.length === 0 ? 'valid' : 'invalid';
    await supabase
      .from('ecqm_qrda_exports')
      .update({
        validation_status: validationStatus,
        validation_errors: errors,
        validated_at: new Date().toISOString()
      })
      .eq('id', exportId);

    return success({ valid: errors.length === 0, errors });
  } catch (err: unknown) {
    await auditLogger.error(
      'QRDA_VALIDATION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { exportId }
    );
    return failure('VALIDATION_ERROR', 'Failed to validate QRDA document');
  }
}

/**
 * Get export history for a tenant
 */
export async function getExportHistory(
  tenantId: string,
  limit: number = 50
): Promise<ServiceResult<Array<{
  id: string;
  exportType: string;
  measureIds: string[];
  createdAt: string;
  validationStatus: string;
  patientCount?: number;
}>>> {
  try {
    const { data, error } = await supabase
      .from('ecqm_qrda_exports')
      .select('id, export_type, measure_ids, created_at, validation_status, patient_count')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    return success(
      ((data || []) as ExportHistoryRow[]).map((d: ExportHistoryRow) => ({
        id: d.id,
        exportType: d.export_type,
        measureIds: d.measure_ids,
        createdAt: d.created_at,
        validationStatus: d.validation_status,
        patientCount: d.patient_count
      }))
    );
  } catch (err: unknown) {
    await auditLogger.error(
      'QRDA_HISTORY_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch export history');
  }
}

// Export service
export const QRDAExportService = {
  exportQRDAI,
  exportQRDAIII,
  validateQRDADocument,
  getExportHistory
};

export default QRDAExportService;
