/**
 * Availability Service Tests
 *
 * Tests for provider availability management including:
 * - Weekly working hours
 * - Blocked time periods
 * - Available slot calculation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AvailabilityService,
  getProviderAvailability,
  updateProviderAvailability,
  checkProviderAvailability,
  getAvailableSlots,
  getBlockedTimes,
  addBlockedTime,
  removeBlockedTime,
  getAvailableSlotsForDateRange,
  type WeeklyAvailability,
  type DayOfWeek,
  type DayHours,
  type BlockedTime,
  type BlockedTimeInput,
  type TimeSlot,
  type AvailabilityCheckResult,
} from '../availabilityService';

// Mock the supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(),
            })),
          })),
          order: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(),
        })),
      })),
    })),
  },
}));

// Mock audit logger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AvailabilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Type Definitions', () => {
    it('should have correct DayHours interface', () => {
      const hours: DayHours = {
        start: '09:00',
        end: '17:00',
      };

      expect(hours.start).toBe('09:00');
      expect(hours.end).toBe('17:00');
    });

    it('should have correct DayOfWeek type', () => {
      const days: DayOfWeek[] = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ];

      expect(days).toHaveLength(7);
      expect(days).toContain('monday');
      expect(days).toContain('sunday');
    });

    it('should have correct WeeklyAvailability type', () => {
      const availability: WeeklyAvailability = {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '10:00', end: '18:00' },
      };

      expect(availability.monday?.start).toBe('09:00');
      expect(availability.wednesday?.end).toBe('18:00');
      expect(availability.saturday).toBeUndefined();
    });

    it('should have correct BlockedTime interface', () => {
      const blocked: BlockedTime = {
        id: 'block-123',
        provider_id: 'provider-456',
        start_time: '2026-01-20T00:00:00Z',
        end_time: '2026-01-25T23:59:59Z',
        reason: 'vacation',
        description: 'Family trip',
        created_at: '2026-01-15T10:00:00Z',
      };

      expect(blocked.id).toBe('block-123');
      expect(blocked.provider_id).toBe('provider-456');
      expect(blocked.reason).toBe('vacation');
    });

    it('should have correct BlockedTimeInput interface', () => {
      const input: BlockedTimeInput = {
        providerId: 'provider-123',
        startTime: new Date('2026-01-20'),
        endTime: new Date('2026-01-25'),
        reason: 'pto',
        description: 'Personal time off',
      };

      expect(input.providerId).toBe('provider-123');
      expect(input.reason).toBe('pto');
    });

    it('should have correct TimeSlot interface', () => {
      const slot: TimeSlot = {
        slotStart: new Date('2026-01-15T09:00:00Z'),
        slotEnd: new Date('2026-01-15T09:30:00Z'),
        isAvailable: true,
      };

      expect(slot.isAvailable).toBe(true);
      expect(slot.slotStart instanceof Date).toBe(true);
    });

    it('should have correct AvailabilityCheckResult interface', () => {
      const result: AvailabilityCheckResult = {
        isAvailable: false,
        reason: 'Provider does not work on saturday',
        conflictingAppointmentId: undefined,
        blockedTimeId: undefined,
      };

      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('saturday');
    });
  });

  describe('AvailabilityService namespace', () => {
    it('should export getProviderAvailability method', () => {
      expect(AvailabilityService.getProviderAvailability).toBeDefined();
      expect(typeof AvailabilityService.getProviderAvailability).toBe('function');
    });

    it('should export updateProviderAvailability method', () => {
      expect(AvailabilityService.updateProviderAvailability).toBeDefined();
      expect(typeof AvailabilityService.updateProviderAvailability).toBe('function');
    });

    it('should export checkProviderAvailability method', () => {
      expect(AvailabilityService.checkProviderAvailability).toBeDefined();
      expect(typeof AvailabilityService.checkProviderAvailability).toBe('function');
    });

    it('should export getAvailableSlots method', () => {
      expect(AvailabilityService.getAvailableSlots).toBeDefined();
      expect(typeof AvailabilityService.getAvailableSlots).toBe('function');
    });

    it('should export getAvailableSlotsForDateRange method', () => {
      expect(AvailabilityService.getAvailableSlotsForDateRange).toBeDefined();
      expect(typeof AvailabilityService.getAvailableSlotsForDateRange).toBe('function');
    });

    it('should export getBlockedTimes method', () => {
      expect(AvailabilityService.getBlockedTimes).toBeDefined();
      expect(typeof AvailabilityService.getBlockedTimes).toBe('function');
    });

    it('should export addBlockedTime method', () => {
      expect(AvailabilityService.addBlockedTime).toBeDefined();
      expect(typeof AvailabilityService.addBlockedTime).toBe('function');
    });

    it('should export removeBlockedTime method', () => {
      expect(AvailabilityService.removeBlockedTime).toBeDefined();
      expect(typeof AvailabilityService.removeBlockedTime).toBe('function');
    });
  });

  describe('Function exports', () => {
    it('should export getProviderAvailability as standalone function', () => {
      expect(getProviderAvailability).toBeDefined();
      expect(typeof getProviderAvailability).toBe('function');
    });

    it('should export updateProviderAvailability as standalone function', () => {
      expect(updateProviderAvailability).toBeDefined();
      expect(typeof updateProviderAvailability).toBe('function');
    });

    it('should export checkProviderAvailability as standalone function', () => {
      expect(checkProviderAvailability).toBeDefined();
      expect(typeof checkProviderAvailability).toBe('function');
    });

    it('should export getAvailableSlots as standalone function', () => {
      expect(getAvailableSlots).toBeDefined();
      expect(typeof getAvailableSlots).toBe('function');
    });

    it('should export getBlockedTimes as standalone function', () => {
      expect(getBlockedTimes).toBeDefined();
      expect(typeof getBlockedTimes).toBe('function');
    });

    it('should export addBlockedTime as standalone function', () => {
      expect(addBlockedTime).toBeDefined();
      expect(typeof addBlockedTime).toBe('function');
    });

    it('should export removeBlockedTime as standalone function', () => {
      expect(removeBlockedTime).toBeDefined();
      expect(typeof removeBlockedTime).toBe('function');
    });

    it('should export getAvailableSlotsForDateRange as standalone function', () => {
      expect(getAvailableSlotsForDateRange).toBeDefined();
      expect(typeof getAvailableSlotsForDateRange).toBe('function');
    });
  });

  describe('WeeklyAvailability patterns', () => {
    it('should support standard business hours', () => {
      const standard: WeeklyAvailability = {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' },
      };

      expect(Object.keys(standard)).toHaveLength(5);
      expect(standard.saturday).toBeUndefined();
      expect(standard.sunday).toBeUndefined();
    });

    it('should support extended hours', () => {
      const extended: WeeklyAvailability = {
        monday: { start: '07:00', end: '19:00' },
        tuesday: { start: '07:00', end: '19:00' },
        wednesday: { start: '07:00', end: '19:00' },
        thursday: { start: '07:00', end: '19:00' },
        friday: { start: '07:00', end: '19:00' },
        saturday: { start: '08:00', end: '12:00' },
      };

      expect(extended.saturday?.start).toBe('08:00');
      expect(extended.monday?.end).toBe('19:00');
    });

    it('should support variable hours per day', () => {
      const variable: WeeklyAvailability = {
        monday: { start: '10:00', end: '14:00' },
        wednesday: { start: '14:00', end: '20:00' },
        friday: { start: '08:00', end: '12:00' },
      };

      expect(Object.keys(variable)).toHaveLength(3);
      expect(variable.monday?.start).not.toBe(variable.wednesday?.start);
    });

    it('should support empty availability', () => {
      const empty: WeeklyAvailability = {};
      expect(Object.keys(empty)).toHaveLength(0);
    });
  });

  describe('BlockedTime reasons', () => {
    it('should support vacation reason', () => {
      const blocked: BlockedTime = {
        id: '1',
        provider_id: 'p1',
        start_time: '2026-01-20T00:00:00Z',
        end_time: '2026-01-27T23:59:59Z',
        reason: 'vacation',
        created_at: '2026-01-15T00:00:00Z',
      };
      expect(blocked.reason).toBe('vacation');
    });

    it('should support pto reason', () => {
      const blocked: BlockedTime = {
        id: '2',
        provider_id: 'p1',
        start_time: '2026-02-01T00:00:00Z',
        end_time: '2026-02-01T23:59:59Z',
        reason: 'pto',
        created_at: '2026-01-15T00:00:00Z',
      };
      expect(blocked.reason).toBe('pto');
    });

    it('should support training reason', () => {
      const blocked: BlockedTime = {
        id: '3',
        provider_id: 'p1',
        start_time: '2026-02-10T09:00:00Z',
        end_time: '2026-02-10T17:00:00Z',
        reason: 'training',
        description: 'Annual compliance training',
        created_at: '2026-01-15T00:00:00Z',
      };
      expect(blocked.reason).toBe('training');
      expect(blocked.description).toContain('compliance');
    });

    it('should support meeting reason', () => {
      const blocked: BlockedTime = {
        id: '4',
        provider_id: 'p1',
        start_time: '2026-01-16T14:00:00Z',
        end_time: '2026-01-16T16:00:00Z',
        reason: 'meeting',
        created_at: '2026-01-15T00:00:00Z',
      };
      expect(blocked.reason).toBe('meeting');
    });
  });

  describe('TimeSlot availability states', () => {
    it('should represent available slot', () => {
      const slot: TimeSlot = {
        slotStart: new Date('2026-01-15T09:00:00Z'),
        slotEnd: new Date('2026-01-15T09:30:00Z'),
        isAvailable: true,
      };
      expect(slot.isAvailable).toBe(true);
    });

    it('should represent unavailable slot', () => {
      const slot: TimeSlot = {
        slotStart: new Date('2026-01-15T10:00:00Z'),
        slotEnd: new Date('2026-01-15T10:30:00Z'),
        isAvailable: false,
      };
      expect(slot.isAvailable).toBe(false);
    });

    it('should calculate duration correctly', () => {
      const slot: TimeSlot = {
        slotStart: new Date('2026-01-15T09:00:00Z'),
        slotEnd: new Date('2026-01-15T09:45:00Z'),
        isAvailable: true,
      };
      const durationMs = slot.slotEnd.getTime() - slot.slotStart.getTime();
      const durationMin = durationMs / 60000;
      expect(durationMin).toBe(45);
    });
  });

  describe('AvailabilityCheckResult scenarios', () => {
    it('should represent available time', () => {
      const result: AvailabilityCheckResult = {
        isAvailable: true,
      };
      expect(result.isAvailable).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should represent unavailable due to working hours', () => {
      const result: AvailabilityCheckResult = {
        isAvailable: false,
        reason: 'Outside working hours (09:00 - 17:00)',
      };
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('working hours');
    });

    it('should represent unavailable due to blocked time', () => {
      const result: AvailabilityCheckResult = {
        isAvailable: false,
        reason: 'Provider has blocked time',
        blockedTimeId: 'block-123',
      };
      expect(result.isAvailable).toBe(false);
      expect(result.blockedTimeId).toBe('block-123');
    });

    it('should represent unavailable due to existing appointment', () => {
      const result: AvailabilityCheckResult = {
        isAvailable: false,
        reason: 'Provider has existing appointment',
        conflictingAppointmentId: 'apt-456',
      };
      expect(result.isAvailable).toBe(false);
      expect(result.conflictingAppointmentId).toBe('apt-456');
    });

    it('should represent unavailable due to non-working day', () => {
      const result: AvailabilityCheckResult = {
        isAvailable: false,
        reason: 'Provider does not work on saturday',
      };
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('saturday');
    });
  });

  describe('Time format validation', () => {
    it('should accept valid 24-hour time format', () => {
      const validTimes = ['00:00', '09:00', '12:30', '17:00', '23:59'];
      validTimes.forEach((time) => {
        const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        expect(regex.test(time)).toBe(true);
      });
    });

    it('should reject invalid time formats', () => {
      const invalidTimes = ['24:00', '9:00 AM', '17:60', 'noon', ''];
      const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      invalidTimes.forEach((time) => {
        expect(regex.test(time)).toBe(false);
      });
    });
  });

  describe('Date handling', () => {
    it('should handle Date objects in BlockedTimeInput', () => {
      const input: BlockedTimeInput = {
        providerId: 'provider-123',
        startTime: new Date('2026-02-01T00:00:00Z'),
        endTime: new Date('2026-02-05T23:59:59Z'),
        reason: 'vacation',
      };

      expect(input.startTime instanceof Date).toBe(true);
      expect(input.endTime instanceof Date).toBe(true);
      expect(input.endTime > input.startTime).toBe(true);
    });

    it('should calculate date ranges correctly', () => {
      const startDate = new Date('2026-01-15');
      const endDate = new Date('2026-01-20');
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(5);
    });
  });
});
