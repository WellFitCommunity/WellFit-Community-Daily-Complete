import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// ---- ENV (supports both old/new names) ----
const SUPABASE_URL =
  process.env.SB_URL ||
  process.env.SUPABASE_URL;

const SUPABASE_SECRET =
  process.env.SB_SECRET_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY; // legacy fallback

const JWKS_URL = process.env.JWKS_URL; // e.g. https://<ref>.supabase.co/auth/v1/jwks

if (!SUPABASE_URL || !SUPABASE_SECRET || !JWKS_URL) {
  throw new Error('Missing required env(s): SB_URL/SUPABASE_URL, SB_SECRET_KEY/SUPABASE_SECRET_KEY, JWKS_URL');
}
// -------------------------------------------

// inline JWKS verify (no external imports)
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));
async function verifyJwt(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: 'supabase',
    algorithms: ['RS256'],
  });
  return payload as Record<string, any>;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).send('Missing token');

    const payload = await verifyJwt(token).catch(() => null);
    if (!payload) return res.status(401).send('Invalid token');

    // EXAMPLE admin query; adjust table/columns
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', payload.sub)
      .limit(1);

    if (error) throw error;
    return res.status(200).json({ ok: true, user_id: payload.sub, role: payload.role, user: data?.[0] ?? null });
  } catch {
    return res.status(401).send('Invalid token');
  }
}
