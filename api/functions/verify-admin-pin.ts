// api/functions/verify-admin-pin.ts
export const config = { runtime: 'edge' };
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../_lib/env';
import { getServerSession } from '../_lib/supabase-auth';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const headers = new Headers({ 'Content-Type': 'application/json' });

  const session = await getServerSession(req, headers);
  if (!session) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });

  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${SUPABASE_URL}/functions/v1/verify-admin-pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const txt = await r.text();
  return new Response(txt, { status: r.status, headers });
}
