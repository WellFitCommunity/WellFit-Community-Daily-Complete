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
      // Attempt to save the token to the backend
      try {
        // Assuming supabase client is available, e.g., imported or via context
        // This requires the user to be authenticated for supabase.auth.getUser() to work
        // and for the RLS policies on fcm_tokens to allow insert.
        const { supabase } = await import('../lib/supabaseClient'); // Dynamic import or ensure it's available
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { error: saveError } = await supabase.functions.invoke('save-fcm-token', {
            body: { fcm_token: token, device_info: navigator.userAgent },
          });
          if (saveError) {
            console.error('Failed to save FCM token to backend:', saveError);
          } else {
            console.log('FCM token saved to backend successfully.');
          }
        } else {
          console.warn('User not authenticated, cannot save FCM token to backend.');
        }
      } catch (e) {
        console.error('Error during FCM token save process:', e);
      }
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
      // Basic alert to show foreground message.
      // Replace with a proper toast notification (e.g., using react-toastify) for better UX.
      let title = "New Message";
      let body = "You have a new message.";
      if (payload.notification) {
        title = payload.notification.title || title;
        body = payload.notification.body || body;
      } else if (payload.data) { // Check data payload if notification is not present
        title = payload.data.title || title;
        body = payload.data.body || body;
      }
      alert(`${title}\n\n${body}`);
    });
  }
};

