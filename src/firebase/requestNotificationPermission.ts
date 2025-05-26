import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../firebase';

// This uses the Web Push certificate (VAPID key) from Firebase Cloud Messaging
const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;

export const requestNotificationPermission = async () => {
  if (!messaging || !Notification || Notification.permission === 'denied') {
    console.warn('Notifications not supported or permission denied.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    const token = await getToken(messaging, { vapidKey });
    console.log('FCM Token:', token);

    // TODO: Save token to Supabase here later

    return token;
  } catch (err) {
    console.error('Error getting FCM token:', err);
    return null;
  }
};

// Optional: Handle foreground messages
export const listenForMessages = () => {
  if (messaging) {
    onMessage(messaging, payload => {
      console.log('Message received in foreground:', payload);
      // You can trigger toast or alert here
    });
  }
};
