/**
 * Types for the Implantable Devices panel (ONC 170.315(a)(14)).
 *
 * The Add form creates BOTH a Device record AND its initial active
 * DeviceUseStatement in one user submit — they always come as a pair
 * (a device without a use-statement isn't clinically useful, and a
 * use-statement requires a Device FK).
 */

import type { FormLaterality } from '../../../../constants/cpoe';

export interface AddDeviceFormData {
  /** Human-readable form of the UDI barcode (FDA UDI Rule) */
  udi_carrier_hrf: string;
  /** Device Identifier — manufacturer's catalog number */
  udi_device_identifier: string;

  /** SNOMED CT code for the device type — optional */
  device_type_code: string;
  /** Display label for the device type — REQUIRED (e.g., "Coronary stent") */
  device_type_display: string;

  manufacturer: string;
  model_number: string;
  serial_number: string;
  lot_number: string;

  /** ISO date (YYYY-MM-DD) for manufacture / expiration */
  manufacture_date: string;
  expiration_date: string;

  /** ISO date (YYYY-MM-DD) — when the device was implanted */
  implant_date: string;

  /** Body site code (SNOMED CT) from BODY_SITES */
  body_site_code: string;
  body_site_display: string;
  /** 'na' maps to undefined; the others map onto FHIR ServiceRequestLaterality */
  laterality: FormLaterality;

  /** Indication (ICD-10 / SNOMED / free text) */
  reason: string;

  /** Optional free-text clinician note */
  note: string;
}

export const INITIAL_ADD_DEVICE_FORM: AddDeviceFormData = {
  udi_carrier_hrf: '',
  udi_device_identifier: '',
  device_type_code: '',
  device_type_display: '',
  manufacturer: '',
  model_number: '',
  serial_number: '',
  lot_number: '',
  manufacture_date: '',
  expiration_date: '',
  implant_date: '',
  body_site_code: '',
  body_site_display: '',
  laterality: 'na',
  reason: '',
  note: '',
};

export interface AddDeviceFormProps {
  /** Patient receiving the device (auth.users.id) */
  patientId: string;

  /** Called after BOTH the Device and DeviceUseStatement persist */
  onSubmitted?: (deviceId: string) => void;

  /** Called when the user cancels out of the form */
  onCancel?: () => void;
}

export interface AddDeviceSubmitError {
  message: string;
  /**
   * The Device was created but the DeviceUseStatement failed. Surfaced
   * to the user so they know a partial record exists (it WILL appear in
   * the list once status becomes 'active' on a future statement).
   */
  partial?: boolean;
}

export interface ImplantableDevicesPanelProps {
  /** Patient whose devices to list / add to */
  patientId: string;
}
