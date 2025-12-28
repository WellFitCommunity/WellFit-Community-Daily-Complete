/**
 * Readmission Risk Prediction Module
 *
 * This module provides modular, domain-organized feature extraction
 * for hospital readmission risk prediction.
 *
 * Exports:
 * - Domain-specific feature extractors
 * - Shared utilities
 * - Model configuration
 * - Explainability helpers
 *
 * @module readmission
 */

// Re-export model configuration
export * from '../readmissionModelConfig';

// Re-export shared utilities
export * from './utils';

// Re-export domain modules
export { extractClinicalFactors } from './clinicalFactors';
export { extractMedicationFactors } from './medicationFactors';
export { extractPostDischargeFactors } from './postDischargeFactors';
export { extractSocialDeterminants } from './socialDeterminants';
export { extractFunctionalStatus } from './functionalStatus';
export { extractEngagementFactors } from './engagementFactors';
export { extractSelfReportedHealth } from './selfReportedHealth';

// Re-export explainability helpers
export {
  generateRiskSummary,
  getAllRiskFactors,
  generatePatientSummary,
  getRUCAWeightDisplay
} from './explainability';
export type { RiskFactor, RiskSummary } from './explainability';
