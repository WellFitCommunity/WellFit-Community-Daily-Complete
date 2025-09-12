// src/settings/settings.ts
// CRA only exposes envs that START with REACT_APP_
// We support Maria's new names + legacy fallbacks.

const truthy = (v?: string | null) => !!v && v.trim().length > 0;
const pick = (...c: Array<string | undefined>) => c.find(truthy)?.trim() ?? "";

// ---- Supabase (client) values ----
export const SB_URL = pick(
  process.env.REACT_APP_SB_URL,
  process.env.REACT_APP_SUPABASE_URL
);

export const SB_PUBLISHABLE_API_KEY = pick(
  process.env.REACT_APP_SB_PUBLISHABLE_API_KEY,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Aliases for backward compatibility
export const SUPABASE_URL = SB_URL;
export const SUPABASE_PUBLISHABLE_API_KEY = SB_PUBLISHABLE_API_KEY;

// Fail fast if Supabase is missing
export function assertClientSupabaseEnv() {
  const hasUrl = truthy(SB_URL);
  const hasKey = truthy(SB_PUBLISHABLE_API_KEY);
  if (!hasUrl || !hasKey) {
    throw new Error(
      [
        "[SB CONFIG] Missing required env(s) for CRA runtime:",
        !hasUrl ? " - REACT_APP_SB_URL (or REACT_APP_SUPABASE_URL)" : "",
        !hasKey
          ? " - REACT_APP_SB_PUBLISHABLE_API_KEY (or REACT_APP_SUPABASE_ANON_KEY)"
          : "",
        "Remember: CRA requires REACT_APP_* and a dev-server restart after changes.",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
}

// ---- Branding constants (now includes blue/green aliases) ----
export const WELLFIT_COLORS = {
  primary: "#003865",   // WellFit Blue
  secondary: "#8cc63f", // WellFit Green
  white: "#ffffff",
  // aliases used in older components:
  blue: "#003865",      // alias of primary
  green: "#8cc63f",     // alias of secondary
};

export const APP_INFO = {
  name: "WellFit Community Daily",
  tagline: "Revolutionizing aging WELL!",
};

// ---- Firebase re-export (keeps old imports working) ----
export { firebaseWebConfig as FIREBASE } from "./firebase";
