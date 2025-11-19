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
       

      return;
    }
    throw new Error(msg);
  }

  // One-time helpful log in dev so you know which envs were picked.
  if (!IS_PROD) {
    // Supabase configuration loaded for development
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

// ---- Firebase Configuration (for push notifications only) ----
// Direct environment variable mapping - no broken require() needed
export const FIREBASE = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || '',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || '',
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || '',
  vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY || '',
};
