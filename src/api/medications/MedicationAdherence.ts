/**
 * Medication Adherence Tracking
 * Track doses taken, adherence rates, and refill needs
 */

import { supabase } from '../../lib/supabaseClient';
import type { ApiResponse, Medication, MedicationDoseTaken, MedicationAdherenceRate, UpcomingReminder } from './types';

/**
 * Record a dose taken
 */
export async function recordDoseTaken(
  doseData: Partial<MedicationDoseTaken>
): Promise<ApiResponse<MedicationDoseTaken>> {
  try {
    const { data, error } = await supabase
      .from('medication_doses_taken')
      .insert([doseData])
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
      message: 'Dose recorded successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record dose'
    };
  }
}

/**
 * Get adherence rate for a medication
 */
export async function getMedicationAdherence(
  userId: string,
  medicationId?: string,
  daysBack: number = 30
): Promise<ApiResponse<MedicationAdherenceRate[]>> {
  try {
    const { data, error } = await supabase
      .rpc('get_medication_adherence_rate', {
        user_id_param: userId,
        days_back: daysBack
      });

    if (error) throw error;

    const adherenceData = (data || []) as MedicationAdherenceRate[];

    // Filter by medication if specified
    const result = medicationId
      ? adherenceData.filter((item) => item.medication_id === medicationId)
      : adherenceData;

    return {
      success: true,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate adherence'
    };
  }
}

/**
 * Get medications needing refill
 */
export async function getMedicationsNeedingRefill(
  userId: string,
  daysThreshold: number = 7
): Promise<ApiResponse<Medication[]>> {
  try {
    const { data, error } = await supabase
      .rpc('get_medications_needing_refill', {
        user_id_param: userId,
        days_threshold: daysThreshold
      });

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch medications needing refill'
    };
  }
}

/**
 * Get upcoming reminders
 */
export async function getUpcomingReminders(
  userId: string,
  hoursAhead: number = 24
): Promise<ApiResponse<UpcomingReminder[]>> {
  try {
    const { data, error } = await supabase
      .rpc('get_upcoming_reminders', {
        user_id_param: userId,
        hours_ahead: hoursAhead
      });

    if (error) throw error;

    return {
      success: true,
      data: (data || []) as UpcomingReminder[]
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch upcoming reminders'
    };
  }
}
