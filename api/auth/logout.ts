export const config = { runtime: 'edge' };

import { clearCookie } from '../_lib/cookies';

const REFRESH_COOKIE = 'wf_rt';

export default async function handler(_req: Request): Promise<Response> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  clearCookie(headers, REFRESH_COOKIE);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
