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
      .select('*')
      .eq('medication_id', medicationId)
      .order('time_of_day');

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
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
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
      message: 'Reminder created successfully'
    };
  } catch (error) {
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
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
      message: 'Reminder updated successfully'
    };
  } catch (error) {
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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete reminder'
    };
  }
}
