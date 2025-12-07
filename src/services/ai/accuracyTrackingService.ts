/**
 * AI Accuracy Tracking Service
 *
 * Purpose: Track AI prediction accuracy to enable evidence-based prompt optimization
 *
 * Key Features:
 * - Records every AI prediction with context
 * - Tracks outcomes when available (provider review, system events)
 * - Calculates accuracy metrics by skill, prompt version, and time period
 * - Supports A/B testing of prompt variations
 * - Provides dashboard data for monitoring
 *
 * This is the foundation for systematic prompt improvement without the
 * complexity and risks of test-time scaling approaches.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ServiceResult, success, failure } from '../_base';

// ============================================================================
// TYPES
// ============================================================================

export interface PredictionRecord {
  tenantId: string;
  skillName: string;
  predictionType: 'classification' | 'score' | 'code' | 'text' | 'structured';
  predictionValue: Record<string, unknown>;
  confidence?: number;
  patientId?: string;
  entityType?: string;
  entityId?: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  latencyMs?: number;
}

export interface PredictionOutcome {
  predictionId: string;
  actualOutcome: Record<string, unknown>;
  isAccurate: boolean;
  outcomeSource: 'provider_review' | 'system_event' | 'manual_audit' | 'automated';
  notes?: string;
}

export interface AccuracyMetrics {
  skillName: string;
  totalPredictions: number;
  predictionsWithOutcome: number;
  accurateCount: number;
  inaccurateCount: number;
  accuracyRate: number | null;
  avgConfidence: number | null;
  totalCostUsd: number;
  avgLatencyMs: number | null;
}

export interface PromptVersion {
  id: string;
  skillName: string;
  promptType: 'system' | 'user' | 'template';
  versionNumber: number;
  promptContent: string;
  description?: string;
  isActive: boolean;
  totalUses: number;
  accuracyRate: number | null;
}

export interface ExperimentConfig {
  experimentName: string;
  skillName: string;
  hypothesis: string;
  controlPromptId: string;
  treatmentPromptId: string;
  trafficSplit: number;  // 0.0 to 1.0
  minSampleSize: number;
}

export interface ExperimentResults {
  experimentName: string;
  controlPredictions: number;
  controlAccurate: number;
  treatmentPredictions: number;
  treatmentAccurate: number;
  pValue: number | null;
  isSignificant: boolean;
  winner: 'control' | 'treatment' | 'no_difference' | null;
}

// ============================================================================
// ACCURACY TRACKING SERVICE
// ============================================================================

export class AccuracyTrackingService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // --------------------------------------------------------------------------
  // PREDICTION RECORDING
  // --------------------------------------------------------------------------

  /**
   * Record an AI prediction for accuracy tracking
   * Call this immediately after making any AI prediction
   */
  async recordPrediction(record: PredictionRecord): Promise<ServiceResult<string>> {
    try {
      const { data, error } = await this.supabase.rpc('record_ai_prediction', {
        p_tenant_id: record.tenantId,
        p_skill_name: record.skillName,
        p_prediction_type: record.predictionType,
        p_prediction_value: record.predictionValue,
        p_confidence: record.confidence ?? null,
        p_patient_id: record.patientId ?? null,
        p_entity_type: record.entityType ?? null,
        p_entity_id: record.entityId ?? null,
        p_model: record.model,
        p_input_tokens: record.inputTokens ?? null,
        p_output_tokens: record.outputTokens ?? null,
        p_cost: record.costUsd ?? null,
        p_latency_ms: record.latencyMs ?? null
      });

      if (error) {
        return failure('DATABASE_ERROR', `Failed to record prediction: ${error.message}`, error);
      }

      return success(data as string);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to record prediction', err);
    }
  }

  /**
   * Record the outcome of a prediction (for accuracy calculation)
   * Call this when you learn the actual result
   */
  async recordOutcome(outcome: PredictionOutcome): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await this.supabase.rpc('record_prediction_outcome', {
        p_prediction_id: outcome.predictionId,
        p_actual_outcome: outcome.actualOutcome,
        p_is_accurate: outcome.isAccurate,
        p_outcome_source: outcome.outcomeSource,
        p_notes: outcome.notes ?? null
      });

      if (error) {
        return failure('DATABASE_ERROR', `Failed to record outcome: ${error.message}`, error);
      }

      return success(true);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to record outcome', err);
    }
  }

  // --------------------------------------------------------------------------
  // ACCURACY METRICS
  // --------------------------------------------------------------------------

  /**
   * Get accuracy metrics for all skills
   */
  async getAccuracyDashboard(
    tenantId?: string,
    days: number = 30
  ): Promise<ServiceResult<AccuracyMetrics[]>> {
    try {
      const { data, error } = await this.supabase.rpc('get_accuracy_dashboard', {
        p_tenant_id: tenantId ?? null,
        p_days: days
      });

      if (error) {
        return failure('DATABASE_ERROR', `Failed to get dashboard: ${error.message}`, error);
      }

      const metrics: AccuracyMetrics[] = (data || []).map((row: Record<string, unknown>) => ({
        skillName: row.skill_name as string,
        totalPredictions: row.total_predictions as number,
        predictionsWithOutcome: 0,  // Calculated separately
        accurateCount: 0,
        inaccurateCount: 0,
        accuracyRate: row.accuracy_rate as number | null,
        avgConfidence: row.avg_confidence as number | null,
        totalCostUsd: row.total_cost as number,
        avgLatencyMs: null
      }));

      return success(metrics);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get accuracy dashboard', err);
    }
  }

  /**
   * Get detailed accuracy metrics for a specific skill
   */
  async getSkillAccuracy(
    skillName: string,
    days: number = 30,
    tenantId?: string
  ): Promise<ServiceResult<AccuracyMetrics>> {
    try {
      let query = this.supabase
        .from('ai_predictions')
        .select('*')
        .eq('skill_name', skillName)
        .gte('predicted_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) {
        return failure('DATABASE_ERROR', `Failed to get skill accuracy: ${error.message}`, error);
      }

      const predictions = data || [];
      const withOutcome = predictions.filter(p => p.is_accurate !== null);
      const accurate = withOutcome.filter(p => p.is_accurate === true);

      const metrics: AccuracyMetrics = {
        skillName,
        totalPredictions: predictions.length,
        predictionsWithOutcome: withOutcome.length,
        accurateCount: accurate.length,
        inaccurateCount: withOutcome.length - accurate.length,
        accuracyRate: withOutcome.length > 0
          ? accurate.length / withOutcome.length
          : null,
        avgConfidence: predictions.length > 0
          ? predictions.reduce((sum, p) => sum + (p.confidence_score || 0), 0) / predictions.length
          : null,
        totalCostUsd: predictions.reduce((sum, p) => sum + (p.cost_usd || 0), 0),
        avgLatencyMs: predictions.length > 0
          ? Math.round(predictions.reduce((sum, p) => sum + (p.latency_ms || 0), 0) / predictions.length)
          : null
      };

      return success(metrics);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get skill accuracy', err);
    }
  }

  // --------------------------------------------------------------------------
  // PROMPT VERSION MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Get the active prompt for a skill
   */
  async getActivePrompt(
    skillName: string,
    promptType: 'system' | 'user' | 'template' = 'system'
  ): Promise<ServiceResult<PromptVersion | null>> {
    try {
      const { data, error } = await this.supabase
        .from('ai_prompt_versions')
        .select('*')
        .eq('skill_name', skillName)
        .eq('prompt_type', promptType)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        return failure('DATABASE_ERROR', `Failed to get prompt: ${error.message}`, error);
      }

      if (!data) {
        return success(null);
      }

      const version: PromptVersion = {
        id: data.id,
        skillName: data.skill_name,
        promptType: data.prompt_type,
        versionNumber: data.version_number,
        promptContent: data.prompt_content,
        description: data.description,
        isActive: data.is_active,
        totalUses: data.total_uses,
        accuracyRate: data.accuracy_rate
      };

      return success(version);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get active prompt', err);
    }
  }

  /**
   * Create a new prompt version
   */
  async createPromptVersion(
    skillName: string,
    promptType: 'system' | 'user' | 'template',
    promptContent: string,
    description?: string,
    changeNotes?: string
  ): Promise<ServiceResult<PromptVersion>> {
    try {
      // Get next version number
      const { data: existing } = await this.supabase
        .from('ai_prompt_versions')
        .select('version_number')
        .eq('skill_name', skillName)
        .eq('prompt_type', promptType)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = existing && existing.length > 0
        ? existing[0].version_number + 1
        : 1;

      // Insert new version
      const { data, error } = await this.supabase
        .from('ai_prompt_versions')
        .insert({
          skill_name: skillName,
          prompt_type: promptType,
          version_number: nextVersion,
          prompt_content: promptContent,
          description,
          change_notes: changeNotes,
          is_active: false,
          is_default: false
        })
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', `Failed to create prompt: ${error.message}`, error);
      }

      const version: PromptVersion = {
        id: data.id,
        skillName: data.skill_name,
        promptType: data.prompt_type,
        versionNumber: data.version_number,
        promptContent: data.prompt_content,
        description: data.description,
        isActive: data.is_active,
        totalUses: data.total_uses,
        accuracyRate: data.accuracy_rate
      };

      return success(version);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to create prompt version', err);
    }
  }

  /**
   * Activate a prompt version (deactivates others)
   */
  async activatePromptVersion(promptId: string): Promise<ServiceResult<boolean>> {
    try {
      // Get prompt info
      const { data: prompt } = await this.supabase
        .from('ai_prompt_versions')
        .select('skill_name, prompt_type')
        .eq('id', promptId)
        .single();

      if (!prompt) {
        return failure('NOT_FOUND', 'Prompt version not found');
      }

      // Deactivate other versions
      await this.supabase
        .from('ai_prompt_versions')
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .eq('skill_name', prompt.skill_name)
        .eq('prompt_type', prompt.prompt_type)
        .eq('is_active', true);

      // Activate this version
      const { error } = await this.supabase
        .from('ai_prompt_versions')
        .update({ is_active: true, activated_at: new Date().toISOString() })
        .eq('id', promptId);

      if (error) {
        return failure('DATABASE_ERROR', `Failed to activate prompt: ${error.message}`, error);
      }

      return success(true);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to activate prompt', err);
    }
  }

  /**
   * Get all prompt versions for a skill
   */
  async getPromptHistory(
    skillName: string,
    promptType: 'system' | 'user' | 'template' = 'system'
  ): Promise<ServiceResult<PromptVersion[]>> {
    try {
      const { data, error } = await this.supabase
        .from('ai_prompt_versions')
        .select('*')
        .eq('skill_name', skillName)
        .eq('prompt_type', promptType)
        .order('version_number', { ascending: false });

      if (error) {
        return failure('DATABASE_ERROR', `Failed to get history: ${error.message}`, error);
      }

      const versions: PromptVersion[] = (data || []).map(row => ({
        id: row.id,
        skillName: row.skill_name,
        promptType: row.prompt_type,
        versionNumber: row.version_number,
        promptContent: row.prompt_content,
        description: row.description,
        isActive: row.is_active,
        totalUses: row.total_uses,
        accuracyRate: row.accuracy_rate
      }));

      return success(versions);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get prompt history', err);
    }
  }

  // --------------------------------------------------------------------------
  // A/B TESTING (EXPERIMENTS)
  // --------------------------------------------------------------------------

  /**
   * Create a new prompt experiment
   */
  async createExperiment(config: ExperimentConfig): Promise<ServiceResult<string>> {
    try {
      const { data, error } = await this.supabase
        .from('ai_prompt_experiments')
        .insert({
          experiment_name: config.experimentName,
          skill_name: config.skillName,
          hypothesis: config.hypothesis,
          control_prompt_id: config.controlPromptId,
          treatment_prompt_id: config.treatmentPromptId,
          traffic_split: config.trafficSplit,
          min_sample_size: config.minSampleSize,
          status: 'draft'
        })
        .select('id')
        .single();

      if (error) {
        return failure('DATABASE_ERROR', `Failed to create experiment: ${error.message}`, error);
      }

      return success(data.id);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to create experiment', err);
    }
  }

  /**
   * Start an experiment
   */
  async startExperiment(experimentId: string): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await this.supabase
        .from('ai_prompt_experiments')
        .update({
          status: 'running',
          start_at: new Date().toISOString()
        })
        .eq('id', experimentId)
        .eq('status', 'draft');

      if (error) {
        return failure('DATABASE_ERROR', `Failed to start experiment: ${error.message}`, error);
      }

      return success(true);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to start experiment', err);
    }
  }

  /**
   * Get which prompt variant to use for an experiment
   * Returns the prompt ID to use based on traffic split
   */
  async getExperimentVariant(
    experimentName: string
  ): Promise<ServiceResult<{ promptId: string; variant: 'control' | 'treatment' } | null>> {
    try {
      const { data, error } = await this.supabase
        .from('ai_prompt_experiments')
        .select('*')
        .eq('experiment_name', experimentName)
        .eq('status', 'running')
        .single();

      if (error || !data) {
        return success(null);  // No active experiment
      }

      // Simple random assignment based on traffic split
      const usesTreatment = Math.random() < data.traffic_split;

      return success({
        promptId: usesTreatment ? data.treatment_prompt_id : data.control_prompt_id,
        variant: usesTreatment ? 'treatment' : 'control'
      });
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get experiment variant', err);
    }
  }

  /**
   * Get experiment results
   */
  async getExperimentResults(experimentId: string): Promise<ServiceResult<ExperimentResults>> {
    try {
      const { data, error } = await this.supabase
        .from('ai_prompt_experiments')
        .select('*')
        .eq('id', experimentId)
        .single();

      if (error || !data) {
        return failure('NOT_FOUND', 'Experiment not found');
      }

      // Calculate p-value using two-proportion z-test
      const controlN = data.control_predictions;
      const controlP = controlN > 0 ? data.control_accurate / controlN : 0;
      const treatmentN = data.treatment_predictions;
      const treatmentP = treatmentN > 0 ? data.treatment_accurate / treatmentN : 0;

      let pValue: number | null = null;
      let isSignificant = false;

      if (controlN > 0 && treatmentN > 0) {
        // Pooled proportion
        const pooled = (data.control_accurate + data.treatment_accurate) / (controlN + treatmentN);

        // Standard error
        const se = Math.sqrt(pooled * (1 - pooled) * (1 / controlN + 1 / treatmentN));

        // Z-score
        const z = se > 0 ? (treatmentP - controlP) / se : 0;

        // Two-tailed p-value (approximation)
        pValue = 2 * (1 - this.normalCDF(Math.abs(z)));
        isSignificant = pValue < 0.05;
      }

      const results: ExperimentResults = {
        experimentName: data.experiment_name,
        controlPredictions: data.control_predictions,
        controlAccurate: data.control_accurate,
        treatmentPredictions: data.treatment_predictions,
        treatmentAccurate: data.treatment_accurate,
        pValue,
        isSignificant,
        winner: !isSignificant ? 'no_difference'
          : treatmentP > controlP ? 'treatment'
          : 'control'
      };

      return success(results);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get experiment results', err);
    }
  }

  // Standard normal CDF approximation
  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  // --------------------------------------------------------------------------
  // BILLING CODE SPECIFIC TRACKING
  // --------------------------------------------------------------------------

  /**
   * Record billing code accuracy when provider finalizes codes
   */
  async recordBillingCodeAccuracy(
    predictionId: string,
    encounterId: string,
    suggestedCodes: Array<{ code: string; type: string }>,
    finalCodes: Array<{ code: string; type: string }>,
    reviewedBy: string,
    suggestedRevenue?: number,
    actualRevenue?: number
  ): Promise<ServiceResult<boolean>> {
    try {
      const suggestedSet = new Set(suggestedCodes.map(c => c.code));
      const finalSet = new Set(finalCodes.map(c => c.code));

      const accepted = finalCodes.filter(c => suggestedSet.has(c.code)).length;
      const rejected = suggestedCodes.filter(c => !finalSet.has(c.code)).length;
      const addedByProvider = finalCodes.filter(c => !suggestedSet.has(c.code)).length;

      const { error } = await this.supabase
        .from('billing_code_accuracy')
        .insert({
          prediction_id: predictionId,
          encounter_id: encounterId,
          suggested_codes: suggestedCodes,
          final_codes_used: finalCodes,
          codes_accepted: accepted,
          codes_rejected: rejected,
          codes_added_by_provider: addedByProvider,
          suggested_revenue: suggestedRevenue,
          actual_revenue: actualRevenue,
          revenue_delta: actualRevenue && suggestedRevenue
            ? actualRevenue - suggestedRevenue
            : null,
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString()
        });

      if (error) {
        return failure('DATABASE_ERROR', `Failed to record billing accuracy: ${error.message}`, error);
      }

      // Also update the main prediction record
      const totalSuggested = suggestedCodes.length;
      const isAccurate = totalSuggested > 0 && (accepted / totalSuggested) >= 0.7;

      await this.recordOutcome({
        predictionId,
        actualOutcome: { finalCodes, accepted, rejected, addedByProvider },
        isAccurate,
        outcomeSource: 'provider_review'
      });

      return success(true);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to record billing code accuracy', err);
    }
  }

  // --------------------------------------------------------------------------
  // SDOH DETECTION SPECIFIC TRACKING
  // --------------------------------------------------------------------------

  /**
   * Record SDOH detection accuracy when provider reviews
   */
  async recordSDOHDetectionAccuracy(
    detectionId: string,
    predictionId: string,
    wasConfirmed: boolean,
    wasFalsePositive: boolean,
    reviewedBy: string
  ): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await this.supabase
        .from('sdoh_detection_accuracy')
        .insert({
          detection_id: detectionId,
          prediction_id: predictionId,
          was_confirmed: wasConfirmed,
          was_dismissed: !wasConfirmed,
          was_false_positive: wasFalsePositive,
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString()
        });

      if (error) {
        return failure('DATABASE_ERROR', `Failed to record SDOH accuracy: ${error.message}`, error);
      }

      // Update main prediction
      await this.recordOutcome({
        predictionId,
        actualOutcome: { wasConfirmed, wasFalsePositive },
        isAccurate: wasConfirmed && !wasFalsePositive,
        outcomeSource: 'provider_review'
      });

      return success(true);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to record SDOH accuracy', err);
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createAccuracyTrackingService(supabase: SupabaseClient): AccuracyTrackingService {
  return new AccuracyTrackingService(supabase);
}
