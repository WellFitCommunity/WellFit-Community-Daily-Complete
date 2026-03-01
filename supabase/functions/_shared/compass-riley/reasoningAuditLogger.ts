// Reasoning Audit Logger — Compass Riley V2
//
// Logs reasoning results to ai_transparency_log for HTI-2 compliance.
// Fire-and-forget — errors are logged but don't break the pipeline.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import type { ReasoningResult } from './types.ts';

interface ReasoningAuditParams {
  supabaseClient: SupabaseClient;
  userId: string;
  tenantId: string;
  encounterContext: string;
  result: ReasoningResult;
  logger: { error: (msg: string, meta: Record<string, unknown>) => void };
}

/**
 * Log a reasoning evaluation to ai_transparency_log.
 * Non-blocking — returns immediately, logs async.
 */
export function logReasoningAudit(params: ReasoningAuditParams): void {
  const { supabaseClient, userId, tenantId, encounterContext, result, logger } = params;

  supabaseClient
    .from('ai_transparency_log')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      skill_key: 'compass_riley_reasoning',
      action_type: 'reasoning_evaluation',
      input_summary: encounterContext,
      output_summary: JSON.stringify({
        modeUsed: result.modeUsed,
        outputZone: result.outputZone,
        confidenceScore: result.triggerResult.confidenceScore,
        reasonCodes: result.triggerResult.reasonCodes,
        triggerCount: result.triggerResult.triggerDescriptions.length,
        branchCount: result.branchResult?.branches.length ?? 0,
        converged: result.branchResult?.convergence !== null,
        requiresProviderReview: result.branchResult?.requiresProviderReview ?? false,
        sensitivity: result.sensitivity,
      }),
      confidence_score: result.triggerResult.confidenceScore / 100,
      model_version: 'compass-riley-v2-reasoning',
      metadata: {
        reasonCodes: result.triggerResult.reasonCodes,
        triggerDescriptions: result.triggerResult.triggerDescriptions,
        overrideWarning: result.overrideWarning,
        chainThreshold: result.thresholds.chainThreshold,
        treeThreshold: result.thresholds.treeThreshold,
      },
    })
    .then(({ error }) => {
      if (error) {
        logger.error('Failed to log reasoning audit', {
          error: error.message,
          userId,
          outputZone: result.outputZone,
        });
      }
    })
    .catch((err: unknown) => {
      logger.error('Reasoning audit insert exception', {
        error: err instanceof Error ? err.message : String(err),
        userId,
      });
    });
}
