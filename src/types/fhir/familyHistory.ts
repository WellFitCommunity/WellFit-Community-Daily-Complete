/**
 * FHIR R4 FamilyMemberHistory Types
 *
 * Backs ONC 170.315(a)(12) Family Health History.
 *
 * Mirrors fhir_family_member_history + fhir_family_member_history_conditions
 * in the database (migration 20260529130000_create_fhir_family_member_history.sql).
 *
 * Modeled as a parent (the member) + child (their conditions) pair, the same
 * shape as Device + DeviceUseStatement (ONC-5).
 *
 * @see https://hl7.org/fhir/R4/familymemberhistory.html
 */

import type { FHIRResource } from './base';

export type FamilyMemberHistoryStatus =
  | 'partial'
  | 'completed'
  | 'entered-in-error'
  | 'health-unknown';

export type FamilyMemberSex = 'male' | 'female' | 'other' | 'unknown';

export interface FamilyMemberHistory extends FHIRResource {
  patient_id: string;

  status: FamilyMemberHistoryStatus;

  /** Relationship to the patient (FHIR uses v3-RoleCode: MTH, FTH, ...) */
  relationship_system?: string;
  relationship_code?: string;
  relationship_display: string;

  /** Optional free-text label (e.g., "Maternal grandmother") */
  name?: string;

  sex_code?: FamilyMemberSex;
  sex_display?: string;

  born_date?: string;
  born_string?: string;

  /** Current age display string (e.g., "72 yr") */
  age_string?: string;

  deceased_boolean?: boolean;
  deceased_age_string?: string;
  deceased_date?: string;

  note?: string;

  tenant_id?: string;
}

export interface CreateFamilyMemberHistory extends Partial<FamilyMemberHistory> {
  patient_id: string;
  status: FamilyMemberHistoryStatus;
  relationship_display: string;
}

export interface FamilyMemberHistoryCondition extends FHIRResource {
  patient_id: string;
  family_member_history_id: string;

  condition_system?: string;
  condition_code?: string;
  condition_display: string;

  outcome_code?: string;
  outcome_display?: string;

  contributed_to_death?: boolean;

  /** Age at onset — the field ONC (a)(12) evaluates */
  onset_age_string?: string;
  onset_date?: string;
  onset_string?: string;

  note?: string;

  tenant_id?: string;
}

export interface CreateFamilyMemberHistoryCondition
  extends Partial<FamilyMemberHistoryCondition> {
  patient_id: string;
  family_member_history_id: string;
  condition_display: string;
}
