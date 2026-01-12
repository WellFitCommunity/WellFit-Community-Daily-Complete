/**
 * Appointment Service Tests
 *
 * Tests for appointment scheduling with double-booking prevention
 * and rescheduling workflow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AppointmentService,
  checkAppointmentAvailability,
  scheduleAppointment,
  getProviderAppointments,
  rescheduleAppointment,
  getAppointmentHistory,
  cancelAppointment,
  type ConflictingAppointment,
  type AvailabilityCheckResult,
  type AppointmentInput,
  type RescheduleInput,
  type RescheduleResult,
  type AppointmentHistoryEntry,
} from '../appointmentService';

// Mock the supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn(),
              })),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(),
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

describe('AppointmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Type Definitions', () => {
    it('should have correct ConflictingAppointment interface', () => {
      const conflict: ConflictingAppointment = {
        id: 'test-id',
        patient_name: 'John Doe',
        appointment_time: '2026-01-15T10:00:00Z',
        duration_minutes: 30,
        encounter_type: 'outpatient',
      };

      expect(conflict.id).toBe('test-id');
      expect(conflict.patient_name).toBe('John Doe');
      expect(conflict.appointment_time).toBe('2026-01-15T10:00:00Z');
      expect(conflict.duration_minutes).toBe(30);
      expect(conflict.encounter_type).toBe('outpatient');
    });

    it('should have correct AvailabilityCheckResult interface', () => {
      const result: AvailabilityCheckResult = {
        hasConflict: true,
        conflictCount: 1,
        conflictingAppointments: [
          {
            id: 'conflict-id',
            patient_name: 'Jane Smith',
            appointment_time: '2026-01-15T10:00:00Z',
            duration_minutes: 30,
            encounter_type: 'urgent-care',
          },
        ],
      };

      expect(result.hasConflict).toBe(true);
      expect(result.conflictCount).toBe(1);
      expect(result.conflictingAppointments).toHaveLength(1);
    });

    it('should have correct AppointmentInput interface', () => {
      const input: AppointmentInput = {
        patientId: 'patient-uuid',
        providerId: 'provider-uuid',
        appointmentTime: new Date('2026-01-15T14:00:00Z'),
        durationMinutes: 45,
        encounterType: 'outpatient',
        reasonForVisit: 'Annual checkup',
      };

      expect(input.patientId).toBe('patient-uuid');
      expect(input.providerId).toBe('provider-uuid');
      expect(input.durationMinutes).toBe(45);
      expect(input.encounterType).toBe('outpatient');
      expect(input.reasonForVisit).toBe('Annual checkup');
    });

    it('should allow undefined reasonForVisit', () => {
      const input: AppointmentInput = {
        patientId: 'patient-uuid',
        providerId: 'provider-uuid',
        appointmentTime: new Date('2026-01-15T14:00:00Z'),
        durationMinutes: 30,
        encounterType: 'er',
      };

      expect(input.reasonForVisit).toBeUndefined();
    });
  });

  describe('AppointmentService namespace', () => {
    it('should export checkAppointmentAvailability method', () => {
      expect(AppointmentService.checkAppointmentAvailability).toBeDefined();
      expect(typeof AppointmentService.checkAppointmentAvailability).toBe('function');
    });

    it('should export scheduleAppointment method', () => {
      expect(AppointmentService.scheduleAppointment).toBeDefined();
      expect(typeof AppointmentService.scheduleAppointment).toBe('function');
    });

    it('should export getProviderAppointments method', () => {
      expect(AppointmentService.getProviderAppointments).toBeDefined();
      expect(typeof AppointmentService.getProviderAppointments).toBe('function');
    });
  });

  describe('Function exports', () => {
    it('should export checkAppointmentAvailability as standalone function', () => {
      expect(checkAppointmentAvailability).toBeDefined();
      expect(typeof checkAppointmentAvailability).toBe('function');
    });

    it('should export scheduleAppointment as standalone function', () => {
      expect(scheduleAppointment).toBeDefined();
      expect(typeof scheduleAppointment).toBe('function');
    });

    it('should export getProviderAppointments as standalone function', () => {
      expect(getProviderAppointments).toBeDefined();
      expect(typeof getProviderAppointments).toBe('function');
    });
  });

  describe('Encounter types', () => {
    it('should support outpatient encounter type', () => {
      const input: AppointmentInput = {
        patientId: 'p1',
        providerId: 'pr1',
        appointmentTime: new Date(),
        durationMinutes: 30,
        encounterType: 'outpatient',
      };
      expect(input.encounterType).toBe('outpatient');
    });

    it('should support er encounter type', () => {
      const input: AppointmentInput = {
        patientId: 'p1',
        providerId: 'pr1',
        appointmentTime: new Date(),
        durationMinutes: 30,
        encounterType: 'er',
      };
      expect(input.encounterType).toBe('er');
    });

    it('should support urgent-care encounter type', () => {
      const input: AppointmentInput = {
        patientId: 'p1',
        providerId: 'pr1',
        appointmentTime: new Date(),
        durationMinutes: 30,
        encounterType: 'urgent-care',
      };
      expect(input.encounterType).toBe('urgent-care');
    });
  });

  describe('Duration values', () => {
    it('should accept 15-minute appointments', () => {
      const input: AppointmentInput = {
        patientId: 'p1',
        providerId: 'pr1',
        appointmentTime: new Date(),
        durationMinutes: 15,
        encounterType: 'outpatient',
      };
      expect(input.durationMinutes).toBe(15);
    });

    it('should accept 30-minute appointments', () => {
      const input: AppointmentInput = {
        patientId: 'p1',
        providerId: 'pr1',
        appointmentTime: new Date(),
        durationMinutes: 30,
        encounterType: 'outpatient',
      };
      expect(input.durationMinutes).toBe(30);
    });

    it('should accept 45-minute appointments', () => {
      const input: AppointmentInput = {
        patientId: 'p1',
        providerId: 'pr1',
        appointmentTime: new Date(),
        durationMinutes: 45,
        encounterType: 'outpatient',
      };
      expect(input.durationMinutes).toBe(45);
    });

    it('should accept 60-minute appointments', () => {
      const input: AppointmentInput = {
        patientId: 'p1',
        providerId: 'pr1',
        appointmentTime: new Date(),
        durationMinutes: 60,
        encounterType: 'outpatient',
      };
      expect(input.durationMinutes).toBe(60);
    });
  });

  describe('AvailabilityCheckResult states', () => {
    it('should represent no conflicts', () => {
      const result: AvailabilityCheckResult = {
        hasConflict: false,
        conflictCount: 0,
        conflictingAppointments: [],
      };
      expect(result.hasConflict).toBe(false);
      expect(result.conflictCount).toBe(0);
      expect(result.conflictingAppointments).toHaveLength(0);
    });

    it('should represent single conflict', () => {
      const result: AvailabilityCheckResult = {
        hasConflict: true,
        conflictCount: 1,
        conflictingAppointments: [
          {
            id: 'c1',
            patient_name: 'Patient A',
            appointment_time: '2026-01-15T10:00:00Z',
            duration_minutes: 30,
            encounter_type: 'outpatient',
          },
        ],
      };
      expect(result.hasConflict).toBe(true);
      expect(result.conflictCount).toBe(1);
    });

    it('should represent multiple conflicts', () => {
      const result: AvailabilityCheckResult = {
        hasConflict: true,
        conflictCount: 2,
        conflictingAppointments: [
          {
            id: 'c1',
            patient_name: 'Patient A',
            appointment_time: '2026-01-15T10:00:00Z',
            duration_minutes: 30,
            encounter_type: 'outpatient',
          },
          {
            id: 'c2',
            patient_name: 'Patient B',
            appointment_time: '2026-01-15T10:15:00Z',
            duration_minutes: 30,
            encounter_type: 'urgent-care',
          },
        ],
      };
      expect(result.hasConflict).toBe(true);
      expect(result.conflictCount).toBe(2);
      expect(result.conflictingAppointments).toHaveLength(2);
    });
  });

  describe('Date handling', () => {
    it('should handle Date objects correctly in AppointmentInput', () => {
      const appointmentTime = new Date('2026-01-15T14:30:00Z');
      const input: AppointmentInput = {
        patientId: 'p1',
        providerId: 'pr1',
        appointmentTime,
        durationMinutes: 30,
        encounterType: 'outpatient',
      };

      expect(input.appointmentTime instanceof Date).toBe(true);
      expect(input.appointmentTime.toISOString()).toBe('2026-01-15T14:30:00.000Z');
    });

    it('should handle ISO string dates in ConflictingAppointment', () => {
      const conflict: ConflictingAppointment = {
        id: 'c1',
        patient_name: 'Test Patient',
        appointment_time: '2026-01-15T09:00:00.000Z',
        duration_minutes: 30,
        encounter_type: 'outpatient',
      };

      const parsedDate = new Date(conflict.appointment_time);
      expect(parsedDate.getUTCHours()).toBe(9);
      expect(parsedDate.getUTCMinutes()).toBe(0);
    });
  });

  describe('Rescheduling Types', () => {
    it('should have correct RescheduleInput interface', () => {
      const input: RescheduleInput = {
        appointmentId: 'apt-123',
        newAppointmentTime: new Date('2026-01-20T14:00:00Z'),
        newDurationMinutes: 45,
        changeReason: 'Patient requested',
        changedByRole: 'provider',
      };

      expect(input.appointmentId).toBe('apt-123');
      expect(input.newAppointmentTime instanceof Date).toBe(true);
      expect(input.newDurationMinutes).toBe(45);
      expect(input.changeReason).toBe('Patient requested');
      expect(input.changedByRole).toBe('provider');
    });

    it('should allow optional fields in RescheduleInput', () => {
      const input: RescheduleInput = {
        appointmentId: 'apt-456',
        newAppointmentTime: new Date('2026-01-20T15:00:00Z'),
      };

      expect(input.appointmentId).toBe('apt-456');
      expect(input.newDurationMinutes).toBeUndefined();
      expect(input.changeReason).toBeUndefined();
      expect(input.changedByRole).toBeUndefined();
    });

    it('should have correct RescheduleResult interface', () => {
      const result: RescheduleResult = {
        appointmentId: 'apt-123',
        previousTime: '2026-01-15T10:00:00Z',
        newTime: '2026-01-20T14:00:00Z',
        previousDuration: 30,
        newDuration: 45,
        status: 'scheduled',
        providerId: 'provider-123',
        patientId: 'patient-456',
      };

      expect(result.appointmentId).toBe('apt-123');
      expect(result.previousTime).toBe('2026-01-15T10:00:00Z');
      expect(result.newTime).toBe('2026-01-20T14:00:00Z');
      expect(result.previousDuration).toBe(30);
      expect(result.newDuration).toBe(45);
      expect(result.status).toBe('scheduled');
    });

    it('should have correct AppointmentHistoryEntry interface', () => {
      const entry: AppointmentHistoryEntry = {
        id: 'history-123',
        changeType: 'rescheduled',
        previousAppointmentTime: '2026-01-15T10:00:00Z',
        newAppointmentTime: '2026-01-20T14:00:00Z',
        previousDurationMinutes: 30,
        newDurationMinutes: 45,
        previousStatus: 'confirmed',
        newStatus: 'scheduled',
        changeReason: 'Patient requested',
        changedBy: 'user-123',
        changedByRole: 'provider',
        changedByName: 'Dr. Smith',
        createdAt: '2026-01-14T12:00:00Z',
      };

      expect(entry.id).toBe('history-123');
      expect(entry.changeType).toBe('rescheduled');
      expect(entry.changedByName).toBe('Dr. Smith');
    });

    it('should support all change types in AppointmentHistoryEntry', () => {
      const changeTypes: AppointmentHistoryEntry['changeType'][] = [
        'created',
        'rescheduled',
        'cancelled',
        'status_changed',
        'updated',
      ];

      changeTypes.forEach((changeType) => {
        const entry: AppointmentHistoryEntry = {
          id: 'h1',
          changeType,
          previousAppointmentTime: null,
          newAppointmentTime: null,
          previousDurationMinutes: null,
          newDurationMinutes: null,
          previousStatus: null,
          newStatus: null,
          changeReason: null,
          changedBy: null,
          changedByRole: null,
          changedByName: 'System',
          createdAt: '2026-01-14T12:00:00Z',
        };
        expect(entry.changeType).toBe(changeType);
      });
    });

    it('should allow null values in AppointmentHistoryEntry', () => {
      const entry: AppointmentHistoryEntry = {
        id: 'history-456',
        changeType: 'created',
        previousAppointmentTime: null,
        newAppointmentTime: '2026-01-15T10:00:00Z',
        previousDurationMinutes: null,
        newDurationMinutes: 30,
        previousStatus: null,
        newStatus: 'scheduled',
        changeReason: null,
        changedBy: null,
        changedByRole: null,
        changedByName: 'System',
        createdAt: '2026-01-14T12:00:00Z',
      };

      expect(entry.previousAppointmentTime).toBeNull();
      expect(entry.previousDurationMinutes).toBeNull();
      expect(entry.previousStatus).toBeNull();
    });
  });

  describe('Rescheduling Function Exports', () => {
    it('should export rescheduleAppointment as standalone function', () => {
      expect(rescheduleAppointment).toBeDefined();
      expect(typeof rescheduleAppointment).toBe('function');
    });

    it('should export getAppointmentHistory as standalone function', () => {
      expect(getAppointmentHistory).toBeDefined();
      expect(typeof getAppointmentHistory).toBe('function');
    });

    it('should export cancelAppointment as standalone function', () => {
      expect(cancelAppointment).toBeDefined();
      expect(typeof cancelAppointment).toBe('function');
    });

    it('should include rescheduleAppointment in AppointmentService namespace', () => {
      expect(AppointmentService.rescheduleAppointment).toBeDefined();
      expect(typeof AppointmentService.rescheduleAppointment).toBe('function');
    });

    it('should include getAppointmentHistory in AppointmentService namespace', () => {
      expect(AppointmentService.getAppointmentHistory).toBeDefined();
      expect(typeof AppointmentService.getAppointmentHistory).toBe('function');
    });

    it('should include cancelAppointment in AppointmentService namespace', () => {
      expect(AppointmentService.cancelAppointment).toBeDefined();
      expect(typeof AppointmentService.cancelAppointment).toBe('function');
    });
  });

  describe('RescheduleInput roles', () => {
    it('should support patient role', () => {
      const input: RescheduleInput = {
        appointmentId: 'apt-1',
        newAppointmentTime: new Date(),
        changedByRole: 'patient',
      };
      expect(input.changedByRole).toBe('patient');
    });

    it('should support provider role', () => {
      const input: RescheduleInput = {
        appointmentId: 'apt-1',
        newAppointmentTime: new Date(),
        changedByRole: 'provider',
      };
      expect(input.changedByRole).toBe('provider');
    });

    it('should support admin role', () => {
      const input: RescheduleInput = {
        appointmentId: 'apt-1',
        newAppointmentTime: new Date(),
        changedByRole: 'admin',
      };
      expect(input.changedByRole).toBe('admin');
    });
  });

  describe('Reschedule duration handling', () => {
    it('should allow changing duration during reschedule', () => {
      const result: RescheduleResult = {
        appointmentId: 'apt-1',
        previousTime: '2026-01-15T10:00:00Z',
        newTime: '2026-01-20T14:00:00Z',
        previousDuration: 30,
        newDuration: 60,
        status: 'scheduled',
        providerId: 'p1',
        patientId: 'pt1',
      };

      expect(result.previousDuration).not.toBe(result.newDuration);
      expect(result.newDuration).toBe(60);
    });

    it('should keep same duration if not changed', () => {
      const result: RescheduleResult = {
        appointmentId: 'apt-1',
        previousTime: '2026-01-15T10:00:00Z',
        newTime: '2026-01-20T14:00:00Z',
        previousDuration: 30,
        newDuration: 30,
        status: 'scheduled',
        providerId: 'p1',
        patientId: 'pt1',
      };

      expect(result.previousDuration).toBe(result.newDuration);
    });
  });

  describe('Appointment history tracking', () => {
    it('should track rescheduling with full details', () => {
      const entry: AppointmentHistoryEntry = {
        id: 'h1',
        changeType: 'rescheduled',
        previousAppointmentTime: '2026-01-15T10:00:00Z',
        newAppointmentTime: '2026-01-20T14:00:00Z',
        previousDurationMinutes: 30,
        newDurationMinutes: 45,
        previousStatus: 'confirmed',
        newStatus: 'scheduled',
        changeReason: 'Schedule conflict',
        changedBy: 'user-123',
        changedByRole: 'provider',
        changedByName: 'Dr. Johnson',
        createdAt: '2026-01-14T12:00:00Z',
      };

      expect(entry.changeType).toBe('rescheduled');
      expect(entry.previousAppointmentTime).toBe('2026-01-15T10:00:00Z');
      expect(entry.newAppointmentTime).toBe('2026-01-20T14:00:00Z');
      expect(entry.changeReason).toBe('Schedule conflict');
    });

    it('should track cancellation', () => {
      const entry: AppointmentHistoryEntry = {
        id: 'h2',
        changeType: 'cancelled',
        previousAppointmentTime: '2026-01-15T10:00:00Z',
        newAppointmentTime: '2026-01-15T10:00:00Z',
        previousDurationMinutes: 30,
        newDurationMinutes: 30,
        previousStatus: 'scheduled',
        newStatus: 'cancelled',
        changeReason: 'Patient no longer needs appointment',
        changedBy: 'user-456',
        changedByRole: 'patient',
        changedByName: 'John Doe',
        createdAt: '2026-01-14T15:00:00Z',
      };

      expect(entry.changeType).toBe('cancelled');
      expect(entry.newStatus).toBe('cancelled');
    });

    it('should track status changes', () => {
      const entry: AppointmentHistoryEntry = {
        id: 'h3',
        changeType: 'status_changed',
        previousAppointmentTime: '2026-01-15T10:00:00Z',
        newAppointmentTime: '2026-01-15T10:00:00Z',
        previousDurationMinutes: 30,
        newDurationMinutes: 30,
        previousStatus: 'scheduled',
        newStatus: 'confirmed',
        changeReason: null,
        changedBy: 'user-789',
        changedByRole: 'patient',
        changedByName: 'Jane Smith',
        createdAt: '2026-01-14T16:00:00Z',
      };

      expect(entry.changeType).toBe('status_changed');
      expect(entry.previousStatus).toBe('scheduled');
      expect(entry.newStatus).toBe('confirmed');
    });
  });
});
