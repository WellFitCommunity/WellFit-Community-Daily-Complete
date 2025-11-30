/**
 * Facility Service
 *
 * Manages healthcare facilities (hospitals, clinics) within a tenant.
 * All operations are tenant-scoped via RLS.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import type {
  Facility,
  CreateFacility,
  UpdateFacility,
  FacilitySummary,
  FacilityWithStats,
} from '../types/facility';

export const FacilityService = {
  /**
   * Get all facilities for the current tenant
   */
  async getFacilities(): Promise<ServiceResult<Facility[]>> {
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('name');

      if (error) {
        await auditLogger.error('FACILITY_LIST_FAILED', error, {
          category: 'ADMINISTRATIVE'
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err) {
      await auditLogger.error('FACILITY_LIST_ERROR', err as Error, {
        category: 'ADMINISTRATIVE'
      });
      return failure('UNKNOWN_ERROR', 'Failed to fetch facilities', err);
    }
  },

  /**
   * Get all facilities including inactive ones (admin only)
   */
  async getAllFacilities(): Promise<ServiceResult<Facility[]>> {
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('name');

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch facilities', err);
    }
  },

  /**
   * Get facility summaries for dropdowns
   */
  async getFacilitySummaries(): Promise<ServiceResult<FacilitySummary[]>> {
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('id, name, facility_code, facility_type, city, state, is_primary')
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('name');

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch facility summaries', err);
    }
  },

  /**
   * Get a single facility by ID
   */
  async getFacility(id: string): Promise<ServiceResult<Facility>> {
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return failure('NOT_FOUND', 'Facility not found', error);
      }

      return success(data);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch facility', err);
    }
  },

  /**
   * Get the primary facility for the tenant
   */
  async getPrimaryFacility(): Promise<ServiceResult<Facility | null>> {
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .eq('is_primary', true)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch primary facility', err);
    }
  },

  /**
   * Create a new facility
   */
  async createFacility(facility: CreateFacility): Promise<ServiceResult<Facility>> {
    try {
      // If this is marked as primary, unset other primaries first
      if (facility.is_primary) {
        await supabase
          .from('facilities')
          .update({ is_primary: false })
          .eq('tenant_id', facility.tenant_id)
          .eq('is_primary', true);
      }

      const { data, error } = await supabase
        .from('facilities')
        .insert(facility)
        .select()
        .single();

      if (error) {
        await auditLogger.error('FACILITY_CREATE_FAILED', error, {
          category: 'ADMINISTRATIVE',
          facilityName: facility.name
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('FACILITY_CREATED', {
        category: 'ADMINISTRATIVE',
        facilityId: data.id,
        facilityName: data.name,
        facilityType: data.facility_type
      });

      return success(data);
    } catch (err) {
      await auditLogger.error('FACILITY_CREATE_ERROR', err as Error, {
        category: 'ADMINISTRATIVE'
      });
      return failure('UNKNOWN_ERROR', 'Failed to create facility', err);
    }
  },

  /**
   * Update an existing facility
   */
  async updateFacility(id: string, updates: UpdateFacility): Promise<ServiceResult<Facility>> {
    try {
      // If setting as primary, unset other primaries first
      if (updates.is_primary) {
        const { data: current } = await supabase
          .from('facilities')
          .select('tenant_id')
          .eq('id', id)
          .single();

        if (current) {
          await supabase
            .from('facilities')
            .update({ is_primary: false })
            .eq('tenant_id', current.tenant_id)
            .eq('is_primary', true)
            .neq('id', id);
        }
      }

      const { data, error } = await supabase
        .from('facilities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        await auditLogger.error('FACILITY_UPDATE_FAILED', error, {
          category: 'ADMINISTRATIVE',
          facilityId: id
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('FACILITY_UPDATED', {
        category: 'ADMINISTRATIVE',
        facilityId: id,
        updates: Object.keys(updates)
      });

      return success(data);
    } catch (err) {
      await auditLogger.error('FACILITY_UPDATE_ERROR', err as Error, {
        category: 'ADMINISTRATIVE'
      });
      return failure('UNKNOWN_ERROR', 'Failed to update facility', err);
    }
  },

  /**
   * Soft delete a facility (set is_active = false)
   */
  async deactivateFacility(id: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('facilities')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        await auditLogger.error('FACILITY_DEACTIVATE_FAILED', error, {
          category: 'ADMINISTRATIVE',
          facilityId: id
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.warn('FACILITY_DEACTIVATED', {
        category: 'ADMINISTRATIVE',
        facilityId: id
      });

      return success(undefined);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to deactivate facility', err);
    }
  },

  /**
   * Reactivate a deactivated facility
   */
  async reactivateFacility(id: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('facilities')
        .update({ is_active: true })
        .eq('id', id);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('FACILITY_REACTIVATED', {
        category: 'ADMINISTRATIVE',
        facilityId: id
      });

      return success(undefined);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to reactivate facility', err);
    }
  },

  /**
   * Get facility statistics
   */
  async getFacilityWithStats(id: string): Promise<ServiceResult<FacilityWithStats>> {
    try {
      // Get facility
      const { data: facility, error: facilityError } = await supabase
        .from('facilities')
        .select('*')
        .eq('id', id)
        .single();

      if (facilityError) {
        return failure('NOT_FOUND', 'Facility not found', facilityError);
      }

      // Get encounter count
      const { count: encounterCount } = await supabase
        .from('encounters')
        .select('*', { count: 'exact', head: true })
        .eq('facility_id', id);

      // Get staff count
      const { count: staffCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('primary_facility_id', id);

      const facilityWithStats: FacilityWithStats = {
        ...facility,
        encounter_count: encounterCount || 0,
        staff_count: staffCount || 0,
      };

      return success(facilityWithStats);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch facility stats', err);
    }
  },

  /**
   * Search facilities by name or code
   */
  async searchFacilities(query: string): Promise<ServiceResult<FacilitySummary[]>> {
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('id, name, facility_code, facility_type, city, state, is_primary')
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,facility_code.ilike.%${query}%,city.ilike.%${query}%`)
        .order('name')
        .limit(20);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to search facilities', err);
    }
  },

  /**
   * Get facilities by type
   */
  async getFacilitiesByType(facilityType: string): Promise<ServiceResult<Facility[]>> {
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .eq('facility_type', facilityType)
        .eq('is_active', true)
        .order('name');

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch facilities by type', err);
    }
  },
};

export default FacilityService;
