/**
 * medicationOverrideService Test Suite
 *
 * Tests validation, recording, weekly counts, and manager review.
 * Deletion Test: All tests fail if service logic is removed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { medicationOverrideService } from '../medicationOverrideService';
import type { RecordOverrideRequest } from '../medicationOverrideService';

// Mock Supabase — vi.hoisted() ensures mocks are available before vi.mock factory runs
const {
  mockInsert,
  mockSelect,
  mockSingle,
  mockUpdate,
  mockEq,
  mockOrder,
  mockLimit,
  mockRpc,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockSingle: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  mockLimit: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle,
        }),
      }),
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          order: mockOrder.mockReturnValue({
            limit: mockLimit,
          }),
        }),
      }),
      update: mockUpdate.mockReturnValue({
        eq: mockEq.mockReturnValue({
          select: mockSelect.mockReturnValue({
            single: mockSingle,
          }),
        }),
      }),
    })),
    rpc: mockRpc,
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    clinical: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const validRequest: RecordOverrideRequest = {
  alert_type: 'contraindication',
  alert_severity: 'high',
  alert_description: 'Drug X contraindicated with condition Y',
  alert_recommendations: ['Consider alternative drug Z'],
  medication_name: 'Drug X',
  provider_id: 'provider-123',
  provider_signature: 'Dr. Smith',
  patient_id: 'patient-456',
  override_reason: 'clinical_judgment',
  override_explanation: 'Patient has been on this medication for 5 years without adverse effects, benefits outweigh risks.',
};

describe('medicationOverrideService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: 2, error: null });
  });

  describe('recordOverride', () => {
    it('rejects explanation under 20 characters', async () => {
      const shortRequest = { ...validRequest, override_explanation: 'too short' };
      const result = await medicationOverrideService.recordOverride(shortRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OVERRIDE_VALIDATION_FAILED');
        expect(result.error.message).toContain('20 characters');
      }
    });

    it('rejects empty signature', async () => {
      const noSigRequest = { ...validRequest, provider_signature: '' };
      const result = await medicationOverrideService.recordOverride(noSigRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OVERRIDE_VALIDATION_FAILED');
        expect(result.error.message).toContain('signature');
      }
    });

    it('rejects whitespace-only signature', async () => {
      const spacesSigRequest = { ...validRequest, provider_signature: '   ' };
      const result = await medicationOverrideService.recordOverride(spacesSigRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OVERRIDE_VALIDATION_FAILED');
      }
    });

    it('succeeds with valid input and returns override record', async () => {
      const mockOverride = { id: 'override-1', ...validRequest, created_at: new Date().toISOString() };
      mockSingle.mockResolvedValue({ data: mockOverride, error: null });

      const result = await medicationOverrideService.recordOverride(validRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('override-1');
        expect(result.data.alert_type).toBe('contraindication');
      }
    });

    it('returns failure on database error', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'RLS denied' } });

      const result = await medicationOverrideService.recordOverride(validRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MEDICATION_OVERRIDE_FAILED');
      }
    });
  });

  describe('getProviderWeeklyCount', () => {
    it('returns count from RPC', async () => {
      mockRpc.mockResolvedValue({ data: 5, error: null });

      const result = await medicationOverrideService.getProviderWeeklyCount('provider-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(5);
      }
    });

    it('returns 0 when RPC returns non-number', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await medicationOverrideService.getProviderWeeklyCount('provider-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(0);
      }
    });

    it('returns failure on RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

      const result = await medicationOverrideService.getProviderWeeklyCount('provider-123');

      expect(result.success).toBe(false);
    });
  });

  describe('recordManagerReview', () => {
    it('updates override with review decision', async () => {
      const reviewedOverride = {
        id: 'override-1',
        reviewed_by: 'manager-1',
        reviewed_at: new Date().toISOString(),
        review_decision: 'acknowledged',
      };
      mockSingle.mockResolvedValue({ data: reviewedOverride, error: null });

      const result = await medicationOverrideService.recordManagerReview('override-1', {
        reviewed_by: 'manager-1',
        review_decision: 'acknowledged',
        review_notes: 'Reviewed and acknowledged',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.review_decision).toBe('acknowledged');
      }
    });
  });

  describe('getFlaggedProviders', () => {
    it('returns flagged providers from RPC', async () => {
      const flagged = [{ provider_id: 'p1', override_count: 4, latest_override: new Date().toISOString(), severities: ['high'] }];
      mockRpc.mockResolvedValue({ data: flagged, error: null });

      const result = await medicationOverrideService.getFlaggedProviders();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].override_count).toBe(4);
      }
    });
  });
});
