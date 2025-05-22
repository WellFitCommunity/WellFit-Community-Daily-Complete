import type { VercelRequest, VercelResponse } from '@vercel/node';

const vapidKey = process.env.FIREBASE_VAPID_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const { user_id } = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : req.body || {};

    if (!user_id) {
      res.status(400).json({ error: 'User ID required' });
      return;
    }

    if (!vapidKey) {
      res.status(500).json({ error: 'VAPID key not configured' });
      return;
    }

    // Simulated: generate a push token (in reality, use Firebase Admin SDK)
    console.log('Registering push token for user:', user_id, 'with VAPID:', vapidKey.slice(0, 10) + '...');

    // Optionally: Save to Supabase here if needed

    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
