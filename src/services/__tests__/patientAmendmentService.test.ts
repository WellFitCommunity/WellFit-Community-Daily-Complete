/**
 * Patient Amendment Service Tests
 *
 * Tests for patient-initiated amendment requests (45 CFR 164.526):
 * - submitAmendmentRequest creates request with 60-day deadline
 * - getMyAmendmentRequests returns patient's requests
 * - reviewAmendmentRequest sets decision and records reviewer
 * - fileDisagreementStatement updates request with patient's response
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  submitAmendmentRequest,
  getMyAmendmentRequests,
  reviewAmendmentRequest,
  fileDisagreementStatement,
} from '../patientAmendmentService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

vi.mock('../../lib/supabaseClient', () => {
  const mockFrom = vi.fn();
  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'patient-789' } },
        }),
      },
    },
  };
});

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    security: vi.fn().mockResolvedValue(undefined),
    phi: vi.fn().mockResolvedValue(undefined),
    clinical: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  auth: { getUser: ReturnType<typeof vi.fn> };
};

function createChainableMock(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  return chain;
}

describe('patientAmendmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitAmendmentRequest', () => {
    it('creates request with 60-day response deadline', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const mockRequest = {
        id: 'amend-1',
        patient_id: 'patient-789',
        record_type: 'medications',
        record_description: 'Metformin dosage incorrect',
        requested_value: '500mg twice daily',
        reason: 'Prescription was updated in January',
        status: 'submitted',
        response_deadline: new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const insertChain = createChainableMock({ data: mockRequest, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : insertChain;
      });

      const result = await submitAmendmentRequest({
        record_type: 'medications',
        record_description: 'Metformin dosage incorrect',
        requested_value: '500mg twice daily',
        reason: 'Prescription was updated in January',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('submitted');
        expect(result.data.record_type).toBe('medications');
        // Verify deadline is approximately 60 days from now
        const deadlineMs = new Date(result.data.response_deadline).getTime();
        const expectedDeadlineMs = now + 60 * 24 * 60 * 60 * 1000;
        expect(Math.abs(deadlineMs - expectedDeadlineMs)).toBeLessThan(1000);
      }
      expect(auditLogger.phi).toHaveBeenCalledWith(
        'PATIENT_AMENDMENT_REQUESTED',
        'patient-789',
        expect.objectContaining({ recordType: 'medications' })
      );

      vi.restoreAllMocks();
    });

    it('returns failure when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
      });
      // getTenantId also calls getUser, so mock for that
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
      });
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      mockSupabase.from.mockReturnValue(profileChain);

      const result = await submitAmendmentRequest({
        record_type: 'demographics',
        record_description: 'Name spelling',
        requested_value: 'Correct spelling',
        reason: 'Typo',
      });

      // Should fail since user is null (either UNAUTHORIZED from tenant or user check)
      expect(result.success).toBe(false);
    });
  });

  describe('getMyAmendmentRequests', () => {
    it('returns patient requests ordered by creation date', async () => {
      const mockRequests = [
        { id: 'amend-2', record_description: 'Recent request', created_at: '2026-02-09' },
        { id: 'amend-1', record_description: 'Older request', created_at: '2026-01-15' },
      ];

      const chain = createChainableMock({ data: mockRequests, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await getMyAmendmentRequests();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].record_description).toBe('Recent request');
      }
      expect(mockSupabase.from).toHaveBeenCalledWith('patient_amendment_requests');
      expect(chain.eq).toHaveBeenCalledWith('patient_id', 'patient-789');
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('returns empty array when patient has no requests', async () => {
      const chain = createChainableMock({ data: [], error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await getMyAmendmentRequests();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });
  });

  describe('reviewAmendmentRequest', () => {
    it('sets accepted decision and records reviewer', async () => {
      const mockResult = {
        id: 'amend-1',
        patient_id: 'patient-789',
        status: 'accepted',
        review_decision: 'accepted',
        reviewed_by: 'patient-789',
        reviewed_at: '2026-02-10T10:00:00.000Z',
      };

      const chain = createChainableMock({ data: mockResult, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await reviewAmendmentRequest({
        request_id: 'amend-1',
        decision: 'accepted',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('accepted');
        expect(result.data.review_decision).toBe('accepted');
        expect(result.data.reviewed_by).toBe('patient-789');
      }
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'AMENDMENT_ACCEPTED',
        true,
        expect.objectContaining({ requestId: 'amend-1' })
      );
    });

    it('sets denied decision with denial reason', async () => {
      const mockResult = {
        id: 'amend-2',
        patient_id: 'patient-789',
        status: 'denied',
        review_decision: 'denied',
        denial_reason: 'Information is already accurate',
      };

      const chain = createChainableMock({ data: mockResult, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await reviewAmendmentRequest({
        request_id: 'amend-2',
        decision: 'denied',
        denial_reason: 'Information is already accurate',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.review_decision).toBe('denied');
        expect(result.data.denial_reason).toBe('Information is already accurate');
      }
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'AMENDMENT_DENIED',
        true,
        expect.objectContaining({ requestId: 'amend-2' })
      );
    });
  });

  describe('fileDisagreementStatement', () => {
    it('updates request with disagreement statement and timestamp', async () => {
      const mockResult = {
        id: 'amend-2',
        patient_id: 'patient-789',
        disagreement_statement: 'I disagree with the denial because the data is wrong.',
        disagreement_filed_at: '2026-02-10T12:00:00.000Z',
      };

      const chain = createChainableMock({ data: mockResult, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await fileDisagreementStatement(
        'amend-2',
        'I disagree with the denial because the data is wrong.'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.disagreement_statement).toBe(
          'I disagree with the denial because the data is wrong.'
        );
        expect(result.data.disagreement_filed_at).toBeTruthy();
      }
      expect(mockSupabase.from).toHaveBeenCalledWith('patient_amendment_requests');
      expect(chain.eq).toHaveBeenCalledWith('patient_id', 'patient-789');
      expect(auditLogger.phi).toHaveBeenCalledWith(
        'AMENDMENT_DISAGREEMENT_FILED',
        'patient-789',
        expect.objectContaining({ requestId: 'amend-2' })
      );
    });

    it('returns failure when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
      });

      const result = await fileDisagreementStatement('amend-2', 'Statement');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });
  });
});
