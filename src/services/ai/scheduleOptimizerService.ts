/**
 * Schedule Optimizer Service
 *
 * Frontend service for AI-powered staff scheduling optimization.
 * Optimizes shift assignments based on:
 * - Staffing requirements and patient census
 * - Staff availability and preferences
 * - Certifications and skill requirements
 * - Fairness and workload distribution
 * - Overtime and cost management
 *
 * Uses Claude Haiku 4.5 for fast, cost-effective optimization.
 *
 * @module scheduleOptimizerService
 * @skill #35 - Schedule Optimizer
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base/ServiceResult';
import { auditLogger } from '../auditLogger';

// ============================================================================
// Types
// ============================================================================

export type ShiftType = 'day' | 'evening' | 'night' | 'custom';
export type StaffRole = 'nurse' | 'cna' | 'physician' | 'therapist' | 'technician' | 'admin' | 'other';
export type OptimizationGoal = 'coverage' | 'cost' | 'fairness' | 'balanced';

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  certifications?: string[];
  maxHoursPerWeek?: number;
  preferredShifts?: ShiftType[];
  unavailableDates?: string[];
  currentHoursThisPeriod?: number;
  seniorityLevel?: number;
  fullTimeEquivalent?: number;
}

export interface ShiftRequirement {
  date: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  minStaff: number;
  optimalStaff: number;
  requiredRoles: StaffRole[];
  requiredCertifications?: string[];
  currentAssignments?: string[];
}

export interface PatientCensus {
  date: string;
  expectedPatients: number;
  acuityLevel: 'low' | 'medium' | 'high' | 'critical';
  specialNeeds?: string[];
}

export interface ScheduleRequest {
  requesterId: string;
  tenantId?: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  staff: StaffMember[];
  shiftRequirements: ShiftRequirement[];
  patientCensus?: PatientCensus[];
  optimizationGoal?: OptimizationGoal;
  constraints?: {
    maxConsecutiveShifts?: number;
    minRestHoursBetweenShifts?: number;
    maxOvertimeHours?: number;
    requireSkillMix?: boolean;
  };
}

export interface ShiftAssignment {
  staffId: string;
  staffName: string;
  date: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  hoursWorked: number;
  isOvertime: boolean;
  notes?: string;
}

export interface CoverageGap {
  date: string;
  shiftType: ShiftType;
  shortfall: number;
  requiredRole: StaffRole;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestions: string[];
}

export interface StaffWorkload {
  staffId: string;
  staffName: string;
  totalHours: number;
  shiftsAssigned: number;
  overtimeHours: number;
  weekendShifts: number;
  nightShifts: number;
  fairnessScore: number;
}

export interface ScheduleRecommendation {
  type: 'coverage' | 'fairness' | 'cost' | 'compliance';
  priority: 'low' | 'medium' | 'high';
  recommendation: string;
  impact: string;
}

export interface ScheduleOptimization {
  scheduleId: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  assignments: ShiftAssignment[];
  unassignedShifts: ShiftRequirement[];
  coverageScore: number;
  coverageGaps: CoverageGap[];
  staffWorkloads: StaffWorkload[];
  fairnessScore: number;
  totalOvertimeHours: number;
  estimatedLaborCost: number;
  regularHours: number;
  overtimeHours: number;
  recommendations: ScheduleRecommendation[];
  summary: string;
  optimizationGoalAchieved: boolean;
}

export interface ScheduleResponse {
  optimization: ScheduleOptimization;
  metadata: {
    generated_at: string;
    response_time_ms: number;
    model: string;
  };
}

// ============================================================================
// Service
// ============================================================================

export const ScheduleOptimizerService = {
  /**
   * Optimize a schedule
   */
  async optimizeSchedule(
    request: ScheduleRequest
  ): Promise<ServiceResult<ScheduleResponse>> {
    try {
      if (!request.requesterId || !request.dateRange || !request.staff || !request.shiftRequirements) {
        return failure('VALIDATION_ERROR', 'Requester ID, date range, staff, and shift requirements are required');
      }

      await auditLogger.info('SCHEDULE_OPTIMIZATION_STARTED', {
        requesterId: request.requesterId.substring(0, 8) + '...',
        dateRange: `${request.dateRange.startDate} to ${request.dateRange.endDate}`,
        staffCount: request.staff.length,
        shiftsToOptimize: request.shiftRequirements.length,
        category: 'ADMIN',
      });

      const { data, error } = await supabase.functions.invoke('ai-schedule-optimizer', {
        body: request,
      });

      if (error) {
        await auditLogger.error('SCHEDULE_OPTIMIZATION_FAILED', error as Error, {
          requesterId: request.requesterId.substring(0, 8) + '...',
          category: 'ADMIN',
        });
        return failure('AI_SERVICE_ERROR', error.message || 'Schedule optimization failed');
      }

      await auditLogger.info('SCHEDULE_OPTIMIZATION_COMPLETED', {
        requesterId: request.requesterId.substring(0, 8) + '...',
        coverageScore: data.optimization?.coverageScore,
        fairnessScore: data.optimization?.fairnessScore,
        gapsIdentified: data.optimization?.coverageGaps?.length || 0,
        category: 'ADMIN',
      });

      return success(data as ScheduleResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('SCHEDULE_OPTIMIZATION_ERROR', error, {
        category: 'ADMIN',
      });
      return failure('UNKNOWN_ERROR', error.message);
    }
  },

  /**
   * Get schedule optimization history
   */
  async getOptimizationHistory(
    requesterId: string,
    days: number = 30
  ): Promise<ServiceResult<Array<{
    schedule_id: string;
    date_range_start: string;
    date_range_end: string;
    coverage_score: number;
    fairness_score: number;
    created_at: string;
  }>>> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('ai_schedule_optimizations')
        .select('schedule_id, date_range_start, date_range_end, coverage_score, fairness_score, created_at')
        .eq('requester_id', requesterId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      return success(data || []);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('UNKNOWN_ERROR', error.message);
    }
  },

  /**
   * Get styling for shift type
   */
  getShiftTypeStyle(shiftType: ShiftType): {
    bg: string;
    text: string;
    label: string;
  } {
    switch (shiftType) {
      case 'day':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Day Shift' };
      case 'evening':
        return { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Evening Shift' };
      case 'night':
        return { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Night Shift' };
      case 'custom':
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Custom Shift' };
    }
  },

  /**
   * Get styling for coverage score
   */
  getCoverageScoreStyle(score: number): {
    bg: string;
    text: string;
    label: string;
  } {
    if (score >= 95) {
      return { bg: 'bg-green-100', text: 'text-green-800', label: 'Excellent' };
    } else if (score >= 85) {
      return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Good' };
    } else if (score >= 70) {
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Adequate' };
    } else if (score >= 50) {
      return { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Poor' };
    } else {
      return { bg: 'bg-red-100', text: 'text-red-800', label: 'Critical' };
    }
  },

  /**
   * Get styling for gap severity
   */
  getGapSeverityStyle(severity: CoverageGap['severity']): {
    bg: string;
    text: string;
    icon: string;
  } {
    switch (severity) {
      case 'critical':
        return { bg: 'bg-red-100', text: 'text-red-800', icon: '🚨' };
      case 'high':
        return { bg: 'bg-orange-100', text: 'text-orange-800', icon: '⚠️' };
      case 'medium':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '⚡' };
      case 'low':
      default:
        return { bg: 'bg-blue-100', text: 'text-blue-800', icon: 'ℹ️' };
    }
  },

  /**
   * Get role display name
   */
  getRoleDisplayName(role: StaffRole): string {
    switch (role) {
      case 'nurse':
        return 'Registered Nurse';
      case 'cna':
        return 'Certified Nursing Assistant';
      case 'physician':
        return 'Physician';
      case 'therapist':
        return 'Therapist';
      case 'technician':
        return 'Technician';
      case 'admin':
        return 'Administrative';
      case 'other':
      default:
        return 'Staff';
    }
  },

  /**
   * Format hours for display
   */
  formatHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  },

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  },

  /**
   * Get recommendation priority style
   */
  getRecommendationPriorityStyle(priority: ScheduleRecommendation['priority']): {
    bg: string;
    text: string;
    label: string;
  } {
    switch (priority) {
      case 'high':
        return { bg: 'bg-red-500', text: 'text-white', label: 'High Priority' };
      case 'medium':
        return { bg: 'bg-yellow-500', text: 'text-black', label: 'Medium Priority' };
      case 'low':
      default:
        return { bg: 'bg-gray-400', text: 'text-white', label: 'Low Priority' };
    }
  },

  /**
   * Calculate summary statistics
   */
  calculateSummaryStats(optimization: ScheduleOptimization): {
    totalShifts: number;
    assignedShifts: number;
    unassignedShifts: number;
    totalStaff: number;
    avgHoursPerStaff: number;
    overtimePercentage: number;
    weekendCoverage: number;
  } {
    const totalShifts = optimization.assignments.length + optimization.unassignedShifts.length;
    const assignedShifts = optimization.assignments.length;
    const unassignedShifts = optimization.unassignedShifts.length;
    const totalStaff = optimization.staffWorkloads.length;
    const totalHours = optimization.regularHours + optimization.overtimeHours;
    const avgHoursPerStaff = totalStaff > 0 ? totalHours / totalStaff : 0;
    const overtimePercentage = totalHours > 0 ? (optimization.overtimeHours / totalHours) * 100 : 0;

    // Calculate weekend coverage
    const weekendAssignments = optimization.assignments.filter(a => {
      const day = new Date(a.date).getDay();
      return day === 0 || day === 6;
    });
    const weekendCoverage = totalShifts > 0 ? (weekendAssignments.length / totalShifts) * 100 : 0;

    return {
      totalShifts,
      assignedShifts,
      unassignedShifts,
      totalStaff,
      avgHoursPerStaff: Math.round(avgHoursPerStaff * 10) / 10,
      overtimePercentage: Math.round(overtimePercentage),
      weekendCoverage: Math.round(weekendCoverage),
    };
  },

  /**
   * Group assignments by date for calendar view
   */
  groupAssignmentsByDate(assignments: ShiftAssignment[]): Record<string, ShiftAssignment[]> {
    return assignments.reduce((groups, assignment) => {
      const date = assignment.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(assignment);
      return groups;
    }, {} as Record<string, ShiftAssignment[]>);
  },

  /**
   * Group assignments by staff for staff view
   */
  groupAssignmentsByStaff(assignments: ShiftAssignment[]): Record<string, ShiftAssignment[]> {
    return assignments.reduce((groups, assignment) => {
      const staffId = assignment.staffId;
      if (!groups[staffId]) {
        groups[staffId] = [];
      }
      groups[staffId].push(assignment);
      return groups;
    }, {} as Record<string, ShiftAssignment[]>);
  },
};

export default ScheduleOptimizerService;
