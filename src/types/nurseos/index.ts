// NurseOS Types — Barrel Export
// Original nurseos.ts (700 lines) decomposed into focused type modules

// Assessment types
export type {
  ProviderBurnoutAssessment,
  MBIQuestionnaireResponse,
  BurnoutRiskLevel,
  BurnoutAssessmentFormData,
  InterventionRecommendation,
} from './assessment.types';

// Check-in types
export type {
  ProviderDailyCheckin,
  WorkSetting,
  ProductLine,
  DailyCheckinFormData,
  StressTrendAnalysis,
} from './checkin.types';

// Training types
export type {
  ResilienceTrainingModule,
  ResilienceCategory,
  ContentType,
  ProviderTrainingCompletion,
} from './training.types';

// Support & Resource types
export type {
  ProviderSupportCircle,
  ProviderSupportCircleMember,
  ProviderSupportReflection,
  ResilienceResource,
  ResourceType,
} from './support.types';

// Config & Dashboard types
export type {
  NurseOSProductConfig,
  NurseOSFeatureFlag,
  ResilienceHubDashboardStats,
  ResilienceHubApiResponse,
  PaginatedResponse,
  ProviderWorkloadMetrics,
} from './config.types';

// Constants, type guards, and utility functions
export {
  MBI_QUESTIONS,
  BURNOUT_THRESHOLDS,
  STRESS_LEVEL_LABELS,
  isValidProductLine,
  isCriticalBurnoutRisk,
  isRecentCheckin,
  calculateCompositeBurnoutScore,
  getBurnoutRiskLevel,
  calculateMBIDimensionScore,
  formatProviderName,
} from './constants';
