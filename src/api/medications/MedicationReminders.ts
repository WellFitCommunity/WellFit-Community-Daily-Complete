/**
 * Medication Reminders
 * Reminder management for medication scheduling
 */

import { supabase } from '../../lib/supabaseClient';
import type { ApiResponse, MedicationReminder } from './types';

/**
 * Get reminders for a medication
 */
export async function getMedicationReminders(
  medicationId: string
): Promise<ApiResponse<MedicationReminder[]>> {
  try {
    const { data, error } = await supabase
      .from('medication_reminders')
      .select('id, medication_id, user_id, time_of_day, days_of_week, enabled, notification_method, last_reminded_at, next_reminder_at, created_at, updated_at')
      .eq('medication_id', medicationId)
      .order('time_of_day');

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch reminders'
    };
  }
}

/**
 * Create a medication reminder
 */
export async function createMedicationReminder(
  reminderData: Partial<MedicationReminder>
): Promise<ApiResponse<MedicationReminder>> {
  try {
    const { data, error} = await supabase
      .from('medication_reminders')
      .insert([reminderData])
      .select('id, medication_id, user_id, time_of_day, days_of_week, enabled, notification_method, last_reminded_at, next_reminder_at, created_at, updated_at')
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
      message: 'Reminder created successfully'
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create reminder'
    };
  }
}

/**
 * Update a medication reminder
 */
export async function updateMedicationReminder(
  reminderId: string,
  updates: Partial<MedicationReminder>
): Promise<ApiResponse<MedicationReminder>> {
  try {
    const { data, error } = await supabase
      .from('medication_reminders')
      .update(updates)
      .eq('id', reminderId)
      .select('id, medication_id, user_id, time_of_day, days_of_week, enabled, notification_method, last_reminded_at, next_reminder_at, created_at, updated_at')
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
      message: 'Reminder updated successfully'
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update reminder'
    };
  }
}

/**
 * Delete a medication reminder
 */
export async function deleteMedicationReminder(reminderId: string): Promise<ApiResponse> {
  try {
    const { error } = await supabase
      .from('medication_reminders')
      .delete()
      .eq('id', reminderId);

    if (error) throw error;

    return {
      success: true,
      message: 'Reminder deleted successfully'
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete reminder'
    };
  }
}
