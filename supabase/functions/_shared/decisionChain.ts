/**
 * Decision Chain Logger — Shared Edge Function Helper
 *
 * Fire-and-forget writes to `ai_decision_chain` table.
 * Used by AI edge functions to record causal traceability.
 *
 * Spec: docs/compliance/AI_DECISION_AUDIT_CHAIN.md
 * Tracker: docs/trackers/chatgpt-audit-gaps-tracker.md (S2-3)
 *
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { createAdminClient } from "./supabaseClient.ts";
import { createLogger } from "./auditLogger.ts";

const logger = createLogger("decisionChain");

/** Trigger types */
export type TriggerType =
  | "guardian_alert"
  | "user_request"
  | "scheduled"
  | "ai_initiated"
  | "system_event";

/** Decision categories */
export type DecisionType =
  | "clinical"
  | "operational"
  | "code_repair"
  | "escalation"
  | "documentation"
  | "billing";

/** Outcome status */
export type DecisionOutcome =
  | "success"
  | "failure"
  | "pending_review"
  | "overridden"
  | "expired";

/** Input for recording a decision chain link */
export interface DecisionLinkInput {
  chain_id?: string;
  parent_decision_id?: string;
  tenant_id: string;
  trigger_type: TriggerType;
  trigger_source: string;
  /** Must contain only identifiers (patient_id, encounter_id), never PHI */
  context_snapshot: Record<string, unknown>;
  model_id: string;
  skill_key?: string;
  decision_type: DecisionType;
  decision_summary: string;
  confidence_score?: number;
  authority_tier?: 1 | 2 | 3 | 4;
  action_taken?: string;
  outcome?: DecisionOutcome;
}

/**
 * Record a decision chain link (fire-and-forget).
 *
 * This function never throws. If the write fails, it logs the error
 * and returns null. The calling edge function should not await this
 * if it doesn't need the result.
 *
 * @returns The created row id, or null on failure
 */
export async function recordDecisionLink(
  input: DecisionLinkInput
): Promise<string | null> {
  try {
    const admin = createAdminClient();

    const row: Record<string, unknown> = {
      tenant_id: input.tenant_id,
      trigger_type: input.trigger_type,
      trigger_source: input.trigger_source,
      context_snapshot: input.context_snapshot,
      model_id: input.model_id,
      skill_key: input.skill_key ?? null,
      decision_type: input.decision_type,
      decision_summary: input.decision_summary,
      confidence_score: input.confidence_score ?? null,
      authority_tier: input.authority_tier ?? null,
      action_taken: input.action_taken ?? null,
      outcome: input.outcome ?? "pending_review",
    };

    // If chain_id provided, this is a follow-up link
    if (input.chain_id) {
      row.chain_id = input.chain_id;
    }
    if (input.parent_decision_id) {
      row.parent_decision_id = input.parent_decision_id;
    }

    const { data, error } = await admin
      .from("ai_decision_chain")
      .insert(row)
      .select("id, chain_id")
      .single();

    if (error) {
      logger.error("Decision chain write failed", {
        error: error.message,
        skill_key: input.skill_key,
        trigger_source: input.trigger_source,
      });
      return null;
    }

    return data?.id ?? null;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Decision chain write exception", {
      error: errorMessage,
      skill_key: input.skill_key,
    });
    return null;
  }
}
