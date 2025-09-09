// api/me/check_ins.ts
export const config = { runtime: 'edge' };
import { sbAsUser } from '../_lib/sb-fetch';

/**
 * GET  /api/me/check_ins     -> list last 50 check-ins (RLS enforces user)
 * POST /api/me/check_ins     -> create a check-in (RLS sets user_id = auth.uid())
 */
export default async function handler(req: Request): Promise<Response> {
  const headers = new Headers({ 'Content-Type': 'application/json' });

  if (req.method === 'GET') {
    // If your table is named "check_ins", change "check_ins" -> "check_ins" below.
    const out = await sbAsUser<any[]>(
      req,
      headers,
      `/rest/v1/check_ins?select=*&order=created_at.desc&limit=50`
    );

    if (!out.ok) return new Response(JSON.stringify(out.body), { status: out.status, headers });
    return new Response(JSON.stringify(out.data), { status: 200, headers });
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const out = await sbAsUser<any[]>(
      req,
      headers,
      `/rest/v1/checkins`,
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(body),
      }
    );

    if (!out.ok) return new Response(JSON.stringify(out.body), { status: out.status, headers });
    return new Response(JSON.stringify(out.data?.[0] ?? null), { status: 201, headers });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}
