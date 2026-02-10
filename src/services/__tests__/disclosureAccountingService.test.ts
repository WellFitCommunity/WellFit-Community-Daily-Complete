/**
 * Disclosure Accounting Service Tests
 *
 * Tests for Accounting of Disclosures per 45 CFR 164.528:
 * - recordDisclosure inserts entry with correct fields
 * - getPatientDisclosures returns array for patient with date filtering
 * - getDisclosureReport returns tenant-wide filtered results
 * - getDisclosureCount returns number for patient
 * - Error handling returns failure results
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordDisclosure,
  getPatientDisclosures,
  getDisclosureReport,
  getDisclosureCount,
} from '../disclosureAccountingService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

vi.mock('../../lib/supabaseClient', () => {
  const mockFrom = vi.fn();
  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-user-1' } },
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

function createChainableMock(result: { data: unknown; error: unknown; count?: number | null }) {
  const chain = {
    select: vi.fn(),
    insert: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    // Make chain awaitable (thenable) so `await query` resolves to result
    then: (onFulfilled?: ((v: unknown) => unknown) | null, onRejected?: ((v: unknown) => unknown) | null) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.lte.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  return chain;
}

describe('disclosureAccountingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordDisclosure', () => {
    it('inserts a disclosure record with correct fields', async () => {
      const mockDisclosure = {
        id: 'disc-1',
        tenant_id: 'tenant-1',
        patient_id: 'patient-123',
        disclosed_by: 'admin-user-1',
        recipient_name: 'County Health Department',
        recipient_type: 'public_health',
        purpose: 'Mandatory disease reporting',
        phi_types_disclosed: ['diagnosis', 'lab_results'],
        disclosure_method: 'electronic',
        data_classes_disclosed: [],
        disclosure_date: '2026-02-10T00:00:00Z',
      };

      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const insertChain = createChainableMock({ data: mockDisclosure, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : insertChain;
      });

      const result = await recordDisclosure({
        patient_id: 'patient-123',
        recipient_name: 'County Health Department',
        recipient_type: 'public_health',
        purpose: 'Mandatory disease reporting',
        phi_types_disclosed: ['diagnosis', 'lab_results'],
        disclosure_method: 'electronic',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recipient_name).toBe('County Health Department');
        expect(result.data.recipient_type).toBe('public_health');
        expect(result.data.patient_id).toBe('patient-123');
      }
      expect(auditLogger.info).toHaveBeenCalledWith(
        'DISCLOSURE_RECORDED',
        expect.objectContaining({
          patientId: 'patient-123',
          recipientName: 'County Health Department',
        })
      );
    });

    it('returns failure when no tenant context', async () => {
      const profileChain = createChainableMock({ data: null, error: null });
      mockSupabase.from.mockReturnValue(profileChain);

      const result = await recordDisclosure({
        patient_id: 'patient-123',
        recipient_name: 'Test Recipient',
        recipient_type: 'other',
        purpose: 'Testing',
        phi_types_disclosed: ['demographics'],
        disclosure_method: 'electronic',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns failure on database insert error', async () => {
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const insertChain = createChainableMock({
        data: null,
        error: { message: 'Insert failed' },
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : insertChain;
      });

      const result = await recordDisclosure({
        patient_id: 'patient-123',
        recipient_name: 'Test',
        recipient_type: 'other',
        purpose: 'Test',
        phi_types_disclosed: [],
        disclosure_method: 'electronic',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Insert failed');
      }
    });
  });

  describe('getPatientDisclosures', () => {
    it('returns array of disclosures for a patient', async () => {
      const mockDisclosures = [
        {
          id: 'disc-1',
          patient_id: 'patient-123',
          recipient_name: 'Health Dept',
          disclosure_date: '2026-02-10',
        },
        {
          id: 'disc-2',
          patient_id: 'patient-123',
          recipient_name: 'Research Lab',
          disclosure_date: '2026-01-15',
        },
      ];

      const chain = createChainableMock({ data: mockDisclosures, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await getPatientDisclosures('patient-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].recipient_name).toBe('Health Dept');
        expect(result.data[1].recipient_name).toBe('Research Lab');
      }
      expect(mockSupabase.from).toHaveBeenCalledWith('disclosure_accounting');
      expect(chain.eq).toHaveBeenCalledWith('patient_id', 'patient-123');
    });

    it('applies date filters when provided', async () => {
      const chain = createChainableMock({ data: [], error: null });
      mockSupabase.from.mockReturnValue(chain);

      await getPatientDisclosures('patient-123', '2026-01-01', '2026-12-31');

      expect(chain.gte).toHaveBeenCalledWith('disclosure_date', '2026-01-01');
      expect(chain.lte).toHaveBeenCalledWith('disclosure_date', '2026-12-31');
    });

    it('returns empty array when no disclosures exist', async () => {
      const chain = createChainableMock({ data: [], error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await getPatientDisclosures('patient-no-disc');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('returns failure on database error', async () => {
      const chain = createChainableMock({
        data: null,
        error: { message: 'Query failed' },
      });
      mockSupabase.from.mockReturnValue(chain);

      const result = await getPatientDisclosures('patient-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Query failed');
      }
    });
  });

  describe('getDisclosureReport', () => {
    it('returns disclosures filtered by date range', async () => {
      const mockReport = [
        {
          id: 'disc-r1',
          recipient_name: 'State Agency',
          disclosure_date: '2026-02-01',
        },
        {
          id: 'disc-r2',
          recipient_name: 'FBI',
          disclosure_date: '2026-02-05',
        },
      ];

      const chain = createChainableMock({ data: mockReport, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await getDisclosureReport('2026-01-01', '2026-02-28');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].recipient_name).toBe('State Agency');
      }
      expect(chain.gte).toHaveBeenCalledWith('disclosure_date', '2026-01-01');
      expect(chain.lte).toHaveBeenCalledWith('disclosure_date', '2026-02-28');
      expect(auditLogger.info).toHaveBeenCalledWith(
        'DISCLOSURE_REPORT_GENERATED',
        expect.objectContaining({
          dateFrom: '2026-01-01',
          dateTo: '2026-02-28',
          totalDisclosures: 2,
        })
      );
    });

    it('returns failure on database error', async () => {
      const chain = createChainableMock({
        data: null,
        error: { message: 'Report query failed' },
      });
      mockSupabase.from.mockReturnValue(chain);

      const result = await getDisclosureReport('2026-01-01', '2026-02-28');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Report query failed');
      }
    });
  });

  describe('getDisclosureCount', () => {
    it('returns count of disclosures for a patient', async () => {
      const chain = createChainableMock({ data: null, error: null, count: 7 });
      // Override select to return count
      chain.select.mockReturnValue(chain);
      chain.eq.mockResolvedValue({ count: 7, error: null });

      mockSupabase.from.mockReturnValue(chain);

      const result = await getDisclosureCount('patient-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(7);
      }
      expect(mockSupabase.from).toHaveBeenCalledWith('disclosure_accounting');
    });

    it('returns zero when no disclosures exist', async () => {
      const chain = createChainableMock({ data: null, error: null, count: 0 });
      chain.select.mockReturnValue(chain);
      chain.eq.mockResolvedValue({ count: 0, error: null });

      mockSupabase.from.mockReturnValue(chain);

      const result = await getDisclosureCount('patient-no-data');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(0);
      }
    });

    it('returns failure on database error', async () => {
      const chain = createChainableMock({ data: null, error: null });
      chain.select.mockReturnValue(chain);
      chain.eq.mockResolvedValue({ count: null, error: { message: 'Count failed' } });

      mockSupabase.from.mockReturnValue(chain);

      const result = await getDisclosureCount('patient-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Count failed');
      }
    });
  });
});
