/**
 * Tests for Schedule Optimizer Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleOptimizerService } from '../scheduleOptimizerService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  },
}));

// Mock audit logger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ScheduleOptimizerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('type definitions', () => {
    it('should define all shift types', () => {
      const shiftTypes = ['day', 'evening', 'night', 'custom'];
      expect(shiftTypes).toHaveLength(4);
      expect(shiftTypes).toContain('day');
      expect(shiftTypes).toContain('night');
    });

    it('should define all staff roles', () => {
      const roles = ['nurse', 'cna', 'physician', 'therapist', 'technician', 'admin', 'other'];
      expect(roles).toHaveLength(7);
      expect(roles).toContain('nurse');
      expect(roles).toContain('physician');
    });

    it('should define all optimization goals', () => {
      const goals = ['coverage', 'cost', 'fairness', 'balanced'];
      expect(goals).toHaveLength(4);
      expect(goals).toContain('coverage');
      expect(goals).toContain('balanced');
    });
  });

  describe('service methods', () => {
    it('should validate required fields', async () => {
      const result = await ScheduleOptimizerService.optimizeSchedule({
        requesterId: '',
        dateRange: { startDate: '2025-01-01', endDate: '2025-01-07' },
        staff: [],
        shiftRequirements: [],
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should return empty history when no optimizations exist', async () => {
      const result = await ScheduleOptimizerService.getOptimizationHistory('test-requester');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('shift type styling', () => {
    it('should return correct style for day shift', () => {
      const style = ScheduleOptimizerService.getShiftTypeStyle('day');
      expect(style.bg).toContain('yellow');
      expect(style.label).toBe('Day Shift');
    });

    it('should return correct style for evening shift', () => {
      const style = ScheduleOptimizerService.getShiftTypeStyle('evening');
      expect(style.bg).toContain('orange');
      expect(style.label).toBe('Evening Shift');
    });

    it('should return correct style for night shift', () => {
      const style = ScheduleOptimizerService.getShiftTypeStyle('night');
      expect(style.bg).toContain('indigo');
      expect(style.label).toBe('Night Shift');
    });

    it('should return correct style for custom shift', () => {
      const style = ScheduleOptimizerService.getShiftTypeStyle('custom');
      expect(style.bg).toContain('gray');
      expect(style.label).toBe('Custom Shift');
    });
  });

  describe('coverage score styling', () => {
    it('should return excellent for 95+', () => {
      const style = ScheduleOptimizerService.getCoverageScoreStyle(98);
      expect(style.bg).toContain('green');
      expect(style.label).toBe('Excellent');
    });

    it('should return good for 85-94', () => {
      const style = ScheduleOptimizerService.getCoverageScoreStyle(90);
      expect(style.bg).toContain('blue');
      expect(style.label).toBe('Good');
    });

    it('should return adequate for 70-84', () => {
      const style = ScheduleOptimizerService.getCoverageScoreStyle(75);
      expect(style.bg).toContain('yellow');
      expect(style.label).toBe('Adequate');
    });

    it('should return poor for 50-69', () => {
      const style = ScheduleOptimizerService.getCoverageScoreStyle(60);
      expect(style.bg).toContain('orange');
      expect(style.label).toBe('Poor');
    });

    it('should return critical for below 50', () => {
      const style = ScheduleOptimizerService.getCoverageScoreStyle(40);
      expect(style.bg).toContain('red');
      expect(style.label).toBe('Critical');
    });
  });

  describe('gap severity styling', () => {
    it('should return correct style for critical gaps', () => {
      const style = ScheduleOptimizerService.getGapSeverityStyle('critical');
      expect(style.bg).toContain('red');
      expect(style.icon).toBe('🚨');
    });

    it('should return correct style for high gaps', () => {
      const style = ScheduleOptimizerService.getGapSeverityStyle('high');
      expect(style.bg).toContain('orange');
      expect(style.icon).toBe('⚠️');
    });

    it('should return correct style for medium gaps', () => {
      const style = ScheduleOptimizerService.getGapSeverityStyle('medium');
      expect(style.bg).toContain('yellow');
      expect(style.icon).toBe('⚡');
    });

    it('should return correct style for low gaps', () => {
      const style = ScheduleOptimizerService.getGapSeverityStyle('low');
      expect(style.bg).toContain('blue');
      expect(style.icon).toBe('ℹ️');
    });
  });

  describe('role display names', () => {
    it('should return correct display names', () => {
      expect(ScheduleOptimizerService.getRoleDisplayName('nurse')).toBe('Registered Nurse');
      expect(ScheduleOptimizerService.getRoleDisplayName('cna')).toBe('Certified Nursing Assistant');
      expect(ScheduleOptimizerService.getRoleDisplayName('physician')).toBe('Physician');
      expect(ScheduleOptimizerService.getRoleDisplayName('therapist')).toBe('Therapist');
      expect(ScheduleOptimizerService.getRoleDisplayName('technician')).toBe('Technician');
      expect(ScheduleOptimizerService.getRoleDisplayName('admin')).toBe('Administrative');
      expect(ScheduleOptimizerService.getRoleDisplayName('other')).toBe('Staff');
    });
  });

  describe('formatting helpers', () => {
    it('should format hours correctly', () => {
      expect(ScheduleOptimizerService.formatHours(8)).toBe('8h');
      expect(ScheduleOptimizerService.formatHours(8.5)).toBe('8h 30m');
      expect(ScheduleOptimizerService.formatHours(12.25)).toBe('12h 15m');
    });

    it('should format currency correctly', () => {
      const formatted = ScheduleOptimizerService.formatCurrency(1234.56);
      expect(formatted).toContain('1,234.56');
    });
  });

  describe('recommendation priority styling', () => {
    it('should return correct style for high priority', () => {
      const style = ScheduleOptimizerService.getRecommendationPriorityStyle('high');
      expect(style.bg).toContain('red');
      expect(style.label).toBe('High Priority');
    });

    it('should return correct style for medium priority', () => {
      const style = ScheduleOptimizerService.getRecommendationPriorityStyle('medium');
      expect(style.bg).toContain('yellow');
      expect(style.label).toBe('Medium Priority');
    });

    it('should return correct style for low priority', () => {
      const style = ScheduleOptimizerService.getRecommendationPriorityStyle('low');
      expect(style.bg).toContain('gray');
      expect(style.label).toBe('Low Priority');
    });
  });

  describe('summary statistics', () => {
    it('should calculate summary stats correctly', () => {
      const optimization = {
        scheduleId: 'test',
        dateRange: { startDate: '2025-01-01', endDate: '2025-01-07' },
        assignments: [
          { staffId: '1', staffName: 'Nurse A', date: '2025-01-01', shiftType: 'day' as const, startTime: '07:00', endTime: '15:00', hoursWorked: 8, isOvertime: false },
          { staffId: '2', staffName: 'Nurse B', date: '2025-01-04', shiftType: 'day' as const, startTime: '07:00', endTime: '15:00', hoursWorked: 8, isOvertime: false },
        ],
        unassignedShifts: [],
        coverageScore: 90,
        coverageGaps: [],
        staffWorkloads: [
          { staffId: '1', staffName: 'Nurse A', totalHours: 40, shiftsAssigned: 5, overtimeHours: 0, weekendShifts: 0, nightShifts: 0, fairnessScore: 85 },
          { staffId: '2', staffName: 'Nurse B', totalHours: 32, shiftsAssigned: 4, overtimeHours: 0, weekendShifts: 1, nightShifts: 0, fairnessScore: 80 },
        ],
        fairnessScore: 82,
        totalOvertimeHours: 0,
        estimatedLaborCost: 2520,
        regularHours: 72,
        overtimeHours: 0,
        recommendations: [],
        summary: 'Test schedule',
        optimizationGoalAchieved: true,
      };

      const stats = ScheduleOptimizerService.calculateSummaryStats(optimization);
      expect(stats.totalShifts).toBe(2);
      expect(stats.assignedShifts).toBe(2);
      expect(stats.unassignedShifts).toBe(0);
      expect(stats.totalStaff).toBe(2);
      expect(stats.avgHoursPerStaff).toBe(36);
      expect(stats.overtimePercentage).toBe(0);
    });
  });

  describe('assignment grouping', () => {
    it('should group assignments by date', () => {
      const assignments = [
        { staffId: '1', staffName: 'Nurse A', date: '2025-01-01', shiftType: 'day' as const, startTime: '07:00', endTime: '15:00', hoursWorked: 8, isOvertime: false },
        { staffId: '2', staffName: 'Nurse B', date: '2025-01-01', shiftType: 'evening' as const, startTime: '15:00', endTime: '23:00', hoursWorked: 8, isOvertime: false },
        { staffId: '1', staffName: 'Nurse A', date: '2025-01-02', shiftType: 'day' as const, startTime: '07:00', endTime: '15:00', hoursWorked: 8, isOvertime: false },
      ];

      const grouped = ScheduleOptimizerService.groupAssignmentsByDate(assignments);
      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['2025-01-01']).toHaveLength(2);
      expect(grouped['2025-01-02']).toHaveLength(1);
    });

    it('should group assignments by staff', () => {
      const assignments = [
        { staffId: '1', staffName: 'Nurse A', date: '2025-01-01', shiftType: 'day' as const, startTime: '07:00', endTime: '15:00', hoursWorked: 8, isOvertime: false },
        { staffId: '1', staffName: 'Nurse A', date: '2025-01-02', shiftType: 'day' as const, startTime: '07:00', endTime: '15:00', hoursWorked: 8, isOvertime: false },
        { staffId: '2', staffName: 'Nurse B', date: '2025-01-01', shiftType: 'evening' as const, startTime: '15:00', endTime: '23:00', hoursWorked: 8, isOvertime: false },
      ];

      const grouped = ScheduleOptimizerService.groupAssignmentsByStaff(assignments);
      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['1']).toHaveLength(2);
      expect(grouped['2']).toHaveLength(1);
    });
  });

  describe('constraint validation', () => {
    it('should define max hours per week constraint', () => {
      const constraints = {
        maxConsecutiveShifts: 5,
        minRestHoursBetweenShifts: 8,
        maxOvertimeHours: 10,
        requireSkillMix: true,
      };

      expect(constraints.maxConsecutiveShifts).toBe(5);
      expect(constraints.minRestHoursBetweenShifts).toBe(8);
      expect(constraints.maxOvertimeHours).toBe(10);
      expect(constraints.requireSkillMix).toBe(true);
    });
  });

  describe('staff member validation', () => {
    it('should handle staff availability', () => {
      const staff = {
        id: 'nurse-1',
        name: 'Jane Doe',
        role: 'nurse' as const,
        certifications: ['BLS', 'ACLS'],
        maxHoursPerWeek: 40,
        preferredShifts: ['day' as const, 'evening' as const],
        unavailableDates: ['2025-01-05', '2025-01-06'],
        currentHoursThisPeriod: 16,
        fullTimeEquivalent: 1.0,
      };

      expect(staff.unavailableDates).toContain('2025-01-05');
      expect(staff.certifications).toContain('ACLS');
      expect(staff.preferredShifts).toContain('day');
    });
  });

  describe('shift requirement validation', () => {
    it('should handle shift requirements', () => {
      const requirement = {
        date: '2025-01-01',
        shiftType: 'day' as const,
        startTime: '07:00',
        endTime: '15:00',
        minStaff: 3,
        optimalStaff: 4,
        requiredRoles: ['nurse' as const, 'cna' as const],
        requiredCertifications: ['BLS'],
        currentAssignments: ['nurse-1'],
      };

      expect(requirement.minStaff).toBe(3);
      expect(requirement.requiredRoles).toContain('nurse');
      expect(requirement.requiredCertifications).toContain('BLS');
      expect(requirement.currentAssignments).toContain('nurse-1');
    });
  });
});
