/**
 * Hospital Workforce — Roles, Credentials, Licenses, Board Certs, Privileges
 *
 * Extracted from hospitalWorkforceService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — functions moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { getErrorMessage } from './shared';
import {
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
} from '../../types/hospitalWorkforce';

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
