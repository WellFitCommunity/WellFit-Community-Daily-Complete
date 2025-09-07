// supabase/functions/_shared/env.ts
// Safe env access for Deno (and quiet in editors without Deno types).

const envGet = (name: string): string | undefined => {
  try { return (globalThis as any)?.Deno?.env?.get?.(name); } catch { return undefined; }
};

export const SUPABASE_URL =
  envGet('SUPABASE_URL') || envGet('SB_URL') || '';

export const SB_PUBLISHABLE_API_KEY =
  envGet('SB_PUBLISHABLE_API_KEY') || envGet('SUPABASE_ANON_KEY') || '';

export const SB_SECRET_KEY =
  envGet('SB_SECRET_KEY') || envGet('SUPABASE_SERVICE_ROLE_KEY') || '';

/** Server-only captcha secret (we map both names to a single export). */
export const HCAPTCHA_SECRET =
  envGet('SB_HCAPTCHA_SECRET') || envGet('HCAPTCHA_SECRET') || '';

export const ALLOWED_ORIGINS = (envGet('ALLOWED_ORIGINS') || '*')
  .split(',').map(s => s.trim()).filter(Boolean);
