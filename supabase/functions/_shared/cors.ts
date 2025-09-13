// supabase/functions/_shared/cors.ts
import { HCAPTCHA_ALLOWED_ORIGINS } from "./env.ts";

const DEFAULT_EXACT = new Set<string>([
  "http://localhost:3100",
  "http://127.0.0.1:3100",
  "http://127.0.0.1",
  "http://10.134.86.211",
  "https://wellfit-community.firebaseapp.com",
  "https://www.wellfitcommunity.live",
  "https://wellfitcommunity.live",
]);

const DEFAULT_WILDCARDS = [
  ".vercel.app",
  ".app.github.dev",
];

const fromEnv = (HCAPTCHA_ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// merge env exacts
for (const o of fromEnv) DEFAULT_EXACT.add(o);

function originAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (DEFAULT_EXACT.has(origin)) return true;
  if (DEFAULT_WILDCARDS.some(suffix => origin.endsWith(suffix))) return true;
  return false;
}

export function cors(origin: string | null, opts?: {
  methods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
}) {
  const { methods = ["POST", "OPTIONS"], allowHeaders = ["content-type"], exposeHeaders = [] } = opts || {};
  const allowed = originAllowed(origin);
  const allowOrigin = allowed ? (origin as string) : "https://www.wellfitcommunity.live";

  const headers: HeadersInit = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": methods.join(", "),
    "Access-Control-Allow-Headers": allowHeaders.join(", "),
    "Access-Control-Expose-Headers": exposeHeaders.join(", "),
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
    "Content-Type": "application/json",
    "Connection": "keep-alive",
  };

  return { headers, allowed };
}
