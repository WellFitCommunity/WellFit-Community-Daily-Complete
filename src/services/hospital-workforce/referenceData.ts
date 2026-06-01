/**
 * Hospital Workforce — Reference Data Queries
 *
 * Extracted from hospitalWorkforceService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — functions moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { getErrorMessage } from './shared';
import {
  RefStaffCategory,
  RefRoleType,
  RefCredentialType,
  RefLicenseType,
} from '../../types/hospitalWorkforce';

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
