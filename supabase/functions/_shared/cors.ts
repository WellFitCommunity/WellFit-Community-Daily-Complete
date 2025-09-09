// supabase/functions/_shared/cors.ts
type CorsOptions = {
  methods?: string[];
  allowHeaders?: string[];
  credentials?: boolean;
  maxAgeSeconds?: number;
};

function normalizeOrigin(o: string | null): string | null {
  if (!o) return null;
  try {
    const u = new URL(o);
    return `${u.protocol}//${u.host}`; // no trailing slash
  } catch {
    return null;
  }
}

/** Only reflect an origin that appears in ALLOWED_ORIGINS (comma-separated). */
export function cors(originRaw: string | null, opts: CorsOptions = {}) {
  const {
    methods = ['POST', 'OPTIONS'],
    allowHeaders = ['authorization', 'x-client-info', 'apikey', 'content-type'],
    credentials = false,
    maxAgeSeconds = 600,
  } = opts;

  const allowedList = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.toLowerCase());

  const origin = normalizeOrigin(originRaw)?.toLowerCase() ?? null;
  const isAllowed = origin ? allowedList.includes(origin) : false;

  const headers = new Headers();
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', methods.join(', '));
  headers.set('Access-Control-Allow-Headers', allowHeaders.join(', '));
  headers.set('Access-Control-Max-Age', String(maxAgeSeconds));
  headers.set('Content-Type', 'application/json');
  if (credentials) headers.set('Access-Control-Allow-Credentials', 'true');

  if (isAllowed && origin) headers.set('Access-Control-Allow-Origin', origin);

  return { headers, allowed: isAllowed, origin };
}
