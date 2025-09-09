// api/_lib/sb-fetch.ts
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';
import { getServerSession } from './supabase-auth';

type OkResult<D> = { ok: true; data: D; user: { id: string; [k: string]: unknown } };
type ErrResult = { ok: false; status: number; body: unknown };

/**
 * Calls Supabase as the logged-in user (token from HttpOnly refresh cookie).
 * Returns { ok: true, data, user } on success OR { ok: false, status, body } on error.
 */
export async function sbAsUser<D = unknown>(
  req: Request,
  headersToMutate: Headers,             // used to rotate refresh cookie when needed
  path: string,
  init: RequestInit = {}
): Promise<OkResult<D> | ErrResult> {
  const session = await getServerSession(req, headersToMutate);
  if (!session) return { ok: false, status: 401, body: { error: 'unauthorized' } };

  // Build headers safely (no undefined values)
  const hdrs = new Headers(init.headers as HeadersInit | undefined);
  hdrs.set('apikey', SUPABASE_ANON_KEY);
  hdrs.set('Authorization', `Bearer ${session.accessToken}`);
  if (init.body && !hdrs.has('Content-Type')) {
    hdrs.set('Content-Type', 'application/json');
  }

  const r = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: hdrs });

  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    return { ok: false, status: r.status, body: txt || 'upstream failed' };
  }

  const json = (await r.json().catch(() => null)) as D;
  return { ok: true, data: json, user: session.user };
}
