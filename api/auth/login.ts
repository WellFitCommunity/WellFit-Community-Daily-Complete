export const config = { runtime: 'edge' };

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../_lib/env';
import { setCookie } from '../_lib/cookies';

const REFRESH_COOKIE = 'wf_rt';
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const { phone, email, password } = await req.json().catch(() => ({}));
  if (!password || (!phone && !email)) {
    return new Response(JSON.stringify({ error: 'phone or email and password required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GoTrue password sign-in (server side)
  const body = phone ? { phone, password } : { email, password };
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const headers = new Headers({ 'Content-Type': 'application/json' });

  if (!r.ok) {
    const t = await r.text();
    return new Response(JSON.stringify({ error: t || 'login failed' }), { status: 401, headers });
  }

  const data = await r.json(); // contains access_token, refresh_token, user, expires_in, ...
  // Store only refresh token in HttpOnly cookie
  setCookie(headers, REFRESH_COOKIE, data.refresh_token, REFRESH_MAX_AGE);

  // Return minimal public user payload to seed client state
  return new Response(JSON.stringify({ ok: true, user: { id: data.user.id } }), { status: 200, headers });
}
