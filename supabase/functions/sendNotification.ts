// netlify/functions/sendNotification.ts

import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;

  // logic to send notification using those keys
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Notification sent!" })
  };
};
