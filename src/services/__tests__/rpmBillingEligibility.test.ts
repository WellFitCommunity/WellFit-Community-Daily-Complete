/**
 * RPM Billing Eligibility Tests
 *
 * Tests for CPT 99454/99457/99458 billing eligibility:
 * - 99454: Patient transmitted health data on >= 16 of 30 days
 * - 99457: >= 20 minutes of clinical monitoring time
 * - 99458: Each additional 20-minute block beyond 99457
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rpmDashboardService } from '../rpmDashboardService';
import { supabase } from '../../lib/supabaseClient';

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

interface ChainResult {
  data: unknown;
  error: unknown;
}

/**
 * Creates a chainable mock that mimics Supabase's PostgREST builder.
 * The chain itself is thenable (has a .then method) so that awaiting the
 * chain at any point resolves to the result — matching Supabase's actual
 * behavior where you can `await` a query without a terminal method.
 */
function createChainableMock(result: ChainResult) {
  const thenFn = vi.fn().mockImplementation(
    (resolve?: (value: ChainResult) => unknown) => Promise.resolve(result).then(resolve)
  );
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    limit: vi.fn().mockResolvedValue(result),
    then: thenFn,
  };
  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.not.mockReturnValue(chain);
  chain.lte.mockReturnValue(chain);
  chain.or.mockReturnValue(chain);
  return chain;
}

/** Generate N unique date strings going backwards from today */
function generateTransmissionDates(count: number): { timestamp: string }[] {
  const dates: { timestamp: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dates.push({ timestamp: d.toISOString() });
  }
  return dates;
}

describe('RPM Billing Eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTransmissionDays', () => {
    it('returns distinct dates with transmission data from check-ins', async () => {
      const checkInData = generateTransmissionDates(5);
      const checkInChain = createChainableMock({ data: checkInData, error: null });
      const wearableChain = createChainableMock({ data: [], error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? checkInChain : wearableChain;
      });

      const result = await rpmDashboardService.getTransmissionDays('patient-1', 30);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(5);
        result.data.forEach((day) => {
          expect(day.has_transmission).toBe(true);
          expect(day.source).toBe('check_in');
          expect(day.vital_count).toBeGreaterThanOrEqual(1);
        });
      }
    });

    it('returns failure on database error', async () => {
      const errorChain = createChainableMock({
        data: null,
        error: { message: 'Connection refused' },
      });
      mockSupabase.from.mockReturnValue(errorChain);

      const result = await rpmDashboardService.getTransmissionDays('patient-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  describe('getBillingEligibility', () => {
    it('returns eligible for 99454 when patient has 16+ transmission days', async () => {
      const enrollment = {
        id: 'enroll-1',
        patient_id: 'patient-1',
        total_monitoring_minutes: 25,
        monitoring_start_date: '2026-01-01',
      };

      const checkInDates = generateTransmissionDates(18);

      const enrollmentChain = createChainableMock({ data: enrollment, error: null });
      const checkInChain = createChainableMock({ data: checkInDates, error: null });
      const wearableChain = createChainableMock({ data: [], error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return enrollmentChain; // rpm_enrollments
        if (callCount === 2) return checkInChain;     // check_ins
        return wearableChain;                          // wearable_vital_signs
      });

      const result = await rpmDashboardService.getBillingEligibility('enroll-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_eligible_99454).toBe(true);
        expect(result.data.transmission_days).toBe(18);
        expect(result.data.required_days).toBe(16);
        expect(result.data.enrollment_id).toBe('enroll-1');
        expect(result.data.patient_id).toBe('patient-1');
      }
    });

    it('returns NOT eligible for 99454 when patient has only 15 transmission days', async () => {
      const enrollment = {
        id: 'enroll-2',
        patient_id: 'patient-2',
        total_monitoring_minutes: 10,
        monitoring_start_date: '2026-01-01',
      };

      const checkInDates = generateTransmissionDates(15);

      const enrollmentChain = createChainableMock({ data: enrollment, error: null });
      const checkInChain = createChainableMock({ data: checkInDates, error: null });
      const wearableChain = createChainableMock({ data: [], error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return enrollmentChain;
        if (callCount === 2) return checkInChain;
        return wearableChain;
      });

      const result = await rpmDashboardService.getBillingEligibility('enroll-2');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_eligible_99454).toBe(false);
        expect(result.data.transmission_days).toBe(15);
        expect(result.data.required_days).toBe(16);
      }
    });

    it('returns eligible for 99457 when monitoring minutes >= 20', async () => {
      const enrollment = {
        id: 'enroll-3',
        patient_id: 'patient-3',
        total_monitoring_minutes: 25,
        monitoring_start_date: '2026-01-01',
      };

      const enrollmentChain = createChainableMock({ data: enrollment, error: null });
      const checkInChain = createChainableMock({ data: generateTransmissionDates(5), error: null });
      const wearableChain = createChainableMock({ data: [], error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return enrollmentChain;
        if (callCount === 2) return checkInChain;
        return wearableChain;
      });

      const result = await rpmDashboardService.getBillingEligibility('enroll-3');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_eligible_99457).toBe(true);
        expect(result.data.monitoring_minutes).toBe(25);
      }
    });

    it('returns 1 additional unit for 99458 when monitoring minutes >= 40', async () => {
      const enrollment = {
        id: 'enroll-4',
        patient_id: 'patient-4',
        total_monitoring_minutes: 45,
        monitoring_start_date: '2026-01-01',
      };

      const enrollmentChain = createChainableMock({ data: enrollment, error: null });
      const checkInChain = createChainableMock({ data: generateTransmissionDates(20), error: null });
      const wearableChain = createChainableMock({ data: [], error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return enrollmentChain;
        if (callCount === 2) return checkInChain;
        return wearableChain;
      });

      const result = await rpmDashboardService.getBillingEligibility('enroll-4');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_eligible_99458).toBe(true);
        expect(result.data.additional_20min_units).toBe(1);
        expect(result.data.monitoring_minutes).toBe(45);
      }
    });

    it('returns not eligible for 99457/99458 when monitoring minutes are 0', async () => {
      const enrollment = {
        id: 'enroll-5',
        patient_id: 'patient-5',
        total_monitoring_minutes: 0,
        monitoring_start_date: '2026-01-01',
      };

      const enrollmentChain = createChainableMock({ data: enrollment, error: null });
      const checkInChain = createChainableMock({ data: generateTransmissionDates(20), error: null });
      const wearableChain = createChainableMock({ data: [], error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return enrollmentChain;
        if (callCount === 2) return checkInChain;
        return wearableChain;
      });

      const result = await rpmDashboardService.getBillingEligibility('enroll-5');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_eligible_99457).toBe(false);
        expect(result.data.is_eligible_99458).toBe(false);
        expect(result.data.monitoring_minutes).toBe(0);
        expect(result.data.additional_20min_units).toBe(0);
      }
    });

    it('returns failure when enrollment not found', async () => {
      const enrollmentChain = createChainableMock({
        data: null,
        error: { message: 'Row not found' },
      });
      mockSupabase.from.mockReturnValue(enrollmentChain);

      const result = await rpmDashboardService.getBillingEligibility('nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });

    it('returns 2 additional units for 99458 when monitoring minutes are 65', async () => {
      const enrollment = {
        id: 'enroll-6',
        patient_id: 'patient-6',
        total_monitoring_minutes: 65,
        monitoring_start_date: '2026-01-01',
      };

      const enrollmentChain = createChainableMock({ data: enrollment, error: null });
      const checkInChain = createChainableMock({ data: generateTransmissionDates(16), error: null });
      const wearableChain = createChainableMock({ data: [], error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return enrollmentChain;
        if (callCount === 2) return checkInChain;
        return wearableChain;
      });

      const result = await rpmDashboardService.getBillingEligibility('enroll-6');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_eligible_99454).toBe(true);
        expect(result.data.is_eligible_99457).toBe(true);
        expect(result.data.is_eligible_99458).toBe(true);
        expect(result.data.additional_20min_units).toBe(2);
      }
    });
  });

  describe('getBulkBillingEligibility', () => {
    it('returns eligibility for all active enrollments', async () => {
      const activeEnrollments = [{ id: 'enroll-a' }, { id: 'enroll-b' }];

      // First call: list active enrollments
      const listChain = createChainableMock({ data: activeEnrollments, error: null });

      // Enrollment A
      const enrollmentA = {
        id: 'enroll-a',
        patient_id: 'patient-a',
        total_monitoring_minutes: 30,
        monitoring_start_date: '2026-01-01',
      };
      const enrollAChain = createChainableMock({ data: enrollmentA, error: null });
      const checkInAChain = createChainableMock({ data: generateTransmissionDates(20), error: null });
      const wearableAChain = createChainableMock({ data: [], error: null });

      // Enrollment B
      const enrollmentB = {
        id: 'enroll-b',
        patient_id: 'patient-b',
        total_monitoring_minutes: 5,
        monitoring_start_date: '2026-01-01',
      };
      const enrollBChain = createChainableMock({ data: enrollmentB, error: null });
      const checkInBChain = createChainableMock({ data: generateTransmissionDates(10), error: null });
      const wearableBChain = createChainableMock({ data: [], error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        // Call 1: list active enrollments (select id from rpm_enrollments)
        if (callCount === 1) return listChain;
        // Call 2: enrollment A details
        if (callCount === 2) return enrollAChain;
        // Call 3: check_ins for patient-a
        if (callCount === 3) return checkInAChain;
        // Call 4: wearable for patient-a
        if (callCount === 4) return wearableAChain;
        // Call 5: enrollment B details
        if (callCount === 5) return enrollBChain;
        // Call 6: check_ins for patient-b
        if (callCount === 6) return checkInBChain;
        // Call 7: wearable for patient-b
        return wearableBChain;
      });

      const result = await rpmDashboardService.getBulkBillingEligibility();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);

        const eligA = result.data.find((e) => e.enrollment_id === 'enroll-a');
        expect(eligA).toBeDefined();
        expect(eligA?.is_eligible_99454).toBe(true);
        expect(eligA?.is_eligible_99457).toBe(true);

        const eligB = result.data.find((e) => e.enrollment_id === 'enroll-b');
        expect(eligB).toBeDefined();
        expect(eligB?.is_eligible_99454).toBe(false);
        expect(eligB?.is_eligible_99457).toBe(false);
      }
    });

    it('returns empty array when no active enrollments exist', async () => {
      const listChain = createChainableMock({ data: [], error: null });
      mockSupabase.from.mockReturnValue(listChain);

      const result = await rpmDashboardService.getBulkBillingEligibility();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('returns failure on database error fetching enrollments', async () => {
      const errorChain = createChainableMock({
        data: null,
        error: { message: 'DB error' },
      });
      mockSupabase.from.mockReturnValue(errorChain);

      const result = await rpmDashboardService.getBulkBillingEligibility();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });
});
