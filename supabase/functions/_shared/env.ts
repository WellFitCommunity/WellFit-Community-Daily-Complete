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
export const SUPABASE_URL: string =
  envGet("SUPABASE_URL") || envGet("SB_URL");

export const SB_SECRET_KEY: string =
  envGet("SB_SECRET_KEY") || envGet("SUPABASE_SERVICE_ROLE_KEY");

export const SB_PUBLISHABLE_API_KEY: string =
  envGet("SB_PUBLISHABLE_API_KEY") || envGet("SUPABASE_ANON_KEY");

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
