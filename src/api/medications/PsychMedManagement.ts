/**
 * Psychiatric Medication Management
 * Specialized tracking for psychiatric medications and multi-med alerts
 */

import { supabase } from '../../lib/supabaseClient';
import { psychMedClassifier, type PsychMedAlert } from '../../services/psychMedClassifier';
import type { ApiResponse, Medication } from './types';

/**
 * Check if user has multiple psychiatric medications and create/update alerts
 * Internal function used by createMedication
 */
export async function checkAndAlertMultiplePsychMeds(userId: string): Promise<void> {
  try {
    // Get all active medications for user
    const { data: medications } = await supabase
      .from('medications')
      .select('id, medication_name, generic_name, status, is_psychiatric, psych_category')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (!medications) return;

    // Analyze for multiple psych meds
    const analysis = psychMedClassifier.analyzeMultiplePsychMeds(medications);

    if (analysis.hasMultiplePsychMeds) {
      // Check if alert already exists
      const { data: existingAlerts } = await supabase
        .from('psych_med_alerts')
        .select('id')
        .eq('user_id', userId)
        .eq('alert_type', 'multiple_psych_meds')
        .eq('resolved', false)
        .limit(1);

      if (!existingAlerts || existingAlerts.length === 0) {
        // Create new alert
        await supabase.from('psych_med_alerts').insert([{
          user_id: userId,
          alert_type: 'multiple_psych_meds',
          severity: analysis.psychMedCount >= 3 ? 'critical' : 'warning',
          psych_med_count: analysis.psychMedCount,
          medication_ids: analysis.medications.map(m => m.id),
          medication_names: analysis.medications.map(m => m.name),
          categories: analysis.medications.map(m => m.category),
          warnings: analysis.warnings,
          requires_review: analysis.requiresReview
        }]);
      }
    } else {
      // Auto-resolve existing alerts if psych med count is now 0 or 1
      await supabase
        .from('psych_med_alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_notes: `Auto-resolved: Psych medication count reduced to ${analysis.psychMedCount}`
        })
        .eq('user_id', userId)
        .eq('alert_type', 'multiple_psych_meds')
        .eq('resolved', false);
    }
  } catch (error) {
    // Silent fail - don't block medication creation
  }
}

/**
 * Get psychiatric medications for a user
 */
export async function getPsychiatricMedications(
  userId: string
): Promise<ApiResponse<Medication[]>> {
  try {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('is_psychiatric', true)
      .order('medication_name');

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch psychiatric medications'
    };
  }
}

/**
 * Check user for multiple psych meds and get analysis
 */
export async function checkMultiplePsychMeds(
  userId: string
): Promise<ApiResponse<PsychMedAlert>> {
  try {
    // Get all active medications
    const { data: medications } = await supabase
      .from('medications')
      .select('id, medication_name, generic_name, status, is_psychiatric, psych_category')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (!medications) {
      return {
        success: false,
        error: 'No medications found'
      };
    }

    // Analyze for multiple psych meds
    const analysis = psychMedClassifier.analyzeMultiplePsychMeds(medications);

    // Update alerts
    await checkAndAlertMultiplePsychMeds(userId);

    return {
      success: true,
      data: analysis
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check psychiatric medications'
    };
  }
}

/**
 * Get active psych med alerts for a user
 */
export async function getPsychMedAlerts(
  userId: string
): Promise<ApiResponse<any[]>> {
  try {
    const { data, error } = await supabase
      .from('psych_med_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch psych med alerts'
    };
  }
}

/**
 * Acknowledge a psych med alert
 */
export async function acknowledgePsychMedAlert(
  alertId: string,
  userId: string
): Promise<ApiResponse> {
  try {
    const { error } = await supabase
      .from('psych_med_alerts')
      .update({
        acknowledged: true,
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', alertId);

    if (error) throw error;

    return {
      success: true,
      message: 'Alert acknowledged'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to acknowledge alert'
    };
  }
}
