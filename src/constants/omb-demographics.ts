/**
 * OMB 1997 Race & Ethnicity standards for ONC 170.315(a)(5) compliance.
 *
 * Canonical code lists used by:
 *   - profiles.race_omb_categories CHECK constraint
 *     (migration 20260528094229_onc_a5_demographics_race_ethnicity.sql)
 *   - profiles.ethnicity_omb CHECK constraint (same migration)
 *   - PatientDemographics.race_omb_categories type
 *   - Demographics form select options
 *
 * If you change a code here, update the SQL constraint to match — they MUST
 * stay in lockstep or inserts will fail.
 *
 * Code system references:
 *   - OMB 1997 Statistical Policy Directive No. 15:
 *     https://www.govinfo.gov/content/pkg/FR-1997-10-30/pdf/97-28653.pdf
 *   - USCDI v3 (Race / Ethnicity):
 *     https://www.healthit.gov/isa/sites/isa/files/2023-09/USCDI-Version-3-July-2022-Final.pdf
 *   - FHIR US Core OMB race/ethnicity value sets:
 *     https://www.hl7.org/fhir/us/core/ValueSet-omb-race-category.html
 *     https://www.hl7.org/fhir/us/core/ValueSet-omb-ethnicity-category.html
 */

export const OMB_RACE_CATEGORIES = [
  'american-indian-or-alaska-native',
  'asian',
  'black-or-african-american',
  'native-hawaiian-or-pacific-islander',
  'white',
  'other',
  'asked-but-unknown',
  'unknown',
  'asked-declined',
] as const;

export type OmbRaceCategory = (typeof OMB_RACE_CATEGORIES)[number];

export const OMB_ETHNICITY_VALUES = [
  'hispanic-or-latino',
  'not-hispanic-or-latino',
  'asked-but-unknown',
  'unknown',
  'asked-declined',
] as const;

export type OmbEthnicityValue = (typeof OMB_ETHNICITY_VALUES)[number];

/**
 * Display labels for the demographics form. Keep aligned with OMB_RACE_CATEGORIES.
 */
export const OMB_RACE_LABELS: Record<OmbRaceCategory, string> = {
  'american-indian-or-alaska-native': 'American Indian or Alaska Native',
  'asian': 'Asian',
  'black-or-african-american': 'Black or African American',
  'native-hawaiian-or-pacific-islander': 'Native Hawaiian or Other Pacific Islander',
  'white': 'White',
  'other': 'Other',
  'asked-but-unknown': 'Unknown',
  'unknown': 'Unknown',
  'asked-declined': 'Prefer not to say',
};

export const OMB_ETHNICITY_LABELS: Record<OmbEthnicityValue, string> = {
  'hispanic-or-latino': 'Hispanic or Latino',
  'not-hispanic-or-latino': 'Not Hispanic or Latino',
  'asked-but-unknown': 'Unknown',
  'unknown': 'Unknown',
  'asked-declined': 'Prefer not to say',
};

/**
 * The 5 OMB minimum categories displayed in the primary race multi-select.
 * "other" and the nullFlavor codes are surfaced through separate UI controls
 * (e.g., a "Prefer not to say" checkbox) rather than mixed into the same list,
 * so users don't see "Unknown" as a selectable race.
 */
export const OMB_RACE_PRIMARY: OmbRaceCategory[] = [
  'american-indian-or-alaska-native',
  'asian',
  'black-or-african-american',
  'native-hawaiian-or-pacific-islander',
  'white',
];

export function isOmbRaceCategory(value: unknown): value is OmbRaceCategory {
  return typeof value === 'string' && (OMB_RACE_CATEGORIES as readonly string[]).includes(value);
}

export function isOmbEthnicityValue(value: unknown): value is OmbEthnicityValue {
  return typeof value === 'string' && (OMB_ETHNICITY_VALUES as readonly string[]).includes(value);
}
