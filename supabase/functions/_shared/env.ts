// supabase/functions/_shared/env.ts
// Safe env access for Deno Edge Functions (no circular imports).

// Deno runtime interface for type safety
interface DenoRuntime {
  env: {
    get: (name: string) => string | undefined;
  };
}

const envGet = (name: string): string => {
  try {
    // deno on Edge - access Deno global at runtime boundary
    const denoGlobal = (globalThis as unknown as { Deno?: DenoRuntime }).Deno;
    return denoGlobal?.env?.get?.(name) ?? "";
  } catch {
    return "";
  }
};

// ---- Supabase ----
export const SUPABASE_URL: string =
  envGet("SUPABASE_URL") || envGet("SB_URL");

// Service role key - ADMIN access (bypasses RLS)
// Fallback chain: new sb_secret_* format → legacy JWT service role keys
// When Supabase retires legacy keys, new format will be primary
export const SB_SECRET_KEY: string =
  envGet("SB_SECRET_KEY") || envGet("SB_SERVICE_ROLE_KEY") || envGet("SUPABASE_SERVICE_ROLE_KEY");

// Anon key - USER access (respects RLS)
// Fallback chain: JWT anon keys (required for auth) → new sb_publishable_* format
// JWT format is required until Supabase SDK fully supports new publishable keys
export const SB_ANON_KEY: string =
  envGet("SB_ANON_KEY") || envGet("SUPABASE_ANON_KEY") || envGet("SB_PUBLISHABLE_API_KEY");

// Alias for backward compatibility
export const SB_PUBLISHABLE_API_KEY: string = SB_ANON_KEY;

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
