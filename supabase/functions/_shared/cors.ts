// supabase/functions/_shared/cors.ts
// Universal CORS + Security Headers for Supabase Edge Functions
// Strict TS; no implicit any; deterministic env handling.

type HeadersRecord = Record<string, string>;

/** Read an env var with optional fallback keys; return "" if absent. */
function getEnv(name: string, fallbacks: string[] = []): string {
  const keys: string[] = [name, ...fallbacks];
  for (let i = 0; i < keys.length; i++) {
    const v = Deno.env.get(keys[i]);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
}

/** Toggle local origins ONLY when you explicitly set DEV_ALLOW_LOCAL=true */
const DEV_ALLOW_LOCAL: boolean =
  (getEnv("DEV_ALLOW_LOCAL") || "false").toLowerCase() === "true";

const LOCAL_DEFAULTS: string[] = [
  "http://localhost:3100",
  "https://localhost:3100",
  "http://127.0.0.1:3100",
  "https://127.0.0.1:3100"
];

/** Build ALLOWED_ORIGINS deterministically from env */
const rawOrigins: string = getEnv("ALLOWED_ORIGINS");
const envList: string[] = [];
{
  const parts: string[] = (rawOrigins || "").split(",");
  for (let i = 0; i < parts.length; i++) {
    const trimmed = (parts[i] || "").trim();
    if (trimmed.length > 0) envList.push(trimmed);
  }
}
const allowedSet = new Set<string>(envList);
if (DEV_ALLOW_LOCAL) {
  for (let i = 0; i < LOCAL_DEFAULTS.length; i++) allowedSet.add(LOCAL_DEFAULTS[i]);
}
const ALLOWED_ORIGINS: string[] = Array.from(allowedSet);

/** GitHub Codespaces pattern for dynamic environment URLs */
const CODESPACES_PATTERN = /^https:\/\/[a-z0-9-]+\.app\.github\.dev$/;

/** Options for CORS header generation */
export interface CorsOptions {
  methods?: string[];        // e.g., ["GET","POST","OPTIONS"]
  allowHeaders?: string[];   // request headers allowed
  exposeHeaders?: string[];  // response headers exposed to JS
  maxAge?: number;           // preflight cache seconds
}

/**
 * NOTE: These CSP rules apply to responses from your function endpoint.
 * Keep your frontend CSP (e.g., vercel.json) aligned with these sources.
 */
const CSP_VALUE =
  "default-src 'self'; " +
  "frame-ancestors 'self' https://wellfitcommunity.live https://www.wellfitcommunity.live https://thewellfitcommunity.org https://www.thewellfitcommunity.org; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.hcaptcha.com https://hcaptcha.com https://www.gstatic.com https://www.google.com https://*.supabase.co https://*.supabase.io; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; " +
  "img-src 'self' data: blob: https://api.hcaptcha.com https://*.supabase.co https://*.supabase.io https://verify.twilio.com https://api.twilio.com https://api.mailersend.com https://images.unsplash.com https://source.unsplash.com; " +
  "connect-src 'self' https://api.hcaptcha.com https://*.supabase.co https://*.supabase.io https://verify.twilio.com https://api.twilio.com https://api.mailersend.com https://images.unsplash.com https://source.unsplash.com https://wellfitcommunity.live https://www.wellfitcommunity.live https://thewellfitcommunity.org https://www.thewellfitcommunity.org https://api.weatherapi.com; " +
  "frame-src 'self' https://hcaptcha.com https://*.hcaptcha.com; " +
  "worker-src 'self' blob:; " +
  "media-src 'self' blob:; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'; " +
  "upgrade-insecure-requests";

/**
 * Generate CORS + security headers from an Origin string.
 * Returns headers and whether the origin was allowed.
 */
export function cors(
  origin: string | null,
  options: CorsOptions = {}
): { headers: HeadersRecord; allowed: boolean } {
  const methods: string[] =
    options.methods || ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

  const allowHeaders: string[] =
    options.allowHeaders || [
      "authorization",
      "x-client-info",
      "apikey",
      "content-type",
      "x-hcaptcha-token",
      "x-admin-token",
      "x-supabase-api-version"
    ];

  const exposeHeaders: string[] = options.exposeHeaders || [];
  const maxAge: number = typeof options.maxAge === "number" ? options.maxAge : 86400;

  const headers: HeadersRecord = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": methods.join(", "),
    "Access-Control-Allow-Headers": allowHeaders.join(", "),
    "Access-Control-Max-Age": String(maxAge),
    "Vary": "Origin",

    // Security headers
    "X-Content-Type-Options": "nosniff",
    // Intentionally omit X-Frame-Options; CSP frame-ancestors is authoritative
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Enable camera/mic/geo for your own origin only
    "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(self)",

    // CSP aligned with your frontend allowlist
    "Content-Security-Policy": CSP_VALUE
  };

  let allowed = false;

  if (origin) {
    try {
      const u = new URL(origin);
      const normalized = `${u.protocol}//${u.host}`; // protocol + host[:port]
      const isLocal =
        (u.hostname === "localhost" || u.hostname === "127.0.0.1") && u.port === "3100";

      // Check for GitHub Codespaces URLs (dynamic preview URLs)
      const isCodespaces = CODESPACES_PATTERN.test(normalized);

      if (ALLOWED_ORIGINS.indexOf(normalized) !== -1 || (DEV_ALLOW_LOCAL && isLocal) || isCodespaces) {
        headers["Access-Control-Allow-Origin"] = normalized;
        headers["Access-Control-Allow-Credentials"] = "true";
        allowed = true;
      }
    } catch (e) {
      // Invalid Origin — keep allowed=false
      console.warn("[CORS] Invalid origin:", origin, e);
    }
  }

  if (exposeHeaders.length > 0) {
    headers["Access-Control-Expose-Headers"] = exposeHeaders.join(", ");
  }

  return { headers, allowed };
}

/** Convenience: build headers directly from a Request */
export function corsFromRequest(
  request: Request,
  options: CorsOptions = {}
): { headers: HeadersRecord; allowed: boolean } {
  const origin = request.headers.get("origin");
  return cors(origin, options);
}

/** Preflight handler — call this when req.method === "OPTIONS" */
export function handleOptions(
  request: Request,
  options: CorsOptions = {}
): Response {
  const { headers } = corsFromRequest(request, options);
  // 204 (No Content) is conventional for preflight
  return new Response(null, { status: 204, headers });
}

/** Merge CORS headers into an existing Response */
export function withCors(
  request: Request,
  response: Response,
  options: CorsOptions = {}
): Response {
  const { headers: corsHeaders } = corsFromRequest(request, options);
  const merged = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders)) merged.set(k, v);
  return new Response(response.body, {
    status: response.status,
    headers: merged
  });
}
