// Override Gate — Compass Riley V2
//
// User mode wins, always. System warns ONCE max.
//
// Behavioral contract:
//   AUTO → system decides output zone from confidence + triggers
//   FORCE_CHAIN → chain always, warn once if system recommends tree
//   FORCE_TREE → tree always (capped), no warning needed (user wants more)

import type {
  ReasoningMode,
  TriggerResult,
  OutputZone,
  ConfidenceThresholds,
} from './types.ts';

export interface OverrideResult {
  /** Final mode to use */
  effectiveMode: ReasoningMode;
  /** Output zone after override applied */
  outputZone: OutputZone;
  /** Warning text if system disagrees with user override (null otherwise) */
  warning: string | null;
}

/**
 * Apply user override to the system's natural recommendation.
 *
 * @param requestedMode User-requested reasoning mode
 * @param triggerResult Result from tree trigger engine
 * @param thresholds Sensitivity-adjusted confidence thresholds
 */
export function applyOverride(
  requestedMode: ReasoningMode,
  triggerResult: TriggerResult,
  thresholds: ConfidenceThresholds
): OverrideResult {
  const naturalZone = determineOutputZone(
    triggerResult.confidenceScore,
    thresholds,
    triggerResult.escalate
  );

  // AUTO — system decides
  if (requestedMode === 'auto') {
    return {
      effectiveMode: 'auto',
      outputZone: naturalZone,
      warning: null,
    };
  }

  // FORCE_CHAIN — user wants linear output
  if (requestedMode === 'force_chain') {
    const warning = naturalZone === 'tree_escalation'
      ? buildOverrideWarning(triggerResult)
      : null;

    return {
      effectiveMode: 'force_chain',
      outputZone: 'chain',
      warning,
    };
  }

  // FORCE_TREE — user wants branching output (no warning needed)
  return {
    effectiveMode: 'force_tree',
    outputZone: 'tree_escalation',
    warning: null,
  };
}

/**
 * Determine the natural output zone from confidence and trigger results.
 *
 * Rules:
 *   - Any trigger fires → tree_escalation
 *   - confidence >= chainThreshold → chain
 *   - confidence >= treeThreshold → chain_caution
 *   - confidence < treeThreshold → tree_escalation
 */
export function determineOutputZone(
  confidenceScore: number,
  thresholds: ConfidenceThresholds,
  triggersEscalated: boolean
): OutputZone {
  if (triggersEscalated) return 'tree_escalation';
  if (confidenceScore >= thresholds.chainThreshold) return 'chain';
  if (confidenceScore >= thresholds.treeThreshold) return 'chain_caution';
  return 'tree_escalation';
}

/**
 * Build a single-line override warning (max ~80 chars).
 * Uses the first trigger description for context.
 */
function buildOverrideWarning(triggerResult: TriggerResult): string {
  if (triggerResult.triggerDescriptions.length > 0) {
    const reason = triggerResult.triggerDescriptions[0];
    const truncated = reason.length > 60
      ? reason.substring(0, 57) + '...'
      : reason;
    return `Note: ${truncated}`;
  }
  return 'Note: system recommends expanded analysis for this case.';
}
