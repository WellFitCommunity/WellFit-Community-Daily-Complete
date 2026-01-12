/**
 * Appointment Service
 *
 * Handles appointment scheduling operations including:
 * - Conflict detection (double-booking prevention)
 * - Appointment CRUD operations
 * - Availability checking
 * - Rescheduling with audit trail
 *
 * @module appointmentService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// ============================================================================
// TYPES
// ============================================================================

export interface ConflictingAppointment {
  id: string;
  patient_name: string;
  appointment_time: string;
  duration_minutes: number;
  encounter_type: string;
}

export interface AvailabilityCheckResult {
  hasConflict: boolean;
  conflictCount: number;
  conflictingAppointments: ConflictingAppointment[];
}

export interface AppointmentInput {
  patientId: string;
  providerId: string;
  appointmentTime: Date;
  durationMinutes: number;
  encounterType: 'outpatient' | 'er' | 'urgent-care';
  reasonForVisit?: string;
}

export interface RescheduleInput {
  appointmentId: string;
  newAppointmentTime: Date;
  newDurationMinutes?: number;
  changeReason?: string;
  changedByRole?: 'patient' | 'provider' | 'admin';
}

export interface RescheduleResult {
  appointmentId: string;
  previousTime: string;
  newTime: string;
  previousDuration: number;
  newDuration: number;
  status: string;
  providerId: string;
  patientId: string;
}

export interface AppointmentHistoryEntry {
  id: string;
  changeType: 'created' | 'rescheduled' | 'cancelled' | 'status_changed' | 'updated';
  previousAppointmentTime: string | null;
  newAppointmentTime: string | null;
  previousDurationMinutes: number | null;
  newDurationMinutes: number | null;
  previousStatus: string | null;
  newStatus: string | null;
  changeReason: string | null;
  changedBy: string | null;
  changedByRole: string | null;
  changedByName: string;
  createdAt: string;
}

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * Check if a proposed appointment time conflicts with existing appointments
 * for the same provider.
 *
 * @param providerId - The provider's UUID
 * @param appointmentTime - Proposed appointment start time
 * @param durationMinutes - Duration of the appointment
 * @param excludeAppointmentId - Optional appointment ID to exclude (for updates)
 * @returns ServiceResult with availability information
 */
export async function checkAppointmentAvailability(
  providerId: string,
  appointmentTime: Date,
  durationMinutes: number,
  excludeAppointmentId?: string
): Promise<ServiceResult<AvailabilityCheckResult>> {
  try {
    const { data, error } = await supabase.rpc('check_appointment_availability', {
      p_provider_id: providerId,
      p_appointment_time: appointmentTime.toISOString(),
      p_duration_minutes: durationMinutes,
      p_exclude_appointment_id: excludeAppointmentId || null,
    });

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'APPOINTMENT_AVAILABILITY_CHECK_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { providerId, appointmentTime: appointmentTime.toISOString() }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    // Handle the result from RPC (returns array with single row)
    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      return success({
        hasConflict: false,
        conflictCount: 0,
        conflictingAppointments: [],
      });
    }

    const availability: AvailabilityCheckResult = {
      hasConflict: result.has_conflict === true,
      conflictCount: result.conflict_count || 0,
      conflictingAppointments: (result.conflicting_appointments || []).map(
        (apt: Record<string, unknown>) => ({
          id: String(apt.id || ''),
          patient_name: String(apt.patient_name || 'Unknown'),
          appointment_time: String(apt.appointment_time || ''),
          duration_minutes: Number(apt.duration_minutes || 0),
          encounter_type: String(apt.encounter_type || ''),
        })
      ),
    };

    return success(availability);
  } catch (err: unknown) {
    await auditLogger.error(
      'APPOINTMENT_AVAILABILITY_CHECK_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { providerId, appointmentTime: appointmentTime.toISOString() }
    );
    return failure('UNKNOWN_ERROR', 'Failed to check appointment availability');
  }
}

/**
 * Schedule a new appointment with conflict checking.
 * This is a safer alternative to direct insert that validates availability first.
 *
 * @param input - Appointment details
 * @returns ServiceResult with the created appointment or error
 */
export async function scheduleAppointment(
  input: AppointmentInput
): Promise<ServiceResult<{ id: string; appointment_time: string }>> {
  try {
    // First check for conflicts
    const availabilityResult = await checkAppointmentAvailability(
      input.providerId,
      input.appointmentTime,
      input.durationMinutes
    );

    if (!availabilityResult.success) {
      return failure('VALIDATION_ERROR', availabilityResult.error?.message || 'Failed to check availability');
    }

    if (availabilityResult.data.hasConflict) {
      const conflicts = availabilityResult.data.conflictingAppointments;
      const conflictDetails = conflicts.length > 0
        ? `Conflict with ${conflicts[0].patient_name} at ${new Date(conflicts[0].appointment_time).toLocaleString()}`
        : 'Provider has a conflicting appointment at this time';

      await auditLogger.warn('APPOINTMENT_CONFLICT_BLOCKED', {
        providerId: input.providerId,
        requestedTime: input.appointmentTime.toISOString(),
        conflictCount: availabilityResult.data.conflictCount,
      });

      return failure('CONSTRAINT_VIOLATION', conflictDetails);
    }

    // No conflict, proceed with insert
    const { data, error } = await supabase
      .from('telehealth_appointments')
      .insert({
        patient_id: input.patientId,
        provider_id: input.providerId,
        appointment_time: input.appointmentTime.toISOString(),
        duration_minutes: input.durationMinutes,
        encounter_type: input.encounterType,
        reason_for_visit: input.reasonForVisit || null,
        status: 'scheduled',
      })
      .select('id, appointment_time')
      .single();

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      // Check if it's a conflict error from the database trigger
      if (errorMessage.includes('APPOINTMENT_CONFLICT')) {
        return failure('CONSTRAINT_VIOLATION', errorMessage.replace('APPOINTMENT_CONFLICT: ', ''));
      }
      await auditLogger.error(
        'APPOINTMENT_SCHEDULE_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { input }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    await auditLogger.info('APPOINTMENT_SCHEDULED', {
      appointmentId: data.id,
      providerId: input.providerId,
      patientId: input.patientId,
      appointmentTime: input.appointmentTime.toISOString(),
    });

    return success(data);
  } catch (err: unknown) {
    await auditLogger.error(
      'APPOINTMENT_SCHEDULE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { input }
    );
    return failure('UNKNOWN_ERROR', 'Failed to schedule appointment');
  }
}

/**
 * Get provider's appointments for a specific date range
 *
 * @param providerId - The provider's UUID
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @returns ServiceResult with appointments array
 */
export async function getProviderAppointments(
  providerId: string,
  startDate: Date,
  endDate: Date
): Promise<ServiceResult<ConflictingAppointment[]>> {
  try {
    const { data, error } = await supabase
      .from('telehealth_appointments')
      .select(`
        id,
        appointment_time,
        duration_minutes,
        encounter_type,
        patient:profiles!patient_id(first_name, last_name)
      `)
      .eq('provider_id', providerId)
      .gte('appointment_time', startDate.toISOString())
      .lte('appointment_time', endDate.toISOString())
      .in('status', ['scheduled', 'confirmed', 'in-progress'])
      .order('appointment_time', { ascending: true });

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    interface PatientInfo {
      first_name?: string;
      last_name?: string;
    }

    interface AppointmentRow {
      id: string;
      appointment_time: string;
      duration_minutes: number;
      encounter_type: string;
      patient?: PatientInfo | PatientInfo[];
    }

    const appointments = ((data || []) as AppointmentRow[]).map((apt) => {
      const patient = Array.isArray(apt.patient) ? apt.patient[0] : apt.patient;
      return {
        id: apt.id,
        patient_name: `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || 'Unknown',
        appointment_time: apt.appointment_time,
        duration_minutes: apt.duration_minutes,
        encounter_type: apt.encounter_type,
      };
    });

    return success(appointments);
  } catch (err: unknown) {
    await auditLogger.error(
      'GET_PROVIDER_APPOINTMENTS_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { providerId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get provider appointments');
  }
}

/**
 * Reschedule an existing appointment to a new time.
 * Includes conflict checking, availability validation, and audit logging.
 *
 * @param input - Reschedule details including new time and reason
 * @returns ServiceResult with reschedule information or error
 */
export async function rescheduleAppointment(
  input: RescheduleInput
): Promise<ServiceResult<RescheduleResult>> {
  try {
    const { data, error } = await supabase.rpc('reschedule_appointment', {
      p_appointment_id: input.appointmentId,
      p_new_appointment_time: input.newAppointmentTime.toISOString(),
      p_new_duration_minutes: input.newDurationMinutes || null,
      p_change_reason: input.changeReason || null,
      p_changed_by_role: input.changedByRole || 'provider',
    });

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'APPOINTMENT_RESCHEDULE_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { appointmentId: input.appointmentId, newTime: input.newAppointmentTime.toISOString() }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    // Handle RPC response
    const result = data as Record<string, unknown>;

    if (!result || result.success === false) {
      const errorCode = String(result?.error || 'UNKNOWN_ERROR');
      const errorMessage = String(result?.message || 'Failed to reschedule appointment');

      await auditLogger.warn('APPOINTMENT_RESCHEDULE_BLOCKED', {
        appointmentId: input.appointmentId,
        error: errorCode,
        message: errorMessage,
      });

      // Map database errors to service error codes
      if (errorCode === 'APPOINTMENT_NOT_FOUND') {
        return failure('NOT_FOUND', errorMessage);
      }
      if (errorCode === 'PERMISSION_DENIED') {
        return failure('FORBIDDEN', errorMessage);
      }
      if (errorCode === 'APPOINTMENT_CONFLICT' || errorCode === 'PROVIDER_UNAVAILABLE') {
        return failure('CONSTRAINT_VIOLATION', errorMessage);
      }

      return failure('VALIDATION_ERROR', errorMessage);
    }

    const rescheduleResult: RescheduleResult = {
      appointmentId: String(result.appointment_id || ''),
      previousTime: String(result.previous_time || ''),
      newTime: String(result.new_time || ''),
      previousDuration: Number(result.previous_duration || 0),
      newDuration: Number(result.new_duration || 0),
      status: String(result.status || ''),
      providerId: String(result.provider_id || ''),
      patientId: String(result.patient_id || ''),
    };

    await auditLogger.info('APPOINTMENT_RESCHEDULED', {
      appointmentId: rescheduleResult.appointmentId,
      previousTime: rescheduleResult.previousTime,
      newTime: rescheduleResult.newTime,
      reason: input.changeReason,
    });

    return success(rescheduleResult);
  } catch (err: unknown) {
    await auditLogger.error(
      'APPOINTMENT_RESCHEDULE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { appointmentId: input.appointmentId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to reschedule appointment');
  }
}

/**
 * Get the change history for an appointment.
 * Shows all reschedules, cancellations, and status changes.
 *
 * @param appointmentId - The appointment UUID
 * @returns ServiceResult with history entries
 */
export async function getAppointmentHistory(
  appointmentId: string
): Promise<ServiceResult<AppointmentHistoryEntry[]>> {
  try {
    const { data, error } = await supabase.rpc('get_appointment_history', {
      p_appointment_id: appointmentId,
    });

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);

      if (errorMessage.includes('Permission denied')) {
        return failure('FORBIDDEN', 'You do not have access to view this appointment history');
      }

      await auditLogger.error(
        'GET_APPOINTMENT_HISTORY_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { appointmentId }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    const history: AppointmentHistoryEntry[] = ((data || []) as Record<string, unknown>[]).map(
      (entry) => ({
        id: String(entry.id || ''),
        changeType: entry.change_type as AppointmentHistoryEntry['changeType'],
        previousAppointmentTime: entry.previous_appointment_time ? String(entry.previous_appointment_time) : null,
        newAppointmentTime: entry.new_appointment_time ? String(entry.new_appointment_time) : null,
        previousDurationMinutes: entry.previous_duration_minutes ? Number(entry.previous_duration_minutes) : null,
        newDurationMinutes: entry.new_duration_minutes ? Number(entry.new_duration_minutes) : null,
        previousStatus: entry.previous_status ? String(entry.previous_status) : null,
        newStatus: entry.new_status ? String(entry.new_status) : null,
        changeReason: entry.change_reason ? String(entry.change_reason) : null,
        changedBy: entry.changed_by ? String(entry.changed_by) : null,
        changedByRole: entry.changed_by_role ? String(entry.changed_by_role) : null,
        changedByName: String(entry.changed_by_name || 'Unknown'),
        createdAt: String(entry.created_at || ''),
      })
    );

    return success(history);
  } catch (err: unknown) {
    await auditLogger.error(
      'GET_APPOINTMENT_HISTORY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { appointmentId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get appointment history');
  }
}

/**
 * Cancel an appointment with reason tracking.
 *
 * @param appointmentId - The appointment UUID
 * @param cancellationReason - Reason for cancellation
 * @returns ServiceResult with success status
 */
export async function cancelAppointment(
  appointmentId: string,
  cancellationReason?: string
): Promise<ServiceResult<{ cancelled: boolean }>> {
  try {
    const { error } = await supabase
      .from('telehealth_appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancellationReason || null,
      })
      .eq('id', appointmentId);

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'APPOINTMENT_CANCEL_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { appointmentId }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    await auditLogger.info('APPOINTMENT_CANCELLED', {
      appointmentId,
      reason: cancellationReason,
    });

    return success({ cancelled: true });
  } catch (err: unknown) {
    await auditLogger.error(
      'APPOINTMENT_CANCEL_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { appointmentId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to cancel appointment');
  }
}

// Export as a namespace object for consistent usage pattern
export const AppointmentService = {
  checkAppointmentAvailability,
  scheduleAppointment,
  getProviderAppointments,
  rescheduleAppointment,
  getAppointmentHistory,
  cancelAppointment,
};

export default AppointmentService;
