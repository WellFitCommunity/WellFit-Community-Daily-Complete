/**
 * NurseOS AI Advisor Service — Client-Side Orchestrator
 *
 * Provides browser-side access to the three NurseOS AI edge functions:
 * - Burnout Advisor (analysis + intervention recommendations)
 * - Module Recommendations (personalized training suggestions)
 * - Stress Narrative (plain-language trend summary)
 *
 * Also provides a burnout signal builder for triage integration.
 *
 * Tracker: docs/trackers/nurseos-completion-tracker.md (P4-1 through P4-4)
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import type { ServiceResult } from '../_base';
import { success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import type { UnifiedEscalationLevel, TriageSignal } from './triageSignalAggregationService';

// ============================================================================
// Response Types
// ============================================================================

export interface BurnoutAdvisorResponse {
  risk_summary: string;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  primary_concern: string;
  intervention_recommendations: {
    type: 'immediate' | 'short_term' | 'long_term';
    action: string;
    rationale: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  self_care_suggestions: string[];
  escalation_needed: boolean;
  escalation_reason: string | null;
  confidence: number;
}

export interface ModuleRecommendationResponse {
  recommendations: {
    module_category: string;
    module_name: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
    estimated_minutes: number;
  }[];
  overall_focus: string;
  encouragement: string;
  confidence: number;
}

export interface StressNarrativeResponse {
  narrative: string;
  trend: 'improving' | 'stable' | 'worsening';
  key_insights: string[];
  contributing_factors: {
    factor: string;
    correlation: 'strong' | 'moderate' | 'weak';
    description: string;
  }[];
  positive_patterns: string[];
  action_items: string[];
  confidence: number;
}

interface EdgeFunctionResponse<T> {
  success: boolean;
  data: T;
  metadata: {
    model: string;
    skill_key: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
  };
}

// ============================================================================
// Service
// ============================================================================

export const NurseOSAdvisorService = {
  /**
   * Get burnout analysis and intervention recommendations.
   * Uses Sonnet for clinical-grade analysis.
   */
  async analyzeBurnout(
    providerId: string,
    assessmentId?: string
  ): Promise<ServiceResult<BurnoutAdvisorResponse>> {
    try {
      await auditLogger.info('NURSEOS_BURNOUT_ANALYSIS_START', {
        providerId,
        assessmentId,
        skillKey: 'nurseos_burnout_advisor',
      });

      const { data, error } = await supabase.functions.invoke(
        'ai-nurseos-burnout-advisor',
        { body: { providerId, assessmentId } }
      );

      if (error) {
        await auditLogger.error(
          'NURSEOS_BURNOUT_ANALYSIS_FAILED',
          error instanceof Error ? error : new Error(String(error)),
          { providerId }
        );
        return failure('AI_SERVICE_ERROR', `Burnout analysis failed: ${error.message}`);
      }

      const response = data as EdgeFunctionResponse<BurnoutAdvisorResponse>;
      if (!response.success || !response.data) {
        return failure('OPERATION_FAILED', 'Burnout advisor returned empty result');
      }

      await auditLogger.info('NURSEOS_BURNOUT_ANALYSIS_COMPLETE', {
        providerId,
        riskLevel: response.data.risk_level,
        escalationNeeded: response.data.escalation_needed,
        cost: response.metadata.cost_usd,
      });

      return success(response.data);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSEOS_BURNOUT_ANALYSIS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { providerId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to analyze burnout');
    }
  },

  /**
   * Get personalized module recommendations based on burnout profile.
   * Uses Haiku for fast, cost-effective suggestions.
   */
  async getModuleRecommendations(
    providerId: string,
    productLine?: 'clarity' | 'shield'
  ): Promise<ServiceResult<ModuleRecommendationResponse>> {
    try {
      await auditLogger.info('NURSEOS_MODULE_RECS_START', {
        providerId,
        productLine,
        skillKey: 'nurseos_module_recommendations',
      });

      const { data, error } = await supabase.functions.invoke(
        'ai-nurseos-module-recommendations',
        { body: { providerId, productLine } }
      );

      if (error) {
        await auditLogger.error(
          'NURSEOS_MODULE_RECS_FAILED',
          error instanceof Error ? error : new Error(String(error)),
          { providerId }
        );
        return failure('AI_SERVICE_ERROR', `Module recommendations failed: ${error.message}`);
      }

      const response = data as EdgeFunctionResponse<ModuleRecommendationResponse>;
      if (!response.success || !response.data) {
        return failure('OPERATION_FAILED', 'Module recommendations returned empty result');
      }

      await auditLogger.info('NURSEOS_MODULE_RECS_COMPLETE', {
        providerId,
        recommendationCount: response.data.recommendations.length,
        cost: response.metadata.cost_usd,
      });

      return success(response.data);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSEOS_MODULE_RECS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { providerId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to get module recommendations');
    }
  },

  /**
   * Generate a plain-language stress trend narrative.
   * Uses Haiku for warm, human narrative generation.
   */
  async getStressNarrative(
    providerId: string,
    period: '7d' | '30d' = '7d'
  ): Promise<ServiceResult<StressNarrativeResponse>> {
    try {
      await auditLogger.info('NURSEOS_STRESS_NARRATIVE_START', {
        providerId,
        period,
        skillKey: 'nurseos_stress_narrative',
      });

      const { data, error } = await supabase.functions.invoke(
        'ai-nurseos-stress-narrative',
        { body: { providerId, period } }
      );

      if (error) {
        await auditLogger.error(
          'NURSEOS_STRESS_NARRATIVE_FAILED',
          error instanceof Error ? error : new Error(String(error)),
          { providerId }
        );
        return failure('AI_SERVICE_ERROR', `Stress narrative failed: ${error.message}`);
      }

      const response = data as EdgeFunctionResponse<StressNarrativeResponse>;
      if (!response.success || !response.data) {
        return failure('OPERATION_FAILED', 'Stress narrative returned empty result');
      }

      await auditLogger.info('NURSEOS_STRESS_NARRATIVE_COMPLETE', {
        providerId,
        trend: response.data.trend,
        cost: response.metadata.cost_usd,
      });

      return success(response.data);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSEOS_STRESS_NARRATIVE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { providerId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to generate stress narrative');
    }
  },

  /**
   * Build a triage signal from provider burnout data.
   * Used by triageSignalAggregationService to include provider wellness
   * in the meta-triage decision for patients they're caring for.
   *
   * Maps burnout risk levels to unified escalation levels:
   * - critical → emergency (provider in crisis — patient safety risk)
   * - high → escalate (provider at risk — monitor patient interactions)
   * - moderate → notify (watch for patterns)
   * - low → none (no concern)
   */
  buildBurnoutSignal(
    burnoutData: {
      risk_level: 'low' | 'moderate' | 'high' | 'critical';
      composite_score: number;
      emotional_exhaustion_score: number;
      depersonalization_score: number;
      personal_accomplishment_score: number;
      stress_trend?: 'increasing' | 'stable' | 'decreasing';
      consecutive_high_stress_days?: number;
    }
  ): TriageSignal {
    const levelMap: Record<string, UnifiedEscalationLevel> = {
      critical: 'emergency',
      high: 'escalate',
      moderate: 'notify',
      low: 'none',
    };

    let recommended = levelMap[burnoutData.risk_level] ?? 'none';

    // Upgrade if stress trend is worsening + moderate burnout
    if (
      burnoutData.stress_trend === 'increasing' &&
      burnoutData.risk_level === 'moderate'
    ) {
      recommended = 'monitor';
    }

    // Upgrade if consecutive high stress days ≥ 5
    if (
      (burnoutData.consecutive_high_stress_days ?? 0) >= 5 &&
      recommended === 'none'
    ) {
      recommended = 'monitor';
    }

    const factors: string[] = [];
    if (burnoutData.emotional_exhaustion_score >= 27) {
      factors.push(`High emotional exhaustion (${burnoutData.emotional_exhaustion_score}/54)`);
    }
    if (burnoutData.depersonalization_score >= 13) {
      factors.push(`High depersonalization (${burnoutData.depersonalization_score}/30)`);
    }
    if (burnoutData.personal_accomplishment_score <= 21) {
      factors.push(`Low personal accomplishment (${burnoutData.personal_accomplishment_score}/48)`);
    }
    if (burnoutData.stress_trend === 'increasing') {
      factors.push('Stress trend worsening');
    }
    if ((burnoutData.consecutive_high_stress_days ?? 0) >= 3) {
      factors.push(`${burnoutData.consecutive_high_stress_days} consecutive high-stress days`);
    }
    if (factors.length === 0) {
      factors.push(`Composite burnout score: ${burnoutData.composite_score.toFixed(0)}/100`);
    }

    // Confidence based on data completeness
    const confidence = burnoutData.stress_trend ? 0.8 : 0.6;

    return {
      skill_key: 'nurseos_burnout_advisor',
      recommended_level: recommended,
      confidence,
      factors,
      data_source: 'provider_wellness_assessment',
      generated_at: new Date().toISOString(),
    };
  },
};
