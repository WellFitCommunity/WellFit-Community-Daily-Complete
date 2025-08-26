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

const hasConfig =
  !!cfg.apiKey && !!cfg.authDomain && !!cfg.projectId &&
  !!cfg.storageBucket && !!cfg.messagingSenderId && !!cfg.appId;

let app: Maybe<FirebaseApp> = null;

/** Safe singleton Firebase app (no crashes if config missing) */
function getFirebaseApp(): Maybe<FirebaseApp> {
  if (!hasConfig) return null;
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp(cfg as any);
  return app;
}

/** Get Messaging instance if supported and configured (no SW auto-registration here) */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  const app = getFirebaseApp();
  if (!app) return null;

  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  try {
    return getMessaging(app);
  } catch {
    return null;
  }
}

/** Optional helper to obtain an FCM token (returns null if unsupported/denied/missing VAPID) */
export async function getFcmToken(): Promise<string | null> {
  const msg = await getFirebaseMessaging();
  if (!msg) return null;

  const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;

  try {
    const t = await getToken(msg, { vapidKey });
    return t ?? null;
  } catch {
    return null;
  }
}

/** Compile-time shim: if any old code imports { messaging } it won't crash. Prefer using getFirebaseMessaging(). */
export const messaging: Messaging | null = null;

/** ✅ Alias so existing imports work: `import { initFirebaseMessaging } from '../firebase'` */
export { getFirebaseMessaging as initFirebaseMessaging };
