/**
 * HL7 PID Segment to FHIR Patient Resource Translator
 *
 * Converts HL7 v2.x PID (Patient Identification) segments
 * into FHIR R4 Patient resources with US Core profile.
 */

import type { PIDSegment } from '../../../types/hl7v2';
import type { FHIRPatient } from './types';
import { translateGender } from './statusMaps';
import {
  translatePatientIdentifiers,
  translateHumanNames,
  translateTelecoms,
  translateAddresses,
  translateDate,
  translateDateTime,
  translateCodedElement,
  generateResourceId,
} from './commonTranslators';

/**
 * Translate a PID segment to a FHIR Patient resource
 */
export function pidToPatient(
  pid: PIDSegment,
  sourceSystem: string,
  tenantId: string
): FHIRPatient {
  const patient: FHIRPatient = {
    resourceType: 'Patient',
    id: generateResourceId('Patient'),
    meta: {
      source: sourceSystem,
      lastUpdated: new Date().toISOString(),
      profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'],
    },
    identifier: translatePatientIdentifiers(pid, tenantId),
    name: translateHumanNames(pid.patientName),
    telecom: translateTelecoms(pid.homePhone, pid.businessPhone),
    gender: translateGender(pid.administrativeSex),
    birthDate: translateDate(pid.dateOfBirth),
    address: translateAddresses(pid.patientAddress),
  };

  // Deceased status
  if (pid.patientDeathIndicator === 'Y') {
    if (pid.patientDeathDateTime) {
      patient.deceasedDateTime = translateDateTime(pid.patientDeathDateTime);
    } else {
      patient.deceasedBoolean = true;
    }
  }

  // Marital status
  if (pid.maritalStatus) {
    patient.maritalStatus = translateCodedElement(pid.maritalStatus);
  }

  // Multiple birth
  if (pid.multipleBirthIndicator === 'Y') {
    if (pid.birthOrder) {
      patient.multipleBirthInteger = pid.birthOrder;
    } else {
      patient.multipleBirthBoolean = true;
    }
  }

  // Language
  if (pid.primaryLanguage) {
    patient.communication = [
      {
        language: translateCodedElement(pid.primaryLanguage),
        preferred: true,
      },
    ];
  }

  return patient;
}
