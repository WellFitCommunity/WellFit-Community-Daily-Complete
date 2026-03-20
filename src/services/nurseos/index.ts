// ============================================================================
// NurseOS Services — Barrel Export
// ============================================================================
// Re-exports all NurseOS service functions from decomposed modules.
// The original resilienceHubService.ts (704 lines) was split into:
//   checkinService.ts, assessmentService.ts, trainingService.ts,
//   supportCircleService.ts, resourceService.ts, dashboardService.ts
// ============================================================================

// Check-ins
export {
  submitDailyCheckin,
  getMyCheckins,
  hasCheckedInToday,
  getStressTrend,
  getCheckinStreak,
} from './checkinService';

// Burnout assessments
export {
  submitBurnoutAssessment,
  getMyAssessments,
  getLatestBurnoutRisk,
  checkInterventionNeeded,
} from './assessmentService';

// Training modules
export {
  getActiveModules,
  trackModuleStart,
  trackModuleCompletion,
  getMyCompletions,
} from './trainingService';

// Resources
export {
  getResources,
  trackResourceView,
} from './resourceService';

// Support circles
export {
  getMyCircles,
  getCircleReflections,
  postReflection,
  markReflectionHelpful,
} from './supportCircleService';

// Dashboard
export {
  getDashboardStats,
} from './dashboardService';
