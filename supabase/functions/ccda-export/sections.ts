/**
 * C-CDA Export — structured body section generators.
 *
 * One function per CCD section (Allergies, Medications, Problems, Procedures,
 * Immunizations, Vital Signs, Results, Plan of Care). Each renders both the
 * human-readable <text> narrative and the machine-readable <entry> elements.
 */

import {
  type Allergy,
  type CarePlan,
  type Condition,
  type Immunization,
  type LabResult,
  type Medication,
  type Observation,
  type Procedure,
  TEMPLATE_OID,
} from './types.ts';
import {
  escapeXml,
  formatDisplayDate,
  formatHL7DateTime,
  mapAllergyTypeCode,
} from './helpers.ts';

export function generateAllergiesSection(allergies: Allergy[]): string {
  const hasData = allergies.length > 0;

  return `
      <component>
        <section>
          <templateId root="${TEMPLATE_OID.ALLERGIES}" extension="2015-08-01"/>
          <code code="48765-2" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Allergies and adverse reactions"/>
          <title>Allergies and Intolerances</title>
          <text>
            ${hasData ? `
            <table border="1">
              <thead>
                <tr><th>Allergen</th><th>Type</th><th>Reaction</th><th>Severity</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${allergies.map((a, i) => `
                <tr>
                  <td ID="allergy${i}">${escapeXml(a.allergen_name || 'Unknown')}</td>
                  <td>${escapeXml(a.allergen_type || 'Unknown')}</td>
                  <td>${escapeXml(a.reaction_description || 'Not specified')}</td>
                  <td>${escapeXml(a.severity || 'Unknown')}</td>
                  <td>${escapeXml(a.clinical_status || 'active')}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
            ` : '<paragraph>No known allergies.</paragraph>'}
          </text>
          ${hasData ? allergies.map((a, i) => `
          <entry typeCode="DRIV">
            <act classCode="ACT" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.30" extension="2015-08-01"/>
              <id root="2.16.840.1.113883.19" extension="allergy-${i}"/>
              <code code="CONC" codeSystem="2.16.840.1.113883.5.6"/>
              <statusCode code="${a.clinical_status === 'resolved' ? 'completed' : 'active'}"/>
              <effectiveTime><low nullFlavor="NI"/></effectiveTime>
              <entryRelationship typeCode="SUBJ">
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.22.4.7" extension="2014-06-09"/>
                  <id root="2.16.840.1.113883.19" extension="allergyobs-${i}"/>
                  <code code="ASSERTION" codeSystem="2.16.840.1.113883.5.4"/>
                  <statusCode code="completed"/>
                  <effectiveTime><low nullFlavor="NI"/></effectiveTime>
                  <value xsi:type="CD" code="${mapAllergyTypeCode(a.allergen_type)}" codeSystem="2.16.840.1.113883.6.96" displayName="${escapeXml(a.allergen_name || 'Allergy')}"/>
                  <participant typeCode="CSM">
                    <participantRole classCode="MANU">
                      <playingEntity classCode="MMAT">
                        <code nullFlavor="OTH">
                          <originalText><reference value="#allergy${i}"/></originalText>
                        </code>
                        <name>${escapeXml(a.allergen_name || 'Unknown')}</name>
                      </playingEntity>
                    </participantRole>
                  </participant>
                </observation>
              </entryRelationship>
            </act>
          </entry>
          `).join('') : `
          <entry typeCode="DRIV">
            <act classCode="ACT" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.30" extension="2015-08-01"/>
              <id root="2.16.840.1.113883.19" extension="noallergy"/>
              <code code="CONC" codeSystem="2.16.840.1.113883.5.6"/>
              <statusCode code="completed"/>
              <effectiveTime><low nullFlavor="NA"/></effectiveTime>
              <entryRelationship typeCode="SUBJ">
                <observation classCode="OBS" moodCode="EVN" negationInd="true">
                  <templateId root="2.16.840.1.113883.10.20.22.4.7" extension="2014-06-09"/>
                  <id root="2.16.840.1.113883.19" extension="noallergyobs"/>
                  <code code="ASSERTION" codeSystem="2.16.840.1.113883.5.4"/>
                  <statusCode code="completed"/>
                  <effectiveTime><low nullFlavor="NA"/></effectiveTime>
                  <value xsi:type="CD" code="419199007" codeSystem="2.16.840.1.113883.6.96" displayName="Allergy to substance"/>
                </observation>
              </entryRelationship>
            </act>
          </entry>
          `}
        </section>
      </component>`;
}

export function generateMedicationsSection(medications: Medication[]): string {
  const hasData = medications.length > 0;

  return `
      <component>
        <section>
          <templateId root="${TEMPLATE_OID.MEDICATIONS}" extension="2014-06-09"/>
          <code code="10160-0" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="History of Medication use"/>
          <title>Medications</title>
          <text>
            ${hasData ? `
            <table border="1">
              <thead>
                <tr><th>Medication</th><th>Dose</th><th>Frequency</th><th>Instructions</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${medications.map((m, i) => `
                <tr>
                  <td ID="med${i}">${escapeXml(m.medication_name || 'Unknown')}</td>
                  <td>${escapeXml(m.dosage || m.strength || 'Not specified')}</td>
                  <td>${escapeXml(m.frequency || 'Not specified')}</td>
                  <td>${escapeXml(m.instructions || 'None')}</td>
                  <td>${escapeXml(m.status || 'active')}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
            ` : '<paragraph>No current medications.</paragraph>'}
          </text>
          ${hasData ? medications.map((m, i) => `
          <entry typeCode="DRIV">
            <substanceAdministration classCode="SBADM" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.16" extension="2014-06-09"/>
              <id root="2.16.840.1.113883.19" extension="med-${i}"/>
              <statusCode code="${m.status === 'active' ? 'active' : 'completed'}"/>
              <effectiveTime xsi:type="IVL_TS"><low nullFlavor="NI"/></effectiveTime>
              ${m.frequency ? `<effectiveTime xsi:type="PIVL_TS" operator="A"><period value="1" unit="d"/></effectiveTime>` : ''}
              ${m.dosage || m.strength ? `<doseQuantity value="1"/>` : '<doseQuantity nullFlavor="NI"/>'}
              <consumable>
                <manufacturedProduct classCode="MANU">
                  <templateId root="2.16.840.1.113883.10.20.22.4.23" extension="2014-06-09"/>
                  <manufacturedMaterial>
                    <code nullFlavor="OTH">
                      <originalText><reference value="#med${i}"/></originalText>
                    </code>
                    <name>${escapeXml(m.medication_name || 'Unknown')}</name>
                  </manufacturedMaterial>
                </manufacturedProduct>
              </consumable>
            </substanceAdministration>
          </entry>
          `).join('') : ''}
        </section>
      </component>`;
}

export function generateProblemsSection(conditions: Condition[]): string {
  const hasData = conditions.length > 0;

  return `
      <component>
        <section>
          <templateId root="${TEMPLATE_OID.PROBLEMS}" extension="2015-08-01"/>
          <code code="11450-4" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Problem list"/>
          <title>Problems</title>
          <text>
            ${hasData ? `
            <table border="1">
              <thead>
                <tr><th>Condition</th><th>Code</th><th>Status</th><th>Onset Date</th></tr>
              </thead>
              <tbody>
                ${conditions.map((c, i) => `
                <tr>
                  <td ID="prob${i}">${escapeXml(c.code_display || 'Unknown')}</td>
                  <td>${escapeXml(c.code || 'N/A')}</td>
                  <td>${escapeXml(c.clinical_status || 'active')}</td>
                  <td>${c.onset_datetime ? formatDisplayDate(c.onset_datetime) : 'Unknown'}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
            ` : '<paragraph>No known problems.</paragraph>'}
          </text>
          ${hasData ? conditions.map((c, i) => `
          <entry typeCode="DRIV">
            <act classCode="ACT" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.3" extension="2015-08-01"/>
              <id root="2.16.840.1.113883.19" extension="prob-${i}"/>
              <code code="CONC" codeSystem="2.16.840.1.113883.5.6"/>
              <statusCode code="${c.clinical_status === 'resolved' ? 'completed' : 'active'}"/>
              <effectiveTime>
                ${c.onset_datetime ? `<low value="${formatHL7DateTime(c.onset_datetime)}"/>` : '<low nullFlavor="NI"/>'}
              </effectiveTime>
              <entryRelationship typeCode="SUBJ">
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.22.4.4" extension="2015-08-01"/>
                  <id root="2.16.840.1.113883.19" extension="probobs-${i}"/>
                  <code code="55607006" codeSystem="2.16.840.1.113883.6.96" displayName="Problem"/>
                  <statusCode code="completed"/>
                  <effectiveTime>
                    ${c.onset_datetime ? `<low value="${formatHL7DateTime(c.onset_datetime)}"/>` : '<low nullFlavor="NI"/>'}
                  </effectiveTime>
                  <value xsi:type="CD" ${c.code ? `code="${escapeXml(c.code)}"` : ''} codeSystem="2.16.840.1.113883.6.90" codeSystemName="ICD-10-CM" displayName="${escapeXml(c.code_display || 'Unknown')}">
                    <originalText><reference value="#prob${i}"/></originalText>
                  </value>
                </observation>
              </entryRelationship>
            </act>
          </entry>
          `).join('') : ''}
        </section>
      </component>`;
}

export function generateProceduresSection(procedures: Procedure[]): string {
  const hasData = procedures.length > 0;

  return `
      <component>
        <section>
          <templateId root="${TEMPLATE_OID.PROCEDURES}" extension="2014-06-09"/>
          <code code="47519-4" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="History of Procedures"/>
          <title>Procedures</title>
          <text>
            ${hasData ? `
            <table border="1">
              <thead>
                <tr><th>Procedure</th><th>Code</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${procedures.map((p, i) => `
                <tr>
                  <td ID="proc${i}">${escapeXml(p.code_display || 'Unknown')}</td>
                  <td>${escapeXml(p.code || 'N/A')}</td>
                  <td>${p.performed_datetime ? formatDisplayDate(p.performed_datetime) : 'Unknown'}</td>
                  <td>${escapeXml(p.status || 'completed')}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
            ` : '<paragraph>No procedures documented.</paragraph>'}
          </text>
          ${hasData ? procedures.map((p, i) => `
          <entry typeCode="DRIV">
            <procedure classCode="PROC" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.14" extension="2014-06-09"/>
              <id root="2.16.840.1.113883.19" extension="proc-${i}"/>
              <code ${p.code ? `code="${escapeXml(p.code)}"` : ''} codeSystem="2.16.840.1.113883.6.12" codeSystemName="CPT" displayName="${escapeXml(p.code_display || 'Unknown')}">
                <originalText><reference value="#proc${i}"/></originalText>
              </code>
              <statusCode code="${p.status === 'completed' ? 'completed' : 'active'}"/>
              ${p.performed_datetime ? `<effectiveTime value="${formatHL7DateTime(p.performed_datetime)}"/>` : '<effectiveTime nullFlavor="NI"/>'}
            </procedure>
          </entry>
          `).join('') : ''}
        </section>
      </component>`;
}

export function generateImmunizationsSection(immunizations: Immunization[]): string {
  const hasData = immunizations.length > 0;

  return `
      <component>
        <section>
          <templateId root="${TEMPLATE_OID.IMMUNIZATIONS}" extension="2015-08-01"/>
          <code code="11369-6" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="History of Immunization"/>
          <title>Immunizations</title>
          <text>
            ${hasData ? `
            <table border="1">
              <thead>
                <tr><th>Vaccine</th><th>Date</th><th>Status</th><th>Lot Number</th></tr>
              </thead>
              <tbody>
                ${immunizations.map((im, i) => `
                <tr>
                  <td ID="imm${i}">${escapeXml(im.vaccine_display || 'Unknown')}</td>
                  <td>${im.occurrence_datetime ? formatDisplayDate(im.occurrence_datetime) : 'Unknown'}</td>
                  <td>${escapeXml(im.status || 'completed')}</td>
                  <td>${escapeXml(im.lot_number || 'N/A')}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
            ` : '<paragraph>No immunizations documented.</paragraph>'}
          </text>
          ${hasData ? immunizations.map((im, i) => `
          <entry typeCode="DRIV">
            <substanceAdministration classCode="SBADM" moodCode="EVN" negationInd="false">
              <templateId root="2.16.840.1.113883.10.20.22.4.52" extension="2015-08-01"/>
              <id root="2.16.840.1.113883.19" extension="imm-${i}"/>
              <statusCode code="completed"/>
              ${im.occurrence_datetime ? `<effectiveTime value="${formatHL7DateTime(im.occurrence_datetime)}"/>` : '<effectiveTime nullFlavor="NI"/>'}
              <consumable>
                <manufacturedProduct classCode="MANU">
                  <templateId root="2.16.840.1.113883.10.20.22.4.54" extension="2014-06-09"/>
                  <manufacturedMaterial>
                    <code ${im.vaccine_code ? `code="${escapeXml(im.vaccine_code)}"` : ''} codeSystem="2.16.840.1.113883.12.292" codeSystemName="CVX" displayName="${escapeXml(im.vaccine_display || 'Unknown')}">
                      <originalText><reference value="#imm${i}"/></originalText>
                    </code>
                    ${im.lot_number ? `<lotNumberText>${escapeXml(im.lot_number)}</lotNumberText>` : ''}
                  </manufacturedMaterial>
                </manufacturedProduct>
              </consumable>
            </substanceAdministration>
          </entry>
          `).join('') : ''}
        </section>
      </component>`;
}

export function generateVitalSignsSection(observations: Observation[]): string {
  const hasData = observations.length > 0;

  return `
      <component>
        <section>
          <templateId root="${TEMPLATE_OID.VITAL_SIGNS}" extension="2015-08-01"/>
          <code code="8716-3" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Vital signs"/>
          <title>Vital Signs</title>
          <text>
            ${hasData ? `
            <table border="1">
              <thead>
                <tr><th>Vital Sign</th><th>Value</th><th>Date</th></tr>
              </thead>
              <tbody>
                ${observations.map((o, i) => `
                <tr>
                  <td ID="vital${i}">${escapeXml(o.code_display || o.code || 'Unknown')}</td>
                  <td>${escapeXml(o.value_quantity_value?.toString() || o.value_string || 'N/A')} ${escapeXml(o.value_quantity_unit || '')}</td>
                  <td>${o.effective_datetime ? formatDisplayDate(o.effective_datetime) : 'Unknown'}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
            ` : '<paragraph>No vital signs documented.</paragraph>'}
          </text>
          ${hasData ? `
          <entry typeCode="DRIV">
            <organizer classCode="CLUSTER" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.26" extension="2015-08-01"/>
              <id root="2.16.840.1.113883.19" extension="vitals-panel"/>
              <code code="46680005" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT" displayName="Vital Signs"/>
              <statusCode code="completed"/>
              <effectiveTime value="${formatHL7DateTime(observations[0]?.effective_datetime || new Date().toISOString())}"/>
              ${observations.map((o, i) => `
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.22.4.27" extension="2014-06-09"/>
                  <id root="2.16.840.1.113883.19" extension="vitalobs-${i}"/>
                  <code ${o.code ? `code="${escapeXml(o.code)}"` : ''} codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${escapeXml(o.code_display || 'Vital Sign')}">
                    <originalText><reference value="#vital${i}"/></originalText>
                  </code>
                  <statusCode code="completed"/>
                  ${o.effective_datetime ? `<effectiveTime value="${formatHL7DateTime(o.effective_datetime)}"/>` : '<effectiveTime nullFlavor="NI"/>'}
                  <value xsi:type="PQ" value="${escapeXml(o.value_quantity_value?.toString() || '0')}" unit="${escapeXml(o.value_quantity_unit || '1')}"/>
                </observation>
              </component>
              `).join('')}
            </organizer>
          </entry>
          ` : ''}
        </section>
      </component>`;
}

export function generateResultsSection(labResults: LabResult[]): string {
  const hasData = labResults.length > 0;

  return `
      <component>
        <section>
          <templateId root="${TEMPLATE_OID.RESULTS}" extension="2015-08-01"/>
          <code code="30954-2" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Relevant diagnostic tests/laboratory data"/>
          <title>Results</title>
          <text>
            ${hasData ? `
            <table border="1">
              <thead>
                <tr><th>Test</th><th>Result</th><th>Reference Range</th><th>Date</th></tr>
              </thead>
              <tbody>
                ${labResults.map((l, i) => `
                <tr>
                  <td ID="result${i}">${escapeXml(l.test_name || 'Unknown')}</td>
                  <td>${escapeXml(l.value?.toString() || 'N/A')} ${escapeXml(l.unit || '')}</td>
                  <td>${escapeXml(l.reference_range || 'N/A')}</td>
                  <td>${l.result_date ? formatDisplayDate(l.result_date) : 'Unknown'}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
            ` : '<paragraph>No lab results documented.</paragraph>'}
          </text>
          ${hasData ? `
          <entry typeCode="DRIV">
            <organizer classCode="BATTERY" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.1" extension="2015-08-01"/>
              <id root="2.16.840.1.113883.19" extension="results-panel"/>
              <code code="26436-6" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Laboratory studies"/>
              <statusCode code="completed"/>
              ${labResults.map((l, i) => `
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.22.4.2" extension="2015-08-01"/>
                  <id root="2.16.840.1.113883.19" extension="resultobs-${i}"/>
                  <code nullFlavor="OTH">
                    <originalText><reference value="#result${i}"/></originalText>
                  </code>
                  <statusCode code="completed"/>
                  ${l.result_date ? `<effectiveTime value="${formatHL7DateTime(l.result_date)}"/>` : '<effectiveTime nullFlavor="NI"/>'}
                  <value xsi:type="PQ" value="${escapeXml(l.value?.toString() || '0')}" unit="${escapeXml(l.unit || '1')}"/>
                  ${l.reference_range ? `<referenceRange><observationRange><text>${escapeXml(l.reference_range)}</text></observationRange></referenceRange>` : ''}
                </observation>
              </component>
              `).join('')}
            </organizer>
          </entry>
          ` : ''}
        </section>
      </component>`;
}

export function generatePlanOfCareSection(carePlans: CarePlan[]): string {
  const hasData = carePlans.length > 0;

  return `
      <component>
        <section>
          <templateId root="${TEMPLATE_OID.PLAN_OF_CARE}" extension="2014-06-09"/>
          <code code="18776-5" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Plan of care note"/>
          <title>Plan of Care</title>
          <text>
            ${hasData ? `
            <list>
              ${carePlans.map(cp => `
              <item>${escapeXml(cp.title || 'Care Plan')}: ${escapeXml(cp.description || 'No description')} (Status: ${escapeXml(cp.status || 'active')})</item>
              `).join('')}
            </list>
            ` : '<paragraph>No active care plans.</paragraph>'}
          </text>
          ${hasData ? carePlans.map((cp, i) => `
          <entry typeCode="DRIV">
            <act classCode="ACT" moodCode="INT">
              <templateId root="2.16.840.1.113883.10.20.22.4.20" extension="2014-06-09"/>
              <id root="2.16.840.1.113883.19" extension="careplan-${i}"/>
              <code code="311791003" codeSystem="2.16.840.1.113883.6.96" displayName="Plan of care"/>
              <text>${escapeXml(cp.title || 'Care Plan')}: ${escapeXml(cp.description || '')}</text>
              <statusCode code="${cp.status === 'active' ? 'active' : 'completed'}"/>
              ${cp.period_start ? `<effectiveTime><low value="${formatHL7DateTime(cp.period_start)}"/></effectiveTime>` : ''}
            </act>
          </entry>
          `).join('') : ''}
        </section>
      </component>`;
}
