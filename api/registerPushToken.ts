// /api/registerPushToken.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client (server-side only; keep key secret in Vercel env)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!accessToken) {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }

    // Verify the access token and get the user
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: 'Invalid access token' });
    }
    const authedUserId = userData.user.id;

    // Parse body
    const { fcm_token, platform = 'web' } = (req.body ?? {});
    if (!fcm_token || typeof fcm_token !== 'string') {
      return res.status(400).json({ error: 'Missing fcm_token' });
    }

    // Upsert token for this user
    const { error: upsertErr } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        { user_id: authedUserId, fcm_token, platform, last_seen: new Date().toISOString() },
        { onConflict: 'user_id,fcm_token' }
      );

    if (upsertErr) {
      return res.status(500).json({ error: upsertErr.message });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}
