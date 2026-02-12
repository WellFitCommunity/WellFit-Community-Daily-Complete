/**
 * Billing Gate Service Tests
 *
 * Tests the bill-unsigned-note gate: encounters cannot advance to
 * signed/ready_for_billing/billed without locked+signed clinical notes.
 *
 * Deletion Test: If the billing gate logic were removed, ALL tests
 * would fail because they test actual validation behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    clinical: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    info: vi.fn().mockResolvedValue(undefined),
  },
}));

import { billingGateService } from '../billingGateService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

// ----------------------------------------------------------------
// getNoteSignatureStatus tests
// ----------------------------------------------------------------

describe('billingGateService.getNoteSignatureStatus', () => {
  const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all-signed when every note is locked with signature', async () => {
    const mockNotes = [
      { id: 'note-1', type: 'subjective', is_locked: true, signature_hash: 'abc123', locked_by: 'doc-1', locked_at: '2026-02-12T00:00:00Z' },
      { id: 'note-2', type: 'assessment', is_locked: true, signature_hash: 'def456', locked_by: 'doc-1', locked_at: '2026-02-12T00:01:00Z' },
    ];

    const mockEq = vi.fn().mockResolvedValueOnce({ data: mockNotes, error: null });
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await billingGateService.getNoteSignatureStatus('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total_notes).toBe(2);
      expect(result.data.signed_notes).toBe(2);
      expect(result.data.unsigned_notes).toBe(0);
      expect(result.data.all_signed).toBe(true);
    }
  });

  it('returns not-all-signed when some notes lack signature', async () => {
    const mockNotes = [
      { id: 'note-1', type: 'subjective', is_locked: true, signature_hash: 'abc123', locked_by: 'doc-1', locked_at: '2026-02-12T00:00:00Z' },
      { id: 'note-2', type: 'plan', is_locked: false, signature_hash: null, locked_by: null, locked_at: null },
    ];

    const mockEq = vi.fn().mockResolvedValueOnce({ data: mockNotes, error: null });
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await billingGateService.getNoteSignatureStatus('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total_notes).toBe(2);
      expect(result.data.signed_notes).toBe(1);
      expect(result.data.unsigned_notes).toBe(1);
      expect(result.data.all_signed).toBe(false);
    }
  });

  it('returns not-all-signed when notes are locked but no signature hash', async () => {
    const mockNotes = [
      { id: 'note-1', type: 'subjective', is_locked: true, signature_hash: null, locked_by: 'doc-1', locked_at: '2026-02-12T00:00:00Z' },
    ];

    const mockEq = vi.fn().mockResolvedValueOnce({ data: mockNotes, error: null });
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await billingGateService.getNoteSignatureStatus('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.signed_notes).toBe(0);
      expect(result.data.unsigned_notes).toBe(1);
      expect(result.data.all_signed).toBe(false);
    }
  });

  it('returns zero counts when encounter has no notes', async () => {
    const mockEq = vi.fn().mockResolvedValueOnce({ data: [], error: null });
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await billingGateService.getNoteSignatureStatus('enc-empty');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total_notes).toBe(0);
      expect(result.data.signed_notes).toBe(0);
      expect(result.data.all_signed).toBe(false);
    }
  });

  it('returns failure for missing encounter ID', async () => {
    const result = await billingGateService.getNoteSignatureStatus('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });

  it('returns failure on database error', async () => {
    const mockEq = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'Connection error' } });
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await billingGateService.getNoteSignatureStatus('enc-123');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('DATABASE_ERROR');
    }
  });
});

// ----------------------------------------------------------------
// canAdvanceToState tests
// ----------------------------------------------------------------

describe('billingGateService.canAdvanceToState', () => {
  const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows non-gated states without checking notes', async () => {
    const result = await billingGateService.canAdvanceToState('enc-123', 'scheduled');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allowed).toBe(true);
    }
    // Should not have queried the database
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('allows draft, arrived, triaged, in_progress, ready_for_sign without note check', async () => {
    for (const status of ['draft', 'arrived', 'triaged', 'in_progress', 'ready_for_sign', 'cancelled', 'no_show'] as const) {
      vi.clearAllMocks();
      const result = await billingGateService.canAdvanceToState('enc-123', status);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowed).toBe(true);
      }
    }
  });

  it('blocks signed transition when no notes exist', async () => {
    const mockEq = vi.fn().mockResolvedValueOnce({ data: [], error: null });
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await billingGateService.canAdvanceToState('enc-123', 'signed');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allowed).toBe(false);
      expect(result.data.reason).toContain('clinical note is required');
    }
    expect(auditLogger.clinical).toHaveBeenCalledWith(
      'BILLING_GATE_BLOCKED',
      false,
      expect.objectContaining({
        encounter_id: 'enc-123',
        target_status: 'signed',
        reason: 'no_clinical_notes',
      })
    );
  });

  it('blocks signed transition when notes exist but are unsigned', async () => {
    const mockNotes = [
      { id: 'note-1', type: 'subjective', is_locked: false, signature_hash: null, locked_by: null, locked_at: null },
    ];

    const mockEq = vi.fn().mockResolvedValueOnce({ data: mockNotes, error: null });
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await billingGateService.canAdvanceToState('enc-123', 'signed');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allowed).toBe(false);
      expect(result.data.reason).toContain('must be signed');
    }
  });

  it('allows signed transition when all notes are locked with signature', async () => {
    const mockNotes = [
      { id: 'note-1', type: 'subjective', is_locked: true, signature_hash: 'abc123', locked_by: 'doc-1', locked_at: '2026-02-12T00:00:00Z' },
    ];

    const mockEq = vi.fn().mockResolvedValueOnce({ data: mockNotes, error: null });
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await billingGateService.canAdvanceToState('enc-123', 'signed');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allowed).toBe(true);
      expect(result.data.reason).toBeUndefined();
    }
  });

  it('blocks ready_for_billing transition when notes are unsigned', async () => {
    const mockNotes = [
      { id: 'note-1', type: 'assessment', is_locked: false, signature_hash: null, locked_by: null, locked_at: null },
    ];

    const mockEq = vi.fn().mockResolvedValueOnce({ data: mockNotes, error: null });
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await billingGateService.canAdvanceToState('enc-123', 'ready_for_billing');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allowed).toBe(false);
    }
  });

  it('blocks billed transition when notes are unsigned', async () => {
    const mockNotes = [
      { id: 'note-1', type: 'plan', is_locked: true, signature_hash: null, locked_by: 'doc-1', locked_at: '2026-02-12T00:00:00Z' },
    ];

    const mockEq = vi.fn().mockResolvedValueOnce({ data: mockNotes, error: null });
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await billingGateService.canAdvanceToState('enc-123', 'billed');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allowed).toBe(false);
      expect(result.data.reason).toContain('must be signed');
    }
  });

  it('returns failure for missing encounter ID', async () => {
    const result = await billingGateService.canAdvanceToState('', 'signed');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });
});

// ----------------------------------------------------------------
// validateBillingReadiness tests
// ----------------------------------------------------------------

describe('billingGateService.validateBillingReadiness', () => {
  const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ready when all notes signed and provider assigned', async () => {
    const mockNotes = [
      { id: 'note-1', type: 'subjective', is_locked: true, signature_hash: 'abc', locked_by: 'doc-1', locked_at: '2026-02-12T00:00:00Z' },
    ];

    // First call: getNoteSignatureStatus
    const mockEq1 = vi.fn().mockResolvedValueOnce({ data: mockNotes, error: null });
    const mockSelect1 = vi.fn(() => ({ eq: mockEq1 }));
    mockFrom.mockReturnValueOnce({ select: mockSelect1 });

    // Second call: check encounter provider
    const mockSingle = vi.fn().mockResolvedValueOnce({ data: { provider_id: 'prov-1', status: 'signed' }, error: null });
    const mockEq2 = vi.fn(() => ({ single: mockSingle }));
    const mockSelect2 = vi.fn(() => ({ eq: mockEq2 }));
    mockFrom.mockReturnValueOnce({ select: mockSelect2 });

    const result = await billingGateService.validateBillingReadiness('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ready).toBe(true);
      expect(result.data.blockers).toHaveLength(0);
    }
  });

  it('returns blockers when no notes exist', async () => {
    // Notes query: empty
    const mockEq1 = vi.fn().mockResolvedValueOnce({ data: [], error: null });
    const mockSelect1 = vi.fn(() => ({ eq: mockEq1 }));
    mockFrom.mockReturnValueOnce({ select: mockSelect1 });

    // Encounter query
    const mockSingle = vi.fn().mockResolvedValueOnce({ data: { provider_id: 'prov-1', status: 'in_progress' }, error: null });
    const mockEq2 = vi.fn(() => ({ single: mockSingle }));
    const mockSelect2 = vi.fn(() => ({ eq: mockEq2 }));
    mockFrom.mockReturnValueOnce({ select: mockSelect2 });

    const result = await billingGateService.validateBillingReadiness('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ready).toBe(false);
      expect(result.data.blockers).toContain('No clinical notes exist for this encounter');
    }
  });

  it('returns blockers when notes exist but are not signed', async () => {
    const mockNotes = [
      { id: 'note-1', type: 'subjective', is_locked: false, signature_hash: null, locked_by: null, locked_at: null },
      { id: 'note-2', type: 'plan', is_locked: false, signature_hash: null, locked_by: null, locked_at: null },
    ];

    const mockEq1 = vi.fn().mockResolvedValueOnce({ data: mockNotes, error: null });
    const mockSelect1 = vi.fn(() => ({ eq: mockEq1 }));
    mockFrom.mockReturnValueOnce({ select: mockSelect1 });

    const mockSingle = vi.fn().mockResolvedValueOnce({ data: { provider_id: 'prov-1', status: 'in_progress' }, error: null });
    const mockEq2 = vi.fn(() => ({ single: mockSingle }));
    const mockSelect2 = vi.fn(() => ({ eq: mockEq2 }));
    mockFrom.mockReturnValueOnce({ select: mockSelect2 });

    const result = await billingGateService.validateBillingReadiness('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ready).toBe(false);
      expect(result.data.blockers[0]).toContain('2 of 2 clinical note(s) are not signed');
    }
  });

  it('returns blockers when no provider assigned', async () => {
    const mockNotes = [
      { id: 'note-1', type: 'subjective', is_locked: true, signature_hash: 'abc', locked_by: 'doc-1', locked_at: '2026-02-12T00:00:00Z' },
    ];

    const mockEq1 = vi.fn().mockResolvedValueOnce({ data: mockNotes, error: null });
    const mockSelect1 = vi.fn(() => ({ eq: mockEq1 }));
    mockFrom.mockReturnValueOnce({ select: mockSelect1 });

    const mockSingle = vi.fn().mockResolvedValueOnce({ data: { provider_id: null, status: 'in_progress' }, error: null });
    const mockEq2 = vi.fn(() => ({ single: mockSingle }));
    const mockSelect2 = vi.fn(() => ({ eq: mockEq2 }));
    mockFrom.mockReturnValueOnce({ select: mockSelect2 });

    const result = await billingGateService.validateBillingReadiness('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ready).toBe(false);
      expect(result.data.blockers).toContain('No attending provider assigned');
    }
  });

  it('returns multiple blockers when multiple issues exist', async () => {
    // No notes
    const mockEq1 = vi.fn().mockResolvedValueOnce({ data: [], error: null });
    const mockSelect1 = vi.fn(() => ({ eq: mockEq1 }));
    mockFrom.mockReturnValueOnce({ select: mockSelect1 });

    // No provider
    const mockSingle = vi.fn().mockResolvedValueOnce({ data: { provider_id: null, status: 'draft' }, error: null });
    const mockEq2 = vi.fn(() => ({ single: mockSingle }));
    const mockSelect2 = vi.fn(() => ({ eq: mockEq2 }));
    mockFrom.mockReturnValueOnce({ select: mockSelect2 });

    const result = await billingGateService.validateBillingReadiness('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ready).toBe(false);
      expect(result.data.blockers.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('returns failure for missing encounter ID', async () => {
    const result = await billingGateService.validateBillingReadiness('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });
});
