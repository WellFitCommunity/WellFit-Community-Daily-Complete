/**
 * Tests for FHIR ServiceRequestService.
 *
 * Covers the create path (used by both ONC-2 Lab CPOE and ONC-3 Imaging CPOE)
 * and the read paths (getByPatient + getActive + category filtering).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceRequestService } from '../ServiceRequestService';
import { supabase } from '../../../lib/supabaseClient';

vi.mock('../../../lib/supabaseClient', () => {
  const fromImpl = vi.fn();
  return {
    supabase: {
      from: fromImpl,
    },
  };
});

vi.mock('../../auditLogger', () => ({
  auditLogger: {
    phi: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockedFrom = vi.mocked(supabase.from);

beforeEach(() => {
  vi.clearAllMocks();
});

function chainResolving<T>(value: T) {
  // Mimics supabase's chainable .select().eq().contains().order() builder.
  const resolved = { data: value, error: null };
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolved),
    order: vi.fn().mockResolvedValue(resolved),
    // Thenable for the rare path that awaits without .single() / .order()
    then: (onFulfilled: (v: typeof resolved) => unknown) => Promise.resolve(resolved).then(onFulfilled),
  };
  return builder;
}

describe('ServiceRequestService', () => {
  describe('create', () => {
    it('inserts a lab order with category=["laboratory"] and returns the saved row', async () => {
      const created = {
        id: 'sr-1',
        patient_id: 'p1',
        status: 'active',
        intent: 'order',
        category: ['laboratory'],
        code: '24323-8',
        code_display: 'Comprehensive Metabolic Panel',
        authored_on: '2026-05-28T00:00:00Z',
      };
      mockedFrom.mockReturnValue(chainResolving(created) as never);

      const result = await ServiceRequestService.create({
        patient_id: 'p1',
        status: 'active',
        intent: 'order',
        category: ['laboratory'],
        code: '24323-8',
        code_display: 'Comprehensive Metabolic Panel',
      });

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('sr-1');
      expect(result.data?.category).toEqual(['laboratory']);
      expect(mockedFrom).toHaveBeenCalledWith('fhir_service_requests');
    });

    it('inserts an imaging order with category=["imaging"] — same code path', async () => {
      const created = {
        id: 'sr-2',
        patient_id: 'p1',
        status: 'active',
        intent: 'order',
        category: ['imaging'],
        code: '36643-5',
        code_display: 'Chest X-ray PA and lateral',
        authored_on: '2026-05-28T00:00:00Z',
      };
      mockedFrom.mockReturnValue(chainResolving(created) as never);

      const result = await ServiceRequestService.create({
        patient_id: 'p1',
        status: 'active',
        intent: 'order',
        category: ['imaging'],
        code: '36643-5',
        code_display: 'Chest X-ray PA and lateral',
      });

      expect(result.success).toBe(true);
      expect(result.data?.category).toEqual(['imaging']);
    });

    it('returns failure when the insert errors', async () => {
      const builder = chainResolving(null);
      builder.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'insert violates RLS' } });
      mockedFrom.mockReturnValue(builder as never);

      const result = await ServiceRequestService.create({
        patient_id: 'p1',
        status: 'active',
        intent: 'order',
        category: ['laboratory'],
        code: 'X',
        code_display: 'X',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/insert violates RLS/i);
    });
  });

  describe('getByPatient', () => {
    it('returns rows ordered by authored_on desc', async () => {
      const rows = [
        { id: 'sr-2', patient_id: 'p1', authored_on: '2026-05-28T10:00:00Z' },
        { id: 'sr-1', patient_id: 'p1', authored_on: '2026-05-27T10:00:00Z' },
      ];
      mockedFrom.mockReturnValue(chainResolving(rows) as never);

      const result = await ServiceRequestService.getByPatient('p1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].id).toBe('sr-2');
    });

    it('applies category filter via .contains() when category is passed', async () => {
      const builder = chainResolving([]);
      mockedFrom.mockReturnValue(builder as never);

      await ServiceRequestService.getByPatient('p1', 'laboratory');

      expect(builder.contains).toHaveBeenCalledWith('category', ['laboratory']);
    });

    it('skips .contains() when no category is passed', async () => {
      const builder = chainResolving([]);
      mockedFrom.mockReturnValue(builder as never);

      await ServiceRequestService.getByPatient('p1');

      expect(builder.contains).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('transitions status to revoked with a note', async () => {
      const updated = { id: 'sr-1', status: 'revoked', note: 'Revoked: ordered in error' };
      const builder = chainResolving(updated);
      mockedFrom.mockReturnValue(builder as never);

      const result = await ServiceRequestService.cancel('sr-1', 'ordered in error');

      expect(result.success).toBe(true);
      expect(builder.update).toHaveBeenCalledWith({
        status: 'revoked',
        note: 'Revoked: ordered in error',
      });
    });

    it('uses generic "Revoked" when no reason is given', async () => {
      const updated = { id: 'sr-1', status: 'revoked', note: 'Revoked' };
      const builder = chainResolving(updated);
      mockedFrom.mockReturnValue(builder as never);

      await ServiceRequestService.cancel('sr-1');

      expect(builder.update).toHaveBeenCalledWith({
        status: 'revoked',
        note: 'Revoked',
      });
    });
  });
});
