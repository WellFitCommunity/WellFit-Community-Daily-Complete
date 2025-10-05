// services/mealInteractionService.ts
// Track senior meal interactions for engagement scoring

import { SupabaseClient } from '@supabase/supabase-js';

export interface MealInteraction {
  user_id: string;
  meal_id: string;
  meal_name: string;
  will_make_it: boolean;
  notes?: string;
  rating?: number;
}

export interface MealPhotoUpload {
  interaction_id: string;
  photo_file: File;
  user_id: string;
}

/**
 * Submit meal interaction (yes/no to making the meal)
 */
export async function submitMealInteraction(
  supabase: SupabaseClient,
  interaction: MealInteraction
): Promise<{ data: any; error: any }> {
  try {
    const { data, error } = await supabase
      .from('meal_interactions')
      .insert({
        user_id: interaction.user_id,
        meal_id: interaction.meal_id,
        meal_name: interaction.meal_name,
        will_make_it: interaction.will_make_it,
        notes: interaction.notes,
        rating: interaction.rating,
        responded_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to submit meal interaction:', error);
    }

    return { data, error };
  } catch (err) {
    console.error('Exception submitting meal interaction:', err);
    return { data: null, error: err };
  }
}

/**
 * Upload meal photo and update interaction
 */
export async function uploadMealPhoto(
  supabase: SupabaseClient,
  upload: MealPhotoUpload
): Promise<{ data: any; error: any }> {
  try {
    // 1. Upload photo to storage
    const fileExt = upload.photo_file.name.split('.').pop();
    const fileName = `${upload.user_id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('meal-photos')
      .upload(fileName, upload.photo_file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Failed to upload meal photo:', uploadError);
      return { data: null, error: uploadError };
    }

    // 2. Get public URL
    const { data: urlData } = supabase.storage
      .from('meal-photos')
      .getPublicUrl(fileName);

    // 3. Update meal interaction record
    const { data, error } = await supabase
      .from('meal_interactions')
      .update({
        photo_uploaded: true,
        photo_url: urlData.publicUrl,
        photo_path: fileName,
        photo_uploaded_at: new Date().toISOString()
      })
      .eq('id', upload.interaction_id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update meal interaction with photo:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Exception uploading meal photo:', err);
    return { data: null, error: err };
  }
}

/**
 * Check if user already interacted with this meal
 */
export async function getUserMealInteraction(
  supabase: SupabaseClient,
  userId: string,
  mealId: string
): Promise<{ data: any; error: any }> {
  try {
    const { data, error } = await supabase
      .from('meal_interactions')
      .select('*')
      .eq('user_id', userId)
      .eq('meal_id', mealId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Failed to get user meal interaction:', error);
    }

    return { data, error };
  } catch (err) {
    console.error('Exception getting user meal interaction:', err);
    return { data: null, error: err };
  }
}

/**
 * Get all meals a user plans to make
 */
export async function getUserPlannedMeals(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: any[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('meal_interactions')
      .select('*')
      .eq('user_id', userId)
      .eq('will_make_it', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to get planned meals:', error);
    }

    return { data: data || [], error };
  } catch (err) {
    console.error('Exception getting planned meals:', err);
    return { data: [], error: err };
  }
}

/**
 * Get meal photos for community features (admin)
 */
export async function getAllMealPhotos(
  supabase: SupabaseClient
): Promise<{ data: any[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('meal_interactions')
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name
        )
      `)
      .eq('photo_uploaded', true)
      .order('photo_uploaded_at', { ascending: false });

    if (error) {
      console.error('Failed to get meal photos:', error);
    }

    return { data: data || [], error };
  } catch (err) {
    console.error('Exception getting meal photos:', err);
    return { data: [], error: err };
  }
}
