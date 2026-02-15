/**
 * eligibilityVerificationService tests — validates encounter eligibility
 * retrieval, stats aggregation, X12 270/271 verification, and status checks.
 *
 * Deletion Test: Every test asserts specific data transformations, status
 * mapping, or error handling that would fail if service logic were removed.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — self-referencing chain builder
// ============================================================================

interface ChainResult {
  data: unknown;
  error: unknown;
  count?: number;
}

function createChainBuilder(terminalResult: ChainResult): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  const methods = [
    'select', 'insert', 'update', 'eq', 'in', 'order', 'limit',
    'single', 'maybeSingle', 'is', 'not',
  ];
  for (const m of methods) {
    if (m === 'single' || m === 'maybeSingle') {
      builder[m] = vi.fn().mockResolvedValue(terminalResult);
    } else {
      builder[m] = vi.fn().mockReturnValue(builder);
    }
  }
  return builder;
}

function chainWithLimit(result: ChainResult): Record<string, unknown> {
  const chain = createChainBuilder(result);
  (chain.limit as ReturnType<typeof vi.fn>).mockResolvedValue(result);
  return chain;
}

function chainWithInTerminal(result: ChainResult): Record<string, unknown> {
  const chain = createChainBuilder(result);
  (chain.in as ReturnType<typeof vi.fn>).mockResolvedValue(result);
  return chain;
}

let fromCallResults: Array<Record<string, unknown>> = [];

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((_table: string) => {
      if (fromCallResults.length > 0) {
        return fromCallResults.shift();
      }
      return createChainBuilder({ data: null, error: null });
    }),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    clinical: vi.fn(),
    ai: vi.fn(),
  },
}));

import { eligibilityVerificationService } from '../../../services/eligibilityVerificationService';
import { auditLogger } from '../../../services/auditLogger';

// ============================================================================
// FIXTURES
// ============================================================================

const ENCOUNTER_ELIGIBILITY_ROW = {
  id: 'enc-001',
  patient_id: 'pat-001',
  date_of_service: '2026-02-10',
  status: 'signed',
  coverage_status: 'active',
  coverage_verified_at: '2026-02-10T16:00:00Z',
  coverage_details: { plan_name: 'Gold Plan', subscriber_id: 'SUB-123' },
  payer_id: 'payer-001',
  profiles: { first_name: 'Jane', last_name: 'Smith' },
  billing_payers: { name: 'Aetna', payer_id: 'AETNA001' },
};

const ENCOUNTER_FOR_VERIFICATION = {
  id: 'enc-002',
  patient_id: 'pat-002',
  date_of_service: '2026-02-12',
  status: 'signed',
  payer_id: 'payer-002',
  profiles: { first_name: 'Bob', last_name: 'Jones', dob: '1960-03-15', member_id: 'MEM-456' },
  billing_payers: { name: 'BlueCross', payer_id: 'BC001' },
  billing_providers: { npi: '1234567890' },
};

// ============================================================================
// TESTS
// ============================================================================

describe('eligibilityVerificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallResults = [];
  });

  // --------------------------------------------------------------------------
  // getEncountersForVerification
  // --------------------------------------------------------------------------

  describe('getEncountersForVerification', () => {
    it('returns encounters mapped with coverage status and patient info', async () => {
      fromCallResults.push(chainWithLimit({ data: [ENCOUNTER_ELIGIBILITY_ROW], error: null }));

      const result = await eligibilityVerificationService.getEncountersForVerification();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].encounter_id).toBe('enc-001');
        expect(result.data[0].patient_name).toBe('Smith, Jane');
        expect(result.data[0].payer_name).toBe('Aetna');
        expect(result.data[0].coverage_status).toBe('active');
        expect(result.data[0].coverage_details).not.toBeNull();
        expect(result.data[0].coverage_details?.plan_name).toBe('Gold Plan');
      }
    });

    it('defaults coverage_status to "unverified" when null', async () => {
      const unverifiedRow = { ...ENCOUNTER_ELIGIBILITY_ROW, coverage_status: null };
      fromCallResults.push(chainWithLimit({ data: [unverifiedRow], error: null }));

      const result = await eligibilityVerificationService.getEncountersForVerification();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].coverage_status).toBe('unverified');
      }
    });

    it('returns empty array when no billable encounters exist', async () => {
      fromCallResults.push(chainWithLimit({ data: [], error: null }));

      const result = await eligibilityVerificationService.getEncountersForVerification();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('returns failure and logs error on database error', async () => {
      fromCallResults.push(chainWithLimit({ data: null, error: { message: 'connection failed' } }));

      const result = await eligibilityVerificationService.getEncountersForVerification();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
      expect(auditLogger.error).toHaveBeenCalled();
    });

    it('handles null coverage_details by returning null', async () => {
      const noCoverageRow = { ...ENCOUNTER_ELIGIBILITY_ROW, coverage_details: null };
      fromCallResults.push(chainWithLimit({ data: [noCoverageRow], error: null }));

      const result = await eligibilityVerificationService.getEncountersForVerification();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].coverage_details).toBeNull();
      }
    });
  });

  // --------------------------------------------------------------------------
  // getEligibilityStats
  // --------------------------------------------------------------------------

  describe('getEligibilityStats', () => {
    it('computes correct counts across all coverage statuses', async () => {
      const rows = [
        { id: 'e1', coverage_status: 'active' },
        { id: 'e2', coverage_status: 'active' },
        { id: 'e3', coverage_status: null },
        { id: 'e4', coverage_status: 'inactive' },
        { id: 'e5', coverage_status: 'expired' },
        { id: 'e6', coverage_status: 'error' },
      ];
      fromCallResults.push(chainWithInTerminal({ data: rows, error: null }));

      const result = await eligibilityVerificationService.getEligibilityStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_encounters).toBe(6);
        expect(result.data.verified_active).toBe(2);
        expect(result.data.unverified).toBe(1);
        expect(result.data.inactive_or_expired).toBe(2);
        expect(result.data.errors).toBe(1);
      }
    });

    it('returns all zeros when no encounters exist', async () => {
      fromCallResults.push(chainWithInTerminal({ data: [], error: null }));

      const result = await eligibilityVerificationService.getEligibilityStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_encounters).toBe(0);
        expect(result.data.verified_active).toBe(0);
        expect(result.data.unverified).toBe(0);
        expect(result.data.inactive_or_expired).toBe(0);
        expect(result.data.errors).toBe(0);
      }
    });

    it('returns failure on database error', async () => {
      fromCallResults.push(chainWithInTerminal({ data: null, error: { message: 'db down' } }));

      const result = await eligibilityVerificationService.getEligibilityStats();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  // --------------------------------------------------------------------------
  // verifyEncounterEligibility
  // --------------------------------------------------------------------------

  describe('verifyEncounterEligibility', () => {
    it('verifies eligibility and returns active coverage with patient info', async () => {
      // 1. Encounter lookup
      fromCallResults.push(createChainBuilder({ data: ENCOUNTER_FOR_VERIFICATION, error: null }));
      // 2. Update encounter with coverage result
      fromCallResults.push(createChainBuilder({ data: null, error: null }));

      const result = await eligibilityVerificationService.verifyEncounterEligibility('enc-002');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.encounter_id).toBe('enc-002');
        expect(result.data.patient_name).toBe('Jones, Bob');
        expect(result.data.payer_name).toBe('BlueCross');
        expect(result.data.coverage_status).toBe('active');
        expect(result.data.coverage_verified_at).not.toBeNull();
        expect(result.data.coverage_details?.subscriber_id).toBe('MEM-456');
      }
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'ELIGIBILITY_VERIFIED',
        true,
        expect.objectContaining({
          encounterId: 'enc-002',
          coverageStatus: 'active',
          payerId: 'BC001',
        }),
      );
    });

    it('returns NOT_FOUND when encounter does not exist', async () => {
      fromCallResults.push(createChainBuilder({ data: null, error: { message: 'not found' } }));

      const result = await eligibilityVerificationService.verifyEncounterEligibility('enc-missing');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toBe('Encounter not found');
      }
    });

    it('returns VALIDATION_ERROR when no payer is assigned', async () => {
      const noPayer = { ...ENCOUNTER_FOR_VERIFICATION, billing_payers: null };
      // 1. Encounter lookup
      fromCallResults.push(createChainBuilder({ data: noPayer, error: null }));
      // 2. Update to error status
      fromCallResults.push(createChainBuilder({ data: null, error: null }));

      const result = await eligibilityVerificationService.verifyEncounterEligibility('enc-002');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('No payer assigned');
      }
    });

    it('returns DATABASE_ERROR when encounter update fails after verification', async () => {
      // 1. Encounter lookup
      fromCallResults.push(createChainBuilder({ data: ENCOUNTER_FOR_VERIFICATION, error: null }));
      // 2. Update fails
      const updateChain = createChainBuilder({ data: null, error: null });
      (updateChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ error: { message: 'update failed' } });
      fromCallResults.push(updateChain);

      const result = await eligibilityVerificationService.verifyEncounterEligibility('enc-002');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
        expect(result.error.message).toContain('store verification result');
      }
      expect(auditLogger.error).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // getVerificationStatus
  // --------------------------------------------------------------------------

  describe('getVerificationStatus', () => {
    it('returns the current coverage status for an encounter', async () => {
      fromCallResults.push(createChainBuilder({
        data: {
          coverage_status: 'active',
          coverage_verified_at: '2026-02-10T16:00:00Z',
          coverage_details: { plan_name: 'Silver Plan' },
        },
        error: null,
      }));

      const result = await eligibilityVerificationService.getVerificationStatus('enc-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.coverage_status).toBe('active');
        expect(result.data.coverage_verified_at).toBe('2026-02-10T16:00:00Z');
        expect(result.data.coverage_details?.plan_name).toBe('Silver Plan');
      }
    });

    it('defaults coverage_status to "unverified" when null in database', async () => {
      fromCallResults.push(createChainBuilder({
        data: { coverage_status: null, coverage_verified_at: null, coverage_details: null },
        error: null,
      }));

      const result = await eligibilityVerificationService.getVerificationStatus('enc-new');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.coverage_status).toBe('unverified');
        expect(result.data.coverage_verified_at).toBeNull();
        expect(result.data.coverage_details).toBeNull();
      }
    });

    it('returns NOT_FOUND when encounter does not exist', async () => {
      const chain = createChainBuilder({ data: null, error: null });
      (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });
      fromCallResults.push(chain);

      const result = await eligibilityVerificationService.getVerificationStatus('enc-missing');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('logs error via auditLogger when an unexpected exception occurs', async () => {
      const badChain = {
        select: vi.fn(() => { throw new Error('Unexpected crash'); }),
        update: vi.fn(() => { throw new Error('Unexpected crash'); }),
      };
      fromCallResults.push(badChain);

      const result = await eligibilityVerificationService.getVerificationStatus('enc-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OPERATION_FAILED');
      }
      expect(auditLogger.error).toHaveBeenCalledWith(
        'ELIGIBILITY_STATUS_FETCH_FAILED',
        expect.any(Error),
        expect.objectContaining({ encounterId: 'enc-001' }),
      );
    });
  });
});
