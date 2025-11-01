// src/lib/env.ts (CRA-safe; no Vite syntax)
const truthy = (v?: string | null) => !!v && v.trim().length > 0;

const pick = (...candidates: Array<string | undefined>) =>
  candidates.find(truthy)?.trim() ?? "";

/**
 * We support Maria's naming policy (new) + legacy fallbacks.
 * Only REACT_APP_* are visible in CRA runtime; others will be empty in browser.
 */
export const SB_URL = pick(
  process.env.REACT_APP_SB_URL,
  process.env.REACT_APP_SUPABASE_URL,           // legacy alias
  process.env.REACT_APP_SUPABASE_URL_PUBLIC     // occasional alias seen in some repos
);

export const SB_PUBLISHABLE_KEY = pick(
  process.env.REACT_APP_SB_PUBLISHABLE_API_KEY, // preferred (new)
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY,
  process.env.REACT_APP_SUPABASE_ANON_KEY       // legacy
);

// Minimal, sanitized runtime diag (no secrets printed)
export function assertSupabaseEnv(): void {
  const hasUrl = truthy(SB_URL);
  const hasKey = truthy(SB_PUBLISHABLE_KEY);

  if (!hasUrl || !hasKey) {
    // One clear, actionable error. This is the one you saw thrown by the SDK.
    throw new Error(
      [
        "[SB CONFIG] Missing required env:",
        !hasUrl ? "- REACT_APP_SB_URL (or REACT_APP_SUPABASE_URL)" : "",
        !hasKey ? "- REACT_APP_SB_PUBLISHABLE_API_KEY (or REACT_APP_SUPABASE_ANON_KEY)" : "",
        "CRA rule: envs must start with REACT_APP_ and exist before the dev server/build starts.",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  // Config validated successfully
}