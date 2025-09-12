// src/settings/settings.ts
// Central place for environment vars and app constants. Works in CRA or Vite builds.

export const WELLFIT_COLORS = Object.freeze({
  blue: '#003865',
  green: '#8cc63f',
  white: '#ffffff',
});

const readEnv = (k: string): string | undefined => {
  let v: any;

  // 1) Vite-style
  try {
    // @ts-ignore
    v =
      (typeof import.meta !== 'undefined' &&
        (import.meta as any).env &&
        (import.meta as any).env[k]) || undefined;
  } catch {
    /* ignore */
  }

  // 2) CRA-style
  if (!v && typeof process !== 'undefined' && (process as any).env) {
    v = (process as any).env[k];
  }

  // 3) Runtime META tag
  if (!v && typeof document !== 'undefined') {
    const meta = document.querySelector(`meta[name="${k}"]`) as HTMLMetaElement | null;
    if (meta?.content) v = meta.content;
  }

  // 4) Optional window.__ENV__ bag
  if (!v && typeof window !== 'undefined' && (window as any).__ENV__?.[k]) {
    v = (window as any).__ENV__?.[k];
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

// ---- Supabase (SB_* primary, SUPABASE_* legacy fallbacks) ----
export const SB_URL: string = firstDefined(
  'REACT_APP_SB_URL',
  'REACT_APP_SUPABASE_URL',
  'REACT_APP_SUPABASE_PROJECT_URL',
  'REACT_APP_SUPA_URL'
);

export const SB_PUBLISHABLE_API_KEY: string = firstDefined(
  'REACT_APP_SB_PUBLISHABLE_API_KEY',
  'REACT_APP_SB_ANON_KEY',
  'REACT_APP_SUPABASE_PUBLISHABLE_KEY',
  'REACT_APP_SUPABASE_PUBLIC_ANON_KEY',
  'REACT_APP_SUPABASE_ANON_KEY',
  'REACT_APP_SUPABASE_PUBLIC_KEY'
);

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
export const IS_PRODUCTION =
  (typeof process !== 'undefined' && (process as any).env?.NODE_ENV === 'production') ||
  // @ts-ignore
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'production');

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

// ---- Aliases so BOTH import styles work (old & new) ----
export const SUPABASE_URL = SB_URL;
export const SUPABASE_PUBLISHABLE_API_KEY = SB_PUBLISHABLE_API_KEY;

// ---- Clear warnings with the exact env names we check ----
const urlCandidates = [
  'REACT_APP_SB_URL',
  'REACT_APP_SUPABASE_URL',
  'REACT_APP_SUPABASE_PROJECT_URL',
  'REACT_APP_SUPA_URL',
];

const keyCandidates = [
  'REACT_APP_SB_PUBLISHABLE_API_KEY',
  'REACT_APP_SB_ANON_KEY',
  'REACT_APP_SUPABASE_PUBLISHABLE_KEY',
  'REACT_APP_SUPABASE_PUBLIC_ANON_KEY',
  'REACT_APP_SUPABASE_ANON_KEY',
  'REACT_APP_SUPABASE_PUBLIC_KEY',
];

if (!SB_URL) console.error('Missing Supabase URL. Set one of:', urlCandidates);
if (!SB_PUBLISHABLE_API_KEY) console.error('Missing Supabase anon/publishable key. Set one of:', keyCandidates);
