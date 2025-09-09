// src/settings/settings.ts
// Central place for environment vars and app constants.

export const WELLFIT_COLORS = Object.freeze({
  blue: '#003865',
  green: '#8cc63f',
  white: '#ffffff',
});

// Safe env reader: prefer Vite-style, guard CRA-style, add safe runtime fallbacks.
const readEnv = (k: string): string | undefined => {
  let v: any;

  // Vite-style (import.meta.env)
  try {
    // @ts-ignore
    v = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[k]) || undefined;
  } catch { /* ignore */ }

  // CRA-style (process.env) – guard 'process'
  if (!v && typeof process !== 'undefined' && (process as any).env) {
    v = (process as any).env[k];
  }

  // OPTIONAL: runtime global injection (if you ever attach window.__ENV or window.__SB__)
  if (!v && typeof globalThis !== 'undefined') {
    // @ts-ignore
    v = (globalThis as any).__ENV?.[k] ?? (globalThis as any).__SB?.[k];
  }

  // OPTIONAL: meta tag fallback <meta name="REACT_APP_SB_URL" content="...">
  if (!v && typeof document !== 'undefined') {
    const el = document.querySelector(`meta[name="${k}"]`) as HTMLMetaElement | null;
    if (el?.content) v = el.content;
  }

  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
};

const firstDefined = (...keys: string[]) => {
  for (const k of keys) {
    const v = readEnv(k);
    if (v) return v;
  }
  return '';
};

const parseBool = (v?: string, def = false) => {
  if (v == null) return def;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
};

// ---- SB (supports both SB_* and legacy aliases) ----
export const SB_URL: string = firstDefined(
  'REACT_APP_SB_URL',
  'REACT_APP_SUPABASE_URL',               // legacy alias
  'REACT_APP_SUPABASE_PROJECT_URL',       // legacy alias
  'REACT_APP_SUPA_URL'                    // legacy alias
);

export const SB_PUBLISHABLE_API_KEY: string = firstDefined(
  'REACT_APP_SB_PUBLISHABLE_API_KEY',
  'REACT_APP_SB_ANON_KEY',
  'REACT_APP_SUPABASE_PUBLISHABLE_API_KEY', // legacy alias
  'REACT_APP_SUPABASE_PUBLIC_ANON_KEY',     // legacy alias
  'REACT_APP_SUPABASE_ANON_KEY',            // legacy alias
  'REACT_APP_SUPABASE_PUBLIC_KEY'           // legacy alias
);

// Do NOT export any service-role/secret key in client code.

// ---- Firebase ----
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

export const REQUIRE_LOGIN_CAPTCHA = parseBool(readEnv('REACT_APP_REQUIRE_LOGIN_CAPTCHA'), false);

// ---- App / Build info ----
export const IS_PRODUCTION = typeof process !== 'undefined'
  ? process.env?.NODE_ENV === 'production'
  // fallback for Vite
  // @ts-ignore
  : (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'production');

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

// Gentle dev warnings (worded with SB to avoid the vendor name)
if (!SB_URL) console.error('Missing SB URL. Set REACT_APP_SB_URL (or legacy alias).');
if (!SB_PUBLISHABLE_API_KEY) console.error('Missing SB anon key. Set REACT_APP_SB_PUBLISHABLE_API_KEY (or legacy alias).');
if (HCAPTCHA_SITE_KEY && !FIREBASE.apiKey) console.error('Missing Firebase API key. Set REACT_APP_FIREBASE_API_KEY when using hCaptcha.');