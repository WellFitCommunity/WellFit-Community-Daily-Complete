/**
 * Mental Health Intervention System Types
 * Enterprise-grade TypeScript types for FHIR-compliant mental health support
 *
 * Clinical Standards: Joint Commission, CMS CoP, Evidence-based suicide prevention
 * Compliance: HIPAA, Texas Health & Safety Code SS161.0075
 *
 * Barrel re-export: all sub-modules are re-exported here so existing
 * `import { ... } from '@/types/mentalHealth'` statements continue to work.
 */

// Base type aliases
export type {
  RiskLevel,
  SessionType,
  SessionStatus,
  ServiceRequestStatus,
  ServiceRequestIntent,
  Priority,
  SuicidalIdeation,
  SuicidalPlan,
  SuicidalIntent,
  MeansAccess,
  PHQ9Severity,
  GAD7Severity,
  AdjustmentResponse,
  PatientEngagement,
  MentalHealthEscalationLevel,
  EscalationLevel,
  EscalationStatus,
  FlagType,
  FlagStatus,
  Modality,
  OutcomeStatus,
  DurationExceptionCode,
} from './baseTypes';

// Service requests & therapy sessions
export type {
  MentalHealthTriggerCondition,
  MentalHealthServiceRequest,
  CreateMentalHealthServiceRequest,
  MentalHealthTherapySession,
  CreateTherapySession,
  CompleteTherapySession,
} from './serviceRequests';

// Risk assessment, safety plans, escalations, flags & discharge
export type {
  MentalHealthRiskAssessment,
  CreateRiskAssessment,
  SafetyPlanContact,
  MentalHealthSafetyPlan,
  CreateSafetyPlan,
  NotificationRecord,
  MentalHealthEscalation,
  MentalHealthFlag,
  MentalHealthDischargeChecklist,
} from './riskAndSafety';

// Dashboard views, quality metrics, API responses
export type {
  ActiveMentalHealthPatient,
  PendingMentalHealthSession,
  DischargeBlocker,
  MentalHealthQualityMetrics,
  MentalHealthApiResponse,
  MentalHealthDashboardSummary,
} from './dashboardAndHelpers';

// Constants (value exports)
export {
  RISK_LEVEL_COLORS,
  RISK_LEVEL_BG_COLORS,
  RISK_LEVEL_ICONS,
  RISK_LEVEL_DISPLAY,
  SESSION_STATUS_DISPLAY,
  PRIORITY_COLORS,
  PRIORITY_DISPLAY,
} from './dashboardAndHelpers';

// Helper functions (value exports)
export {
  getRiskLevelFromPhq9,
  getPhq9Severity,
  getGad7Severity,
  calculateOverallRisk,
  formatSessionDuration,
  isSessionDurationValid,
  generateCrisisHotlines,
  sortPatientsByPriority,
} from './dashboardAndHelpers';
