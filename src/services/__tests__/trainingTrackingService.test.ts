/**
 * Training Tracking Service Tests
 *
 * Tests for HIPAA workforce training management (45 CFR 164.308(a)(5)):
 * - listCourses returns active courses
 * - recordCompletion calculates expiration from recurrence months
 * - getOverdueTraining filters overdue items
 * - getTenantComplianceRate calculates percentage from employee data
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listCourses,
  recordCompletion,
  getOverdueTraining,
  getTenantComplianceRate,
} from '../trainingTrackingService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

vi.mock('../../lib/supabaseClient', () => {
  const mockFrom = vi.fn();
  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-user-1' } },
        }),
      },
    },
  };
});

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    security: vi.fn().mockResolvedValue(undefined),
    phi: vi.fn().mockResolvedValue(undefined),
    clinical: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  auth: { getUser: ReturnType<typeof vi.fn> };
};

function createChainableMock(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

describe('trainingTrackingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listCourses', () => {
    it('returns active courses ordered by name', async () => {
      const mockCourses = [
        { id: 'c-1', course_name: 'Cybersecurity Basics', category: 'cybersecurity', is_active: true },
        { id: 'c-2', course_name: 'HIPAA Privacy', category: 'hipaa_privacy', is_active: true },
      ];

      const chain = createChainableMock({ data: mockCourses, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await listCourses();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].course_name).toBe('Cybersecurity Basics');
        expect(result.data[1].course_name).toBe('HIPAA Privacy');
      }
      expect(mockSupabase.from).toHaveBeenCalledWith('training_courses');
      expect(chain.eq).toHaveBeenCalledWith('is_active', true);
      expect(chain.order).toHaveBeenCalledWith('course_name', { ascending: true });
    });

    it('returns empty array when no courses exist', async () => {
      const chain = createChainableMock({ data: [], error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await listCourses();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('returns failure on database error', async () => {
      const chain = createChainableMock({
        data: null,
        error: { message: 'Table not found' },
      });
      mockSupabase.from.mockReturnValue(chain);

      const result = await listCourses();

      expect(result.success).toBe(false);
    });
  });

  describe('recordCompletion', () => {
    it('calculates expiration from course recurrence months', async () => {
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const courseChain = createChainableMock({
        data: { recurrence_months: 6, passing_score: 80 },
        error: null,
      });

      const mockCompletion = {
        id: 'comp-1',
        employee_id: 'emp-1',
        course_id: 'c-1',
        score: 95,
        passed: true,
        expires_at: '2026-08-10T00:00:00.000Z',
      };
      const insertChain = createChainableMock({ data: mockCompletion, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return profileChain; // profiles
        if (callCount === 2) return courseChain; // training_courses
        return insertChain; // training_completions
      });

      const result = await recordCompletion('emp-1', 'c-1', 95);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.passed).toBe(true);
        expect(result.data.score).toBe(95);
        expect(result.data.expires_at).toBeTruthy();
      }
      expect(auditLogger.info).toHaveBeenCalledWith(
        'TRAINING_COMPLETION_RECORDED',
        expect.objectContaining({
          employeeId: 'emp-1',
          courseId: 'c-1',
          passed: true,
          score: 95,
        })
      );
    });

    it('marks as failed when score is below passing threshold', async () => {
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const courseChain = createChainableMock({
        data: { recurrence_months: 12, passing_score: 80 },
        error: null,
      });

      const mockCompletion = {
        id: 'comp-2',
        employee_id: 'emp-1',
        course_id: 'c-1',
        score: 65,
        passed: false,
        expires_at: null,
      };
      const insertChain = createChainableMock({ data: mockCompletion, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return profileChain;
        if (callCount === 2) return courseChain;
        return insertChain;
      });

      const result = await recordCompletion('emp-1', 'c-1', 65);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.passed).toBe(false);
        expect(result.data.expires_at).toBeNull();
      }
    });

    it('returns failure when course not found', async () => {
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const courseChain = createChainableMock({
        data: null,
        error: { message: 'Course not found' },
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : courseChain;
      });

      const result = await recordCompletion('emp-1', 'nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('getOverdueTraining', () => {
    it('returns only overdue training items', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);

      const mockCourses = [
        { id: 'c-1', course_name: 'HIPAA Security', category: 'hipaa_security', recurrence_months: 12 },
      ];
      const mockCompletions = [
        {
          employee_id: 'emp-1',
          course_id: 'c-1',
          completed_at: pastDate.toISOString(),
          expires_at: pastDate.toISOString(), // expired
          passed: true,
        },
      ];
      const mockEmployees = [
        { user_id: 'emp-1', first_name: 'John', last_name: 'Doe' },
      ];

      const coursesChain = createChainableMock({ data: mockCourses, error: null });
      const completionsChain = createChainableMock({ data: mockCompletions, error: null });
      const employeesChain = createChainableMock({ data: mockEmployees, error: null });
      // Courses: terminal is .eq(), completions: terminal is .order(), employees: terminal is .select()
      coursesChain.eq.mockResolvedValue({ data: mockCourses, error: null });
      completionsChain.order.mockResolvedValue({ data: mockCompletions, error: null });
      employeesChain.select.mockResolvedValue({ data: mockEmployees, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return coursesChain; // training_courses
        if (callCount === 2) return completionsChain; // training_completions
        return employeesChain; // employee_profiles
      });

      const result = await getOverdueTraining();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.data.every(s => s.is_overdue)).toBe(true);
      }
    });

    it('returns empty array when no training is overdue', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 180);

      const mockCourses = [
        { id: 'c-1', course_name: 'HIPAA', category: 'hipaa_security', recurrence_months: 12 },
      ];
      const mockCompletions = [
        {
          employee_id: 'emp-1',
          course_id: 'c-1',
          completed_at: new Date().toISOString(),
          expires_at: futureDate.toISOString(),
          passed: true,
        },
      ];
      const mockEmployees = [
        { user_id: 'emp-1', first_name: 'Jane', last_name: 'Smith' },
      ];

      const coursesChain = createChainableMock({ data: mockCourses, error: null });
      const completionsChain = createChainableMock({ data: mockCompletions, error: null });
      const employeesChain = createChainableMock({ data: mockEmployees, error: null });
      coursesChain.eq.mockResolvedValue({ data: mockCourses, error: null });
      completionsChain.order.mockResolvedValue({ data: mockCompletions, error: null });
      employeesChain.select.mockResolvedValue({ data: mockEmployees, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return coursesChain;
        if (callCount === 2) return completionsChain;
        return employeesChain;
      });

      const result = await getOverdueTraining();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });
  });

  describe('getTenantComplianceRate', () => {
    it('calculates correct compliance percentage', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 180);
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const mockCourses = [
        { id: 'c-1', course_name: 'HIPAA', category: 'hipaa_security', recurrence_months: 12 },
      ];
      const mockCompletions = [
        // emp-1 is current
        { employee_id: 'emp-1', course_id: 'c-1', completed_at: new Date().toISOString(), expires_at: futureDate.toISOString(), passed: true },
        // emp-2 is expired
        { employee_id: 'emp-2', course_id: 'c-1', completed_at: pastDate.toISOString(), expires_at: pastDate.toISOString(), passed: true },
      ];
      const mockEmployees = [
        { user_id: 'emp-1', first_name: 'Alice', last_name: 'A' },
        { user_id: 'emp-2', first_name: 'Bob', last_name: 'B' },
      ];

      const coursesChain = createChainableMock({ data: mockCourses, error: null });
      const completionsChain = createChainableMock({ data: mockCompletions, error: null });
      const employeesChain = createChainableMock({ data: mockEmployees, error: null });
      coursesChain.eq.mockResolvedValue({ data: mockCourses, error: null });
      completionsChain.order.mockResolvedValue({ data: mockCompletions, error: null });
      employeesChain.select.mockResolvedValue({ data: mockEmployees, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return coursesChain;
        if (callCount === 2) return completionsChain;
        return employeesChain;
      });

      const result = await getTenantComplianceRate();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_employees).toBe(2);
        // emp-1 is compliant, emp-2 has expired training = not compliant
        expect(result.data.compliant_employees).toBe(1);
        expect(result.data.compliance_rate).toBe(50);
        expect(result.data.overdue_count).toBeGreaterThan(0);
      }
    });

    it('returns 0% compliance when no employees have completed training', async () => {
      const mockCourses = [
        { id: 'c-1', course_name: 'HIPAA', category: 'hipaa_security', recurrence_months: 12 },
      ];
      const mockCompletions: unknown[] = [];
      const mockEmployees = [
        { user_id: 'emp-1', first_name: 'New', last_name: 'Hire' },
      ];

      const coursesChain = createChainableMock({ data: mockCourses, error: null });
      const completionsChain = createChainableMock({ data: mockCompletions, error: null });
      const employeesChain = createChainableMock({ data: mockEmployees, error: null });
      coursesChain.eq.mockResolvedValue({ data: mockCourses, error: null });
      completionsChain.order.mockResolvedValue({ data: mockCompletions, error: null });
      employeesChain.select.mockResolvedValue({ data: mockEmployees, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return coursesChain;
        if (callCount === 2) return completionsChain;
        return employeesChain;
      });

      const result = await getTenantComplianceRate();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.compliance_rate).toBe(0);
        expect(result.data.total_employees).toBe(1);
        expect(result.data.compliant_employees).toBe(0);
      }
    });
  });
});
