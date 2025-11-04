/**
 * Medication CRUD Operations
 * Basic create, read, update, delete operations for medications
 */

import { supabase } from '../../lib/supabaseClient';
import { psychMedClassifier } from '../../services/psychMedClassifier';
import type { ApiResponse, Medication } from './types';

// Import for cross-module dependency
import { checkAndAlertMultiplePsychMeds } from './PsychMedManagement';

/**
 * Get all medications for a user
 */
export async function getMedications(
  userId: string,
  status?: 'active' | 'discontinued' | 'completed'
): Promise<ApiResponse<Medication[]>> {
  try {
    let query = supabase
      .from('medications')
      .select('*')
      .eq('user_id', userId)
      .order('medication_name');

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch medications'
    };
  }
}

/**
 * Get a single medication by ID
 */
export async function getMedication(medicationId: string): Promise<ApiResponse<Medication>> {
  try {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('id', medicationId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Medication not found');

    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch medication'
    };
  }
}

/**
 * Create a new medication
 */
export async function createMedication(
  medicationData: Partial<Medication>
): Promise<ApiResponse<Medication>> {
  try {
    // Classify medication as psychiatric or not
    const classification = psychMedClassifier.classifyMedication(
      medicationData.medication_name || '',
      medicationData.generic_name
    );

    // Add psychiatric classification to medication data
    const enrichedData = {
      ...medicationData,
      is_psychiatric: classification.isPsychiatric,
      psych_category: classification.category,
      psych_subcategory: classification.subcategory,
      psych_classification_confidence: classification.confidence
    };

    const { data, error } = await supabase
      .from('medications')
      .insert([enrichedData])
      .select()
      .single();

    if (error) throw error;

    // Check for multiple psych meds if this is a psychiatric medication
    if (classification.isPsychiatric && medicationData.user_id) {
      await checkAndAlertMultiplePsychMeds(medicationData.user_id);
    }

    return {
      success: true,
      data,
      message: 'Medication added to cabinet successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create medication'
    };
  }
}

/**
 * Update a medication
 */
export async function updateMedication(
  medicationId: string,
  updates: Partial<Medication>
): Promise<ApiResponse<Medication>> {
  try {
    const { data, error } = await supabase
      .from('medications')
      .update(updates)
      .eq('id', medicationId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
      message: 'Medication updated successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update medication'
    };
  }
}

/**
 * Delete a medication
 */
export async function deleteMedication(medicationId: string): Promise<ApiResponse> {
  try {
    const { error } = await supabase
      .from('medications')
      .delete()
      .eq('id', medicationId);

    if (error) throw error;

    return {
      success: true,
      message: 'Medication removed from cabinet'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete medication'
    };
  }
}

/**
 * Discontinue a medication
 */
export async function discontinueMedication(
  medicationId: string,
  reason?: string
): Promise<ApiResponse<Medication>> {
  try {
    const updates: Partial<Medication> = {
      status: 'discontinued',
      discontinued_date: new Date().toISOString().split('T')[0],
      discontinued_reason: reason
    };

    const { data, error } = await supabase
      .from('medications')
      .update(updates)
      .eq('id', medicationId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
      message: 'Medication discontinued'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to discontinue medication'
    };
  }
}
