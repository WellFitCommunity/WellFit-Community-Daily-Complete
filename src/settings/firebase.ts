// src/settings/firebase.ts
// CRA only exposes REACT_APP_* envs in the browser.
const truthy = (v?: string | null) => !!v && v.trim().length > 0;
const pick = (...c: Array<string | undefined>) => c.find(truthy)?.trim() ?? "";

export const FB_API_KEY = pick(process.env.REACT_APP_FIREBASE_API_KEY);
export const FB_AUTH_DOMAIN = pick(process.env.REACT_APP_FIREBASE_AUTH_DOMAIN);
export const FB_PROJECT_ID = pick(process.env.REACT_APP_FIREBASE_PROJECT_ID);
export const FB_STORAGE_BUCKET = pick(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET);
export const FB_MESSAGING_SENDER_ID = pick(process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID);
export const FB_APP_ID = pick(process.env.REACT_APP_FIREBASE_APP_ID);
export const FB_MEASUREMENT_ID = pick(process.env.REACT_APP_FIREBASE_MEASUREMENT_ID); // optional

export function assertClientFirebaseEnv() {
  const missing: string[] = [];
  if (!truthy(FB_API_KEY)) missing.push("REACT_APP_FIREBASE_API_KEY");
  if (!truthy(FB_AUTH_DOMAIN)) missing.push("REACT_APP_FIREBASE_AUTH_DOMAIN");
  if (!truthy(FB_PROJECT_ID)) missing.push("REACT_APP_FIREBASE_PROJECT_ID");
  if (!truthy(FB_MESSAGING_SENDER_ID)) missing.push("REACT_APP_FIREBASE_MESSAGING_SENDER_ID");
  if (!truthy(FB_APP_ID)) missing.push("REACT_APP_FIREBASE_APP_ID");
  if (missing.length) {
    throw new Error(
      "[FIREBASE CONFIG] Missing required env(s):\n - " +
        missing.join("\n - ") +
        "\nCRA rule: names must start with REACT_APP_ and you must restart the dev server."
    );
  }
}

export const firebaseWebConfig = {
  apiKey: FB_API_KEY,
  authDomain: FB_AUTH_DOMAIN,
  projectId: FB_PROJECT_ID,
  storageBucket: FB_STORAGE_BUCKET || undefined,
  messagingSenderId: FB_MESSAGING_SENDER_ID,
  appId: FB_APP_ID,
  measurementId: FB_MEASUREMENT_ID || undefined,
};
