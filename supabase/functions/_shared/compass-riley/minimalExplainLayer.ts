// Minimal Explain Layer — Compass Riley V2
//
// Maps ReasonCode to one short sentence (max ~12 words).
// Priority-ordered: the most critical reason code wins.
// The system "reasons broadly but speaks narrowly."

import type { ReasonCode } from './types.ts';

/** Priority-ordered map: highest priority first */
const EXPLAIN_MAP: Record<ReasonCode, string> = {
  HIGH_BLAST_RADIUS:      'High-stakes case — verifying before proceeding.',
  CONFLICTING_SIGNALS:    'Signals conflict — ruling out alternatives before committing.',
  VERIFICATION_FAILED:    'Prior assessment didn\'t hold — re-evaluating.',
  AMBIGUOUS_REQUIREMENTS: 'Multiple plausible paths — evaluating differentials.',
  LOW_CONFIDENCE:         'Insufficient confidence — broadening the differential.',
};

/** Priority order for reason codes (most critical first) */
const PRIORITY_ORDER: readonly ReasonCode[] = [
  'HIGH_BLAST_RADIUS',
  'CONFLICTING_SIGNALS',
  'VERIFICATION_FAILED',
  'AMBIGUOUS_REQUIREMENTS',
  'LOW_CONFIDENCE',
] as const;

/**
 * Get a single short explanation for the highest-priority reason code.
 * Returns null if no reason codes are provided.
 *
 * @param reasonCodes Array of reason codes from the trigger engine
 */
export function getExplainText(reasonCodes: ReasonCode[]): string | null {
  if (reasonCodes.length === 0) return null;

  for (const code of PRIORITY_ORDER) {
    if (reasonCodes.includes(code)) {
      return EXPLAIN_MAP[code];
    }
  }

  // Fallback — all codes are in PRIORITY_ORDER so this shouldn't fire
  return EXPLAIN_MAP[reasonCodes[0]];
}

/**
 * Get the explain text for a single reason code.
 */
export function getExplainForCode(code: ReasonCode): string {
  return EXPLAIN_MAP[code];
}
