/**
 * AI Decision Chain Service
 *
 * Provides causal traceability for all AI decisions. Each chain links
 * Trigger→Context→Decision→Action→Outcome→Verification.
 *
 * Spec: docs/compliance/AI_DECISION_AUDIT_CHAIN.md
 * Tracker: docs/trackers/chatgpt-audit-gaps-tracker.md (S2-2)
 *
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import type {
  AiDecisionChainRow,
  StartChainInput,
  AddLinkInput,
  ReviewDecisionInput,
} from '../types/aiDecisionChain';

const TABLE = 'ai_decision_chain';

/**
 * Start a new decision chain (first link).
 * Returns the created row including the auto-generated chain_id.
 */
async function startChain(
  input: StartChainInput
): Promise<ServiceResult<AiDecisionChainRow>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
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
        outcome: input.outcome ?? 'pending_review',
      })
      .select()
      .single();

    if (error) {
      await auditLogger.error('AI_DECISION_CHAIN_START_FAILED', error.message, {
        trigger_type: input.trigger_type,
        skill_key: input.skill_key,
      });
      return failure('DATABASE_ERROR', error.message, error);
    }

    await auditLogger.info('AI_DECISION_CHAIN_STARTED', {
      chain_id: data.chain_id,
      decision_id: data.id,
      decision_type: input.decision_type,
      skill_key: input.skill_key,
    });

    return success(data as AiDecisionChainRow);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AI_DECISION_CHAIN_START_FAILED', error, {
      trigger_type: input.trigger_type,
    });
    return failure('OPERATION_FAILED', 'Failed to start decision chain', err);
  }
}

/**
 * Add a link to an existing chain.
 * The parent_decision_id connects this link to the previous decision.
 */
async function addLink(
  input: AddLinkInput
): Promise<ServiceResult<AiDecisionChainRow>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        chain_id: input.chain_id,
        parent_decision_id: input.parent_decision_id,
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
        outcome: input.outcome ?? 'pending_review',
      })
      .select()
      .single();

    if (error) {
      await auditLogger.error('AI_DECISION_CHAIN_LINK_FAILED', error.message, {
        chain_id: input.chain_id,
        parent_decision_id: input.parent_decision_id,
      });
      return failure('DATABASE_ERROR', error.message, error);
    }

    await auditLogger.info('AI_DECISION_CHAIN_LINK_ADDED', {
      chain_id: input.chain_id,
      decision_id: data.id,
      parent_decision_id: input.parent_decision_id,
      decision_type: input.decision_type,
    });

    return success(data as AiDecisionChainRow);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AI_DECISION_CHAIN_LINK_FAILED', error, {
      chain_id: input.chain_id,
    });
    return failure('OPERATION_FAILED', 'Failed to add chain link', err);
  }
}

/**
 * Get all links in a chain, ordered by creation time.
 */
async function getChain(
  chainId: string
): Promise<ServiceResult<AiDecisionChainRow[]>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, chain_id, parent_decision_id, tenant_id, trigger_type, trigger_source, context_snapshot, model_id, skill_key, decision_type, decision_summary, confidence_score, authority_tier, action_taken, outcome, human_override, override_reason, reviewed_by, reviewed_at, created_at')
      .eq('chain_id', chainId)
      .order('created_at', { ascending: true });

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success((data ?? []) as AiDecisionChainRow[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AI_DECISION_CHAIN_FETCH_FAILED', error, {
      chain_id: chainId,
    });
    return failure('OPERATION_FAILED', 'Failed to fetch decision chain', err);
  }
}

/**
 * Get all chains that include a specific patient (via context_snapshot.patient_id).
 * Returns chain summaries for listing.
 */
async function getChainsByPatient(
  patientId: string,
  limit = 50
): Promise<ServiceResult<AiDecisionChainRow[]>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, chain_id, parent_decision_id, tenant_id, trigger_type, trigger_source, context_snapshot, model_id, skill_key, decision_type, decision_summary, confidence_score, authority_tier, action_taken, outcome, human_override, override_reason, reviewed_by, reviewed_at, created_at')
      .contains('context_snapshot', { patient_id: patientId })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success((data ?? []) as AiDecisionChainRow[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AI_DECISION_CHAIN_PATIENT_FETCH_FAILED', error, {
      patient_id: patientId,
    });
    return failure('OPERATION_FAILED', 'Failed to fetch patient decision chains', err);
  }
}

/**
 * Record a human review or override on a decision.
 */
async function reviewDecision(
  input: ReviewDecisionInput
): Promise<ServiceResult<AiDecisionChainRow>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        reviewed_by: input.reviewed_by,
        reviewed_at: new Date().toISOString(),
        human_override: input.human_override,
        override_reason: input.override_reason ?? null,
        outcome: input.outcome,
      })
      .eq('id', input.decision_id)
      .select()
      .single();

    if (error) {
      await auditLogger.error('AI_DECISION_REVIEW_FAILED', error.message, {
        decision_id: input.decision_id,
      });
      return failure('DATABASE_ERROR', error.message, error);
    }

    await auditLogger.info('AI_DECISION_REVIEWED', {
      decision_id: input.decision_id,
      human_override: input.human_override,
      outcome: input.outcome,
      reviewed_by: input.reviewed_by,
    });

    return success(data as AiDecisionChainRow);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AI_DECISION_REVIEW_FAILED', error, {
      decision_id: input.decision_id,
    });
    return failure('OPERATION_FAILED', 'Failed to review decision', err);
  }
}

/**
 * Get open chains (those with pending_review outcomes) for the current tenant.
 */
async function getOpenChains(
  limit = 50
): Promise<ServiceResult<AiDecisionChainRow[]>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, chain_id, parent_decision_id, tenant_id, trigger_type, trigger_source, context_snapshot, model_id, skill_key, decision_type, decision_summary, confidence_score, authority_tier, action_taken, outcome, human_override, override_reason, reviewed_by, reviewed_at, created_at')
      .eq('outcome', 'pending_review')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success((data ?? []) as AiDecisionChainRow[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AI_DECISION_OPEN_CHAINS_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to fetch open chains', err);
  }
}

export const aiDecisionChainService = {
  startChain,
  addLink,
  getChain,
  getChainsByPatient,
  reviewDecision,
  getOpenChains,
};

export default aiDecisionChainService;
