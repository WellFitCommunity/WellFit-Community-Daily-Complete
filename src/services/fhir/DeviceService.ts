/**
 * FHIR Device Service
 *
 * Backs ONC 170.315(a)(14) Implantable Device List. The service is responsible
 * for CRUD on the patient's Device resources; the clinical *use* of each
 * device (implant date, body site, reason) lives on DeviceUseStatement and
 * is handled by DeviceUseStatementService.
 *
 * FHIR R4 Resource: Device
 * HIPAA §164.312(b): PHI access logged via auditLogger.phi on every operation.
 *
 * Pattern parity with ServiceRequestService (ONC-2/3) — same audit / error /
 * return shape so the UI components stay consistent.
 *
 * @see https://hl7.org/fhir/R4/device.html
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  Device,
  CreateDevice,
  FHIRApiResponse,
} from '../../types/fhir';
import { auditLogger } from '../auditLogger';

const SELECT_COLS =
  'id, fhir_id, patient_id, udi_carrier_hrf, udi_device_identifier, udi_issuer, udi_jurisdiction, status, device_type_system, device_type_code, device_type_display, manufacturer, model_number, part_number, serial_number, lot_number, manufacture_date, expiration_date, note, external_id, last_synced_at, sync_source, tenant_id, created_at, updated_at';

export class DeviceService {
  /** All Devices on a patient, regardless of status. */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<Device[]>> {
    try {
      await auditLogger.phi('DEVICE_LIST_READ', patientId, {
        resourceType: 'Device',
        operation: 'getByPatient',
      });

      const { data, error } = await supabase
        .from('fhir_devices')
        .select(SELECT_COLS)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch devices',
      };
    }
  }

  /**
   * Only currently-active devices on a patient. "Active" = status='active'.
   * This is the list used to render the ONC (a)(14) Implantable Device panel.
   */
  static async getActive(patientId: string): Promise<FHIRApiResponse<Device[]>> {
    try {
      await auditLogger.phi('DEVICE_ACTIVE_READ', patientId, {
        resourceType: 'Device',
        operation: 'getActive',
      });

      const { data, error } = await supabase
        .from('fhir_devices')
        .select(SELECT_COLS)
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch active devices',
      };
    }
  }

  /**
   * Create a new Device record. RLS requires tenant_id = get_current_tenant_id();
   * the caller MUST resolve tenant_id from useOrderingProvider (or equivalent)
   * before invoking this method.
   */
  static async create(device: CreateDevice): Promise<FHIRApiResponse<Device>> {
    try {
      await auditLogger.phi('DEVICE_CREATE', device.patient_id, {
        resourceType: 'Device',
        operation: 'create',
        udi_di: device.udi_device_identifier,
        type: device.device_type_display,
      });

      const { data, error } = await supabase
        .from('fhir_devices')
        .insert([device])
        .select(SELECT_COLS)
        .single();

      if (error) throw new Error(error.message);
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create device',
      };
    }
  }

  /** Update an existing Device (status change, correction, sync update). */
  static async update(
    id: string,
    updates: Partial<Device>
  ): Promise<FHIRApiResponse<Device>> {
    try {
      const { data, error } = await supabase
        .from('fhir_devices')
        .update(updates)
        .eq('id', id)
        .select(SELECT_COLS)
        .single();

      if (error) throw new Error(error.message);
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update device',
      };
    }
  }
}
