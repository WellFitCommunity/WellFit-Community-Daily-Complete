/**
 * Pill Identification
 * Visual pill identification and comparison with label information
 */

import { supabase } from '../../lib/supabaseClient';
import { pillIdentifier, type PillIdentificationResult, type PillLabelComparison } from '../../services/pillIdentifierService';
import type { ApiResponse } from './types';
import { getMedication } from './MedicationCrud';

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
