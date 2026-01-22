/**
 * C-CDA Export Function
 *
 * Generates a Consolidated Clinical Document Architecture (C-CDA) document
 * for patient health records per 21st Century Cures Act requirements.
 *
 * Implements CCD (Continuity of Care Document) template with sections:
 * - Patient Demographics
 * - Allergies & Intolerances
 * - Medications
 * - Problems (Conditions)
 * - Procedures
 * - Immunizations
 * - Vital Signs
 * - Results (Labs)
 * - Plan of Care
 *
 * @see https://www.hl7.org/ccdasearch/
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createUserClient, batchQueries } from '../_shared/supabaseClient.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface Profile {
  user_id: string;
  first_name?: string;
  last_name?: string;
  dob?: string;
  phone?: string;
  email?: string;
  address?: string;
  gender?: string;
}

interface Medication {
  id: string;
  user_id: string;
  medication_name?: string;
  dosage?: string;
  strength?: string;
  frequency?: string;
  instructions?: string;
  status: string;
}

interface Allergy {
  id: string;
  user_id: string;
  allergen_name?: string;
  allergen_type?: string;
  reaction_description?: string;
  severity?: string;
  clinical_status?: string;
}

interface Condition {
  id: string;
  patient_id: string;
  code?: string;
  code_display?: string;
  clinical_status?: string;
  onset_datetime?: string;
}

interface Procedure {
  id: string;
  patient_id: string;
  code?: string;
  code_display?: string;
  performed_datetime?: string;
  status?: string;
}

interface Immunization {
  id: string;
  patient_id: string;
  vaccine_code?: string;
  vaccine_display?: string;
  occurrence_datetime?: string;
  status?: string;
  lot_number?: string;
}

interface Observation {
  id: string;
  patient_id: string;
  code?: string;
  code_display?: string;
  value_quantity?: number;
  value_string?: string;
  value_unit?: string;
  effective_datetime?: string;
}

interface LabResult {
  id: string;
  patient_mrn: string;
  test_name?: string;
  value?: string | number;
  unit?: string;
  reference_range?: string;
  extracted_at?: string;
}

interface CarePlan {
  id: string;
  patient_id: string;
  title?: string;
  description?: string;
  status?: string;
  period_start?: string;
}

const CCDA_VERSION = "2.1";
const TEMPLATE_OID = {
  CCD: "2.16.840.1.113883.10.20.22.1.2",
  ALLERGIES: "2.16.840.1.113883.10.20.22.2.6.1",
  MEDICATIONS: "2.16.840.1.113883.10.20.22.2.1.1",
  PROBLEMS: "2.16.840.1.113883.10.20.22.2.5.1",
  PROCEDURES: "2.16.840.1.113883.10.20.22.2.7.1",
  IMMUNIZATIONS: "2.16.840.1.113883.10.20.22.2.2.1",
  VITAL_SIGNS: "2.16.840.1.113883.10.20.22.2.4.1",
  RESULTS: "2.16.840.1.113883.10.20.22.2.3.1",
  PLAN_OF_CARE: "2.16.840.1.113883.10.20.22.2.10",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createUserClient(authHeader);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Fetch ALL USCDI data in parallel
    const [
      { data: profile },
      { data: medications },
      { data: allergies },
      { data: conditions },
      { data: procedures },
      { data: immunizations },
      { data: observations },
      { data: labResults },
      { data: carePlans }
    ] = await batchQueries([
      () => supabase.from('profiles').select('*').eq('user_id', userId).single(),
      () => supabase.from('medications').select('*').eq('user_id', userId).eq('status', 'active'),
      () => supabase.from('allergy_intolerances').select('*').eq('user_id', userId),
      () => supabase.from('fhir_conditions').select('*').eq('patient_id', userId),
      () => supabase.from('fhir_procedures').select('*').eq('patient_id', userId).limit(50),
      () => supabase.from('fhir_immunizations').select('*').eq('patient_id', userId),
      () => supabase.from('fhir_observations').select('*').eq('patient_id', userId).eq('category', 'vital-signs').limit(50),
      () => supabase.from('lab_results').select('*').eq('patient_mrn', userId).limit(50),
      () => supabase.from('fhir_care_plans').select('*').eq('patient_id', userId).in('status', ['active', 'draft'])
    ]);

    // Generate C-CDA XML
    const ccda = generateCCDA({
      profile,
      medications: medications || [],
      allergies: allergies || [],
      conditions: conditions || [],
      procedures: procedures || [],
      immunizations: immunizations || [],
      observations: observations || [],
      labResults: labResults || [],
      carePlans: carePlans || [],
      documentId: `${userId}-${Date.now()}`,
      createdAt: new Date().toISOString()
    });

    return new Response(JSON.stringify({ xml: ccda }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: 'Failed to generate C-CDA', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface CCDAData {
  profile: Profile | null;
  medications: Medication[];
  allergies: Allergy[];
  conditions: Condition[];
  procedures: Procedure[];
  immunizations: Immunization[];
  observations: Observation[];
  labResults: LabResult[];
  carePlans: CarePlan[];
  documentId: string;
  createdAt: string;
}

function generateCCDA(data: CCDAData): string {
  const { profile, medications, allergies, conditions, procedures,
          immunizations, observations, labResults, carePlans, documentId, createdAt } = data;

  const patientId = profile?.user_id || 'unknown';
  const effectiveTime = formatHL7DateTime(createdAt);
  const patientName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Unknown';
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

function generateAllergiesSection(allergies: Allergy[]): string {
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

function generateMedicationsSection(medications: Medication[]): string {
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

function generateProblemsSection(conditions: Condition[]): string {
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

function generateProceduresSection(procedures: Procedure[]): string {
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

function generateImmunizationsSection(immunizations: Immunization[]): string {
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

function generateVitalSignsSection(observations: Observation[]): string {
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
                  <td>${escapeXml(o.value_quantity?.toString() || o.value_string || 'N/A')} ${escapeXml(o.value_unit || '')}</td>
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
                  <value xsi:type="PQ" value="${escapeXml(o.value_quantity?.toString() || '0')}" unit="${escapeXml(o.value_unit || '1')}"/>
                </observation>
              </component>
              `).join('')}
            </organizer>
          </entry>
          ` : ''}
        </section>
      </component>`;
}

function generateResultsSection(labResults: LabResult[]): string {
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
                  <td>${l.extracted_at ? formatDisplayDate(l.extracted_at) : 'Unknown'}</td>
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
                  ${l.extracted_at ? `<effectiveTime value="${formatHL7DateTime(l.extracted_at)}"/>` : '<effectiveTime nullFlavor="NI"/>'}
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

function generatePlanOfCareSection(carePlans: CarePlan[]): string {
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

// Helper functions
function escapeXml(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatHL7DateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  } catch {
    return '';
  }
}

function formatHL7Date(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  } catch {
    return '';
  }
}

function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US');
  } catch {
    return dateStr || '';
  }
}

function mapGenderCode(gender: string | null | undefined): string {
  if (!gender) return 'UN';
  const g = gender.toLowerCase();
  if (g === 'male' || g === 'm') return 'M';
  if (g === 'female' || g === 'f') return 'F';
  return 'UN';
}

function mapAllergyTypeCode(type: string | null | undefined): string {
  if (!type) return '419199007';
  const t = type.toLowerCase();
  if (t === 'medication' || t === 'drug') return '416098002';
  if (t === 'food') return '414285001';
  if (t === 'environment' || t === 'environmental') return '426232007';
  return '419199007'; // Allergy to substance (general)
}
