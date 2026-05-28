/**
 * Types for the Medication CPOE form (ONC 170.315(a)(1)).
 *
 * The form's internal state holds free-typed user input. On submit it gets
 * mapped into a FHIR R4 CreateMedicationRequest shape (see types/fhir/medications.ts)
 * before being passed to MedicationRequestService.create().
 */

import type { OrderPriority } from '../../../../constants/cpoe';

export interface MedicationOrderFormData {
  /** RxNorm code (or empty if the provider hand-entered) */
  medication_code: string;

  /** Code system — defaults to RxNorm OID; can be overridden if free-text */
  medication_code_system: string;

  /** National Drug Code (11-digit FDA NDC). Optional — when provided
   *  enables ONC 170.315(a)(10) formulary lookup. */
  ndc_code: string;

  /** Display name (drug + strength + form, e.g. "Lisinopril 10 mg tablet") */
  medication_display: string;

  /** Dosage amount (numeric string while typing; parsed on submit) */
  dose_quantity: string;

  /** Dosage unit (mg, mL, tablet, etc.) — from DOSAGE_UNITS */
  dose_unit: string;

  /** SNOMED CT route code */
  route_code: string;

  /** SNOMED CT route display */
  route_display: string;

  /** Frequency preset key (or "custom" if entering raw timing) */
  frequency_preset: string;

  /** Optional patient-facing instructions (the "sig") */
  patient_instruction: string;

  /** Indication / reason (free text or ICD-10/SNOMED code) */
  indication: string;

  /** Order priority */
  priority: OrderPriority;

  /** Clinical notes (provider-only, never on the bottle label) */
  note: string;
}

export const INITIAL_FORM_DATA: MedicationOrderFormData = {
  medication_code: '',
  medication_code_system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
  ndc_code: '',
  medication_display: '',
  dose_quantity: '',
  dose_unit: '',
  route_code: '',
  route_display: '',
  frequency_preset: '',
  patient_instruction: '',
  indication: '',
  priority: 'routine',
  note: '',
};

export interface MedicationOrderFormProps {
  /** Patient receiving the medication (auth.users.id) */
  patientId: string;

  /** Optional encounter context (admission, ED visit) */
  encounterId?: string;

  /** Called after a successful submit with the created MedicationRequest's ID */
  onSubmitted?: (medicationRequestId: string) => void;

  /** Called when the user cancels out of the form */
  onCancel?: () => void;
}

export interface MedicationOrderSubmitError {
  /** User-facing error message — already friendly, safe to render */
  message: string;
  /** True if the failure was a hard allergy-alert block from the service */
  isAllergyAlert: boolean;
}
