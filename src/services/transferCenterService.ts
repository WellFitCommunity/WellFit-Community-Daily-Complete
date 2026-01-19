/**
 * Transfer Center Service
 *
 * Manages inter-facility patient transfers with workflow tracking
 * and facility capacity visibility.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import type {
  TransferRequest,
  TransferRequestStatus,
  TransferUrgency,
  FacilityCapacity,
  TransferCenterMetrics,
  CreateTransferRequestInput,
  ApproveTransferInput,
  DenyTransferInput,
} from '../types/transferCenter';

// ============================================================================
// TRANSFER CENTER SERVICE
// ============================================================================

export const TransferCenterService = {
  /**
   * Create a new transfer request
   */
  async createTransferRequest(
    input: CreateTransferRequestInput
  ): Promise<ServiceResult<TransferRequest>> {
    try {
      const { data, error } = await supabase
        .from('transfer_requests')
        .insert({
          patient_id: input.patient_id,
          patient_mrn: input.patient_mrn,
          patient_age: input.patient_age,
          patient_gender: input.patient_gender,
          sending_facility_id: input.sending_facility_id,
          sending_unit: input.sending_unit,
          sending_contact_name: input.sending_contact_name,
          sending_contact_phone: input.sending_contact_phone,
          receiving_facility_id: input.receiving_facility_id,
          transfer_type: input.transfer_type,
          urgency: input.urgency,
          reason_for_transfer: input.reason_for_transfer,
          clinical_summary: input.clinical_summary,
          diagnosis_codes: input.diagnosis_codes ?? [],
          primary_diagnosis: input.primary_diagnosis,
          required_service: input.required_service,
          required_specialty: input.required_specialty,
          acuity_level: input.acuity_level,
          requires_icu: input.requires_icu ?? false,
          requires_isolation: input.requires_isolation ?? false,
          requires_ventilator: input.requires_ventilator ?? false,
          requires_cardiac_monitoring: input.requires_cardiac_monitoring ?? false,
          special_equipment: input.special_equipment ?? [],
          special_requirements: input.special_requirements,
          transport_mode: input.transport_mode,
          notes: input.notes,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('TRANSFER_REQUEST_CREATE_FAILED', new Error(error.message), {
          ...input,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('TRANSFER_REQUEST_CREATED', {
        transferId: data.id,
        requestNumber: data.request_number,
        patientId: input.patient_id,
        urgency: input.urgency,
        transferType: input.transfer_type,
      });

      return success(data as TransferRequest);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TRANSFER_REQUEST_CREATE_FAILED', error, { ...input });
      return failure('OPERATION_FAILED', 'Failed to create transfer request', err);
    }
  },

  /**
   * Get active transfer requests
   */
  async getActiveTransfers(options?: {
    status?: TransferRequestStatus;
    urgency?: TransferUrgency;
    sendingFacilityId?: string;
    receivingFacilityId?: string;
  }): Promise<ServiceResult<TransferRequest[]>> {
    try {
      let query = supabase
        .from('transfer_requests')
        .select('*')
        .not('status', 'in', '("completed","cancelled")')
        .order('urgency', { ascending: false })
        .order('requested_at', { ascending: true });

      if (options?.status) {
        query = query.eq('status', options.status);
      }
      if (options?.urgency) {
        query = query.eq('urgency', options.urgency);
      }
      if (options?.sendingFacilityId) {
        query = query.eq('sending_facility_id', options.sendingFacilityId);
      }
      if (options?.receivingFacilityId) {
        query = query.eq('receiving_facility_id', options.receivingFacilityId);
      }

      const { data, error } = await query;

      if (error) {
        await auditLogger.error('TRANSFERS_FETCH_FAILED', new Error(error.message), {
          options: options ?? {},
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as TransferRequest[]);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TRANSFERS_FETCH_FAILED', error, {
        options: options ?? {},
      });
      return failure('OPERATION_FAILED', 'Failed to fetch transfers', err);
    }
  },

  /**
   * Get a single transfer by ID
   */
  async getTransfer(transferId: string): Promise<ServiceResult<TransferRequest>> {
    try {
      const { data, error } = await supabase
        .from('transfer_requests')
        .select('*')
        .eq('id', transferId)
        .single();

      if (error) {
        await auditLogger.error('TRANSFER_FETCH_FAILED', new Error(error.message), {
          transferId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data as TransferRequest);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TRANSFER_FETCH_FAILED', error, { transferId });
      return failure('OPERATION_FAILED', 'Failed to fetch transfer', err);
    }
  },

  /**
   * Mark transfer as under review
   */
  async startReview(transferId: string): Promise<ServiceResult<TransferRequest>> {
    try {
      const { data, error } = await supabase
        .from('transfer_requests')
        .update({
          status: 'reviewing',
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', transferId)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) {
        await auditLogger.error('TRANSFER_REVIEW_START_FAILED', new Error(error.message), {
          transferId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('TRANSFER_REVIEW_STARTED', { transferId });

      return success(data as TransferRequest);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TRANSFER_REVIEW_START_FAILED', error, { transferId });
      return failure('OPERATION_FAILED', 'Failed to start transfer review', err);
    }
  },

  /**
   * Approve a transfer request (calls database function)
   */
  async approveTransfer(
    input: ApproveTransferInput
  ): Promise<ServiceResult<{ transfer_id: string; status: string }>> {
    try {
      const { data, error } = await supabase.rpc('approve_transfer_request', {
        p_transfer_id: input.transfer_id,
        p_receiving_unit: input.receiving_unit ?? null,
        p_receiving_contact_name: input.receiving_contact_name ?? null,
        p_receiving_contact_phone: input.receiving_contact_phone ?? null,
        p_receiving_physician: input.receiving_physician ?? null,
        p_assigned_bed_id: input.assigned_bed_id ?? null,
        p_assigned_bed_label: input.assigned_bed_label ?? null,
        p_notes: input.notes ?? null,
      });

      if (error) {
        await auditLogger.error('TRANSFER_APPROVE_FAILED', new Error(error.message), {
          transferId: input.transfer_id,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      const result = data as { success: boolean; error?: string; transfer_id?: string; status?: string };

      if (!result.success) {
        return failure('OPERATION_FAILED', result.error || 'Failed to approve transfer');
      }

      await auditLogger.info('TRANSFER_APPROVED', {
        transferId: input.transfer_id,
        assignedBedId: input.assigned_bed_id,
      });

      return success({
        transfer_id: result.transfer_id || input.transfer_id,
        status: result.status || 'approved',
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TRANSFER_APPROVE_FAILED', error, {
        transferId: input.transfer_id,
      });
      return failure('OPERATION_FAILED', 'Failed to approve transfer', err);
    }
  },

  /**
   * Deny a transfer request (calls database function)
   */
  async denyTransfer(
    input: DenyTransferInput
  ): Promise<ServiceResult<{ transfer_id: string; status: string }>> {
    try {
      const { data, error } = await supabase.rpc('deny_transfer_request', {
        p_transfer_id: input.transfer_id,
        p_denial_reason: input.denial_reason,
        p_notes: input.notes ?? null,
      });

      if (error) {
        await auditLogger.error('TRANSFER_DENY_FAILED', new Error(error.message), {
          transferId: input.transfer_id,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      const result = data as { success: boolean; error?: string; transfer_id?: string; status?: string };

      if (!result.success) {
        return failure('OPERATION_FAILED', result.error || 'Failed to deny transfer');
      }

      await auditLogger.info('TRANSFER_DENIED', {
        transferId: input.transfer_id,
        denialReason: input.denial_reason,
      });

      return success({
        transfer_id: result.transfer_id || input.transfer_id,
        status: result.status || 'denied',
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TRANSFER_DENY_FAILED', error, {
        transferId: input.transfer_id,
      });
      return failure('OPERATION_FAILED', 'Failed to deny transfer', err);
    }
  },

  /**
   * Schedule a transfer departure
   */
  async scheduleTransfer(
    transferId: string,
    scheduledDeparture: string,
    transportMode?: string,
    transportCompany?: string
  ): Promise<ServiceResult<TransferRequest>> {
    try {
      const updateData: Record<string, unknown> = {
        status: 'scheduled',
        scheduled_departure: scheduledDeparture,
        updated_at: new Date().toISOString(),
      };

      if (transportMode) updateData.transport_mode = transportMode;
      if (transportCompany) updateData.transport_company = transportCompany;

      const { data, error } = await supabase
        .from('transfer_requests')
        .update(updateData)
        .eq('id', transferId)
        .eq('status', 'approved')
        .select()
        .single();

      if (error) {
        await auditLogger.error('TRANSFER_SCHEDULE_FAILED', new Error(error.message), {
          transferId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('TRANSFER_SCHEDULED', {
        transferId,
        scheduledDeparture,
      });

      return success(data as TransferRequest);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TRANSFER_SCHEDULE_FAILED', error, { transferId });
      return failure('OPERATION_FAILED', 'Failed to schedule transfer', err);
    }
  },

  /**
   * Start transfer (mark in transit) - calls database function
   */
  async startTransfer(
    transferId: string,
    transportMode?: string,
    transportCompany?: string,
    transportEta?: string
  ): Promise<ServiceResult<{ transfer_id: string; status: string; departure_time: string }>> {
    try {
      const { data, error } = await supabase.rpc('start_transfer', {
        p_transfer_id: transferId,
        p_transport_mode: transportMode ?? null,
        p_transport_company: transportCompany ?? null,
        p_transport_eta: transportEta ?? null,
      });

      if (error) {
        await auditLogger.error('TRANSFER_START_FAILED', new Error(error.message), {
          transferId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      const result = data as { success: boolean; error?: string; transfer_id?: string; status?: string; departure_time?: string };

      if (!result.success) {
        return failure('OPERATION_FAILED', result.error || 'Failed to start transfer');
      }

      await auditLogger.info('TRANSFER_STARTED', {
        transferId,
        departureTime: result.departure_time,
      });

      return success({
        transfer_id: result.transfer_id || transferId,
        status: result.status || 'in_transit',
        departure_time: result.departure_time || new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TRANSFER_START_FAILED', error, { transferId });
      return failure('OPERATION_FAILED', 'Failed to start transfer', err);
    }
  },

  /**
   * Mark patient as arrived
   */
  async markArrived(transferId: string): Promise<ServiceResult<TransferRequest>> {
    try {
      const { data, error } = await supabase
        .from('transfer_requests')
        .update({
          status: 'arrived',
          actual_arrival: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', transferId)
        .eq('status', 'in_transit')
        .select()
        .single();

      if (error) {
        await auditLogger.error('TRANSFER_ARRIVAL_FAILED', new Error(error.message), {
          transferId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('TRANSFER_ARRIVED', { transferId });

      return success(data as TransferRequest);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TRANSFER_ARRIVAL_FAILED', error, { transferId });
      return failure('OPERATION_FAILED', 'Failed to mark transfer arrived', err);
    }
  },

  /**
   * Complete transfer - calls database function
   */
  async completeTransfer(
    transferId: string
  ): Promise<ServiceResult<{ transfer_id: string; status: string; transit_minutes: number }>> {
    try {
      const { data, error } = await supabase.rpc('complete_transfer', {
        p_transfer_id: transferId,
      });

      if (error) {
        await auditLogger.error('TRANSFER_COMPLETE_FAILED', new Error(error.message), {
          transferId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      const result = data as { success: boolean; error?: string; transfer_id?: string; status?: string; transit_minutes?: number };

      if (!result.success) {
        return failure('OPERATION_FAILED', result.error || 'Failed to complete transfer');
      }

      await auditLogger.info('TRANSFER_COMPLETED', {
        transferId,
        transitMinutes: result.transit_minutes,
      });

      return success({
        transfer_id: result.transfer_id || transferId,
        status: result.status || 'completed',
        transit_minutes: result.transit_minutes || 0,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TRANSFER_COMPLETE_FAILED', error, { transferId });
      return failure('OPERATION_FAILED', 'Failed to complete transfer', err);
    }
  },

  /**
   * Cancel a transfer
   */
  async cancelTransfer(
    transferId: string,
    cancellationReason: string
  ): Promise<ServiceResult<TransferRequest>> {
    try {
      const { data, error } = await supabase
        .from('transfer_requests')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: cancellationReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transferId)
        .in('status', ['pending', 'reviewing', 'approved', 'scheduled'])
        .select()
        .single();

      if (error) {
        await auditLogger.error('TRANSFER_CANCEL_FAILED', new Error(error.message), {
          transferId,
          cancellationReason,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('TRANSFER_CANCELLED', {
        transferId,
        cancellationReason,
      });

      return success(data as TransferRequest);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TRANSFER_CANCEL_FAILED', error, {
        transferId,
        cancellationReason,
      });
      return failure('OPERATION_FAILED', 'Failed to cancel transfer', err);
    }
  },

  /**
   * Get transfer metrics - calls database function
   */
  async getMetrics(tenantId: string): Promise<ServiceResult<TransferCenterMetrics>> {
    try {
      const { data, error } = await supabase.rpc('get_transfer_metrics', {
        p_tenant_id: tenantId,
      });

      if (error) {
        await auditLogger.error('TRANSFER_METRICS_FETCH_FAILED', new Error(error.message), {
          tenantId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      const metrics = data as TransferCenterMetrics;

      return success(metrics);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TRANSFER_METRICS_FETCH_FAILED', error, { tenantId });
      return failure('OPERATION_FAILED', 'Failed to fetch transfer metrics', err);
    }
  },

  /**
   * Get facility capacity snapshots
   */
  async getFacilityCapacity(options?: {
    facilityId?: string;
    acceptingOnly?: boolean;
  }): Promise<ServiceResult<FacilityCapacity[]>> {
    try {
      let query = supabase
        .from('facility_capacity')
        .select('*')
        .order('snapshot_at', { ascending: false });

      if (options?.facilityId) {
        query = query.eq('facility_id', options.facilityId);
      }
      if (options?.acceptingOnly) {
        query = query.eq('is_accepting_transfers', true);
      }

      // Get latest snapshot per facility
      query = query.limit(100);

      const { data, error } = await query;

      if (error) {
        await auditLogger.error('FACILITY_CAPACITY_FETCH_FAILED', new Error(error.message), {
          options: options ?? {},
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      // De-duplicate to get latest per facility
      const latestByFacility = new Map<string, FacilityCapacity>();
      for (const row of (data || []) as FacilityCapacity[]) {
        if (!latestByFacility.has(row.facility_id)) {
          latestByFacility.set(row.facility_id, row);
        }
      }

      return success(Array.from(latestByFacility.values()));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('FACILITY_CAPACITY_FETCH_FAILED', error, {
        options: options ?? {},
      });
      return failure('OPERATION_FAILED', 'Failed to fetch facility capacity', err);
    }
  },

  /**
   * Update facility capacity
   */
  async updateFacilityCapacity(
    facilityId: string,
    capacity: Partial<Omit<FacilityCapacity, 'id' | 'tenant_id' | 'facility_id' | 'created_at'>>
  ): Promise<ServiceResult<FacilityCapacity>> {
    try {
      const { data, error } = await supabase
        .from('facility_capacity')
        .insert({
          facility_id: facilityId,
          facility_name: capacity.facility_name || '',
          total_beds: capacity.total_beds ?? 0,
          occupied_beds: capacity.occupied_beds ?? 0,
          available_beds: capacity.available_beds ?? 0,
          reserved_beds: capacity.reserved_beds ?? 0,
          blocked_beds: capacity.blocked_beds ?? 0,
          occupancy_percent: capacity.occupancy_percent ?? 0,
          is_accepting_transfers: capacity.is_accepting_transfers ?? true,
          divert_status: capacity.divert_status ?? false,
          icu_available: capacity.icu_available ?? 0,
          step_down_available: capacity.step_down_available ?? 0,
          telemetry_available: capacity.telemetry_available ?? 0,
          med_surg_available: capacity.med_surg_available ?? 0,
          ed_available: capacity.ed_available ?? 0,
          next_discharge_expected: capacity.next_discharge_expected,
          snapshot_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('FACILITY_CAPACITY_UPDATE_FAILED', new Error(error.message), {
          facilityId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('FACILITY_CAPACITY_UPDATED', {
        facilityId,
        availableBeds: capacity.available_beds,
        acceptingTransfers: capacity.is_accepting_transfers,
      });

      return success(data as FacilityCapacity);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('FACILITY_CAPACITY_UPDATE_FAILED', error, { facilityId });
      return failure('OPERATION_FAILED', 'Failed to update facility capacity', err);
    }
  },

  /**
   * Get pending transfers requiring action
   */
  async getPendingTransfers(): Promise<ServiceResult<TransferRequest[]>> {
    try {
      const { data, error } = await supabase
        .from('transfer_requests')
        .select('*')
        .in('status', ['pending', 'reviewing'])
        .order('urgency', { ascending: false })
        .order('requested_at', { ascending: true });

      if (error) {
        await auditLogger.error('PENDING_TRANSFERS_FETCH_FAILED', new Error(error.message), {});
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as TransferRequest[]);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('PENDING_TRANSFERS_FETCH_FAILED', error, {});
      return failure('OPERATION_FAILED', 'Failed to fetch pending transfers', err);
    }
  },

  /**
   * Update transfer notes
   */
  async updateNotes(transferId: string, notes: string): Promise<ServiceResult<TransferRequest>> {
    try {
      const { data, error } = await supabase
        .from('transfer_requests')
        .update({
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transferId)
        .select()
        .single();

      if (error) {
        await auditLogger.error('TRANSFER_NOTES_UPDATE_FAILED', new Error(error.message), {
          transferId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data as TransferRequest);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TRANSFER_NOTES_UPDATE_FAILED', error, { transferId });
      return failure('OPERATION_FAILED', 'Failed to update notes', err);
    }
  },
};

export default TransferCenterService;
