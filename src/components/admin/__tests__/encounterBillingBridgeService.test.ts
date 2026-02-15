/**
 * encounterBillingBridgeService tests — validates superbill generation,
 * billing queue retrieval, state transitions, and claim linking.
 *
 * Deletion Test: Every test asserts specific data transformations, state
 * checks, or error handling that would fail if service logic were removed.
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

/** Queue of per-from()-call results. Each test pushes builders. */
let fromCallResults: Array<Record<string, unknown>> = [];

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((_table: string) => {
      if (fromCallResults.length > 0) {
        return fromCallResults.shift();
      }
      // Default: return chain that resolves to empty data
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

import { encounterBillingBridgeService } from '../../../services/encounterBillingBridgeService';
import { auditLogger } from '../../../services/auditLogger';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Creates a chain builder where .limit() resolves to the given result
 * (for queries ending with .limit()).
 */
function chainWithLimit(result: ChainResult): Record<string, unknown> {
  const chain = createChainBuilder(result);
  (chain.limit as ReturnType<typeof vi.fn>).mockResolvedValue(result);
  return chain;
}

/**
 * Creates a chain builder where the terminal .in() resolves to the given result
 * (for queries ending with .in()).
 */
function chainWithInTerminal(result: ChainResult): Record<string, unknown> {
  const chain = createChainBuilder(result);
  (chain.in as ReturnType<typeof vi.fn>).mockResolvedValue(result);
  return chain;
}

/**
 * Creates a chain builder where .order() resolves to the given result.
 */
function chainWithOrder(result: ChainResult): Record<string, unknown> {
  const chain = createChainBuilder(result);
  (chain.order as ReturnType<typeof vi.fn>).mockResolvedValue(result);
  return chain;
}

// ============================================================================
// FIXTURES
// ============================================================================

const ENCOUNTER_ROW = {
  id: 'enc-001',
  patient_id: 'pat-001',
  date_of_service: '2026-02-10',
  status: 'signed',
  signed_at: '2026-02-10T14:00:00Z',
  tenant_id: 'tenant-001',
  profiles: { first_name: 'John', last_name: 'Doe' },
  billing_providers: { organization_name: 'Acme Health' },
  encounter_diagnoses: [{ code: 'E11.9' }],
  encounter_procedures: [{ code: '99213' }],
  encounter_superbills: [{ id: 'sb-001', superbill_status: 'draft' }],
};

const SUPERBILL_ROW = {
  id: 'sb-001',
  encounter_id: 'enc-001',
  claim_id: null,
  superbill_status: 'draft',
  diagnosis_codes: [{ code: 'E11.9', description: 'Type 2 diabetes' }],
  procedure_codes: [{ code: '99213', description: 'Office visit', charge_amount: 150, units: 1 }],
  total_charge: 150,
  generated_at: '2026-02-10T15:00:00Z',
  reviewed_at: null,
  approved_by: null,
  approved_at: null,
  rejected_by: null,
  rejection_reason: null,
  notes: null,
  tenant_id: 'tenant-001',
  created_at: '2026-02-10T15:00:00Z',
  updated_at: '2026-02-10T15:00:00Z',
};

// ============================================================================
// TESTS
// ============================================================================

describe('encounterBillingBridgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallResults = [];
  });

  // --------------------------------------------------------------------------
  // getBillingQueue
  // --------------------------------------------------------------------------

  describe('getBillingQueue', () => {
    it('returns mapped billing queue encounters with superbill status', async () => {
      fromCallResults.push(chainWithLimit({ data: [ENCOUNTER_ROW], error: null }));

      const result = await encounterBillingBridgeService.getBillingQueue();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].encounter_id).toBe('enc-001');
        expect(result.data[0].patient_name).toBe('Doe, John');
        expect(result.data[0].provider_name).toBe('Acme Health');
        expect(result.data[0].diagnosis_count).toBe(1);
        expect(result.data[0].procedure_count).toBe(1);
        expect(result.data[0].superbill_id).toBe('sb-001');
        expect(result.data[0].superbill_status).toBe('draft');
      }
    });

    it('handles encounters with no superbill attached', async () => {
      const rowNoSb = { ...ENCOUNTER_ROW, encounter_superbills: [] };
      fromCallResults.push(chainWithLimit({ data: [rowNoSb], error: null }));

      const result = await encounterBillingBridgeService.getBillingQueue();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].superbill_id).toBeNull();
        expect(result.data[0].superbill_status).toBeNull();
      }
    });

    it('handles null profile by returning "Unknown" patient name', async () => {
      const rowNoProfile = { ...ENCOUNTER_ROW, profiles: null };
      fromCallResults.push(chainWithLimit({ data: [rowNoProfile], error: null }));

      const result = await encounterBillingBridgeService.getBillingQueue();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].patient_name).toBe('Unknown');
      }
    });

    it('returns failure on database error and logs via auditLogger', async () => {
      fromCallResults.push(chainWithLimit({ data: null, error: { message: 'timeout' } }));

      const result = await encounterBillingBridgeService.getBillingQueue();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
        expect(result.error.message).toBe('Failed to fetch billing queue');
      }
      expect(auditLogger.error).toHaveBeenCalled();
    });

    it('returns empty array when no billable encounters exist', async () => {
      fromCallResults.push(chainWithLimit({ data: [], error: null }));

      const result = await encounterBillingBridgeService.getBillingQueue();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // getBillingQueueStats
  // --------------------------------------------------------------------------

  describe('getBillingQueueStats', () => {
    it('returns correct counts by superbill status', async () => {
      // 1st from: encounters count query (head: true)
      fromCallResults.push(createChainBuilder({ count: 0, data: null, error: null }));
      // 2nd from: billable encounter IDs
      fromCallResults.push(chainWithInTerminal({
        data: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }, { id: 'e4' }],
        error: null,
      }));
      // 3rd from: superbill statuses
      fromCallResults.push(chainWithInTerminal({
        data: [
          { encounter_id: 'e1', superbill_status: 'draft' },
          { encounter_id: 'e2', superbill_status: 'approved' },
          { encounter_id: 'e3', superbill_status: 'claimed' },
        ],
        error: null,
      }));

      const result = await encounterBillingBridgeService.getBillingQueueStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.awaiting_superbill).toBe(1);
        expect(result.data.draft).toBe(1);
        expect(result.data.approved).toBe(1);
        expect(result.data.claimed).toBe(1);
        expect(result.data.pending_review).toBe(0);
      }
    });

    it('returns failure when billable encounters query errors', async () => {
      fromCallResults.push(createChainBuilder({ count: 0, data: null, error: null }));
      fromCallResults.push(chainWithInTerminal({ data: null, error: { message: 'db error' } }));

      const result = await encounterBillingBridgeService.getBillingQueueStats();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });

    it('returns failure when superbill status query errors', async () => {
      fromCallResults.push(createChainBuilder({ count: 0, data: null, error: null }));
      fromCallResults.push(chainWithInTerminal({ data: [{ id: 'e1' }], error: null }));
      fromCallResults.push(chainWithInTerminal({ data: null, error: { message: 'sb error' } }));

      const result = await encounterBillingBridgeService.getBillingQueueStats();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  // --------------------------------------------------------------------------
  // generateSuperbillDraft
  // --------------------------------------------------------------------------

  describe('generateSuperbillDraft', () => {
    it('generates a superbill draft from a signed encounter', async () => {
      // 1. encounters.select().eq().single()
      fromCallResults.push(createChainBuilder({
        data: { id: 'enc-001', status: 'signed', signed_at: '2026-02-10T14:00:00Z', tenant_id: 'tenant-001' },
        error: null,
      }));
      // 2. encounter_superbills.select().eq().maybeSingle()
      fromCallResults.push(createChainBuilder({ data: null, error: null }));
      // 3. encounter_diagnoses.select().eq().order()
      fromCallResults.push(chainWithOrder({
        data: [{ code: 'E11.9', sequence: 1, code_icd: { desc: 'Type 2 diabetes' } }],
        error: null,
      }));
      // 4. encounter_procedures.select().eq()
      fromCallResults.push(createChainBuilder({
        data: [{ code: '99213', charge_amount: 150, units: 1, modifiers: null, code_cpt: { short_desc: 'Office visit' } }],
        error: null,
      }));
      // 5. encounter_superbills.insert().select().single()
      fromCallResults.push(createChainBuilder({ data: SUPERBILL_ROW, error: null }));

      const result = await encounterBillingBridgeService.generateSuperbillDraft('enc-001', 'tenant-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.encounter_id).toBe('enc-001');
        expect(result.data.superbill_status).toBe('draft');
        expect(result.data.total_charge).toBe(150);
        expect(result.data.diagnosis_codes).toHaveLength(1);
        expect(result.data.diagnosis_codes[0].code).toBe('E11.9');
      }
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'SUPERBILL_GENERATED',
        true,
        expect.objectContaining({ encounterId: 'enc-001' }),
      );
    });

    it('returns NOT_FOUND when encounter does not exist', async () => {
      fromCallResults.push(createChainBuilder({ data: null, error: { message: 'not found' } }));

      const result = await encounterBillingBridgeService.generateSuperbillDraft('enc-missing', 'tenant-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toBe('Encounter not found');
      }
    });

    it('returns INVALID_STATE when encounter is not in a billable status', async () => {
      fromCallResults.push(createChainBuilder({
        data: { id: 'enc-001', status: 'draft', signed_at: null, tenant_id: 'tenant-001' },
        error: null,
      }));

      const result = await encounterBillingBridgeService.generateSuperbillDraft('enc-001', 'tenant-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_STATE');
        expect(result.error.message).toContain('draft');
      }
    });

    it('returns ALREADY_EXISTS when superbill already exists for encounter', async () => {
      fromCallResults.push(createChainBuilder({
        data: { id: 'enc-001', status: 'signed', signed_at: '2026-02-10T14:00:00Z', tenant_id: 'tenant-001' },
        error: null,
      }));
      fromCallResults.push(createChainBuilder({ data: { id: 'sb-existing' }, error: null }));

      const result = await encounterBillingBridgeService.generateSuperbillDraft('enc-001', 'tenant-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('ALREADY_EXISTS');
        expect(result.error.message).toContain('already exists');
      }
    });

    it('returns DATABASE_ERROR when superbill insert fails', async () => {
      fromCallResults.push(createChainBuilder({
        data: { id: 'enc-001', status: 'signed', signed_at: '2026-02-10T14:00:00Z', tenant_id: 'tenant-001' },
        error: null,
      }));
      fromCallResults.push(createChainBuilder({ data: null, error: null })); // no existing
      fromCallResults.push(chainWithOrder({ data: [], error: null })); // dx
      fromCallResults.push(createChainBuilder({ data: [], error: null })); // proc
      fromCallResults.push(createChainBuilder({ data: null, error: { message: 'insert failed' } })); // insert

      const result = await encounterBillingBridgeService.generateSuperbillDraft('enc-001', 'tenant-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
      expect(auditLogger.error).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // getSuperbillByEncounter
  // --------------------------------------------------------------------------

  describe('getSuperbillByEncounter', () => {
    it('returns the superbill mapped from the database row', async () => {
      fromCallResults.push(createChainBuilder({ data: SUPERBILL_ROW, error: null }));

      const result = await encounterBillingBridgeService.getSuperbillByEncounter('enc-001');

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.id).toBe('sb-001');
        expect(result.data.encounter_id).toBe('enc-001');
        expect(result.data.superbill_status).toBe('draft');
        expect(result.data.total_charge).toBe(150);
      } else {
        expect.fail('Expected superbill data to be non-null');
      }
    });

    it('returns null when no superbill exists for the encounter', async () => {
      fromCallResults.push(createChainBuilder({ data: null, error: null }));

      const result = await encounterBillingBridgeService.getSuperbillByEncounter('enc-missing');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    it('returns failure on database error', async () => {
      const chain = createChainBuilder({ data: null, error: null });
      (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'connection lost' },
      });
      fromCallResults.push(chain);

      const result = await encounterBillingBridgeService.getSuperbillByEncounter('enc-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  // --------------------------------------------------------------------------
  // linkSuperbillToClaim
  // --------------------------------------------------------------------------

  describe('linkSuperbillToClaim', () => {
    it('links an approved superbill to a claim and transitions to claimed', async () => {
      const claimedRow = { ...SUPERBILL_ROW, superbill_status: 'claimed', claim_id: 'clm-001' };
      fromCallResults.push(createChainBuilder({ data: claimedRow, error: null }));

      const result = await encounterBillingBridgeService.linkSuperbillToClaim('sb-001', 'clm-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.claim_id).toBe('clm-001');
        expect(result.data.superbill_status).toBe('claimed');
      }
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'SUPERBILL_LINKED_TO_CLAIM',
        true,
        expect.objectContaining({ superbillId: 'sb-001', claimId: 'clm-001' }),
      );
    });

    it('returns failure when superbill is not in approved status', async () => {
      const chain = createChainBuilder({ data: null, error: null });
      (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'no rows' },
      });
      fromCallResults.push(chain);

      const result = await encounterBillingBridgeService.linkSuperbillToClaim('sb-draft', 'clm-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OPERATION_FAILED');
        expect(result.error.message).toContain('approved status');
      }
    });
  });

  // --------------------------------------------------------------------------
  // submitForReview
  // --------------------------------------------------------------------------

  describe('submitForReview', () => {
    it('transitions a draft superbill to pending_review', async () => {
      const reviewRow = {
        ...SUPERBILL_ROW,
        superbill_status: 'pending_review',
        reviewed_at: '2026-02-11T10:00:00Z',
      };
      fromCallResults.push(createChainBuilder({ data: reviewRow, error: null }));

      const result = await encounterBillingBridgeService.submitForReview('sb-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.superbill_status).toBe('pending_review');
        expect(result.data.reviewed_at).not.toBeNull();
      }
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'SUPERBILL_SUBMITTED_FOR_REVIEW',
        true,
        expect.objectContaining({ superbillId: 'sb-001' }),
      );
    });

    it('returns failure when superbill is not in draft status', async () => {
      const chain = createChainBuilder({ data: null, error: null });
      (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'no rows' },
      });
      fromCallResults.push(chain);

      const result = await encounterBillingBridgeService.submitForReview('sb-approved');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OPERATION_FAILED');
        expect(result.error.message).toContain('draft status');
      }
    });

    it('logs error via auditLogger when an unexpected exception occurs', async () => {
      // Push a builder that throws when any method is called
      const badChain = {
        update: vi.fn(() => { throw new Error('Unexpected failure'); }),
        select: vi.fn(() => { throw new Error('Unexpected failure'); }),
      };
      fromCallResults.push(badChain);

      const result = await encounterBillingBridgeService.submitForReview('sb-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OPERATION_FAILED');
      }
      expect(auditLogger.error).toHaveBeenCalledWith(
        'SUPERBILL_REVIEW_SUBMIT_FAILED',
        expect.any(Error),
        expect.objectContaining({ superbillId: 'sb-001' }),
      );
    });
  });
});
