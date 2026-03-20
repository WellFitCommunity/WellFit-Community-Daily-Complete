// ============================================================================
// NurseOS Dashboard Service — ServiceResult Pattern
// ============================================================================

import type { ResilienceHubDashboardStats } from '../../types/nurseos';
import { hasCheckedInToday, getCheckinStreak, getStressTrend } from './checkinService';
import { getLatestBurnoutRisk, checkInterventionNeeded } from './assessmentService';
import { getMyCompletions } from './trainingService';
import { getMyCircles } from './supportCircleService';

/**
 * Get dashboard summary stats for current user.
 * Aggregates data from all NurseOS sub-services.
 */
export async function getDashboardStats(): Promise<ResilienceHubDashboardStats> {
  const [
    burnoutRisk,
    checkedInToday,
    completionsResult,
    stressTrendResult,
    interventionNeeded,
    circlesResult,
    streakDays,
  ] = await Promise.all([
    getLatestBurnoutRisk(),
    hasCheckedInToday(),
    getMyCompletions(),
    getStressTrend().then(r => r.success ? r.data : null).catch(() => null),
    checkInterventionNeeded(),
    getMyCircles().then(r => r.success ? r.data : []).catch(() => []),
    getCheckinStreak(),
  ]);

  const completions = completionsResult.success ? completionsResult.data : [];
  const completedModules = completions.filter((c) => c.completion_percentage === 100).length;
  const inProgressModules = completions.filter(
    (c) => c.completion_percentage > 0 && c.completion_percentage < 100
  ).length;

  let stressTrendDirection: 'improving' | 'worsening' | 'stable' = 'stable';
  if (stressTrendResult && stressTrendResult.trend) {
    stressTrendDirection = stressTrendResult.trend === 'decreasing' ? 'improving' :
                          stressTrendResult.trend === 'increasing' ? 'worsening' : 'stable';
  }

  return {
    current_burnout_risk: burnoutRisk,
    has_checked_in_today: checkedInToday,
    check_in_streak_days: streakDays,
    modules_completed: completedModules,
    modules_in_progress: inProgressModules,
    avg_stress_7_days: stressTrendResult?.avg_stress_7_days || null,
    stress_trend: stressTrendDirection,
    my_support_circles: (circlesResult as unknown[]).length,
    intervention_needed: interventionNeeded,
  };
}
