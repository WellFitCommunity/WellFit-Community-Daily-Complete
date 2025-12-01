/**
 * Employee Service
 *
 * Manages employee profiles and related operations.
 * All operations are tenant-scoped via RLS.
 *
 * Architecture:
 *   profiles (all users) ──┬── employee_profiles (staff only - employment data)
 *                          └── fhir_practitioners (licensed providers - clinical credentials)
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import type {
  EmployeeProfile,
  EmployeeProfileInsert,
  EmployeeProfileUpdate,
  EmployeeDirectoryEntry,
  DirectReport,
  EmploymentStatus,
} from '../types/employee';
import { STAFF_ROLE_CODES } from '../types/employee';

/**
 * Employee profile filters
 */
export interface EmployeeFilters {
  departmentId?: string;
  employmentStatus?: EmploymentStatus;
  managerId?: string;
  employmentType?: string;
  searchTerm?: string;
}

export const EmployeeService = {
  // =========================================================================
  // EMPLOYEE PROFILE CRUD
  // =========================================================================

  /**
   * Get employee profile by user ID
   */
  async getEmployeeProfile(userId: string): Promise<ServiceResult<EmployeeProfile | null>> {
    try {
      const { data, error } = await supabase
        .from('employee_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = not found
        await auditLogger.error('EMPLOYEE_PROFILE_FETCH_FAILED', error, {
          category: 'ADMINISTRATIVE',
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || null);
    } catch (err) {
      await auditLogger.error('EMPLOYEE_PROFILE_FETCH_ERROR', err as Error, {
        category: 'ADMINISTRATIVE',
      });
      return failure('UNKNOWN_ERROR', 'Failed to fetch employee profile', err);
    }
  },

  /**
   * Get employee profile by ID
   */
  async getEmployeeProfileById(id: string): Promise<ServiceResult<EmployeeProfile | null>> {
    try {
      const { data, error } = await supabase
        .from('employee_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || null);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch employee profile', err);
    }
  },

  /**
   * Create a new employee profile
   */
  async createEmployeeProfile(
    profile: EmployeeProfileInsert
  ): Promise<ServiceResult<EmployeeProfile>> {
    try {
      // Check if employee profile already exists
      const { data: existing } = await supabase
        .from('employee_profiles')
        .select('id')
        .eq('user_id', profile.user_id)
        .single();

      if (existing) {
        return failure('ALREADY_EXISTS', 'Employee profile already exists for this user');
      }

      const { data, error } = await supabase
        .from('employee_profiles')
        .insert(profile)
        .select()
        .single();

      if (error) {
        await auditLogger.error('EMPLOYEE_PROFILE_CREATE_FAILED', error, {
          category: 'ADMINISTRATIVE',
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('EMPLOYEE_PROFILE_CREATED', {
        employee_profile_id: data.id,
        user_id: profile.user_id,
      });

      return success(data);
    } catch (err) {
      await auditLogger.error('EMPLOYEE_PROFILE_CREATE_ERROR', err as Error, {
        category: 'ADMINISTRATIVE',
      });
      return failure('UNKNOWN_ERROR', 'Failed to create employee profile', err);
    }
  },

  /**
   * Update an employee profile
   */
  async updateEmployeeProfile(
    userId: string,
    updates: EmployeeProfileUpdate
  ): Promise<ServiceResult<EmployeeProfile>> {
    try {
      const { data, error } = await supabase
        .from('employee_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        await auditLogger.error('EMPLOYEE_PROFILE_UPDATE_FAILED', error, {
          category: 'ADMINISTRATIVE',
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('EMPLOYEE_PROFILE_UPDATED', {
        employee_profile_id: data.id,
        user_id: userId,
        fields_updated: Object.keys(updates),
      });

      return success(data);
    } catch (err) {
      await auditLogger.error('EMPLOYEE_PROFILE_UPDATE_ERROR', err as Error, {
        category: 'ADMINISTRATIVE',
      });
      return failure('UNKNOWN_ERROR', 'Failed to update employee profile', err);
    }
  },

  /**
   * Delete an employee profile (soft delete recommended - set status to terminated)
   */
  async deleteEmployeeProfile(userId: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.from('employee_profiles').delete().eq('user_id', userId);

      if (error) {
        await auditLogger.error('EMPLOYEE_PROFILE_DELETE_FAILED', error, {
          category: 'ADMINISTRATIVE',
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('EMPLOYEE_PROFILE_DELETED', {
        user_id: userId,
      });

      return success(undefined);
    } catch (err) {
      await auditLogger.error('EMPLOYEE_PROFILE_DELETE_ERROR', err as Error, {
        category: 'ADMINISTRATIVE',
      });
      return failure('UNKNOWN_ERROR', 'Failed to delete employee profile', err);
    }
  },

  // =========================================================================
  // EMPLOYEE DIRECTORY
  // =========================================================================

  /**
   * Get employee directory (all employees with joined data)
   */
  async getEmployeeDirectory(
    filters?: EmployeeFilters
  ): Promise<ServiceResult<EmployeeDirectoryEntry[]>> {
    try {
      let query = supabase.from('employee_directory').select('*');

      // Apply filters
      if (filters?.departmentId) {
        query = query.eq('department_id', filters.departmentId);
      }
      if (filters?.employmentStatus) {
        query = query.eq('employment_status', filters.employmentStatus);
      }
      if (filters?.managerId) {
        query = query.eq('manager_id', filters.managerId);
      }
      if (filters?.employmentType) {
        query = query.eq('employment_type', filters.employmentType);
      }
      if (filters?.searchTerm) {
        query = query.or(
          `full_name.ilike.%${filters.searchTerm}%,employee_number.ilike.%${filters.searchTerm}%,job_title.ilike.%${filters.searchTerm}%`
        );
      }

      const { data, error } = await query.order('full_name');

      if (error) {
        await auditLogger.error('EMPLOYEE_DIRECTORY_FETCH_FAILED', error, {
          category: 'ADMINISTRATIVE',
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err) {
      await auditLogger.error('EMPLOYEE_DIRECTORY_FETCH_ERROR', err as Error, {
        category: 'ADMINISTRATIVE',
      });
      return failure('UNKNOWN_ERROR', 'Failed to fetch employee directory', err);
    }
  },

  /**
   * Get active employees only
   */
  async getActiveEmployees(): Promise<ServiceResult<EmployeeDirectoryEntry[]>> {
    return this.getEmployeeDirectory({ employmentStatus: 'active' });
  },

  /**
   * Get employees by department
   */
  async getEmployeesByDepartment(
    departmentId: string
  ): Promise<ServiceResult<EmployeeDirectoryEntry[]>> {
    return this.getEmployeeDirectory({ departmentId, employmentStatus: 'active' });
  },

  // =========================================================================
  // ORGANIZATIONAL HIERARCHY
  // =========================================================================

  /**
   * Get direct reports for a manager
   */
  async getDirectReports(managerUserId: string): Promise<ServiceResult<DirectReport[]>> {
    try {
      const { data, error } = await supabase.rpc('get_direct_reports', {
        p_manager_user_id: managerUserId,
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch direct reports', err);
    }
  },

  /**
   * Set manager for an employee
   */
  async setManager(
    employeeUserId: string,
    managerUserId: string | null
  ): Promise<ServiceResult<EmployeeProfile>> {
    try {
      // Get manager's employee profile ID if setting a manager
      let managerId: string | null = null;
      if (managerUserId) {
        const { data: managerProfile } = await supabase
          .from('employee_profiles')
          .select('id')
          .eq('user_id', managerUserId)
          .single();

        if (!managerProfile) {
          return failure('NOT_FOUND', 'Manager employee profile not found');
        }
        managerId = managerProfile.id;
      }

      return this.updateEmployeeProfile(employeeUserId, { manager_id: managerId ?? undefined });
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to set manager', err);
    }
  },

  // =========================================================================
  // CREDENTIALS & COMPLIANCE
  // =========================================================================

  /**
   * Mark employee credentials as verified
   */
  async verifyCredentials(
    employeeUserId: string,
    verifiedByUserId: string
  ): Promise<ServiceResult<EmployeeProfile>> {
    try {
      // Get verifier's employee profile ID
      const { data: verifierProfile } = await supabase
        .from('employee_profiles')
        .select('id')
        .eq('user_id', verifiedByUserId)
        .single();

      const verifierId = verifierProfile?.id || null;

      return this.updateEmployeeProfile(employeeUserId, {
        credentials_verified: true,
        credentials_verified_at: new Date().toISOString(),
        credentials_verified_by: verifierId,
      });
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to verify credentials', err);
    }
  },

  /**
   * Update HIPAA training date
   */
  async updateHIPAATraining(employeeUserId: string): Promise<ServiceResult<EmployeeProfile>> {
    return this.updateEmployeeProfile(employeeUserId, {
      hipaa_training_date: new Date().toISOString().split('T')[0],
    });
  },

  /**
   * Update compliance training date
   */
  async updateComplianceTraining(employeeUserId: string): Promise<ServiceResult<EmployeeProfile>> {
    return this.updateEmployeeProfile(employeeUserId, {
      last_compliance_training: new Date().toISOString().split('T')[0],
    });
  },

  /**
   * Update background check
   */
  async updateBackgroundCheck(
    employeeUserId: string,
    status: 'pending' | 'passed' | 'failed' | 'expired' | 'waived'
  ): Promise<ServiceResult<EmployeeProfile>> {
    return this.updateEmployeeProfile(employeeUserId, {
      background_check_date: new Date().toISOString().split('T')[0],
      background_check_status: status,
    });
  },

  // =========================================================================
  // EMPLOYMENT STATUS
  // =========================================================================

  /**
   * Terminate an employee
   */
  async terminateEmployee(
    employeeUserId: string,
    terminationDate?: string
  ): Promise<ServiceResult<EmployeeProfile>> {
    return this.updateEmployeeProfile(employeeUserId, {
      employment_status: 'terminated',
      termination_date: terminationDate || new Date().toISOString().split('T')[0],
    });
  },

  /**
   * Place employee on leave
   */
  async placeOnLeave(employeeUserId: string): Promise<ServiceResult<EmployeeProfile>> {
    return this.updateEmployeeProfile(employeeUserId, {
      employment_status: 'on_leave',
    });
  },

  /**
   * Reactivate an employee (from leave or suspended)
   */
  async reactivateEmployee(employeeUserId: string): Promise<ServiceResult<EmployeeProfile>> {
    return this.updateEmployeeProfile(employeeUserId, {
      employment_status: 'active',
    });
  },

  // =========================================================================
  // UTILITY FUNCTIONS
  // =========================================================================

  /**
   * Check if a user has an employee profile
   */
  async hasEmployeeProfile(userId: string): Promise<ServiceResult<boolean>> {
    try {
      const { data, error } = await supabase.rpc('has_employee_profile', {
        p_user_id: userId,
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data === true);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to check employee profile', err);
    }
  },

  /**
   * Get employee by employee number
   */
  async getEmployeeByNumber(
    employeeNumber: string,
    tenantId: string
  ): Promise<ServiceResult<EmployeeDirectoryEntry | null>> {
    try {
      const { data, error } = await supabase.rpc('get_employee_by_number', {
        p_employee_number: employeeNumber,
        p_tenant_id: tenantId,
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data?.[0] || null);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch employee by number', err);
    }
  },

  /**
   * Get all staff users who don't have employee profiles yet
   * Useful for backfill/migration
   */
  async getStaffWithoutEmployeeProfile(
    tenantId: string
  ): Promise<ServiceResult<Array<{ user_id: string; first_name: string; last_name: string; role_code: number }>>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, role_code')
        .eq('tenant_id', tenantId)
        .in('role_code', STAFF_ROLE_CODES as unknown as number[])
        .not('user_id', 'in', supabase.from('employee_profiles').select('user_id'));

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch staff without employee profiles', err);
    }
  },

  /**
   * Bulk create employee profiles for existing staff
   * Useful for migration/backfill
   */
  async bulkCreateEmployeeProfiles(
    profiles: EmployeeProfileInsert[]
  ): Promise<ServiceResult<{ created: number; errors: string[] }>> {
    const results = { created: 0, errors: [] as string[] };

    for (const profile of profiles) {
      const result = await this.createEmployeeProfile(profile);
      if (result.success) {
        results.created++;
      } else {
        results.errors.push(`User ${profile.user_id}: ${result.error.message}`);
      }
    }

    await auditLogger.info('EMPLOYEE_PROFILES_BULK_CREATED', {
      created: results.created,
      errors_count: results.errors.length,
    });

    return success(results);
  },
};

export default EmployeeService;
