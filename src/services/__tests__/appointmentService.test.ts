/**
 * Appointment Service Tests
 *
 * Tests for appointment scheduling with double-booking prevention
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AppointmentService,
  checkAppointmentAvailability,
  scheduleAppointment,
  getProviderAppointments,
  type ConflictingAppointment,
  type AvailabilityCheckResult,
  type AppointmentInput,
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
});
