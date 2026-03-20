/**
 * Triage Signal Aggregation Service
 *
 * P1-2: Collects escalation outputs from multiple AI skills for a single patient
 * and normalizes them into a unified signal array for the Claude-in-Claude
 * meta-triage tool (evaluate-escalation-conflict).
 *
 * Aggregates from:
 * - CareEscalationScorerService (clinical escalation: 5 levels)
 * - MissedCheckInEscalationService (welfare escalation: 5 levels)
 * - ResultEscalationService (lab severity: 4 levels)
 * - NurseOSAdvisorService (provider burnout: 4 levels) — P4-4
 *
 * Returns normalized signals with a unified escalation enum that the
 * meta-triage MCP tool can reason about.
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md (P1-2)
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import type { ServiceResult } from '../_base';
import { success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { CareEscalationScorerService } from './careEscalationScorerService';
import type {
  EscalationCategory,
  EscalationResponse as CareEscalationResponse,
} from './careEscalationScorerService';
import { MissedCheckInEscalationService } from './missedCheckInEscalationService';
import type {
  CheckInEscalationLevel,
  EscalationResponse as MissedCheckInResponse,
} from './missedCheckInEscalationService';
import { resultEscalationService } from '../resultEscalationService';
import type {
  EscalationLogEntry,
  EscalationSeverity,
} from '../resultEscalationService';
import { NurseOSAdvisorService } from './nurseosAdvisorService';

// ============================================================================
// Types — Unified Signal Format
// ============================================================================

/** Unified escalation level across all services */
export type UnifiedEscalationLevel = 'none' | 'monitor' | 'notify' | 'escalate' | 'emergency';

/** A normalized signal from any escalation source */
export interface TriageSignal {
  skill_key: string;
  recommended_level: UnifiedEscalationLevel;
  confidence: number;
  factors: string[];
  data_source: string;
  generated_at: string;
}

/** Result of signal aggregation */
export interface SignalAggregationResult {
  patient_id: string;
  tenant_id: string;
  signals: TriageSignal[];
  current_decision: UnifiedEscalationLevel;
  has_conflicts: boolean;
  patient_demographics?: {
    age_range?: string;
    risk_tier?: string;
    days_since_admission?: number;
    active_conditions_count?: number;
  };
  collected_at: string;
}

/** Individual source results (for debugging/audit) */
export interface SourceResults {
  care_escalation: CareEscalationResponse | null;
  missed_check_in: MissedCheckInResponse | null;
  lab_escalations: EscalationLogEntry[] | null;
}

// ============================================================================
// Enum Mapping — Three Different Enums → One Unified Enum
// ============================================================================

/** Map CareEscalationScorer levels to unified levels (1:1 match) */
function mapCareEscalationLevel(level: EscalationCategory): UnifiedEscalationLevel {
  return level;
}

/** Map MissedCheckIn levels to unified levels */
function mapCheckInLevel(level: CheckInEscalationLevel): UnifiedEscalationLevel {
  switch (level) {
    case 'none': return 'none';
    case 'low': return 'monitor';
    case 'medium': return 'notify';
    case 'high': return 'escalate';
    case 'emergency': return 'emergency';
    default: return 'none';
  }
}

/** Map ResultEscalation severity to unified levels */
function mapLabSeverity(severity: EscalationSeverity): UnifiedEscalationLevel {
  switch (severity) {
    case 'critical': return 'emergency';
    case 'high': return 'escalate';
    case 'moderate': return 'notify';
    case 'low': return 'monitor';
    default: return 'none';
  }
}

/** Determine the highest escalation level from an array of levels */
function highestLevel(levels: UnifiedEscalationLevel[]): UnifiedEscalationLevel {
  const order: UnifiedEscalationLevel[] = ['none', 'monitor', 'notify', 'escalate', 'emergency'];
  let maxIndex = 0;
  for (const level of levels) {
    const idx = order.indexOf(level);
    if (idx > maxIndex) maxIndex = idx;
  }
  return order[maxIndex];
}

/** Check if signals have conflicting recommendations */
function detectConflicts(signals: TriageSignal[]): boolean {
  if (signals.length < 2) return false;
  const levels = signals.map(s => s.recommended_level);
  const order: UnifiedEscalationLevel[] = ['none', 'monitor', 'notify', 'escalate', 'emergency'];
  const indices = levels.map(l => order.indexOf(l));
  const spread = Math.max(...indices) - Math.min(...indices);
  // Conflict = signals disagree by 2+ levels (e.g., "none" vs "escalate")
  return spread >= 2;
}

// ============================================================================
// Signal Builders — Extract normalized signals from each source
// ============================================================================

function buildCareSignal(response: CareEscalationResponse): TriageSignal {
  const assessment = response.assessment;
  return {
    skill_key: 'ai-care-escalation-scorer',
    recommended_level: mapCareEscalationLevel(assessment.escalationCategory),
    confidence: (assessment.confidenceLevel ?? 0) / 100,
    factors: assessment.escalationFactors.map(f => `${f.factor} (${f.severity})`),
    data_source: 'clinical_assessment',
    generated_at: response.metadata.generated_at,
  };
}

function buildMissedCheckInSignal(response: MissedCheckInResponse): TriageSignal {
  const escalation = response.escalation;
  return {
    skill_key: 'ai-missed-checkin-escalation',
    recommended_level: mapCheckInLevel(escalation.escalationLevel),
    confidence: 0.7, // Missed check-in is behavioral, moderate confidence
    factors: escalation.riskFactors,
    data_source: 'check_in_patterns',
    generated_at: response.metadata.processed_at,
  };
}

function buildLabSignals(entries: EscalationLogEntry[]): TriageSignal[] {
  if (entries.length === 0) return [];
  // Group by severity — take the highest
  const highest = entries.reduce((worst, entry) => {
    const order = ['low', 'moderate', 'high', 'critical'];
    return order.indexOf(entry.severity) > order.indexOf(worst.severity) ? entry : worst;
  }, entries[0]);

  return [{
    skill_key: 'result-escalation',
    recommended_level: mapLabSeverity(highest.severity as EscalationSeverity),
    confidence: 0.9, // Lab results are objective measurements — high confidence
    factors: entries.map(e => `${e.test_name}: ${e.test_value} ${e.test_unit ?? ''} (${e.severity})`),
    data_source: 'lab_results',
    generated_at: highest.created_at,
  }];
}

// ============================================================================
// Service
// ============================================================================

export const TriageSignalAggregationService = {
  /**
   * Aggregate escalation signals from all AI skills for a patient.
   *
   * Calls CareEscalationScorer, MissedCheckInEscalation, and ResultEscalation
   * in parallel, then normalizes their outputs into a unified signal array.
   *
   * If any source fails, it's logged but doesn't block aggregation — partial
   * signals are still useful for meta-triage.
   */
  async aggregateSignals(
    patientId: string,
    assessorId: string,
    tenantId: string
  ): Promise<ServiceResult<SignalAggregationResult>> {
    try {
      await auditLogger.info('TRIAGE_SIGNAL_AGGREGATION_START', {
        patientId,
        assessorId,
        tenantId,
      });

      // Call all services in parallel — don't block on any single failure
      const [careResult, missedResult, labResult] = await Promise.allSettled([
        CareEscalationScorerService.scorePatient({
          patientId,
          assessorId,
          context: 'routine_assessment',
        }),
        MissedCheckInEscalationService.analyzeAndEscalate({
          patientId,
          triggerType: 'scheduled_check',
        }),
        resultEscalationService.getActiveEscalations({
          patient_id: patientId,
          status: 'pending',
        }),
      ]);

      // Extract successful results
      const signals: TriageSignal[] = [];

      // Care escalation signal
      if (careResult.status === 'fulfilled' && careResult.value.success && careResult.value.data) {
        signals.push(buildCareSignal(careResult.value.data));
      } else {
        await auditLogger.warn('TRIAGE_CARE_ESCALATION_UNAVAILABLE', {
          patientId,
          reason: careResult.status === 'rejected'
            ? String(careResult.reason)
            : (careResult.value as ServiceResult<unknown>).error ?? 'unknown',
        });
      }

      // Missed check-in signal
      if (missedResult.status === 'fulfilled' && missedResult.value.success && missedResult.value.data) {
        signals.push(buildMissedCheckInSignal(missedResult.value.data));
      } else {
        await auditLogger.warn('TRIAGE_MISSED_CHECKIN_UNAVAILABLE', {
          patientId,
          reason: missedResult.status === 'rejected'
            ? String(missedResult.reason)
            : (missedResult.value as ServiceResult<unknown>).error ?? 'unknown',
        });
      }

      // Lab escalation signals
      if (labResult.status === 'fulfilled' && labResult.value.success && labResult.value.data) {
        signals.push(...buildLabSignals(labResult.value.data));
      } else {
        await auditLogger.warn('TRIAGE_LAB_ESCALATION_UNAVAILABLE', {
          patientId,
          reason: labResult.status === 'rejected'
            ? String(labResult.reason)
            : (labResult.value as ServiceResult<unknown>).error ?? 'unknown',
        });
      }

      // Provider burnout signal (P4-4: NurseOS triage integration)
      // If the assessor (provider) has burnout data, include it as a signal.
      // This allows meta-triage to reason about provider wellness alongside patient risk.
      try {
        const burnoutSignal = await this.fetchProviderBurnoutSignal(assessorId);
        if (burnoutSignal) {
          signals.push(burnoutSignal);
        }
      } catch {
        // Provider burnout data is supplementary — don't block triage on failure
        await auditLogger.warn('TRIAGE_PROVIDER_BURNOUT_UNAVAILABLE', {
          assessorId,
          reason: 'Failed to fetch provider burnout data',
        });
      }

      if (signals.length === 0) {
        return failure(
          'NO_SIGNALS',
          'No escalation signals available from any source'
        );
      }

      // Determine current decision (highest of all signals)
      const currentDecision = highestLevel(signals.map(s => s.recommended_level));

      // Check for conflicts
      const hasConflicts = detectConflicts(signals);

      const result: SignalAggregationResult = {
        patient_id: patientId,
        tenant_id: tenantId,
        signals,
        current_decision: currentDecision,
        has_conflicts: hasConflicts,
        collected_at: new Date().toISOString(),
      };

      await auditLogger.info('TRIAGE_SIGNAL_AGGREGATION_COMPLETE', {
        patientId,
        signalCount: signals.length,
        currentDecision,
        hasConflicts,
      });

      return success(result);
    } catch (err: unknown) {
      await auditLogger.error(
        'TRIAGE_SIGNAL_AGGREGATION_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patientId }
      );
      return failure('AGGREGATION_FAILED', 'Failed to aggregate triage signals');
    }
  },

  /**
   * Call the meta-triage MCP tool to resolve conflicts in aggregated signals.
   *
   * This is the Claude-in-Claude call: the client sends aggregated signals
   * to the mcp-claude-server's evaluate-escalation-conflict tool, which
   * uses Claude to reason about which signals to trust.
   *
   * Only called when signals have conflicts (has_conflicts === true).
   */
  async resolveConflicts(
    aggregation: SignalAggregationResult
  ): Promise<ServiceResult<Record<string, unknown>>> {
    try {
      if (!aggregation.has_conflicts) {
        return success({
          resolved_level: aggregation.current_decision,
          confidence: 1.0,
          conflict_detected: false,
          reasoning: 'No conflicts detected — all signals agree',
          requires_review: false,
        });
      }

      await auditLogger.info('TRIAGE_META_RESOLVE_START', {
        patientId: aggregation.patient_id,
        signalCount: aggregation.signals.length,
        conflictDetected: true,
      });

      // Call the MCP Claude server's triage tool
      const { data, error } = await supabase.functions.invoke('mcp-claude-server', {
        body: {
          method: 'tools/call',
          params: {
            name: 'evaluate-escalation-conflict',
            arguments: {
              patient_id: aggregation.patient_id,
              tenant_id: aggregation.tenant_id,
              signals: aggregation.signals,
              current_decision: aggregation.current_decision,
              patient_demographics: aggregation.patient_demographics,
            },
          },
          id: crypto.randomUUID(),
        },
      });

      if (error) {
        return failure('META_TRIAGE_FAILED', `Meta-triage call failed: ${error.message}`);
      }

      // Parse the MCP response — the result is in jsonrpc format
      const mcpResponse = data as { result?: { content?: Array<{ text?: string }> } };
      const resultText = mcpResponse?.result?.content?.[0]?.text;
      if (!resultText) {
        return failure('META_TRIAGE_EMPTY', 'Meta-triage returned empty result');
      }

      const resolved = JSON.parse(resultText) as Record<string, unknown>;

      await auditLogger.info('TRIAGE_META_RESOLVE_COMPLETE', {
        patientId: aggregation.patient_id,
        resolvedLevel: resolved.resolved_level,
        confidence: resolved.confidence,
      });

      return success(resolved);
    } catch (err: unknown) {
      await auditLogger.error(
        'TRIAGE_META_RESOLVE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patientId: aggregation.patient_id }
      );
      return failure('META_TRIAGE_ERROR', 'Failed to resolve triage conflicts');
    }
  },

  /**
   * Full pipeline: aggregate signals → detect conflicts → resolve if needed.
   *
   * This is the main entry point for the triage system.
   */
  async triagePatient(
    patientId: string,
    assessorId: string,
    tenantId: string
  ): Promise<ServiceResult<{
    aggregation: SignalAggregationResult;
    resolution: Record<string, unknown> | null;
  }>> {
    // Step 1: Aggregate signals
    const aggregationResult = await this.aggregateSignals(patientId, assessorId, tenantId);
    if (!aggregationResult.success) {
      return failure(
        aggregationResult.error?.code ?? 'AGGREGATION_FAILED',
        aggregationResult.error?.message ?? 'Signal aggregation failed'
      );
    }

    const aggregation = aggregationResult.data;

    // Step 2: If conflicts, resolve with meta-triage
    let resolution: Record<string, unknown> | null = null;
    if (aggregation.has_conflicts) {
      const resolveResult = await this.resolveConflicts(aggregation);
      if (resolveResult.success && resolveResult.data) {
        resolution = resolveResult.data;
      }
      // If resolution fails, we still return the aggregation — clinician decides
    }

    return success({ aggregation, resolution });
  },

  /**
   * Fetch provider burnout data and build a triage signal.
   * Returns null if no burnout assessment exists (provider hasn't been assessed).
   *
   * P4-4: NurseOS triage integration — provider wellness as a triage factor.
   */
  async fetchProviderBurnoutSignal(
    providerId: string
  ): Promise<TriageSignal | null> {
    // Get latest burnout assessment
    const { data: assessment } = await supabase
      .from('provider_burnout_assessments')
      .select('emotional_exhaustion_score, depersonalization_score, personal_accomplishment_score, composite_burnout_score, risk_level')
      .eq('practitioner_id', providerId)
      .order('assessment_date', { ascending: false })
      .limit(1)
      .single();

    if (!assessment || !assessment.risk_level) {
      return null; // No assessment — no signal to contribute
    }

    // Get stress trend from recent check-ins
    const { data: checkins } = await supabase
      .from('provider_daily_checkins')
      .select('stress_level, checkin_date')
      .eq('practitioner_id', providerId)
      .order('checkin_date', { ascending: false })
      .limit(7);

    let stressTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    let consecutiveHighDays = 0;

    if (checkins && checkins.length >= 3) {
      const stressValues = checkins.map(c => Number(c.stress_level ?? 0));
      const firstHalf = stressValues.slice(Math.floor(stressValues.length / 2));
      const secondHalf = stressValues.slice(0, Math.floor(stressValues.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      if (secondAvg > firstAvg + 0.5) stressTrend = 'increasing';
      else if (secondAvg < firstAvg - 0.5) stressTrend = 'decreasing';

      // Count consecutive high-stress days (stress ≥ 7)
      for (const val of stressValues) {
        if (val >= 7) consecutiveHighDays++;
        else break;
      }
    }

    return NurseOSAdvisorService.buildBurnoutSignal({
      risk_level: assessment.risk_level as 'low' | 'moderate' | 'high' | 'critical',
      composite_score: Number(assessment.composite_burnout_score ?? 0),
      emotional_exhaustion_score: Number(assessment.emotional_exhaustion_score),
      depersonalization_score: Number(assessment.depersonalization_score),
      personal_accomplishment_score: Number(assessment.personal_accomplishment_score),
      stress_trend: stressTrend,
      consecutive_high_stress_days: consecutiveHighDays,
    });
  },
};
