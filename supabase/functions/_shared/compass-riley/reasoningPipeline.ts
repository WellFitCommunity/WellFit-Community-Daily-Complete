// Reasoning Pipeline — Compass Riley V2
//
// Single entry point for running the full CoT/ToT reasoning pipeline.
// Chains: resolveMode → evaluateTriggers → applyOverride → evaluateBranches → getExplainText
// Returns ReasoningResult ready for client transmission and audit logging.

import type {
  ReasoningMode,
  TreeSensitivity,
  ConfidenceThresholds,
  ReasoningEncounterInput,
  ReasoningResult,
} from './types.ts';
import { resolveMode } from './modeRouter.ts';
import { resolveSensitivityWithThresholds } from './sensitivityConfig.ts';
import { evaluateTriggers } from './treeTriggerEngine.ts';
import { evaluateBranches } from './branchEvaluator.ts';
import { applyOverride } from './overrideGate.ts';
import { getExplainText } from './minimalExplainLayer.ts';

/**
 * Run the full reasoning pipeline on an encounter state.
 *
 * @param encounterState The current encounter state (structurally compatible with EncounterState)
 * @param tenantSettings The tenant_ai_skill_config.settings JSONB (for tree_sensitivity)
 * @param rawReasoningMode Raw mode string from query param/header (auto/chain/tree/force_chain/force_tree)
 * @returns ReasoningResult with mode used, output zone, triggers, branches, and explanations
 */
export function runReasoningPipeline(
  encounterState: ReasoningEncounterInput,
  tenantSettings: Record<string, unknown> | null | undefined,
  rawReasoningMode?: string | null
): ReasoningResult {
  // 1. Resolve sensitivity and thresholds from tenant config
  const { sensitivity, thresholds } = resolveSensitivityWithThresholds(tenantSettings);

  // 2. Resolve user's requested reasoning mode
  const requestedMode = resolveMode(rawReasoningMode);

  // 3. Evaluate triggers against encounter state
  const triggerResult = evaluateTriggers(encounterState, thresholds);

  // 4. Apply user override (user mode always wins)
  const overrideResult = applyOverride(requestedMode, triggerResult, thresholds);

  // 5. If tree escalation, evaluate branches from diagnoses
  const branchResult = overrideResult.outputZone === 'tree_escalation'
    ? evaluateBranches(encounterState.diagnoses)
    : null;

  // 6. Get one-line explanation text (null if no escalation)
  const explainText = overrideResult.outputZone === 'tree_escalation'
    ? getExplainText(triggerResult.reasonCodes)
    : null;

  return {
    modeUsed: overrideResult.effectiveMode,
    outputZone: overrideResult.outputZone,
    triggerResult,
    branchResult,
    explainText,
    overrideWarning: overrideResult.warning,
    sensitivity,
    thresholds,
  };
}

/**
 * Serialize ReasoningResult for client-side consumption.
 * Strips internal details, keeps what the UI needs.
 */
export function serializeReasoningForClient(result: ReasoningResult): Record<string, unknown> {
  return {
    modeUsed: result.modeUsed,
    outputZone: result.outputZone,
    confidenceScore: result.triggerResult.confidenceScore,
    reasonCodes: result.triggerResult.reasonCodes,
    explainText: result.explainText,
    overrideWarning: result.overrideWarning,
    sensitivity: result.sensitivity,
    branches: result.branchResult
      ? result.branchResult.branches.map(b => ({
          hypothesis: b.hypothesis,
          supporting: b.supporting,
          against: b.against,
          score: b.score.total,
          selected: b.selected,
        }))
      : null,
    convergence: result.branchResult?.convergence
      ? {
          hypothesis: result.branchResult.convergence.hypothesis,
          score: result.branchResult.convergence.score.total,
        }
      : null,
    requiresProviderReview: result.branchResult?.requiresProviderReview ?? false,
  };
}
