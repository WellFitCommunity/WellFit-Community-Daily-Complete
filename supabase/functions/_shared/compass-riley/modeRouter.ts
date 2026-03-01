// Mode Router — Compass Riley V2
//
// Resolves ReasoningMode from request metadata (URL query param, header, etc.).
// Validates input, defaults to AUTO. Pure function — no side effects.

import type { ReasoningMode } from './types.ts';

const VALID_MODES: readonly string[] = ['auto', 'force_chain', 'force_tree'];

/**
 * Resolve the reasoning mode from a raw string input.
 * Returns 'auto' for null, undefined, empty, or invalid values.
 *
 * Accepted formats: 'auto', 'force_chain', 'force_tree'
 * Also accepts: 'chain' -> 'force_chain', 'tree' -> 'force_tree'
 */
export function resolveMode(rawMode?: string | null): ReasoningMode {
  if (!rawMode) return 'auto';

  const normalized = rawMode.toLowerCase().trim();

  if (VALID_MODES.includes(normalized)) {
    return normalized as ReasoningMode;
  }

  // Shorthand aliases
  if (normalized === 'chain') return 'force_chain';
  if (normalized === 'tree') return 'force_tree';

  return 'auto';
}

/**
 * Check if a mode is a user override (not auto).
 */
export function isUserOverride(mode: ReasoningMode): boolean {
  return mode !== 'auto';
}
