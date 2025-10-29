// src/utils/requestNotificationPermission.ts
import { getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging } from '../firebase';
import { supabase } from '../lib/supabaseClient';

const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY as string;

export const requestNotificationPermission = async (): Promise<void> => {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      alert('Push notifications are not supported in this browser.');
      return;
    }

    // 1) Ensure SW registered at the root
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // 2) Ask for permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Notifications not granted.');
      return;
    }

    // 3) Get Supabase access token (for server verification)
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    const userId = sessionData?.session?.user?.id;
    if (!accessToken || !userId) {
      alert('You must be logged in to enable notifications.');
      return;
    }

    if (!VAPID_KEY) {
      alert('Missing REACT_APP_FIREBASE_VAPID_KEY.');
      return;
    }

    // 4) Get FCM token tied to this browser + SW
    const fcmToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!fcmToken) {
      alert('Unable to get a push token. Try again later.');
      return;
    }

    // 5) Send to Vercel API (Bearer = Supabase JWT)
    const res = await fetch('/api/registerPushToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ fcm_token: fcmToken, platform: 'web' }),
    });

    if (!res.ok) {
      let msg = res.statusText;
      try {
        const j = await res.json();
        msg = j.error || msg;
      } catch {}
      throw new Error(msg || 'Failed to register push token.');
    }

    alert('Notifications enabled!');

    // Optional: show foreground messages as console or toast
    onMessage(messaging, (payload) => {

      // You can show a toast here with react-toastify if you want
    });
  } catch (err) {

    alert('Push notification setup failed.');
  }
};
