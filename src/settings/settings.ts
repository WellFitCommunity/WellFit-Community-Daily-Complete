// src/settings/settings.ts
// Central place for environment vars and app constants.
// CRA (React) requires all client-exposed vars to start with REACT_APP_.

export const WELLFIT_COLORS = {
  blue: '#003865',
  green: '#8cc63f',
  white: '#ffffff',
};

// Supabase
export const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL || '';
export const SUPABASE_PUBLISHABLE_API_KEY =
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_API_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY || ''; // fallback
export const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY || ''; // server-only (do not expose in client)

// Firebase
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

// hCaptcha
export const HCAPTCHA_SITE_KEY =
  process.env.REACT_APP_HCAPTCHA_SITE_KEY || '';

  export const REQUIRE_LOGIN_CAPTCHA =
  (process.env.REACT_APP_REQUIRE_LOGIN_CAPTCHA ?? 'false').toLowerCase() === 'true';

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (!SUPABASE_URL) {
  // Fail fast with clear messaging at runtime in dev
  // In production, this will surface as build-time misconfig if missing.
  // eslint-disable-next-line no-console
  console.error('Missing SUPABASE_URL (REACT_APP_SB_URL).');
}

if (!SUPABASE_PUBLISHABLE_API_KEY) {
  // eslint-disable-next-line no-console
  console.error('Missing SUPABASE_PUBLISHABLE_API_KEY (REACT_APP_SB_PUBLISHABLE_API_KEY).');
} 

// API endpoints
export const API_ENDPOINT =
  process.env.REACT_APP_API_ENDPOINT ??
  'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/register';

// App info
export const APP_INFO = {
  name: 'WellFit Community',
  supportEmail: 'info@thewellfitcommunity.org',
  supportPhone: '(832) 315-5110',
};
