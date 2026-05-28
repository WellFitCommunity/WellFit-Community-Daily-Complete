/**
 * FHIR DeviceUseStatement Service
 *
 * Backs ONC 170.315(a)(14) Implantable Device List. DeviceUseStatement
 * records the clinical *use* of a Device — implant date, body site,
 * recording practitioner, reason. One Device may have multiple
 * DeviceUseStatements over time (insertion → revision → removal).
 *
 * FHIR R4 Resource: DeviceUseStatement
 * HIPAA §164.312(b): PHI access logged via auditLogger.phi on every operation.
 *
 * Pattern parity with DeviceService — same audit / error / return shape.
 *
 * @see https://hl7.org/fhir/R4/deviceusestatement.html
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  DeviceUseStatement,
  CreateDeviceUseStatement,
  FHIRApiResponse,
} from '../../types/fhir';
import { auditLogger } from '../auditLogger';

const SELECT_COLS =
  'id, fhir_id, patient_id, device_id, status, recorded_on, timing_datetime, timing_period_start, timing_period_end, source_user_id, source_practitioner_id, source_display, body_site_system, body_site_code, body_site_display, reason_code, reason_reference, note, external_id, tenant_id, created_at, updated_at';

export class DeviceUseStatementService {
  /** All DeviceUseStatement records on a patient. */
  static async getByPatient(
    patientId: string
  ): Promise<FHIRApiResponse<DeviceUseStatement[]>> {
    try {
      await auditLogger.phi('DEVICE_USE_STATEMENT_LIST_READ', patientId, {
        resourceType: 'DeviceUseStatement',
        operation: 'getByPatient',
      });

      const { data, error } = await supabase
        .from('fhir_device_use_statements')
        .select(SELECT_COLS)
        .eq('patient_id', patientId)
        .order('recorded_on', { ascending: false });

      if (error) throw new Error(error.message);
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch device use statements',
      };
    }
  }

  /** All DeviceUseStatement records on a specific Device. */
  static async getByDevice(
    deviceId: string
  ): Promise<FHIRApiResponse<DeviceUseStatement[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_device_use_statements')
        .select(SELECT_COLS)
        .eq('device_id', deviceId)
        .order('recorded_on', { ascending: false });

      if (error) throw new Error(error.message);
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch device use statements',
      };
    }
  }

  /**
   * Create a new DeviceUseStatement. RLS requires tenant_id =
   * get_current_tenant_id(); the caller MUST resolve tenant_id from
   * useOrderingProvider before invoking this method.
   */
  static async create(
    statement: CreateDeviceUseStatement
  ): Promise<FHIRApiResponse<DeviceUseStatement>> {
    try {
      await auditLogger.phi('DEVICE_USE_STATEMENT_CREATE', statement.patient_id, {
        resourceType: 'DeviceUseStatement',
        operation: 'create',
        device_id: statement.device_id,
        body_site: statement.body_site_display,
      });

      const { data, error } = await supabase
        .from('fhir_device_use_statements')
        .insert([statement])
        .select(SELECT_COLS)
        .single();

      if (error) throw new Error(error.message);
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create device use statement',
      };
    }
  }

  /** Update a DeviceUseStatement (status change, correction). */
  static async update(
    id: string,
    updates: Partial<DeviceUseStatement>
  ): Promise<FHIRApiResponse<DeviceUseStatement>> {
    try {
      const { data, error } = await supabase
        .from('fhir_device_use_statements')
        .update(updates)
        .eq('id', id)
        .select(SELECT_COLS)
        .single();

      if (error) throw new Error(error.message);
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update device use statement',
      };
    }
  }
}
