// =====================================================
// HL7 v2.x to FHIR R4 Conversion
// Purpose: Convert parsed HL7 messages to FHIR Bundles
// =====================================================

import type { HL7Message, FHIRResource, FHIRBundle } from './types.ts';
import {
  formatHL7Date,
  mapPV1Status,
  mapOBXStatus,
  mapAllergySeverity
} from './hl7Parser.ts';

/**
 * Convert a parsed HL7 message into a FHIR R4 Bundle.
 * Extracts Patient, Encounter, Observation, Condition, and AllergyIntolerance
 * resources from the corresponding HL7 segments.
 */
export function hl7ToFHIR(hl7Message: HL7Message): {
  bundle: FHIRBundle;
  resourceCount: number;
} {
  const resources: FHIRResource[] = [];
  const componentSep = '^';

  // Extract patient from PID segment
  const pid = hl7Message.segments.find(s => s.name === 'PID');
  if (pid) {
    const nameParts = (pid.fields[5] || '').split(componentSep);
    const patient: FHIRResource = {
      resourceType: 'Patient',
      id: `patient-${pid.fields[3]?.split(componentSep)[0] || Date.now()}`,
      identifier: pid.fields[3] ? [{
        system: 'http://hospital.example.org/mrn',
        value: pid.fields[3].split(componentSep)[0]
      }] : undefined,
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
    const encounter: FHIRResource = {
      resourceType: 'Encounter',
      id: `encounter-${pv1.fields[19] || Date.now()}`,
      status: mapPV1Status(pv1.fields[45]),
      class: { code: pv1.fields[2] || 'AMB' },
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
      code: {
        coding: [{
          system: codeParts[2] === 'LN' ? 'http://loinc.org' : 'http://local.code',
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
      code: {
        coding: [{
          system: codeParts[2] === 'I10'
            ? 'http://hl7.org/fhir/sid/icd-10-cm'
            : 'http://local.code',
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
