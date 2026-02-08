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

// HEDIS
export {
  HedisService,
  getHedisMeasures,
  getHedisSummary,
} from './hedis/hedisService';

export type {
  HedisMeasure,
  HedisDomainGroup,
  HedisMeasureWithResults,
  HedisSummary,
} from './hedis/hedisTypes';

// MIPS
export {
  MipsCompositeService,
  calculateMipsComposite,
  getMipsComposite,
  getImprovementActivities,
  attestActivity,
  calculatePaymentAdjustment,
} from './mips/mipsCompositeService';

export type {
  MipsCompositeScore,
  MipsQualityMeasureScore,
  MipsImprovementActivity,
  MipsPaymentAdjustment,
  CalculateMipsOptions,
} from './mips/mipsTypes';

// Star Ratings
export {
  StarRatingsService,
  calculateStarRatings,
  getStarRatings,
  calculateMeasureStar,
  getDomainSummaries,
} from './star/starRatingsService';

export type {
  StarRatingScore,
  MeasureStarDetail,
  StarCutPoints,
  StarDomainSummary,
  CalculateStarOptions,
} from './star/starTypes';
