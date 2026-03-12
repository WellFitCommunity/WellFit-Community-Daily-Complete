/**
 * AI Decision Chain Types
 *
 * Causal traceability for all AI decisions.
 * Each row is one link in a Trigger→Context→Decision→Action→Outcome→Verification chain.
 *
 * Spec: docs/compliance/AI_DECISION_AUDIT_CHAIN.md
 *
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

/** Trigger types for what initiated the AI decision */
export type TriggerType =
  | 'guardian_alert'
  | 'user_request'
  | 'scheduled'
  | 'ai_initiated'
  | 'system_event';

/** Categories of AI decisions */
export type DecisionType =
  | 'clinical'
  | 'operational'
  | 'code_repair'
  | 'escalation'
  | 'documentation'
  | 'billing';

/** Outcome status of a decision */
export type DecisionOutcome =
  | 'success'
  | 'failure'
  | 'pending_review'
  | 'overridden'
  | 'expired';

/** Authority tiers per AI Repair Authority rules (1=autonomous, 4=forbidden) */
export type AuthorityTier = 1 | 2 | 3 | 4;

/**
 * Database row shape for ai_decision_chain table
 */
export interface AiDecisionChainRow {
  id: string;
  chain_id: string;
  parent_decision_id: string | null;
  tenant_id: string;
  trigger_type: TriggerType;
  trigger_source: string;
  context_snapshot: Record<string, unknown>;
  model_id: string;
  skill_key: string | null;
  decision_type: DecisionType;
  decision_summary: string;
  confidence_score: number | null;
  authority_tier: AuthorityTier | null;
  action_taken: string | null;
  outcome: DecisionOutcome;
  human_override: boolean;
  override_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/**
 * Input for starting a new decision chain
 */
export interface StartChainInput {
  tenant_id: string;
  trigger_type: TriggerType;
  trigger_source: string;
  context_snapshot: Record<string, unknown>;
  model_id: string;
  skill_key?: string;
  decision_type: DecisionType;
  decision_summary: string;
  confidence_score?: number;
  authority_tier?: AuthorityTier;
  action_taken?: string;
  outcome?: DecisionOutcome;
}

/**
 * Input for adding a link to an existing chain
 */
export interface AddLinkInput {
  chain_id: string;
  parent_decision_id: string;
  tenant_id: string;
  trigger_type: TriggerType;
  trigger_source: string;
  context_snapshot: Record<string, unknown>;
  model_id: string;
  skill_key?: string;
  decision_type: DecisionType;
  decision_summary: string;
  confidence_score?: number;
  authority_tier?: AuthorityTier;
  action_taken?: string;
  outcome?: DecisionOutcome;
}

/**
 * Input for recording a human review/override
 */
export interface ReviewDecisionInput {
  decision_id: string;
  reviewed_by: string;
  human_override: boolean;
  override_reason?: string;
  outcome: DecisionOutcome;
}

/**
 * Chain summary for listing/dashboard display
 */
export interface ChainSummary {
  chain_id: string;
  decisions_count: number;
  chain_started: string;
  last_activity: string;
  decision_types: DecisionType[];
  has_pending: boolean;
}
