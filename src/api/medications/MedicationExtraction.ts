/**
 * Medication Label Extraction
 * AI-powered medication information extraction from images
 */

import { supabase } from '../../lib/supabaseClient';
import { medicationLabelReader, type MedicationInfo, type LabelExtractionResult } from '../../services/medicationLabelReader';
import type { ApiResponse, Medication } from './types';
import { createMedication } from './MedicationCrud';

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
          .update({ medication_id: createResult.data?.id })
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
        .update({ medication_id: result.data?.id })
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
