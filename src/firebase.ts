// src/firebase.ts
import { getApps, getApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  isSupported,
  type Messaging,
  type MessagePayload,
  getToken,
  onMessage,
} from 'firebase/messaging';
import { FIREBASE } from './settings/settings';

type Maybe<T> = T | null;

let app: Maybe<FirebaseApp> = null;
let swReg: ServiceWorkerRegistration | null = null;

/** Strongly type your config so you don't need `as any` anywhere. */
type FirebaseClientConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
  measurementId?: string;
  vapidKey?: string; // not part of firebaseConfig; we keep it alongside for convenience
};

/** Safe singleton Firebase app (no crash if config is missing) */
export function getFirebaseApp(): Maybe<FirebaseApp> {
  const cfg = FIREBASE as unknown as FirebaseClientConfig;
  if (!cfg?.apiKey || !cfg?.projectId || !cfg?.appId) {
    // Firebase config incomplete - this is expected in some environments
    return null;
  }
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    appId: cfg.appId,
    messagingSenderId: cfg.messagingSenderId,
    storageBucket: cfg.storageBucket,
    measurementId: cfg.measurementId,
  });
  return app;
}

/** Register messaging SW once (prod only); reuse the registration */
async function ensureMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (swReg) return swReg;

  // Only try to register in production; in dev you likely don't serve the file
  if (import.meta.env.MODE !== 'production') return null;

  try {
    // Check file exists so we don't throw on 404
    const head = await fetch('/firebase-messaging-sw.js', { method: 'HEAD' });
    if (!head.ok) return null;

    swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    return swReg;
  } catch {
    return null;
  }
}

/** Get Messaging if supported; registers SW in production if present */
export async function getFirebaseMessaging(): Promise<Maybe<Messaging>> {
  if (typeof window === 'undefined') return null;

  const app = getFirebaseApp();
  if (!app) return null;

  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  await ensureMessagingServiceWorker();
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

  // Permission first (Safari, iOS and some contexts require explicit ask)
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return null;
    } catch {
      return null;
    }
  } else if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
    return null;
  }

  // Ensure we pass the SW registration to getToken if available
  const cfg = FIREBASE as unknown as FirebaseClientConfig;
  const vapidKey = cfg?.vapidKey;
  const registration = swReg ?? (await ensureMessagingServiceWorker());

  try {
    const token = await getToken(msg, {
      vapidKey,
      ...(registration ? { serviceWorkerRegistration: registration } : {}),
    });
    return token ?? null;
  } catch {
    return null;
  }
}

/** Foreground message helper – plug this into a toast/UX layer */
export async function onForegroundMessage(
  handler: (payload: MessagePayload) => void
): Promise<() => void> {
  const msg = await getFirebaseMessaging();
  if (!msg) return () => {};
  return onMessage(msg, (payload) => handler(payload));
}
