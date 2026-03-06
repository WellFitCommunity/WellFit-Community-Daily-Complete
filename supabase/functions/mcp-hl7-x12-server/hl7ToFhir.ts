// =====================================================
// HL7 v2.x to FHIR R4 Conversion
// Purpose: Convert parsed HL7 messages to FHIR Bundles
// =====================================================

import type { HL7Message, FHIRResource, FHIRBundle, HL7Delimiters } from './types.ts';
import {
  formatHL7Date,
  mapPV1Status,
  mapOBXStatus,
  mapAllergySeverity,
  splitRepetitions,
  splitSubcomponents
} from './hl7Parser.ts';

/**
 * Convert a parsed HL7 message into a FHIR R4 Bundle.
 * Extracts Patient, Encounter, Observation, Condition, and AllergyIntolerance
 * resources from the corresponding HL7 segments.
 */
export function hl7ToFHIR(hl7Message: HL7Message, delimiters?: HL7Delimiters): {
  bundle: FHIRBundle;
  resourceCount: number;
} {
  const resources: FHIRResource[] = [];
  const componentSep = delimiters?.component || '^';

  // Track IDs for cross-references
  let patientId = '';
  let encounterId = '';

  // Extract patient from PID segment
  const pid = hl7Message.segments.find(s => s.name === 'PID');
  if (pid) {
    // PID-3 is CX datatype — may have repetitions (e.g., MRN~SSN~DL)
    // Each repetition: ID^check_digit^code^assigning_authority(&OID&ISO)^type
    const pid3Repetitions = splitRepetitions(pid.fields[3] || '', delimiters);
    const primaryId = pid3Repetitions[0]?.split(componentSep)[0] || '';
    patientId = `patient-${primaryId || Date.now()}`;

    // Build FHIR identifiers from all repetitions
    const identifiers = pid3Repetitions
      .filter(rep => rep.trim())
      .map(rep => {
        const components = rep.split(componentSep);
        const idValue = components[0];
        const assigningAuth = components[3] || '';
        // Subcomponent parsing: authority&OID&ISO
        const authParts = splitSubcomponents(assigningAuth, delimiters);
        const system = authParts[1]
          ? `urn:oid:${authParts[1]}`
          : 'http://hospital.example.org/mrn';
        return { system, value: idValue };
      });

    const nameParts = (pid.fields[5] || '').split(componentSep);
    const patient: FHIRResource = {
      resourceType: 'Patient',
      id: patientId,
      identifier: identifiers.length > 0 ? identifiers : undefined,
      name: [{
        family: nameParts[0] || '',
        given: [nameParts[1], nameParts[2]].filter(Boolean)
      }],
      gender: pid.fields[8]?.toLowerCase() === 'f'
        ? 'female'
        : pid.fields[8]?.toLowerCase() === 'm'
          ? 'male'
          : 'unknown',
      birthDate: formatHL7Date(pid.fields[7])
    };
    resources.push(patient);
  }

  // Extract encounter from PV1 segment
  const pv1 = hl7Message.segments.find(s => s.name === 'PV1');
  if (pv1) {
    encounterId = `encounter-${pv1.fields[19] || Date.now()}`;
    const attendingParts = (pv1.fields[7] || '').split(componentSep);
    const encounter: FHIRResource = {
      resourceType: 'Encounter',
      id: encounterId,
      status: mapPV1Status(pv1.fields[45]),
      class: { code: pv1.fields[2] || 'AMB' },
      // Reference to Patient
      subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
      // Attending physician as participant
      participant: attendingParts[0] ? [{
        individual: {
          display: [attendingParts[1], attendingParts[0]].filter(Boolean).join(' ')
        }
      }] : undefined,
      period: {
        start: formatHL7Date(pv1.fields[44]),
        end: formatHL7Date(pv1.fields[45])
      },
      location: pv1.fields[3] ? [{
        location: { display: pv1.fields[3].split(componentSep).join(' - ') }
      }] : undefined
    };
    resources.push(encounter);
  }

  // Extract observations from OBX segments
  const obxSegments = hl7Message.segments.filter(s => s.name === 'OBX');
  for (const obx of obxSegments) {
    const codeParts = (obx.fields[3] || '').split(componentSep);
    const observation: FHIRResource = {
      resourceType: 'Observation',
      id: `observation-${obx.fields[4] || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: mapOBXStatus(obx.fields[11]),
      // Reference to Patient and Encounter
      subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
      encounter: encounterId ? { reference: `Encounter/${encounterId}` } : undefined,
      code: {
        coding: [{
          system: codeParts[2] === 'LN' ? 'http://loinc.org' : 'urn:system:local-code',
          code: codeParts[0],
          display: codeParts[1]
        }]
      },
      valueQuantity: obx.fields[5] && obx.fields[6] ? {
        value: parseFloat(obx.fields[5]),
        unit: obx.fields[6]
      } : undefined,
      valueString: !obx.fields[6] ? obx.fields[5] : undefined,
      effectiveDateTime: formatHL7Date(obx.fields[14])
    };
    resources.push(observation);
  }

  // Extract diagnoses from DG1 segments
  const dg1Segments = hl7Message.segments.filter(s => s.name === 'DG1');
  for (const dg1 of dg1Segments) {
    const codeParts = (dg1.fields[3] || '').split(componentSep);
    const condition: FHIRResource = {
      resourceType: 'Condition',
      id: `condition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      // Reference to Patient and Encounter
      subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
      encounter: encounterId ? { reference: `Encounter/${encounterId}` } : undefined,
      code: {
        coding: [{
          system: codeParts[2] === 'I10'
            ? 'http://hl7.org/fhir/sid/icd-10-cm'
            : 'urn:system:local-code',
          code: codeParts[0],
          display: codeParts[1]
        }]
      },
      clinicalStatus: { coding: [{ code: 'active' }] },
      onsetDateTime: formatHL7Date(dg1.fields[5])
    };
    resources.push(condition);
  }

  // Extract allergies from AL1 segments
  const al1Segments = hl7Message.segments.filter(s => s.name === 'AL1');
  for (const al1 of al1Segments) {
    const allergy: FHIRResource = {
      resourceType: 'AllergyIntolerance',
      id: `allergy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      // Reference to Patient
      patient: patientId ? { reference: `Patient/${patientId}` } : undefined,
      type: al1.fields[2]?.toLowerCase() === 'da' ? 'allergy' : 'intolerance',
      code: {
        text: al1.fields[3]?.split(componentSep)[1] || al1.fields[3]
      },
      reaction: al1.fields[5] ? [{
        manifestation: [{ text: al1.fields[5] }],
        severity: mapAllergySeverity(al1.fields[4])
      }] : undefined
    };
    resources.push(allergy);
  }

  return {
    bundle: {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: resources.map(r => ({
        fullUrl: `urn:uuid:${r.id}`,
        resource: r
      }))
    },
    resourceCount: resources.length
  };
}
