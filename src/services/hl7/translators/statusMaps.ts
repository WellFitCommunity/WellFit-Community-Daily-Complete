/**
 * HL7 v2.x to FHIR R4 Status and Code Translation Maps
 *
 * Pure mapping functions that translate HL7 v2.x coded values
 * to their FHIR R4 equivalents. Covers encounter status, patient class,
 * observation/result status, order status, abnormal flags, and more.
 */

import type {
  FHIREncounter,
  FHIRDiagnosticReport,
  FHIRObservation,
  FHIRServiceRequest,
  FHIRCoding,
  FHIRHumanName,
  FHIRAddress,
  FHIRContactPoint,
  FHIRPatient,
} from './types';

// ============================================================================
// ENCOUNTER STATUS MAPS
// ============================================================================

export function translateEncounterStatus(eventType?: string): FHIREncounter['status'] {
  // Map ADT event to encounter status
  switch (eventType) {
    case 'A01': // Admit
    case 'A04': // Register
    case 'A02': // Transfer
      return 'in-progress';
    case 'A03': // Discharge
      return 'finished';
    case 'A11': // Cancel admit
    case 'A12': // Cancel transfer
    case 'A13': // Cancel discharge
      return 'cancelled';
    case 'A05': // Pre-admit
    case 'A14': // Pending admit
      return 'planned';
    case 'A21': // Leave of absence
      return 'onleave';
    default:
      return 'in-progress';
  }
}

export function translatePatientClass(patientClass: string): FHIRCoding {
  const classMap: Record<string, { code: string; display: string }> = {
    E: { code: 'EMER', display: 'emergency' },
    I: { code: 'IMP', display: 'inpatient' },
    O: { code: 'AMB', display: 'ambulatory' },
    P: { code: 'PRENC', display: 'pre-admission' },
    R: { code: 'SS', display: 'short stay' },
    B: { code: 'OBSENC', display: 'observation' },
    N: { code: 'HH', display: 'home health' },
  };

  const mapped = classMap[patientClass] || { code: 'AMB', display: 'ambulatory' };

  return {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: mapped.code,
    display: mapped.display,
  };
}

// ============================================================================
// DIAGNOSTIC / OBSERVATION STATUS MAPS
// ============================================================================

export function translateResultStatus(status?: string): FHIRDiagnosticReport['status'] {
  switch (status) {
    case 'O':
      return 'registered';
    case 'I':
    case 'S':
      return 'partial';
    case 'A':
    case 'P':
      return 'preliminary';
    case 'C':
      return 'corrected';
    case 'R':
      return 'amended';
    case 'F':
      return 'final';
    case 'X':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

export function translateObservationStatus(status: string): FHIRObservation['status'] {
  switch (status) {
    case 'C':
      return 'corrected';
    case 'D':
      return 'entered-in-error';
    case 'F':
      return 'final';
    case 'I':
      return 'registered';
    case 'P':
      return 'preliminary';
    case 'R':
      return 'amended';
    case 'S':
      return 'preliminary';
    case 'X':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

// ============================================================================
// ORDER STATUS MAPS
// ============================================================================

export function translateOrderStatus(status?: string): FHIRServiceRequest['status'] {
  switch (status) {
    case 'A':
      return 'active';
    case 'CA':
      return 'revoked';
    case 'CM':
      return 'completed';
    case 'DC':
      return 'revoked';
    case 'ER':
      return 'entered-in-error';
    case 'HD':
      return 'on-hold';
    case 'IP':
      return 'active';
    case 'SC':
      return 'active';
    default:
      return 'unknown';
  }
}

export function translateOrderIntent(orderControl: string): FHIRServiceRequest['intent'] {
  switch (orderControl) {
    case 'NW':
      return 'order';
    case 'XO':
      return 'order';
    case 'CA':
      return 'order';
    case 'RF':
      return 'reflex-order';
    case 'SC':
      return 'filler-order';
    default:
      return 'order';
  }
}

export function translatePriority(priority: string): FHIRServiceRequest['priority'] {
  switch (priority.toUpperCase()) {
    case 'S':
    case 'STAT':
      return 'stat';
    case 'A':
    case 'ASAP':
      return 'asap';
    case 'U':
    case 'URGENT':
      return 'urgent';
    default:
      return 'routine';
  }
}

// ============================================================================
// ABNORMAL FLAG MAP
// ============================================================================

export function translateAbnormalFlag(flag: string): string {
  const flagMap: Record<string, string> = {
    L: 'L',
    H: 'H',
    LL: 'LL',
    HH: 'HH',
    '<': 'L',
    '>': 'H',
    N: 'N',
    A: 'A',
    AA: 'AA',
    U: 'U',
    D: 'D',
    B: 'B',
    W: 'W',
    S: 'S',
    R: 'R',
    I: 'I',
  };

  return flagMap[flag.toUpperCase()] || flag;
}

// ============================================================================
// ALLERGY / DIAGNOSIS MAPS
// ============================================================================

export function translateAllergenCategory(type: string): 'food' | 'medication' | 'environment' | 'biologic' {
  switch (type.toUpperCase()) {
    case 'DA':
    case 'DRUG':
      return 'medication';
    case 'FA':
    case 'FOOD':
      return 'food';
    case 'EA':
    case 'ENV':
      return 'environment';
    case 'PA':
    case 'POLLEN':
      return 'environment';
    case 'LA':
    case 'LATEX':
      return 'environment';
    default:
      return 'medication';
  }
}

export function translateAllergySeverity(severity: string): 'low' | 'high' | 'unable-to-assess' {
  switch (severity.toUpperCase()) {
    case 'SV':
    case 'SEVERE':
      return 'high';
    case 'MO':
    case 'MODERATE':
      return 'high';
    case 'MI':
    case 'MILD':
      return 'low';
    default:
      return 'unable-to-assess';
  }
}

export function translateDiagnosisType(type: string): string {
  switch (type.toUpperCase()) {
    case 'A':
      return 'encounter-diagnosis';
    case 'W':
      return 'problem-list-item';
    case 'F':
      return 'encounter-diagnosis';
    default:
      return 'encounter-diagnosis';
  }
}

// ============================================================================
// PERSON / NAME / ADDRESS / TELECOM MAPS
// ============================================================================

export function translateGender(sex?: string): FHIRPatient['gender'] {
  switch (sex) {
    case 'M':
      return 'male';
    case 'F':
      return 'female';
    case 'O':
    case 'A':
      return 'other';
    default:
      return 'unknown';
  }
}

export function translateNameType(type?: string): FHIRHumanName['use'] {
  switch (type) {
    case 'L':
      return 'official';
    case 'A':
      return 'usual';
    case 'D':
      return 'official';
    case 'M':
      return 'maiden';
    case 'N':
      return 'nickname';
    case 'S':
      return 'temp';
    default:
      return 'official';
  }
}

export function translateAddressType(type?: string): FHIRAddress['use'] {
  switch (type) {
    case 'H':
      return 'home';
    case 'B':
    case 'O':
      return 'work';
    case 'C':
      return 'temp';
    case 'M':
      return 'billing';
    default:
      return 'home';
  }
}

export function translateTelecomType(type?: string): FHIRContactPoint['system'] {
  switch (type) {
    case 'PH':
      return 'phone';
    case 'FX':
      return 'fax';
    case 'Internet':
      return 'email';
    case 'CP':
      return 'sms';
    case 'BP':
      return 'pager';
    default:
      return 'phone';
  }
}

// ============================================================================
// CODING SYSTEM MAP
// ============================================================================

export function translateCodingSystem(system?: string): string | undefined {
  if (!system) return undefined;

  const systemMap: Record<string, string> = {
    I9C: 'http://hl7.org/fhir/sid/icd-9-cm',
    I10: 'http://hl7.org/fhir/sid/icd-10',
    I10C: 'http://hl7.org/fhir/sid/icd-10-cm',
    LN: 'http://loinc.org',
    SCT: 'http://snomed.info/sct',
    RXNORM: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    CPT: 'http://www.ama-assn.org/go/cpt',
    NDC: 'http://hl7.org/fhir/sid/ndc',
    CVX: 'http://hl7.org/fhir/sid/cvx',
  };

  return systemMap[system.toUpperCase()] || `urn:oid:${system}`;
}
