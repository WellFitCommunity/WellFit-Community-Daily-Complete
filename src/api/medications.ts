/**
 * Medication API
 *
 * RESTful API endpoints for Medicine Cabinet operations
 * Handles medication CRUD, label reading, reminders, and adherence tracking
 *
 * @module api/medications
 * @version 1.0.0
 */

import { supabase } from '../lib/supabaseClient';
import { medicationLabelReader, MedicationInfo, LabelExtractionResult } from '../services/medicationLabelReader';
import { pillIdentifier, PillIdentificationResult, PillLabelComparison } from '../services/pillIdentifierService';
import { psychMedClassifier, PsychMedAlert } from '../services/psychMedClassifier';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Medication {
  id: string;
  user_id: string;
  medication_name: string;
  generic_name?: string;
  brand_name?: string;
  dosage?: string;
  dosage_form?: string;
  strength?: string;
  instructions?: string;
  frequency?: string;
  route?: string;
  prescribed_by?: string;
  prescribed_date?: string;
  prescription_number?: string;
  pharmacy_name?: string;
  pharmacy_phone?: string;
  quantity?: number;
  refills_remaining?: number;
  last_refill_date?: string;
  next_refill_date?: string;
  ndc_code?: string;
  purpose?: string;
  side_effects?: string[];
  warnings?: string[];
  interactions?: string[];
  status: 'active' | 'discontinued' | 'completed';
  discontinued_date?: string;
  discontinued_reason?: string;
  ai_confidence?: number;
  extraction_notes?: string;
  needs_review?: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  // Psychiatric medication flags
  is_psychiatric?: boolean;
  psych_category?: string;
  psych_subcategory?: string;
  psych_classification_confidence?: number;
  created_at: string;
  updated_at: string;
}

export interface MedicationReminder {
  id: string;
  medication_id: string;
  user_id: string;
  time_of_day: string; // "08:00:00"
  days_of_week?: number[]; // [0,1,2,3,4,5,6]
  enabled: boolean;
  notification_method: 'push' | 'sms' | 'email' | 'all';
  last_reminded_at?: string;
  next_reminder_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MedicationDoseTaken {
  id: string;
  medication_id: string;
  user_id: string;
  reminder_id?: string;
  taken_at: string;
  scheduled_time?: string;
  dose_amount?: string;
  status: 'taken' | 'missed' | 'skipped';
  skip_reason?: string;
  notes?: string;
  side_effects_noted?: string[];
  created_at: string;
}

// ============================================================================
// MEDICATION CRUD
// ============================================================================

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

// ============================================================================
// LABEL READING
// ============================================================================

/**
 * Extract medication information from image
 */
export async function extractMedicationFromImage(
  userId: string,
  imageFile: File
): Promise<ApiResponse<{ extraction: LabelExtractionResult; medication?: Medication }>> {
  try {
    // Extract info from image
    const extraction = await medicationLabelReader.extractFromImage(imageFile);

    if (!extraction.success || !extraction.medication) {
      return {
        success: false,
        error: extraction.error || 'Failed to extract medication information',
        data: { extraction }
      };
    }

    // Save extraction metadata
    await supabase.from('medication_image_extractions').insert([{
      user_id: userId,
      image_size: imageFile.size,
      image_type: imageFile.type,
      raw_extraction_data: extraction.rawResponse,
      confidence_score: extraction.medication.confidence,
      extraction_success: true,
      processing_time_ms: extraction.processingTimeMs,
      model_used: extraction.modelUsed
    }]);

    // Auto-create medication if confidence is high enough
    if (extraction.medication.confidence >= 0.8 && !extraction.medication.needsReview) {
      const medicationData: Partial<Medication> = {
        user_id: userId,
        medication_name: extraction.medication.medicationName,
        generic_name: extraction.medication.genericName,
        brand_name: extraction.medication.brandName,
        dosage: extraction.medication.dosage,
        dosage_form: extraction.medication.dosageForm,
        strength: extraction.medication.strength,
        instructions: extraction.medication.instructions,
        frequency: extraction.medication.frequency,
        route: extraction.medication.route,
        prescribed_by: extraction.medication.prescribedBy,
        prescribed_date: extraction.medication.prescribedDate,
        prescription_number: extraction.medication.prescriptionNumber,
        pharmacy_name: extraction.medication.pharmacyName,
        pharmacy_phone: extraction.medication.pharmacyPhone,
        quantity: extraction.medication.quantity,
        refills_remaining: extraction.medication.refillsRemaining,
        last_refill_date: extraction.medication.lastRefillDate,
        next_refill_date: extraction.medication.nextRefillDate,
        ndc_code: extraction.medication.ndcCode,
        purpose: extraction.medication.purpose,
        side_effects: extraction.medication.sideEffects,
        warnings: extraction.medication.warnings,
        interactions: extraction.medication.interactions,
        status: 'active',
        ai_confidence: extraction.medication.confidence,
        extraction_notes: extraction.medication.extractionNotes,
        needs_review: extraction.medication.needsReview
      };

      const createResult = await createMedication(medicationData);

      if (createResult.success) {
        // Link extraction to medication
        await supabase
          .from('medication_image_extractions')
          .update({ medication_id: createResult.data!.id })
          .eq('user_id', userId)
          .is('medication_id', null)
          .order('created_at', { ascending: false })
          .limit(1);
      }

      return {
        success: true,
        data: {
          extraction,
          medication: createResult.data
        },
        message: 'Medication extracted and added to cabinet'
      };
    }

    // Return extraction for manual review
    return {
      success: true,
      data: { extraction },
      message: 'Please review and confirm medication details'
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process medication image'
    };
  }
}

/**
 * Confirm and save medication after manual review
 */
export async function confirmMedication(
  userId: string,
  medicationInfo: MedicationInfo,
  extractionId?: string
): Promise<ApiResponse<Medication>> {
  try {
    const medicationData: Partial<Medication> = {
      user_id: userId,
      medication_name: medicationInfo.medicationName,
      generic_name: medicationInfo.genericName,
      brand_name: medicationInfo.brandName,
      dosage: medicationInfo.dosage,
      dosage_form: medicationInfo.dosageForm,
      strength: medicationInfo.strength,
      instructions: medicationInfo.instructions,
      frequency: medicationInfo.frequency,
      route: medicationInfo.route,
      prescribed_by: medicationInfo.prescribedBy,
      prescribed_date: medicationInfo.prescribedDate,
      prescription_number: medicationInfo.prescriptionNumber,
      pharmacy_name: medicationInfo.pharmacyName,
      pharmacy_phone: medicationInfo.pharmacyPhone,
      quantity: medicationInfo.quantity,
      refills_remaining: medicationInfo.refillsRemaining,
      last_refill_date: medicationInfo.lastRefillDate,
      next_refill_date: medicationInfo.nextRefillDate,
      ndc_code: medicationInfo.ndcCode,
      purpose: medicationInfo.purpose,
      side_effects: medicationInfo.sideEffects,
      warnings: medicationInfo.warnings,
      interactions: medicationInfo.interactions,
      status: 'active',
      ai_confidence: medicationInfo.confidence,
      extraction_notes: medicationInfo.extractionNotes,
      needs_review: false, // User has reviewed it
      reviewed_by: userId,
      reviewed_at: new Date().toISOString()
    };

    const result = await createMedication(medicationData);

    if (result.success && extractionId) {
      // Link extraction to medication
      await supabase
        .from('medication_image_extractions')
        .update({ medication_id: result.data!.id })
        .eq('id', extractionId);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm medication'
    };
  }
}

// ============================================================================
// REMINDERS
// ============================================================================

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

// ============================================================================
// ADHERENCE TRACKING
// ============================================================================

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
): Promise<ApiResponse<any>> {
  try {
    const { data, error } = await supabase
      .rpc('get_medication_adherence_rate', {
        user_id_param: userId,
        days_back: daysBack
      });

    if (error) throw error;

    // Filter by medication if specified
    const result = medicationId
      ? data?.filter((item: any) => item.medication_id === medicationId)
      : data;

    return {
      success: true,
      data: result || []
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
): Promise<ApiResponse<any[]>> {
  try {
    const { data, error } = await supabase
      .rpc('get_upcoming_reminders', {
        user_id_param: userId,
        hours_ahead: hoursAhead
      });

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch upcoming reminders'
    };
  }
}

// ============================================================================
// PILL IDENTIFICATION
// ============================================================================

/**
 * Identify a pill from an image
 */
export async function identifyPill(
  userId: string,
  pillImage: File
): Promise<ApiResponse<{ identification: PillIdentificationResult }>> {
  try {
    const identification = await pillIdentifier.identifyPillFromImage(pillImage);

    // Save identification attempt to database
    await supabase.from('pill_identifications').insert([{
      user_id: userId,
      image_size: pillImage.size,
      image_type: pillImage.type,
      identification_data: identification.identification,
      confidence_score: identification.identification?.confidence || 0,
      identification_success: identification.success,
      processing_time_ms: identification.processingTimeMs,
      model_used: identification.modelUsed,
      api_sources: identification.apiSources
    }]);

    if (!identification.success) {
      return {
        success: false,
        error: identification.error || 'Failed to identify pill',
        data: { identification }
      };
    }

    return {
      success: true,
      data: { identification },
      message: 'Pill identified successfully'
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to identify pill'
    };
  }
}

/**
 * Compare a pill image with medication label information
 */
export async function comparePillWithLabel(
  userId: string,
  pillImage: File,
  medicationId: string
): Promise<ApiResponse<{ comparison: PillLabelComparison }>> {
  try {
    // Get medication information
    const medicationResult = await getMedication(medicationId);
    if (!medicationResult.success || !medicationResult.data) {
      return {
        success: false,
        error: 'Medication not found'
      };
    }

    const medication = medicationResult.data;

    // Compare pill with label
    const comparison = await pillIdentifier.comparePillWithLabel(pillImage, {
      medicationName: medication.medication_name,
      strength: medication.strength,
      ndcCode: medication.ndc_code
    });

    // Save comparison to database
    await supabase.from('pill_label_comparisons').insert([{
      user_id: userId,
      medication_id: medicationId,
      pill_medication_name: comparison.pillIdentification.medicationName,
      label_medication_name: comparison.labelInformation.medicationName,
      match: comparison.match,
      match_confidence: comparison.matchConfidence,
      discrepancies: comparison.discrepancies,
      safety_recommendation: comparison.safetyRecommendation,
      requires_pharmacist_review: comparison.requiresPharmacistReview
    }]);

    // If there's a critical mismatch, create an alert
    if (!comparison.match && comparison.requiresPharmacistReview) {
      await supabase.from('medication_safety_alerts').insert([{
        user_id: userId,
        medication_id: medicationId,
        alert_type: 'pill_label_mismatch',
        severity: 'critical',
        message: comparison.safetyRecommendation,
        metadata: {
          discrepancies: comparison.discrepancies,
          matchConfidence: comparison.matchConfidence
        }
      }]);
    }

    return {
      success: true,
      data: { comparison },
      message: comparison.match
        ? 'Pill matches label information'
        : 'Pill may not match label - review required'
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compare pill with label'
    };
  }
}

/**
 * Get pill identification history for a user
 */
export async function getPillIdentificationHistory(
  userId: string,
  limit: number = 50
): Promise<ApiResponse<any[]>> {
  try {
    const { data, error } = await supabase
      .from('pill_identifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch identification history'
    };
  }
}

/**
 * Get pill-label comparison history for a medication
 */
export async function getPillComparisonHistory(
  medicationId: string,
  limit: number = 10
): Promise<ApiResponse<any[]>> {
  try {
    const { data, error } = await supabase
      .from('pill_label_comparisons')
      .select('*')
      .eq('medication_id', medicationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch comparison history'
    };
  }
}

// ============================================================================
// PSYCHIATRIC MEDICATION MANAGEMENT
// ============================================================================

/**
 * Check if user has multiple psychiatric medications and create/update alerts
 */
async function checkAndAlertMultiplePsychMeds(userId: string): Promise<void> {
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
    console.error('Error checking multiple psych meds:', error);
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

// ============================================================================
// EXPORT
// ============================================================================

export default {
  // CRUD
  getMedications,
  getMedication,
  createMedication,
  updateMedication,
  deleteMedication,
  discontinueMedication,

  // Label reading
  extractMedicationFromImage,
  confirmMedication,

  // Pill identification
  identifyPill,
  comparePillWithLabel,
  getPillIdentificationHistory,
  getPillComparisonHistory,

  // Psychiatric medication management
  getPsychiatricMedications,
  checkMultiplePsychMeds,
  getPsychMedAlerts,
  acknowledgePsychMedAlert,

  // Reminders
  getMedicationReminders,
  createMedicationReminder,
  updateMedicationReminder,
  deleteMedicationReminder,

  // Adherence
  recordDoseTaken,
  getMedicationAdherence,
  getMedicationsNeedingRefill,
  getUpcomingReminders
};
