/**
 * Encounter Provider Assignment Types
 *
 * Defines provider roles and assignment tracking for clinical encounters.
 * A doctor's office encounter requires at minimum an attending provider.
 * Additional roles (supervising, referring, consulting) are optional.
 *
 * Used by: encounterProviderService, encounterStateMachine, billing
 */

/** Provider roles for encounter assignments */
export const ENCOUNTER_PROVIDER_ROLES = [
  'attending',
  'supervising',
  'referring',
  'consulting',
] as const;

export type EncounterProviderRole = (typeof ENCOUNTER_PROVIDER_ROLES)[number];

/** Provider assignment record */
export interface EncounterProvider {
  id: string;
  encounter_id: string;
  provider_id: string;
  role: EncounterProviderRole;
  is_primary: boolean;
  assigned_at: string;
  assigned_by: string | null;
  removed_at: string | null;
  removed_by: string | null;
  notes: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

/** Provider assignment with joined provider details */
export interface EncounterProviderWithDetails extends EncounterProvider {
  provider: {
    id: string;
    npi: string;
    organization_name: string | null;
    taxonomy_code: string | null;
    user_id: string | null;
  };
}

/** Provider assignment audit record */
export interface EncounterProviderAudit {
  id: string;
  encounter_id: string;
  provider_id: string;
  role: EncounterProviderRole;
  action: 'assigned' | 'removed' | 'role_changed';
  previous_role: EncounterProviderRole | null;
  changed_by: string | null;
  changed_at: string;
  reason: string | null;
  tenant_id: string;
}

/** Result from assign_encounter_provider RPC */
export interface AssignProviderResult {
  success: boolean;
  assignment_id?: string;
  encounter_id?: string;
  provider_id?: string;
  role?: string;
  error?: string;
  code?: string;
}

/** Result from remove_encounter_provider RPC */
export interface RemoveProviderResult {
  success: boolean;
  assignment_id?: string;
  encounter_id?: string;
  role?: string;
  error?: string;
  code?: string;
}

/** Provider validation result from validate_encounter_provider */
export interface ProviderValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

/** Role display metadata for UI */
export interface ProviderRoleMeta {
  label: string;
  description: string;
  required: boolean;
  maxPerEncounter: number;
}

export const ROLE_DISPLAY: Record<EncounterProviderRole, ProviderRoleMeta> = {
  attending: {
    label: 'Attending Provider',
    description: 'Primary provider responsible for the encounter',
    required: true,
    maxPerEncounter: 1,
  },
  supervising: {
    label: 'Supervising Provider',
    description: 'Physician supervising an NP/PA encounter',
    required: false,
    maxPerEncounter: 1,
  },
  referring: {
    label: 'Referring Provider',
    description: 'Provider who referred the patient',
    required: false,
    maxPerEncounter: 1,
  },
  consulting: {
    label: 'Consulting Provider',
    description: 'Specialist consulted during the encounter',
    required: false,
    maxPerEncounter: 4,
  },
};

// Type guards
export function isEncounterProviderRole(value: unknown): value is EncounterProviderRole {
  return typeof value === 'string' && ENCOUNTER_PROVIDER_ROLES.includes(value as EncounterProviderRole);
}
