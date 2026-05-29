/**
 * Constants for break-the-glass emergency access (ONC 170.315(d)(6)).
 */

export interface EmergencyAccessReason {
  value: string;
  label: string;
}

/**
 * Common justifications for emergency access. A reason is mandatory (enforced
 * client-side AND in grant_emergency_access). "Other" pairs with the free-text
 * explanation field.
 */
export const EMERGENCY_ACCESS_REASONS: EmergencyAccessReason[] = [
  { value: 'life_threatening', label: 'Life-threatening emergency' },
  { value: 'emergency_treatment', label: 'Emergency treatment — patient under my care' },
  { value: 'patient_unable_to_consent', label: 'Patient unable to consent (unconscious/incapacitated)' },
  { value: 'continuity_of_care', label: 'Continuity of care — covering provider' },
  { value: 'other', label: 'Other (explain below)' },
];

/** Duration options (minutes). Server clamps to 5..480; default 60. */
export interface EmergencyAccessDuration {
  minutes: number;
  label: string;
}

export const EMERGENCY_ACCESS_DURATIONS: EmergencyAccessDuration[] = [
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 240, label: '4 hours' },
];

export const DEFAULT_EMERGENCY_ACCESS_MINUTES = 60;
