/**
 * Command Center Service
 *
 * Provides network-wide bed visibility and capacity coordination
 * across multiple facilities within a health system.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import type {
  HealthSystem,
  HealthSystemFacility,
  FacilityCapacitySnapshot,
  CommandCenterSummary,
  CapacityAlert,
  CapacityAlertLevel,
} from '../types/healthSystem';

// ============================================================================
// COMMAND CENTER SERVICE
// ============================================================================

export const CommandCenterService = {
  /**
   * Get command center summary (calls database function)
   */
  async getCommandCenterSummary(
    tenantId: string
  ): Promise<ServiceResult<CommandCenterSummary>> {
    try {
      const { data, error } = await supabase.rpc('get_command_center_summary', {
        p_tenant_id: tenantId,
      });

      if (error) {
        await auditLogger.error('COMMAND_CENTER_SUMMARY_FAILED', new Error(error.message), {
          tenantId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data as CommandCenterSummary);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('COMMAND_CENTER_SUMMARY_FAILED', error, { tenantId });
      return failure('OPERATION_FAILED', 'Failed to fetch command center summary', err);
    }
  },

  /**
   * Get all health systems for tenant
   */
  async getHealthSystems(): Promise<ServiceResult<HealthSystem[]>> {
    try {
      const { data, error } = await supabase
        .from('health_systems')
        .select('*')
        .order('name');

      if (error) {
        await auditLogger.error('HEALTH_SYSTEMS_FETCH_FAILED', new Error(error.message), {});
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as HealthSystem[]);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('HEALTH_SYSTEMS_FETCH_FAILED', error, {});
      return failure('OPERATION_FAILED', 'Failed to fetch health systems', err);
    }
  },

  /**
   * Get facilities for a health system
   */
  async getHealthSystemFacilities(
    healthSystemId?: string
  ): Promise<ServiceResult<HealthSystemFacility[]>> {
    try {
      let query = supabase
        .from('health_system_facilities')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (healthSystemId) {
        query = query.eq('health_system_id', healthSystemId);
      }

      const { data, error } = await query;

      if (error) {
        await auditLogger.error('FACILITIES_FETCH_FAILED', new Error(error.message), {
          healthSystemId: healthSystemId ?? 'all',
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as HealthSystemFacility[]);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('FACILITIES_FETCH_FAILED', error, {
        healthSystemId: healthSystemId ?? 'all',
      });
      return failure('OPERATION_FAILED', 'Failed to fetch facilities', err);
    }
  },

  /**
   * Get latest capacity snapshots for all facilities
   */
  async getLatestCapacitySnapshots(options?: {
    facilityId?: string;
    alertLevel?: CapacityAlertLevel;
    acceptingOnly?: boolean;
  }): Promise<ServiceResult<FacilityCapacitySnapshot[]>> {
    try {
      // Query with distinct on facility_id to get latest per facility
      let query = supabase
        .from('facility_capacity_snapshots')
        .select('*')
        .order('facility_id')
        .order('snapshot_at', { ascending: false });

      if (options?.facilityId) {
        query = query.eq('facility_id', options.facilityId);
      }
      if (options?.alertLevel) {
        query = query.eq('alert_level', options.alertLevel);
      }
      if (options?.acceptingOnly) {
        query = query.eq('is_accepting_transfers', true);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        await auditLogger.error('CAPACITY_SNAPSHOTS_FETCH_FAILED', new Error(error.message), {
          options: options ?? {},
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      // De-duplicate to get latest per facility
      const latestByFacility = new Map<string, FacilityCapacitySnapshot>();
      for (const row of (data || []) as FacilityCapacitySnapshot[]) {
        if (!latestByFacility.has(row.facility_id)) {
          latestByFacility.set(row.facility_id, row);
        }
      }

      return success(Array.from(latestByFacility.values()));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('CAPACITY_SNAPSHOTS_FETCH_FAILED', error, {
        options: options ?? {},
      });
      return failure('OPERATION_FAILED', 'Failed to fetch capacity snapshots', err);
    }
  },

  /**
   * Record a capacity snapshot for a facility
   */
  async recordCapacitySnapshot(
    facilityId: string,
    capacity: {
      total_beds: number;
      occupied_beds: number;
      available_beds: number;
      reserved_beds?: number;
      blocked_beds?: number;
      pending_discharge?: number;
      pending_admission?: number;
      icu_occupied?: number;
      icu_available?: number;
      step_down_occupied?: number;
      step_down_available?: number;
      telemetry_occupied?: number;
      telemetry_available?: number;
      med_surg_occupied?: number;
      med_surg_available?: number;
      ed_census?: number;
      ed_boarding?: number;
    }
  ): Promise<ServiceResult<{ snapshot_id: string; alert_level: string }>> {
    try {
      const { data, error } = await supabase.rpc('record_capacity_snapshot', {
        p_facility_id: facilityId,
        p_total_beds: capacity.total_beds,
        p_occupied_beds: capacity.occupied_beds,
        p_available_beds: capacity.available_beds,
        p_reserved_beds: capacity.reserved_beds ?? 0,
        p_blocked_beds: capacity.blocked_beds ?? 0,
        p_pending_discharge: capacity.pending_discharge ?? 0,
        p_pending_admission: capacity.pending_admission ?? 0,
        p_icu_occupied: capacity.icu_occupied ?? 0,
        p_icu_available: capacity.icu_available ?? 0,
        p_step_down_occupied: capacity.step_down_occupied ?? 0,
        p_step_down_available: capacity.step_down_available ?? 0,
        p_telemetry_occupied: capacity.telemetry_occupied ?? 0,
        p_telemetry_available: capacity.telemetry_available ?? 0,
        p_med_surg_occupied: capacity.med_surg_occupied ?? 0,
        p_med_surg_available: capacity.med_surg_available ?? 0,
        p_ed_census: capacity.ed_census ?? 0,
        p_ed_boarding: capacity.ed_boarding ?? 0,
      });

      if (error) {
        await auditLogger.error('CAPACITY_SNAPSHOT_RECORD_FAILED', new Error(error.message), {
          facilityId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      const result = data as { success: boolean; error?: string; snapshot_id?: string; alert_level?: string };

      if (!result.success) {
        return failure('OPERATION_FAILED', result.error || 'Failed to record snapshot');
      }

      await auditLogger.info('CAPACITY_SNAPSHOT_RECORDED', {
        facilityId,
        snapshotId: result.snapshot_id,
        alertLevel: result.alert_level,
      });

      return success({
        snapshot_id: result.snapshot_id || '',
        alert_level: result.alert_level || 'normal',
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('CAPACITY_SNAPSHOT_RECORD_FAILED', error, { facilityId });
      return failure('OPERATION_FAILED', 'Failed to record capacity snapshot', err);
    }
  },

  /**
   * Get active capacity alerts
   */
  async getActiveAlerts(): Promise<ServiceResult<CapacityAlert[]>> {
    try {
      const { data, error } = await supabase
        .from('capacity_alerts')
        .select('*')
        .is('resolved_at', null)
        .order('triggered_at', { ascending: false });

      if (error) {
        await auditLogger.error('CAPACITY_ALERTS_FETCH_FAILED', new Error(error.message), {});
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as CapacityAlert[]);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('CAPACITY_ALERTS_FETCH_FAILED', error, {});
      return failure('OPERATION_FAILED', 'Failed to fetch capacity alerts', err);
    }
  },

  /**
   * Acknowledge a capacity alert
   */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string
  ): Promise<ServiceResult<{ alert_id: string }>> {
    try {
      const { data, error } = await supabase.rpc('acknowledge_capacity_alert', {
        p_alert_id: alertId,
        p_acknowledged_by: acknowledgedBy,
      });

      if (error) {
        await auditLogger.error('ALERT_ACKNOWLEDGE_FAILED', new Error(error.message), {
          alertId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      const result = data as { success: boolean; error?: string; alert_id?: string };

      if (!result.success) {
        return failure('OPERATION_FAILED', result.error || 'Failed to acknowledge alert');
      }

      await auditLogger.info('ALERT_ACKNOWLEDGED', {
        alertId,
        acknowledgedBy,
      });

      return success({ alert_id: result.alert_id || alertId });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ALERT_ACKNOWLEDGE_FAILED', error, { alertId });
      return failure('OPERATION_FAILED', 'Failed to acknowledge alert', err);
    }
  },

  /**
   * Update facility divert status
   */
  async setFacilityDivertStatus(
    facilityId: string,
    divertStatus: boolean,
    divertReason?: string
  ): Promise<ServiceResult<HealthSystemFacility>> {
    try {
      const updateData: Record<string, unknown> = {
        divert_status: divertStatus,
        is_accepting_transfers: !divertStatus,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('health_system_facilities')
        .update(updateData)
        .eq('id', facilityId)
        .select()
        .single();

      if (error) {
        await auditLogger.error('FACILITY_DIVERT_UPDATE_FAILED', new Error(error.message), {
          facilityId,
          divertStatus,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('FACILITY_DIVERT_STATUS_CHANGED', {
        facilityId,
        divertStatus,
        divertReason,
      });

      return success(data as HealthSystemFacility);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('FACILITY_DIVERT_UPDATE_FAILED', error, {
        facilityId,
        divertStatus,
      });
      return failure('OPERATION_FAILED', 'Failed to update divert status', err);
    }
  },

  /**
   * Get historical capacity for trending
   */
  async getCapacityHistory(
    facilityId: string,
    hoursBack: number = 24
  ): Promise<ServiceResult<FacilityCapacitySnapshot[]>> {
    try {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - hoursBack);

      const { data, error } = await supabase
        .from('facility_capacity_snapshots')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('snapshot_at', cutoff.toISOString())
        .order('snapshot_at', { ascending: true });

      if (error) {
        await auditLogger.error('CAPACITY_HISTORY_FETCH_FAILED', new Error(error.message), {
          facilityId,
          hoursBack,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as FacilityCapacitySnapshot[]);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('CAPACITY_HISTORY_FETCH_FAILED', error, {
        facilityId,
        hoursBack,
      });
      return failure('OPERATION_FAILED', 'Failed to fetch capacity history', err);
    }
  },

  /**
   * Get facilities with available beds by unit type
   */
  async getFacilitiesWithAvailableBeds(unitType: string): Promise<
    ServiceResult<
      Array<{
        facility_id: string;
        facility_name: string;
        available_beds: number;
        occupancy_percent: number;
      }>
    >
  > {
    try {
      const { data, error } = await supabase
        .from('facility_capacity_snapshots')
        .select('facility_id, facility_name, occupancy_percent, icu_available, step_down_available, telemetry_available, med_surg_available')
        .eq('is_accepting_transfers', true)
        .order('facility_id')
        .order('snapshot_at', { ascending: false });

      if (error) {
        await auditLogger.error('FACILITIES_BY_UNIT_FETCH_FAILED', new Error(error.message), {
          unitType,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      // De-duplicate and filter by unit type
      const latestByFacility = new Map<string, {
        facility_id: string;
        facility_name: string;
        available_beds: number;
        occupancy_percent: number;
      }>();

      for (const row of data || []) {
        if (!latestByFacility.has(row.facility_id)) {
          let availableBeds = 0;
          switch (unitType.toLowerCase()) {
            case 'icu':
              availableBeds = row.icu_available || 0;
              break;
            case 'step_down':
              availableBeds = row.step_down_available || 0;
              break;
            case 'telemetry':
              availableBeds = row.telemetry_available || 0;
              break;
            case 'med_surg':
              availableBeds = row.med_surg_available || 0;
              break;
            default:
              availableBeds =
                (row.icu_available || 0) +
                (row.step_down_available || 0) +
                (row.telemetry_available || 0) +
                (row.med_surg_available || 0);
          }

          if (availableBeds > 0) {
            latestByFacility.set(row.facility_id, {
              facility_id: row.facility_id,
              facility_name: row.facility_name,
              available_beds: availableBeds,
              occupancy_percent: row.occupancy_percent,
            });
          }
        }
      }

      // Sort by available beds descending
      const results = Array.from(latestByFacility.values()).sort(
        (a, b) => b.available_beds - a.available_beds
      );

      return success(results);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('FACILITIES_BY_UNIT_FETCH_FAILED', error, { unitType });
      return failure('OPERATION_FAILED', 'Failed to fetch facilities by unit type', err);
    }
  },

  /**
   * Create a new health system
   */
  async createHealthSystem(
    input: Omit<HealthSystem, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>
  ): Promise<ServiceResult<HealthSystem>> {
    try {
      const { data, error } = await supabase
        .from('health_systems')
        .insert({
          name: input.name,
          short_name: input.short_name,
          region: input.region,
          contact_name: input.contact_name,
          contact_phone: input.contact_phone,
          contact_email: input.contact_email,
          central_transfer_number: input.central_transfer_number,
          bed_control_email: input.bed_control_email,
          total_facilities: input.total_facilities,
          total_licensed_beds: input.total_licensed_beds,
          enable_cross_facility_transfers: input.enable_cross_facility_transfers,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('HEALTH_SYSTEM_CREATE_FAILED', new Error(error.message), {
          name: input.name,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('HEALTH_SYSTEM_CREATED', {
        healthSystemId: data.id,
        name: input.name,
      });

      return success(data as HealthSystem);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('HEALTH_SYSTEM_CREATE_FAILED', error, { name: input.name });
      return failure('OPERATION_FAILED', 'Failed to create health system', err);
    }
  },

  /**
   * Create a new facility in health system
   */
  async createFacility(
    input: Omit<HealthSystemFacility, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>
  ): Promise<ServiceResult<HealthSystemFacility>> {
    try {
      const { data, error } = await supabase
        .from('health_system_facilities')
        .insert({
          health_system_id: input.health_system_id,
          facility_code: input.facility_code,
          name: input.name,
          short_name: input.short_name,
          facility_type: input.facility_type,
          address_line1: input.address_line1,
          address_line2: input.address_line2,
          city: input.city,
          state: input.state,
          zip_code: input.zip_code,
          latitude: input.latitude,
          longitude: input.longitude,
          main_phone: input.main_phone,
          bed_control_phone: input.bed_control_phone,
          transfer_center_phone: input.transfer_center_phone,
          licensed_beds: input.licensed_beds,
          staffed_beds: input.staffed_beds,
          icu_beds: input.icu_beds,
          step_down_beds: input.step_down_beds,
          telemetry_beds: input.telemetry_beds,
          med_surg_beds: input.med_surg_beds,
          is_active: input.is_active,
          is_accepting_transfers: input.is_accepting_transfers,
          divert_status: input.divert_status,
          services_offered: input.services_offered ?? [],
          specialties: input.specialties ?? [],
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('FACILITY_CREATE_FAILED', new Error(error.message), {
          name: input.name,
          facilityCode: input.facility_code,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('FACILITY_CREATED', {
        facilityId: data.id,
        name: input.name,
        facilityCode: input.facility_code,
      });

      return success(data as HealthSystemFacility);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('FACILITY_CREATE_FAILED', error, {
        name: input.name,
        facilityCode: input.facility_code,
      });
      return failure('OPERATION_FAILED', 'Failed to create facility', err);
    }
  },
};

export default CommandCenterService;
