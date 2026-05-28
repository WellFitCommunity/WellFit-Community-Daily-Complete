/**
 * Types for the Lab CPOE form (ONC 170.315(a)(2)).
 *
 * Parallel to MedicationOrderForm.types but tuned for lab orders:
 * no dosage; adds specimen type + fasting flag instead.
 */

import type { OrderPriority } from '../../../../constants/cpoe';

export interface LabOrderFormData {
  /**
   * LOINC code for the lab test/panel. Empty when provider hand-entered
   * the test name without a code.
   */
  test_code: string;

  /** Code system OID — defaults to LOINC */
  test_code_system: string;

  /**
   * Human-readable test/panel name. E.g. "Comprehensive Metabolic Panel"
   * or "Hemoglobin A1c".
   */
  test_display: string;

  /** SNOMED CT specimen-type code or 'other' */
  specimen_code: string;

  /** Specimen type display label */
  specimen_display: string;

  /** Whether the patient must fast before collection */
  fasting_required: boolean;

  /** Indication / reason (free text or ICD-10/SNOMED code) */
  indication: string;

  /** Order priority */
  priority: OrderPriority;

  /** Patient-facing prep instructions (collection time, fasting reminders) */
  patient_instruction: string;

  /** Clinical notes (provider-only) */
  note: string;
}

export const INITIAL_LAB_FORM_DATA: LabOrderFormData = {
  test_code: '',
  test_code_system: 'http://loinc.org',
  test_display: '',
  specimen_code: '',
  specimen_display: '',
  fasting_required: false,
  indication: '',
  priority: 'routine',
  patient_instruction: '',
  note: '',
};

export interface LabOrderFormProps {
  /** Patient receiving the lab order (auth.users.id) */
  patientId: string;

  /** Optional encounter context (admission, ED visit) */
  encounterId?: string;

  /** Called after a successful submit with the created ServiceRequest's ID */
  onSubmitted?: (serviceRequestId: string) => void;

  /** Called when the user cancels out of the form */
  onCancel?: () => void;
}

export interface LabOrderSubmitError {
  message: string;
}
