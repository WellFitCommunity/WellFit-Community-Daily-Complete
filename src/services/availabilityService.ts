/**
 * Provider Availability Service
 *
 * Manages provider availability including:
 * - Weekly working hours
 * - Blocked time periods (vacation, PTO, etc.)
 * - Available slot calculation
 * - Availability validation for appointments
 *
 * @module availabilityService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// ============================================================================
// TYPES
// ============================================================================

export interface DayHours {
  start: string;  // HH:MM format
  end: string;    // HH:MM format
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type WeeklyAvailability = Partial<Record<DayOfWeek, DayHours>>;

export interface BlockedTime {
  id: string;
  provider_id: string;
  start_time: string;
  end_time: string;
  reason?: string;
  description?: string;
  created_at: string;
}

export interface BlockedTimeInput {
  providerId: string;
  startTime: Date;
  endTime: Date;
  reason?: string;
  description?: string;
}

export interface TimeSlot {
  slotStart: Date;
  slotEnd: Date;
  isAvailable: boolean;
}

export interface AvailabilityCheckResult {
  isAvailable: boolean;
  reason?: string;
  conflictingAppointmentId?: string;
  blockedTimeId?: string;
}

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * Get a provider's weekly availability hours
 */
export async function getProviderAvailability(
  providerId: string
): Promise<ServiceResult<WeeklyAvailability>> {
  try {
    const { data, error } = await supabase.rpc('get_provider_availability_hours', {
      p_provider_id: providerId,
    });

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'GET_PROVIDER_AVAILABILITY_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { providerId }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    return success(data as WeeklyAvailability || {});
  } catch (err: unknown) {
    await auditLogger.error(
      'GET_PROVIDER_AVAILABILITY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { providerId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get provider availability');
  }
}

/**
 * Update a provider's weekly availability hours
 */
export async function updateProviderAvailability(
  providerId: string,
  availability: WeeklyAvailability
): Promise<ServiceResult<boolean>> {
  try {
    // Validate the availability format
    const validDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const [day, hours] of Object.entries(availability)) {
      if (!validDays.includes(day as DayOfWeek)) {
        return failure('VALIDATION_ERROR', `Invalid day: ${day}`);
      }
      if (hours) {
        if (!hours.start || !hours.end) {
          return failure('VALIDATION_ERROR', `Missing start or end time for ${day}`);
        }
        // Validate time format HH:MM
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(hours.start) || !timeRegex.test(hours.end)) {
          return failure('VALIDATION_ERROR', `Invalid time format for ${day}. Use HH:MM format.`);
        }
        // Validate end is after start
        if (hours.start >= hours.end) {
          return failure('VALIDATION_ERROR', `End time must be after start time for ${day}`);
        }
      }
    }

    const { data, error } = await supabase.rpc('update_provider_availability', {
      p_provider_id: providerId,
      p_availability_hours: availability,
    });

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'UPDATE_PROVIDER_AVAILABILITY_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { providerId }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    await auditLogger.info('PROVIDER_AVAILABILITY_UPDATED', {
      providerId,
      availability,
    });

    return success(data === true);
  } catch (err: unknown) {
    await auditLogger.error(
      'UPDATE_PROVIDER_AVAILABILITY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { providerId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to update provider availability');
  }
}

/**
 * Check if a provider is available at a specific time
 */
export async function checkProviderAvailability(
  providerId: string,
  startTime: Date,
  durationMinutes: number
): Promise<ServiceResult<AvailabilityCheckResult>> {
  try {
    const { data, error } = await supabase.rpc('is_provider_available', {
      p_provider_id: providerId,
      p_start_time: startTime.toISOString(),
      p_duration_minutes: durationMinutes,
    });

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'CHECK_PROVIDER_AVAILABILITY_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { providerId, startTime: startTime.toISOString() }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    // Handle array result from RPC
    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      return success({
        isAvailable: true,
        reason: undefined,
      });
    }

    return success({
      isAvailable: result.is_available === true,
      reason: result.reason || undefined,
      conflictingAppointmentId: result.conflicting_appointment_id || undefined,
      blockedTimeId: result.blocked_time_id || undefined,
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'CHECK_PROVIDER_AVAILABILITY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { providerId, startTime: startTime.toISOString() }
    );
    return failure('UNKNOWN_ERROR', 'Failed to check provider availability');
  }
}

/**
 * Get available time slots for a provider on a specific date
 */
export async function getAvailableSlots(
  providerId: string,
  date: Date,
  durationMinutes: number = 30,
  slotIntervalMinutes: number = 15
): Promise<ServiceResult<TimeSlot[]>> {
  try {
    // Format date as YYYY-MM-DD for the RPC
    const dateStr = date.toISOString().split('T')[0];

    const { data, error } = await supabase.rpc('get_available_slots', {
      p_provider_id: providerId,
      p_date: dateStr,
      p_duration_minutes: durationMinutes,
      p_slot_interval_minutes: slotIntervalMinutes,
    });

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'GET_AVAILABLE_SLOTS_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { providerId, date: dateStr }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    interface SlotRow {
      slot_start: string;
      slot_end: string;
      is_available: boolean;
    }

    const slots: TimeSlot[] = ((data || []) as SlotRow[]).map((row) => ({
      slotStart: new Date(row.slot_start),
      slotEnd: new Date(row.slot_end),
      isAvailable: row.is_available === true,
    }));

    return success(slots);
  } catch (err: unknown) {
    await auditLogger.error(
      'GET_AVAILABLE_SLOTS_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { providerId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get available slots');
  }
}

/**
 * Get blocked time periods for a provider
 */
export async function getBlockedTimes(
  providerId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ServiceResult<BlockedTime[]>> {
  try {
    let query = supabase
      .from('provider_blocked_times')
      .select('*')
      .eq('provider_id', providerId)
      .order('start_time', { ascending: true });

    if (startDate) {
      query = query.gte('end_time', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('start_time', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    return success(data as BlockedTime[] || []);
  } catch (err: unknown) {
    await auditLogger.error(
      'GET_BLOCKED_TIMES_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { providerId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get blocked times');
  }
}

/**
 * Add a blocked time period for a provider
 */
export async function addBlockedTime(
  input: BlockedTimeInput
): Promise<ServiceResult<BlockedTime>> {
  try {
    // Validate time range
    if (input.endTime <= input.startTime) {
      return failure('VALIDATION_ERROR', 'End time must be after start time');
    }

    const { data, error } = await supabase
      .from('provider_blocked_times')
      .insert({
        provider_id: input.providerId,
        start_time: input.startTime.toISOString(),
        end_time: input.endTime.toISOString(),
        reason: input.reason || null,
        description: input.description || null,
      })
      .select()
      .single();

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'ADD_BLOCKED_TIME_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { input }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    await auditLogger.info('BLOCKED_TIME_ADDED', {
      blockedTimeId: data.id,
      providerId: input.providerId,
      startTime: input.startTime.toISOString(),
      endTime: input.endTime.toISOString(),
      reason: input.reason,
    });

    return success(data as BlockedTime);
  } catch (err: unknown) {
    await auditLogger.error(
      'ADD_BLOCKED_TIME_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { input }
    );
    return failure('UNKNOWN_ERROR', 'Failed to add blocked time');
  }
}

/**
 * Remove a blocked time period
 */
export async function removeBlockedTime(
  blockedTimeId: string,
  providerId: string
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from('provider_blocked_times')
      .delete()
      .eq('id', blockedTimeId)
      .eq('provider_id', providerId);

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      await auditLogger.error(
        'REMOVE_BLOCKED_TIME_FAILED',
        error instanceof Error ? error : new Error(errorMessage),
        { blockedTimeId, providerId }
      );
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    await auditLogger.info('BLOCKED_TIME_REMOVED', {
      blockedTimeId,
      providerId,
    });

    return success(true);
  } catch (err: unknown) {
    await auditLogger.error(
      'REMOVE_BLOCKED_TIME_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { blockedTimeId, providerId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to remove blocked time');
  }
}

/**
 * Get available slots for multiple days (useful for calendars)
 */
export async function getAvailableSlotsForDateRange(
  providerId: string,
  startDate: Date,
  endDate: Date,
  durationMinutes: number = 30,
  slotIntervalMinutes: number = 15
): Promise<ServiceResult<Record<string, TimeSlot[]>>> {
  try {
    const result: Record<string, TimeSlot[]> = {};
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const slotsResult = await getAvailableSlots(
        providerId,
        new Date(currentDate),
        durationMinutes,
        slotIntervalMinutes
      );

      if (slotsResult.success) {
        result[dateStr] = slotsResult.data;
      } else {
        result[dateStr] = [];
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return success(result);
  } catch (err: unknown) {
    await auditLogger.error(
      'GET_AVAILABLE_SLOTS_RANGE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { providerId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get available slots for date range');
  }
}

// Export as namespace
export const AvailabilityService = {
  getProviderAvailability,
  updateProviderAvailability,
  checkProviderAvailability,
  getAvailableSlots,
  getAvailableSlotsForDateRange,
  getBlockedTimes,
  addBlockedTime,
  removeBlockedTime,
};

export default AvailabilityService;
