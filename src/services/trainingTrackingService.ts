/**
 * Workforce Training Tracking Service
 *
 * Purpose: Track HIPAA workforce security awareness training
 * Regulation: 45 CFR 164.308(a)(5)
 * Features: Course management, completion tracking, compliance dashboards
 *
 * @module services/trainingTrackingService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type TrainingCategory =
  | 'hipaa_security'
  | 'hipaa_privacy'
  | 'cybersecurity'
  | 'compliance'
  | 'clinical_safety'
  | 'emergency_procedures'
  | 'other';

export interface TrainingCourse {
  id: string;
  tenant_id: string;
  course_name: string;
  course_code: string;
  description: string | null;
  category: TrainingCategory;
  required_for_roles: string[];
  recurrence_months: number;
  passing_score: number;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainingCompletion {
  id: string;
  tenant_id: string;
  employee_id: string;
  course_id: string;
  completed_at: string;
  score: number | null;
  passed: boolean;
  certificate_url: string | null;
  expires_at: string | null;
  verified_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface EmployeeTrainingStatus {
  employee_id: string;
  employee_name: string | null;
  course_id: string;
  course_name: string;
  category: TrainingCategory;
  last_completed: string | null;
  expires_at: string | null;
  is_overdue: boolean;
  is_expiring_soon: boolean;
}

export interface TenantComplianceRate {
  total_employees: number;
  compliant_employees: number;
  compliance_rate: number;
  overdue_count: number;
  expiring_soon_count: number;
}

// =============================================================================
// SERVICE
// =============================================================================

async function getTenantId(): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .single();
  return data?.tenant_id ?? null;
}

/**
 * List all active training courses
 */
export async function listCourses(): Promise<ServiceResult<TrainingCourse[]>> {
  try {
    const { data, error } = await supabase
      .from('training_courses')
      .select('id, tenant_id, course_name, course_code, description, category, required_for_roles, recurrence_months, passing_score, duration_minutes, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('course_name', { ascending: true });

    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success((data ?? []) as TrainingCourse[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('TRAINING_COURSES_FETCH_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to list training courses');
  }
}

/**
 * Record a training completion
 */
export async function recordCompletion(
  employeeId: string,
  courseId: string,
  score?: number,
  notes?: string
): Promise<ServiceResult<TrainingCompletion>> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return failure('UNAUTHORIZED', 'No tenant context');

    const user = (await supabase.auth.getUser()).data.user;

    // Get the course to calculate expiration
    const { data: course, error: courseError } = await supabase
      .from('training_courses')
      .select('recurrence_months, passing_score')
      .eq('id', courseId)
      .single();

    if (courseError) return failure('NOT_FOUND', 'Course not found', courseError);

    const passed = score === undefined || score >= (course.passing_score ?? 80);
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + (course.recurrence_months ?? 12));

    const { data, error } = await supabase
      .from('training_completions')
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        course_id: courseId,
        completed_at: new Date().toISOString(),
        score: score ?? null,
        passed,
        expires_at: passed ? expiresAt.toISOString() : null,
        verified_by: user?.id,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.info('TRAINING_COMPLETION_RECORDED', {
      employeeId,
      courseId,
      passed,
      score,
    });

    return success(data as TrainingCompletion);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('TRAINING_COMPLETION_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to record training completion');
  }
}

/**
 * Get training status for all employees in the tenant
 */
export async function getTrainingStatus(): Promise<ServiceResult<EmployeeTrainingStatus[]>> {
  try {
    const { data: courses, error: coursesError } = await supabase
      .from('training_courses')
      .select('id, course_name, category, recurrence_months')
      .eq('is_active', true);

    if (coursesError) return failure('DATABASE_ERROR', coursesError.message, coursesError);

    const { data: completions, error: compError } = await supabase
      .from('training_completions')
      .select('employee_id, course_id, completed_at, expires_at, passed')
      .eq('passed', true)
      .order('completed_at', { ascending: false });

    if (compError) return failure('DATABASE_ERROR', compError.message, compError);

    const { data: employees, error: empError } = await supabase
      .from('employee_profiles')
      .select('user_id, first_name, last_name');

    if (empError) return failure('DATABASE_ERROR', empError.message, empError);

    const now = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);

    const statuses: EmployeeTrainingStatus[] = [];

    for (const emp of (employees ?? [])) {
      for (const course of (courses ?? [])) {
        const latestCompletion = (completions ?? []).find(
          (c: Record<string, unknown>) =>
            c.employee_id === emp.user_id && c.course_id === course.id
        );

        const expiresAt = latestCompletion?.expires_at
          ? new Date(latestCompletion.expires_at as string)
          : null;

        statuses.push({
          employee_id: emp.user_id,
          employee_name: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() || null,
          course_id: course.id,
          course_name: course.course_name,
          category: course.category as TrainingCategory,
          last_completed: (latestCompletion?.completed_at as string) ?? null,
          expires_at: (latestCompletion?.expires_at as string) ?? null,
          is_overdue: !latestCompletion || (expiresAt !== null && expiresAt < now),
          is_expiring_soon: expiresAt !== null && expiresAt > now && expiresAt <= soon,
        });
      }
    }

    return success(statuses);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('TRAINING_STATUS_FETCH_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to get training status');
  }
}

/**
 * Get overdue training assignments
 */
export async function getOverdueTraining(): Promise<ServiceResult<EmployeeTrainingStatus[]>> {
  const statusResult = await getTrainingStatus();
  if (!statusResult.success) return statusResult;

  return success(statusResult.data.filter(s => s.is_overdue));
}

/**
 * Get tenant-wide compliance rate
 */
export async function getTenantComplianceRate(): Promise<ServiceResult<TenantComplianceRate>> {
  const statusResult = await getTrainingStatus();
  if (!statusResult.success) {
    return failure(statusResult.error.code, statusResult.error.message);
  }

  const statuses = statusResult.data;
  const employeeIds = [...new Set(statuses.map(s => s.employee_id))];
  const totalEmployees = employeeIds.length;

  // An employee is compliant if they have no overdue courses
  const compliantEmployees = employeeIds.filter(empId => {
    const empStatuses = statuses.filter(s => s.employee_id === empId);
    return empStatuses.every(s => !s.is_overdue);
  }).length;

  return success({
    total_employees: totalEmployees,
    compliant_employees: compliantEmployees,
    compliance_rate: totalEmployees > 0 ? (compliantEmployees / totalEmployees) * 100 : 0,
    overdue_count: statuses.filter(s => s.is_overdue).length,
    expiring_soon_count: statuses.filter(s => s.is_expiring_soon).length,
  });
}

export const trainingTrackingService = {
  listCourses,
  recordCompletion,
  getTrainingStatus,
  getOverdueTraining,
  getTenantComplianceRate,
};
