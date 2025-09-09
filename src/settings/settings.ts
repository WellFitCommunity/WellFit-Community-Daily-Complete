// src/settings/settings.ts
// Central place for environment vars and app constants.
// CRA requires all client-exposed vars to start with REACT_APP_*.

export const WELLFIT_COLORS = Object.freeze({
  blue: '#003865',
  green: '#8cc63f',
  white: '#ffffff',
});

// Helper to read env from CRA (process.env) and also handle Vite fallback (import.meta.env)
const readEnv = (k: string): string | undefined => {
  // @ts-ignore - import.meta.env not in CRA, harmless at runtime
  const vite = typeof import.meta !== 'undefined' ? (import.meta as any).env?.[k] : undefined;
  // CRA
  const cra = (process as any)?.env?.[k];
  return (cra ?? vite) || undefined;
};

const firstDefined = (...keys: string[]): string => {
  for (const k of keys) {
    const v = readEnv(k);
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
};

const parseBool = (v: string | undefined, def = false) => {
  if (v == null) return def;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
};

// ---- Supabase (accept multiple aliases so you never get blocked) ----
export const SUPABASE_URL: string = firstDefined(
  'REACT_APP_SB_URL',
  'REACT_APP_SUPABASE_URL',
  'REACT_APP_SUPA_URL',
  'REACT_APP_SUPABASE_PROJECT_URL'
);

export const SUPABASE_PUBLISHABLE_API_KEY: string = firstDefined(
  'REACT_APP_SB_PUBLISHABLE_API_KEY',
  'REACT_APP_SB_ANON_KEY',
  'REACT_APP_SUPABASE_PUBLISHABLE_API_KEY',
  'REACT_APP_SUPABASE_PUBLIC_ANON_KEY',
  'REACT_APP_SUPABASE_ANON_KEY',
  'REACT_APP_SUPABASE_PUBLIC_KEY'
);

// ⚠️ Do NOT export service-role/secret keys from the client.
// Keep them ONLY in Supabase Edge Function env.
// (If you previously imported SUPABASE_SECRET_KEY anywhere in client code, remove it.)

// ---- Firebase (unchanged) ----
export const FIREBASE = {
  apiKey: firstDefined('REACT_APP_FIREBASE_API_KEY'),
  authDomain: firstDefined('REACT_APP_FIREBASE_AUTH_DOMAIN'),
  projectId: firstDefined('REACT_APP_FIREBASE_PROJECT_ID'),
  storageBucket: firstDefined('REACT_APP_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: firstDefined('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
  appId: firstDefined('REACT_APP_FIREBASE_APP_ID'),
  measurementId: firstDefined('REACT_APP_FIREBASE_MEASUREMENT_ID'),
  vapidKey: firstDefined('REACT_APP_FIREBASE_VAPID_KEY'),
};

// ---- hCaptcha ----
export const HCAPTCHA_SITE_KEY = firstDefined(
  'REACT_APP_HCAPTCHA_SITE_KEY',
  'REACT_APP_SB_HCAPTCHA_SITEKEY'
);

export const REQUIRE_LOGIN_CAPTCHA = parseBool(
  readEnv('REACT_APP_REQUIRE_LOGIN_CAPTCHA'),
  false
);

// ---- App / Build info ----
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ---- API endpoints ----
export const API_ENDPOINT =
  readEnv('REACT_APP_API_ENDPOINT') ??
  'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/register';

// ---- App info ----
export const APP_INFO = {
  name: 'WellFit Community',
  supportEmail: 'info@thewellfitcommunity.org',
  supportPhone: '(832) 315-5110',
};

// Helpful dev warnings (don’t throw in settings; supabaseClient will hard-fail instead)
if (!SUPABASE_URL) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase URL. Set one of: REACT_APP_SB_URL or REACT_APP_SUPABASE_URL.'
  );
}
if (!SUPABASE_PUBLISHABLE_API_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase anon key. Set one of: REACT_APP_SB_PUBLISHABLE_API_KEY, REACT_APP_SB_ANON_KEY, or REACT_APP_SUPABASE_ANON_KEY.'
  );
}
