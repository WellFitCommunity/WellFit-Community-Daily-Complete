/**
 * Shared helpers for the hospital workforce service modules.
 *
 * Extracted from hospitalWorkforceService.ts (CLAUDE.md Commandment #12).
 */

// Helper to get error message safely
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
