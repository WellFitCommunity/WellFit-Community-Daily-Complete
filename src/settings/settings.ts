// src/settings/settings.ts
// CRA only exposes envs that START with REACT_APP_
// We support Maria's new names + legacy fallbacks.

const truthy = (v?: string | null) => !!v && v.trim().length > 0;
const pick = (...c: Array<string | undefined>) => c.find(truthy)?.trim() ?? "";

export const IS_PROD = process.env.NODE_ENV === "production";

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

// Small invariant helper you can reuse elsewhere
export function invariant(cond: any, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// Fail fast if Supabase is missing
export function assertClientSupabaseEnv() {
  const hasUrl = truthy(SB_URL);
  const hasKey = truthy(SB_PUBLISHABLE_API_KEY);

  if (!hasUrl || !hasKey) {
    const msg = [
      "[SB CONFIG] Missing required env(s) for CRA runtime:",
      !hasUrl ? " - REACT_APP_SB_URL (or REACT_APP_SUPABASE_URL)" : "",
      !hasKey
        ? " - REACT_APP_SB_PUBLISHABLE_API_KEY (or REACT_APP_SUPABASE_ANON_KEY)"
        : "",
      "Remember: CRA requires REACT_APP_* and a dev-server restart after changes.",
    ]
      .filter(Boolean)
      .join("\n");

    if (IS_PROD) {
      // In production, log instead of throwing to avoid a blank screen.
      // eslint-disable-next-line no-console

      return;
    }
    throw new Error(msg);
  }

  // One-time helpful log in dev so you know which envs were picked.
  if (!IS_PROD) {
    // eslint-disable-next-line no-console
    console.log(
      "[SB CONFIG] Using:",
      `URL=${SB_URL}`,
      `KEY=${SB_PUBLISHABLE_API_KEY.slice(0, 6)}…`
    );
  }
}

// ---- Branding constants (now includes blue/green aliases) ----
export const WELLFIT_COLORS = {
  primary: "#003865",   // WellFit Blue
  secondary: "#8cc63f", // WellFit Green
  white: "#ffffff",
  // aliases used in older components:
  blue: "#003865",
  green: "#8cc63f",
};

export const APP_INFO = {
  name: "WellFit Community Daily",
  tagline: "Revolutionizing aging WELL!",
};

// ---- Firebase re-export (keeps old imports working) ----
// If you sometimes build without Firebase, this avoids a hard crash.
let FIREBASE_SAFE: any = undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  FIREBASE_SAFE = require("./firebase").firebaseWebConfig;
} catch {
  if (!IS_PROD) {
    // eslint-disable-next-line no-console

  }
}
export const FIREBASE = FIREBASE_SAFE;
