/**
 * Appointment Reminder Service
 *
 * Handles appointment reminder preferences and scheduling including:
 * - User reminder preferences (timing, channels, DND)
 * - Getting appointments needing reminders
 * - Marking reminders as sent
 *
 * @module appointmentReminderService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// ============================================================================
// TYPES
// ============================================================================

export type ReminderType = '24h' | '1h' | '15m';

export interface ReminderPreferences {
  userId: string;
  reminder24hEnabled: boolean;
  reminder1hEnabled: boolean;
  reminder15mEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  dndStartTime: string | null;  // HH:MM format
  dndEndTime: string | null;    // HH:MM format
  timezone: string;
}

export interface ReminderPreferencesInput {
  reminder24hEnabled?: boolean;
  reminder1hEnabled?: boolean;
  reminder15mEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  dndStartTime?: string | null;
  dndEndTime?: string | null;
  timezone?: string;
}

export interface AppointmentNeedingReminder {
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  patientEmail: string | null;
  providerName: string;
  appointmentTime: Date;
  durationMinutes: number;
  encounterType: string;
  reasonForVisit: string | null;
  tenantId: string | null;
  // Preferences
  smsEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  dndStartTime: string | null;
  dndEndTime: string | null;
  timezone: string;
}

export interface ReminderSendResult {
  smsSent: boolean;
  smsSid?: string;
  pushSent: boolean;
  emailSent: boolean;
}

export interface ReminderLogEntry {
  id: string;
  appointmentId: string;
  patientId: string;
  reminderType: ReminderType;
  smsSent: boolean;
  smsSid: string | null;
  smsStatus: string | null;
  pushSent: boolean;
  pushStatus: string | null;
  emailSent: boolean;
  emailStatus: string | null;
  status: 'pending' | 'sent' | 'partial' | 'failed' | 'skipped';
  skipReason: string | null;
  scheduledFor: Date;
  sentAt: Date | null;
  createdAt: Date;
}

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * Get reminder preferences for the current user or a specific user.
 *
 * @param userId - Optional user ID (defaults to authenticated user)
 * @returns ServiceResult with preferences
 */
export async function getReminderPreferences(
  userId?: string
): Promise<ServiceResult<ReminderPreferences>> {
  try {
    const { data, error } = await supabase.rpc('get_user_reminder_preferences', {
      p_user_id: userId || null,
    });

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'GET_REMINDER_PREFERENCES_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { userId }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    // Handle the result (returns array with single row)
    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      // Return defaults if no preferences set
      return success({
        userId: userId || '',
        reminder24hEnabled: true,
        reminder1hEnabled: true,
        reminder15mEnabled: false,
        smsEnabled: true,
        pushEnabled: true,
        emailEnabled: false,
        dndStartTime: null,
        dndEndTime: null,
        timezone: 'America/Chicago',
      });
    }

    const preferences: ReminderPreferences = {
      userId: String(result.user_id || ''),
      reminder24hEnabled: result.reminder_24h_enabled === true,
      reminder1hEnabled: result.reminder_1h_enabled === true,
      reminder15mEnabled: result.reminder_15m_enabled === true,
      smsEnabled: result.sms_enabled === true,
      pushEnabled: result.push_enabled === true,
      emailEnabled: result.email_enabled === true,
      dndStartTime: result.dnd_start_time ? String(result.dnd_start_time) : null,
      dndEndTime: result.dnd_end_time ? String(result.dnd_end_time) : null,
      timezone: String(result.timezone || 'America/Chicago'),
    };

    return success(preferences);
  } catch (err: unknown) {
    await auditLogger.error(
      'GET_REMINDER_PREFERENCES_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { userId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get reminder preferences');
  }
}

/**
 * Update reminder preferences for the current user.
 *
 * @param preferences - Partial preferences to update
 * @returns ServiceResult with success status
 */
export async function updateReminderPreferences(
  preferences: ReminderPreferencesInput
): Promise<ServiceResult<{ updated: boolean }>> {
  try {
    const { data, error } = await supabase.rpc('update_user_reminder_preferences', {
      p_reminder_24h_enabled: preferences.reminder24hEnabled ?? null,
      p_reminder_1h_enabled: preferences.reminder1hEnabled ?? null,
      p_reminder_15m_enabled: preferences.reminder15mEnabled ?? null,
      p_sms_enabled: preferences.smsEnabled ?? null,
      p_push_enabled: preferences.pushEnabled ?? null,
      p_email_enabled: preferences.emailEnabled ?? null,
      p_dnd_start_time: preferences.dndStartTime ?? null,
      p_dnd_end_time: preferences.dndEndTime ?? null,
      p_timezone: preferences.timezone ?? null,
    });

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'UPDATE_REMINDER_PREFERENCES_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { preferences }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    const result = data as Record<string, unknown>;

    if (!result || result.success !== true) {
      return failure('OPERATION_FAILED', String(result?.error || 'Failed to update preferences'));
    }

    await auditLogger.info('REMINDER_PREFERENCES_UPDATED', {
      changes: Object.keys(preferences).filter(k => preferences[k as keyof ReminderPreferencesInput] !== undefined),
    });

    return success({ updated: true });
  } catch (err: unknown) {
    await auditLogger.error(
      'UPDATE_REMINDER_PREFERENCES_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { preferences }
    );
    return failure('UNKNOWN_ERROR', 'Failed to update reminder preferences');
  }
}

/**
 * Get appointments that need reminders of a specific type.
 *
 * @param reminderType - Type of reminder ('24h', '1h', '15m')
 * @param batchSize - Maximum number of appointments to return
 * @returns ServiceResult with appointments needing reminders
 */
export async function getAppointmentsNeedingReminders(
  reminderType: ReminderType,
  batchSize: number = 100
): Promise<ServiceResult<AppointmentNeedingReminder[]>> {
  try {
    const { data, error } = await supabase.rpc('get_appointments_needing_reminders', {
      p_reminder_type: reminderType,
      p_batch_size: batchSize,
    });

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'GET_APPOINTMENTS_NEEDING_REMINDERS_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { reminderType, batchSize }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    const appointments: AppointmentNeedingReminder[] = ((data || []) as Record<string, unknown>[]).map(
      (apt) => ({
        appointmentId: String(apt.appointment_id || ''),
        patientId: String(apt.patient_id || ''),
        patientName: String(apt.patient_name || ''),
        patientPhone: apt.patient_phone ? String(apt.patient_phone) : null,
        patientEmail: apt.patient_email ? String(apt.patient_email) : null,
        providerName: String(apt.provider_name || ''),
        appointmentTime: new Date(String(apt.appointment_time)),
        durationMinutes: Number(apt.duration_minutes || 30),
        encounterType: String(apt.encounter_type || 'outpatient'),
        reasonForVisit: apt.reason_for_visit ? String(apt.reason_for_visit) : null,
        tenantId: apt.tenant_id ? String(apt.tenant_id) : null,
        smsEnabled: apt.sms_enabled === true,
        pushEnabled: apt.push_enabled === true,
        emailEnabled: apt.email_enabled === true,
        dndStartTime: apt.dnd_start_time ? String(apt.dnd_start_time) : null,
        dndEndTime: apt.dnd_end_time ? String(apt.dnd_end_time) : null,
        timezone: String(apt.timezone || 'America/Chicago'),
      })
    );

    return success(appointments);
  } catch (err: unknown) {
    await auditLogger.error(
      'GET_APPOINTMENTS_NEEDING_REMINDERS_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { reminderType, batchSize }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get appointments needing reminders');
  }
}

/**
 * Mark a reminder as sent and log the delivery status.
 *
 * @param appointmentId - The appointment UUID
 * @param reminderType - Type of reminder sent
 * @param result - Delivery results for each channel
 * @returns ServiceResult with log ID and status
 */
export async function markReminderSent(
  appointmentId: string,
  reminderType: ReminderType,
  result: ReminderSendResult
): Promise<ServiceResult<{ logId: string; status: string }>> {
  try {
    const { data, error } = await supabase.rpc('mark_reminder_sent', {
      p_appointment_id: appointmentId,
      p_reminder_type: reminderType,
      p_sms_sent: result.smsSent,
      p_sms_sid: result.smsSid || null,
      p_push_sent: result.pushSent,
      p_email_sent: result.emailSent,
    });

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'MARK_REMINDER_SENT_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { appointmentId, reminderType }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    const dbResult = data as Record<string, unknown>;

    if (!dbResult || dbResult.success !== true) {
      return failure('OPERATION_FAILED', String(dbResult?.error || 'Failed to mark reminder sent'));
    }

    await auditLogger.info('APPOINTMENT_REMINDER_SENT', {
      appointmentId,
      reminderType,
      smsSent: result.smsSent,
      pushSent: result.pushSent,
      emailSent: result.emailSent,
      status: dbResult.status,
    });

    return success({
      logId: String(dbResult.log_id || ''),
      status: String(dbResult.status || 'sent'),
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'MARK_REMINDER_SENT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { appointmentId, reminderType }
    );
    return failure('UNKNOWN_ERROR', 'Failed to mark reminder as sent');
  }
}

/**
 * Reset all reminder flags for a rescheduled appointment.
 *
 * @param appointmentId - The appointment UUID
 * @returns ServiceResult with success status
 */
export async function resetAppointmentReminders(
  appointmentId: string
): Promise<ServiceResult<{ reset: boolean }>> {
  try {
    const { data, error } = await supabase.rpc('reset_appointment_reminders', {
      p_appointment_id: appointmentId,
    });

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'RESET_APPOINTMENT_REMINDERS_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { appointmentId }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    await auditLogger.info('APPOINTMENT_REMINDERS_RESET', { appointmentId });

    return success({ reset: data === true });
  } catch (err: unknown) {
    await auditLogger.error(
      'RESET_APPOINTMENT_REMINDERS_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { appointmentId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to reset appointment reminders');
  }
}

/**
 * Get reminder log entries for an appointment.
 *
 * @param appointmentId - The appointment UUID
 * @returns ServiceResult with reminder log entries
 */
export async function getReminderLogs(
  appointmentId: string
): Promise<ServiceResult<ReminderLogEntry[]>> {
  try {
    const { data, error } = await supabase
      .from('appointment_reminder_log')
      .select('*')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: false });

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'GET_REMINDER_LOGS_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { appointmentId }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    const logs: ReminderLogEntry[] = ((data || []) as Record<string, unknown>[]).map(
      (log) => ({
        id: String(log.id || ''),
        appointmentId: String(log.appointment_id || ''),
        patientId: String(log.patient_id || ''),
        reminderType: log.reminder_type as ReminderType,
        smsSent: log.sms_sent === true,
        smsSid: log.sms_sid ? String(log.sms_sid) : null,
        smsStatus: log.sms_status ? String(log.sms_status) : null,
        pushSent: log.push_sent === true,
        pushStatus: log.push_status ? String(log.push_status) : null,
        emailSent: log.email_sent === true,
        emailStatus: log.email_status ? String(log.email_status) : null,
        status: log.status as ReminderLogEntry['status'],
        skipReason: log.skip_reason ? String(log.skip_reason) : null,
        scheduledFor: new Date(String(log.scheduled_for)),
        sentAt: log.sent_at ? new Date(String(log.sent_at)) : null,
        createdAt: new Date(String(log.created_at)),
      })
    );

    return success(logs);
  } catch (err: unknown) {
    await auditLogger.error(
      'GET_REMINDER_LOGS_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { appointmentId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get reminder logs');
  }
}

/**
 * Check if current time is within DND window for a timezone.
 *
 * @param dndStartTime - Start of DND window (HH:MM)
 * @param dndEndTime - End of DND window (HH:MM)
 * @param timezone - IANA timezone name
 * @returns true if currently in DND window
 */
export function isInDndWindow(
  dndStartTime: string | null,
  dndEndTime: string | null,
  timezone: string = 'America/Chicago'
): boolean {
  if (!dndStartTime || !dndEndTime) {
    return false;
  }

  try {
    // Get current time in the user's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const currentTime = formatter.format(now);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    // Parse DND times
    const [startHour, startMinute] = dndStartTime.split(':').map(Number);
    const [endHour, endMinute] = dndEndTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // Handle overnight DND (e.g., 22:00 to 08:00)
    if (startMinutes > endMinutes) {
      // DND spans midnight
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      // DND within same day
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
  } catch {
    return false;
  }
}

/**
 * Format appointment time for reminder message.
 *
 * @param appointmentTime - Appointment date/time
 * @param timezone - IANA timezone name
 * @returns Formatted date and time strings
 */
export function formatAppointmentForReminder(
  appointmentTime: Date,
  timezone: string = 'America/Chicago'
): { date: string; time: string } {
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return {
    date: dateFormatter.format(appointmentTime),
    time: timeFormatter.format(appointmentTime),
  };
}

/**
 * Generate reminder message based on type.
 *
 * @param reminderType - Type of reminder
 * @param patientName - Patient's name
 * @param providerName - Provider's name
 * @param appointmentDate - Formatted date
 * @param appointmentTime - Formatted time
 * @returns Reminder message text
 */
export function generateReminderMessage(
  reminderType: ReminderType,
  patientName: string,
  providerName: string,
  appointmentDate: string,
  appointmentTime: string
): string {
  const firstName = patientName.split(' ')[0];

  switch (reminderType) {
    case '24h':
      return `Hi ${firstName}, this is a reminder that you have a telehealth appointment tomorrow with ${providerName} at ${appointmentTime}. Please ensure you have a stable internet connection and a quiet space for your visit.`;
    case '1h':
      return `Hi ${firstName}, your telehealth appointment with ${providerName} is in 1 hour at ${appointmentTime}. Please be ready to join the video call.`;
    case '15m':
      return `Hi ${firstName}, your telehealth appointment with ${providerName} starts in 15 minutes. Please join the video call now.`;
    default:
      return `Hi ${firstName}, you have a telehealth appointment with ${providerName} on ${appointmentDate} at ${appointmentTime}.`;
  }
}

// Export as a namespace object for consistent usage pattern
export const AppointmentReminderService = {
  getReminderPreferences,
  updateReminderPreferences,
  getAppointmentsNeedingReminders,
  markReminderSent,
  resetAppointmentReminders,
  getReminderLogs,
  isInDndWindow,
  formatAppointmentForReminder,
  generateReminderMessage,
};

export default AppointmentReminderService;
