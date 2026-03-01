// Reasoning Integration — realtime_medical_transcription
//
// Extracted to keep index.ts under 600 lines.
// Runs the CoT/ToT reasoning pipeline after each analysis cycle
// and sends results to the client via WebSocket.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import type { EncounterState } from '../_shared/encounterStateManager.ts';
import type { AuditLogger } from '../_shared/scribeHelpers.ts';
import type { ReasoningMode, ReasoningResult } from '../_shared/compass-riley/types.ts';
import { runReasoningPipeline, serializeReasoningForClient } from '../_shared/compass-riley/reasoningPipeline.ts';
import { logReasoningAudit } from '../_shared/compass-riley/reasoningAuditLogger.ts';

/**
 * Fetch tenant sensitivity settings for CoT/ToT reasoning thresholds.
 * Returns null on failure (defaults to 'balanced' downstream).
 */
export async function fetchTenantSensitivity(
  admin: SupabaseClient,
  userId: string,
  logger: AuditLogger
): Promise<Record<string, unknown> | null> {
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', userId)
      .single();
    if (profile?.tenant_id) {
      const { data: skillConfig } = await admin
        .from('tenant_ai_skill_config')
        .select('settings')
        .eq('tenant_id', profile.tenant_id)
        .eq('skill_key', 'compass_riley')
        .maybeSingle();
      return (skillConfig?.settings ?? null) as Record<string, unknown> | null;
    }
  } catch (err: unknown) {
    logger.warn('Failed to fetch tenant sensitivity, using balanced default', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

/**
 * Run CoT/ToT reasoning pipeline and send results to client via WebSocket.
 * Non-blocking — errors are logged but don't break the scribe pipeline.
 */
export function runAndSendReasoning(
  state: EncounterState,
  settings: Record<string, unknown> | null,
  mode: ReasoningMode,
  socket: WebSocket,
  userId: string,
  supabaseClient: SupabaseClient,
  logger: AuditLogger,
  safeSend: (ws: WebSocket, payload: unknown) => void
): void {
  try {
    const result = runReasoningPipeline(state, settings, mode);
    safeSend(socket, {
      type: 'reasoning_result',
      reasoning: serializeReasoningForClient(result),
    });

    // Fetch tenant_id for audit (best-effort, non-blocking)
    supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (data?.tenant_id) {
          logReasoningAudit({
            supabaseClient,
            userId,
            tenantId: data.tenant_id,
            encounterContext: `Analysis #${state.analysisCount}, ${state.diagnoses.length} dx`,
            result,
            logger,
          });
        }
      })
      .catch(() => { /* non-critical */ });
  } catch (err: unknown) {
    logger.warn('Reasoning pipeline error (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
      userId,
    });
  }
}
