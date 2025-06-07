import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'Missing phone or code' });

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('phone_verifications')
    .select('*')
    .eq('phone', phone)
    .eq('code', code)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: 'Database error' });
  }

  if (!data) {
    return res.status(401).json({ error: 'Invalid or expired code' });
  }

  // Optionally: delete code after use (one-time use)
  await supabase.from('phone_verifications').delete().eq('id', data.id);

  // At this point, consider the user authenticated.
  // Issue a session token, set login state, etc.

  return res.status(200).json({ success: true });
}
