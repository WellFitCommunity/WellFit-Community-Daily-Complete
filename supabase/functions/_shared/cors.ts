// supabase/functions/_shared/cors.ts
export function cors(origin: string | null): Headers {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
    .split(',').map(s => s.trim()).filter(Boolean);

  const allowOrigin = allowed.includes('*')
    ? '*'
    : (origin && allowed.includes(origin) ? origin : '');

  const h = new Headers();
  h.set('Access-Control-Allow-Origin', allowOrigin || '*'); // dev-safe fallback
  h.set('Vary', 'Origin');
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  h.set('Content-Type', 'application/json');
  return h;
}
