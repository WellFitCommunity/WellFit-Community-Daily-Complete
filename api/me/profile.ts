export const config = { runtime: 'edge' };

import { SUPABASE_URL } from '../_lib/env';
import { getServerSession } from '../_lib/supabase-auth';

export default async function handler(req: Request): Promise<Response> {
  const headers = new Headers({ 'Content-Type': 'application/json' });

  const session = await getServerSession(req, headers);
  if (!session) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });

  // Query through Supabase REST (authenticated with the user's access token)
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*&user_id=eq.${session.user.id}&limit=1`, {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  if (!r.ok) {
    const t = await r.text();
    return new Response(JSON.stringify({ error: t || 'fetch failed' }), { status: 500, headers });
  }

  const rows = await r.json();
  return new Response(JSON.stringify({ user: session.user, profile: rows?.[0] ?? null }), { status: 200, headers });
}
