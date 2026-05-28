/**
 * FHIR R4 Device + DeviceUseStatement Types
 *
 * Backs ONC 170.315(a)(14) Implantable Device List.
 *
 * Mirrors the shape of fhir_devices + fhir_device_use_statements in the
 * database (migration 20260528120000_create_fhir_devices.sql).
 *
 * @see https://hl7.org/fhir/R4/device.html
 * @see https://hl7.org/fhir/R4/deviceusestatement.html
 */

import type { FHIRResource } from './base';

export type DeviceStatus =
  | 'active'
  | 'inactive'
  | 'entered-in-error'
  | 'unknown';

export interface Device extends FHIRResource {
  patient_id: string;

  /** Human-readable form of the UDI (full barcode string per FDA UDI Rule) */
  udi_carrier_hrf?: string;
  /** Device Identifier (DI) portion of the UDI — manufacturer catalog number */
  udi_device_identifier?: string;
  /** Issuing agency OID (GS1, HIBCC, ICCBBA, etc.) */
  udi_issuer?: string;
  udi_jurisdiction?: string;

  status: DeviceStatus;

  /** SNOMED CT code for device type (e.g., 'Coronary artery stent') */
  device_type_system?: string;
  device_type_code?: string;
  device_type_display: string;

  manufacturer?: string;
  model_number?: string;
  part_number?: string;
  serial_number?: string;
  lot_number?: string;

  manufacture_date?: string;
  expiration_date?: string;

  note?: string;

  external_id?: string;
  last_synced_at?: string;
  sync_source?: string;

  tenant_id?: string;
}

export interface CreateDevice extends Partial<Device> {
  patient_id: string;
  status: DeviceStatus;
  device_type_display: string;
}

export type DeviceUseStatementStatus =
  | 'active'
  | 'completed'
  | 'entered-in-error'
  | 'intended'
  | 'stopped'
  | 'on-hold';

export interface DeviceUseStatement extends FHIRResource {
  patient_id: string;
  device_id: string;

  status: DeviceUseStatementStatus;

  /** When the statement was recorded */
  recorded_on: string;

  /** When the device was/will be used (implant or first-use moment) */
  timing_datetime?: string;
  timing_period_start?: string;
  timing_period_end?: string;

  /** Recording practitioner */
  source_user_id?: string;
  source_practitioner_id?: string;
  source_display?: string;

  /** Anatomic site of the device */
  body_site_system?: string;
  body_site_code?: string;
  body_site_display?: string;

  reason_code?: string[];
  reason_reference?: string[];

  note?: string;

  external_id?: string;

  tenant_id?: string;
}

export interface CreateDeviceUseStatement extends Partial<DeviceUseStatement> {
  patient_id: string;
  device_id: string;
  status: DeviceUseStatementStatus;
  recorded_on: string;
}
