// supabase/functions/_shared/cors.ts
// Universal CORS helper

const getEnv = (key: string, fallbacks: string[] = []): string => {
  const all = [key, ...fallbacks];
  for (const k of all) {
    const val = Deno.env.get(k);
    if (val?.trim()) return val.trim();
  }
  return "";
};

const DEFAULT_ORIGINS = [
  "http://localhost:3100",
  "https://localhost:3100",
  "http://127.0.0.1:3100",
  "https://127.0.0.1:3100",
];

const ALLOWED_ORIGINS = getEnv("ALLOWED_ORIGINS", [])
  .split(",")
  .map(s => s.trim())
  .filter(Boolean)
  .concat(DEFAULT_ORIGINS);

export interface CorsOptions {
  methods?: string[];
  allowHeaders?: string[];
  maxAge?: number;
}

export function cors(
  origin: string | null,
  options: CorsOptions = {}
): { headers: HeadersInit; allowed: boolean } {
  const {
    methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders = [
      "authorization",
      "x-client-info",
      "apikey",
      "content-type",
      "x-hcaptcha-token",
      "x-admin-token",
    ],
    maxAge = 86400,
  } = options;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": methods.join(", "),
    "Access-Control-Allow-Headers": allowHeaders.join(", "),
    "Access-Control-Max-Age": maxAge.toString(),
    "Vary": "Origin",
  };

  let allowed = false;

  if (origin) {
    try {
      const originUrl = new URL(origin);
      const normalizedOrigin = `${originUrl.protocol}//${originUrl.host}`;

      allowed = ALLOWED_ORIGINS.includes(normalizedOrigin);

      if (
        !allowed &&
        (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1")
      ) {
        if (originUrl.port === "3100") allowed = true;
      }

      if (allowed) {
        headers["Access-Control-Allow-Origin"] = normalizedOrigin;
      }
    } catch (e) {
      console.warn("[CORS] Invalid origin:", origin, e);
      allowed = false;
    }
  }

  console.log("[CORS] Origin:", origin, "Allowed:", allowed);

  return { headers, allowed };
}
