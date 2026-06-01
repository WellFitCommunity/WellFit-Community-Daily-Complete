/**
 * Hospital Workforce — Staff Management
 *
 * Extracted from hospitalWorkforceService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — functions moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { getErrorMessage } from './shared';
import {
  HCStaff,
  HCStaffInsert,
  HCStaffUpdate,
  HCActiveStaffView,
  HCEmploymentStatus,
  HCEmploymentType,
} from '../../types/hospitalWorkforce';

export interface StaffSearchOptions {
  organizationId?: string;
  departmentId?: string;
  facilityId?: string;
  roleTypeId?: string;
  employmentStatus?: HCEmploymentStatus;
  employmentType?: HCEmploymentType;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

export async function searchStaff(options: StaffSearchOptions = {}): Promise<ServiceResult<HCStaff[]>> {
  try {
    let query = supabase.from('hc_staff').select('staff_id, organization_id, employee_id, first_name, middle_name, last_name, suffix, preferred_name, former_names, date_of_birth, gender, email, phone_work, phone_mobile, phone_home, address_line1, address_line2, city, state, zip, hire_date, termination_date, employment_status, employment_type, npi, dea_number, upin, medicare_ptan, medicaid_id, primary_role_type_id, primary_department_id, primary_facility_id, user_account_id, source_system, source_id, source_data, migration_batch_id, migration_status, migration_notes, is_active, created_at, updated_at, created_by, updated_by');

    if (options.organizationId) query = query.eq('organization_id', options.organizationId);
    if (options.departmentId) query = query.eq('primary_department_id', options.departmentId);
    if (options.facilityId) query = query.eq('primary_facility_id', options.facilityId);
    if (options.roleTypeId) query = query.eq('primary_role_type_id', options.roleTypeId);
    if (options.employmentStatus) query = query.eq('employment_status', options.employmentStatus);
    if (options.employmentType) query = query.eq('employment_type', options.employmentType);

    if (options.searchTerm) {
      query = query.or(
        `last_name.ilike.%${options.searchTerm}%,first_name.ilike.%${options.searchTerm}%,email.ilike.%${options.searchTerm}%,employee_id.ilike.%${options.searchTerm}%,npi.ilike.%${options.searchTerm}%`
      );
    }

    query = query.eq('is_active', true);

    const limit = options.limit || 50;
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);
    query = query.order('last_name').order('first_name');

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to search staff', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to search staff', err);
  }
}

export async function getStaff(staffId: string): Promise<ServiceResult<HCStaff>> {
  try {
    const { data, error } = await supabase.from('hc_staff').select('staff_id, organization_id, employee_id, first_name, middle_name, last_name, suffix, preferred_name, former_names, date_of_birth, gender, email, phone_work, phone_mobile, phone_home, address_line1, address_line2, city, state, zip, hire_date, termination_date, employment_status, employment_type, npi, dea_number, upin, medicare_ptan, medicaid_id, primary_role_type_id, primary_department_id, primary_facility_id, user_account_id, source_system, source_id, source_data, migration_batch_id, migration_status, migration_notes, is_active, created_at, updated_at, created_by, updated_by').eq('staff_id', staffId).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return failure('NOT_FOUND', 'Staff member not found');
      }
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to get staff', getErrorMessage(err), { staffId });
    return failure('UNKNOWN_ERROR', 'Failed to get staff', err);
  }
}

export async function getStaffByNPI(npi: string): Promise<ServiceResult<HCStaff>> {
  try {
    const { data, error } = await supabase.from('hc_staff').select('staff_id, organization_id, employee_id, first_name, middle_name, last_name, suffix, preferred_name, former_names, date_of_birth, gender, email, phone_work, phone_mobile, phone_home, address_line1, address_line2, city, state, zip, hire_date, termination_date, employment_status, employment_type, npi, dea_number, upin, medicare_ptan, medicaid_id, primary_role_type_id, primary_department_id, primary_facility_id, user_account_id, source_system, source_id, source_data, migration_batch_id, migration_status, migration_notes, is_active, created_at, updated_at, created_by, updated_by').eq('npi', npi).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return failure('NOT_FOUND', 'Staff member not found');
      }
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to get staff by NPI', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to get staff by NPI', err);
  }
}

export async function createStaff(staff: HCStaffInsert): Promise<ServiceResult<HCStaff>> {
  try {
    if (staff.npi) {
      const { data: isValid } = await supabase.rpc('validate_hc_npi', { p_npi: staff.npi });
      if (!isValid) {
        return failure('VALIDATION_ERROR', 'Invalid NPI format');
      }
    }

    const { data, error } = await supabase.from('hc_staff').insert(staff).select().single();

    if (error) {
      if (error.code === '23505') {
        return failure('ALREADY_EXISTS', 'Staff member with this NPI already exists');
      }
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Staff created', { staffId: data.staff_id, organizationId: data.organization_id });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to create staff', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to create staff', err);
  }
}

export async function updateStaff(staffId: string, updates: HCStaffUpdate): Promise<ServiceResult<HCStaff>> {
  try {
    if (updates.npi) {
      const { data: isValid } = await supabase.rpc('validate_hc_npi', { p_npi: updates.npi });
      if (!isValid) {
        return failure('VALIDATION_ERROR', 'Invalid NPI format');
      }
    }

    const { data, error } = await supabase
      .from('hc_staff')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('staff_id', staffId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Staff updated', { staffId, updates: Object.keys(updates) });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to update staff', getErrorMessage(err), { staffId });
    return failure('UNKNOWN_ERROR', 'Failed to update staff', err);
  }
}

export async function deactivateStaff(staffId: string): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('hc_staff')
      .update({ is_active: false, employment_status: 'TERMINATED', updated_at: new Date().toISOString() })
      .eq('staff_id', staffId);

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Staff deactivated', { staffId });
    return success(undefined);
  } catch (err: unknown) {
    auditLogger.error('Failed to deactivate staff', getErrorMessage(err), { staffId });
    return failure('UNKNOWN_ERROR', 'Failed to deactivate staff', err);
  }
}

export async function getActiveStaff(organizationId?: string): Promise<ServiceResult<HCActiveStaffView[]>> {
  try {
    let query = supabase.from('vw_hc_active_staff').select('staff_id, organization_id, employee_id, first_name, middle_name, last_name, suffix, preferred_name, full_name_formal, full_name_display, email, phone_work, phone_mobile, npi, dea_number, hire_date, employment_status, employment_type, primary_role_code, primary_role_name, primary_role_abbrev, primary_category, is_clinical, is_prescriber, can_admit_patients, can_order, primary_department, primary_facility');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query.order('last_name').order('first_name');

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get active staff', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to get active staff', err);
  }
}
