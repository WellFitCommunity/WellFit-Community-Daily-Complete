/**
 * Constants for the Family Health History capture form (ONC 170.315(a)(12)).
 *
 * Relationship codes use the FHIR-recommended HL7 v3 RoleCode value set
 * (the FamilyMemberHistory.relationship binding).
 *
 * @see https://terminology.hl7.org/CodeSystem-v3-RoleCode.html
 */

export const RELATIONSHIP_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-RoleCode';

export interface RelationshipOption {
  code: string;
  label: string;
}

/** Common first/second-degree relatives used in family-history intake. */
export const RELATIONSHIP_OPTIONS: RelationshipOption[] = [
  { code: 'MTH', label: 'Mother' },
  { code: 'FTH', label: 'Father' },
  { code: 'SIS', label: 'Sister' },
  { code: 'BRO', label: 'Brother' },
  { code: 'DAU', label: 'Daughter' },
  { code: 'SON', label: 'Son' },
  { code: 'MGRMTH', label: 'Maternal grandmother' },
  { code: 'MGRFTH', label: 'Maternal grandfather' },
  { code: 'PGRMTH', label: 'Paternal grandmother' },
  { code: 'PGRFTH', label: 'Paternal grandfather' },
  { code: 'AUNT', label: 'Aunt' },
  { code: 'UNCLE', label: 'Uncle' },
  { code: 'COUSN', label: 'Cousin' },
  { code: 'NIECE', label: 'Niece' },
  { code: 'NEPHEW', label: 'Nephew' },
  { code: 'GRNDCHILD', label: 'Grandchild' },
];

export const SEX_SYSTEM = 'http://hl7.org/fhir/administrative-gender';

export interface SexOption {
  code: 'male' | 'female' | 'other' | 'unknown';
  label: string;
}

export const SEX_OPTIONS: SexOption[] = [
  { code: 'male', label: 'Male' },
  { code: 'female', label: 'Female' },
  { code: 'other', label: 'Other' },
  { code: 'unknown', label: 'Unknown' },
];
