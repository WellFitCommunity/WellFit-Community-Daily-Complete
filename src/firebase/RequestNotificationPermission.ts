import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../firebase'; // Adjust path if your firebase.ts is elsewhere

const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY; // Must be set in your .env or Vercel env vars

/**
 * Requests browser notification permission and retrieves FCM token from Firebase Messaging.
 * Returns the token string if permission granted, or null if denied.
 */
export const requestNotificationPermission = async (): Promise<string | null> => {
  // Safely check that messaging is defined
  if (typeof window === 'undefined' || !messaging || typeof Notification === "undefined" || Notification.permission === 'denied') {
    console.warn('Notifications not supported or permission denied.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }
    if (!vapidKey) {
      throw new Error('VAPID key is missing. Set REACT_APP_FIREBASE_VAPID_KEY in your environment variables.');
    }

    const token = await getToken(messaging, { vapidKey });
    if (token) {
      console.log('FCM Token:', token);
      // TODO: Save token to Supabase or backend if desired
      return token;
    } else {
      console.warn('No FCM token returned.');
      return null;
    }
  } catch (err) {
    console.error('Error getting FCM token:', err);
    return null;
  }
};

/**
 * Listen for foreground push messages (call in your App root/componentDidMount).
 * You can display a toast, dialog, or update UI as needed here.
 */
export const listenForMessages = () => {
  // Safely check messaging is defined and window is available
  if (typeof window !== 'undefined' && messaging) {
    onMessage(messaging, payload => {
      console.log('Message received in foreground:', payload);
      // TODO: Show a toast, modal, or update UI here if you wish
    });
  }
};

