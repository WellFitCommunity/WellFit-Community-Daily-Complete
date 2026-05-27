// src/components/admin/ApiKeyManager/sortUtils.ts
//
// Module-level helpers for sorting, formatting, and presenting API key rows.
// These must remain OUTSIDE the component tree so React's exhaustive-deps
// rule does not require them as dependencies of memoized callbacks.

/**
 * Strict ISO 8601 — prevents `Date.parse("2024 Healthcare Inc.")` from
 * sorting as a timestamp. Only treats values that LOOK like timestamps
 * (date or datetime, with or without timezone) as comparable dates.
 */
export const ISO_8601 = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Coerce an unknown value into a comparable primitive for table sorting.
 *
 * Strings that match ISO 8601 are parsed as timestamps (numeric ms).
 * Other strings are lowercased. Numbers pass through. null/undefined/other
 * types collapse to null so the caller can place them consistently.
 */
export const toComparable = (v: unknown): string | number | null => {
  if (v == null) return null;
  if (typeof v === 'string' && ISO_8601.test(v)) {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (typeof v === 'string') return v.toLowerCase();
  if (typeof v === 'number') return v;
  return null;
};

/**
 * Render an API key's "key identifier" cell. Uses a hash prefix (not the
 * org name) to avoid information leakage and to make the masked
 * representation deterministic across renders.
 */
export const displayableApiKeyRepresentation = (
  hash: string | undefined,
  _orgName: string,
): string => {
  if (!hash) return 'N/A (No Hash)';
  const hashPrefix = hash.slice(0, 8);
  return `ak_${hashPrefix}_••••••••`;
};

/**
 * Format an ISO timestamp string as a human-readable date+time.
 * Returns 'Never' for null/empty and 'Invalid Date' on parse failure.
 */
export const formatDate = (str: string | null): string => {
  if (!str) return 'Never';
  try {
    return new Date(str).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid Date';
  }
};

/**
 * Render a relative-time string like "3 days ago" / "Today" / "Yesterday".
 */
export const getRelativeTime = (str: string | null): string => {
  if (!str) return 'Never';
  try {
    const date = new Date(str);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return 'Unknown';
  }
};
