/**
 * Engagement Factors Extraction Module
 *
 * Extracts WellFit's unique behavioral early warning indicators:
 * - Check-in compliance and patterns
 * - Vitals and mood reporting
 * - Game participation (cognitive engagement)
 * - Social engagement metrics
 * - Health alerts and concerning patterns
 *
 * CRITICAL: All logic preserves EXACT behavior from original implementation.
 *
 * @module readmission/engagementFactors
 */

import { supabase } from '../../../lib/supabaseClient';
import type { EngagementFactors } from '../../../types/readmissionRiskFeatures';
import type { DischargeContext } from '../readmissionRiskPredictor';
import { ENGAGEMENT_MODULE_THRESHOLDS as ENGAGEMENT_THRESHOLDS, RED_FLAG_KEYWORDS, NEGATIVE_MOOD_KEYWORDS } from '../readmissionModelConfig';

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Calculate check-in statistics
 */
function calculateCheckInStats(
  allCheckIns: Array<{ status: string; check_in_date: string; responses?: Record<string, unknown>; alert_triggered?: boolean; alert_severity?: string }>,
  sevenDaysAgo: Date
) {
  const last7DaysCheckIns = allCheckIns.filter(c =>
    new Date(c.check_in_date) >= sevenDaysAgo
  );

  // Calculate check-in completion rates
  const completed30Day = allCheckIns.filter(c => c.status === 'completed').length;
  const completed7Day = last7DaysCheckIns.filter(c => c.status === 'completed').length;
  const checkInRate30Day = allCheckIns.length > 0 ? completed30Day / 30 : 0;
  const checkInRate7Day = last7DaysCheckIns.length > 0 ? completed7Day / 7 : 0;

  const missedCheckIns30 = allCheckIns.filter(c => c.status === 'missed').length;
  const missedCheckIns7 = last7DaysCheckIns.filter(c => c.status === 'missed').length;

  // Calculate consecutive missed check-ins
  let consecutiveMissed = 0;
  for (const checkIn of allCheckIns) {
    if (checkIn.status === 'missed') {
      consecutiveMissed++;
    } else if (checkIn.status === 'completed') {
      break;
    }
  }

  // Detect engagement drop (compare last 7 days to previous 23 days)
  const previous23Days = allCheckIns.filter(c =>
    new Date(c.check_in_date) < sevenDaysAgo
  );
  const previousRate = previous23Days.length > 0 ?
    previous23Days.filter(c => c.status === 'completed').length / 23 : 0;
  // CRITICAL: Preserve exact threshold - 0.3 (30% drop)
  const engagementDrop = (previousRate - checkInRate7Day) > ENGAGEMENT_THRESHOLDS.DROP_THRESHOLD;

  return {
    last7DaysCheckIns,
    checkInRate30Day,
    checkInRate7Day,
    missedCheckIns30,
    missedCheckIns7,
    consecutiveMissed,
    engagementDrop
  };
}

/**
 * Calculate vitals and mood reporting stats
 */
function calculateReportingStats(
  allCheckIns: Array<{ status: string; check_in_date: string; responses?: Record<string, unknown>; alert_triggered?: boolean; alert_severity?: string }>,
  last7DaysCheckIns: Array<{ status: string; check_in_date: string; responses?: Record<string, unknown>; alert_triggered?: boolean; alert_severity?: string }>
) {
  // Vitals reporting from check-ins
  const vitalsReported30 = allCheckIns.filter(c =>
    c.responses?.blood_pressure || c.responses?.blood_sugar || c.responses?.weight
  ).length;
  const vitalsRate30Day = allCheckIns.length > 0 ? vitalsReported30 / 30 : 0;
  const missedVitals7 = 7 - last7DaysCheckIns.filter(c =>
    c.responses?.blood_pressure || c.responses?.blood_sugar
  ).length;

  // Mood reporting and trends
  const moodReported30 = allCheckIns.filter(c => c.responses?.mood).length;
  const moodRate30Day = allCheckIns.length > 0 ? moodReported30 / 30 : 0;

  const negativeMoodCount = allCheckIns.filter(c =>
    NEGATIVE_MOOD_KEYWORDS.some(mood => (c.responses?.mood as string | undefined)?.toLowerCase().includes(mood))
  ).length;
  // CRITICAL: Preserve exact threshold - >40% negative
  const negativeModeTrend = negativeMoodCount > (allCheckIns.length * ENGAGEMENT_THRESHOLDS.NEGATIVE_MOOD_THRESHOLD);

  // Concerning symptoms
  const concerningSymptoms = allCheckIns.some(c =>
    RED_FLAG_KEYWORDS.some(keyword =>
      (c.responses?.symptoms as string | undefined)?.toLowerCase().includes(keyword)
    )
  );

  return {
    vitalsRate30Day,
    missedVitals7,
    moodRate30Day,
    negativeModeTrend,
    concerningSymptoms
  };
}

/**
 * Calculate game engagement stats
 */
function calculateGameStats(
  games: Array<{ trivia_played?: boolean; word_find_played?: boolean; engagement_score?: number; overall_engagement_score?: number; meal_photo_shared?: boolean; community_interactions?: number; date?: string }>
) {
  const triviaPlayed = games.filter(g => g.trivia_played).length;
  const wordFindPlayed = games.filter(g => g.word_find_played).length;

  const triviaRate = games.length > 0 ? triviaPlayed / 30 : 0;
  const wordFindRate = games.length > 0 ? wordFindPlayed / 30 : 0;

  // Overall game engagement score (0-100)
  const gameEngagement = Math.round(((triviaRate + wordFindRate) / 2) * 100);
  // CRITICAL: Preserve exact condition - games.length >= 14 && comparison
  const gameEngagementDeclining = games.length >= 14 && (
    gameEngagement < (games.slice(0, 7).reduce((sum, g) => sum + (g.engagement_score || 0), 0) / 7) * 0.7
  );

  return {
    triviaRate,
    wordFindRate,
    gameEngagement,
    gameEngagementDeclining
  };
}

/**
 * Calculate social engagement stats
 */
function calculateSocialStats(
  games: Array<{ trivia_played?: boolean; word_find_played?: boolean; engagement_score?: number; overall_engagement_score?: number; meal_photo_shared?: boolean; community_interactions?: number; date?: string }>
) {
  const mealPhotos = games.filter(g => g.meal_photo_shared).length;
  const mealPhotoRate = games.length > 0 ? mealPhotos / 30 : 0;

  const communityInteractions = games.reduce((sum, g) => sum + (g.community_interactions || 0), 0);
  const communityScore = Math.min(communityInteractions * 2, 100); // Scale to 100

  // CRITICAL: Preserve exact condition - games.length >= 14 && comparison with 0.7 multiplier
  const socialEngagementDeclining = games.length >= 14 && (
    communityScore < (games.slice(0, 7).reduce((sum, g) => sum + ((g.community_interactions || 0) * 2), 0) / 7) * 0.7
  );

  // Days with zero activity
  const daysWithZeroActivity = 30 - new Set(games.map(g => g.date)).size;

  return {
    mealPhotoRate,
    communityScore,
    socialEngagementDeclining,
    daysWithZeroActivity
  };
}

// =====================================================
// MAIN EXPORT
// =====================================================

/**
 * Extract engagement factors for a patient at discharge
 *
 * Key risk indicators (WellFit's unique early warning system):
 * - Consecutive missed check-ins >= 3: 0.16 weight
 * - Engagement drop: 0.18 weight
 * - Is disengaging: 0.19 weight
 * - Stopped responding: 0.22 weight (highest behavioral risk)
 *
 * @param context - Discharge context
 * @param now - Current timestamp (for testing)
 * @returns Engagement factors
 */
export async function extractEngagementFactors(
  context: DischargeContext,
  now: number = Date.now()
): Promise<EngagementFactors> {
  const patientId = context.patientId;
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  // Get all check-ins for last 30 days
  const { data: checkIns } = await supabase
    .from('patient_daily_check_ins')
    .select('*')
    .eq('patient_id', patientId)
    .gte('check_in_date', thirtyDaysAgo.toISOString())
    .order('check_in_date', { ascending: false });

  const allCheckIns = checkIns || [];

  // Calculate check-in statistics
  const checkInStats = calculateCheckInStats(allCheckIns, sevenDaysAgo);

  // Calculate reporting statistics
  const reportingStats = calculateReportingStats(allCheckIns, checkInStats.last7DaysCheckIns);

  // Game participation - get from engagement tracking
  const { data: gameStats } = await supabase
    .from('patient_engagement_metrics')
    .select('*')
    .eq('patient_id', patientId)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false });

  const games = gameStats || [];

  // Calculate game statistics
  const gameEngagementStats = calculateGameStats(games);

  // Calculate social statistics
  const socialStats = calculateSocialStats(games);

  // Health alerts triggered
  const alertsTriggered30 = allCheckIns.filter(c => c.alert_triggered).length;
  const alertsTriggered7 = checkInStats.last7DaysCheckIns.filter(c => c.alert_triggered).length;
  const criticalAlerts = allCheckIns.filter(c => c.alert_severity === 'critical').length;

  // Overall engagement score
  const overallEngagement = games.length > 0 ?
    Math.round(games.reduce((sum, g) => sum + (g.overall_engagement_score || 0), 0) / games.length) :
    Math.round((checkInStats.checkInRate30Day + gameEngagementStats.triviaRate + gameEngagementStats.wordFindRate) / 3 * 100);

  // Calculate engagement change
  const recentEngagement = games.slice(0, 7).reduce((sum, g) => sum + (g.overall_engagement_score || 0), 0) / 7;
  const previousEngagement = games.slice(7, 30).reduce((sum, g) => sum + (g.overall_engagement_score || 0), 0) / 23;
  const engagementChange = previousEngagement > 0 ?
    ((recentEngagement - previousEngagement) / previousEngagement) * 100 : 0;

  // Disengagement flags
  // CRITICAL: Preserve exact thresholds - -30, >= 3, > 10
  const isDisengaging = engagementChange < ENGAGEMENT_THRESHOLDS.DISENGAGING_CHANGE ||
    checkInStats.consecutiveMissed >= ENGAGEMENT_THRESHOLDS.CONSECUTIVE_MISSED_THRESHOLD ||
    socialStats.daysWithZeroActivity > ENGAGEMENT_THRESHOLDS.ZERO_ACTIVITY_DAYS_THRESHOLD;
  const stoppedResponding = checkInStats.consecutiveMissed >= ENGAGEMENT_THRESHOLDS.STOPPED_RESPONDING_THRESHOLD;

  // Concerning patterns
  const concerningPatterns: string[] = [];
  if (reportingStats.negativeModeTrend) concerningPatterns.push('declining_mood');
  if (reportingStats.missedVitals7 > 4) concerningPatterns.push('missed_vitals');
  if (gameEngagementStats.gameEngagementDeclining) concerningPatterns.push('no_games');
  if (socialStats.daysWithZeroActivity > 7) concerningPatterns.push('zero_activity');
  if (criticalAlerts > 0) concerningPatterns.push('critical_alerts');

  return {
    checkInCompletionRate30Day: checkInStats.checkInRate30Day,
    checkInCompletionRate7Day: checkInStats.checkInRate7Day,
    missedCheckIns30Day: checkInStats.missedCheckIns30,
    missedCheckIns7Day: checkInStats.missedCheckIns7,
    consecutiveMissedCheckIns: checkInStats.consecutiveMissed,
    hasEngagementDrop: checkInStats.engagementDrop,

    vitalsReportingRate30Day: reportingStats.vitalsRate30Day,
    missedVitalsReports7Day: reportingStats.missedVitals7,
    // CRITICAL: Preserve exact threshold - > 0.7
    vitalsReportingConsistent: reportingStats.vitalsRate30Day > ENGAGEMENT_THRESHOLDS.VITALS_CONSISTENT_THRESHOLD,

    moodReportingRate30Day: reportingStats.moodRate30Day,
    negativeModeTrend: reportingStats.negativeModeTrend,
    concerningSymptomsReported: reportingStats.concerningSymptoms,
    symptomSeverityIncreasing: false, // Would need trend analysis

    triviaParticipationRate30Day: gameEngagementStats.triviaRate,
    wordFindParticipationRate30Day: gameEngagementStats.wordFindRate,
    gameEngagementScore: gameEngagementStats.gameEngagement,
    gameEngagementDeclining: gameEngagementStats.gameEngagementDeclining,

    mealPhotoShareRate30Day: socialStats.mealPhotoRate,
    communityInteractionScore: socialStats.communityScore,
    socialEngagementDeclining: socialStats.socialEngagementDeclining,
    daysWithZeroActivity: socialStats.daysWithZeroActivity,

    healthAlertsTriggered30Day: alertsTriggered30,
    healthAlertsTriggered7Day: alertsTriggered7,
    criticalAlertsTriggered: criticalAlerts,

    overallEngagementScore: overallEngagement,
    engagementChangePercent: engagementChange,
    isDisengaging,

    stoppedResponding,
    concerningPatterns
  };
}
