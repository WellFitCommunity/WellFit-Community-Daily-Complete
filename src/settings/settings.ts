// src/settings/settings.ts
// Central place for environment vars and app constants.

export const WELLFIT_COLORS = Object.freeze({
  blue: '#003865',
  green: '#8cc63f',
  white: '#ffffff',
});

// Safe env reader: prefer Vite-style, guard CRA-style.
const readEnv = (k: string): string | undefined => {
  let v: any;

  // Vite-style (import.meta.env) – try/catch so bundlers that don't support it won't crash
  try {
    // @ts-ignore
    v = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[k]) || undefined;
  } catch { /* ignore */ }

  // CRA-style (process.env) – must guard 'process' or it throws ReferenceError in the browser
  if (!v && typeof process !== 'undefined' && (process as any).env) {
    v = (process as any).env[k];
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

// ---- Supabase (support both SB_* and SUPABASE_* aliases) ----
export const SB_URL: string = firstDefined(
  'REACT_APP_SB_URL',
  'REACT_APP_SUPABASE_URL',
  'REACT_APP_SUPABASE_PROJECT_URL',
  'REACT_APP_SUPA_URL'
);

export const SB_PUBLISHABLE_API_KEY: string = firstDefined(
  'REACT_APP_SB_PUBLISHABLE_API_KEY',
  'REACT_APP_SB_ANON_KEY',
  'REACT_APP_SUPABASE_PUBLISHABLE_API_KEY',
  'REACT_APP_SUPABASE_PUBLIC_ANON_KEY',
  'REACT_APP_SUPABASE_ANON_KEY',
  'REACT_APP_SUPABASE_PUBLIC_KEY'
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

// Gentle dev warnings
if (!SB_URL) console.error('Missing Supabase URL. Set REACT_APP_SB_URL or REACT_APP_SUPABASE_URL.');
if (!SB_PUBLISHABLE_API_KEY) console.error('Missing Supabase anon key. Set REACT_APP_SB_PUBLISHABLE_API_KEY / REACT_APP_SB_ANON_KEY / REACT_APP_SUPABASE_ANON_KEY.');
