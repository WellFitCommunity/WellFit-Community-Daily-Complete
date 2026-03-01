// Compass Riley V2 — Chain of Thought / Tree of Thought Reasoning Types
//
// All interfaces consumed by the reasoning engine modules:
// modeRouter, treeTriggerEngine, branchEvaluator, minimalExplainLayer,
// overrideGate, sensitivityConfig.

/**
 * Reasoning mode — how the system processes clinical data.
 * - auto: Chain output + silent Tree monitor (default)
 * - force_chain: Never branch, still allowed to warn once
 * - force_tree: Always branch (capped at 2-4), then converge
 */
export type ReasoningMode = 'auto' | 'force_chain' | 'force_tree';

/**
 * Tenant-level tree sensitivity — controls how eagerly Tree engages.
 * Stored in tenant_ai_skill_config.settings.tree_sensitivity.
 */
export type TreeSensitivity = 'conservative' | 'balanced' | 'aggressive';

/**
 * Reason codes for Tree escalation — logged to ai_transparency_log.
 */
export type ReasonCode =
  | 'CONFLICTING_SIGNALS'
  | 'HIGH_BLAST_RADIUS'
  | 'AMBIGUOUS_REQUIREMENTS'
  | 'VERIFICATION_FAILED'
  | 'LOW_CONFIDENCE';

/**
 * Confidence thresholds per sensitivity level (0-100 scale).
 * Caution band is implicitly between treeThreshold and chainThreshold.
 */
export interface ConfidenceThresholds {
  /** At or above: pure Chain of Thought (concise, linear) */
  chainThreshold: number;
  /** Below chainThreshold but at or above: Chain + Caution (hedge/gap flag) */
  /** Below this: Tree of Thought escalation (branching differential) */
  treeThreshold: number;
}

/**
 * Result of the Tree Trigger Engine evaluation.
 */
export interface TriggerResult {
  /** Whether to escalate to Tree of Thought */
  escalate: boolean;
  /** Reason codes for why escalation was triggered */
  reasonCodes: ReasonCode[];
  /** Aggregate confidence score (0-100) from encounter diagnoses */
  confidenceScore: number;
  /** Human-readable descriptions of each trigger that fired */
  triggerDescriptions: string[];
}

/**
 * Fixed scoring rubric for a single branch.
 * All scores are 0-100.
 */
export interface BranchScore {
  /** Patient safety impact (higher = safer) */
  safety: number;
  /** Clinical evidence strength (higher = more evidence) */
  evidence: number;
  /** Consequence severity if wrong (higher = more dangerous) */
  blastRadius: number;
  /** Ability to course-correct (higher = more reversible) */
  reversibility: number;
  /** Weighted composite (higher = better branch) */
  total: number;
}

/**
 * A single branch in the Tree of Thought evaluation.
 */
export interface Branch {
  /** Branch identifier (e.g., "branch-1") */
  id: string;
  /** The diagnosis or clinical path being evaluated */
  hypothesis: string;
  /** Supporting evidence for this branch */
  supporting: string[];
  /** Evidence against this branch */
  against: string[];
  /** Fixed rubric score */
  score: BranchScore;
  /** Whether this branch was selected as the convergence winner */
  selected: boolean;
}

/**
 * Result of branch evaluation — 2-4 branches scored and converged.
 */
export interface BranchResult {
  /** Branches evaluated (2-4) */
  branches: Branch[];
  /** The winning branch after convergence (null if can't converge) */
  convergence: Branch | null;
  /** If true, no clear winner — flag for provider review */
  requiresProviderReview: boolean;
  /** Depth of analysis (1-2 max) */
  depth: number;
}

/**
 * Output zone determines the response format.
 * - chain: concise linear assessment
 * - chain_caution: linear with hedge/gap flags
 * - tree_escalation: branching differential with explain line
 */
export type OutputZone = 'chain' | 'chain_caution' | 'tree_escalation';

// ─── Input Interfaces ─────────────────────────────────────────────
// Self-contained subset of EncounterState fields consumed by the
// reasoning engine. Structurally compatible with the full EncounterState
// from encounterStateManager.ts — callers pass the full state, TypeScript
// structural typing handles the rest.

/**
 * Diagnosis or differential with evidence and confidence.
 * Mirrors DiagnosisEntry from encounterStateManager.
 */
export interface DiagnosisInput {
  condition: string;
  icd10?: string;
  confidence: number;
  supportingEvidence: string[];
  refutingEvidence: string[];
  status: 'active' | 'ruled_out' | 'working';
}

/**
 * Medication discussed during the encounter.
 * Mirrors MedicationEntry from encounterStateManager.
 */
export interface MedicationInput {
  name: string;
  action: 'new' | 'adjusted' | 'continued' | 'discontinued' | 'reviewed';
  details?: string;
}

/**
 * Subset of EncounterState consumed by the reasoning engine.
 * The trigger engine and branch evaluator only need these fields.
 */
export interface ReasoningEncounterInput {
  chiefComplaint: string | null;
  diagnoses: DiagnosisInput[];
  medications: MedicationInput[];
  mdmComplexity: { riskLevel: string };
  completeness: { overallPercent: number; expectedButMissing: string[] };
  driftState: { driftDetected: boolean; driftDescription?: string };
  patientSafety: { emergencyDetected: boolean; emergencyReason?: string };
  analysisCount: number;
  transcriptWordCount: number;
}

/**
 * Complete reasoning result — the final output of the reasoning engine.
 */
export interface ReasoningResult {
  /** Which mode was actually used */
  modeUsed: ReasoningMode;
  /** Output zone (determines response format) */
  outputZone: OutputZone;
  /** Trigger evaluation results */
  triggerResult: TriggerResult;
  /** Branch evaluation (null if chain mode, populated if tree) */
  branchResult: BranchResult | null;
  /** One-line escalation explanation (null if not escalated) */
  explainText: string | null;
  /** Override warning if user forced mode against recommendation (null otherwise) */
  overrideWarning: string | null;
  /** Sensitivity level used for this evaluation */
  sensitivity: TreeSensitivity;
  /** Confidence thresholds used */
  thresholds: ConfidenceThresholds;
}
