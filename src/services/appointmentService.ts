/**
 * Appointment Service
 *
 * Handles appointment scheduling operations including:
 * - Conflict detection (double-booking prevention)
 * - Appointment CRUD operations
 * - Availability checking
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

// Export as a namespace object for consistent usage pattern
export const AppointmentService = {
  checkAppointmentAvailability,
  scheduleAppointment,
  getProviderAppointments,
};

export default AppointmentService;
