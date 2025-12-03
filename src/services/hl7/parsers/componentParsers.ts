/**
 * HL7 v2.x Component Parsers
 *
 * Parses individual HL7 components like CodedElement, Address, HumanName, etc.
 * These are reusable across all segment parsers.
 */

import {
  HL7Delimiters,
  PatientIdentifier,
  HumanName,
  Address,
  ExtendedTelecom,
  CodedElement,
  ExtendedPerson,
  ExtendedOrganization,
  PatientLocation,
  FinancialClass,
  Quantity,
  SpecimenSource,
  ERRSegment,
} from '../../../types/hl7v2';

/**
 * Component parser utilities
 */
export class ComponentParsers {
  constructor(private delimiters: HL7Delimiters) {}

  updateDelimiters(delimiters: HL7Delimiters): void {
    this.delimiters = delimiters;
  }

  splitFields(segmentString: string): string[] {
    return segmentString.split(this.delimiters.field);
  }

  getComponent(field: string, index: number): string | undefined {
    const components = field.split(this.delimiters.component);
    return components[index] || undefined;
  }

  parsePatientIdentifier(field: string): PatientIdentifier {
    const components = field.split(this.delimiters.component);
    return {
      id: components[0] || '',
      checkDigit: components[1] || undefined,
      checkDigitScheme: components[2] || undefined,
      assigningAuthority: components[3] || undefined,
      identifierTypeCode: components[4] || undefined,
      assigningFacility: components[5] || undefined,
      effectiveDate: components[6] || undefined,
      expirationDate: components[7] || undefined,
    };
  }

  parsePatientIdentifiers(field: string | undefined): PatientIdentifier[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parsePatientIdentifier(r));
  }

  parseHumanName(field: string): HumanName {
    const components = field.split(this.delimiters.component);
    return {
      familyName: components[0] || undefined,
      givenName: components[1] || undefined,
      middleInitialOrName: components[2] || undefined,
      suffix: components[3] || undefined,
      prefix: components[4] || undefined,
      degree: components[5] || undefined,
      nameTypeCode: components[6] as HumanName['nameTypeCode'],
      nameRepresentationCode: components[7] || undefined,
    };
  }

  parseHumanNames(field: string | undefined): HumanName[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parseHumanName(r));
  }

  parseAddress(field: string): Address {
    const components = field.split(this.delimiters.component);
    return {
      streetAddress: components[0] || undefined,
      otherDesignation: components[1] || undefined,
      city: components[2] || undefined,
      stateOrProvince: components[3] || undefined,
      zipOrPostalCode: components[4] || undefined,
      country: components[5] || undefined,
      addressType: components[6] as Address['addressType'],
      otherGeographicDesignation: components[7] || undefined,
      countyParishCode: components[8] || undefined,
      censusTract: components[9] || undefined,
    };
  }

  parseAddresses(field: string | undefined): Address[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parseAddress(r));
  }

  parseExtendedTelecom(field: string): ExtendedTelecom {
    const components = field.split(this.delimiters.component);
    return {
      telephoneNumber: components[0] || undefined,
      telecommunicationUseCode: components[1] as ExtendedTelecom['telecommunicationUseCode'],
      telecommunicationEquipmentType:
        components[2] as ExtendedTelecom['telecommunicationEquipmentType'],
      communicationAddress: components[3] || undefined,
      countryCode: components[4] ? parseInt(components[4], 10) : undefined,
      areaCityCode: components[5] ? parseInt(components[5], 10) : undefined,
      localNumber: components[6] ? parseInt(components[6], 10) : undefined,
      extension: components[7] ? parseInt(components[7], 10) : undefined,
      anyText: components[8] || undefined,
    };
  }

  parseExtendedTelecoms(field: string | undefined): ExtendedTelecom[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parseExtendedTelecom(r));
  }

  parseCodedElement(field: string | undefined): CodedElement | undefined {
    if (!field) return undefined;
    const components = field.split(this.delimiters.component);
    return {
      identifier: components[0] || undefined,
      text: components[1] || undefined,
      nameOfCodingSystem: components[2] || undefined,
      alternateIdentifier: components[3] || undefined,
      alternateText: components[4] || undefined,
      nameOfAlternateCodingSystem: components[5] || undefined,
      codingSystemVersionId: components[6] || undefined,
      alternateCodingSystemVersionId: components[7] || undefined,
      originalText: components[8] || undefined,
    };
  }

  parseCodedElements(field: string | undefined): CodedElement[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parseCodedElement(r)).filter((c): c is CodedElement => c !== undefined);
  }

  parseExtendedPerson(field: string): ExtendedPerson {
    const components = field.split(this.delimiters.component);
    return {
      idNumber: components[0] || undefined,
      familyName: components[1] || undefined,
      givenName: components[2] || undefined,
      middleInitialOrName: components[3] || undefined,
      suffix: components[4] || undefined,
      prefix: components[5] || undefined,
      degree: components[6] || undefined,
      sourceTable: components[7] || undefined,
      assigningAuthority: components[8] || undefined,
      nameTypeCode: components[9] || undefined,
      identifierCheckDigit: components[10] || undefined,
      checkDigitScheme: components[11] || undefined,
      identifierTypeCode: components[12] || undefined,
      assigningFacility: components[13] || undefined,
    };
  }

  parseExtendedPersons(field: string | undefined): ExtendedPerson[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parseExtendedPerson(r));
  }

  parseExtendedOrganization(field: string): ExtendedOrganization {
    const components = field.split(this.delimiters.component);
    return {
      organizationName: components[0] || undefined,
      organizationNameTypeCode: components[1] || undefined,
      idNumber: components[2] ? parseInt(components[2], 10) : undefined,
      identifierCheckDigit: components[3] || undefined,
      checkDigitScheme: components[4] || undefined,
      assigningAuthority: components[5] || undefined,
      identifierTypeCode: components[6] || undefined,
      assigningFacility: components[7] || undefined,
      nameRepresentationCode: components[8] || undefined,
      organizationIdentifier: components[9] || undefined,
    };
  }

  parseExtendedOrganizations(field: string | undefined): ExtendedOrganization[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parseExtendedOrganization(r));
  }

  parsePatientLocation(field: string): PatientLocation {
    const components = field.split(this.delimiters.component);
    return {
      pointOfCare: components[0] || undefined,
      room: components[1] || undefined,
      bed: components[2] || undefined,
      facility: components[3] || undefined,
      locationStatus: components[4] || undefined,
      personLocationType: components[5] || undefined,
      building: components[6] || undefined,
      floor: components[7] || undefined,
      locationDescription: components[8] || undefined,
    };
  }

  parseFinancialClass(field: string): FinancialClass {
    const components = field.split(this.delimiters.component);
    return {
      financialClassCode: components[0] || '',
      effectiveDate: components[1] || undefined,
    };
  }

  parseFinancialClasses(field: string | undefined): FinancialClass[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parseFinancialClass(r));
  }

  parseQuantity(field: string): Quantity {
    const components = field.split(this.delimiters.component);
    return {
      quantity: components[0] ? parseFloat(components[0]) : undefined,
      units: components[1] ? this.parseCodedElement(components[1]) : undefined,
    };
  }

  parseSpecimenSource(field: string): SpecimenSource {
    const components = field.split(this.delimiters.component);
    return {
      specimenSourceNameOrCode: components[0] ? this.parseCodedElement(components[0]) : undefined,
      additives: components[1] ? this.parseCodedElement(components[1]) : undefined,
      specimenCollectionMethod: components[2] || undefined,
      bodySite: components[3] ? this.parseCodedElement(components[3]) : undefined,
      siteModifier: components[4] ? this.parseCodedElement(components[4]) : undefined,
      collectionMethodModifierCode: components[5]
        ? this.parseCodedElement(components[5])
        : undefined,
      specimenRole: components[6] || undefined,
    };
  }

  parseErrorLocations(field: string): ERRSegment['errorLocation'] {
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => {
      const components = r.split(this.delimiters.component);
      return {
        segmentId: components[0] || undefined,
        segmentSequence: components[1] ? parseInt(components[1], 10) : undefined,
        fieldPosition: components[2] ? parseInt(components[2], 10) : undefined,
        componentNumber: components[3] ? parseInt(components[3], 10) : undefined,
        subComponentNumber: components[4] ? parseInt(components[4], 10) : undefined,
      };
    });
  }

  parseRepetitions(field: string | undefined): string[] {
    if (!field) return [];
    return field.split(this.delimiters.repetition);
  }
}
