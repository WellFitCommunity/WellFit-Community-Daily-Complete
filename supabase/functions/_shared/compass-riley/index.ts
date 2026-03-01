// Compass Riley V2 — Chain of Thought / Tree of Thought Reasoning Engine
//
// Barrel re-export for all reasoning engine modules.
// Session 1: Core engine (types, config, router, triggers, branches, explain, override)

// Types
export type {
  ReasoningMode,
  TreeSensitivity,
  ReasonCode,
  ConfidenceThresholds,
  TriggerResult,
  BranchScore,
  Branch,
  BranchResult,
  OutputZone,
  ReasoningResult,
  DiagnosisInput,
  MedicationInput,
  ReasoningEncounterInput,
} from './types.ts';

// Sensitivity Config
export {
  getThresholds,
  resolveSensitivity,
  resolveSensitivityWithThresholds,
} from './sensitivityConfig.ts';

// Mode Router
export { resolveMode, isUserOverride } from './modeRouter.ts';

// Tree Trigger Engine
export {
  evaluateTriggers,
  computeAggregateConfidence,
} from './treeTriggerEngine.ts';

// Branch Evaluator
export { evaluateBranches, scoreBranch } from './branchEvaluator.ts';

// Minimal Explain Layer
export { getExplainText, getExplainForCode } from './minimalExplainLayer.ts';

// Override Gate
export { applyOverride, determineOutputZone } from './overrideGate.ts';
export type { OverrideResult } from './overrideGate.ts';

// Session 2: Reasoning Pipeline (orchestrator)
export { runReasoningPipeline, serializeReasoningForClient } from './reasoningPipeline.ts';

// Session 2: Reasoning Audit Logger
export { logReasoningAudit } from './reasoningAuditLogger.ts';
