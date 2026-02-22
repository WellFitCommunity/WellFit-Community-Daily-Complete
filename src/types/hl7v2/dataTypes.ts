/**
 * HL7 v2.x Supporting Data Types
 *
 * Reusable data type interfaces used across HL7 segment definitions:
 * PatientIdentifier, HumanName, Address, CodedElement, ExtendedPerson, etc.
 */

// ============================================================================
// SUPPORTING DATA TYPES
// ============================================================================

export interface PatientIdentifier {
  id: string;
  checkDigit?: string;
  checkDigitScheme?: string;
  assigningAuthority?: string;
  identifierTypeCode?: string;      // MR=Medical Record, SS=SSN, DL=Driver's License, etc.
  assigningFacility?: string;
  effectiveDate?: string;
  expirationDate?: string;
}

export interface HumanName {
  familyName?: string;
  givenName?: string;
  middleInitialOrName?: string;
  suffix?: string;
  prefix?: string;
  degree?: string;
  nameTypeCode?: 'A' | 'B' | 'C' | 'D' | 'L' | 'M' | 'N' | 'S' | 'T';
  nameRepresentationCode?: string;
  nameContext?: CodedElement;
  nameValidityRange?: DateRange;
  nameAssemblyOrder?: 'F' | 'G';
}

export interface Address {
  streetAddress?: string;
  otherDesignation?: string;
  city?: string;
  stateOrProvince?: string;
  zipOrPostalCode?: string;
  country?: string;
  addressType?: 'B' | 'C' | 'F' | 'H' | 'L' | 'M' | 'N' | 'O' | 'P' | 'RH' | 'S' | 'V';
  otherGeographicDesignation?: string;
  countyParishCode?: string;
  censusTract?: string;
  addressRepresentationCode?: string;
  addressValidityRange?: DateRange;
  effectiveDate?: string;
  expirationDate?: string;
}

export interface ExtendedTelecom {
  telephoneNumber?: string;
  telecommunicationUseCode?: 'ASN' | 'BPN' | 'EMR' | 'NET' | 'ORN' | 'PRN' | 'VHN' | 'WPN';
  telecommunicationEquipmentType?: 'BP' | 'CP' | 'FX' | 'Internet' | 'MD' | 'PH' | 'SAT' | 'TDD' | 'TTY' | 'X.400';
  communicationAddress?: string;    // email, URL, etc.
  countryCode?: number;
  areaCityCode?: number;
  localNumber?: number;
  extension?: number;
  anyText?: string;
  extensionPrefix?: string;
  speedDialCode?: string;
  unformattedTelephoneNumber?: string;
  effectiveStartDate?: string;
  expirationDate?: string;
  expirationReason?: CodedElement;
  protectionCode?: CodedElement;
  sharedTelecommunicationIdentifier?: string;
  preferenceOrder?: number;
}

export interface CodedElement {
  identifier?: string;
  text?: string;
  nameOfCodingSystem?: string;      // ICD10, SNOMED, LOINC, etc.
  alternateIdentifier?: string;
  alternateText?: string;
  nameOfAlternateCodingSystem?: string;
  codingSystemVersionId?: string;
  alternateCodingSystemVersionId?: string;
  originalText?: string;
}

export interface ExtendedPerson {
  idNumber?: string;
  familyName?: string;
  givenName?: string;
  middleInitialOrName?: string;
  suffix?: string;
  prefix?: string;
  degree?: string;
  sourceTable?: string;
  assigningAuthority?: string;
  nameTypeCode?: string;
  identifierCheckDigit?: string;
  checkDigitScheme?: string;
  identifierTypeCode?: string;
  assigningFacility?: string;
  nameRepresentationCode?: string;
  nameContext?: CodedElement;
  nameValidityRange?: DateRange;
  nameAssemblyOrder?: string;
  effectiveDate?: string;
  expirationDate?: string;
  professionalSuffix?: string;
  assigningJurisdiction?: CodedElement;
  assigningAgencyOrDepartment?: CodedElement;
}

export interface ExtendedOrganization {
  organizationName?: string;
  organizationNameTypeCode?: string;
  idNumber?: number;
  identifierCheckDigit?: string;
  checkDigitScheme?: string;
  assigningAuthority?: string;
  identifierTypeCode?: string;
  assigningFacility?: string;
  nameRepresentationCode?: string;
  organizationIdentifier?: string;
}

export interface PatientLocation {
  pointOfCare?: string;             // Nursing unit, ward
  room?: string;
  bed?: string;
  facility?: string;
  locationStatus?: string;
  personLocationType?: string;
  building?: string;
  floor?: string;
  locationDescription?: string;
  comprehensiveLocationIdentifier?: string;
  assigningAuthorityForLocation?: string;
}

export interface DischargeLocation {
  dischargeToLocation?: string;
  effectiveDate?: string;
}

export interface FinancialClass {
  financialClassCode: string;
  effectiveDate?: string;
}

export interface Quantity {
  quantity?: number;
  units?: CodedElement;
}

export interface SpecimenSource {
  specimenSourceNameOrCode?: CodedElement;
  additives?: CodedElement;
  specimenCollectionMethod?: string;
  bodySite?: CodedElement;
  siteModifier?: CodedElement;
  collectionMethodModifierCode?: CodedElement;
  specimenRole?: string;
}

export interface ParentResult {
  parentObservationIdentifier?: CodedElement;
  parentObservationSubIdentifier?: string;
  parentObservationValueDescriptor?: string;
}

export interface ParentOrder {
  placerAssignedIdentifier?: string;
  fillerAssignedIdentifier?: string;
}

export interface DateRange {
  rangeStartDateTime?: string;
  rangeEndDateTime?: string;
}

export interface ErrorLocation {
  segmentId?: string;
  segmentSequence?: number;
  fieldPosition?: number;
  componentNumber?: number;
  subComponentNumber?: number;
}
