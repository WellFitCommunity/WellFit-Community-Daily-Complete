import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';
import { readCookie, setCookie } from './cookies';

const REFRESH_COOKIE = 'wf_rt';
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

type RefreshResponse = {
  access_token: string;
  refresh_token: string;
  user: { id: string; [k: string]: unknown };
};

export async function getServerSession(req: Request, headersToMutate?: Headers) {
  const rt = readCookie(req, REFRESH_COOKIE);
  if (!rt) return null;

  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ refresh_token: rt }),
  });

  if (!r.ok) return null;
  const data = (await r.json()) as RefreshResponse;

  // Rotate refresh token if Supabase returns a new one
  if (headersToMutate && data.refresh_token && data.refresh_token !== rt) {
    setCookie(headersToMutate, REFRESH_COOKIE, data.refresh_token, REFRESH_MAX_AGE);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user: data.user,
  };
}
