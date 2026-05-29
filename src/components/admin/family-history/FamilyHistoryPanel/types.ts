/**
 * Types for the Family Health History panel (ONC 170.315(a)(12)).
 *
 * The Add form creates BOTH a FamilyMemberHistory record AND its initial
 * condition in one user submit — a family-history entry exists to record a
 * condition (e.g., "mother — type 2 diabetes, onset age 50"), so the two come
 * as a pair, mirroring the Device + DeviceUseStatement pattern (ONC-5).
 */

import type { FamilyMemberSex } from '../../../../types/fhir';

export interface AddFamilyHistoryFormData {
  /** Relationship code (v3-RoleCode, e.g. 'MTH') — REQUIRED */
  relationship_code: string;
  /** Relationship label (e.g., "Mother") — derived from the code */
  relationship_display: string;

  /** Optional free-text member label (e.g., "Maternal grandmother, Rose") */
  name: string;

  /** Administrative gender of the member */
  sex_code: FamilyMemberSex | '';

  /** Is the family member deceased? */
  deceased: boolean;
  /** Age at death, free text (e.g., "78 yr") — only when deceased */
  deceased_age: string;

  /** The condition (ICD-10 / SNOMED / free text) — REQUIRED */
  condition_display: string;
  /** Optional SNOMED/ICD code for the condition */
  condition_code: string;
  /** Age at onset (the ONC (a)(12) field), free text (e.g., "50 yr") */
  onset_age: string;
  /** Did this condition contribute to the member's death? */
  contributed_to_death: boolean;

  /** Optional free-text clinician note */
  note: string;
}

export const INITIAL_ADD_FAMILY_HISTORY_FORM: AddFamilyHistoryFormData = {
  relationship_code: '',
  relationship_display: '',
  name: '',
  sex_code: '',
  deceased: false,
  deceased_age: '',
  condition_display: '',
  condition_code: '',
  onset_age: '',
  contributed_to_death: false,
  note: '',
};

export interface AddFamilyHistoryFormProps {
  /** Patient whose family history this belongs to (auth.users.id) */
  patientId: string;
  /** Called after BOTH the member and the condition persist */
  onSubmitted?: (familyMemberHistoryId: string) => void;
  /** Called when the user cancels out of the form */
  onCancel?: () => void;
}

export interface AddFamilyHistorySubmitError {
  message: string;
  /**
   * The member record was created but the condition failed. Surfaced so the
   * user knows a partial record exists (the member appears in the list, just
   * without its condition until one is added).
   */
  partial?: boolean;
}

export interface FamilyHistoryPanelProps {
  /** Patient whose family history to list / add to */
  patientId: string;
}
