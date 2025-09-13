// src/lib/firebaseClient.ts
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging"; // if you use FCM
import { assertClientFirebaseEnv, firebaseWebConfig } from "../settings/firebase";

assertClientFirebaseEnv();

const app = getApps().length ? getApps()[0] : initializeApp(firebaseWebConfig);

// Optional (if using FCM):
export const messagingPromise = isSupported().then(supported => (supported ? getMessaging(app) : null));

export { app };
