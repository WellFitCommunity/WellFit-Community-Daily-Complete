// api/_cors.ts
import type { VercelResponse } from '@vercel/node';

/**
 * Set CORS for browser calls hitting your Vercel API routes.
 * Configure allowed origins via env: CORS_ORIGINS="https://wellfitcommunity.live,https://*.vercel.app"
 */
const raw = process.env.CORS_ORIGINS?.trim() || 'https://wellfitcommunity.live';
const ALLOWLIST = raw.split(',').map(s => s.trim()).filter(Boolean);

function matchesOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  for (const pattern of ALLOWLIST) {
    if (pattern === '*') return origin;
    if (pattern.includes('*')) {
      // very light wildcard: https://*.vercel.app
      const re = new RegExp('^' + pattern.split('*').map(escapeRe).join('.*') + '$', 'i');
      if (re.test(origin)) return origin;
    } else if (origin.toLowerCase() === pattern.toLowerCase()) {
      return origin;
    }
  }
  return null;
}
function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function applyCors(res: VercelResponse, reqOrigin?: string) {
  const allowed = matchesOrigin(reqOrigin);

  if (!allowed) {
    // ✅ SECURITY: Reject unauthorized origins instead of wildcard fallback
    res.setHeader('Access-Control-Allow-Origin', 'null');
    res.status(403).json({ error: 'Origin not allowed' });
    return false;
  }

  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, x-requested-with');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  return true;
}
