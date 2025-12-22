// src/settings/settings.ts
// Vite only exposes envs that START with VITE_
// We support Maria's new names + legacy fallbacks.

const truthy = (v?: string | null) => !!v && v.trim().length > 0;
const pick = (...c: Array<string | undefined>) => c.find(truthy)?.trim() ?? "";

export const IS_PROD = import.meta.env.MODE === "production";

// ---- Supabase (client) values ----
export const SB_URL = pick(
  import.meta.env.VITE_SB_URL,
  import.meta.env.VITE_SUPABASE_URL
);

// Supabase JS client requires JWT anon key for auth - sb_publishable_* format not yet supported
export const SB_PUBLISHABLE_API_KEY = pick(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  import.meta.env.VITE_SB_ANON_KEY,
  import.meta.env.VITE_SB_PUBLISHABLE_API_KEY
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
      "[SB CONFIG] Missing required env(s) for Vite runtime:",
      !hasUrl ? " - VITE_SB_URL (or VITE_SUPABASE_URL)" : "",
      !hasKey
        ? " - VITE_SB_PUBLISHABLE_API_KEY (or VITE_SUPABASE_ANON_KEY)"
        : "",
      "Remember: Vite requires VITE_* prefix and a dev-server restart after changes.",
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
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
  vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || '',
};
