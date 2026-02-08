/**
 * Measure-Specific Evaluators
 *
 * ONC Criteria: 170.315(c)(1)
 * CQL-equivalent logic for each CMS measure.
 */

import type { PatientMeasureData, PatientMeasureResult } from './types';

/**
 * Evaluate measure criteria for a patient (dispatcher)
 */
export function evaluateMeasureCriteria(
  measureId: string,
  data: PatientMeasureData,
  periodStart: Date,
  periodEnd: Date
): PatientMeasureResult {
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
      return evaluateGenericMeasure(data, result);
  }
}

/**
 * CMS122v12 - Diabetes: Hemoglobin A1c (HbA1c) Poor Control (> 9%)
 */
function evaluateCMS122(
  data: PatientMeasureData,
  result: PatientMeasureResult,
  _periodStart: Date,
  _periodEnd: Date
): PatientMeasureResult {
  const { patient, encounters, conditions, observations } = data;

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

  const hba1cObs = observations
    .filter(o => o.code === '4548-4' || o.code === '17856-6')
    .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());

  if (hba1cObs.length === 0) {
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
  _periodStart: Date,
  _periodEnd: Date
): PatientMeasureResult {
  const { patient, encounters, conditions, observations } = data;

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

  const systolicObs = observations
    .filter(o => o.code === '8480-6')
    .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());

  const diastolicObs = observations
    .filter(o => o.code === '8462-4')
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

  const hasEncounter = encounters.length > 0;
  const ageInRange = patient.age >= 66;

  result.initialPopulation = ageInRange && hasEncounter;
  result.denominator = result.initialPopulation;

  result.dataElementsUsed = {
    age: patient.age,
    hasEncounter
  };

  if (!result.denominator) return result;

  const pneumoVaccine = procedures.some(p =>
    p.code === '90670' || p.code === '90671' || p.code === '90732'
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
  _periodStart: Date,
  periodEnd: Date
): PatientMeasureResult {
  const { patient, encounters, procedures, observations } = data;

  const hasEncounter = encounters.length > 0;
  const ageInRange = patient.age >= 45 && patient.age <= 75;

  result.initialPopulation = ageInRange && hasEncounter;
  result.denominator = result.initialPopulation;

  result.dataElementsUsed = {
    age: patient.age,
    hasEncounter
  };

  if (!result.denominator) return result;

  const tenYearsAgo = new Date(periodEnd);
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

  const oneYearAgo = new Date(periodEnd);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const hasColonoscopy = procedures.some(p =>
    (p.code === '45378' || p.code === '45380' || p.code === '45381') &&
    new Date(p.performed_date) >= tenYearsAgo
  );

  const hasFIT = observations.some(o =>
    (o.code === '57905-2' || o.code === '56490-6') &&
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
  _periodStart: Date,
  periodEnd: Date
): PatientMeasureResult {
  const { patient, encounters, procedures } = data;

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

  const twentySevenMonthsAgo = new Date(periodEnd);
  twentySevenMonthsAgo.setMonth(twentySevenMonthsAgo.getMonth() - 27);

  const hasMammogram = procedures.some(p =>
    (p.code === '77067' || p.code === '77066' || p.code === '77065') &&
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

  result.initialPopulation = encounters.length > 0;
  result.denominator = result.initialPopulation;

  result.dataElementsUsed = {
    encounterCount: encounters.length,
    age: patient.age
  };

  return result;
}
