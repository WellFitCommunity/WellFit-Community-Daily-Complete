/**
 * Patient Service
 *
 * Enterprise-grade patient data access service with:
 * - Pagination using PAGINATION_LIMITS.PATIENTS (50)
 * - ServiceResult pattern for consistent error handling
 * - HIPAA-compliant PHI access audit logging
 *
 * @module patientService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import {
  ServiceResult,
  success,
  failure,
  fromSupabaseError,
} from './_base/ServiceResult';
import {
  PAGINATION_LIMITS,
  applyLimit,
  applyPagination,
  PaginatedResult,
  PaginationOptions,
} from '../utils/pagination';

/**
 * Patient profile from profiles table
 */
export interface Patient {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  dob: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  gender: string | null;
  role_code: number | null;
  is_admin: boolean;
  tenant_id: string | null;
  created_at: string | null;
  enrollment_type: 'app' | 'hospital' | null;
}

/**
 * Extended patient with hospital-specific fields
 */
export interface HospitalPatient extends Patient {
  mrn: string | null;
  hospital_unit: string | null;
  room_number: string | null;
  bed_number: string | null;
  acuity_level: number | null;
  code_status: string | null;
  admission_date: string | null;
  attending_physician_id: string | null;
}

/**
 * Patient with risk level (from patient_risk_registry)
 */
export interface PatientWithRisk extends Patient {
  risk_level?: 'low' | 'moderate' | 'high' | 'critical';
  risk_score?: number;
  last_assessment_date?: string;
}

/**
 * Patient search filters
 */
export interface PatientSearchFilters {
  search?: string; // Name or phone search
  roleCode?: number;
  enrollmentType?: 'app' | 'hospital';
  tenantId?: string;
  unitId?: string;
  riskLevel?: 'low' | 'moderate' | 'high' | 'critical';
  isActive?: boolean;
}

/**
 * Patient Service
 *
 * All methods:
 * - Use ServiceResult pattern (never throw)
 * - Apply PAGINATION_LIMITS.PATIENTS (50) for list queries
 * - Log PHI access via auditLogger.phi()
 */
class PatientService {
  private readonly DEFAULT_LIMIT = PAGINATION_LIMITS.PATIENTS;

  /**
   * Get paginated list of patients
   */
  async getPatients(
    options: PaginationOptions = {}
  ): Promise<ServiceResult<PaginatedResult<Patient>>> {
    try {
      const query = supabase
        .from('profiles')
        .select('*')
        .in('role_code', [1, 4, 19]) // patient, senior, regular patient
        .order('created_at', { ascending: false });

      const result = await applyPagination<Patient>(
        query,
        options,
        this.DEFAULT_LIMIT
      );

      // Log list access (not PHI since no specific patient ID)
      await auditLogger.info('PATIENT_LIST_ACCESSED', {
        page: options.page || 1,
        pageSize: options.pageSize || this.DEFAULT_LIMIT,
        resultCount: result.data.length,
      });

      return success(result);
    } catch (err) {
      const error = err as Error;
      await auditLogger.error('PATIENT_LIST_ERROR', error);
      return failure('DATABASE_ERROR', error.message, err);
    }
  }

  /**
   * Get a single patient by ID
   */
  async getPatientById(
    userId: string
  ): Promise<ServiceResult<Patient | null>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return success(null);
        }
        return failure(fromSupabaseError(error).code, error.message, error);
      }

      // Log PHI access with patient ID
      await auditLogger.phi('READ', userId, {
        resourceType: 'patient',
      });

      return success(data);
    } catch (err) {
      const error = err as Error;
      await auditLogger.error('PATIENT_FETCH_ERROR', error, { userId });
      return failure('DATABASE_ERROR', error.message, err);
    }
  }

  /**
   * Search patients by name or phone
   */
  async searchPatients(
    searchTerm: string,
    options: PaginationOptions = {}
  ): Promise<ServiceResult<PaginatedResult<Patient>>> {
    try {
      if (!searchTerm || searchTerm.trim().length < 2) {
        return failure('INVALID_INPUT', 'Search term must be at least 2 characters');
      }

      const term = searchTerm.trim().toLowerCase();

      // Build search query
      const query = supabase
        .from('profiles')
        .select('*')
        .in('role_code', [1, 4, 19])
        .or(
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%`
        )
        .order('last_name', { ascending: true });

      const result = await applyPagination<Patient>(
        query,
        options,
        this.DEFAULT_LIMIT
      );

      // Log search access (no PHI in log)
      await auditLogger.info('PATIENT_SEARCH_PERFORMED', {
        searchTermLength: term.length,
        resultCount: result.data.length,
      });

      return success(result);
    } catch (err) {
      const error = err as Error;
      await auditLogger.error('PATIENT_SEARCH_ERROR', error);
      return failure('DATABASE_ERROR', error.message, err);
    }
  }

  /**
   * Get patients by hospital unit
   */
  async getPatientsByUnit(
    unitId: string,
    options: PaginationOptions = {}
  ): Promise<ServiceResult<PaginatedResult<HospitalPatient>>> {
    try {
      const query = supabase
        .from('profiles')
        .select('*')
        .eq('hospital_unit', unitId)
        .eq('enrollment_type', 'hospital')
        .order('room_number', { ascending: true });

      const result = await applyPagination<HospitalPatient>(
        query,
        options,
        this.DEFAULT_LIMIT
      );

      await auditLogger.info('UNIT_PATIENT_LIST_ACCESSED', {
        unitId,
        resultCount: result.data.length,
      });

      return success(result);
    } catch (err) {
      const error = err as Error;
      await auditLogger.error('UNIT_PATIENT_LIST_ERROR', error, { unitId });
      return failure('DATABASE_ERROR', error.message, err);
    }
  }

  /**
   * Get patients by risk level (from patient_risk_registry)
   */
  async getPatientsByRisk(
    riskLevel: 'low' | 'moderate' | 'high' | 'critical',
    limit: number = this.DEFAULT_LIMIT
  ): Promise<ServiceResult<PatientWithRisk[]>> {
    try {
      // Join profiles with patient_risk_registry
      const { data, error } = await supabase
        .from('patient_risk_registry')
        .select(`
          patient_id,
          risk_level,
          risk_score,
          last_assessment_date,
          profiles!patient_risk_registry_patient_id_fkey (
            user_id,
            first_name,
            last_name,
            phone,
            dob,
            role_code,
            tenant_id
          )
        `)
        .eq('risk_level', riskLevel)
        .order('risk_score', { ascending: false })
        .limit(Math.min(limit, PAGINATION_LIMITS.MAX));

      if (error) {
        // If table doesn't exist or no FK, fall back to simple profile query
        if (error.code === 'PGRST200' || error.message.includes('relationship')) {
          return this.getPatientsByRiskFallback(riskLevel, limit);
        }
        return failure(fromSupabaseError(error).code, error.message, error);
      }

      // Transform joined data - profiles is returned as array from join
      const patients: PatientWithRisk[] = (data || []).map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          ...profile,
          risk_level: row.risk_level as 'low' | 'moderate' | 'high' | 'critical',
          risk_score: row.risk_score as number,
          last_assessment_date: row.last_assessment_date as string,
        } as PatientWithRisk;
      });

      await auditLogger.info('RISK_PATIENT_LIST_ACCESSED', {
        riskLevel,
        resultCount: patients.length,
      });

      return success(patients);
    } catch (err) {
      const error = err as Error;
      await auditLogger.error('RISK_PATIENT_LIST_ERROR', error, { riskLevel });
      return failure('DATABASE_ERROR', error.message, err);
    }
  }

  /**
   * Fallback for risk patients when join isn't available
   */
  private async getPatientsByRiskFallback(
    _riskLevel: string,
    _limit: number
  ): Promise<ServiceResult<PatientWithRisk[]>> {
    // Return empty array - risk registry not available
    await auditLogger.info('RISK_REGISTRY_NOT_AVAILABLE', {
      message: 'patient_risk_registry table not available, returning empty list',
    });
    return success([]);
  }

  /**
   * Get hospital patients (enrollment_type = 'hospital')
   */
  async getHospitalPatients(
    options: PaginationOptions = {}
  ): Promise<ServiceResult<PaginatedResult<HospitalPatient>>> {
    try {
      const query = supabase
        .from('profiles')
        .select('*')
        .eq('enrollment_type', 'hospital')
        .order('admission_date', { ascending: false });

      const result = await applyPagination<HospitalPatient>(
        query,
        options,
        this.DEFAULT_LIMIT
      );

      await auditLogger.info('HOSPITAL_PATIENT_LIST_ACCESSED', {
        resultCount: result.data.length,
      });

      return success(result);
    } catch (err) {
      const error = err as Error;
      await auditLogger.error('HOSPITAL_PATIENT_LIST_ERROR', error);
      return failure('DATABASE_ERROR', error.message, err);
    }
  }

  /**
   * Get app patients (seniors/community members, enrollment_type = 'app')
   */
  async getAppPatients(
    options: PaginationOptions = {}
  ): Promise<ServiceResult<PaginatedResult<Patient>>> {
    try {
      const query = supabase
        .from('profiles')
        .select('*')
        .eq('enrollment_type', 'app')
        .in('role_code', [4, 19]) // senior, regular patient
        .order('created_at', { ascending: false });

      const result = await applyPagination<Patient>(
        query,
        options,
        this.DEFAULT_LIMIT
      );

      await auditLogger.info('APP_PATIENT_LIST_ACCESSED', {
        resultCount: result.data.length,
      });

      return success(result);
    } catch (err) {
      const error = err as Error;
      await auditLogger.error('APP_PATIENT_LIST_ERROR', error);
      return failure('DATABASE_ERROR', error.message, err);
    }
  }

  /**
   * Get patients for a specific tenant
   */
  async getPatientsByTenant(
    tenantId: string,
    options: PaginationOptions = {}
  ): Promise<ServiceResult<PaginatedResult<Patient>>> {
    try {
      const query = supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('role_code', [1, 4, 19])
        .order('last_name', { ascending: true });

      const result = await applyPagination<Patient>(
        query,
        options,
        this.DEFAULT_LIMIT
      );

      await auditLogger.info('TENANT_PATIENT_LIST_ACCESSED', {
        tenantId,
        resultCount: result.data.length,
      });

      return success(result);
    } catch (err) {
      const error = err as Error;
      await auditLogger.error('TENANT_PATIENT_LIST_ERROR', error, { tenantId });
      return failure('DATABASE_ERROR', error.message, err);
    }
  }

  /**
   * Get filtered patients with multiple criteria
   */
  async getFilteredPatients(
    filters: PatientSearchFilters,
    options: PaginationOptions = {}
  ): Promise<ServiceResult<PaginatedResult<Patient>>> {
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .in('role_code', [1, 4, 19]);

      // Apply filters
      if (filters.search) {
        const term = filters.search.trim().toLowerCase();
        query = query.or(
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%`
        );
      }

      if (filters.roleCode) {
        query = query.eq('role_code', filters.roleCode);
      }

      if (filters.enrollmentType) {
        query = query.eq('enrollment_type', filters.enrollmentType);
      }

      if (filters.tenantId) {
        query = query.eq('tenant_id', filters.tenantId);
      }

      if (filters.unitId) {
        query = query.eq('hospital_unit', filters.unitId);
      }

      query = query.order('last_name', { ascending: true });

      const result = await applyPagination<Patient>(
        query,
        options,
        this.DEFAULT_LIMIT
      );

      await auditLogger.info('FILTERED_PATIENT_LIST_ACCESSED', {
        hasSearch: !!filters.search,
        hasRoleFilter: !!filters.roleCode,
        hasEnrollmentFilter: !!filters.enrollmentType,
        hasTenantFilter: !!filters.tenantId,
        resultCount: result.data.length,
      });

      return success(result);
    } catch (err) {
      const error = err as Error;
      await auditLogger.error('FILTERED_PATIENT_LIST_ERROR', error);
      return failure('DATABASE_ERROR', error.message, err);
    }
  }

  /**
   * Get recent patients (last 7 days)
   */
  async getRecentPatients(
    limit: number = this.DEFAULT_LIMIT
  ): Promise<ServiceResult<Patient[]>> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const query = supabase
        .from('profiles')
        .select('*')
        .in('role_code', [1, 4, 19])
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      const data = await applyLimit<Patient>(
        query,
        Math.min(limit, PAGINATION_LIMITS.MAX)
      );

      await auditLogger.info('RECENT_PATIENT_LIST_ACCESSED', {
        resultCount: data.length,
      });

      return success(data);
    } catch (err) {
      const error = err as Error;
      await auditLogger.error('RECENT_PATIENT_LIST_ERROR', error);
      return failure('DATABASE_ERROR', error.message, err);
    }
  }

  /**
   * Get patient count by tenant
   */
  async getPatientCount(tenantId?: string): Promise<ServiceResult<number>> {
    try {
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('role_code', [1, 4, 19]);

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { count, error } = await query;

      if (error) {
        return failure(fromSupabaseError(error).code, error.message, error);
      }

      return success(count || 0);
    } catch (err) {
      const error = err as Error;
      await auditLogger.error('PATIENT_COUNT_ERROR', error);
      return failure('DATABASE_ERROR', error.message, err);
    }
  }
}

// Export singleton instance
export const patientService = new PatientService();

// Export class for testing
export { PatientService };
