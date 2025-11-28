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

/** Vercel deployment pattern for dynamic preview/production URLs */
const VERCEL_PATTERN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

/**
 * WHITE-LABEL MODE: When enabled, allows any HTTPS origin.
 * This is required for multi-tenant SaaS where each tenant has their own domain.
 * Set WHITE_LABEL_MODE=true in Supabase secrets to enable.
 */
const WHITE_LABEL_MODE: boolean =
  (getEnv("WHITE_LABEL_MODE") || "true").toLowerCase() === "true";

/** Options for CORS header generation */
export interface CorsOptions {
  methods?: string[];        // e.g., ["GET","POST","OPTIONS"]
  allowHeaders?: string[];   // request headers allowed
  exposeHeaders?: string[];  // response headers exposed to JS
  maxAge?: number;           // preflight cache seconds
}

/**
 * CSP for Edge Function responses.
 *
 * WHITE-LABEL NOTE: CSP is intentionally permissive for multi-tenant SaaS.
 * Each tenant's frontend should enforce its own strict CSP via meta tags or headers.
 * Edge functions return JSON data, not HTML, so CSP is less critical here.
 */
const CSP_VALUE =
  "default-src 'self'; " +
  "frame-ancestors *; " +  // Allow any tenant to embed
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.hcaptcha.com https://hcaptcha.com https://www.gstatic.com https://www.google.com https://*.supabase.co https://*.supabase.io https://vercel.live https://*.vercel.app; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; " +
  "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.io https://api.hcaptcha.com; " +
  "connect-src *; " +  // Allow any tenant API calls
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
      const isHttps = u.protocol === "https:";
      const isLocal =
        (u.hostname === "localhost" || u.hostname === "127.0.0.1") && u.port === "3100";

      // Check for GitHub Codespaces URLs (dynamic preview URLs)
      const isCodespaces = CODESPACES_PATTERN.test(normalized);

      // Check for Vercel deployment URLs (preview and production)
      const isVercel = VERCEL_PATTERN.test(normalized);

      // WHITE-LABEL: Allow any HTTPS origin for multi-tenant SaaS
      const isWhiteLabelAllowed = WHITE_LABEL_MODE && isHttps;

      if (ALLOWED_ORIGINS.indexOf(normalized) !== -1 || (DEV_ALLOW_LOCAL && isLocal) || isCodespaces || isVercel || isWhiteLabelAllowed) {
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
  const { headers: corsHdrs } = corsFromRequest(request, options);
  const merged = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHdrs)) merged.set(k, v);
  return new Response(response.body, {
    status: response.status,
    headers: merged
  });
}

/**
 * Legacy backwards-compatible export for edge functions that import `corsHeaders` directly.
 *
 * IMPORTANT: This static export cannot validate the request origin dynamically.
 * For proper CORS handling with credentials, use corsFromRequest() instead.
 *
 * This export uses the first configured ALLOWED_ORIGIN or falls back to production domain.
 * Do NOT use wildcard "*" as it breaks credentials and is insecure.
 */
const defaultOrigin: string = ALLOWED_ORIGINS[0] || "https://wellfitcommunity.live";

export const corsHeaders: HeadersRecord = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": defaultOrigin,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hcaptcha-token, x-admin-token, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};
