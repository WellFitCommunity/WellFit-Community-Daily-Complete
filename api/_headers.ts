// api/_headers.ts
import type { VercelResponse } from '@vercel/node';
import { URL } from 'url';

export function setSecurityHeaders(res: VercelResponse) {
  const SUPABASE_URL = process.env.SUPABASE_URL || '';
  let supabaseHost = '';
  try { supabaseHost = new URL(SUPABASE_URL).host; } catch {}

  // allow only your exact domains (no wildcards)
  const appFrames = [
    'https://wellfitcommunity.live',
    'https://www.wellfitcommunity.live',
    'https://thewellfitcommunity.org',
    'https://www.thewellfitcommunity.org',
  ].join(' ');

  // ONLY if you are proxying weather via /api/weather, no external connect-src needed
  const connectSrc = [
    `'self'`,
    supabaseHost ? `https://${supabaseHost}` : '',
    // If you insist on direct weather calls, uncomment exactly one:
    // 'https://api.weatherapi.com',
    // 'https://api.openweathermap.org',
    'https://api.hcaptcha.com',
    'https://verify.twilio.com',
    'https://api.twilio.com',
    'https://api.mailersend.com',
    'https://www.google.com',
    'https://www.gstatic.com'
  ].filter(Boolean).join(' ');

  const imgSrc = [
    `'self'`,
    'data:',
    'blob:',
    supabaseHost ? `https://${supabaseHost}` : '',
    'https://api.hcaptcha.com',
    'https://images.unsplash.com',
    'https://source.unsplash.com'
  ].filter(Boolean).join(' ');

  const scriptSrc = [
    `'self'`,
    // If CRA needs it, keep these. Best is to move to nonces later.
    `'unsafe-inline'`,
    `'unsafe-eval'`,
    'https://js.hcaptcha.com',
    'https://hcaptcha.com',
    'https://www.gstatic.com',
    'https://www.google.com'
  ].join(' ');

  const styleSrc = [
    `'self'`,
    `'unsafe-inline'`,
    'https://fonts.googleapis.com'
  ].join(' ');

  const fontSrc = [
    `'self'`,
    'https://fonts.gstatic.com'
  ].join(' ');

  const frameSrc = [
    `'self'`,
    'https://hcaptcha.com',
    'https://*.hcaptcha.com'.replace('*.', '') // Avoid *, use both if needed:
    // 'https://newassets.hcaptcha.com', 'https://assets.hcaptcha.com'
  ].join(' ');

  // IMPORTANT: Prefer CSP frame-ancestors over X-Frame-Options
  const csp = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `frame-ancestors 'self' ${appFrames}`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `font-src ${fontSrc}`,
    `img-src ${imgSrc}`,
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    `worker-src 'self' blob:`,
    `media-src 'self' blob:`,
    `object-src 'none'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);

  // Modern, consistent hardening
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  // Use CSP frame-ancestors; do NOT also set DENY (they conflict). If you must, use SAMEORIGIN.
  // res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions-Policy modern syntax (explicitly disable unless you really need them)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
}