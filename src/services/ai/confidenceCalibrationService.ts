/**
 * Confidence Calibration Service
 *
 * P3-3 + P3-4: Wraps any AI risk score with population-aware calibration
 * via the Claude-in-Claude calibrate-confidence MCP tool.
 *
 * Used after ai-readmission-predictor and ai-fall-risk-predictor return
 * raw scores — this service adjusts them based on population context,
 * SDOH factors, and data reliability.
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md (P3-3, P3-4)
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import type { ServiceResult } from '../_base';
import { success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { PopulationContextFetcher } from './populationContextFetcher';
import type { PopulationContext } from './populationContextFetcher';

// ============================================================================
// Types
// ============================================================================

/** A risk factor from the original AI scoring */
export interface RiskFactor {
  name: string;
  original_weight: number;
  category: string;
  data_source: string;
  data_freshness: string;
}

/** Input for calibration */
export interface CalibrationRequest {
  patient_id: string;
  tenant_id: string;
  skill_key: string;
  original_score: number;
  original_confidence: number;
  factors: RiskFactor[];
}

/** Result from the calibrate-confidence MCP tool */
export interface CalibrationResult {
  calibrated_score: number;
  calibrated_confidence: number;
  adjustment_direction: 'increased' | 'decreased' | 'unchanged';
  score_delta: number;
  adjustment_reasoning: string;
  factor_reliability: Array<{
    factor_name: string;
    reliability: string;
    adjusted_weight: number;
    adjustment_reasoning: string;
  }>;
  recommended_action: string;
  needs_additional_data: boolean;
  additional_data_suggestions: string[];
}

// ============================================================================
// Service
// ============================================================================

export const ConfidenceCalibrationService = {
  /**
   * Calibrate a risk score using population context and Claude meta-reasoning.
   *
   * 1. Fetches population context (demographics + SDOH) for the patient
   * 2. Sends the original score + context to the calibrate-confidence MCP tool
   * 3. Returns the calibrated score with adjustment reasoning
   *
   * If population context is unavailable, calibration still proceeds
   * with reduced context — Claude will note the missing data.
   */
  async calibrateScore(
    request: CalibrationRequest
  ): Promise<ServiceResult<CalibrationResult>> {
    try {
      await auditLogger.info('CONFIDENCE_CALIBRATION_START', {
        patientId: request.patient_id,
        skillKey: request.skill_key,
        originalScore: request.original_score,
        originalConfidence: request.original_confidence,
      });

      // Fetch population context (non-blocking — partial context is OK)
      let populationContext: PopulationContext | undefined;
      const contextResult = await PopulationContextFetcher.getCalibrationContext(
        request.patient_id
      );
      if (contextResult.success) {
        populationContext = contextResult.data.population_context;
      }

      // Call the MCP Claude server's calibration tool
      const { data, error } = await supabase.functions.invoke('mcp-claude-server', {
        body: {
          method: 'tools/call',
          params: {
            name: 'calibrate-confidence',
            arguments: {
              patient_id: request.patient_id,
              tenant_id: request.tenant_id,
              skill_key: request.skill_key,
              original_score: request.original_score,
              original_confidence: request.original_confidence,
              factors: request.factors,
              population_context: populationContext,
            },
          },
          id: crypto.randomUUID(),
        },
      });

      if (error) {
        return failure(
          'META_TRIAGE_FAILED',
          `Confidence calibration call failed: ${error.message}`
        );
      }

      // Parse the MCP response
      const mcpResponse = data as { result?: { content?: Array<{ text?: string }> } };
      const resultText = mcpResponse?.result?.content?.[0]?.text;
      if (!resultText) {
        return failure('META_TRIAGE_EMPTY', 'Confidence calibration returned empty result');
      }

      const calibrated = JSON.parse(resultText) as CalibrationResult;

      await auditLogger.info('CONFIDENCE_CALIBRATION_COMPLETE', {
        patientId: request.patient_id,
        skillKey: request.skill_key,
        originalScore: request.original_score,
        calibratedScore: calibrated.calibrated_score,
        direction: calibrated.adjustment_direction,
        delta: calibrated.score_delta,
        needsAdditionalData: calibrated.needs_additional_data,
      });

      return success(calibrated);
    } catch (err: unknown) {
      await auditLogger.error(
        'CONFIDENCE_CALIBRATION_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patientId: request.patient_id, skillKey: request.skill_key }
      );
      return failure('AGGREGATION_FAILED', 'Failed to calibrate confidence score');
    }
  },

  /**
   * Convenience: calibrate a readmission risk score.
   * Wraps calibrateScore with the readmission predictor skill key.
   */
  async calibrateReadmissionRisk(
    patientId: string,
    tenantId: string,
    score: number,
    confidence: number,
    factors: RiskFactor[]
  ): Promise<ServiceResult<CalibrationResult>> {
    return this.calibrateScore({
      patient_id: patientId,
      tenant_id: tenantId,
      skill_key: 'ai-readmission-predictor',
      original_score: score,
      original_confidence: confidence,
      factors,
    });
  },

  /**
   * Convenience: calibrate a fall risk score.
   * Wraps calibrateScore with the fall risk predictor skill key.
   */
  async calibrateFallRisk(
    patientId: string,
    tenantId: string,
    score: number,
    confidence: number,
    factors: RiskFactor[]
  ): Promise<ServiceResult<CalibrationResult>> {
    return this.calibrateScore({
      patient_id: patientId,
      tenant_id: tenantId,
      skill_key: 'ai-fall-risk-predictor',
      original_score: score,
      original_confidence: confidence,
      factors,
    });
  },
};
