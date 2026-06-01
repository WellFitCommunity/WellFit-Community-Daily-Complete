/**
 * Hospital Workforce — Organization / Department / Facility Structure
 *
 * Extracted from hospitalWorkforceService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — functions moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { getErrorMessage } from './shared';
import {
  HCOrganization,
  HCOrganizationInsert,
  HCOrganizationUpdate,
  HCDepartment,
  HCDepartmentInsert,
  HCDepartmentUpdate,
  HCFacility,
  HCFacilityInsert,
  HCFacilityUpdate,
} from '../../types/hospitalWorkforce';

// ============================================================================
// ORGANIZATION MANAGEMENT
// ============================================================================

export async function getOrganizations(): Promise<ServiceResult<HCOrganization[]>> {
  try {
    const { data, error } = await supabase
      .from('hc_organization')
      .select('organization_id, tenant_id, organization_name, organization_type, parent_organization_id, npi, tax_id, address_line1, address_line2, city, state, zip, phone, fax, website, cms_certification_number, is_active, source_system, source_id, created_at, updated_at')
      .eq('is_active', true)
      .order('organization_name');

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get organizations', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to get organizations', err);
  }
}

export async function getOrganization(organizationId: string): Promise<ServiceResult<HCOrganization>> {
  try {
    const { data, error } = await supabase
      .from('hc_organization')
      .select('organization_id, tenant_id, organization_name, organization_type, parent_organization_id, npi, tax_id, address_line1, address_line2, city, state, zip, phone, fax, website, cms_certification_number, is_active, source_system, source_id, created_at, updated_at')
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return failure('NOT_FOUND', 'Organization not found');
      }
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to get organization', getErrorMessage(err), { organizationId });
    return failure('UNKNOWN_ERROR', 'Failed to get organization', err);
  }
}

export async function createOrganization(org: HCOrganizationInsert): Promise<ServiceResult<HCOrganization>> {
  try {
    const { data, error } = await supabase.from('hc_organization').insert(org).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Organization created', {
      organizationId: data.organization_id,
      organizationName: data.organization_name,
    });

    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to create organization', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to create organization', err);
  }
}

export async function updateOrganization(
  organizationId: string,
  updates: HCOrganizationUpdate
): Promise<ServiceResult<HCOrganization>> {
  try {
    const { data, error } = await supabase
      .from('hc_organization')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Organization updated', { organizationId, updates: Object.keys(updates) });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to update organization', getErrorMessage(err), { organizationId });
    return failure('UNKNOWN_ERROR', 'Failed to update organization', err);
  }
}

// ============================================================================
// DEPARTMENT MANAGEMENT
// ============================================================================

export async function getDepartments(organizationId: string): Promise<ServiceResult<HCDepartment[]>> {
  try {
    const { data, error } = await supabase
      .from('hc_department')
      .select('department_id, organization_id, department_code, department_name, department_type, parent_department_id, cost_center, location, phone, fax, is_active, source_system, source_id, created_at, updated_at')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('department_name');

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get departments', getErrorMessage(err), { organizationId });
    return failure('UNKNOWN_ERROR', 'Failed to get departments', err);
  }
}

export async function createDepartment(dept: HCDepartmentInsert): Promise<ServiceResult<HCDepartment>> {
  try {
    const { data, error } = await supabase.from('hc_department').insert(dept).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Department created', {
      departmentId: data.department_id,
      departmentName: data.department_name,
    });

    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to create department', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to create department', err);
  }
}

export async function updateDepartment(
  departmentId: string,
  updates: HCDepartmentUpdate
): Promise<ServiceResult<HCDepartment>> {
  try {
    const { data, error } = await supabase
      .from('hc_department')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('department_id', departmentId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Department updated', { departmentId, updates: Object.keys(updates) });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to update department', getErrorMessage(err), { departmentId });
    return failure('UNKNOWN_ERROR', 'Failed to update department', err);
  }
}

// ============================================================================
// FACILITY MANAGEMENT
// ============================================================================

export async function getFacilities(organizationId: string): Promise<ServiceResult<HCFacility[]>> {
  try {
    const { data, error } = await supabase
      .from('hc_facility')
      .select('facility_id, organization_id, facility_code, facility_name, facility_type, address_line1, address_line2, city, state, zip, phone, fax, is_active, source_system, source_id, created_at, updated_at')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('facility_name');

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get facilities', getErrorMessage(err), { organizationId });
    return failure('UNKNOWN_ERROR', 'Failed to get facilities', err);
  }
}

export async function createFacility(facility: HCFacilityInsert): Promise<ServiceResult<HCFacility>> {
  try {
    const { data, error } = await supabase.from('hc_facility').insert(facility).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Facility created', {
      facilityId: data.facility_id,
      facilityName: data.facility_name,
    });

    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to create facility', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to create facility', err);
  }
}

export async function updateFacility(
  facilityId: string,
  updates: HCFacilityUpdate
): Promise<ServiceResult<HCFacility>> {
  try {
    const { data, error } = await supabase
      .from('hc_facility')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('facility_id', facilityId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Facility updated', { facilityId, updates: Object.keys(updates) });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to update facility', getErrorMessage(err), { facilityId });
    return failure('UNKNOWN_ERROR', 'Failed to update facility', err);
  }
}
