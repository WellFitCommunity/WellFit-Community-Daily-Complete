/**
 * Electronic Clinical Quality Measures (eCQM) Calculation Service
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 * Purpose: Calculate clinical quality measures for CMS reporting
 *
 * Barrel re-export — all logic lives in calculation/ submodules.
 */

export type {
  MeasureDefinition,
  PatientMeasureResult,
  AggregateResult,
  CalculationOptions,
  CalculationJob,
  PatientMeasureData
} from './calculation/types';

export { getMeasureDefinitions, getMeasureDefinition } from './calculation/measureDefinitions';
export { evaluatePatientForMeasure } from './calculation/patientEvaluation';
export { evaluateMeasureCriteria } from './calculation/measureEvaluators';
export { calculateMeasures, getCalculationJobStatus } from './calculation/batchCalculation';
export { calculateAggregateResults, getAggregateResults } from './calculation/aggregateResults';
export { isCqlAvailable, executeCql, cqlResultToMeasureResult, loadElmLibrary } from './calculation/cqlEngine';
export type { ElmLibrary, CqlExecutionParams, CqlExecutionResult, CqlPatientResult } from './calculation/cqlEngine.types';

import { getMeasureDefinitions, getMeasureDefinition } from './calculation/measureDefinitions';
import { evaluatePatientForMeasure } from './calculation/patientEvaluation';
import { calculateMeasures, getCalculationJobStatus } from './calculation/batchCalculation';
import { calculateAggregateResults, getAggregateResults } from './calculation/aggregateResults';

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
