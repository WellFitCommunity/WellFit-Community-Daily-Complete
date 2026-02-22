/**
 * Hospital Workforce Service
 *
 * Service layer for managing hospital workforce data migrated from
 * Epic, Cerner, Meditech, Allscripts, and legacy Excel imports.
 *
 * Uses ServiceResult pattern for consistent error handling.
 * All PHI remains server-side - client only receives IDs.
 */

import { supabase } from '../lib/supabaseClient';
import { ServiceResult, success, failure } from './_base';
import { auditLogger } from './auditLogger';
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
  HCStaff,
  HCStaffInsert,
  HCStaffUpdate,
  HCStaffRole,
  HCStaffRoleInsert,
  HCStaffCredential,
  HCStaffCredentialInsert,
  HCStaffCredentialUpdate,
  HCStaffLicense,
  HCStaffLicenseInsert,
  HCStaffLicenseUpdate,
  HCStaffBoardCertification,
  HCStaffBoardCertificationInsert,
  HCStaffPrivilege,
  HCStaffPrivilegeInsert,
  HCStaffReporting,
  HCStaffReportingInsert,
  HCProviderGroup,
  HCProviderGroupInsert,
  // HCStaffGroupAffiliation - type available for group affiliations
  HCStaffEHRMapping,
  HCStaffEHRMappingInsert,
  HCMigrationBatch,
  HCMigrationBatchInsert,
  HCMigrationBatchUpdate,
  HCMigrationLog,
  HCMigrationLogInsert,
  HCActiveStaffView,
  HCExpiringCredentialView,
  HCEmploymentStatus,
  HCEmploymentType,
  RefStaffCategory,
  RefRoleType,
  RefCredentialType,
  RefLicenseType,
} from '../types/hospitalWorkforce';

// Helper to get error message safely
function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ============================================================================
// REFERENCE DATA QUERIES
// ============================================================================

export async function getStaffCategories(): Promise<ServiceResult<RefStaffCategory[]>> {
  try {
    const { data, error } = await supabase
      .from('ref_staff_category')
      .select('category_id, category_code, category_name, display_order, is_clinical, created_at, updated_at')
      .order('display_order');

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get staff categories', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to get staff categories', err);
  }
}

export async function getRoleTypes(categoryId?: string): Promise<ServiceResult<RefRoleType[]>> {
  try {
    let query = supabase.from('ref_role_type').select('role_type_id, category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code, created_at, updated_at');
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    const { data, error } = await query.order('role_name');

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get role types', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to get role types', err);
  }
}

export async function getCredentialTypes(): Promise<ServiceResult<RefCredentialType[]>> {
  try {
    const { data, error } = await supabase
      .from('ref_credential_type')
      .select('credential_type_id, credential_code, credential_name, credential_category, issuing_body, requires_renewal, typical_renewal_years, created_at')
      .order('credential_name');

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get credential types', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to get credential types', err);
  }
}

export async function getLicenseTypes(): Promise<ServiceResult<RefLicenseType[]>> {
  try {
    const { data, error } = await supabase
      .from('ref_license_type')
      .select('license_type_id, license_code, license_name, applicable_roles, state_specific, created_at')
      .order('license_name');

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get license types', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to get license types', err);
  }
}

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

// ============================================================================
// STAFF MANAGEMENT
// ============================================================================

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

// ============================================================================
// STAFF ROLES
// ============================================================================

export async function getStaffRoles(staffId: string): Promise<ServiceResult<HCStaffRole[]>> {
  try {
    const { data, error } = await supabase
      .from('hc_staff_role')
      .select('staff_role_id, staff_id, role_type_id, department_id, facility_id, is_primary, effective_date, end_date, fte, source_system, source_id, created_at, updated_at')
      .eq('staff_id', staffId)
      .is('end_date', null)
      .order('is_primary', { ascending: false });

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get staff roles', getErrorMessage(err), { staffId });
    return failure('UNKNOWN_ERROR', 'Failed to get staff roles', err);
  }
}

export async function assignStaffRole(role: HCStaffRoleInsert): Promise<ServiceResult<HCStaffRole>> {
  try {
    const { data, error } = await supabase.from('hc_staff_role').insert(role).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Staff role assigned', { staffId: role.staff_id, roleTypeId: role.role_type_id });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to assign staff role', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to assign staff role', err);
  }
}

export async function endStaffRole(staffRoleId: string, endDate: string): Promise<ServiceResult<HCStaffRole>> {
  try {
    const { data, error } = await supabase
      .from('hc_staff_role')
      .update({ end_date: endDate, updated_at: new Date().toISOString() })
      .eq('staff_role_id', staffRoleId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Staff role ended', { staffRoleId, endDate });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to end staff role', getErrorMessage(err), { staffRoleId });
    return failure('UNKNOWN_ERROR', 'Failed to end staff role', err);
  }
}

// ============================================================================
// CREDENTIALS
// ============================================================================

export async function getStaffCredentials(staffId: string): Promise<ServiceResult<HCStaffCredential[]>> {
  try {
    const { data, error } = await supabase
      .from('hc_staff_credential')
      .select('staff_credential_id, staff_id, credential_type_id, credential_number, issued_date, expiration_date, issuing_institution, verification_status, verification_date, verified_by, document_url, notes, source_system, source_id, created_at, updated_at')
      .eq('staff_id', staffId)
      .order('expiration_date', { nullsFirst: true });

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get staff credentials', getErrorMessage(err), { staffId });
    return failure('UNKNOWN_ERROR', 'Failed to get staff credentials', err);
  }
}

export async function addStaffCredential(
  credential: HCStaffCredentialInsert
): Promise<ServiceResult<HCStaffCredential>> {
  try {
    const { data, error } = await supabase.from('hc_staff_credential').insert(credential).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Staff credential added', {
      staffId: credential.staff_id,
      credentialTypeId: credential.credential_type_id,
    });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to add staff credential', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to add staff credential', err);
  }
}

export async function updateStaffCredential(
  credentialId: string,
  updates: HCStaffCredentialUpdate
): Promise<ServiceResult<HCStaffCredential>> {
  try {
    const { data, error } = await supabase
      .from('hc_staff_credential')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('staff_credential_id', credentialId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Staff credential updated', { credentialId, updates: Object.keys(updates) });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to update staff credential', getErrorMessage(err), { credentialId });
    return failure('UNKNOWN_ERROR', 'Failed to update staff credential', err);
  }
}

export async function getStaffCredentialsDisplay(staffId: string): Promise<ServiceResult<string | null>> {
  try {
    const { data, error } = await supabase.rpc('get_hc_staff_credentials_display', { p_staff_id: staffId });

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to get staff credentials display', getErrorMessage(err), { staffId });
    return failure('UNKNOWN_ERROR', 'Failed to get staff credentials display', err);
  }
}

// ============================================================================
// LICENSES
// ============================================================================

export async function getStaffLicenses(staffId: string): Promise<ServiceResult<HCStaffLicense[]>> {
  try {
    const { data, error } = await supabase
      .from('hc_staff_license')
      .select('staff_license_id, staff_id, license_type_id, license_number, state, issued_date, expiration_date, status, compact_license, verification_status, verification_date, verified_by, primary_source_verified, document_url, notes, source_system, source_id, created_at, updated_at')
      .eq('staff_id', staffId)
      .order('expiration_date', { nullsFirst: true });

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get staff licenses', getErrorMessage(err), { staffId });
    return failure('UNKNOWN_ERROR', 'Failed to get staff licenses', err);
  }
}

export async function addStaffLicense(license: HCStaffLicenseInsert): Promise<ServiceResult<HCStaffLicense>> {
  try {
    const { data, error } = await supabase.from('hc_staff_license').insert(license).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Staff license added', {
      staffId: license.staff_id,
      licenseTypeId: license.license_type_id,
      state: license.state,
    });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to add staff license', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to add staff license', err);
  }
}

export async function updateStaffLicense(
  licenseId: string,
  updates: HCStaffLicenseUpdate
): Promise<ServiceResult<HCStaffLicense>> {
  try {
    const { data, error } = await supabase
      .from('hc_staff_license')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('staff_license_id', licenseId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Staff license updated', { licenseId, updates: Object.keys(updates) });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to update staff license', getErrorMessage(err), { licenseId });
    return failure('UNKNOWN_ERROR', 'Failed to update staff license', err);
  }
}

export async function hasActiveLicense(staffId: string, state: string): Promise<ServiceResult<boolean>> {
  try {
    const { data, error } = await supabase.rpc('has_hc_active_license', { p_staff_id: staffId, p_state: state });

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data ?? false);
  } catch (err: unknown) {
    auditLogger.error('Failed to check active license', getErrorMessage(err), { staffId, state });
    return failure('UNKNOWN_ERROR', 'Failed to check active license', err);
  }
}

// ============================================================================
// BOARD CERTIFICATIONS
// ============================================================================

export async function getStaffBoardCertifications(
  staffId: string
): Promise<ServiceResult<HCStaffBoardCertification[]>> {
  try {
    const { data, error } = await supabase
      .from('hc_staff_board_certification')
      .select('board_cert_id, staff_id, board_name, specialty, subspecialty, certificate_number, initial_certification_date, expiration_date, moc_status, status, verification_status, verification_date, document_url, source_system, source_id, created_at, updated_at')
      .eq('staff_id', staffId)
      .order('expiration_date', { nullsFirst: true });

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get staff board certifications', getErrorMessage(err), { staffId });
    return failure('UNKNOWN_ERROR', 'Failed to get staff board certifications', err);
  }
}

export async function addStaffBoardCertification(
  cert: HCStaffBoardCertificationInsert
): Promise<ServiceResult<HCStaffBoardCertification>> {
  try {
    const { data, error } = await supabase.from('hc_staff_board_certification').insert(cert).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Staff board certification added', {
      staffId: cert.staff_id,
      boardName: cert.board_name,
      specialty: cert.specialty,
    });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to add staff board certification', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to add staff board certification', err);
  }
}

// ============================================================================
// PRIVILEGES
// ============================================================================

export async function getStaffPrivileges(staffId: string): Promise<ServiceResult<HCStaffPrivilege[]>> {
  try {
    const { data, error } = await supabase
      .from('hc_staff_privilege')
      .select('privilege_id, staff_id, facility_id, privilege_category, privilege_name, privilege_code, privilege_level, status, effective_date, expiration_date, approved_by, approval_date, conditions, proctoring_required, proctor_staff_id, cases_required, cases_completed, source_system, source_id, created_at, updated_at')
      .eq('staff_id', staffId)
      .order('privilege_name');

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get staff privileges', getErrorMessage(err), { staffId });
    return failure('UNKNOWN_ERROR', 'Failed to get staff privileges', err);
  }
}

export async function addStaffPrivilege(privilege: HCStaffPrivilegeInsert): Promise<ServiceResult<HCStaffPrivilege>> {
  try {
    const { data, error } = await supabase.from('hc_staff_privilege').insert(privilege).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Staff privilege added', {
      staffId: privilege.staff_id,
      facilityId: privilege.facility_id,
      privilegeName: privilege.privilege_name,
    });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to add staff privilege', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to add staff privilege', err);
  }
}

// ============================================================================
// REPORTING RELATIONSHIPS
// ============================================================================

export async function getDirectReports(supervisorId: string): Promise<ServiceResult<HCStaffReporting[]>> {
  try {
    const { data, error } = await supabase
      .from('hc_staff_reporting')
      .select('reporting_id, staff_id, supervisor_id, relationship_type, effective_date, end_date, source_system, source_id, created_at, updated_at')
      .eq('supervisor_id', supervisorId)
      .is('end_date', null);

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get direct reports', getErrorMessage(err), { supervisorId });
    return failure('UNKNOWN_ERROR', 'Failed to get direct reports', err);
  }
}

export async function getSupervisorChain(staffId: string): Promise<ServiceResult<HCStaffReporting[]>> {
  try {
    const { data, error } = await supabase
      .from('hc_staff_reporting')
      .select('reporting_id, staff_id, supervisor_id, relationship_type, effective_date, end_date, source_system, source_id, created_at, updated_at')
      .eq('staff_id', staffId)
      .is('end_date', null);

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get supervisor chain', getErrorMessage(err), { staffId });
    return failure('UNKNOWN_ERROR', 'Failed to get supervisor chain', err);
  }
}

export async function assignSupervisor(reporting: HCStaffReportingInsert): Promise<ServiceResult<HCStaffReporting>> {
  try {
    const { data, error } = await supabase.from('hc_staff_reporting').insert(reporting).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Supervisor assigned', {
      staffId: reporting.staff_id,
      supervisorId: reporting.supervisor_id,
      relationshipType: reporting.relationship_type,
    });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to assign supervisor', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to assign supervisor', err);
  }
}

// ============================================================================
// EHR MAPPINGS
// ============================================================================

export async function getStaffEHRMappings(staffId: string): Promise<ServiceResult<HCStaffEHRMapping[]>> {
  try {
    const { data, error } = await supabase.from('hc_staff_ehr_mapping').select('mapping_id, staff_id, ehr_system, ehr_user_id, ehr_provider_id, ehr_login, ehr_department_id, is_active, last_login, created_at, updated_at').eq('staff_id', staffId);

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get staff EHR mappings', getErrorMessage(err), { staffId });
    return failure('UNKNOWN_ERROR', 'Failed to get staff EHR mappings', err);
  }
}

export async function addStaffEHRMapping(mapping: HCStaffEHRMappingInsert): Promise<ServiceResult<HCStaffEHRMapping>> {
  try {
    const { data, error } = await supabase.from('hc_staff_ehr_mapping').insert(mapping).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Staff EHR mapping added', { staffId: mapping.staff_id, ehrSystem: mapping.ehr_system });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to add staff EHR mapping', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to add staff EHR mapping', err);
  }
}

// ============================================================================
// EXPIRING CREDENTIALS
// ============================================================================

export async function getExpiringCredentials(
  organizationId?: string,
  daysAhead: number = 90
): Promise<ServiceResult<HCExpiringCredentialView[]>> {
  try {
    const { data, error } = await supabase
      .from('vw_hc_expiring_credentials')
      .select('staff_id, employee_id, staff_name, email, credential_type, credential_name, credential_number, state, expiration_date, days_until_expiration')
      .order('days_until_expiration');

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    let filtered = data || [];
    if (daysAhead !== 90) {
      filtered = filtered.filter(
        (c) => c.days_until_expiration <= daysAhead && c.days_until_expiration >= 0
      );
    }

    return success(filtered);
  } catch (err: unknown) {
    auditLogger.error('Failed to get expiring credentials', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to get expiring credentials', err);
  }
}

// ============================================================================
// MIGRATION BATCHES
// ============================================================================

export async function createMigrationBatch(batch: HCMigrationBatchInsert): Promise<ServiceResult<HCMigrationBatch>> {
  try {
    const { data, error } = await supabase.from('hc_migration_batch').insert(batch).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Migration batch created', {
      batchId: data.batch_id,
      sourceSystem: batch.source_system,
      recordCount: batch.record_count,
    });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to create migration batch', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to create migration batch', err);
  }
}

export async function getMigrationBatch(batchId: string): Promise<ServiceResult<HCMigrationBatch>> {
  try {
    const { data, error } = await supabase
      .from('hc_migration_batch')
      .select('batch_id, organization_id, source_system, source_file_name, source_file_hash, record_count, success_count, error_count, warning_count, status, started_at, completed_at, started_by, notes, created_at')
      .eq('batch_id', batchId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return failure('NOT_FOUND', 'Migration batch not found');
      }
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to get migration batch', getErrorMessage(err), { batchId });
    return failure('UNKNOWN_ERROR', 'Failed to get migration batch', err);
  }
}

export async function updateMigrationBatch(
  batchId: string,
  updates: HCMigrationBatchUpdate
): Promise<ServiceResult<HCMigrationBatch>> {
  try {
    const { data, error } = await supabase
      .from('hc_migration_batch')
      .update(updates)
      .eq('batch_id', batchId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Migration batch updated', { batchId, updates: Object.keys(updates) });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to update migration batch', getErrorMessage(err), { batchId });
    return failure('UNKNOWN_ERROR', 'Failed to update migration batch', err);
  }
}

export async function addMigrationLog(log: HCMigrationLogInsert): Promise<ServiceResult<HCMigrationLog>> {
  try {
    const { data, error } = await supabase.from('hc_migration_log').insert(log).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to add migration log', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to add migration log', err);
  }
}

export async function getMigrationLogs(
  batchId: string,
  severity?: 'ERROR' | 'WARNING' | 'INFO'
): Promise<ServiceResult<HCMigrationLog[]>> {
  try {
    let query = supabase.from('hc_migration_log').select('log_id, batch_id, source_row_number, source_record_id, table_name, field_name, severity, error_code, message, source_value, suggested_fix, is_resolved, resolved_by, resolved_at, created_at').eq('batch_id', batchId);
    if (severity) {
      query = query.eq('severity', severity);
    }
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get migration logs', getErrorMessage(err), { batchId });
    return failure('UNKNOWN_ERROR', 'Failed to get migration logs', err);
  }
}

// ============================================================================
// PROVIDER GROUPS
// ============================================================================

export async function getProviderGroups(organizationId: string): Promise<ServiceResult<HCProviderGroup[]>> {
  try {
    const { data, error } = await supabase
      .from('hc_provider_group')
      .select('group_id, organization_id, group_name, group_npi, tax_id, is_active, source_system, source_id, created_at, updated_at')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('group_name');

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get provider groups', getErrorMessage(err), { organizationId });
    return failure('UNKNOWN_ERROR', 'Failed to get provider groups', err);
  }
}

export async function createProviderGroup(group: HCProviderGroupInsert): Promise<ServiceResult<HCProviderGroup>> {
  try {
    const { data, error } = await supabase.from('hc_provider_group').insert(group).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Provider group created', { groupId: data.group_id, groupName: data.group_name });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to create provider group', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to create provider group', err);
  }
}

// ============================================================================
// VALIDATE NPI
// ============================================================================

export async function validateNPI(npi: string): Promise<ServiceResult<boolean>> {
  try {
    const { data, error } = await supabase.rpc('validate_hc_npi', { p_npi: npi });

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data ?? false);
  } catch (err: unknown) {
    auditLogger.error('Failed to validate NPI', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to validate NPI', err);
  }
}

// ============================================================================
// EXPORT SERVICE OBJECT
// ============================================================================

export const HospitalWorkforceService = {
  getStaffCategories,
  getRoleTypes,
  getCredentialTypes,
  getLicenseTypes,
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  getDepartments,
  createDepartment,
  updateDepartment,
  getFacilities,
  createFacility,
  updateFacility,
  searchStaff,
  getStaff,
  getStaffByNPI,
  createStaff,
  updateStaff,
  deactivateStaff,
  getActiveStaff,
  getStaffRoles,
  assignStaffRole,
  endStaffRole,
  getStaffCredentials,
  addStaffCredential,
  updateStaffCredential,
  getStaffCredentialsDisplay,
  getStaffLicenses,
  addStaffLicense,
  updateStaffLicense,
  hasActiveLicense,
  getStaffBoardCertifications,
  addStaffBoardCertification,
  getStaffPrivileges,
  addStaffPrivilege,
  getDirectReports,
  getSupervisorChain,
  assignSupervisor,
  getStaffEHRMappings,
  addStaffEHRMapping,
  getExpiringCredentials,
  createMigrationBatch,
  getMigrationBatch,
  updateMigrationBatch,
  addMigrationLog,
  getMigrationLogs,
  getProviderGroups,
  createProviderGroup,
  validateNPI,
};

export default HospitalWorkforceService;
