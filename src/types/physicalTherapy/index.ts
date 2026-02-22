/**
 * Physical Therapy Workflow Types
 *
 * Barrel re-export from modular sub-files.
 * All imports from '../types/physicalTherapy' or '../../types/physicalTherapy'
 * continue to work without changes.
 */

// Assessment types (functional assessment, pain, ROM, strength, gait, balance, etc.)
export type {
  AssessmentType,
  OnsetType,
  LivingSituation,
  TransportationAccess,
  RehabPotential,
  PainAssessment,
  ROMData,
  StrengthData,
  GaitAnalysis,
  BalanceAssessment,
  FunctionalMobilityScore,
  OutcomeMeasure,
  HomeAccessibility,
  WorkDemands,
  PTFunctionalAssessment,
} from './assessment';

// Treatment plan & session types
export type {
  PlanStatus,
  ICFCategory,
  HEPDeliveryMethod,
  DischargeDestination,
  SMARTGoal,
  PTIntervention,
  DischargeCriteria,
  PTTreatmentPlan,
  AttendanceStatus,
  HEPCompliance,
  SessionIntervention,
  PTTreatmentSession,
} from './treatment';

// Exercise library & home exercise program types
export type {
  ExerciseCategory,
  EvidenceLevel,
  PTExercise,
  HEPDeliveryType,
  HEPExercisePrescription,
  HEPComplianceLog,
  PTHomeExerciseProgram,
} from './exercises';

// Outcome measures, quality metrics, dashboard types, standardized scores
export type {
  AdministrationContext,
  PTOutcomeMeasure,
  PTQualityMetrics,
  PTCaseloadPatient,
  DischargeReadiness,
  QualityDashboardMetric,
  LEFSScore,
  OSWESTRYScore,
  DASHScore,
  PSFSScore,
  TUGScore,
  BergBalanceScore,
} from './outcomes';

// Team communication, telehealth, API requests, clinical decision support
export type {
  ClinicalDiscipline,
  CommunicationType,
  CommunicationPriority,
  PTTeamCommunication,
  TelehealthPlatform,
  ConnectionQuality,
  PTTelehealthSession,
  CreatePTAssessmentRequest,
  UpdatePTAssessmentRequest,
  CreateTreatmentPlanRequest,
  RecordTreatmentSessionRequest,
  AssignHEPRequest,
  RecordOutcomeMeasureRequest,
  PTClinicalAlert,
  ProgressIndicator,
  TreatmentRecommendation,
} from './communication';
