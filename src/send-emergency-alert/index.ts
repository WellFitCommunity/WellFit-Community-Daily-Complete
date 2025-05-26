import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const sendEmergencyAlert = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { message } = req.body;
    if (!message) {
      res.status(400).send('Missing message');
      return;
    }

    const { data: tokens, error } = await supabase
      .from('notification_tokens')
      .select('fcm_token');

    if (error) {
      console.error('❌ Failed to fetch tokens:', error.message);
      res.status(500).send('Token fetch failed');
      return;
    }

    const fcmTokens = tokens.map((t: any) => t.fcm_token);
    const payload = {
      notification: {
        title: '⚠️ Emergency Alert',
        body: message,
      },
    };

    const response = await admin.messaging().sendToDevice(fcmTokens, payload);
    res.status(200).json({ success: true, response });

  } catch (err) {
    console.error('❌ Push failed:', err);
    res.status(500).send('Push failed');
  }
});

