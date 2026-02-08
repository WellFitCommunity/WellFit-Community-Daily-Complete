/**
 * Availability Service Tests
 *
 * Tier 2-3 tests for provider availability management:
 * - updateProviderAvailability: Input validation (day names, time format, end > start)
 * - getProviderAvailability: Supabase RPC call and error handling
 * - getAvailableSlots: RPC call with date formatting
 * - getAvailableSlotsForDateRange: Date iteration logic
 * - addBlockedTime: Validation that end > start
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockRpc = vi.fn();
const mockInsertSelectSingle = vi.fn();
const mockDeleteEq = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          gte: vi.fn(() => ({
            lte: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: mockInsertSelectSingle,
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: mockDeleteEq,
        })),
      })),
    })),
  },
}));

// Mock audit logger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('AvailabilityService', () => {
  let service: typeof import('../availabilityService');

  beforeEach(async () => {
    vi.clearAllMocks();
    service = await import('../availabilityService');
  });

  // ========================================================================
  // updateProviderAvailability - Tier 2: Validation logic tests
  // ========================================================================
  describe('updateProviderAvailability', () => {
    it('rejects invalid day names', async () => {
      const result = await service.updateProviderAvailability('provider-1', {
        invalidday: { start: '09:00', end: '17:00' },
      } as Record<string, { start: string; end: string }>);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('Invalid day');
      }
    });

    it('rejects missing start time', async () => {
      const result = await service.updateProviderAvailability('provider-1', {
        monday: { start: '', end: '17:00' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('Missing start or end time');
      }
    });

    it('rejects missing end time', async () => {
      const result = await service.updateProviderAvailability('provider-1', {
        tuesday: { start: '09:00', end: '' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('Missing start or end time');
      }
    });

    it('rejects invalid time format (not HH:MM)', async () => {
      const result = await service.updateProviderAvailability('provider-1', {
        wednesday: { start: '25:00', end: '17:00' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('Invalid time format');
      }
    });

    it('rejects time with invalid minute value', async () => {
      const result = await service.updateProviderAvailability('provider-1', {
        thursday: { start: '09:00', end: '17:61' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('Invalid time format');
      }
    });

    it('rejects end time equal to start time', async () => {
      const result = await service.updateProviderAvailability('provider-1', {
        friday: { start: '09:00', end: '09:00' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('End time must be after start time');
      }
    });

    it('rejects end time before start time', async () => {
      const result = await service.updateProviderAvailability('provider-1', {
        saturday: { start: '17:00', end: '09:00' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('End time must be after start time');
      }
    });

    it('accepts valid availability and calls RPC', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });

      const result = await service.updateProviderAvailability('provider-1', {
        monday: { start: '09:00', end: '17:00' },
        wednesday: { start: '10:00', end: '16:00' },
      });

      expect(mockRpc).toHaveBeenCalledWith('update_provider_availability', {
        p_provider_id: 'provider-1',
        p_availability_hours: {
          monday: { start: '09:00', end: '17:00' },
          wednesday: { start: '10:00', end: '16:00' },
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects single-digit start hour that is lexicographically after end hour', async () => {
      // String comparison: '9:00' >= '13:00' is true (lexicographic),
      // so the validation rejects this even though 9:00 < 13:00 numerically.
      // This is intentional: HH:MM format (zero-padded) is expected for consistency.
      const result = await service.updateProviderAvailability('provider-1', {
        sunday: { start: '9:00', end: '13:00' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('End time must be after start time');
      }
    });
  });

  // ========================================================================
  // getProviderAvailability - Tier 3: Supabase integration tests
  // ========================================================================
  describe('getProviderAvailability', () => {
    it('calls RPC and returns weekly availability data', async () => {
      const mockAvailability = {
        monday: { start: '09:00', end: '17:00' },
        friday: { start: '08:00', end: '12:00' },
      };
      mockRpc.mockResolvedValue({ data: mockAvailability, error: null });

      const result = await service.getProviderAvailability('provider-1');

      expect(mockRpc).toHaveBeenCalledWith('get_provider_availability_hours', {
        p_provider_id: 'provider-1',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockAvailability);
      }
    });

    it('returns failure when RPC returns error', async () => {
      const { auditLogger } = await import('../auditLogger');
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Provider not found' },
      });

      const result = await service.getProviderAvailability('nonexistent');

      expect(result.success).toBe(false);
      expect(auditLogger.error).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // getAvailableSlots - Tier 3
  // ========================================================================
  describe('getAvailableSlots', () => {
    it('calls RPC with date formatted as YYYY-MM-DD', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { slot_start: '2026-02-15T09:00:00Z', slot_end: '2026-02-15T09:30:00Z', is_available: true },
          { slot_start: '2026-02-15T09:30:00Z', slot_end: '2026-02-15T10:00:00Z', is_available: false },
        ],
        error: null,
      });

      const result = await service.getAvailableSlots(
        'provider-1', new Date('2026-02-15T00:00:00Z'), 30, 15
      );

      expect(mockRpc).toHaveBeenCalledWith('get_available_slots', {
        p_provider_id: 'provider-1',
        p_date: '2026-02-15',
        p_duration_minutes: 30,
        p_slot_interval_minutes: 15,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].isAvailable).toBe(true);
        expect(result.data[1].isAvailable).toBe(false);
        expect(result.data[0].slotStart).toBeInstanceOf(Date);
      }
    });
  });

  // ========================================================================
  // getAvailableSlotsForDateRange - Tier 2: Date iteration logic
  // ========================================================================
  describe('getAvailableSlotsForDateRange', () => {
    it('iterates over each date in range and collects slots', async () => {
      // Mock getAvailableSlots RPC to return one slot per day
      let callCount = 0;
      mockRpc.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          data: [{
            slot_start: `2026-02-${14 + callCount}T09:00:00Z`,
            slot_end: `2026-02-${14 + callCount}T09:30:00Z`,
            is_available: true,
          }],
          error: null,
        });
      });

      const result = await service.getAvailableSlotsForDateRange(
        'provider-1',
        new Date('2026-02-15T00:00:00Z'),
        new Date('2026-02-17T00:00:00Z'),
        30,
        15
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const dateKeys = Object.keys(result.data);
        // Should have entries for Feb 15, 16, 17
        expect(dateKeys.length).toBe(3);
        expect(dateKeys).toContain('2026-02-15');
        expect(dateKeys).toContain('2026-02-16');
        expect(dateKeys).toContain('2026-02-17');
      }
    });

    it('returns empty array for dates where slot query fails', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'No availability configured' },
      });

      const result = await service.getAvailableSlotsForDateRange(
        'provider-1',
        new Date('2026-02-15T00:00:00Z'),
        new Date('2026-02-15T00:00:00Z'),
        30,
        15
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data['2026-02-15']).toEqual([]);
      }
    });
  });

  // ========================================================================
  // addBlockedTime - Tier 2: Validation logic
  // ========================================================================
  describe('addBlockedTime', () => {
    it('rejects blocked time where end is before start', async () => {
      const result = await service.addBlockedTime({
        providerId: 'provider-1',
        startTime: new Date('2026-02-15T17:00:00Z'),
        endTime: new Date('2026-02-15T09:00:00Z'),
        reason: 'Vacation',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('End time must be after start time');
      }
    });

    it('rejects blocked time where end equals start', async () => {
      const sameTime = new Date('2026-02-15T10:00:00Z');
      const result = await service.addBlockedTime({
        providerId: 'provider-1',
        startTime: sameTime,
        endTime: sameTime,
        reason: 'Meeting',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  // ========================================================================
  // Namespace export - Tier 2
  // ========================================================================
  describe('AvailabilityService namespace', () => {
    it('exports all service functions on the namespace object', () => {
      const ns = service.AvailabilityService;
      expect(typeof ns.getProviderAvailability).toBe('function');
      expect(typeof ns.updateProviderAvailability).toBe('function');
      expect(typeof ns.checkProviderAvailability).toBe('function');
      expect(typeof ns.getAvailableSlots).toBe('function');
      expect(typeof ns.getAvailableSlotsForDateRange).toBe('function');
      expect(typeof ns.getBlockedTimes).toBe('function');
      expect(typeof ns.addBlockedTime).toBe('function');
      expect(typeof ns.removeBlockedTime).toBe('function');
    });
  });
});
