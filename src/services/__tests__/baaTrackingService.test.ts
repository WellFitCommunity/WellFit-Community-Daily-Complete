/**
 * BAA Tracking Service Tests
 *
 * Tests for Business Associate Agreement management (45 CFR 164.502(e)):
 * - listBAAs returns array ordered by associate name
 * - createBAA inserts record with draft status
 * - updateBAAStatus changes status and records review history
 * - getExpiringBAAs filters by date within N days
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listBAAs,
  createBAA,
  updateBAAStatus,
  getExpiringBAAs,
} from '../baaTrackingService';
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

function createChainableMock(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.not.mockReturnValue(chain);
  chain.lte.mockReturnValue(chain);
  return chain;
}

describe('baaTrackingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listBAAs', () => {
    it('returns array of BAAs ordered by associate name', async () => {
      const mockBAAs = [
        { id: 'baa-1', associate_name: 'AWS', status: 'active' },
        { id: 'baa-2', associate_name: 'Supabase', status: 'active' },
      ];

      const chain = createChainableMock({ data: mockBAAs, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await listBAAs();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].associate_name).toBe('AWS');
        expect(result.data[1].associate_name).toBe('Supabase');
      }
      expect(mockSupabase.from).toHaveBeenCalledWith('business_associate_agreements');
      expect(chain.order).toHaveBeenCalledWith('associate_name', { ascending: true });
    });

    it('returns empty array when no BAAs exist', async () => {
      const chain = createChainableMock({ data: [], error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await listBAAs();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('returns failure on database error', async () => {
      const chain = createChainableMock({
        data: null,
        error: { message: 'DB unavailable' },
      });
      mockSupabase.from.mockReturnValue(chain);

      const result = await listBAAs();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('DB unavailable');
      }
    });
  });

  describe('createBAA', () => {
    it('inserts a BAA record with draft status', async () => {
      const mockBAA = {
        id: 'baa-new',
        associate_name: 'Clearinghouse Corp',
        associate_type: 'clearinghouse',
        status: 'draft',
        tenant_id: 'tenant-1',
      };

      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const insertChain = createChainableMock({ data: mockBAA, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : insertChain;
      });

      const result = await createBAA({
        associate_name: 'Clearinghouse Corp',
        associate_type: 'clearinghouse',
        service_description: 'Claims processing',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.associate_name).toBe('Clearinghouse Corp');
        expect(result.data.status).toBe('draft');
      }
      expect(auditLogger.info).toHaveBeenCalledWith(
        'BAA_CREATED',
        expect.objectContaining({ associateName: 'Clearinghouse Corp' })
      );
    });

    it('returns failure when no tenant context', async () => {
      const profileChain = createChainableMock({ data: null, error: null });
      mockSupabase.from.mockReturnValue(profileChain);

      const result = await createBAA({
        associate_name: 'Test Vendor',
        associate_type: 'vendor',
        service_description: 'Testing',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });
  });

  describe('updateBAAStatus', () => {
    it('changes status and records review history', async () => {
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const fetchChain = createChainableMock({
        data: { status: 'draft' },
        error: null,
      });
      const updateChain = createChainableMock({
        data: { id: 'baa-1', status: 'active', associate_name: 'AWS' },
        error: null,
      });
      const reviewChain = createChainableMock({ data: null, error: null });
      reviewChain.insert.mockResolvedValue({ error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return profileChain; // profiles
        if (callCount === 2) return fetchChain; // fetch current status
        if (callCount === 3) return updateChain; // update BAA
        return reviewChain; // insert review history
      });

      const result = await updateBAAStatus(
        'baa-1',
        'active',
        'initial_review',
        'Approved by compliance team'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('active');
      }
      expect(auditLogger.info).toHaveBeenCalledWith(
        'BAA_STATUS_UPDATED',
        expect.objectContaining({
          baaId: 'baa-1',
          previousStatus: 'draft',
          newStatus: 'active',
          reviewType: 'initial_review',
        })
      );
    });

    it('returns failure when BAA not found', async () => {
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const fetchChain = createChainableMock({
        data: null,
        error: { message: 'BAA not found' },
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : fetchChain;
      });

      const result = await updateBAAStatus('nonexistent', 'active', 'initial_review');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('getExpiringBAAs', () => {
    it('returns BAAs expiring within specified days', async () => {
      const expiringBAAs = [
        {
          id: 'baa-exp-1',
          associate_name: 'Expiring Vendor',
          status: 'active',
          expiration_date: '2026-04-01',
        },
      ];

      const chain = createChainableMock({ data: expiringBAAs, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await getExpiringBAAs(90);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].associate_name).toBe('Expiring Vendor');
      }
      expect(chain.eq).toHaveBeenCalledWith('status', 'active');
      expect(chain.order).toHaveBeenCalledWith('expiration_date', { ascending: true });
    });

    it('returns empty array when no BAAs are expiring', async () => {
      const chain = createChainableMock({ data: [], error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await getExpiringBAAs(30);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('defaults to 90 days when no parameter provided', async () => {
      const chain = createChainableMock({ data: [], error: null });
      mockSupabase.from.mockReturnValue(chain);

      await getExpiringBAAs();

      expect(mockSupabase.from).toHaveBeenCalledWith('business_associate_agreements');
    });
  });
});
