/**
 * QRDA XML Helper Functions
 *
 * ONC Criteria: 170.315(c)(2), (c)(3)
 * Shared utilities for QRDA document generation.
 */

import type { MeasureResult } from './types';

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatHL7Date(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0];
}

export function formatHL7DateOnly(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0].replace(/-/g, '');
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate population component entries for a measure result (QRDA I)
 */
export function generatePopulationComponents(result: MeasureResult): string {
  let components = '';

  components += `
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.5" extension="2016-09-01"/>
                  <code code="IPOP" codeSystem="2.16.840.1.113883.5.4" displayName="Initial Population"/>
                  <value xsi:type="CD" code="${result.initial_population ? '1' : '0'}" codeSystem="2.16.840.1.113883.5.1063"/>
                </observation>
              </component>`;

  components += `
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.5" extension="2016-09-01"/>
                  <code code="DENOM" codeSystem="2.16.840.1.113883.5.4" displayName="Denominator"/>
                  <value xsi:type="CD" code="${result.denominator ? '1' : '0'}" codeSystem="2.16.840.1.113883.5.1063"/>
                </observation>
              </component>`;

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

/**
 * Generate measure entry for QRDA III
 */
export function generateMeasureEntry(measureId: string, agg: { initial_population_count: number; denominator_count: number; denominator_exclusion_count: number; numerator_count: number; performance_rate: number | null } | undefined): string {
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
