/**
 * Quality Measures Services
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 * Purpose: Electronic Clinical Quality Measure (eCQM) calculation and reporting
 */

export {
  ECQMCalculationService,
  getMeasureDefinitions,
  getMeasureDefinition,
  evaluatePatientForMeasure,
  calculateMeasures,
  getCalculationJobStatus,
  calculateAggregateResults,
  getAggregateResults,
  type MeasureDefinition,
  type PatientMeasureResult,
  type AggregateResult,
  type CalculationOptions,
  type CalculationJob
} from './ecqmCalculationService';

export {
  QRDAExportService,
  exportQRDAI,
  exportQRDAIII,
  validateQRDADocument,
  getExportHistory,
  type QRDAExportOptions,
  type QRDAExportResult
} from './qrdaExportService';
