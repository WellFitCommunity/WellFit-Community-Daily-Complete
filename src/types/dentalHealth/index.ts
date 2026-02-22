/**
 * Dental Health Module - Type Definitions
 * Comprehensive dental health tracking types.
 * Integration: Chronic disease management, FHIR mapping, CDT billing
 *
 * Barrel re-export: all sub-modules are re-exported here so existing
 * `import { ... } from '@/types/dentalHealth'` statements continue to work.
 */

// Base type aliases (enums)
export type {
  DentalProviderRole,
  DentalVisitType,
  DentalAssessmentStatus,
  ToothCondition,
  PeriodontalStatus,
  TreatmentPriority,
  DentalImageType,
  DentalProcedureStatus,
  ReferralStatus,
  TreatmentPlanStatus,
} from './baseTypes';

// Core clinical interfaces
export type {
  DentalAssessment,
  SurfaceConditions,
  ToothChartEntry,
  DentalProcedure,
  PhaseProcedure,
  TreatmentPhase,
  DentalTreatmentPlan,
  DentalObservation,
  DentalImaging,
  DentalReferral,
  PatientDentalHealthTracking,
  CDTCode,
} from './clinicalInterfaces';

// API request/response types
export type {
  CreateDentalAssessmentRequest,
  UpdateDentalAssessmentRequest,
  CreateToothChartEntryRequest,
  CreateDentalProcedureRequest,
  CreateTreatmentPlanRequest,
  CreatePatientTrackingRequest,
  DentalRiskAlert,
  DentalHealthDashboardSummary,
  ToothChartSummary,
  ProcedureHistorySummary,
  DentalApiResponse,
} from './apiAndDashboard';

// Constants (value exports)
export {
  TOOTH_NAMES,
  PRIMARY_TOOTH_NAMES,
  PERIODONTAL_SEVERITY,
  DENTAL_LABELS,
} from './apiAndDashboard';

// Helper functions (value exports)
export {
  getToothName,
  getQuadrant,
} from './apiAndDashboard';
