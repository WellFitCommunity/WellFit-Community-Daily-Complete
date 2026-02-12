/**
 * HL7 PV1/PV2 Segment to FHIR Encounter Resource Translator
 *
 * Converts HL7 v2.x PV1 (Patient Visit) and PV2 (Patient Visit Additional)
 * segments into FHIR R4 Encounter resources with US Core profile.
 */

import type { PV1Segment, PV2Segment } from '../../../types/hl7v2';
import type { FHIREncounter } from './types';
import { translateEncounterStatus, translatePatientClass } from './statusMaps';
import {
  translateDateTime,
  translateExtendedPersonToReference,
  translateLocationToReference,
  translateCodedElement,
  generateResourceId,
} from './commonTranslators';

/**
 * Translate PV1 (and optional PV2) segments to a FHIR Encounter resource
 */
export function pv1ToEncounter(
  pv1: PV1Segment,
  pv2: PV2Segment | undefined,
  eventType: string | undefined,
  sourceSystem: string,
  tenantId: string
): FHIREncounter {
  const encounter: FHIREncounter = {
    resourceType: 'Encounter',
    id: generateResourceId('Encounter'),
    meta: {
      source: sourceSystem,
      lastUpdated: new Date().toISOString(),
      profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter'],
    },
    status: translateEncounterStatus(eventType),
    class: translatePatientClass(pv1.patientClass),
  };

  // Visit number as identifier
  if (pv1.visitNumber) {
    encounter.identifier = [
      {
        use: 'usual',
        system: `urn:oid:${tenantId}:visit`,
        value: pv1.visitNumber,
      },
    ];
  }

  // Period (admit/discharge times)
  if (pv1.admitDateTime || pv1.dischargeDateTime) {
    encounter.period = {
      start: pv1.admitDateTime ? translateDateTime(pv1.admitDateTime) : undefined,
      end: pv1.dischargeDateTime ? translateDateTime(pv1.dischargeDateTime) : undefined,
    };
  }

  // Participants (attending, admitting, consulting doctors)
  encounter.participant = [];
  if (pv1.attendingDoctor) {
    encounter.participant.push(
      ...pv1.attendingDoctor.map((doc) => ({
        type: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                code: 'ATND',
                display: 'attender',
              },
            ],
          },
        ],
        individual: translateExtendedPersonToReference(doc),
      }))
    );
  }

  // Location
  if (pv1.assignedPatientLocation) {
    encounter.location = [
      {
        location: translateLocationToReference(pv1.assignedPatientLocation),
        status: 'active',
      },
    ];
  }

  // Hospitalization details
  if (pv1.admitSource || pv1.dischargeDisposition || pv1.preadmitNumber) {
    encounter.hospitalization = {};
    if (pv1.preadmitNumber) {
      encounter.hospitalization.preAdmissionIdentifier = {
        value: pv1.preadmitNumber,
      };
    }
    if (pv1.admitSource) {
      encounter.hospitalization.admitSource = {
        coding: [{ code: pv1.admitSource }],
      };
    }
    if (pv1.dischargeDisposition) {
      encounter.hospitalization.dischargeDisposition = {
        coding: [{ code: pv1.dischargeDisposition }],
      };
    }
    if (pv1.readmissionIndicator) {
      encounter.hospitalization.reAdmission = {
        coding: [{ code: pv1.readmissionIndicator }],
      };
    }
  }

  // Reason for visit (from PV2)
  if (pv2?.admitReason) {
    encounter.reasonCode = [translateCodedElement(pv2.admitReason)];
  }

  return encounter;
}
