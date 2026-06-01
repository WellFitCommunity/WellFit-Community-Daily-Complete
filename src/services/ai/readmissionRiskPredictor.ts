/**
 * AI-Powered Readmission Risk Predictor
 *
 * Skill #3: Readmission Risk Predictor
 * - Uses Claude Sonnet 4.5 (accuracy matters for clinical decisions)
 * - Runs ONCE at discharge (95% token reduction vs continuous monitoring)
 * - Analyzes: discharge plans + SDOH + check-in patterns + readmission history
 * - Auto-generates care plans for high-risk patients
 *
 * Security: Input validation, SQL injection prevention, HIPAA compliance
 * Testing: Comprehensive Jest unit + integration tests
 *
 * Decomposed 2026-05-29 (CLAUDE.md Commandment #12, 600-line limit). This file
 * is now the orchestrator; cohesive concerns live in ./readmission-predictor/*:
 *   - types.ts                 shared types + guards
 *   - plainLanguageExplainer.ts patient-facing explanation generator
 *   - dischargeValidator.ts     input validation
 *   - predictionPrompt.ts       system prompt + prompt builder + AI parser
 *   - patientDataGatherer.ts    (legacy) raw data gather, superseded by featureExtractor
 * Import paths are preserved via the type re-exports below — behavior unchanged.
 */

import { supabase } from '../../lib/supabaseClient';
import { mcpOptimizer } from '../mcp/mcp-cost-optimizer';
import type { MCPCostOptimizer } from '../mcp/mcp-cost-optimizer';
import { ReadmissionTrackingService as _ReadmissionTrackingService } from '../readmissionTrackingService';
import { featureExtractor } from './readmissionFeatureExtractor';
import type { ReadmissionRiskFeatures } from '../../types/readmissionRiskFeatures';
import {
  EVIDENCE_BASED_WEIGHTS as _EVIDENCE_BASED_WEIGHTS,
  ENGAGEMENT_FEATURE_WEIGHTS as _ENGAGEMENT_FEATURE_WEIGHTS
} from '../../types/readmissionRiskFeatures';
import { createAccuracyTrackingService, type AccuracyTrackingService } from './accuracyTrackingService';
import { ConfidenceCalibrationService } from './confidenceCalibrationService';
import type { RiskFactor as CalibrationRiskFactor } from './confidenceCalibrationService';
import { auditLogger } from '../auditLogger';

import { DischargeValidator } from './readmission-predictor/dischargeValidator';
import { PlainLanguageExplainer } from './readmission-predictor/plainLanguageExplainer';
import {
  READMISSION_SYSTEM_PROMPT,
  buildComprehensivePredictionPrompt,
  parseAIPrediction,
} from './readmission-predictor/predictionPrompt';
import { isTenantConfig, type DischargeContext, type ReadmissionPrediction, type TenantConfig } from './readmission-predictor/types';

// Re-export the public type surface so existing import paths keep working.
export type {
  DischargeContext,
  RiskFactor,
  ProtectiveFactor,
  RecommendedIntervention,
  ReadmissionPrediction,
} from './readmission-predictor/types';

// =====================================================
// READMISSION RISK PREDICTOR SERVICE
// =====================================================

export class ReadmissionRiskPredictor {
  private optimizer: MCPCostOptimizer;
  private accuracyTracker: AccuracyTrackingService;

  constructor(optimizer?: MCPCostOptimizer) {
    this.optimizer = optimizer || mcpOptimizer;
    this.accuracyTracker = createAccuracyTrackingService(supabase);
  }

  /**
   * Predict readmission risk at discharge
   * Main entry point for the service
   */
  async predictReadmissionRisk(context: DischargeContext): Promise<ReadmissionPrediction> {
    // Security: Validate all inputs
    DischargeValidator.validateDischargeContext(context);

    // Check if skill is enabled for this tenant
    const config = await this.getTenantConfig(context.tenantId);
    if (!config.readmission_predictor_enabled) {
      throw new Error('Readmission risk predictor is not enabled for this tenant');
    }

    // Extract comprehensive evidence-based features
    const features = await featureExtractor.extractFeatures(context);

    // Generate risk prediction with AI (Sonnet for accuracy)
    const prediction = await this.generatePredictionWithAI(context, features, config);

    // P3-3: Calibrate readmission risk score with population context
    try {
      const calibrationFactors: CalibrationRiskFactor[] = prediction.riskFactors.map(f => ({
        name: f.factor,
        original_weight: f.weight,
        category: f.category,
        data_source: 'readmission-predictor',
        data_freshness: 'current',
      }));

      const calibResult = await ConfidenceCalibrationService.calibrateReadmissionRisk(
        context.patientId,
        context.tenantId,
        prediction.readmissionRisk30Day * 100, // MCP expects 0-100
        prediction.predictionConfidence,
        calibrationFactors
      );

      if (calibResult.success && calibResult.data) {
        prediction.readmissionRisk30Day = calibResult.data.calibrated_score / 100; // Back to 0-1
        prediction.predictionConfidence = calibResult.data.calibrated_confidence;
        await auditLogger.info('READMISSION_RISK_CALIBRATED', {
          patientId: context.patientId.substring(0, 8) + '...',
          direction: calibResult.data.adjustment_direction,
          delta: calibResult.data.score_delta,
        });
      }
    } catch (calibErr: unknown) {
      // Non-blocking: calibration failure doesn't block prediction
      await auditLogger.warn('READMISSION_CALIBRATION_SKIPPED', {
        patientId: context.patientId.substring(0, 8) + '...',
        reason: calibErr instanceof Error ? calibErr.message : String(calibErr),
      });
    }

    // Store prediction in database with comprehensive features
    await this.storePrediction(context, prediction, features);

    // Track prediction for accuracy monitoring
    await this.trackPrediction(context, prediction);

    // Auto-create care plan if high risk and enabled
    if (
      config.readmission_predictor_auto_create_care_plan &&
      prediction.riskCategory in ['high', 'critical']
    ) {
      await this.autoCreateCarePlan(context, prediction);
    }

    // Create care team alert if critical risk
    if (prediction.riskCategory === 'critical') {
      await this.createCriticalRiskAlert(context, prediction);
    }

    return prediction;
  }

  /**
   * Generate prediction using AI (Claude Sonnet for clinical accuracy)
   */
  private async generatePredictionWithAI(
    context: DischargeContext,
    features: ReadmissionRiskFeatures,
    config: TenantConfig
  ): Promise<ReadmissionPrediction> {
    // Build comprehensive prompt with evidence-based features
    const prompt = buildComprehensivePredictionPrompt(context, features);

    // System prompt with comprehensive evidence-based guidelines
    const systemPrompt = READMISSION_SYSTEM_PROMPT;

    try {
      const aiResponse = await this.optimizer.call({
        prompt,
        systemPrompt,
        model: (typeof config.readmission_predictor_model === 'string' && config.readmission_predictor_model)
          ? config.readmission_predictor_model
          : 'claude-sonnet-4-5-20250929',
        complexity: 'complex',
        userId: context.patientId,
        context: {
          dischargeDate: context.dischargeDate,
          dataCompleteness: features.dataCompletenessScore
        }
      });

      // Parse AI response
      const parsed = parseAIPrediction(aiResponse.response);

      // Generate plain-language explanation for patients/families
      const plainLanguageExplanation = PlainLanguageExplainer.generateExplanation(
        parsed.riskCategory,
        parsed.riskFactors,
        parsed.protectiveFactors || [],
        features
      );

      return {
        patientId: context.patientId,
        dischargeDate: context.dischargeDate,
        readmissionRisk30Day: parsed.readmissionRisk30Day,
        readmissionRisk7Day: parsed.readmissionRisk7Day,
        readmissionRisk90Day: parsed.readmissionRisk90Day,
        riskCategory: parsed.riskCategory,
        riskFactors: parsed.riskFactors,
        protectiveFactors: parsed.protectiveFactors || [],
        recommendedInterventions: parsed.recommendedInterventions,
        predictedReadmissionDate: parsed.predictedReadmissionDate,
        predictionConfidence: parsed.predictionConfidence * (features.dataCompletenessScore / 100),
        plainLanguageExplanation,
        dataSourcesAnalyzed: {
          readmissionHistory: features.clinical.priorAdmissions30Day !== undefined,
          sdohIndicators: features.socialDeterminants.livesAlone !== undefined,
          checkinPatterns: features.engagement.checkInCompletionRate30Day !== undefined,
          medicationAdherence: features.medication.activeMedicationCount > 0,
          carePlanAdherence: features.postDischarge.followUpScheduled !== undefined
        },
        aiModel: aiResponse.model,
        aiCost: aiResponse.cost
      };
    } catch (err: unknown) {
      throw new Error(`AI prediction generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * Store prediction in database with comprehensive features
   */
  private async storePrediction(
    context: DischargeContext,
    prediction: ReadmissionPrediction,
    features: ReadmissionRiskFeatures
  ): Promise<void> {
    await supabase
      .from('readmission_risk_predictions')
      .insert({
        tenant_id: context.tenantId,
        patient_id: context.patientId,
        discharge_date: context.dischargeDate,
        discharge_facility: context.dischargeFacility,
        discharge_disposition: context.dischargeDisposition,
        primary_diagnosis_code: context.primaryDiagnosisCode,
        primary_diagnosis_description: context.primaryDiagnosisDescription,
        readmission_risk_30_day: prediction.readmissionRisk30Day,
        readmission_risk_7_day: prediction.readmissionRisk7Day,
        readmission_risk_90_day: prediction.readmissionRisk90Day,
        risk_category: prediction.riskCategory,
        risk_factors: prediction.riskFactors,
        protective_factors: prediction.protectiveFactors,
        recommended_interventions: prediction.recommendedInterventions,
        predicted_readmission_date: prediction.predictedReadmissionDate,
        prediction_confidence: prediction.predictionConfidence,
        data_sources_analyzed: prediction.dataSourcesAnalyzed,
        ai_model_used: prediction.aiModel,
        ai_cost: prediction.aiCost,
        // Store comprehensive features for analysis and reporting
        clinical_features: features.clinical,
        medication_features: features.medication,
        post_discharge_features: features.postDischarge,
        social_determinants_features: features.socialDeterminants,
        functional_status_features: features.functionalStatus,
        engagement_features: features.engagement,
        self_reported_features: features.selfReported,
        data_completeness_score: features.dataCompletenessScore,
        missing_critical_data: features.missingCriticalData
      });
  }

  /**
   * Auto-create care plan for high-risk patients
   */
  private async autoCreateCarePlan(
    context: DischargeContext,
    prediction: ReadmissionPrediction
  ): Promise<void> {
    try {
      // Convert recommended interventions to care plan format
      const goals = [
        {
          goal: 'Prevent 30-day readmission',
          target: 'Zero hospital readmissions',
          timeframe: '30 days',
          current_status: 'in_progress'
        }
      ];

      const interventions = prediction.recommendedInterventions.map(rec => ({
        intervention: rec.intervention,
        frequency: rec.timeframe,
        responsible: rec.responsible,
        priority: rec.priority,
        status: 'pending'
      }));

      const barriers = prediction.riskFactors
        .filter(rf => rf.category === 'social_determinants')
        .map(rf => ({
          barrier: rf.factor,
          solution: `Address via ${rf.category} intervention`,
          priority: 'high',
          status: 'identified'
        }));

      await supabase.from('care_coordination_plans').insert({
        patient_id: context.patientId,
        plan_type: 'readmission_prevention',
        status: 'active',
        priority: prediction.riskCategory === 'critical' ? 'critical' : 'high',
        title: `AI-Generated Readmission Prevention Plan (${prediction.riskCategory} risk)`,
        goals,
        interventions,
        barriers,
        start_date: new Date().toISOString().split('T')[0],
        next_review_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        success_metrics: {
          readmission_avoided: true,
          intervention_adherence: '>90%',
          patient_satisfaction: '>4/5'
        },
        clinical_notes: `Automatically generated based on AI readmission risk prediction. Risk: ${(prediction.readmissionRisk30Day * 100).toFixed(0)}% 30-day readmission probability. Model: ${prediction.aiModel}. Confidence: ${(prediction.predictionConfidence * 100).toFixed(0)}%.`
      });
    } catch {
      // Don't fail prediction if care plan creation fails
    }
  }

  /**
   * Create critical risk alert
   */
  private async createCriticalRiskAlert(
    context: DischargeContext,
    prediction: ReadmissionPrediction
  ): Promise<void> {
    try {
      await supabase.from('care_team_alerts').insert({
        patient_id: context.patientId,
        alert_type: 'readmission_risk_high',
        severity: 'critical',
        priority: 'emergency',
        title: `CRITICAL: High Readmission Risk (${(prediction.readmissionRisk30Day * 100).toFixed(0)}%)`,
        description: `Patient discharged with ${(prediction.readmissionRisk30Day * 100).toFixed(0)}% 30-day readmission risk. Immediate intervention required.`,
        alert_data: {
          discharge_date: context.dischargeDate,
          risk_score: prediction.readmissionRisk30Day,
          risk_category: prediction.riskCategory,
          top_risk_factors: prediction.riskFactors.slice(0, 3),
          urgent_interventions: prediction.recommendedInterventions.filter(i => i.priority in ['high', 'critical'])
        },
        status: 'active'
      });
    } catch {
      // Don't fail prediction if alert creation fails
    }
  }

  /**
   * Get tenant configuration
   */
  private async getTenantConfig(tenantId: string): Promise<TenantConfig> {
    const { data, error } = await supabase
      .rpc('get_ai_skill_config', { p_tenant_id: tenantId });

    if (error) {
      throw new Error(`Failed to get tenant config: ${error.message}`);
    }

    const defaults: TenantConfig = {
      readmission_predictor_enabled: false,
      readmission_predictor_auto_create_care_plan: false,
      readmission_predictor_high_risk_threshold: 0.50,
      readmission_predictor_model: 'claude-sonnet-4-5-20250929'
    };

    if (isTenantConfig(data)) {
      return {
        ...defaults,
        ...data
      };
    }

    return defaults;
  }

  /**
   * Track prediction for accuracy monitoring
   * Records to ai_predictions table for cross-skill analytics
   */
  private async trackPrediction(
    context: DischargeContext,
    prediction: ReadmissionPrediction
  ): Promise<string | null> {
    try {
      const result = await this.accuracyTracker.recordPrediction({
        tenantId: context.tenantId,
        skillName: 'readmission_risk',
        predictionType: 'score',
        predictionValue: {
          readmissionRisk30Day: prediction.readmissionRisk30Day,
          readmissionRisk7Day: prediction.readmissionRisk7Day,
          readmissionRisk90Day: prediction.readmissionRisk90Day,
          riskCategory: prediction.riskCategory,
          topRiskFactors: prediction.riskFactors.slice(0, 3).map(f => f.factor)
        },
        confidence: prediction.predictionConfidence,
        patientId: context.patientId,
        entityType: 'discharge',
        entityId: context.patientId,
        model: prediction.aiModel,
        costUsd: prediction.aiCost
      });

      if (result.success) {
        return result.data ?? null;
      }
      return null;
    } catch {
      // Don't fail the prediction if tracking fails
      return null;
    }
  }

  /**
   * Update prediction with actual outcome (for continuous learning)
   */
  async updateActualOutcome(
    predictionId: string,
    actualReadmission: boolean,
    actualReadmissionDate?: string
  ): Promise<void> {
    DischargeValidator.validateUUID(predictionId, 'predictionId');

    const updates: {
      actual_readmission_occurred: boolean;
      actual_readmission_date?: string;
      actual_readmission_days_post_discharge?: number;
    } = {
      actual_readmission_occurred: actualReadmission
    };

    let daysPostDischarge: number | undefined;

    if (actualReadmission && actualReadmissionDate) {
      updates.actual_readmission_date = actualReadmissionDate;

      // Calculate days post-discharge
      const { data: prediction } = await supabase
        .from('readmission_risk_predictions')
        .select('discharge_date, readmission_risk_30_day, ai_prediction_tracking_id')
        .eq('id', predictionId)
        .single();

      if (prediction) {
        const dischargeDateValue = (prediction as Record<string, unknown>).discharge_date;
        const risk30Value = (prediction as Record<string, unknown>).readmission_risk_30_day;
        const trackingIdValue = (prediction as Record<string, unknown>).ai_prediction_tracking_id;

        if (typeof dischargeDateValue === 'string') {
          daysPostDischarge = Math.floor(
            (new Date(actualReadmissionDate).getTime() - new Date(dischargeDateValue).getTime()) /
            (24 * 60 * 60 * 1000)
          );
          updates.actual_readmission_days_post_discharge = daysPostDischarge;

          // Record outcome for accuracy tracking
          // Prediction is accurate if:
          // - High risk (>0.5) AND patient was readmitted within 30 days
          // - Low risk (<=0.5) AND patient was NOT readmitted within 30 days
          const predictedHighRisk = typeof risk30Value === 'number' ? risk30Value > 0.5 : false;
          const wasReadmittedWithin30Days = actualReadmission && daysPostDischarge <= 30;
          const isAccurate = predictedHighRisk === wasReadmittedWithin30Days;

          if (typeof trackingIdValue === 'string' && trackingIdValue) {
            await this.accuracyTracker.recordOutcome({
              predictionId: trackingIdValue,
              actualOutcome: {
                wasReadmitted: actualReadmission,
                daysToReadmission: daysPostDischarge,
                within30Days: wasReadmittedWithin30Days
              },
              isAccurate,
              outcomeSource: 'system_event',
              notes: actualReadmission
                ? `Readmitted ${daysPostDischarge} days post-discharge`
                : 'No readmission within observation window'
            });
          }
        }
      }
    }

    await supabase
      .from('readmission_risk_predictions')
      .update(updates)
      .eq('id', predictionId);
  }
}

// Export singleton instance
export const readmissionRiskPredictor = new ReadmissionRiskPredictor();
