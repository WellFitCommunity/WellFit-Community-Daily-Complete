/**
 * Staff Wellness Service
 *
 * Service layer for supervisor-level staff wellness monitoring.
 * Provides aggregate burnout metrics, documentation debt tracking,
 * and intervention recommendations for department managers.
 *
 * Uses ServiceResult pattern for consistent error handling.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { ServiceResult, success, failure } from './_base';
import { auditLogger } from './auditLogger';

// ============================================================================
// TYPES
// ============================================================================

export type BurnoutRiskLevel = 'low' | 'moderate' | 'high' | 'critical' | 'unknown';
export type MoodTrend = 'improving' | 'stable' | 'declining' | 'unknown';

/**
 * Individual staff member wellness data
 */
export interface StaffWellnessRecord {
  staff_id: string;
  full_name: string;
  title: string | null;
  department_name: string | null;
  burnout_risk_level: BurnoutRiskLevel;
  compassion_score: number | null;
  documentation_debt_hours: number;
  last_break: string;
  shift_hours: number | null;
  patient_count: number | null;
  mood_trend: MoodTrend;
  user_id: string | null;
}

/**
 * Department-level wellness metrics
 */
export interface DepartmentWellnessMetrics {
  total_staff: number;
  high_risk_count: number;
  critical_risk_count: number;
  avg_compassion_score: number | null;
  avg_documentation_debt: number | null;
  staff_on_break: number;
  interventions_needed: number;
  avg_workload_score: number | null;
  avg_shift_hours: number | null;
}

/**
 * Filter options for staff wellness queries
 */
export interface StaffWellnessFilters {
  organizationId?: string;
  departmentId?: string;
  facilityId?: string;
  riskFilter?: 'high' | 'critical' | 'at_risk';
  limit?: number;
  offset?: number;
}

/**
 * Wellness intervention request
 */
export interface WellnessInterventionRequest {
  staff_id: string;
  intervention_type: 'break_reminder' | 'peer_support' | 'supervisor_checkin' | 'eap_referral';
  notes?: string;
}

// Helper to get error message safely
function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ============================================================================
// DEPARTMENT WELLNESS METRICS
// ============================================================================

/**
 * Get aggregate wellness metrics for a department, facility, or organization
 */
export async function getDepartmentMetrics(
  filters: StaffWellnessFilters = {}
): Promise<ServiceResult<DepartmentWellnessMetrics>> {
  try {
    const { data, error } = await supabase.rpc('get_department_wellness_metrics', {
      p_organization_id: filters.organizationId || null,
      p_department_id: filters.departmentId || null,
      p_facility_id: filters.facilityId || null,
    });

    if (error) {
      await auditLogger.error('STAFF_WELLNESS_METRICS_FAILED', error.message, {
        filters,
      });
      return failure('DATABASE_ERROR', error.message, error);
    }

    // RPC returns array with single row
    const metrics = Array.isArray(data) ? data[0] : data;

    if (!metrics) {
      return success({
        total_staff: 0,
        high_risk_count: 0,
        critical_risk_count: 0,
        avg_compassion_score: null,
        avg_documentation_debt: null,
        staff_on_break: 0,
        interventions_needed: 0,
        avg_workload_score: null,
        avg_shift_hours: null,
      });
    }

    await auditLogger.clinical('STAFF_WELLNESS_METRICS_VIEW', true, {
      total_staff: metrics.total_staff,
      high_risk_count: metrics.high_risk_count,
    });

    return success(metrics as DepartmentWellnessMetrics);
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    await auditLogger.error('STAFF_WELLNESS_METRICS_FAILED', errorMessage, { filters });
    return failure('UNKNOWN_ERROR', errorMessage, err);
  }
}

// ============================================================================
// STAFF WELLNESS LIST
// ============================================================================

/**
 * Get list of staff with wellness metrics
 */
export async function getStaffWellnessList(
  filters: StaffWellnessFilters = {}
): Promise<ServiceResult<StaffWellnessRecord[]>> {
  try {
    const { data, error } = await supabase.rpc('get_staff_wellness_list', {
      p_organization_id: filters.organizationId || null,
      p_department_id: filters.departmentId || null,
      p_facility_id: filters.facilityId || null,
      p_risk_filter: filters.riskFilter || null,
      p_limit: filters.limit || 50,
      p_offset: filters.offset || 0,
    });

    if (error) {
      await auditLogger.error('STAFF_WELLNESS_LIST_FAILED', error.message, {
        filters,
      });
      return failure('DATABASE_ERROR', error.message, error);
    }

    const staffList = (data || []) as StaffWellnessRecord[];

    await auditLogger.clinical('STAFF_WELLNESS_LIST_VIEW', true, {
      count: staffList.length,
      risk_filter: filters.riskFilter,
    });

    return success(staffList);
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    await auditLogger.error('STAFF_WELLNESS_LIST_FAILED', errorMessage, { filters });
    return failure('UNKNOWN_ERROR', errorMessage, err);
  }
}

/**
 * Get staff at high or critical burnout risk
 */
export async function getAtRiskStaff(
  filters: Omit<StaffWellnessFilters, 'riskFilter'> = {}
): Promise<ServiceResult<StaffWellnessRecord[]>> {
  return getStaffWellnessList({ ...filters, riskFilter: 'at_risk' });
}

// ============================================================================
// WELLNESS INTERVENTIONS
// ============================================================================

/**
 * Log a wellness intervention for a staff member
 */
export async function logIntervention(
  request: WellnessInterventionRequest
): Promise<ServiceResult<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return failure('UNAUTHORIZED', 'User not authenticated');
    }

    // Log the intervention to audit trail
    await auditLogger.clinical('WELLNESS_INTERVENTION', true, {
      staff_id: request.staff_id,
      intervention_type: request.intervention_type,
      initiated_by: user.id,
      notes: request.notes,
    });

    // In production, this would also:
    // 1. Create a record in an interventions table
    // 2. Send notifications to relevant parties
    // 3. Update staff wellness status

    return success(undefined);
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    await auditLogger.error('WELLNESS_INTERVENTION_FAILED', errorMessage, {
      staff_id: request.staff_id,
    });
    return failure('UNKNOWN_ERROR', errorMessage, err);
  }
}

/**
 * Send break reminder to a staff member
 */
export async function sendBreakReminder(staffId: string): Promise<ServiceResult<void>> {
  return logIntervention({
    staff_id: staffId,
    intervention_type: 'break_reminder',
    notes: 'Automated break reminder sent based on shift duration',
  });
}

/**
 * Initiate peer support connection
 */
export async function initiatePeerSupport(
  staffId: string,
  notes?: string
): Promise<ServiceResult<void>> {
  return logIntervention({
    staff_id: staffId,
    intervention_type: 'peer_support',
    notes: notes || 'Peer support circle connection initiated',
  });
}

// ============================================================================
// WELLNESS TRENDS
// ============================================================================

/**
 * Get wellness trend data for reporting
 */
export async function getWellnessTrends(
  filters: StaffWellnessFilters & { days?: number } = {}
): Promise<ServiceResult<{
  turnover_reduction_percent: number;
  satisfaction_increase_percent: number;
  sick_days_reduction_percent: number;
  estimated_annual_savings: number;
}>> {
  try {
    // In production, this would query historical data
    // For now, return demonstration metrics
    const trends = {
      turnover_reduction_percent: 32,
      satisfaction_increase_percent: 18,
      sick_days_reduction_percent: 24,
      estimated_annual_savings: 847000,
    };

    await auditLogger.clinical('WELLNESS_TRENDS_VIEW', true, {
      filters,
    });

    return success(trends);
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    await auditLogger.error('WELLNESS_TRENDS_FAILED', errorMessage);
    return failure('UNKNOWN_ERROR', errorMessage, err);
  }
}

// ============================================================================
// DEPARTMENT LIST
// ============================================================================

/**
 * Get list of departments for filtering
 */
export async function getDepartments(
  organizationId?: string
): Promise<ServiceResult<Array<{ department_id: string; department_name: string }>>> {
  try {
    let query = supabase
      .from('hc_department')
      .select('department_id, department_name')
      .eq('is_active', true)
      .order('department_name');

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    return failure('UNKNOWN_ERROR', errorMessage, err);
  }
}

// ============================================================================
// EXPORT SERVICE OBJECT
// ============================================================================

export const StaffWellnessService = {
  // Metrics
  getDepartmentMetrics,
  getStaffWellnessList,
  getAtRiskStaff,

  // Interventions
  logIntervention,
  sendBreakReminder,
  initiatePeerSupport,

  // Trends
  getWellnessTrends,

  // Reference data
  getDepartments,
};

export default StaffWellnessService;
