/**
 * Types for the Imaging CPOE form (ONC 170.315(a)(3)).
 *
 * Parallel to LabOrderForm.types but tuned for imaging orders:
 * no specimen / fasting fields; adds modality + body site +
 * laterality + contrast.
 *
 * The persisted resource is a FHIR R4 ServiceRequest with
 * category=['imaging'] — the same table that backs lab orders.
 */

import type { FormLaterality, OrderPriority } from '../../../../constants/cpoe';

export interface ImagingOrderFormData {
  /** DICOM modality code (e.g., 'CT', 'MR', 'DX') */
  modality_code: string;

  /** DICOM modality display label */
  modality_display: string;

  /**
   * Human-readable study description.
   * E.g. "Chest with IV contrast" or "Abdomen and pelvis".
   */
  study_description: string;

  /**
   * Optional CPT procedure code for the imaging study.
   * Empty when the provider hand-entered the study without a code.
   */
  cpt_code: string;

  /** SNOMED CT BodyStructure code or 'other' */
  body_site_code: string;

  /** Body-site display label */
  body_site_display: string;

  /** Laterality. 'na' maps to undefined on the persisted ServiceRequest. */
  laterality: FormLaterality;

  /** Whether contrast is required for this study */
  contrast_required: boolean;

  /** Clinical indication (free text or ICD-10/SNOMED code) */
  indication: string;

  /** Order priority */
  priority: OrderPriority;

  /** Patient-facing prep instructions */
  patient_instruction: string;

  /** Clinical notes (provider-only) */
  note: string;
}

export const INITIAL_IMAGING_FORM_DATA: ImagingOrderFormData = {
  modality_code: '',
  modality_display: '',
  study_description: '',
  cpt_code: '',
  body_site_code: '',
  body_site_display: '',
  laterality: 'na',
  contrast_required: false,
  indication: '',
  priority: 'routine',
  patient_instruction: '',
  note: '',
};

export interface ImagingOrderFormProps {
  /** Patient receiving the imaging order (auth.users.id) */
  patientId: string;

  /** Optional encounter context (admission, ED visit) */
  encounterId?: string;

  /** Called after a successful submit with the created ServiceRequest's ID */
  onSubmitted?: (serviceRequestId: string) => void;

  /** Called when the user cancels out of the form */
  onCancel?: () => void;
}

export interface ImagingOrderSubmitError {
  message: string;
}
