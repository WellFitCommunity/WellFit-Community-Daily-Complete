/**
 * Encounter Provider Audit Trail Tests
 *
 * Tests the provider assignment audit trail retrieval.
 *
 * Deletion Test: If the audit trail service logic were removed,
 * these tests would fail because they verify actual data retrieval.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(),
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

import { encounterProviderService } from '../encounterProviderService';
import { supabase } from '../../lib/supabaseClient';

describe('encounterProviderService.getProviderAuditTrail', () => {
  const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns audit entries for encounter', async () => {
    const mockAudit = [
      { id: 'audit-1', action: 'assigned', role: 'attending', changed_at: '2026-02-12T00:00:00Z' },
      { id: 'audit-2', action: 'assigned', role: 'consulting', changed_at: '2026-02-12T01:00:00Z' },
    ];

    const mockOrder = vi.fn().mockResolvedValueOnce({ data: mockAudit, error: null });
    const mockEq = vi.fn(() => ({ order: mockOrder }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await encounterProviderService.getProviderAuditTrail('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].action).toBe('assigned');
    }
  });

  it('returns failure for missing encounter ID', async () => {
    const result = await encounterProviderService.getProviderAuditTrail('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });

  it('returns empty array when no audit entries exist', async () => {
    const mockOrder = vi.fn().mockResolvedValueOnce({ data: [], error: null });
    const mockEq = vi.fn(() => ({ order: mockOrder }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await encounterProviderService.getProviderAuditTrail('enc-new');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });
});
