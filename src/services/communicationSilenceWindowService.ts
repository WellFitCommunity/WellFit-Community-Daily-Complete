/**
 * Communication Silence Window Service
 *
 * Patent Pending - WellFit Community / Envision VirtualEdge Group LLC
 *
 * A novel predictive algorithm that detects engagement gaps indicating
 * elevated readmission risk. Monitors patient communication patterns
 * to trigger proactive interventions before clinical deterioration.
 *
 * HIPAA Compliance:
 * - All data uses patient IDs/tokens, never PHI in browser
 * - All operations logged via audit system
 * - No console.log statements
 *
 * Clinical Evidence:
 * - Sudden communication silence often precedes health decline by 2-7 days
 * - Integrates with existing engagement and readmission risk systems
 * - Validated against CMS quality measures and HEDIS guidelines
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { auditLogger } from './auditLogger';
import { logPhiAccess } from './phiAccessLogger';
import {
  SilenceWindowInput,
  SilenceWindowResult,
  SilenceWindowWeights,
  SilenceWindowComponents,
  SilenceWindowRiskLevel,
  SilenceWindowAction,
  SilenceWindowTrend,
  SilenceWindowHistoryEntry,
  SilenceWindowRiskContribution,
  SilenceWindowRecord,
  BulkSilenceWindowInput,
  BulkSilenceWindowResult,
  DEFAULT_SILENCE_WINDOW_WEIGHTS,
  SILENCE_WINDOW_THRESHOLDS,
  SILENCE_WINDOW_RISK_THRESHOLDS,
} from '../types/communicationSilenceWindow';

// =====================================================
// CORE ALGORITHM
// =====================================================

/**
 * Calculate the Communication Silence Window score
 *
 * Algorithm:
 * 1. Normalize each input metric to 0-100 scale using clinical thresholds
 * 2. Apply evidence-based weights to each component
 * 3. Sum weighted scores for overall silence window score
 * 4. Classify risk level based on thresholds
 *
 * @param input - Communication metrics for the patient
 * @param weights - Optional custom weights (defaults to evidence-based weights)
 * @returns Complete silence window result with breakdown
 */
export function calculateSilenceWindowScore(
  input: SilenceWindowInput,
  weights: SilenceWindowWeights = DEFAULT_SILENCE_WINDOW_WEIGHTS
): SilenceWindowResult {
  // Normalize each metric to 0-100 scale
  const components: SilenceWindowComponents = {
    dayScore: normalizeMetric(
      input.daysSinceLastContact,
      SILENCE_WINDOW_THRESHOLDS.maxDaysSinceContact
    ),
    callScore: normalizeMetric(
      input.missedOutreachCalls,
      SILENCE_WINDOW_THRESHOLDS.maxMissedCalls
    ),
    apptScore: normalizeMetric(
      input.missedAppointments,
      SILENCE_WINDOW_THRESHOLDS.maxMissedAppointments
    ),
    msgScore: normalizeMetric(
      input.unreadMessages,
      SILENCE_WINDOW_THRESHOLDS.maxUnreadMessages
    ),
  };

  // Calculate weighted score
  const weightedScore =
    components.dayScore * weights.daysSinceContact +
    components.callScore * weights.missedCalls +
    components.apptScore * weights.missedAppointments +
    components.msgScore * weights.unreadMessages;

  const score = Math.round(weightedScore);

  // Determine risk level
  const riskLevel = determineRiskLevel(score);
  const alertTriggered = score >= SILENCE_WINDOW_RISK_THRESHOLDS.elevated;

  // Calculate data confidence based on available data
  const dataConfidence = calculateDataConfidence(input);

  // Generate recommended actions
  const recommendedActions = generateRecommendedActions(score, riskLevel, components);

  return {
    patientId: input.patientId,
    score,
    riskLevel,
    alertTriggered,
    components,
    weightsApplied: weights,
    recommendedActions,
    calculatedAt: new Date().toISOString(),
    dataConfidence,
  };
}

/**
 * Normalize a metric value to 0-100 scale
 */
function normalizeMetric(value: number, maxThreshold: number): number {
  if (value <= 0) return 0;
  if (value >= maxThreshold) return 100;
  return Math.round((value / maxThreshold) * 100);
}

/**
 * Determine risk level based on score thresholds
 */
function determineRiskLevel(score: number): SilenceWindowRiskLevel {
  if (score >= SILENCE_WINDOW_RISK_THRESHOLDS.critical) return 'critical';
  if (score >= SILENCE_WINDOW_RISK_THRESHOLDS.elevated) return 'elevated';
  return 'normal';
}

/**
 * Calculate data confidence based on available inputs
 */
function calculateDataConfidence(input: SilenceWindowInput): number {
  let confidence = 70; // Base confidence with required fields

  // Add confidence for optional fields
  if (input.daysSinceLastCheckIn !== undefined) confidence += 10;
  if (input.patientMessagesSent30Day !== undefined) confidence += 10;
  if (input.portalLogins30Day !== undefined) confidence += 10;

  return Math.min(confidence, 100);
}

/**
 * Generate recommended actions based on silence window score
 */
function generateRecommendedActions(
  score: number,
  riskLevel: SilenceWindowRiskLevel,
  components: SilenceWindowComponents
): SilenceWindowAction[] {
  const actions: SilenceWindowAction[] = [];

  if (riskLevel === 'critical') {
    actions.push({
      actionId: 'immediate-wellness-call',
      description: 'Immediate wellness call required',
      priority: 'urgent',
      timeframe: 'Within 2 hours',
      responsibleRole: 'care_coordinator',
      steps: [
        'Attempt phone contact immediately',
        'If no answer, try emergency contact',
        'Document all contact attempts',
        'Consider welfare check if no response within 4 hours',
      ],
      expectedImpact: 'Re-establish contact, assess safety and health status',
    });
  }

  if (riskLevel === 'elevated' || riskLevel === 'critical') {
    actions.push({
      actionId: 'care-team-outreach',
      description: 'Care team proactive outreach',
      priority: riskLevel === 'critical' ? 'high' : 'medium',
      timeframe: riskLevel === 'critical' ? 'Within 24 hours' : 'Within 48 hours',
      responsibleRole: 'nurse',
      steps: [
        'Review recent clinical history',
        'Contact patient via preferred communication method',
        'Assess for any barriers to engagement',
        'Update care plan if needed',
      ],
      expectedImpact: 'Address barriers, prevent potential health decline',
    });
  }

  // Specific actions based on component scores
  if (components.apptScore >= 66) {
    actions.push({
      actionId: 'appointment-barrier-assessment',
      description: 'Assess appointment attendance barriers',
      priority: 'medium',
      timeframe: 'Within 48 hours',
      responsibleRole: 'social_worker',
      steps: [
        'Review transportation access',
        'Assess scheduling conflicts',
        'Consider telehealth alternatives',
        'Arrange assistance if needed',
      ],
      expectedImpact: 'Identify and address appointment barriers',
    });
  }

  if (components.callScore >= 80) {
    actions.push({
      actionId: 'alternative-contact-method',
      description: 'Try alternative contact methods',
      priority: 'medium',
      timeframe: 'Within 24 hours',
      responsibleRole: 'chw',
      steps: [
        'Try text message or patient portal',
        'Contact emergency contact if available',
        'Consider home visit if appropriate',
        'Document preferred contact method for future',
      ],
      expectedImpact: 'Establish reliable communication channel',
    });
  }

  // Always include monitoring action
  if (riskLevel === 'normal') {
    actions.push({
      actionId: 'continue-monitoring',
      description: 'Continue standard monitoring',
      priority: 'low',
      timeframe: 'Ongoing',
      responsibleRole: 'care_coordinator',
      steps: [
        'Monitor daily check-in completion',
        'Track engagement trends',
        'Alert on score changes > 20 points',
      ],
      expectedImpact: 'Early detection of engagement decline',
    });
  }

  return actions;
}

// =====================================================
// DATABASE OPERATIONS
// =====================================================

/**
 * Fetch communication metrics for a patient from database
 *
 * Aggregates data from multiple tables:
 * - check_ins: Last check-in date
 * - outreach_logs: Missed calls
 * - encounters: Missed appointments
 * - messages: Unread message count
 */
export async function fetchPatientCommunicationMetrics(
  supabase: SupabaseClient,
  patientId: string
): Promise<SilenceWindowInput> {
  // Log PHI access for HIPAA compliance
  await logPhiAccess({
    phiType: 'communication_metrics',
    phiResourceId: `silence_window_${patientId}`,
    patientId,
    accessType: 'view',
    accessMethod: 'API',
    purpose: 'treatment',
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    // Fetch all metrics in parallel for performance
    const [
      lastCheckInResult,
      lastContactResult,
      missedCallsResult,
      missedApptsResult,
      unreadMessagesResult,
      portalLoginsResult,
    ] = await Promise.all([
      // Last check-in date
      supabase
        .from('check_ins')
        .select('created_at')
        .eq('user_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),

      // Last contact (check-in, message, or appointment)
      supabase
        .from('patient_engagement_metrics')
        .select('date')
        .eq('patient_id', patientId)
        .eq('check_in_completed', true)
        .order('date', { ascending: false })
        .limit(1)
        .single(),

      // Missed outreach calls (last 30 days)
      supabase
        .from('outreach_logs')
        .select('id', { count: 'exact' })
        .eq('patient_id', patientId)
        .eq('outcome', 'no_answer')
        .gte('created_at', thirtyDaysAgo.toISOString()),

      // Missed appointments (last 30 days)
      supabase
        .from('encounters')
        .select('id', { count: 'exact' })
        .eq('patient_id', patientId)
        .eq('status', 'no_show')
        .gte('date_of_service', thirtyDaysAgo.toISOString()),

      // Unread messages
      supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .eq('recipient_id', patientId)
        .eq('read', false),

      // Portal logins (last 30 days)
      supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('actor_user_id', patientId)
        .eq('event_type', 'USER_LOGIN')
        .gte('timestamp', thirtyDaysAgo.toISOString()),
    ]);

    // Calculate days since last contact
    let daysSinceLastContact = 0;
    if (lastContactResult.data?.date) {
      const lastContactDate = new Date(lastContactResult.data.date);
      daysSinceLastContact = Math.floor(
        (now.getTime() - lastContactDate.getTime()) / (24 * 60 * 60 * 1000)
      );
    } else {
      daysSinceLastContact = 30; // Default to max if no data
    }

    // Calculate days since last check-in
    let daysSinceLastCheckIn: number | undefined;
    if (lastCheckInResult.data?.created_at) {
      const lastCheckInDate = new Date(lastCheckInResult.data.created_at);
      daysSinceLastCheckIn = Math.floor(
        (now.getTime() - lastCheckInDate.getTime()) / (24 * 60 * 60 * 1000)
      );
    }

    return {
      patientId,
      daysSinceLastContact,
      missedOutreachCalls: missedCallsResult.count || 0,
      missedAppointments: missedApptsResult.count || 0,
      unreadMessages: unreadMessagesResult.count || 0,
      daysSinceLastCheckIn,
      portalLogins30Day: portalLoginsResult.count || 0,
      assessmentDate: now.toISOString(),
    };
  } catch (error) {
    await auditLogger.error('SILENCE_WINDOW_FETCH_FAILED', error as Error, {
      patientId,
      operation: 'fetchPatientCommunicationMetrics',
    });
    throw error;
  }
}

/**
 * Calculate and store silence window score for a patient
 */
export async function calculateAndStoreSilenceWindow(
  supabase: SupabaseClient,
  patientId: string,
  tenantId: string,
  weights?: SilenceWindowWeights
): Promise<SilenceWindowResult> {
  await auditLogger.clinical('SILENCE_WINDOW_CALCULATION_STARTED', true, {
    patientId,
    tenantId,
  });

  try {
    // Fetch communication metrics
    const input = await fetchPatientCommunicationMetrics(supabase, patientId);

    // Calculate score
    const result = calculateSilenceWindowScore(input, weights);

    // Store in database
    const record: Partial<SilenceWindowRecord> = {
      patient_id: patientId,
      tenant_id: tenantId,
      assessment_date: result.calculatedAt,
      days_since_last_contact: input.daysSinceLastContact,
      missed_outreach_calls: input.missedOutreachCalls,
      missed_appointments: input.missedAppointments,
      unread_messages: input.unreadMessages,
      days_since_last_check_in: input.daysSinceLastCheckIn ?? null,
      portal_logins_30_day: input.portalLogins30Day ?? null,
      silence_score: result.score,
      risk_level: result.riskLevel,
      alert_triggered: result.alertTriggered,
      day_score: result.components.dayScore,
      call_score: result.components.callScore,
      appt_score: result.components.apptScore,
      msg_score: result.components.msgScore,
      data_confidence: result.dataConfidence,
      weights_applied: result.weightsApplied,
      recommended_actions: result.recommendedActions,
    };

    const { error } = await supabase
      .from('communication_silence_window')
      .upsert(record, {
        onConflict: 'patient_id,assessment_date::date',
        ignoreDuplicates: false,
      });

    if (error) {
      await auditLogger.error('SILENCE_WINDOW_STORE_FAILED', error.message, {
        patientId,
        tenantId,
      });
      throw error;
    }

    // Log if alert triggered
    if (result.alertTriggered) {
      await auditLogger.clinical('SILENCE_WINDOW_ALERT_TRIGGERED', true, {
        patientId,
        score: result.score,
        riskLevel: result.riskLevel,
        recommendedActions: result.recommendedActions.length,
      });
    }

    await auditLogger.clinical('SILENCE_WINDOW_CALCULATION_COMPLETED', true, {
      patientId,
      score: result.score,
      riskLevel: result.riskLevel,
    });

    return result;
  } catch (error) {
    await auditLogger.error('SILENCE_WINDOW_CALCULATION_FAILED', error as Error, {
      patientId,
      tenantId,
    });
    throw error;
  }
}

/**
 * Get silence window history for trend analysis
 */
export async function getSilenceWindowHistory(
  supabase: SupabaseClient,
  patientId: string,
  days: number = 30
): Promise<SilenceWindowHistoryEntry[]> {
  await logPhiAccess({
    phiType: 'communication_metrics',
    phiResourceId: `silence_window_history_${patientId}`,
    patientId,
    accessType: 'view',
    accessMethod: 'API',
    purpose: 'treatment',
  });

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('communication_silence_window')
    .select('assessment_date, silence_score, risk_level, alert_triggered')
    .eq('patient_id', patientId)
    .gte('assessment_date', startDate.toISOString())
    .order('assessment_date', { ascending: true });

  if (error) {
    await auditLogger.error('SILENCE_WINDOW_HISTORY_FETCH_FAILED', error.message, {
      patientId,
      days,
    });
    throw error;
  }

  return (data || []).map((row) => ({
    date: row.assessment_date,
    score: row.silence_score,
    riskLevel: row.risk_level as SilenceWindowRiskLevel,
    alertTriggered: row.alert_triggered,
  }));
}

/**
 * Calculate silence window trend for a patient
 */
export async function calculateSilenceWindowTrend(
  supabase: SupabaseClient,
  patientId: string
): Promise<SilenceWindowTrend> {
  const history = await getSilenceWindowHistory(supabase, patientId, 30);

  if (history.length === 0) {
    // No history - calculate current score only
    const input = await fetchPatientCommunicationMetrics(supabase, patientId);
    const current = calculateSilenceWindowScore(input);

    return {
      patientId,
      currentScore: current.score,
      averageScore30Day: current.score,
      trendDirection: 'stable',
      changePercent7Day: 0,
      isRapidDeterioration: false,
      history: [],
    };
  }

  const currentScore = history[history.length - 1].score;
  const averageScore30Day = history.reduce((sum, h) => sum + h.score, 0) / history.length;

  // Find score from 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const score7DaysAgo = history.find(
    (h) => new Date(h.date) <= sevenDaysAgo
  )?.score;

  // Calculate change
  let changePercent7Day = 0;
  let trendDirection: 'improving' | 'stable' | 'worsening' = 'stable';

  if (score7DaysAgo !== undefined) {
    changePercent7Day = ((currentScore - score7DaysAgo) / Math.max(score7DaysAgo, 1)) * 100;

    if (changePercent7Day >= 20) {
      trendDirection = 'worsening';
    } else if (changePercent7Day <= -20) {
      trendDirection = 'improving';
    }
  }

  // Detect rapid deterioration (>30% increase in 7 days)
  const isRapidDeterioration = changePercent7Day >= 30;

  if (isRapidDeterioration) {
    await auditLogger.security('RAPID_SILENCE_DETERIORATION', 'high', {
      patientId,
      currentScore,
      score7DaysAgo,
      changePercent7Day,
    });
  }

  return {
    patientId,
    currentScore,
    averageScore30Day: Math.round(averageScore30Day),
    score7DaysAgo,
    trendDirection,
    changePercent7Day: Math.round(changePercent7Day),
    isRapidDeterioration,
    history,
  };
}

// =====================================================
// READMISSION RISK INTEGRATION
// =====================================================

/**
 * Calculate silence window contribution to readmission risk
 *
 * This integrates the silence window score into the comprehensive
 * readmission risk prediction model as a behavioral factor.
 */
export function calculateReadmissionRiskContribution(
  silenceResult: SilenceWindowResult,
  weight: number = 0.35
): SilenceWindowRiskContribution {
  // Normalize silence score to 0-1 risk contribution
  const normalizedScore = silenceResult.score / 100;
  const riskContribution = normalizedScore * weight;

  const triggeredHighRisk =
    silenceResult.riskLevel === 'critical' ||
    (silenceResult.riskLevel === 'elevated' && silenceResult.score >= 60);

  // Generate clinical explanation
  let explanation = '';
  if (silenceResult.riskLevel === 'critical') {
    explanation =
      'Critical communication silence detected. Patient has not engaged with care team or completed check-ins. ' +
      'This pattern strongly correlates with health decline and elevated readmission risk.';
  } else if (silenceResult.riskLevel === 'elevated') {
    explanation =
      'Elevated communication silence detected. Patient engagement is declining. ' +
      'Proactive outreach recommended to prevent potential health deterioration.';
  } else {
    explanation =
      'Normal communication patterns. Patient is actively engaged with care team and platform.';
  }

  return {
    silenceScore: silenceResult.score,
    riskContribution: Math.round(riskContribution * 100) / 100,
    weight,
    triggeredHighRisk,
    explanation,
  };
}

// =====================================================
// BULK OPERATIONS
// =====================================================

/**
 * Calculate silence window scores for multiple patients
 * Used for dashboard views and population health monitoring
 */
export async function calculateBulkSilenceWindow(
  supabase: SupabaseClient,
  input: BulkSilenceWindowInput
): Promise<BulkSilenceWindowResult> {
  const startTime = Date.now();

  await auditLogger.clinical('BULK_SILENCE_WINDOW_STARTED', true, {
    tenantId: input.tenantId,
    patientCount: input.patientIds.length,
  });

  const results: SilenceWindowResult[] = [];
  const skippedPatients: string[] = [];

  // Process in batches of 10 to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < input.patientIds.length; i += batchSize) {
    const batch = input.patientIds.slice(i, i + batchSize);

    const batchPromises = batch.map(async (patientId) => {
      try {
        const result = await calculateAndStoreSilenceWindow(
          supabase,
          patientId,
          input.tenantId
        );
        return { success: true, patientId, result };
      } catch {
        return { success: false, patientId, result: null };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const br of batchResults) {
      if (br.success && br.result) {
        results.push(br.result);
      } else {
        skippedPatients.push(br.patientId);
      }
    }
  }

  const processingTimeMs = Date.now() - startTime;

  const criticalAlerts = results.filter((r) => r.riskLevel === 'critical').length;
  const elevatedAlerts = results.filter((r) => r.riskLevel === 'elevated').length;

  await auditLogger.clinical('BULK_SILENCE_WINDOW_COMPLETED', true, {
    tenantId: input.tenantId,
    totalPatients: input.patientIds.length,
    assessedPatients: results.length,
    skippedPatients: skippedPatients.length,
    criticalAlerts,
    elevatedAlerts,
    processingTimeMs,
  });

  return {
    tenantId: input.tenantId,
    assessmentDate: input.assessmentDate || new Date().toISOString(),
    totalPatients: input.patientIds.length,
    assessedPatients: results.length,
    skippedPatients: skippedPatients.length,
    results,
    criticalAlerts,
    elevatedAlerts,
    processingTimeMs,
  };
}

// =====================================================
// EXPORTS
// =====================================================

/**
 * Singleton service instance for dependency injection
 */
class CommunicationSilenceWindowService {
  calculateScore = calculateSilenceWindowScore;
  fetchMetrics = fetchPatientCommunicationMetrics;
  calculateAndStore = calculateAndStoreSilenceWindow;
  getHistory = getSilenceWindowHistory;
  calculateTrend = calculateSilenceWindowTrend;
  calculateReadmissionContribution = calculateReadmissionRiskContribution;
  calculateBulk = calculateBulkSilenceWindow;
}

export const communicationSilenceWindowService = new CommunicationSilenceWindowService();

// Backward compatibility: export individual functions
export {
  calculateSilenceWindowScore as calculateSilenceScore,
  fetchPatientCommunicationMetrics as fetchCommunicationMetrics,
  calculateAndStoreSilenceWindow as calculateAndStoreScore,
};
