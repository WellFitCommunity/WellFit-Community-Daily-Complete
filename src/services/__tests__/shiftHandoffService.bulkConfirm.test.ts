/**
 * shiftHandoffService.bulkConfirmAutoScores tests (SH-1)
 *
 * Verifies the bulk-confirm flow now routes through the server-side
 * `bulk_nurse_review_handoff_risks` RPC instead of the direct UPDATE that
 * accepted client-supplied IDs without ownership checks.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockInfo = vi.fn().mockResolvedValue(undefined);
const mockError = vi.fn().mockResolvedValue(undefined);

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: (...args: unknown[]) => mockInfo(...args),
    warn: vi.fn().mockResolvedValue(undefined),
    error: (...args: unknown[]) => mockError(...args),
  },
}));

// Stub the modules re-exported by shiftHandoffService so importing it doesn't
// trigger their initialization.
vi.mock('../shiftHandoffScoring', () => ({
  createAutoRiskScore: vi.fn(),
  refreshAllAutoScores: vi.fn(),
}));
vi.mock('../shiftHandoffTimeTracking', () => ({
  recordHandoffTimeSavings: vi.fn(),
  getMyTimeSavings: vi.fn(),
}));

describe('shiftHandoffService.bulkConfirmAutoScores (SH-1)', () => {
  let service: typeof import('../shiftHandoffService');

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRpc.mockReset();
    mockInfo.mockClear();
    mockError.mockClear();
    service = await import('../shiftHandoffService');
  });

  it('returns zeroed result without calling the RPC when no ids are submitted', async () => {
    const result = await service.bulkConfirmAutoScores([]);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      confirmedCount: 0,
      deniedIds: [],
      denyReasons: {},
    });
  });

  it('invokes bulk_nurse_review_handoff_risks RPC with the submitted ids', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { updated_id: 'risk-1', denied_reason: null },
        { updated_id: 'risk-2', denied_reason: null },
      ],
      error: null,
    });

    await service.bulkConfirmAutoScores(['risk-1', 'risk-2']);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('bulk_nurse_review_handoff_risks', {
      p_ids: ['risk-1', 'risk-2'],
    });
  });

  it('counts successful confirmations and aggregates denied ids on partial deny', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { updated_id: 'risk-1', denied_reason: null },
        { updated_id: 'risk-2', denied_reason: 'not_owned_by_caller' },
        { updated_id: 'risk-3', denied_reason: null },
        { updated_id: 'risk-4', denied_reason: 'update_failed' },
      ],
      error: null,
    });

    const result = await service.bulkConfirmAutoScores([
      'risk-1',
      'risk-2',
      'risk-3',
      'risk-4',
    ]);

    expect(result.confirmedCount).toBe(2);
    expect(result.deniedIds).toEqual(['risk-2', 'risk-4']);
    expect(result.denyReasons).toEqual({
      'risk-2': 'not_owned_by_caller',
      'risk-4': 'update_failed',
    });
  });

  it('logs an audit entry with confirmed and denied counts', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { updated_id: 'risk-1', denied_reason: null },
        { updated_id: 'risk-2', denied_reason: 'not_owned_by_caller' },
      ],
      error: null,
    });

    await service.bulkConfirmAutoScores(['risk-1', 'risk-2']);

    expect(mockInfo).toHaveBeenCalledWith(
      'BULK_CONFIRM_HANDOFF_COMPLETED',
      expect.objectContaining({
        submittedCount: 2,
        confirmedCount: 1,
        deniedCount: 1,
      })
    );
  });

  it('throws and logs an error when the RPC returns an error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });

    await expect(
      service.bulkConfirmAutoScores(['risk-1'])
    ).rejects.toThrow(/permission denied/);

    expect(mockError).toHaveBeenCalledWith(
      'BULK_CONFIRM_FAILED',
      expect.any(Error),
      expect.objectContaining({ errorCode: '42501', submittedCount: 1 })
    );
  });

  it('handles a null data payload from the RPC without throwing', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await service.bulkConfirmAutoScores(['risk-1']);

    expect(result).toEqual({
      confirmedCount: 0,
      deniedIds: [],
      denyReasons: {},
    });
  });
});
