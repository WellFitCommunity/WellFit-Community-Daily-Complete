/**
 * Common HL7 v2.x to FHIR R4 Translation Helpers
 *
 * Shared helper functions used across multiple segment translators:
 * - Date/datetime conversion
 * - Coded element translation
 * - Human name, address, telecom translation
 * - Person and location reference translation
 * - Patient identifier translation
 * - Resource ID / UUID generation
 */

import type {
  CodedElement,
  ExtendedPerson,
  Address as HL7Address,
  ExtendedTelecom,
  HumanName as HL7HumanName,
  PatientLocation,
  PIDSegment,
} from '../../../types/hl7v2';

import type {
  FHIRCodeableConcept,
  FHIRHumanName,
  FHIRAddress,
  FHIRContactPoint,
  FHIRReference,
  FHIRIdentifier,
} from './types';

import {
  translateCodingSystem,
  translateNameType,
  translateAddressType,
  translateTelecomType,
  translateGender,
} from './statusMaps';

// Re-export translateGender so consumers can import from commonTranslators
export { translateGender };

// ============================================================================
// DATE / DATETIME TRANSLATION
// ============================================================================

export function translateDate(hl7Date?: string): string | undefined {
  if (!hl7Date || hl7Date.length < 8) return undefined;

  // HL7 date format: YYYYMMDD
  const year = hl7Date.substring(0, 4);
  const month = hl7Date.substring(4, 6);
  const day = hl7Date.substring(6, 8);

  return `${year}-${month}-${day}`;
}

export function translateDateTime(hl7DateTime?: string): string | undefined {
  if (!hl7DateTime || hl7DateTime.length < 8) return undefined;

  // HL7 datetime format: YYYYMMDDHHmmss[.SSSS][+/-ZZZZ]
  const year = hl7DateTime.substring(0, 4);
  const month = hl7DateTime.substring(4, 6);
  const day = hl7DateTime.substring(6, 8);
  const hour = hl7DateTime.substring(8, 10) || '00';
  const minute = hl7DateTime.substring(10, 12) || '00';
  const second = hl7DateTime.substring(12, 14) || '00';

  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

// ============================================================================
// CODED ELEMENT TRANSLATION
// ============================================================================

export function translateCodedElement(ce?: CodedElement): FHIRCodeableConcept {
  if (!ce) return { text: 'Unknown' };

  const concept: FHIRCodeableConcept = {};

  if (ce.identifier || ce.text) {
    concept.coding = [
      {
        system: translateCodingSystem(ce.nameOfCodingSystem),
        code: ce.identifier,
        display: ce.text,
      },
    ];
  }

  if (ce.alternateIdentifier || ce.alternateText) {
    if (!concept.coding) concept.coding = [];
    concept.coding.push({
      system: translateCodingSystem(ce.nameOfAlternateCodingSystem),
      code: ce.alternateIdentifier,
      display: ce.alternateText,
    });
  }

  concept.text = ce.originalText || ce.text || ce.alternateText;

  return concept;
}

// ============================================================================
// HUMAN NAME TRANSLATION
// ============================================================================

export function translateHumanNames(names: HL7HumanName[]): FHIRHumanName[] {
  return names.map((name) => ({
    use: translateNameType(name.nameTypeCode),
    family: name.familyName,
    given: [name.givenName, name.middleInitialOrName].filter(Boolean) as string[],
    prefix: name.prefix ? [name.prefix] : undefined,
    suffix: [name.suffix, name.degree].filter(Boolean) as string[] || undefined,
  }));
}

// ============================================================================
// ADDRESS TRANSLATION
// ============================================================================

export function translateAddresses(addresses?: HL7Address[]): FHIRAddress[] | undefined {
  if (!addresses) return undefined;

  return addresses.map((addr) => ({
    use: translateAddressType(addr.addressType),
    line: [addr.streetAddress, addr.otherDesignation].filter(Boolean) as string[],
    city: addr.city,
    district: addr.countyParishCode,
    state: addr.stateOrProvince,
    postalCode: addr.zipOrPostalCode,
    country: addr.country,
  }));
}

// ============================================================================
// TELECOM TRANSLATION
// ============================================================================

export function translateTelecoms(
  homePhones?: ExtendedTelecom[],
  businessPhones?: ExtendedTelecom[]
): FHIRContactPoint[] {
  const telecoms: FHIRContactPoint[] = [];

  if (homePhones) {
    for (const phone of homePhones) {
      telecoms.push({
        system: translateTelecomType(phone.telecommunicationEquipmentType),
        value: phone.telephoneNumber || phone.communicationAddress,
        use: 'home',
      });
    }
  }

  if (businessPhones) {
    for (const phone of businessPhones) {
      telecoms.push({
        system: translateTelecomType(phone.telecommunicationEquipmentType),
        value: phone.telephoneNumber || phone.communicationAddress,
        use: 'work',
      });
    }
  }

  return telecoms;
}

// ============================================================================
// REFERENCE TRANSLATION
// ============================================================================

export function translateExtendedPersonToReference(person: ExtendedPerson): FHIRReference {
  const ref: FHIRReference = {};

  if (person.idNumber) {
    ref.identifier = { value: person.idNumber };
  }

  const nameParts = [person.prefix, person.givenName, person.familyName, person.suffix]
    .filter(Boolean)
    .join(' ');
  if (nameParts) {
    ref.display = nameParts;
  }

  return ref;
}

export function translateLocationToReference(location: PatientLocation): FHIRReference {
  const parts = [location.building, location.floor, location.pointOfCare, location.room, location.bed]
    .filter(Boolean)
    .join(' - ');

  return {
    display: parts || 'Unknown Location',
  };
}

// ============================================================================
// PATIENT IDENTIFIER TRANSLATION
// ============================================================================

export function translatePatientIdentifiers(pid: PIDSegment, tenantId: string): FHIRIdentifier[] {
  const identifiers: FHIRIdentifier[] = [];

  for (const id of pid.patientIdentifierList) {
    const identifier: FHIRIdentifier = {
      value: id.id,
    };

    // Determine type and system
    switch (id.identifierTypeCode) {
      case 'MR':
        identifier.use = 'usual';
        identifier.type = {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }],
        };
        identifier.system = `urn:oid:${id.assigningAuthority || tenantId}:mr`;
        break;
      case 'SS':
        identifier.use = 'official';
        identifier.type = {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'SS' }],
        };
        identifier.system = 'http://hl7.org/fhir/sid/us-ssn';
        break;
      default:
        identifier.system = `urn:oid:${id.assigningAuthority || tenantId}`;
    }

    if (id.assigningFacility) {
      identifier.assigner = { display: id.assigningFacility };
    }

    identifiers.push(identifier);
  }

  return identifiers;
}

// ============================================================================
// ID GENERATION
// ============================================================================

export function generateResourceId(resourceType: string): string {
  return `${resourceType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateUUID(index: number): string {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).substr(2, 12);
  return `${timestamp}-${random}-${index.toString(16).padStart(4, '0')}`;
}
