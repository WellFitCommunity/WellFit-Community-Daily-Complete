import { getToken } from 'firebase/messaging';
import { messaging } from './firebase';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'BGpQZaI_BbEm39uj6vWhmKrnPBf8YoYVXM6VRYVuRbV8KJ4Kq5g6YbI4Z8u5RhOdKq4EmRZClOVO5qaBhUnRpBM',
      });

      const user_id = localStorage.getItem('user_id'); // Pulls from local login

      if (user_id && token) {
        const { error } = await supabase
          .from('push_tokens')
          .upsert({ user_id, token }, { onConflict: 'user_id' });

        if (error) {
          console.error('❌ Failed to save push token:', error);
        } else {
          console.log('✅ Push token saved for user:', user_id);
        }
      }

      return token;
    } else {
      console.warn('Notifications not granted');
      return null;
    }
  } catch (error) {
    console.error('Push token error:', error);
    return null;
  }
};
