/**
 * Appointment Service Tests
 *
 * Tier 3 integration tests for Supabase-wrapped appointment operations:
 * - checkAppointmentAvailability: RPC call, conflict detection, error handling
 * - scheduleAppointment: Conflict check + insert, constraint violation handling
 * - rescheduleAppointment: RPC call with error code mapping
 * - cancelAppointment: Update call with audit logging
 * - getAppointmentHistory: RPC call with permission denied handling
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockRpc = vi.fn();
const mockInsertSelect = vi.fn();
const mockInsert = vi.fn(() => ({
  select: vi.fn(() => ({
    single: mockInsertSelect,
  })),
}));
const mockUpdateEq = vi.fn();
const mockUpdate = vi.fn(() => ({
  eq: mockUpdateEq,
}));
const mockSelectEq = vi.fn();
const mockSelectGte = vi.fn();
const mockSelectLte = vi.fn();
const mockSelectIn = vi.fn();
const mockSelectOrder = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: vi.fn(() => ({
      insert: mockInsert,
      update: mockUpdate,
      select: vi.fn(() => ({
        eq: mockSelectEq.mockReturnValue({
          gte: mockSelectGte.mockReturnValue({
            lte: mockSelectLte.mockReturnValue({
              in: mockSelectIn.mockReturnValue({
                order: mockSelectOrder.mockReturnValue(
                  Promise.resolve({ data: [], error: null })
                ),
              }),
            }),
          }),
        }),
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

describe('AppointmentService', () => {
  let service: typeof import('../appointmentService');

  beforeEach(async () => {
    vi.clearAllMocks();
    service = await import('../appointmentService');
  });

  // ========================================================================
  // checkAppointmentAvailability - Tier 3
  // ========================================================================
  describe('checkAppointmentAvailability', () => {
    it('calls RPC with correct parameters including ISO time', async () => {
      const appointmentTime = new Date('2026-02-15T10:00:00Z');
      mockRpc.mockResolvedValue({
        data: { has_conflict: false, conflict_count: 0, conflicting_appointments: [] },
        error: null,
      });

      const result = await service.checkAppointmentAvailability(
        'provider-1', appointmentTime, 30
      );

      expect(mockRpc).toHaveBeenCalledWith('check_appointment_availability', {
        p_provider_id: 'provider-1',
        p_appointment_time: '2026-02-15T10:00:00.000Z',
        p_duration_minutes: 30,
        p_exclude_appointment_id: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasConflict).toBe(false);
        expect(result.data.conflictCount).toBe(0);
      }
    });

    it('returns conflict info when RPC detects conflicts', async () => {
      mockRpc.mockResolvedValue({
        data: {
          has_conflict: true,
          conflict_count: 1,
          conflicting_appointments: [{
            id: 'apt-existing',
            patient_name: 'John Doe',
            appointment_time: '2026-02-15T10:00:00Z',
            duration_minutes: 30,
            encounter_type: 'outpatient',
          }],
        },
        error: null,
      });

      const result = await service.checkAppointmentAvailability(
        'provider-1', new Date('2026-02-15T10:00:00Z'), 30
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasConflict).toBe(true);
        expect(result.data.conflictCount).toBe(1);
        expect(result.data.conflictingAppointments[0].patient_name).toBe('John Doe');
      }
    });

    it('returns failure when RPC returns error', async () => {
      const { auditLogger } = await import('../auditLogger');
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await service.checkAppointmentAvailability(
        'provider-1', new Date('2026-02-15T10:00:00Z'), 30
      );

      expect(result.success).toBe(false);
      expect(auditLogger.error).toHaveBeenCalled();
    });

    it('returns no conflict when RPC returns null data', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.checkAppointmentAvailability(
        'provider-1', new Date(), 30
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasConflict).toBe(false);
        expect(result.data.conflictingAppointments).toEqual([]);
      }
    });
  });

  // ========================================================================
  // scheduleAppointment - Tier 3
  // ========================================================================
  describe('scheduleAppointment', () => {
    it('blocks scheduling when availability check finds conflict', async () => {
      const { auditLogger } = await import('../auditLogger');
      // First RPC call (availability check) returns conflict
      mockRpc.mockResolvedValue({
        data: {
          has_conflict: true,
          conflict_count: 1,
          conflicting_appointments: [{
            id: 'apt-existing',
            patient_name: 'Jane Doe',
            appointment_time: '2026-02-15T10:00:00Z',
            duration_minutes: 30,
            encounter_type: 'outpatient',
          }],
        },
        error: null,
      });

      const result = await service.scheduleAppointment({
        patientId: 'patient-1',
        providerId: 'provider-1',
        appointmentTime: new Date('2026-02-15T10:00:00Z'),
        durationMinutes: 30,
        encounterType: 'outpatient',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('CONSTRAINT_VIOLATION');
      }
      expect(auditLogger.warn).toHaveBeenCalledWith(
        'APPOINTMENT_CONFLICT_BLOCKED',
        expect.objectContaining({ providerId: 'provider-1' })
      );
    });

    it('inserts appointment when no conflict exists', async () => {
      // RPC returns no conflict
      mockRpc.mockResolvedValue({
        data: { has_conflict: false, conflict_count: 0, conflicting_appointments: [] },
        error: null,
      });
      // Insert succeeds
      mockInsertSelect.mockResolvedValue({
        data: { id: 'new-apt-id', appointment_time: '2026-02-15T10:00:00Z' },
        error: null,
      });

      const result = await service.scheduleAppointment({
        patientId: 'patient-1',
        providerId: 'provider-1',
        appointmentTime: new Date('2026-02-15T10:00:00Z'),
        durationMinutes: 30,
        encounterType: 'outpatient',
        reasonForVisit: 'Follow-up',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('new-apt-id');
      }
    });
  });

  // ========================================================================
  // rescheduleAppointment - Tier 3
  // ========================================================================
  describe('rescheduleAppointment', () => {
    it('calls RPC with correct parameters and returns reschedule result', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          appointment_id: 'apt-1',
          previous_time: '2026-02-15T10:00:00Z',
          new_time: '2026-02-16T14:00:00Z',
          previous_duration: 30,
          new_duration: 45,
          status: 'rescheduled',
          provider_id: 'provider-1',
          patient_id: 'patient-1',
        },
        error: null,
      });

      const result = await service.rescheduleAppointment({
        appointmentId: 'apt-1',
        newAppointmentTime: new Date('2026-02-16T14:00:00Z'),
        newDurationMinutes: 45,
        changeReason: 'Patient request',
        changedByRole: 'patient',
      });

      expect(mockRpc).toHaveBeenCalledWith('reschedule_appointment', expect.objectContaining({
        p_appointment_id: 'apt-1',
        p_change_reason: 'Patient request',
        p_changed_by_role: 'patient',
      }));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.appointmentId).toBe('apt-1');
        expect(result.data.newDuration).toBe(45);
        expect(result.data.status).toBe('rescheduled');
      }
    });

    it('maps APPOINTMENT_NOT_FOUND error to NOT_FOUND failure', async () => {
      mockRpc.mockResolvedValue({
        data: { success: false, error: 'APPOINTMENT_NOT_FOUND', message: 'Not found' },
        error: null,
      });

      const result = await service.rescheduleAppointment({
        appointmentId: 'nonexistent',
        newAppointmentTime: new Date(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('NOT_FOUND');
      }
    });

    it('maps APPOINTMENT_CONFLICT error to CONSTRAINT_VIOLATION failure', async () => {
      mockRpc.mockResolvedValue({
        data: { success: false, error: 'APPOINTMENT_CONFLICT', message: 'Time slot taken' },
        error: null,
      });

      const result = await service.rescheduleAppointment({
        appointmentId: 'apt-1',
        newAppointmentTime: new Date(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('CONSTRAINT_VIOLATION');
      }
    });
  });

  // ========================================================================
  // cancelAppointment - Tier 3
  // ========================================================================
  describe('cancelAppointment', () => {
    it('updates appointment status to cancelled and logs success', async () => {
      const { auditLogger } = await import('../auditLogger');
      mockUpdateEq.mockResolvedValue({ error: null });

      const result = await service.cancelAppointment('apt-1', 'Patient no-show');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cancelled).toBe(true);
      }
      expect(auditLogger.info).toHaveBeenCalledWith(
        'APPOINTMENT_CANCELLED',
        expect.objectContaining({ appointmentId: 'apt-1', reason: 'Patient no-show' })
      );
    });

    it('returns failure and logs error when update fails', async () => {
      const { auditLogger } = await import('../auditLogger');
      mockUpdateEq.mockResolvedValue({
        error: { message: 'Row not found' },
      });

      const result = await service.cancelAppointment('apt-nonexistent');

      expect(result.success).toBe(false);
      expect(auditLogger.error).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // getAppointmentHistory - Tier 3
  // ========================================================================
  describe('getAppointmentHistory', () => {
    it('maps RPC result to AppointmentHistoryEntry array', async () => {
      mockRpc.mockResolvedValue({
        data: [{
          id: 'hist-1',
          change_type: 'rescheduled',
          previous_appointment_time: '2026-02-15T10:00:00Z',
          new_appointment_time: '2026-02-16T14:00:00Z',
          previous_duration_minutes: 30,
          new_duration_minutes: 45,
          previous_status: null,
          new_status: null,
          change_reason: 'Patient request',
          changed_by: 'user-1',
          changed_by_role: 'patient',
          changed_by_name: 'Maria Garcia',
          created_at: '2026-02-15T08:00:00Z',
        }],
        error: null,
      });

      const result = await service.getAppointmentHistory('apt-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].changeType).toBe('rescheduled');
        expect(result.data[0].changedByName).toBe('Maria Garcia');
        expect(result.data[0].changeReason).toBe('Patient request');
      }
    });

    it('returns FORBIDDEN when RPC returns permission denied error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Permission denied for this appointment' },
      });

      const result = await service.getAppointmentHistory('apt-restricted');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('FORBIDDEN');
      }
    });
  });

  // ========================================================================
  // Namespace export - Tier 2
  // ========================================================================
  describe('AppointmentService namespace', () => {
    it('exports all service functions on the namespace object', () => {
      const ns = service.AppointmentService;
      expect(typeof ns.checkAppointmentAvailability).toBe('function');
      expect(typeof ns.scheduleAppointment).toBe('function');
      expect(typeof ns.getProviderAppointments).toBe('function');
      expect(typeof ns.rescheduleAppointment).toBe('function');
      expect(typeof ns.getAppointmentHistory).toBe('function');
      expect(typeof ns.cancelAppointment).toBe('function');
    });
  });
});
