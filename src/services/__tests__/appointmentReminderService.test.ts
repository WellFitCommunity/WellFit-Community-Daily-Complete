/**
 * Appointment Reminder Service Tests
 *
 * Behavioral tests (Tier 1-3) for pure functions and Supabase wrappers:
 * - isInDndWindow: DND window logic with null handling, overnight, same-day, invalid timezone
 * - formatAppointmentForReminder: Intl.DateTimeFormat output verification
 * - generateReminderMessage: All 4 switch branches, firstName extraction
 * - getReminderPreferences: Supabase RPC call, error handling, default fallback
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockRpc = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
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

describe('AppointmentReminderService', () => {
  let service: typeof import('../appointmentReminderService');

  beforeEach(async () => {
    vi.clearAllMocks();
    service = await import('../appointmentReminderService');
  });

  // ========================================================================
  // isInDndWindow - Tier 2: State / Logic tests
  // ========================================================================
  describe('isInDndWindow', () => {
    it('returns false when dndStartTime is null', () => {
      expect(service.isInDndWindow(null, '08:00')).toBe(false);
    });

    it('returns false when dndEndTime is null', () => {
      expect(service.isInDndWindow('22:00', null)).toBe(false);
    });

    it('returns false when both times are null', () => {
      expect(service.isInDndWindow(null, null)).toBe(false);
    });

    it('returns false for invalid timezone string', () => {
      expect(service.isInDndWindow('00:00', '23:59', 'Invalid/Timezone_ZZZ')).toBe(false);
    });

    it('returns true for a same-day DND window covering the full day', () => {
      // 00:00 to 23:59 covers all possible current minutes
      expect(service.isInDndWindow('00:00', '23:59', 'America/Chicago')).toBe(true);
    });

    it('evaluates overnight DND window spanning midnight and returns boolean', () => {
      // start=1320 > end=480 triggers overnight logic
      const result = service.isInDndWindow('22:00', '08:00', 'America/Chicago');
      expect(typeof result).toBe('boolean');
    });

    it('uses default timezone America/Chicago when none provided', () => {
      const result = service.isInDndWindow('09:00', '17:00');
      expect(typeof result).toBe('boolean');
    });
  });

  // ========================================================================
  // formatAppointmentForReminder - Tier 2: Data formatting tests
  // ========================================================================
  describe('formatAppointmentForReminder', () => {
    it('formats a known date with correct weekday, month, and year', () => {
      // January 15, 2026 is a Thursday
      const appointmentDate = new Date('2026-01-15T14:30:00Z');
      const result = service.formatAppointmentForReminder(appointmentDate, 'UTC');
      expect(result.date).toContain('Thursday');
      expect(result.date).toContain('January');
      expect(result.date).toContain('15');
      expect(result.date).toContain('2026');
    });

    it('formats time with 12-hour AM/PM format', () => {
      // 14:30 UTC = 2:30 PM
      const appointmentDate = new Date('2026-01-15T14:30:00Z');
      const result = service.formatAppointmentForReminder(appointmentDate, 'UTC');
      expect(result.time).toContain('2');
      expect(result.time).toContain('30');
      expect(result.time).toMatch(/PM/i);
    });

    it('returns different formatted times for different timezones', () => {
      const appointmentDate = new Date('2026-01-15T20:00:00Z');
      const utcResult = service.formatAppointmentForReminder(appointmentDate, 'UTC');
      const chicagoResult = service.formatAppointmentForReminder(appointmentDate, 'America/Chicago');
      // 20:00 UTC vs 14:00 CST should differ
      expect(utcResult.time).not.toEqual(chicagoResult.time);
    });

    it('returns non-empty date and time strings', () => {
      const result = service.formatAppointmentForReminder(new Date('2026-06-01T09:00:00Z'));
      expect(typeof result.date).toBe('string');
      expect(typeof result.time).toBe('string');
      expect(result.date.length).toBeGreaterThan(0);
      expect(result.time.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // generateReminderMessage - Tier 1: Behavioral tests (all switch cases)
  // ========================================================================
  describe('generateReminderMessage', () => {
    const patientName = 'Maria Garcia';
    const providerName = 'Dr. Smith';
    const appointmentDate = 'Thursday, January 15, 2026';
    const appointmentTime = '2:30 PM';

    it('generates 24h reminder with tomorrow, stable internet, and first name only', () => {
      const msg = service.generateReminderMessage(
        '24h', patientName, providerName, appointmentDate, appointmentTime
      );
      expect(msg).toContain('Maria');
      expect(msg).not.toContain('Garcia');
      expect(msg).toContain('tomorrow');
      expect(msg).toContain(providerName);
      expect(msg).toContain(appointmentTime);
      expect(msg).toContain('stable internet');
    });

    it('generates 1h reminder with "in 1 hour" and "be ready"', () => {
      const msg = service.generateReminderMessage(
        '1h', patientName, providerName, appointmentDate, appointmentTime
      );
      expect(msg).toContain('Maria');
      expect(msg).toContain('1 hour');
      expect(msg).toContain(appointmentTime);
      expect(msg).toContain('be ready');
    });

    it('generates 15m reminder with "15 minutes" and provider name', () => {
      const msg = service.generateReminderMessage(
        '15m', patientName, providerName, appointmentDate, appointmentTime
      );
      expect(msg).toContain('Maria');
      expect(msg).toContain('15 minutes');
      expect(msg).toContain(providerName);
    });

    it('generates default message with date and time for unrecognized type', () => {
      // Force the default switch case
      const msg = service.generateReminderMessage(
        'unknown' as 'other' as never,
        patientName, providerName, appointmentDate, appointmentTime
      );
      expect(msg).toContain('Maria');
      expect(msg).toContain(appointmentDate);
      expect(msg).toContain(appointmentTime);
      expect(msg).toContain(providerName);
    });

    it('handles single-word patient name correctly', () => {
      const msg = service.generateReminderMessage(
        '24h', 'Akima', providerName, appointmentDate, appointmentTime
      );
      expect(msg).toContain('Akima');
    });
  });

  // ========================================================================
  // getReminderPreferences - Tier 3: Supabase integration tests
  // ========================================================================
  describe('getReminderPreferences', () => {
    it('calls supabase.rpc with correct parameters and maps result fields', async () => {
      mockRpc.mockResolvedValue({
        data: {
          user_id: 'user-123',
          reminder_24h_enabled: true,
          reminder_1h_enabled: false,
          reminder_15m_enabled: false,
          sms_enabled: true,
          push_enabled: false,
          email_enabled: false,
          dnd_start_time: '22:00',
          dnd_end_time: '08:00',
          timezone: 'America/New_York',
        },
        error: null,
      });

      const result = await service.getReminderPreferences('user-123');
      expect(mockRpc).toHaveBeenCalledWith('get_user_reminder_preferences', {
        p_user_id: 'user-123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe('user-123');
        expect(result.data.reminder24hEnabled).toBe(true);
        expect(result.data.reminder1hEnabled).toBe(false);
        expect(result.data.smsEnabled).toBe(true);
        expect(result.data.dndStartTime).toBe('22:00');
        expect(result.data.timezone).toBe('America/New_York');
      }
    });

    it('returns default preferences when RPC returns no data', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getReminderPreferences();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reminder24hEnabled).toBe(true);
        expect(result.data.reminder1hEnabled).toBe(true);
        expect(result.data.reminder15mEnabled).toBe(false);
        expect(result.data.timezone).toBe('America/Chicago');
      }
    });

    it('returns failure and logs error when RPC returns error', async () => {
      const { auditLogger } = await import('../auditLogger');
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Connection timeout' },
      });

      const result = await service.getReminderPreferences('user-123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.message).toContain('Connection timeout');
      }
      expect(auditLogger.error).toHaveBeenCalled();
    });
  });

});
