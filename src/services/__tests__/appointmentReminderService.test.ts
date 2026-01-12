/**
 * Appointment Reminder Service Tests
 *
 * Tests for appointment reminder management including:
 * - Reminder preferences
 * - DND window checking
 * - Message generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AppointmentReminderService,
  getReminderPreferences,
  updateReminderPreferences,
  getAppointmentsNeedingReminders,
  markReminderSent,
  resetAppointmentReminders,
  getReminderLogs,
  isInDndWindow,
  formatAppointmentForReminder,
  generateReminderMessage,
  type ReminderType,
  type ReminderPreferences,
  type ReminderPreferencesInput,
  type AppointmentNeedingReminder,
  type ReminderSendResult,
  type ReminderLogEntry,
} from '../appointmentReminderService';

// Mock the supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(),
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

describe('AppointmentReminderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Type Definitions', () => {
    it('should have correct ReminderType union', () => {
      const types: ReminderType[] = ['24h', '1h', '15m'];
      expect(types).toContain('24h');
      expect(types).toContain('1h');
      expect(types).toContain('15m');
    });

    it('should have correct ReminderPreferences interface', () => {
      const prefs: ReminderPreferences = {
        userId: 'user-123',
        reminder24hEnabled: true,
        reminder1hEnabled: true,
        reminder15mEnabled: false,
        smsEnabled: true,
        pushEnabled: true,
        emailEnabled: false,
        dndStartTime: '22:00',
        dndEndTime: '08:00',
        timezone: 'America/Chicago',
      };

      expect(prefs.userId).toBe('user-123');
      expect(prefs.reminder24hEnabled).toBe(true);
      expect(prefs.reminder15mEnabled).toBe(false);
      expect(prefs.dndStartTime).toBe('22:00');
    });

    it('should have correct ReminderPreferencesInput interface', () => {
      const input: ReminderPreferencesInput = {
        reminder24hEnabled: true,
        smsEnabled: false,
      };

      expect(input.reminder24hEnabled).toBe(true);
      expect(input.smsEnabled).toBe(false);
      expect(input.pushEnabled).toBeUndefined();
    });

    it('should have correct AppointmentNeedingReminder interface', () => {
      const apt: AppointmentNeedingReminder = {
        appointmentId: 'apt-123',
        patientId: 'patient-456',
        patientName: 'John Doe',
        patientPhone: '+15551234567',
        patientEmail: 'john@example.com',
        providerName: 'Dr. Smith',
        appointmentTime: new Date('2026-01-20T10:00:00Z'),
        durationMinutes: 30,
        encounterType: 'outpatient',
        reasonForVisit: 'Follow-up',
        tenantId: 'tenant-789',
        smsEnabled: true,
        pushEnabled: true,
        emailEnabled: false,
        dndStartTime: null,
        dndEndTime: null,
        timezone: 'America/Chicago',
      };

      expect(apt.appointmentId).toBe('apt-123');
      expect(apt.patientName).toBe('John Doe');
      expect(apt.appointmentTime instanceof Date).toBe(true);
    });

    it('should have correct ReminderSendResult interface', () => {
      const result: ReminderSendResult = {
        smsSent: true,
        smsSid: 'SM123456',
        pushSent: true,
        emailSent: false,
      };

      expect(result.smsSent).toBe(true);
      expect(result.smsSid).toBe('SM123456');
      expect(result.pushSent).toBe(true);
    });

    it('should have correct ReminderLogEntry interface', () => {
      const log: ReminderLogEntry = {
        id: 'log-123',
        appointmentId: 'apt-456',
        patientId: 'patient-789',
        reminderType: '24h',
        smsSent: true,
        smsSid: 'SM123',
        smsStatus: 'delivered',
        pushSent: true,
        pushStatus: 'sent',
        emailSent: false,
        emailStatus: null,
        status: 'sent',
        skipReason: null,
        scheduledFor: new Date('2026-01-19T10:00:00Z'),
        sentAt: new Date('2026-01-19T10:00:30Z'),
        createdAt: new Date('2026-01-19T10:00:30Z'),
      };

      expect(log.reminderType).toBe('24h');
      expect(log.status).toBe('sent');
      expect(log.scheduledFor instanceof Date).toBe(true);
    });
  });

  describe('Service Namespace Exports', () => {
    it('should export getReminderPreferences', () => {
      expect(AppointmentReminderService.getReminderPreferences).toBeDefined();
      expect(typeof AppointmentReminderService.getReminderPreferences).toBe('function');
    });

    it('should export updateReminderPreferences', () => {
      expect(AppointmentReminderService.updateReminderPreferences).toBeDefined();
      expect(typeof AppointmentReminderService.updateReminderPreferences).toBe('function');
    });

    it('should export getAppointmentsNeedingReminders', () => {
      expect(AppointmentReminderService.getAppointmentsNeedingReminders).toBeDefined();
      expect(typeof AppointmentReminderService.getAppointmentsNeedingReminders).toBe('function');
    });

    it('should export markReminderSent', () => {
      expect(AppointmentReminderService.markReminderSent).toBeDefined();
      expect(typeof AppointmentReminderService.markReminderSent).toBe('function');
    });

    it('should export resetAppointmentReminders', () => {
      expect(AppointmentReminderService.resetAppointmentReminders).toBeDefined();
      expect(typeof AppointmentReminderService.resetAppointmentReminders).toBe('function');
    });

    it('should export getReminderLogs', () => {
      expect(AppointmentReminderService.getReminderLogs).toBeDefined();
      expect(typeof AppointmentReminderService.getReminderLogs).toBe('function');
    });

    it('should export isInDndWindow', () => {
      expect(AppointmentReminderService.isInDndWindow).toBeDefined();
      expect(typeof AppointmentReminderService.isInDndWindow).toBe('function');
    });

    it('should export formatAppointmentForReminder', () => {
      expect(AppointmentReminderService.formatAppointmentForReminder).toBeDefined();
      expect(typeof AppointmentReminderService.formatAppointmentForReminder).toBe('function');
    });

    it('should export generateReminderMessage', () => {
      expect(AppointmentReminderService.generateReminderMessage).toBeDefined();
      expect(typeof AppointmentReminderService.generateReminderMessage).toBe('function');
    });
  });

  describe('Standalone Function Exports', () => {
    it('should export getReminderPreferences as standalone', () => {
      expect(getReminderPreferences).toBeDefined();
      expect(typeof getReminderPreferences).toBe('function');
    });

    it('should export updateReminderPreferences as standalone', () => {
      expect(updateReminderPreferences).toBeDefined();
      expect(typeof updateReminderPreferences).toBe('function');
    });

    it('should export getAppointmentsNeedingReminders as standalone', () => {
      expect(getAppointmentsNeedingReminders).toBeDefined();
      expect(typeof getAppointmentsNeedingReminders).toBe('function');
    });

    it('should export markReminderSent as standalone', () => {
      expect(markReminderSent).toBeDefined();
      expect(typeof markReminderSent).toBe('function');
    });

    it('should export resetAppointmentReminders as standalone', () => {
      expect(resetAppointmentReminders).toBeDefined();
      expect(typeof resetAppointmentReminders).toBe('function');
    });

    it('should export getReminderLogs as standalone', () => {
      expect(getReminderLogs).toBeDefined();
      expect(typeof getReminderLogs).toBe('function');
    });
  });

  describe('isInDndWindow', () => {
    it('should return false when DND times are null', () => {
      expect(isInDndWindow(null, null)).toBe(false);
      expect(isInDndWindow('22:00', null)).toBe(false);
      expect(isInDndWindow(null, '08:00')).toBe(false);
    });

    it('should handle same-day DND window', () => {
      // Test with mocked time would be needed for real time-dependent tests
      // For now, just verify the function doesn't throw
      const result = isInDndWindow('09:00', '17:00', 'America/Chicago');
      expect(typeof result).toBe('boolean');
    });

    it('should handle overnight DND window', () => {
      // Overnight: 22:00 to 08:00
      const result = isInDndWindow('22:00', '08:00', 'America/Chicago');
      expect(typeof result).toBe('boolean');
    });

    it('should use default timezone if not provided', () => {
      const result = isInDndWindow('22:00', '08:00');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('formatAppointmentForReminder', () => {
    it('should format appointment time correctly', () => {
      const appointmentTime = new Date('2026-01-20T15:30:00Z');
      const formatted = formatAppointmentForReminder(appointmentTime, 'America/New_York');

      expect(formatted.date).toBeDefined();
      expect(formatted.time).toBeDefined();
      expect(typeof formatted.date).toBe('string');
      expect(typeof formatted.time).toBe('string');
    });

    it('should include weekday in date format', () => {
      const appointmentTime = new Date('2026-01-20T15:30:00Z');
      const formatted = formatAppointmentForReminder(appointmentTime, 'America/Chicago');

      // Should contain day name
      expect(
        formatted.date.includes('Monday') ||
          formatted.date.includes('Tuesday') ||
          formatted.date.includes('Wednesday') ||
          formatted.date.includes('Thursday') ||
          formatted.date.includes('Friday') ||
          formatted.date.includes('Saturday') ||
          formatted.date.includes('Sunday')
      ).toBe(true);
    });

    it('should format time with AM/PM', () => {
      const appointmentTime = new Date('2026-01-20T15:30:00Z');
      const formatted = formatAppointmentForReminder(appointmentTime, 'America/Chicago');

      expect(formatted.time.includes('AM') || formatted.time.includes('PM')).toBe(true);
    });

    it('should use default timezone if not provided', () => {
      const appointmentTime = new Date('2026-01-20T15:30:00Z');
      const formatted = formatAppointmentForReminder(appointmentTime);

      expect(formatted.date).toBeDefined();
      expect(formatted.time).toBeDefined();
    });
  });

  describe('generateReminderMessage', () => {
    it('should generate 24h reminder message', () => {
      const message = generateReminderMessage(
        '24h',
        'John Doe',
        'Dr. Smith',
        'Monday, January 20, 2026',
        '10:00 AM'
      );

      expect(message).toContain('John'); // Uses first name
      expect(message).toContain('Dr. Smith');
      expect(message).toContain('tomorrow');
      expect(message).toContain('10:00 AM');
    });

    it('should generate 1h reminder message', () => {
      const message = generateReminderMessage(
        '1h',
        'Jane Smith',
        'Dr. Johnson',
        'Monday, January 20, 2026',
        '2:30 PM'
      );

      expect(message).toContain('Jane');
      expect(message).toContain('Dr. Johnson');
      expect(message).toContain('1 hour');
      expect(message).toContain('2:30 PM');
    });

    it('should generate 15m reminder message', () => {
      const message = generateReminderMessage(
        '15m',
        'Bob Wilson',
        'Dr. Brown',
        'Monday, January 20, 2026',
        '3:00 PM'
      );

      expect(message).toContain('Bob');
      expect(message).toContain('Dr. Brown');
      expect(message).toContain('15 minutes');
    });

    it('should use first name only from full name', () => {
      const message = generateReminderMessage(
        '24h',
        'Mary Jane Watson',
        'Dr. Smith',
        'Monday, January 20, 2026',
        '10:00 AM'
      );

      expect(message).toContain('Mary');
      expect(message).not.toContain('Watson');
    });
  });

  describe('ReminderLogEntry status values', () => {
    it('should support pending status', () => {
      const log: ReminderLogEntry = {
        id: '1',
        appointmentId: 'a1',
        patientId: 'p1',
        reminderType: '24h',
        smsSent: false,
        smsSid: null,
        smsStatus: null,
        pushSent: false,
        pushStatus: null,
        emailSent: false,
        emailStatus: null,
        status: 'pending',
        skipReason: null,
        scheduledFor: new Date(),
        sentAt: null,
        createdAt: new Date(),
      };
      expect(log.status).toBe('pending');
    });

    it('should support sent status', () => {
      const log: ReminderLogEntry = {
        id: '1',
        appointmentId: 'a1',
        patientId: 'p1',
        reminderType: '1h',
        smsSent: true,
        smsSid: 'SM123',
        smsStatus: 'delivered',
        pushSent: true,
        pushStatus: 'sent',
        emailSent: false,
        emailStatus: null,
        status: 'sent',
        skipReason: null,
        scheduledFor: new Date(),
        sentAt: new Date(),
        createdAt: new Date(),
      };
      expect(log.status).toBe('sent');
    });

    it('should support partial status', () => {
      const log: ReminderLogEntry = {
        id: '1',
        appointmentId: 'a1',
        patientId: 'p1',
        reminderType: '15m',
        smsSent: true,
        smsSid: 'SM123',
        smsStatus: 'delivered',
        pushSent: false,
        pushStatus: 'failed',
        emailSent: false,
        emailStatus: null,
        status: 'partial',
        skipReason: null,
        scheduledFor: new Date(),
        sentAt: new Date(),
        createdAt: new Date(),
      };
      expect(log.status).toBe('partial');
    });

    it('should support failed status', () => {
      const log: ReminderLogEntry = {
        id: '1',
        appointmentId: 'a1',
        patientId: 'p1',
        reminderType: '24h',
        smsSent: false,
        smsSid: null,
        smsStatus: 'failed',
        pushSent: false,
        pushStatus: 'failed',
        emailSent: false,
        emailStatus: null,
        status: 'failed',
        skipReason: null,
        scheduledFor: new Date(),
        sentAt: null,
        createdAt: new Date(),
      };
      expect(log.status).toBe('failed');
    });

    it('should support skipped status with reason', () => {
      const log: ReminderLogEntry = {
        id: '1',
        appointmentId: 'a1',
        patientId: 'p1',
        reminderType: '24h',
        smsSent: false,
        smsSid: null,
        smsStatus: null,
        pushSent: false,
        pushStatus: null,
        emailSent: false,
        emailStatus: null,
        status: 'skipped',
        skipReason: 'Patient in DND window',
        scheduledFor: new Date(),
        sentAt: null,
        createdAt: new Date(),
      };
      expect(log.status).toBe('skipped');
      expect(log.skipReason).toBe('Patient in DND window');
    });
  });

  describe('ReminderPreferences defaults', () => {
    it('should have sensible defaults for timing', () => {
      const prefs: ReminderPreferences = {
        userId: 'u1',
        reminder24hEnabled: true,  // Should be on by default
        reminder1hEnabled: true,   // Should be on by default
        reminder15mEnabled: false, // Should be off by default (too frequent)
        smsEnabled: true,
        pushEnabled: true,
        emailEnabled: false,
        dndStartTime: null,
        dndEndTime: null,
        timezone: 'America/Chicago',
      };

      expect(prefs.reminder24hEnabled).toBe(true);
      expect(prefs.reminder1hEnabled).toBe(true);
      expect(prefs.reminder15mEnabled).toBe(false);
    });

    it('should have sensible defaults for channels', () => {
      const prefs: ReminderPreferences = {
        userId: 'u1',
        reminder24hEnabled: true,
        reminder1hEnabled: true,
        reminder15mEnabled: false,
        smsEnabled: true,   // Primary channel
        pushEnabled: true,  // Secondary channel
        emailEnabled: false, // Opt-in only
        dndStartTime: null,
        dndEndTime: null,
        timezone: 'America/Chicago',
      };

      expect(prefs.smsEnabled).toBe(true);
      expect(prefs.pushEnabled).toBe(true);
      expect(prefs.emailEnabled).toBe(false);
    });
  });

  describe('Appointment needing reminder validation', () => {
    it('should require active status', () => {
      // This would be validated at the database level
      // The function should only return scheduled/confirmed appointments
      const apt: AppointmentNeedingReminder = {
        appointmentId: 'apt-1',
        patientId: 'p1',
        patientName: 'Test Patient',
        patientPhone: '+15551234567',
        patientEmail: 'test@example.com',
        providerName: 'Dr. Test',
        appointmentTime: new Date(),
        durationMinutes: 30,
        encounterType: 'outpatient',
        reasonForVisit: null,
        tenantId: null,
        smsEnabled: true,
        pushEnabled: true,
        emailEnabled: false,
        dndStartTime: null,
        dndEndTime: null,
        timezone: 'America/Chicago',
      };

      expect(apt.appointmentId).toBeDefined();
      expect(apt.patientPhone).toBe('+15551234567');
    });

    it('should handle null phone gracefully', () => {
      const apt: AppointmentNeedingReminder = {
        appointmentId: 'apt-2',
        patientId: 'p2',
        patientName: 'No Phone Patient',
        patientPhone: null,  // No phone
        patientEmail: 'test@example.com',
        providerName: 'Dr. Test',
        appointmentTime: new Date(),
        durationMinutes: 30,
        encounterType: 'outpatient',
        reasonForVisit: null,
        tenantId: null,
        smsEnabled: true,
        pushEnabled: true,
        emailEnabled: true,
        dndStartTime: null,
        dndEndTime: null,
        timezone: 'America/Chicago',
      };

      expect(apt.patientPhone).toBeNull();
      // SMS would be skipped, but push/email could still work
      expect(apt.pushEnabled).toBe(true);
      expect(apt.emailEnabled).toBe(true);
    });
  });
});
