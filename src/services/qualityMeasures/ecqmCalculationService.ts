/**
 * Electronic Clinical Quality Measures (eCQM) Calculation Service
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 * Purpose: Calculate clinical quality measures for CMS reporting
 *
 * This service calculates eCQMs by evaluating patient data against
 * measure definitions using CQL (Clinical Quality Language) logic.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';

// =====================================================
// TYPES
// =====================================================

export interface MeasureDefinition {
  id: string;
  measure_id: string;
  cms_id: string;
  version: string;
  title: string;
  description: string;
  measure_type: string;
  measure_scoring: string;
  initial_population_description: string;
  denominator_description: string;
  numerator_description: string;
  reporting_year: number;
  applicable_settings: string[];
  clinical_focus: string;
  is_active: boolean;
}

export interface PatientMeasureResult {
  measureId: string;
  patientId: string;
  initialPopulation: boolean;
  denominator: boolean;
  denominatorExclusion: boolean;
  denominatorException: boolean;
  numerator: boolean;
  numeratorExclusion: boolean;
  measureObservation?: number;
  dataElementsUsed: Record<string, unknown>;
}

export interface AggregateResult {
  measureId: string;
  initialPopulationCount: number;
  denominatorCount: number;
  denominatorExclusionCount: number;
  denominatorExceptionCount: number;
  numeratorCount: number;
  numeratorExclusionCount: number;
  performanceRate: number | null;
  patientCount: number;
}

export interface CalculationOptions {
  tenantId: string;
  measureIds: string[];
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  patientIds?: string[];
}

export interface CalculationJob {
  id: string;
  tenantId: string;
  measureIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progressPercentage: number;
  patientsProcessed: number;
  patientsTotal: number;
  resultSummary?: AggregateResult[];
  errorMessage?: string;
}

// Database row types
interface PatientResultRow {
  initial_population: boolean;
  denominator: boolean;
  denominator_exclusion: boolean;
  denominator_exception: boolean;
  numerator: boolean;
  numerator_exclusion: boolean;
  measure_observation?: number;
}

interface AggregateResultRow {
  measure_id: string;
  initial_population_count: number;
  denominator_count: number;
  denominator_exclusion_count: number;
  denominator_exception_count: number;
  numerator_count: number;
  numerator_exclusion_count: number;
  performance_rate: number | null;
  patient_count: number;
}

// =====================================================
// MEASURE DEFINITIONS
// =====================================================

/**
 * Get all active measure definitions
 */
export async function getMeasureDefinitions(): Promise<ServiceResult<MeasureDefinition[]>> {
  try {
    const { data, error } = await supabase
      .from('ecqm_measure_definitions')
      .select('*')
      .eq('is_active', true)
      .order('cms_id');

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    return success(data || []);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_DEFINITIONS_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err))
    );
    return failure('FETCH_FAILED', 'Failed to fetch measure definitions');
  }
}

/**
 * Get a specific measure definition
 */
export async function getMeasureDefinition(measureId: string): Promise<ServiceResult<MeasureDefinition | null>> {
  try {
    const { data, error } = await supabase
      .from('ecqm_measure_definitions')
      .select('*')
      .eq('measure_id', measureId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', error.message);
    }

    return success(data);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_DEFINITION_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { measureId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch measure definition');
  }
}

// =====================================================
// PATIENT EVALUATION
// =====================================================

/**
 * Evaluate a single patient against a measure
 * This is a simplified implementation - in production, would use a CQL engine
 */
export async function evaluatePatientForMeasure(
  tenantId: string,
  patientId: string,
  measureId: string,
  reportingPeriodStart: Date,
  reportingPeriodEnd: Date
): Promise<ServiceResult<PatientMeasureResult>> {
  try {
    // Get patient data for the reporting period
    const patientData = await getPatientDataForMeasure(
      tenantId,
      patientId,
      measureId,
      reportingPeriodStart,
      reportingPeriodEnd
    );

    if (!patientData.success) {
      return failure('VALIDATION_ERROR', patientData.error?.message || 'Failed to get patient data');
    }

    // Evaluate based on measure type
    const result = await evaluateMeasureCriteria(
      measureId,
      patientData.data,
      reportingPeriodStart,
      reportingPeriodEnd
    );

    return success(result);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_PATIENT_EVALUATION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId, measureId }
    );
    return failure('OPERATION_FAILED', 'Failed to evaluate patient');
  }
}

/**
 * Get patient data needed for measure calculation
 */
async function getPatientDataForMeasure(
  tenantId: string,
  patientId: string,
  measureId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<ServiceResult<PatientMeasureData>> {
  try {
    // Get patient demographics
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, date_of_birth, gender, tenant_id')
      .eq('id', patientId)
      .eq('tenant_id', tenantId)
      .single();

    if (patientError) {
      return failure('DATABASE_ERROR', patientError.message);
    }

    // Get encounters in reporting period
    const { data: encounters } = await supabase
      .from('encounters')
      .select('id, encounter_date, encounter_type, primary_diagnosis')
      .eq('patient_id', patientId)
      .gte('encounter_date', periodStart.toISOString())
      .lte('encounter_date', periodEnd.toISOString());

    // Get conditions/diagnoses
    const { data: conditions } = await supabase
      .from('conditions')
      .select('id, code, code_system, onset_date, status')
      .eq('patient_id', patientId)
      .eq('status', 'active');

    // Get observations (vitals, labs)
    const { data: observations } = await supabase
      .from('observations')
      .select('id, code, value, unit, effective_date')
      .eq('patient_id', patientId)
      .gte('effective_date', periodStart.toISOString())
      .lte('effective_date', periodEnd.toISOString());

    // Get medications
    const { data: medications } = await supabase
      .from('medication_requests')
      .select('id, medication_code, status, authored_on')
      .eq('patient_id', patientId)
      .eq('status', 'active');

    // Get procedures
    const { data: procedures } = await supabase
      .from('procedures')
      .select('id, code, performed_date, status')
      .eq('patient_id', patientId)
      .gte('performed_date', periodStart.toISOString())
      .lte('performed_date', periodEnd.toISOString());

    // Calculate age at end of reporting period
    const birthDate = new Date(patient.date_of_birth);
    const age = Math.floor(
      (periodEnd.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    return success({
      patient: { ...patient, age },
      encounters: encounters || [],
      conditions: conditions || [],
      observations: observations || [],
      medications: medications || [],
      procedures: procedures || []
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_PATIENT_DATA_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId, measureId }
    );
    return failure('VALIDATION_ERROR', 'Failed to fetch patient data');
  }
}

interface PatientMeasureData {
  patient: {
    id: string;
    date_of_birth: string;
    gender: string;
    tenant_id: string;
    age: number;
  };
  encounters: Array<{
    id: string;
    encounter_date: string;
    encounter_type: string;
    primary_diagnosis: string;
  }>;
  conditions: Array<{
    id: string;
    code: string;
    code_system: string;
    onset_date: string;
    status: string;
  }>;
  observations: Array<{
    id: string;
    code: string;
    value: number;
    unit: string;
    effective_date: string;
  }>;
  medications: Array<{
    id: string;
    medication_code: string;
    status: string;
    authored_on: string;
  }>;
  procedures: Array<{
    id: string;
    code: string;
    performed_date: string;
    status: string;
  }>;
}

/**
 * Evaluate measure criteria for a patient
 * Simplified implementation - production would use CQL engine
 */
async function evaluateMeasureCriteria(
  measureId: string,
  data: PatientMeasureData,
  periodStart: Date,
  periodEnd: Date
): Promise<PatientMeasureResult> {
  const result: PatientMeasureResult = {
    measureId,
    patientId: data.patient.id,
    initialPopulation: false,
    denominator: false,
    denominatorExclusion: false,
    denominatorException: false,
    numerator: false,
    numeratorExclusion: false,
    dataElementsUsed: {}
  };

  // Evaluate based on measure ID
  switch (measureId) {
    case 'CMS122v12':
      return evaluateCMS122(data, result, periodStart, periodEnd);

    case 'CMS165v12':
      return evaluateCMS165(data, result, periodStart, periodEnd);

    case 'CMS127v12':
      return evaluateCMS127(data, result);

    case 'CMS130v12':
      return evaluateCMS130(data, result, periodStart, periodEnd);

    case 'CMS125v12':
      return evaluateCMS125(data, result, periodStart, periodEnd);

    default:
      // Generic evaluation for other measures
      return evaluateGenericMeasure(data, result);
  }
}

// =====================================================
// SPECIFIC MEASURE EVALUATORS
// =====================================================

/**
 * CMS122v12 - Diabetes: Hemoglobin A1c (HbA1c) Poor Control (> 9%)
 */
function evaluateCMS122(
  data: PatientMeasureData,
  result: PatientMeasureResult,
  periodStart: Date,
  periodEnd: Date
): PatientMeasureResult {
  const { patient, encounters, conditions, observations } = data;

  // Initial Population: Age 18-75, Diabetes diagnosis, Encounter during period
  const hasDiabetes = conditions.some(c =>
    c.code.startsWith('E10') || c.code.startsWith('E11') || c.code.startsWith('E13')
  );
  const hasEncounter = encounters.length > 0;
  const ageInRange = patient.age >= 18 && patient.age <= 75;

  result.initialPopulation = ageInRange && hasDiabetes && hasEncounter;
  result.denominator = result.initialPopulation;

  result.dataElementsUsed = {
    age: patient.age,
    hasDiabetes,
    hasEncounter,
    diabetesCodes: conditions.filter(c =>
      c.code.startsWith('E10') || c.code.startsWith('E11') || c.code.startsWith('E13')
    ).map(c => c.code)
  };

  if (!result.denominator) return result;

  // Numerator: Most recent HbA1c > 9% OR no HbA1c during period
  const hba1cObs = observations
    .filter(o => o.code === '4548-4' || o.code === '17856-6') // LOINC codes for HbA1c
    .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());

  if (hba1cObs.length === 0) {
    // No HbA1c = poor control (inverse measure)
    result.numerator = true;
    result.dataElementsUsed = { ...result.dataElementsUsed, hba1c: 'none' };
  } else {
    const mostRecentHba1c = hba1cObs[0];
    result.numerator = mostRecentHba1c.value > 9.0;
    result.dataElementsUsed = {
      ...result.dataElementsUsed,
      hba1c: mostRecentHba1c.value,
      hba1cDate: mostRecentHba1c.effective_date
    };
  }

  return result;
}

/**
 * CMS165v12 - Controlling High Blood Pressure
 */
function evaluateCMS165(
  data: PatientMeasureData,
  result: PatientMeasureResult,
  periodStart: Date,
  periodEnd: Date
): PatientMeasureResult {
  const { patient, encounters, conditions, observations } = data;

  // Initial Population: Age 18-85, Hypertension diagnosis, Encounter during period
  const hasHypertension = conditions.some(c =>
    c.code.startsWith('I10') || c.code.startsWith('I11') || c.code.startsWith('I12') || c.code.startsWith('I13')
  );
  const hasEncounter = encounters.length > 0;
  const ageInRange = patient.age >= 18 && patient.age <= 85;

  result.initialPopulation = ageInRange && hasHypertension && hasEncounter;
  result.denominator = result.initialPopulation;

  result.dataElementsUsed = {
    age: patient.age,
    hasHypertension,
    hasEncounter
  };

  if (!result.denominator) return result;

  // Numerator: Most recent BP is adequately controlled (< 140/90)
  const systolicObs = observations
    .filter(o => o.code === '8480-6') // LOINC for systolic BP
    .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());

  const diastolicObs = observations
    .filter(o => o.code === '8462-4') // LOINC for diastolic BP
    .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());

  if (systolicObs.length > 0 && diastolicObs.length > 0) {
    const systolic = systolicObs[0].value;
    const diastolic = diastolicObs[0].value;
    result.numerator = systolic < 140 && diastolic < 90;
    result.dataElementsUsed = {
      ...result.dataElementsUsed,
      systolic,
      diastolic,
      bpDate: systolicObs[0].effective_date
    };
  }

  return result;
}

/**
 * CMS127v12 - Pneumococcal Vaccination Status for Older Adults
 */
function evaluateCMS127(
  data: PatientMeasureData,
  result: PatientMeasureResult
): PatientMeasureResult {
  const { patient, encounters, procedures } = data;

  // Initial Population: Age >= 66, Encounter during period
  const hasEncounter = encounters.length > 0;
  const ageInRange = patient.age >= 66;

  result.initialPopulation = ageInRange && hasEncounter;
  result.denominator = result.initialPopulation;

  result.dataElementsUsed = {
    age: patient.age,
    hasEncounter
  };

  if (!result.denominator) return result;

  // Numerator: Has received pneumococcal vaccine (ever)
  const pneumoVaccine = procedures.some(p =>
    p.code === '90670' || p.code === '90671' || p.code === '90732' // CPT codes for pneumococcal vaccines
  );

  result.numerator = pneumoVaccine;
  result.dataElementsUsed = { ...result.dataElementsUsed, hasPneumoVaccine: pneumoVaccine };

  return result;
}

/**
 * CMS130v12 - Colorectal Cancer Screening
 */
function evaluateCMS130(
  data: PatientMeasureData,
  result: PatientMeasureResult,
  periodStart: Date,
  periodEnd: Date
): PatientMeasureResult {
  const { patient, encounters, procedures, observations } = data;

  // Initial Population: Age 45-75, Encounter during period
  const hasEncounter = encounters.length > 0;
  const ageInRange = patient.age >= 45 && patient.age <= 75;

  result.initialPopulation = ageInRange && hasEncounter;
  result.denominator = result.initialPopulation;

  result.dataElementsUsed = {
    age: patient.age,
    hasEncounter
  };

  if (!result.denominator) return result;

  // Numerator: Appropriate screening performed
  // Colonoscopy in last 10 years, or FIT/FOBT in last year, or CT colonography in last 5 years
  const tenYearsAgo = new Date(periodEnd);
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

  const fiveYearsAgo = new Date(periodEnd);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  const oneYearAgo = new Date(periodEnd);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const hasColonoscopy = procedures.some(p =>
    (p.code === '45378' || p.code === '45380' || p.code === '45381') &&
    new Date(p.performed_date) >= tenYearsAgo
  );

  const hasFIT = observations.some(o =>
    (o.code === '57905-2' || o.code === '56490-6') && // LOINC for FIT
    new Date(o.effective_date) >= oneYearAgo
  );

  result.numerator = hasColonoscopy || hasFIT;
  result.dataElementsUsed = {
    ...result.dataElementsUsed,
    hasColonoscopy,
    hasFIT
  };

  return result;
}

/**
 * CMS125v12 - Breast Cancer Screening
 */
function evaluateCMS125(
  data: PatientMeasureData,
  result: PatientMeasureResult,
  periodStart: Date,
  periodEnd: Date
): PatientMeasureResult {
  const { patient, encounters, procedures } = data;

  // Initial Population: Female, Age 50-74, Encounter during period
  const hasEncounter = encounters.length > 0;
  const ageInRange = patient.age >= 50 && patient.age <= 74;
  const isFemale = patient.gender === 'female' || patient.gender === 'F';

  result.initialPopulation = ageInRange && hasEncounter && isFemale;
  result.denominator = result.initialPopulation;

  result.dataElementsUsed = {
    age: patient.age,
    gender: patient.gender,
    hasEncounter
  };

  if (!result.denominator) return result;

  // Numerator: Mammogram in last 27 months
  const twentySevenMonthsAgo = new Date(periodEnd);
  twentySevenMonthsAgo.setMonth(twentySevenMonthsAgo.getMonth() - 27);

  const hasMammogram = procedures.some(p =>
    (p.code === '77067' || p.code === '77066' || p.code === '77065') && // CPT for mammography
    new Date(p.performed_date) >= twentySevenMonthsAgo
  );

  result.numerator = hasMammogram;
  result.dataElementsUsed = { ...result.dataElementsUsed, hasMammogram };

  return result;
}

/**
 * Generic measure evaluation for measures without specific logic
 */
function evaluateGenericMeasure(
  data: PatientMeasureData,
  result: PatientMeasureResult
): PatientMeasureResult {
  const { patient, encounters } = data;

  // Basic IP: Has encounter
  result.initialPopulation = encounters.length > 0;
  result.denominator = result.initialPopulation;

  result.dataElementsUsed = {
    encounterCount: encounters.length,
    age: patient.age
  };

  return result;
}

// =====================================================
// BATCH CALCULATION
// =====================================================

/**
 * Calculate measures for multiple patients (batch)
 */
export async function calculateMeasures(
  options: CalculationOptions
): Promise<ServiceResult<{ jobId: string }>> {
  const { tenantId, measureIds, reportingPeriodStart, reportingPeriodEnd, patientIds } = options;

  try {
    // Create calculation job
    const { data: job, error: jobError } = await supabase
      .from('ecqm_calculation_jobs')
      .insert({
        tenant_id: tenantId,
        measure_ids: measureIds,
        reporting_period_start: reportingPeriodStart,
        reporting_period_end: reportingPeriodEnd,
        patient_ids: patientIds,
        status: 'pending'
      })
      .select()
      .single();

    if (jobError) {
      return failure('DATABASE_ERROR', jobError.message);
    }

    await auditLogger.info('ECQM_CALCULATION_JOB_CREATED', {
      tenantId,
      jobId: job.id,
      measureIds,
      reportingPeriodStart,
      reportingPeriodEnd
    });

    // Start calculation in background (would use edge function in production)
    processCalculationJob(job.id, options).catch(err => {
      auditLogger.error(
        'ECQM_CALCULATION_JOB_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { jobId: job.id }
      );
    });

    return success({ jobId: job.id });
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_CALCULATION_START_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, measureIds }
    );
    return failure('OPERATION_FAILED', 'Failed to start calculation');
  }
}

/**
 * Process a calculation job
 */
async function processCalculationJob(
  jobId: string,
  options: CalculationOptions
): Promise<void> {
  const { tenantId, measureIds, reportingPeriodStart, reportingPeriodEnd, patientIds } = options;

  try {
    // Update job status
    await supabase
      .from('ecqm_calculation_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId);

    // Get patients to process
    let patientsQuery = supabase
      .from('patients')
      .select('id')
      .eq('tenant_id', tenantId);

    if (patientIds && patientIds.length > 0) {
      patientsQuery = patientsQuery.in('id', patientIds);
    }

    const { data: patients, error: patientsError } = await patientsQuery;

    if (patientsError) {
      throw new Error(patientsError.message);
    }

    const totalPatients = patients?.length || 0;
    let processedPatients = 0;

    // Update total count
    await supabase
      .from('ecqm_calculation_jobs')
      .update({ patients_total: totalPatients })
      .eq('id', jobId);

    // Process each patient
    for (const patient of patients || []) {
      for (const measureId of measureIds) {
        const result = await evaluatePatientForMeasure(
          tenantId,
          patient.id,
          measureId,
          reportingPeriodStart,
          reportingPeriodEnd
        );

        if (result.success && result.data) {
          // Save patient result
          await supabase.from('ecqm_patient_results').upsert({
            tenant_id: tenantId,
            measure_id: measureId,
            patient_id: patient.id,
            reporting_period_start: reportingPeriodStart,
            reporting_period_end: reportingPeriodEnd,
            initial_population: result.data.initialPopulation,
            denominator: result.data.denominator,
            denominator_exclusion: result.data.denominatorExclusion,
            denominator_exception: result.data.denominatorException,
            numerator: result.data.numerator,
            numerator_exclusion: result.data.numeratorExclusion,
            measure_observation: result.data.measureObservation,
            data_elements_used: result.data.dataElementsUsed
          }, {
            onConflict: 'tenant_id,measure_id,patient_id,reporting_period_start'
          });
        }
      }

      processedPatients++;

      // Update progress periodically
      if (processedPatients % 10 === 0) {
        await supabase
          .from('ecqm_calculation_jobs')
          .update({
            patients_processed: processedPatients,
            progress_percentage: Math.round((processedPatients / totalPatients) * 100)
          })
          .eq('id', jobId);
      }
    }

    // Calculate aggregates for each measure
    const aggregates: AggregateResult[] = [];
    for (const measureId of measureIds) {
      const aggResult = await calculateAggregateResults(
        tenantId,
        measureId,
        reportingPeriodStart,
        reportingPeriodEnd
      );
      if (aggResult.success && aggResult.data) {
        aggregates.push(aggResult.data);
      }
    }

    // Mark job as complete
    await supabase
      .from('ecqm_calculation_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        patients_processed: processedPatients,
        progress_percentage: 100,
        result_summary: aggregates
      })
      .eq('id', jobId);

    await auditLogger.info('ECQM_CALCULATION_JOB_COMPLETED', {
      jobId,
      tenantId,
      patientsProcessed: processedPatients,
      measuresCalculated: measureIds.length
    });
  } catch (err: unknown) {
    await supabase
      .from('ecqm_calculation_jobs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : String(err)
      })
      .eq('id', jobId);

    throw err;
  }
}

/**
 * Get calculation job status
 */
export async function getCalculationJobStatus(jobId: string): Promise<ServiceResult<CalculationJob | null>> {
  try {
    const { data, error } = await supabase
      .from('ecqm_calculation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', error.message);
    }

    if (!data) return success(null);

    return success({
      id: data.id,
      tenantId: data.tenant_id,
      measureIds: data.measure_ids,
      status: data.status,
      progressPercentage: data.progress_percentage,
      patientsProcessed: data.patients_processed,
      patientsTotal: data.patients_total,
      resultSummary: data.result_summary,
      errorMessage: data.error_message
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_JOB_STATUS_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { jobId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch job status');
  }
}

// =====================================================
// AGGREGATE RESULTS
// =====================================================

/**
 * Calculate aggregate results for a measure
 */
export async function calculateAggregateResults(
  tenantId: string,
  measureId: string,
  reportingPeriodStart: Date,
  reportingPeriodEnd: Date
): Promise<ServiceResult<AggregateResult>> {
  try {
    const { data: results, error } = await supabase
      .from('ecqm_patient_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('measure_id', measureId)
      .eq('reporting_period_start', reportingPeriodStart.toISOString().split('T')[0]);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const patientResults = (results || []) as PatientResultRow[];

    const aggregate: AggregateResult = {
      measureId,
      initialPopulationCount: patientResults.filter((r: PatientResultRow) => r.initial_population).length,
      denominatorCount: patientResults.filter((r: PatientResultRow) => r.denominator).length,
      denominatorExclusionCount: patientResults.filter((r: PatientResultRow) => r.denominator_exclusion).length,
      denominatorExceptionCount: patientResults.filter((r: PatientResultRow) => r.denominator_exception).length,
      numeratorCount: patientResults.filter((r: PatientResultRow) => r.numerator).length,
      numeratorExclusionCount: patientResults.filter((r: PatientResultRow) => r.numerator_exclusion).length,
      performanceRate: null,
      patientCount: patientResults.length
    };

    // Calculate performance rate
    const eligibleDenominator =
      aggregate.denominatorCount -
      aggregate.denominatorExclusionCount -
      aggregate.denominatorExceptionCount;

    if (eligibleDenominator > 0) {
      aggregate.performanceRate = Math.round(
        (aggregate.numeratorCount / eligibleDenominator) * 10000
      ) / 10000; // 4 decimal places
    }

    // Save aggregate result
    await supabase.from('ecqm_aggregate_results').upsert({
      tenant_id: tenantId,
      measure_id: measureId,
      reporting_period_start: reportingPeriodStart,
      reporting_period_end: reportingPeriodEnd,
      initial_population_count: aggregate.initialPopulationCount,
      denominator_count: aggregate.denominatorCount,
      denominator_exclusion_count: aggregate.denominatorExclusionCount,
      denominator_exception_count: aggregate.denominatorExceptionCount,
      numerator_count: aggregate.numeratorCount,
      numerator_exclusion_count: aggregate.numeratorExclusionCount,
      performance_rate: aggregate.performanceRate,
      patient_count: aggregate.patientCount
    }, {
      onConflict: 'tenant_id,measure_id,reporting_period_start'
    });

    return success(aggregate);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_AGGREGATE_CALCULATION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, measureId }
    );
    return failure('OPERATION_FAILED', 'Failed to calculate aggregates');
  }
}

/**
 * Get aggregate results for a tenant
 */
export async function getAggregateResults(
  tenantId: string,
  reportingPeriodStart: Date
): Promise<ServiceResult<AggregateResult[]>> {
  try {
    const { data, error } = await supabase
      .from('ecqm_aggregate_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('reporting_period_start', reportingPeriodStart.toISOString().split('T')[0])
      .order('measure_id');

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const aggregates: AggregateResult[] = ((data || []) as AggregateResultRow[]).map((d: AggregateResultRow) => ({
      measureId: d.measure_id,
      initialPopulationCount: d.initial_population_count,
      denominatorCount: d.denominator_count,
      denominatorExclusionCount: d.denominator_exclusion_count,
      denominatorExceptionCount: d.denominator_exception_count,
      numeratorCount: d.numerator_count,
      numeratorExclusionCount: d.numerator_exclusion_count,
      performanceRate: d.performance_rate,
      patientCount: d.patient_count
    }));

    return success(aggregates);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_AGGREGATES_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch aggregate results');
  }
}

// Export service
export const ECQMCalculationService = {
  getMeasureDefinitions,
  getMeasureDefinition,
  evaluatePatientForMeasure,
  calculateMeasures,
  getCalculationJobStatus,
  calculateAggregateResults,
  getAggregateResults
};

export default ECQMCalculationService;
