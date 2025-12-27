/**
 * Safe error message extraction utility
 *
 * Handles TypeScript's strict `unknown` typing for catch blocks
 * in Vite + React 19 environment.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}
