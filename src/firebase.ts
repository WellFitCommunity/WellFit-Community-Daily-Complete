// src/firebase.ts
import { getApps, getApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, isSupported, type Messaging, getToken } from 'firebase/messaging';

type Maybe<T> = T | null;

const cfg = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID, // optional
};

// Only try to init if we actually have config
const hasConfig =
  !!cfg.apiKey && !!cfg.authDomain && !!cfg.projectId &&
  !!cfg.storageBucket && !!cfg.messagingSenderId && !!cfg.appId;

let app: Maybe<FirebaseApp> = null;

/** Safe singleton Firebase app (no crash if config is missing) */
export function getFirebaseApp(): Maybe<FirebaseApp> {
  if (!hasConfig) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[firebase] Missing config envs; skipping Firebase init.');
    }
    return null;
  }
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp(cfg as any);
  return app;
}

/**
 * Get Messaging instance if supported and configured.
 * - Registers the SW only in production and only if it exists.
 * - Returns null instead of throwing when unsupported.
 */
export async function getFirebaseMessaging(): Promise<Maybe<Messaging>> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;

  const app = getFirebaseApp();
  if (!app) return null;

  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  // Only register SW in prod, and only if the file exists
  if (process.env.NODE_ENV === 'production') {
    try {
      const head = await fetch('/firebase-messaging-sw.js', { method: 'HEAD' });
      if (head.ok) await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    } catch {
      // ignore SW errors in dev/prod; messaging will still be null without SW
    }
  }

  try {
    return getMessaging(app);
  } catch {
    return null;
  }
}

/** Convenience: request a token (returns null if unsupported/denied) */
export async function getFcmToken(): Promise<string | null> {
  const msg = await getFirebaseMessaging();
  if (!msg) return null;
  try {
    const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY; // set if you use web push
    const token = await getToken(msg, vapidKey ? { vapidKey } : undefined);
    return token ?? null;
  } catch {
    return null;
  }
}

