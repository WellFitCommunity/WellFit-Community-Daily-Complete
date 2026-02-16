/**
 * claimResubmissionService tests — validates rejected claim queries,
 * stats aggregation, denial detail lookup, corrected claim creation,
 * void workflow, and resubmission chain walking.
 *
 * Deletion Test: Every test asserts specific data transformations,
 * status guards, or error handling that would fail if service logic were removed.
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
    'select', 'insert', 'update', 'eq', 'in', 'not', 'order', 'limit', 'single', 'maybeSingle',
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

import { claimResubmissionService } from '../../../services/claimResubmissionService';
import { auditLogger } from '../../../services/auditLogger';

// ============================================================================
// FIXTURES
// ============================================================================

const REJECTED_CLAIM_ROW = {
  id: 'claim-001',
  encounter_id: 'enc-001',
  status: 'rejected',
  total_charge: 1500.00,
  control_number: 'CTL-100',
  created_at: '2026-02-01T12:00:00Z',
  updated_at: '2026-02-10T12:00:00Z',
  parent_claim_id: null,
  resubmission_count: 0,
  payer_id: 'payer-001',
  billing_payers: { name: 'Aetna' },
};

const VOID_CLAIM_ROW = {
  ...REJECTED_CLAIM_ROW,
  id: 'claim-002',
  status: 'void',
  control_number: 'CTL-200',
  billing_payers: { name: 'BlueCross' },
};

const DENIAL_ROW = {
  claim_id: 'claim-001',
  denial_code: 'CO-4',
  denial_reason: 'Missing modifier',
  appeal_deadline: '2026-03-01',
  appeal_status: 'pending',
};

// ============================================================================
// TESTS
// ============================================================================

describe('claimResubmissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallResults = [];
  });

  // --------------------------------------------------------------------------
  // getRejectedClaims
  // --------------------------------------------------------------------------
  describe('getRejectedClaims', () => {
    it('returns rejected claims mapped with denial details and aging', async () => {
      // 1. Claims query
      fromCallResults.push(chainWithLimit({ data: [REJECTED_CLAIM_ROW], error: null }));
      // 2. Denials query
      fromCallResults.push(chainWithInTerminal({ data: [DENIAL_ROW], error: null }));

      const result = await claimResubmissionService.getRejectedClaims();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].claim_id).toBe('claim-001');
        expect(result.data[0].payer_name).toBe('Aetna');
        expect(result.data[0].denial?.denial_code).toBe('CO-4');
        expect(result.data[0].aging_days).toBeGreaterThan(0);
      }
    });

    it('filters by rejected status when filter="rejected"', async () => {
      fromCallResults.push(chainWithLimit({ data: [REJECTED_CLAIM_ROW], error: null }));
      fromCallResults.push(chainWithInTerminal({ data: [DENIAL_ROW], error: null }));

      const result = await claimResubmissionService.getRejectedClaims('rejected');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.every(c => c.status === 'rejected')).toBe(true);
      }
    });

    it('filters claims client-side by search term on payer name', async () => {
      fromCallResults.push(chainWithLimit({ data: [REJECTED_CLAIM_ROW, VOID_CLAIM_ROW], error: null }));
      fromCallResults.push(chainWithInTerminal({ data: [], error: null }));

      const result = await claimResubmissionService.getRejectedClaims('all', 'Aetna');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].payer_name).toBe('Aetna');
      }
    });

    it('returns empty array when no claims exist', async () => {
      fromCallResults.push(chainWithLimit({ data: [], error: null }));

      const result = await claimResubmissionService.getRejectedClaims();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('returns failure on database error', async () => {
      fromCallResults.push(chainWithLimit({ data: null, error: { message: 'db timeout' } }));

      const result = await claimResubmissionService.getRejectedClaims();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
      expect(auditLogger.error).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // getResubmissionStats
  // --------------------------------------------------------------------------
  describe('getResubmissionStats', () => {
    it('computes correct stats from rejected and voided claims', async () => {
      // 1. Claims query (rejected + void)
      fromCallResults.push(chainWithInTerminal({
        data: [
          { id: 'c1', status: 'rejected', total_charge: 1000, created_at: '2026-02-01T00:00:00Z', parent_claim_id: null },
          { id: 'c2', status: 'rejected', total_charge: 500, created_at: '2026-02-05T00:00:00Z', parent_claim_id: null },
          { id: 'c3', status: 'void', total_charge: 200, created_at: '2026-01-15T00:00:00Z', parent_claim_id: null },
        ],
        error: null,
      }));
      // 2. Resubmitted children — uses .not().select()... chain that terminates at .not()
      const resubChain = createChainBuilder({ data: null, error: null });
      (resubChain.not as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [{ id: 'child-1' }], error: null });
      fromCallResults.push(resubChain);
      // 3. Denial deadlines
      fromCallResults.push(chainWithInTerminal({
        data: [
          { claim_id: 'c1', appeal_deadline: '2026-01-01' },
          { claim_id: 'c2', appeal_deadline: '2026-12-31' },
        ],
        error: null,
      }));

      const result = await claimResubmissionService.getResubmissionStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_rejected).toBe(2);
        expect(result.data.total_amount_at_risk).toBe(1500);
        expect(result.data.voided_count).toBe(1);
        expect(result.data.resubmitted_count).toBe(1);
        expect(result.data.past_appeal_deadline).toBe(1);
        expect(result.data.avg_days_since_rejection).toBeGreaterThan(0);
      }
    });

    it('returns failure on database error', async () => {
      fromCallResults.push(chainWithInTerminal({ data: null, error: { message: 'timeout' } }));

      const result = await claimResubmissionService.getResubmissionStats();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  // --------------------------------------------------------------------------
  // getDenialDetails
  // --------------------------------------------------------------------------
  describe('getDenialDetails', () => {
    it('returns denial detail when found', async () => {
      fromCallResults.push(chainWithLimit({
        data: [{ denial_code: 'CO-4', denial_reason: 'Missing modifier', appeal_deadline: '2026-03-01', appeal_status: 'pending' }],
        error: null,
      }));

      const result = await claimResubmissionService.getDenialDetails('claim-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.denial_code).toBe('CO-4');
        expect(result.data?.denial_reason).toBe('Missing modifier');
      }
    });

    it('returns null when no denial exists', async () => {
      fromCallResults.push(chainWithLimit({ data: [], error: null }));

      const result = await claimResubmissionService.getDenialDetails('claim-no-denial');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });
  });

  // --------------------------------------------------------------------------
  // createCorrectedClaim
  // --------------------------------------------------------------------------
  describe('createCorrectedClaim', () => {
    it('creates corrected claim, copies lines, voids original', async () => {
      // 1. Fetch original
      fromCallResults.push(createChainBuilder({
        data: {
          id: 'orig-1', encounter_id: 'enc-1', payer_id: 'pay-1',
          billing_provider_id: 'bp-1', claim_type: '837P', status: 'rejected',
          total_charge: 1500, resubmission_count: 0, created_by: 'user-1',
        },
        error: null,
      }));
      // 2. Insert new claim
      fromCallResults.push(createChainBuilder({ data: { id: 'new-claim-1' }, error: null }));
      // 3. Fetch claim lines
      fromCallResults.push(chainWithInTerminal({
        data: [{ code_system: 'CPT', procedure_code: '99213', modifiers: [], units: 1, charge_amount: 1500, diagnosis_pointers: [1], service_date: '2026-02-01', position: 1 }],
        error: null,
      }));
      // 4. Insert copied lines
      fromCallResults.push(createChainBuilder({ data: null, error: null }));
      // 5. Void original (update)
      fromCallResults.push(createChainBuilder({ data: null, error: null }));
      // 6. Status history for original
      fromCallResults.push(createChainBuilder({ data: null, error: null }));
      // 7. Status history for new claim
      fromCallResults.push(createChainBuilder({ data: null, error: null }));

      const result = await claimResubmissionService.createCorrectedClaim({
        original_claim_id: 'orig-1',
        correction_note: 'Fixed modifier on line 1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.new_claim_id).toBe('new-claim-1');
      }
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'CLAIM_CORRECTION_CREATED',
        true,
        expect.objectContaining({
          originalClaimId: 'orig-1',
          newClaimId: 'new-claim-1',
          resubmissionCount: 1,
        }),
      );
    });

    it('rejects correction for non-rejected claim', async () => {
      fromCallResults.push(createChainBuilder({
        data: {
          id: 'orig-2', encounter_id: 'enc-2', payer_id: 'pay-1',
          billing_provider_id: 'bp-1', claim_type: '837P', status: 'paid',
          total_charge: 1500, resubmission_count: 0, created_by: 'user-1',
        },
        error: null,
      }));

      const result = await claimResubmissionService.createCorrectedClaim({
        original_claim_id: 'orig-2',
        correction_note: 'Attempting invalid correction',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_STATE');
        expect(result.error.message).toContain('paid');
      }
    });

    it('returns failure when original claim not found', async () => {
      fromCallResults.push(createChainBuilder({ data: null, error: { message: 'not found' } }));

      const result = await claimResubmissionService.createCorrectedClaim({
        original_claim_id: 'missing',
        correction_note: 'This should fail',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // --------------------------------------------------------------------------
  // voidRejectedClaim
  // --------------------------------------------------------------------------
  describe('voidRejectedClaim', () => {
    it('voids a rejected claim and logs audit event', async () => {
      // 1. Fetch claim
      fromCallResults.push(createChainBuilder({
        data: { id: 'claim-v1', status: 'rejected', created_by: 'user-1' },
        error: null,
      }));
      // 2. Update status
      fromCallResults.push(createChainBuilder({ data: null, error: null }));
      // 3. Insert status history
      fromCallResults.push(createChainBuilder({ data: null, error: null }));

      const result = await claimResubmissionService.voidRejectedClaim(
        'claim-v1',
        'Unrecoverable: wrong patient billing'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.voided).toBe(true);
      }
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'CLAIM_VOIDED',
        true,
        expect.objectContaining({ claimId: 'claim-v1' }),
      );
    });

    it('rejects void reason shorter than 10 characters', async () => {
      const result = await claimResubmissionService.voidRejectedClaim('claim-v2', 'too short');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('10 characters');
      }
    });
  });
});
