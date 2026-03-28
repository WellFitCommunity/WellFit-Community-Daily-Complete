/**
 * RPM Claim Service Tests
 *
 * Tests the RPM billing pipeline: eligibility → encounter → procedures → claim
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rpmClaimService } from '../rpmClaimService';
import type { RpmBillingEligibility } from '../../types/rpm';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../lib/supabaseClient', () => {
  const mockFrom = vi.fn();
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../rpmDashboardService', () => ({
  rpmDashboardService: {
    getBillingEligibility: vi.fn(),
    getActiveEnrollments: vi.fn(),
    getEnrollmentById: vi.fn(),
  },
}));

import { supabase } from '../../lib/supabaseClient';
import { rpmDashboardService } from '../rpmDashboardService';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockEligibility(overrides: Partial<RpmBillingEligibility> = {}): RpmBillingEligibility {
  return {
    enrollment_id: 'enroll-001',
    patient_id: 'patient-001',
    period_start: '2026-03-01',
    period_end: '2026-03-31',
    transmission_days: 18,
    required_days: 16,
    is_eligible_99454: true,
    is_eligible_99457: true,
    is_eligible_99458: false,
    monitoring_minutes: 25,
    additional_20min_units: 0,
    transmission_dates: ['2026-03-01', '2026-03-02'],
    ...overrides,
  };
}

function mockEnrollmentRow() {
  return {
    id: 'enroll-001',
    patient_id: 'patient-001',
    primary_diagnosis_code: 'I10',
    monitoring_reason: 'Hypertension monitoring',
    ordering_provider_id: 'provider-001',
    setup_completed_at: null,
    monitoring_start_date: '2026-02-01',
    monitoring_end_date: null,
    total_monitoring_minutes: 25,
    tenant_id: 'tenant-001',
  };
}

function setupChainMock(result: { data?: unknown; error?: { message: string } | null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    order: vi.fn().mockReturnThis(),
  };
  return chain;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('rpmClaimService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    (rpmDashboardService.getBillingEligibility as ReturnType<typeof vi.fn>).mockReset();
    (rpmDashboardService.getActiveEnrollments as ReturnType<typeof vi.fn>).mockReset();
    (rpmDashboardService.getEnrollmentById as ReturnType<typeof vi.fn>).mockReset();
    mockFrom.mockReset();
  });

  // ── buildRpmProcedures ──────────────────────────────────────────────────

  describe('buildRpmProcedures', () => {
    const rates = { '99453': 19.46, '99454': 62.44, '99457': 50.94, '99458': 41.17 };

    it('should include 99454 when transmission days meet threshold', () => {
      const elig = mockEligibility({ is_eligible_99454: true, is_eligible_99457: false });
      const procs = rpmClaimService.buildRpmProcedures(elig, rates, '2026-03-31', false);

      expect(procs).toHaveLength(1);
      expect(procs[0].code).toBe('99454');
      expect(procs[0].defaultCharge).toBe(62.44);
    });

    it('should include 99457 when monitoring minutes meet threshold', () => {
      const elig = mockEligibility({ is_eligible_99454: false, is_eligible_99457: true });
      const procs = rpmClaimService.buildRpmProcedures(elig, rates, '2026-03-31', false);

      expect(procs).toHaveLength(1);
      expect(procs[0].code).toBe('99457');
    });

    it('should include both 99454 and 99457 when both eligible', () => {
      const elig = mockEligibility({ is_eligible_99454: true, is_eligible_99457: true });
      const procs = rpmClaimService.buildRpmProcedures(elig, rates, '2026-03-31', false);

      expect(procs).toHaveLength(2);
      const codes = procs.map((p) => p.code);
      expect(codes).toContain('99454');
      expect(codes).toContain('99457');
    });

    it('should include 99458 with correct units for additional 20-min blocks', () => {
      const elig = mockEligibility({
        is_eligible_99457: true,
        is_eligible_99458: true,
        monitoring_minutes: 65,
        additional_20min_units: 2,
      });
      const procs = rpmClaimService.buildRpmProcedures(elig, rates, '2026-03-31', false);

      const proc99458 = procs.find((p) => p.code === '99458');
      expect(proc99458).toBeDefined();
      expect(proc99458?.units).toBe(2);
      expect(proc99458?.defaultCharge).toBe(41.17);
    });

    it('should include 99453 when setup completed this period', () => {
      const elig = mockEligibility({ is_eligible_99454: true });
      const procs = rpmClaimService.buildRpmProcedures(elig, rates, '2026-03-31', true);

      const codes = procs.map((p) => p.code);
      expect(codes).toContain('99453');
    });

    it('should NOT include 99453 when setup was not this period', () => {
      const elig = mockEligibility({ is_eligible_99454: true });
      const procs = rpmClaimService.buildRpmProcedures(elig, rates, '2026-03-31', false);

      const codes = procs.map((p) => p.code);
      expect(codes).not.toContain('99453');
    });

    it('should return empty array when nothing is eligible', () => {
      const elig = mockEligibility({
        is_eligible_99454: false,
        is_eligible_99457: false,
        is_eligible_99458: false,
      });
      const procs = rpmClaimService.buildRpmProcedures(elig, rates, '2026-03-31', false);
      expect(procs).toHaveLength(0);
    });
  });

  // ── generateRpmClaim ────────────────────────────────────────────────────

  describe('generateRpmClaim', () => {
    it('should fail when enrollment is not eligible', async () => {
      (rpmDashboardService.getBillingEligibility as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockEligibility({
          is_eligible_99454: false,
          is_eligible_99457: false,
        }),
      });

      const result = await rpmClaimService.generateRpmClaim({
        enrollmentId: 'enroll-001',
        billingProviderId: 'bp-001',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_ENTITLED');
      }
    });

    it('should fail when eligibility check fails', async () => {
      (rpmDashboardService.getBillingEligibility as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Enrollment not found' },
      });

      const result = await rpmClaimService.generateRpmClaim({
        enrollmentId: 'enroll-999',
        billingProviderId: 'bp-001',
      });

      expect(result.success).toBe(false);
    });

    it('should create encounter, procedures, and claim when eligible', async () => {
      // Mock eligibility
      (rpmDashboardService.getBillingEligibility as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockEligibility(),
      });

      // Mock enrollment lookup
      const enrollmentChain = setupChainMock({
        data: mockEnrollmentRow(),
        error: null,
      });

      // Mock fee schedule lookup (empty — use defaults)
      const feeSchedChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      // Mock encounter insert
      const encounterChain = setupChainMock({
        data: { id: 'enc-001' },
        error: null,
      });

      // Mock diagnosis insert
      const diagChain = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      // Mock procedure insert
      const procChain = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      // Mock claim insert
      const claimChain = setupChainMock({
        data: { id: 'claim-001' },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        switch (table) {
          case 'rpm_enrollments':
            return enrollmentChain;
          case 'fee_schedules':
            return feeSchedChain;
          case 'encounters':
            return encounterChain;
          case 'encounter_diagnoses':
            return diagChain;
          case 'encounter_procedures':
            return procChain;
          case 'claims':
            return claimChain;
          default:
            return setupChainMock({ data: null, error: null });
        }
      });

      const result = await rpmClaimService.generateRpmClaim({
        enrollmentId: 'enroll-001',
        billingProviderId: 'bp-001',
        payerId: 'payer-001',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.encounter_id).toBe('enc-001');
        expect(result.data.claim_id).toBe('claim-001');
        expect(result.data.billing_codes).toContain('99454');
        expect(result.data.billing_codes).toContain('99457');
        expect(result.data.total_charge).toBeGreaterThan(0);
      }
    });

    it('should handle encounter creation failure', async () => {
      (rpmDashboardService.getBillingEligibility as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockEligibility(),
      });

      const enrollmentChain = setupChainMock({
        data: mockEnrollmentRow(),
        error: null,
      });
      const feeSchedChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      const encounterChain = setupChainMock({
        data: null,
        error: { message: 'DB constraint violation' },
      });

      mockFrom.mockImplementation((table: string) => {
        switch (table) {
          case 'rpm_enrollments':
            return enrollmentChain;
          case 'fee_schedules':
            return feeSchedChain;
          case 'encounters':
            return encounterChain;
          default:
            return setupChainMock({ data: null, error: null });
        }
      });

      const result = await rpmClaimService.generateRpmClaim({
        enrollmentId: 'enroll-001',
        billingProviderId: 'bp-001',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  // ── runMonthlyBilling ───────────────────────────────────────────────────

  describe('runMonthlyBilling', () => {
    it('should return summary with zero claims when no active enrollments', async () => {
      (rpmDashboardService.getActiveEnrollments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });

      const result = await rpmClaimService.runMonthlyBilling({
        billingProviderId: 'bp-001',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_enrollments).toBe(0);
        expect(result.data.claims_generated).toBe(0);
      }
    });

    it('should fail when enrollment fetch fails', async () => {
      (rpmDashboardService.getActiveEnrollments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Connection failed' },
      });

      const result = await rpmClaimService.runMonthlyBilling({
        billingProviderId: 'bp-001',
      });

      expect(result.success).toBe(false);
    });

    it('should skip pending enrollments in monthly billing', async () => {
      (rpmDashboardService.getActiveEnrollments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [
          { id: 'enroll-pend', status: 'pending', patient_id: 'p1' },
        ],
      });

      const result = await rpmClaimService.runMonthlyBilling({
        billingProviderId: 'bp-001',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.claims_generated).toBe(0);
        expect(result.data.errors).toHaveLength(0);
      }
    });
  });

  // ── hasExistingClaimForPeriod ───────────────────────────────────────────

  describe('hasExistingClaimForPeriod', () => {
    it('should return true when RPM encounter exists in period', async () => {
      (rpmDashboardService.getEnrollmentById as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { id: 'enroll-001', patient_id: 'patient-001' },
      });

      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ id: 'enc-existing' }],
          error: null,
        }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await rpmClaimService.hasExistingClaimForPeriod(
        'enroll-001',
        '2026-03-01',
        '2026-03-31'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(true);
      }
    });

    it('should return false when no RPM encounter exists', async () => {
      (rpmDashboardService.getEnrollmentById as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { id: 'enroll-001', patient_id: 'patient-001' },
      });

      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await rpmClaimService.hasExistingClaimForPeriod(
        'enroll-001',
        '2026-03-01',
        '2026-03-31'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(false);
      }
    });
  });

  // ── getRpmFeeScheduleRates ──────────────────────────────────────────────

  describe('getRpmFeeScheduleRates', () => {
    it('should return default CMS rates when no fee schedule exists', async () => {
      // fee_schedules query returns empty
      const schedChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockFrom.mockReturnValue(schedChain);

      const rates = await rpmClaimService.getRpmFeeScheduleRates('bp-001');

      expect(rates['99453']).toBe(19.46);
      expect(rates['99454']).toBe(62.44);
      expect(rates['99457']).toBe(50.94);
      expect(rates['99458']).toBe(41.17);
    });

    it('should override defaults with fee schedule rates', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'fee_schedules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'sched-001' }],
              error: null,
            }),
          };
        }
        if (table === 'fee_schedule_rates') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                { code: '99454', rate: 75.00 },
                { code: '99457', rate: 60.00 },
              ],
              error: null,
            }),
          };
        }
        return setupChainMock({ data: null, error: null });
      });

      const rates = await rpmClaimService.getRpmFeeScheduleRates('bp-001');

      expect(rates['99454']).toBe(75.00);
      expect(rates['99457']).toBe(60.00);
      // Defaults remain for codes not in fee schedule
      expect(rates['99453']).toBe(19.46);
      expect(rates['99458']).toBe(41.17);
    });

    it('should return defaults on database error', async () => {
      const schedChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } }),
      };
      mockFrom.mockReturnValue(schedChain);

      const rates = await rpmClaimService.getRpmFeeScheduleRates('bp-001');

      expect(rates['99453']).toBe(19.46);
    });
  });
});
