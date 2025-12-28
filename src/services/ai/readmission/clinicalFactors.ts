/**
 * Clinical Factors Extraction Module
 *
 * Extracts clinical risk indicators for readmission prediction:
 * - Prior admissions (strongest predictor)
 * - ED visits
 * - Comorbidities
 * - Vital signs stability
 * - Lab results
 *
 * CRITICAL: All logic preserves EXACT behavior from original implementation.
 *
 * @module readmission/clinicalFactors
 */

import { supabase } from '../../../lib/supabaseClient';
import type { ClinicalFactors } from '../../../types/readmissionRiskFeatures';
import type { DischargeContext } from '../readmissionRiskPredictor';
import {
  VITALS_STABILITY_THRESHOLDS,
  LAB_THRESHOLDS
} from '../readmissionModelConfig';
import {
  categorizeLengthOfStay,
  categorizeCondition,
  categorizeDiagnosis,
  checkHighRiskDiagnosis,
  getDaysAgo
} from './utils';

// =====================================================
// TYPES
// =====================================================

interface PriorAdmissionsResult {
  count30Day: number;
  count60Day: number;
  count90Day: number;
  count1Year: number;
}

interface EdVisitsResult {
  count30Day: number;
  count90Day: number;
  count6Month: number;
}

interface Comorbidity {
  code: string;
  display: string;
  category: string;
}

interface VitalsResult {
  stable: boolean;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  oxygenSat?: number;
  temperature?: number;
}

interface LabsResult {
  allNormal: boolean;
  trendsConcerning: boolean;
  eGfr?: number;
  hemoglobin?: number;
  sodium?: number;
  glucose?: number;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get prior admissions counts
 * Uses strict > comparison for time filtering
 */
async function getPriorAdmissions(patientId: string, now: number = Date.now()): Promise<PriorAdmissionsResult> {
  const { data } = await supabase
    .from('patient_readmissions')
    .select('admission_date')
    .eq('patient_id', patientId)
    .order('admission_date', { ascending: false })
    .limit(50);

  const admissions = data || [];

  return {
    count30Day: admissions.filter(a => new Date(a.admission_date).getTime() > now - 30 * 24 * 60 * 60 * 1000).length,
    count60Day: admissions.filter(a => new Date(a.admission_date).getTime() > now - 60 * 24 * 60 * 60 * 1000).length,
    count90Day: admissions.filter(a => new Date(a.admission_date).getTime() > now - 90 * 24 * 60 * 60 * 1000).length,
    count1Year: admissions.filter(a => new Date(a.admission_date).getTime() > now - 365 * 24 * 60 * 60 * 1000).length
  };
}

/**
 * Get ED visits counts
 */
async function getEdVisits(patientId: string, now: number = Date.now()): Promise<EdVisitsResult> {
  const { data } = await supabase
    .from('patient_readmissions')
    .select('admission_date, facility_type')
    .eq('patient_id', patientId)
    .eq('facility_type', 'er')
    .order('admission_date', { ascending: false })
    .limit(50);

  const visits = data || [];

  return {
    count30Day: visits.filter(v => new Date(v.admission_date).getTime() > now - 30 * 24 * 60 * 60 * 1000).length,
    count90Day: visits.filter(v => new Date(v.admission_date).getTime() > now - 90 * 24 * 60 * 60 * 1000).length,
    count6Month: visits.filter(v => new Date(v.admission_date).getTime() > now - 180 * 24 * 60 * 60 * 1000).length
  };
}

/**
 * Get comorbidities from FHIR conditions
 */
async function getComorbidities(patientId: string): Promise<Comorbidity[]> {
  const { data } = await supabase
    .from('fhir_conditions')
    .select('code, display, clinical_status')
    .eq('patient_id', patientId)
    .eq('clinical_status', 'active');

  return (data || []).map(condition => ({
    code: condition.code,
    display: condition.display,
    category: categorizeCondition(condition.code)
  }));
}

/**
 * Get vital signs at discharge
 *
 * BEHAVIOR NOTES:
 * - Vitals stable if (!value || (value >= MIN && value <= MAX))
 * - 0 is falsy, would pass as "missing" - intentional behavior
 */
async function getDischargeVitals(patientId: string, dischargeDate: string): Promise<VitalsResult> {
  const { data } = await supabase
    .from('fhir_observations')
    .select('*')
    .eq('patient_id', patientId)
    .gte('effective_date_time', new Date(new Date(dischargeDate).getTime() - 24 * 60 * 60 * 1000).toISOString())
    .lte('effective_date_time', dischargeDate)
    .order('effective_date_time', { ascending: false });

  const vitals = data || [];

  const systolic = vitals.find(v => v.code === '8480-6')?.value_quantity?.value;
  const diastolic = vitals.find(v => v.code === '8462-4')?.value_quantity?.value;
  const heartRate = vitals.find(v => v.code === '8867-4')?.value_quantity?.value;
  const oxygenSat = vitals.find(v => v.code === '2708-6')?.value_quantity?.value;
  const temperature = vitals.find(v => v.code === '8310-5')?.value_quantity?.value;

  // CRITICAL: Preserve exact stability check logic
  // (!value || range-check) means 0 is treated as "missing"
  const stable =
    (!systolic || (systolic >= VITALS_STABILITY_THRESHOLDS.SYSTOLIC.MIN && systolic <= VITALS_STABILITY_THRESHOLDS.SYSTOLIC.MAX)) &&
    (!diastolic || (diastolic >= VITALS_STABILITY_THRESHOLDS.DIASTOLIC.MIN && diastolic <= VITALS_STABILITY_THRESHOLDS.DIASTOLIC.MAX)) &&
    (!heartRate || (heartRate >= VITALS_STABILITY_THRESHOLDS.HEART_RATE.MIN && heartRate <= VITALS_STABILITY_THRESHOLDS.HEART_RATE.MAX)) &&
    (!oxygenSat || oxygenSat >= VITALS_STABILITY_THRESHOLDS.O2_SATURATION_MIN);

  return { stable, systolic, diastolic, heartRate, oxygenSat, temperature };
}

/**
 * Get recent lab results
 *
 * BEHAVIOR NOTES:
 * - allNormal uses (!value || range-check) pattern
 * - trendsConcerning uses (value && threshold-check) pattern
 */
async function getRecentLabs(patientId: string, dischargeDate: string): Promise<LabsResult> {
  const { data } = await supabase
    .from('fhir_observations')
    .select('*')
    .eq('patient_id', patientId)
    .gte('effective_date_time', new Date(new Date(dischargeDate).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .lte('effective_date_time', dischargeDate)
    .order('effective_date_time', { ascending: false });

  const labs = data || [];

  const eGfr = labs.find(l => l.code === '48642-3')?.value_quantity?.value;
  const hemoglobin = labs.find(l => l.code === '718-7')?.value_quantity?.value;
  const sodium = labs.find(l => l.code === '2951-2')?.value_quantity?.value;
  const glucose = labs.find(l => l.code === '2339-0')?.value_quantity?.value;

  // CRITICAL: Preserve exact normal check logic
  const allNormal =
    (!eGfr || eGfr >= LAB_THRESHOLDS.NORMAL.EGFR_MIN) &&
    (!hemoglobin || (hemoglobin >= LAB_THRESHOLDS.NORMAL.HEMOGLOBIN_MIN && hemoglobin <= LAB_THRESHOLDS.NORMAL.HEMOGLOBIN_MAX)) &&
    (!sodium || (sodium >= LAB_THRESHOLDS.NORMAL.SODIUM_MIN && sodium <= LAB_THRESHOLDS.NORMAL.SODIUM_MAX)) &&
    (!glucose || (glucose >= LAB_THRESHOLDS.NORMAL.GLUCOSE_MIN && glucose <= LAB_THRESHOLDS.NORMAL.GLUCOSE_MAX));

  // CRITICAL: Preserve exact concerning check logic
  const trendsConcerning =
    (eGfr !== undefined && eGfr < LAB_THRESHOLDS.CONCERNING.EGFR_CRITICAL_LOW) ||
    (hemoglobin !== undefined && hemoglobin < LAB_THRESHOLDS.CONCERNING.HEMOGLOBIN_CRITICAL_LOW) ||
    (sodium !== undefined && (sodium < LAB_THRESHOLDS.CONCERNING.SODIUM_CRITICAL_LOW || sodium > LAB_THRESHOLDS.CONCERNING.SODIUM_CRITICAL_HIGH)) ||
    (glucose !== undefined && (glucose < LAB_THRESHOLDS.CONCERNING.GLUCOSE_CRITICAL_LOW || glucose > LAB_THRESHOLDS.CONCERNING.GLUCOSE_CRITICAL_HIGH));

  return { allNormal, trendsConcerning, eGfr, hemoglobin, sodium, glucose };
}

// =====================================================
// MAIN EXPORT
// =====================================================

/**
 * Extract clinical factors for a patient at discharge
 *
 * These are the HIGHEST WEIGHT predictors for readmission risk:
 * - Prior admissions (0.25 weight for 30-day)
 * - ED visits (0.15 weight for 6-month)
 * - Comorbidities (0.18 weight)
 *
 * @param context - Discharge context
 * @param now - Current timestamp (for testing)
 * @returns Clinical factors
 */
export async function extractClinicalFactors(
  context: DischargeContext,
  now: number = Date.now()
): Promise<ClinicalFactors> {
  const patientId = context.patientId;

  // Get prior admissions (strongest predictor)
  const priorAdmissions = await getPriorAdmissions(patientId, now);

  // Get ED visits
  const edVisits = await getEdVisits(patientId, now);

  // Get comorbidities from FHIR conditions
  const comorbidities = await getComorbidities(patientId);

  // Get vital signs at discharge
  const vitals = await getDischargeVitals(patientId, context.dischargeDate);

  // Get lab results
  const labs = await getRecentLabs(patientId, context.dischargeDate);

  // Categorize length of stay
  const losCategory = categorizeLengthOfStay(context.lengthOfStay);

  // Check if diagnosis is high-risk
  const isHighRisk = context.primaryDiagnosisCode
    ? checkHighRiskDiagnosis(context.primaryDiagnosisCode)
    : false;

  return {
    primaryDiagnosisCode: context.primaryDiagnosisCode,
    primaryDiagnosisDescription: context.primaryDiagnosisDescription,
    primaryDiagnosisCategory: categorizeDiagnosis(context.primaryDiagnosisCode),
    isHighRiskDiagnosis: isHighRisk,

    comorbidityCount: comorbidities.length,
    comorbidities: comorbidities.map(c => c.code),
    hasChf: comorbidities.some(c => c.category === 'CHF'),
    hasCopd: comorbidities.some(c => c.category === 'COPD'),
    hasDiabetes: comorbidities.some(c => c.category === 'diabetes'),
    hasRenalFailure: comorbidities.some(c => c.category === 'renal_failure'),
    hasCancer: comorbidities.some(c => c.category === 'cancer'),

    priorAdmissions30Day: priorAdmissions.count30Day,
    priorAdmissions60Day: priorAdmissions.count60Day,
    priorAdmissions90Day: priorAdmissions.count90Day,
    priorAdmissions1Year: priorAdmissions.count1Year,

    edVisits30Day: edVisits.count30Day,
    edVisits90Day: edVisits.count90Day,
    edVisits6Month: edVisits.count6Month,

    lengthOfStayDays: context.lengthOfStay,
    lengthOfStayCategory: losCategory,

    vitalSignsStableAtDischarge: vitals.stable,
    systolicBpAtDischarge: vitals.systolic,
    diastolicBpAtDischarge: vitals.diastolic,
    heartRateAtDischarge: vitals.heartRate,
    oxygenSaturationAtDischarge: vitals.oxygenSat,
    temperatureAtDischarge: vitals.temperature,

    labsWithinNormalLimits: labs.allNormal,
    eGfr: labs.eGfr,
    hemoglobin: labs.hemoglobin,
    sodiumLevel: labs.sodium,
    glucoseLevel: labs.glucose,
    labTrendsConcerning: labs.trendsConcerning
  };
}
