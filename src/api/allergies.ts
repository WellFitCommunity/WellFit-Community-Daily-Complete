/**
 * Allergy Intolerance API
 * CRITICAL SAFETY FEATURE for medication management
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from '../services/auditLogger';

export interface AllergyIntolerance {
  id: string;
  user_id: string;
  allergen_type: 'medication' | 'food' | 'environment' | 'biologic';
  allergen_name: string;
  allergen_code?: string;
  clinical_status: 'active' | 'inactive' | 'resolved';
  verification_status: 'unconfirmed' | 'confirmed' | 'refuted' | 'entered-in-error';
  criticality?: 'low' | 'high' | 'unable-to-assess';
  severity?: 'mild' | 'moderate' | 'severe';
  reaction_manifestation?: string[];
  reaction_description?: string;
  onset_date?: string;
  last_occurrence_date?: string;
  recorded_by?: string;
  recorded_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Get all allergies for a user
export async function getAllergies(userId: string): Promise<ApiResponse<AllergyIntolerance[]>> {
  try {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .select('*')
      .eq('user_id', userId)
      .order('criticality', { ascending: false, nullsFirst: false })
      .order('allergen_name');

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch allergies';
    auditLogger.error('Failed to fetch allergies', errorMessage, { userId });
    return { success: false, error: errorMessage };
  }
}

// Get active allergies only
export async function getActiveAllergies(userId: string): Promise<ApiResponse<AllergyIntolerance[]>> {
  try {
    const { data, error } = await supabase
      .rpc('get_active_allergies', { user_id_param: userId });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch active allergies';
    auditLogger.error('Failed to fetch active allergies', errorMessage, { userId });
    return { success: false, error: errorMessage };
  }
}

// Add new allergy
export async function addAllergy(allergy: Partial<AllergyIntolerance>): Promise<ApiResponse<AllergyIntolerance>> {
  try {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .insert([allergy])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data, error: undefined };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to add allergy';
    auditLogger.error('Failed to add allergy', errorMessage, { allergen: allergy.allergen_name });
    return { success: false, error: errorMessage };
  }
}

// Update allergy
export async function updateAllergy(id: string, updates: Partial<AllergyIntolerance>): Promise<ApiResponse<AllergyIntolerance>> {
  try {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update allergy';
    auditLogger.error('Failed to update allergy', errorMessage, { allergyId: id });
    return { success: false, error: errorMessage };
  }
}

// Delete allergy
export async function deleteAllergy(id: string): Promise<ApiResponse> {
  try {
    const { error } = await supabase
      .from('allergy_intolerances')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete allergy';
    auditLogger.error('Failed to delete allergy', errorMessage, { allergyId: id });
    return { success: false, error: errorMessage };
  }
}

// CRITICAL: Check if medication causes allergy
export async function checkMedicationAllergy(userId: string, medicationName: string): Promise<ApiResponse<{
  has_allergy: boolean;
  allergy_id?: string;
  allergen_name?: string;
  criticality?: string;
  severity?: string;
  reaction_description?: string;
}[]>> {
  try {
    const { data, error } = await supabase
      .rpc('check_medication_allergy', {
        user_id_param: userId,
        medication_name_param: medicationName
      });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to check allergy';
    auditLogger.error('Failed to check medication allergy', errorMessage, { userId, medicationName });
    return { success: false, error: errorMessage };
  }
}

const AllergiesAPI = {
  getAllergies,
  getActiveAllergies,
  addAllergy,
  updateAllergy,
  deleteAllergy,
  checkMedicationAllergy
};

export default AllergiesAPI;
