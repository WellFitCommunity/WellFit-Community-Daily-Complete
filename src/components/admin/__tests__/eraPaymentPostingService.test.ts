/**
 * eraPaymentPostingService tests — validates ERA remittance retrieval,
 * payment posting, stats aggregation, and claim matching.
 *
 * Deletion Test: Every test asserts specific data transformations,
 * state validations, or error handling that would fail if service logic
 * were removed.
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
  // Make builder thenable so `await supabase.from(x).select(...)` resolves
  // to terminalResult when select() is the last call in the chain.
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(terminalResult).then(resolve);
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

function chainWithOrder(result: ChainResult): Record<string, unknown> {
  const chain = createChainBuilder(result);
  (chain.order as ReturnType<typeof vi.fn>).mockResolvedValue(result);
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

import { eraPaymentPostingService } from '../../../services/eraPaymentPostingService';
import type { PaymentPostRequest } from '../../../services/eraPaymentPostingService';
import { auditLogger } from '../../../services/auditLogger';

// ============================================================================
// FIXTURES
// ============================================================================

const REMITTANCE_ROW = {
  id: 'rem-001',
  payer_id: 'payer-001',
  received_at: '2026-02-08T12:00:00Z',
  summary: { total_paid: 5000, claim_count: 3 },
  details: {},
  billing_payers: { name: 'Aetna' },
};

const PAYMENT_ROW = {
  id: 'pay-001',
  claim_id: 'clm-001',
  remittance_id: 'rem-001',
  paid_amount: 1200,
  adjustment_amount: 300,
  patient_responsibility: 150,
  allowed_amount: 1650,
  adjustment_reason_codes: [{ code: 'CO-45', group: 'CO', amount: 300, description: 'Charges exceed fee schedule' }],
  check_number: 'CHK-9876',
  payment_date: '2026-02-08',
  payer_claim_number: 'PCN-001',
  match_confidence: 0.95,
  match_method: 'auto',
  posted_at: '2026-02-09T10:00:00Z',
  posted_by: 'user-001',
  tenant_id: 'tenant-001',
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-09T10:00:00Z',
};

const VALID_POST_REQUEST: PaymentPostRequest = {
  claim_id: 'clm-001',
  remittance_id: 'rem-001',
  paid_amount: 1200,
  adjustment_amount: 300,
  patient_responsibility: 150,
  allowed_amount: 1650,
  adjustment_reason_codes: [{ code: 'CO-45', group: 'CO', amount: 300 }],
  check_number: 'CHK-9876',
  payment_date: '2026-02-08',
  match_method: 'auto',
  match_confidence: 0.95,
  tenant_id: 'tenant-001',
};

// ============================================================================
// TESTS
// ============================================================================

describe('eraPaymentPostingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallResults = [];
  });

  // --------------------------------------------------------------------------
  // getUnpostedRemittances
  // --------------------------------------------------------------------------

  describe('getUnpostedRemittances', () => {
    it('returns remittances with correct unposted counts', async () => {
      // 1. Fetch remittances
      fromCallResults.push(chainWithLimit({ data: [REMITTANCE_ROW], error: null }));
      // 2. Fetch posted payments per remittance
      fromCallResults.push(chainWithInTerminal({
        data: [{ remittance_id: 'rem-001' }],
        error: null,
      }));

      const result = await eraPaymentPostingService.getUnpostedRemittances();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].remittance_id).toBe('rem-001');
        expect(result.data[0].payer_name).toBe('Aetna');
        expect(result.data[0].total_paid).toBe(5000);
        expect(result.data[0].claim_count).toBe(3);
        expect(result.data[0].posted_count).toBe(1);
        expect(result.data[0].unposted_count).toBe(2);
      }
    });

    it('filters out fully posted remittances', async () => {
      const fullyPosted = { ...REMITTANCE_ROW, summary: { total_paid: 1000, claim_count: 1 } };
      fromCallResults.push(chainWithLimit({ data: [fullyPosted], error: null }));
      fromCallResults.push(chainWithInTerminal({
        data: [{ remittance_id: 'rem-001' }],
        error: null,
      }));

      const result = await eraPaymentPostingService.getUnpostedRemittances();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('includes remittances with zero claim_count', async () => {
      const zeroClaims = { ...REMITTANCE_ROW, summary: { total_paid: 0, claim_count: 0 } };
      fromCallResults.push(chainWithLimit({ data: [zeroClaims], error: null }));
      fromCallResults.push(chainWithInTerminal({ data: [], error: null }));

      const result = await eraPaymentPostingService.getUnpostedRemittances();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].unposted_count).toBe(0);
        expect(result.data[0].claim_count).toBe(0);
      }
    });

    it('returns failure on database error and logs via auditLogger', async () => {
      fromCallResults.push(chainWithLimit({ data: null, error: { message: 'db timeout' } }));

      const result = await eraPaymentPostingService.getUnpostedRemittances();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
      expect(auditLogger.error).toHaveBeenCalled();
    });

    it('handles remittance with null summary gracefully', async () => {
      const nullSummary = { ...REMITTANCE_ROW, summary: null };
      fromCallResults.push(chainWithLimit({ data: [nullSummary], error: null }));
      fromCallResults.push(chainWithInTerminal({ data: [], error: null }));

      const result = await eraPaymentPostingService.getUnpostedRemittances();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].total_paid).toBe(0);
        expect(result.data[0].claim_count).toBe(0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // postPayment
  // --------------------------------------------------------------------------

  describe('postPayment', () => {
    it('posts payment to a submitted claim and transitions to paid', async () => {
      // 1. Claim lookup
      fromCallResults.push(createChainBuilder({ data: { id: 'clm-001', status: 'submitted' }, error: null }));
      // 2. Payment insert
      fromCallResults.push(createChainBuilder({ data: PAYMENT_ROW, error: null }));
      // 3. Claim status update
      fromCallResults.push(createChainBuilder({ data: null, error: null }));
      // 4. Status history insert
      fromCallResults.push(createChainBuilder({ data: null, error: null }));

      const result = await eraPaymentPostingService.postPayment(VALID_POST_REQUEST);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('pay-001');
        expect(result.data.claim_id).toBe('clm-001');
        expect(result.data.paid_amount).toBe(1200);
        expect(result.data.adjustment_amount).toBe(300);
        expect(result.data.match_method).toBe('auto');
        expect(result.data.match_confidence).toBe(0.95);
        expect(result.data.adjustment_reason_codes).toHaveLength(1);
        expect(result.data.adjustment_reason_codes[0].code).toBe('CO-45');
      }
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'ERA_PAYMENT_POSTED',
        true,
        expect.objectContaining({
          claimId: 'clm-001',
          paidAmount: 1200,
          matchMethod: 'auto',
        }),
      );
    });

    it('returns NOT_FOUND when claim does not exist', async () => {
      const chain = createChainBuilder({ data: null, error: null });
      (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });
      fromCallResults.push(chain);

      const result = await eraPaymentPostingService.postPayment(VALID_POST_REQUEST);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toBe('Claim not found');
      }
    });

    it('returns INVALID_STATE when claim status is not eligible for posting', async () => {
      fromCallResults.push(createChainBuilder({ data: { id: 'clm-001', status: 'denied' }, error: null }));

      const result = await eraPaymentPostingService.postPayment(VALID_POST_REQUEST);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_STATE');
        expect(result.error.message).toContain('denied');
        expect(result.error.message).toContain('not eligible');
      }
    });

    it('allows posting to a claim already in paid status', async () => {
      fromCallResults.push(createChainBuilder({ data: { id: 'clm-001', status: 'paid' }, error: null }));
      fromCallResults.push(createChainBuilder({ data: PAYMENT_ROW, error: null }));
      fromCallResults.push(createChainBuilder({ data: null, error: null }));
      fromCallResults.push(createChainBuilder({ data: null, error: null }));

      const result = await eraPaymentPostingService.postPayment(VALID_POST_REQUEST);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paid_amount).toBe(1200);
      }
    });

    it('returns DATABASE_ERROR when payment insert fails', async () => {
      fromCallResults.push(createChainBuilder({ data: { id: 'clm-001', status: 'submitted' }, error: null }));
      const insertChain = createChainBuilder({ data: null, error: null });
      (insertChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'insert failed' },
      });
      fromCallResults.push(insertChain);

      const result = await eraPaymentPostingService.postPayment(VALID_POST_REQUEST);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
        expect(result.error.message).toContain('post payment');
      }
      expect(auditLogger.error).toHaveBeenCalled();
    });

    it('posts to accepted claim status', async () => {
      fromCallResults.push(createChainBuilder({ data: { id: 'clm-001', status: 'accepted' }, error: null }));
      fromCallResults.push(createChainBuilder({ data: PAYMENT_ROW, error: null }));
      fromCallResults.push(createChainBuilder({ data: null, error: null }));
      fromCallResults.push(createChainBuilder({ data: null, error: null }));

      const result = await eraPaymentPostingService.postPayment(VALID_POST_REQUEST);

      expect(result.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // getPaymentStats
  // --------------------------------------------------------------------------

  describe('getPaymentStats', () => {
    it('aggregates payment amounts correctly', async () => {
      const today = new Date().toISOString().split('T')[0];
      const rows = [
        { id: 'p1', paid_amount: 1000, adjustment_amount: 200, patient_responsibility: 100, posted_at: `${today}T09:00:00Z` },
        { id: 'p2', paid_amount: 2500, adjustment_amount: 500, patient_responsibility: 250, posted_at: `${today}T14:00:00Z` },
        { id: 'p3', paid_amount: 750, adjustment_amount: 100, patient_responsibility: 50, posted_at: '2026-01-15T10:00:00Z' },
      ];
      // 1. Payment data query
      fromCallResults.push(createChainBuilder({ data: rows, error: null }));
      // 2-3. Calls from getUnpostedRemittances (called inside getPaymentStats)
      fromCallResults.push(chainWithLimit({ data: [], error: null }));
      fromCallResults.push(chainWithInTerminal({ data: [], error: null }));

      const result = await eraPaymentPostingService.getPaymentStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_posted).toBe(3);
        expect(result.data.total_paid_amount).toBe(4250);
        expect(result.data.total_adjustments).toBe(800);
        expect(result.data.total_patient_responsibility).toBe(400);
        expect(result.data.posted_today).toBe(2);
      }
    });

    it('returns failure when payment query errors', async () => {
      // from('claim_payments').select(...) is the terminal call — the builder
      // resolves to { data, error } when awaited via the thenable.
      fromCallResults.push(createChainBuilder({ data: null, error: { message: 'connection error' } }));

      const result = await eraPaymentPostingService.getPaymentStats();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });

    it('returns zeros when no payments exist', async () => {
      fromCallResults.push(createChainBuilder({ data: [], error: null }));
      // getUnpostedRemittances nested call
      fromCallResults.push(chainWithLimit({ data: [], error: null }));
      fromCallResults.push(chainWithInTerminal({ data: [], error: null }));

      const result = await eraPaymentPostingService.getPaymentStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_posted).toBe(0);
        expect(result.data.total_paid_amount).toBe(0);
        expect(result.data.total_adjustments).toBe(0);
        expect(result.data.posted_today).toBe(0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // getClaimPayments
  // --------------------------------------------------------------------------

  describe('getClaimPayments', () => {
    it('returns mapped payment records for a claim', async () => {
      fromCallResults.push(chainWithOrder({ data: [PAYMENT_ROW], error: null }));

      const result = await eraPaymentPostingService.getClaimPayments('clm-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('pay-001');
        expect(result.data[0].paid_amount).toBe(1200);
        expect(result.data[0].check_number).toBe('CHK-9876');
        expect(result.data[0].match_method).toBe('auto');
      }
    });

    it('returns empty array when claim has no payments', async () => {
      fromCallResults.push(chainWithOrder({ data: [], error: null }));

      const result = await eraPaymentPostingService.getClaimPayments('clm-empty');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('returns failure on database error', async () => {
      fromCallResults.push(chainWithOrder({ data: null, error: { message: 'query failed' } }));

      const result = await eraPaymentPostingService.getClaimPayments('clm-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });

    it('logs error via auditLogger when an unexpected exception occurs', async () => {
      const badChain = {
        select: vi.fn(() => { throw new Error('Unexpected crash'); }),
      };
      fromCallResults.push(badChain);

      const result = await eraPaymentPostingService.getClaimPayments('clm-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OPERATION_FAILED');
      }
      expect(auditLogger.error).toHaveBeenCalledWith(
        'ERA_CLAIM_PAYMENTS_FETCH_FAILED',
        expect.any(Error),
        expect.objectContaining({ claimId: 'clm-001' }),
      );
    });
  });

  // --------------------------------------------------------------------------
  // getMatchableClaims
  // --------------------------------------------------------------------------

  describe('getMatchableClaims', () => {
    it('returns matchable claims with correct field mapping', async () => {
      const claimRows = [
        { id: 'clm-001', control_number: 'CTL-001', total_charge: 2000, status: 'submitted', billing_payers: { name: 'Aetna' } },
        { id: 'clm-002', control_number: null, total_charge: null, status: 'accepted', billing_payers: null },
      ];
      fromCallResults.push(chainWithLimit({ data: claimRows, error: null }));

      const result = await eraPaymentPostingService.getMatchableClaims();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].claim_id).toBe('clm-001');
        expect(result.data[0].control_number).toBe('CTL-001');
        expect(result.data[0].total_charge).toBe(2000);
        expect(result.data[0].payer_name).toBe('Aetna');
        expect(result.data[1].claim_id).toBe('clm-002');
        expect(result.data[1].control_number).toBeNull();
        expect(result.data[1].total_charge).toBe(0);
        expect(result.data[1].payer_name).toBeNull();
      }
    });

    it('returns empty array when no matchable claims exist', async () => {
      fromCallResults.push(chainWithLimit({ data: [], error: null }));

      const result = await eraPaymentPostingService.getMatchableClaims();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('returns failure on database error', async () => {
      fromCallResults.push(chainWithLimit({ data: null, error: { message: 'db error' } }));

      const result = await eraPaymentPostingService.getMatchableClaims();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });
});
