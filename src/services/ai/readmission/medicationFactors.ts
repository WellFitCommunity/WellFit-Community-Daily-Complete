/**
 * Medication Factors Extraction Module
 *
 * Extracts medication-related risk indicators:
 * - Active medication count (polypharmacy)
 * - High-risk medication classes
 * - Medication changes during admission
 * - Prescription fill status
 *
 * CRITICAL: All logic preserves EXACT behavior from original implementation.
 *
 * @module readmission/medicationFactors
 */

import { supabase } from '../../../lib/supabaseClient';
import type { MedicationFactors } from '../../../types/readmissionRiskFeatures';
import type { DischargeContext } from '../readmissionRiskPredictor';
import {
  MEDICATION_THRESHOLDS,
  HIGH_RISK_MEDICATION_KEYWORDS
} from '../readmissionModelConfig';
import { medicationMatchesClass, getDaysAgoISO } from './utils';

// =====================================================
// TYPES
// =====================================================

interface MedicationChangesResult {
  added: number;
  discontinued: number;
  doseChanged: number;
  reconciliationCompleted: boolean;
  listAccurate: boolean;
}

interface PrescriptionFillResult {
  filledWithin3Days?: boolean;
  daysUntilFill?: number;
  anyFilled: boolean;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get medication changes during admission
 *
 * NOTE: This is a placeholder implementation that returns fixed values.
 * The original implementation also returns these placeholder values.
 * DO NOT "improve" this - preserve exact behavior.
 */
async function getMedicationChanges(_patientId: string, _dischargeDate: string): Promise<MedicationChangesResult> {
  // This would compare medications before and after admission
  // For now, return placeholder data - INTENTIONAL, DO NOT CHANGE
  return {
    added: 0,
    discontinued: 0,
    doseChanged: 0,
    reconciliationCompleted: true,
    listAccurate: true
  };
}

/**
 * Get prescription fill status
 *
 * NOTE: This is a placeholder implementation that returns fixed values.
 * The original implementation also returns these placeholder values.
 * DO NOT "improve" this - preserve exact behavior.
 */
async function getPrescriptionFillStatus(_patientId: string, _dischargeDate: string): Promise<PrescriptionFillResult> {
  // This would integrate with pharmacy data
  // For now, return placeholder data - INTENTIONAL, DO NOT CHANGE
  return {
    filledWithin3Days: undefined,
    daysUntilFill: undefined,
    anyFilled: true
  };
}

// =====================================================
// MAIN EXPORT
// =====================================================

/**
 * Extract medication factors for a patient at discharge
 *
 * Key risk indicators:
 * - Polypharmacy (5+ meds): 0.13 weight
 * - High-risk medications: 0.14 weight
 * - No prescription filled: 0.16 weight
 *
 * @param context - Discharge context
 * @param now - Current timestamp (for testing)
 * @returns Medication factors
 */
export async function extractMedicationFactors(
  context: DischargeContext,
  now: number = Date.now()
): Promise<MedicationFactors> {
  const patientId = context.patientId;

  // Get active medications at discharge
  const { data: medications } = await supabase
    .from('fhir_medication_requests')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', 'active')
    .gte('authored_on', getDaysAgoISO(90, now));

  const activeMeds = medications || [];
  const medCount = activeMeds.length;

  // Identify high-risk medication classes
  const hasAnticoagulants = activeMeds.some(m =>
    medicationMatchesClass(m as unknown, HIGH_RISK_MEDICATION_KEYWORDS.ANTICOAGULANTS)
  );
  const hasInsulin = activeMeds.some(m =>
    medicationMatchesClass(m as unknown, HIGH_RISK_MEDICATION_KEYWORDS.INSULIN)
  );
  const hasOpioids = activeMeds.some(m =>
    medicationMatchesClass(m as unknown, HIGH_RISK_MEDICATION_KEYWORDS.OPIOIDS)
  );
  const hasImmunosuppressants = activeMeds.some(m =>
    medicationMatchesClass(m as unknown, HIGH_RISK_MEDICATION_KEYWORDS.IMMUNOSUPPRESSANTS)
  );

  const highRiskMedList: string[] = [];
  if (hasAnticoagulants) highRiskMedList.push('anticoagulants');
  if (hasInsulin) highRiskMedList.push('insulin');
  if (hasOpioids) highRiskMedList.push('opioids');
  if (hasImmunosuppressants) highRiskMedList.push('immunosuppressants');

  // Check medication changes during admission
  const medChanges = await getMedicationChanges(patientId, context.dischargeDate);

  // Check prescription fill timing
  const prescriptionFill = await getPrescriptionFillStatus(patientId, context.dischargeDate);

  return {
    activeMedicationCount: medCount,
    isPolypharmacy: medCount >= MEDICATION_THRESHOLDS.POLYPHARMACY,

    hasAnticoagulants,
    hasInsulin,
    hasOpioids,
    hasImmunosuppressants,
    hasHighRiskMedications: highRiskMedList.length > 0,
    highRiskMedicationList: highRiskMedList,

    medicationsAdded: medChanges.added,
    medicationsDiscontinued: medChanges.discontinued,
    medicationsDoseChanged: medChanges.doseChanged,
    significantMedicationChanges: (medChanges.added + medChanges.discontinued + medChanges.doseChanged) >= MEDICATION_THRESHOLDS.SIGNIFICANT_CHANGES,

    prescriptionFilledWithin3Days: prescriptionFill.filledWithin3Days,
    daysUntilPrescriptionFill: prescriptionFill.daysUntilFill,
    noPrescriptionFilled: !prescriptionFill.anyFilled,

    medicationReconciliationCompleted: medChanges.reconciliationCompleted,
    medicationListAccurate: medChanges.listAccurate
  };
}
