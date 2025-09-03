// src/firebase.ts
import { getApps, getApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, isSupported, type Messaging, getToken } from 'firebase/messaging';
import { FIREBASE } from './settings/settings';

type Maybe<T> = T | null;

let app: Maybe<FirebaseApp> = null;

/** Safe singleton Firebase app (no crash if config is missing) */
export function getFirebaseApp(): Maybe<FirebaseApp> {
  if (!FIREBASE.apiKey || !FIREBASE.projectId || !FIREBASE.appId) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[firebase] Missing config envs; skipping Firebase init.');
    }
    return null;
  }
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp(FIREBASE as any);
  return app;
}

/** Get Messaging if supported; registers SW in production if present */
export async function getFirebaseMessaging(): Promise<Maybe<Messaging>> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;

  const app = getFirebaseApp();
  if (!app) return null;

  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  if (process.env.NODE_ENV === 'production') {
    try {
      const head = await fetch('/firebase-messaging-sw.js', { method: 'HEAD' });
      if (head.ok) await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    } catch {
      /* ignore */
    }
  }

  try {
    return getMessaging(app);
  } catch {
    return null;
  }
}

/** Convenience: request a token (null if unsupported/denied) */
export async function getFcmToken(): Promise<string | null> {
  const msg = await getFirebaseMessaging();
  if (!msg) return null;
  try {
    const vapidKey = FIREBASE.vapidKey;
    const token = await getToken(msg, vapidKey ? { vapidKey } : undefined);
    return token ?? null;
  } catch {
    return null;
  }
}
