/**
 * FHIR ServiceRequest Service
 *
 * Single service that backs lab orders (ONC 170.315(a)(2)) and imaging orders
 * (ONC 170.315(a)(3)). The category array on each ServiceRequest discriminates
 * the order type: ['laboratory'] vs ['imaging'].
 *
 * FHIR R4 Resource: ServiceRequest
 * HIPAA §164.312(b): PHI access logged via auditLogger.phi on every operation.
 *
 * Pattern parity with MedicationRequestService for ONC-1 — same audit / error /
 * return shape so the CPOE form components stay consistent.
 *
 * @see https://hl7.org/fhir/R4/servicerequest.html
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  ServiceRequest,
  CreateServiceRequest,
  FHIRApiResponse,
} from '../../types/fhir';
import { auditLogger } from '../auditLogger';

const SELECT_COLS =
  'id, fhir_id, patient_id, status, intent, category, code_system, code, code_display, priority, authored_on, requester_type, requester_id, requester_display, requester_practitioner_id, performer_type, performer_id, performer_display, reason_code, reason_reference, encounter_id, specimen_type, fasting_required, body_site, body_site_laterality, contrast_required, occurrence_datetime, occurrence_period_start, occurrence_period_end, note, patient_instruction, tenant_id, created_at, updated_at';

export class ServiceRequestService {
  /**
   * Get all ServiceRequests for a patient, optionally filtered by category.
   *
   * @param patientId - FHIR Patient resource ID
   * @param category  - Optional: filter to 'laboratory' or 'imaging' or any FHIR
   *                    ServiceRequest category code. Uses GIN-indexed array
   *                    overlap so multi-valued category records match.
   */
  static async getByPatient(
    patientId: string,
    category?: string
  ): Promise<FHIRApiResponse<ServiceRequest[]>> {
    try {
      await auditLogger.phi('SERVICE_REQUEST_LIST_READ', patientId, {
        resourceType: 'ServiceRequest',
        operation: 'getByPatient',
        category: category ?? 'any',
      });

      let query = supabase
        .from('fhir_service_requests')
        .select(SELECT_COLS)
        .eq('patient_id', patientId);

      if (category) {
        query = query.contains('category', [category]);
      }

      const { data, error } = await query.order('authored_on', { ascending: false });
      if (error) throw new Error(error.message);
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch service requests',
      };
    }
  }

  /**
   * Get currently-active ServiceRequests for a patient. "Active" =
   * status in ('active', 'on-hold'). Useful for a patient chart's
   * "open orders" panel.
   */
  static async getActive(
    patientId: string,
    category?: string
  ): Promise<FHIRApiResponse<ServiceRequest[]>> {
    try {
      await auditLogger.phi('SERVICE_REQUEST_ACTIVE_READ', patientId, {
        resourceType: 'ServiceRequest',
        operation: 'getActive',
        category: category ?? 'any',
      });

      let query = supabase
        .from('fhir_service_requests')
        .select(SELECT_COLS)
        .eq('patient_id', patientId)
        .in('status', ['active', 'on-hold']);

      if (category) {
        query = query.contains('category', [category]);
      }

      const { data, error } = await query.order('authored_on', { ascending: false });
      if (error) throw new Error(error.message);
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch active service requests',
      };
    }
  }

  /**
   * Create a new ServiceRequest (lab, imaging, or other ordered service).
   *
   * The caller is responsible for setting category, code, code_display,
   * status, intent. RLS requires tenant_id = get_current_tenant_id() so the
   * caller MUST resolve tenant_id from the caller's profile before invoking
   * this method.
   */
  static async create(
    request: CreateServiceRequest
  ): Promise<FHIRApiResponse<ServiceRequest>> {
    try {
      await auditLogger.phi('SERVICE_REQUEST_CREATE', request.patient_id, {
        resourceType: 'ServiceRequest',
        operation: 'create',
        category: request.category,
        code: request.code,
        code_display: request.code_display,
      });

      const { data, error } = await supabase
        .from('fhir_service_requests')
        .insert([request])
        .select(SELECT_COLS)
        .single();

      if (error) throw new Error(error.message);
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create service request',
      };
    }
  }

  /**
   * Update an existing ServiceRequest. Typical: change status from active →
   * completed, add a note, attach a performer.
   */
  static async update(
    id: string,
    updates: Partial<ServiceRequest>
  ): Promise<FHIRApiResponse<ServiceRequest>> {
    try {
      const { data, error } = await supabase
        .from('fhir_service_requests')
        .update(updates)
        .eq('id', id)
        .select(SELECT_COLS)
        .single();

      if (error) throw new Error(error.message);
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update service request',
      };
    }
  }

  /**
   * Cancel a ServiceRequest by transitioning to status='revoked'. FHIR R4
   * uses 'revoked' for cancellations on request resources.
   */
  static async cancel(
    id: string,
    reason?: string
  ): Promise<FHIRApiResponse<ServiceRequest>> {
    return this.update(id, {
      status: 'revoked',
      note: reason ? `Revoked: ${reason}` : 'Revoked',
    });
  }
}
