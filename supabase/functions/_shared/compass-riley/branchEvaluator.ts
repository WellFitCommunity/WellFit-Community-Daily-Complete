// Branch Evaluator — Compass Riley V2
//
// Generates 2-4 branches from DiagnosisInput array, scores each with
// a fixed rubric (safety, evidence, blast radius, reversibility),
// and converges to a winner or flags for provider review.
//
// Constraints:
//   Branches: 2-4 max
//   Depth: 2 max
//   Convergence: mandatory — pick ONE or flag for review

import type { Branch, BranchResult, BranchScore, DiagnosisInput } from './types.ts';

const MAX_BRANCHES = 4;
const MIN_BRANCHES = 2;
const MAX_DEPTH = 2;

/**
 * Convergence margin — the minimum score gap between #1 and #2
 * for convergence to be declared without provider review.
 */
const CONVERGENCE_MARGIN = 5;

/** Scoring weights (must sum to 1.0) */
const WEIGHTS = {
  safety: 0.40,
  evidence: 0.30,
  blastRadius: 0.20,
  reversibility: 0.10,
} as const;

/**
 * Evaluate branches from active diagnoses, score, and converge.
 *
 * @param diagnoses Active DiagnosisInput array from EncounterState
 * @param depth Analysis depth (1-2, clamped to MAX_DEPTH)
 */
export function evaluateBranches(
  diagnoses: DiagnosisInput[],
  depth: number = 1
): BranchResult {
  const effectiveDepth = Math.min(Math.max(1, depth), MAX_DEPTH);

  // Filter to non-ruled-out candidates
  const candidates = diagnoses.filter(d => d.status !== 'ruled_out');

  if (candidates.length === 0) {
    return {
      branches: [],
      convergence: null,
      requiresProviderReview: true,
      depth: effectiveDepth,
    };
  }

  // Sort by confidence descending, take top MAX_BRANCHES
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const selected = sorted.slice(0, MAX_BRANCHES);

  // Build branches
  const branches: Branch[] = selected.map((dx, idx) => ({
    id: `branch-${idx + 1}`,
    hypothesis: dx.condition,
    supporting: [...dx.supportingEvidence],
    against: [...dx.refutingEvidence],
    score: scoreBranch(dx),
    selected: false,
  }));

  // Not enough branches is OK — we work with what we have
  // (MIN_BRANCHES is aspirational, not enforced when data is limited)

  return convergeBranches(branches, effectiveDepth);
}

/**
 * Score a single branch using the fixed rubric.
 * All scores are 0-100.
 */
export function scoreBranch(dx: DiagnosisInput): BranchScore {
  // Safety: confidence scaled by absence of refuting evidence
  const refutingPenalty = dx.refutingEvidence.length > 0 ? 0.7 : 1.0;
  const safety = Math.round(dx.confidence * 100 * refutingPenalty);

  // Evidence: supporting evidence count, capped at 100
  const evidence = Math.min(100, dx.supportingEvidence.length * 25);

  // Blast radius: inverse confidence (low confidence = high blast radius)
  const blastRadius = Math.round((1 - dx.confidence) * 100);

  // Reversibility: higher confidence = more reversible
  const reversibility = Math.round(dx.confidence * 80 + 20);

  // Weighted total — blast radius is inverted (lower is better)
  const total = Math.round(
    safety * WEIGHTS.safety +
    evidence * WEIGHTS.evidence +
    (100 - blastRadius) * WEIGHTS.blastRadius +
    reversibility * WEIGHTS.reversibility
  );

  return { safety, evidence, blastRadius, reversibility, total };
}

/**
 * Converge branches: pick the highest-scoring winner.
 * If the gap between #1 and #2 is below CONVERGENCE_MARGIN,
 * flag for provider review (ambiguous case).
 */
function convergeBranches(branches: Branch[], depth: number): BranchResult {
  if (branches.length === 0) {
    return {
      branches,
      convergence: null,
      requiresProviderReview: true,
      depth,
    };
  }

  const ranked = [...branches].sort((a, b) => b.score.total - a.score.total);
  const winner = ranked[0];
  const runnerUp = ranked.length > 1 ? ranked[1] : null;

  const canConverge =
    winner.score.total > 0 &&
    (!runnerUp || winner.score.total - runnerUp.score.total >= CONVERGENCE_MARGIN);

  if (canConverge) {
    // Mark winner in the original branches array
    const winnerInOriginal = branches.find(b => b.id === winner.id);
    if (winnerInOriginal) {
      winnerInOriginal.selected = true;
    }

    return {
      branches,
      convergence: { ...winner, selected: true },
      requiresProviderReview: false,
      depth,
    };
  }

  // Can't converge — flag for provider review
  return {
    branches,
    convergence: null,
    requiresProviderReview: true,
    depth,
  };
}
