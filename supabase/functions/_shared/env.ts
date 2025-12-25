// supabase/functions/_shared/env.ts
// Safe env access for Deno Edge Functions (no circular imports).

const envGet = (name: string): string => {
  try {
    // deno on Edge
    // @ts-ignore
    return (globalThis as any)?.Deno?.env?.get?.(name) ?? "";
  } catch {
    return "";
  }
};

// ---- Supabase ----
// Prefer SB_URL (modern naming) with SUPABASE_URL as fallback
export const SUPABASE_URL: string =
  envGet("SB_URL") || envGet("SUPABASE_URL");

// CRITICAL: SB_SERVICE_ROLE_KEY (legacy JWT format) must be preferred for RLS bypass
// The sb_secret_* format does NOT work with Supabase JS client for RLS bypass
export const SB_SECRET_KEY: string =
  envGet("SB_SERVICE_ROLE_KEY") || envGet("SB_SECRET_KEY");

// For auth operations, prefer SB_ANON_KEY (legacy JWT format) which works with Supabase auth
// The sb_publishable_* format is not yet fully supported for auth
export const SB_PUBLISHABLE_API_KEY: string =
  envGet("SB_ANON_KEY") || envGet("SB_PUBLISHABLE_API_KEY");

// ---- hCaptcha ----
export const HCAPTCHA_SECRET: string =
  envGet("HCAPTCHA_SECRET") || envGet("HCAPTCHA_SECRET_KEY") || envGet("SB_HCAPTCHA_SECRET");

// ---- CORS allowlist ----
// Comma-separated, no spaces in the env value
const toList = (v: string) =>
  (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// Single canonical export (this is the one CORS will import)
const ALLOWED_ORIGINS_STR: string = envGet("ALLOWED_ORIGINS");
export const ALLOWED_ORIGINS: string[] = toList(ALLOWED_ORIGINS_STR);

// Back-compat aliases (optional; do NOT import these in cors.ts)
export const SB_URL = SUPABASE_URL;
