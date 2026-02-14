/**
 * billingGateService.validateSuperbillApproved Test Suite
 *
 * Tests approved/unapproved checks and error handling.
 * Deletion Test: All tests fail if validateSuperbillApproved is removed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { billingGateService } from '../billingGateService';

// Mock Supabase
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          single: mockSingle,
        }),
      }),
    })),
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    clinical: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('billingGateService — validateSuperbillApproved', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns approved=true when claim has approved status and provider', async () => {
    mockSingle.mockResolvedValue({
      data: {
        approval_status: 'approved',
        provider_approved_by: 'provider-1',
        provider_approved_at: '2026-02-16T10:00:00Z',
      },
      error: null,
    });

    const result = await billingGateService.validateSuperbillApproved('claim-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.approved).toBe(true);
      expect(result.data.approvedBy).toBe('provider-1');
      expect(result.data.approvedAt).toBe('2026-02-16T10:00:00Z');
    }
  });

  it('returns approved=false when status is pending', async () => {
    mockSingle.mockResolvedValue({
      data: {
        approval_status: 'pending',
        provider_approved_by: null,
        provider_approved_at: null,
      },
      error: null,
    });

    const result = await billingGateService.validateSuperbillApproved('claim-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.approved).toBe(false);
    }
  });

  it('returns approved=false when status is returned', async () => {
    mockSingle.mockResolvedValue({
      data: {
        approval_status: 'returned',
        provider_approved_by: null,
        provider_approved_at: null,
      },
      error: null,
    });

    const result = await billingGateService.validateSuperbillApproved('claim-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.approved).toBe(false);
    }
  });

  it('returns failure when claim ID is empty', async () => {
    const result = await billingGateService.validateSuperbillApproved('');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });

  it('returns failure on database error', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Row not found' },
    });

    const result = await billingGateService.validateSuperbillApproved('claim-1');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('DATABASE_ERROR');
    }
  });

  it('returns failure when claim is not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    const result = await billingGateService.validateSuperbillApproved('nonexistent');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns approved=false when provider_approved_by is null even if status says approved', async () => {
    mockSingle.mockResolvedValue({
      data: {
        approval_status: 'approved',
        provider_approved_by: null,
        provider_approved_at: null,
      },
      error: null,
    });

    const result = await billingGateService.validateSuperbillApproved('claim-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.approved).toBe(false);
    }
  });
});
