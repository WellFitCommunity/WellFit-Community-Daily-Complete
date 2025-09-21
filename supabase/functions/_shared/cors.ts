// supabase/functions/_shared/cors.ts
// Universal CORS helper — strict TS, no implicit any, no fragile lambdas.

type HeadersRecord = Record<string, string>;

function getEnv(name: string, fallbacks: string[] = []): string {
  const keys: string[] = [name, ...fallbacks];
  for (let i = 0; i < keys.length; i++) {
    const v = Deno.env.get(keys[i]);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
}

// Toggle local origins ONLY when you explicitly set DEV_ALLOW_LOCAL=true
const DEV_ALLOW_LOCAL: boolean =
  (getEnv("DEV_ALLOW_LOCAL") || "false").toLowerCase() === "true";

const LOCAL_DEFAULTS: string[] = [
  "http://localhost:3100",
  "https://localhost:3100",
  "http://127.0.0.1:3100",
  "https://127.0.0.1:3100"
];

// Build ALLOWED_ORIGINS deterministically with explicit typing
const rawOrigins: string = getEnv("ALLOWED_ORIGINS");
const envList: string[] = [];
{
  const parts: string[] = (rawOrigins || "").split(",");
  for (let i = 0; i < parts.length; i++) {
    const part: string = parts[i] || "";
    const trimmed: string = part.trim();
    if (trimmed.length > 0) envList.push(trimmed);
  }
}

const allowedSet = new Set<string>();
for (let i = 0; i < envList.length; i++) allowedSet.add(envList[i]);
if (DEV_ALLOW_LOCAL) {
  for (let i = 0; i < LOCAL_DEFAULTS.length; i++) allowedSet.add(LOCAL_DEFAULTS[i]);
}
const ALLOWED_ORIGINS: string[] = Array.from(allowedSet);

export interface CorsOptions {
  methods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number; // seconds
}

const CSP_VALUE =
  "default-src 'self'; frame-ancestors 'self' https://wellfitcommunity.live https://www.wellfitcommunity.live https://thewellfitcommunity.org https://www.thewellfitcommunity.org; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.hcaptcha.com https://hcaptcha.com https://www.gstatic.com https://www.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://api.hcaptcha.com https://*.supabase.co https://*.supabase.io https://verify.twilio.com https://api.twilio.com https://api.mailersend.com https://images.unsplash.com https://source.unsplash.com; connect-src 'self' https://api.hcaptcha.com https://*.supabase.co https://*.supabase.io https://verify.twilio.com https://api.twilio.com https://api.mailersend.com https://images.unsplash.com https://source.unsplash.com; frame-src 'self' https://hcaptcha.com https://*.hcaptcha.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests";

export function cors(
  origin: string | null,
  options: CorsOptions = {}
): { headers: HeadersRecord; allowed: boolean } {
  const methods: string[] = options.methods || ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
  const allowHeaders: string[] =
    options.allowHeaders ||
    [
      "authorization",
      "x-client-info",
      "apikey",
      "content-type",
      "x-hcaptcha-token",
      "x-admin-token"
    ];
  const exposeHeaders: string[] = options.exposeHeaders || [];
  const maxAge: number = typeof options.maxAge === "number" ? options.maxAge : 86400;

  const headers: HeadersRecord = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": methods.join(", "),
    "Access-Control-Allow-Headers": allowHeaders.join(", "),
    "Access-Control-Max-Age": String(maxAge),
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": CSP_VALUE
  };

  let allowed = false;

  if (origin) {
    try {
      const u = new URL(origin);
      const normalized = `${u.protocol}//${u.host}`; // protocol + host[:port]
      const isLocal =
        (u.hostname === "localhost" || u.hostname === "127.0.0.1") && u.port === "3100";

      if (ALLOWED_ORIGINS.indexOf(normalized) !== -1 || (DEV_ALLOW_LOCAL && isLocal)) {
        headers["Access-Control-Allow-Origin"] = normalized;
        allowed = true;
      }
    } catch (e) {
      // Invalid Origin — keep allowed=false
      console.warn("[CORS] Invalid origin:", origin, e);
    }
  }

  // If you want to expose headers to browser JS, list them
  if (exposeHeaders.length > 0) {
    headers["Access-Control-Expose-Headers"] = exposeHeaders.join(", ");
  }

  return { headers, allowed };
}
