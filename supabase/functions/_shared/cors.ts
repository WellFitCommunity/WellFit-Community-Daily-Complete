// supabase/functions/_shared/cors.ts
// Minimal, robust CORS helper for Supabase Edge Functions.

import { ALLOWED_ORIGINS } from "./env.ts"; // <-- correct, exported symbol exists

export type CorsOptions = {
  methods?: readonly string[];
  allowHeaders?: readonly string[];
  exposeHeaders?: readonly string[];
  maxAgeSeconds?: number;
  allowCredentials?: boolean;
  allowedOrigins?: readonly string[]; // override env list if needed
};

function normalizeOrigin(o: string | null): string {
  if (!o) return "";
  try {
    const u = new URL(o);
    return `${u.protocol}//${u.host}`; // scheme + host[:port], no trailing slash
  } catch {
    return "";
  }
}

function toOriginSet(list: readonly string[] = []): Set<string> {
  const set = new Set<string>();
  for (const item of list) {
    if (item === "*") { set.add("*"); continue; }
    const n = normalizeOrigin(item);
    if (n) set.add(n);
  }
  return set;
}

export function cors(originHeader: string | null, opts: CorsOptions = {}) {
  const {
    methods = ["GET", "POST", "OPTIONS"],
    allowHeaders = ["content-type"],
    exposeHeaders = [],
    maxAgeSeconds = 600,
    allowCredentials = false,
    allowedOrigins = ALLOWED_ORIGINS,
  } = opts;

  const origin = normalizeOrigin(originHeader);
  const allowset = toOriginSet(allowedOrigins);
  const wildcard = allowset.has("*");
  const allowed = wildcard || (!!origin && allowset.has(origin));

  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": methods.join(","),
    "Access-Control-Allow-Headers": allowHeaders.join(","),
    "Access-Control-Max-Age": String(maxAgeSeconds),
    "Content-Type": "application/json",
  };
  if (exposeHeaders.length) {
    headers["Access-Control-Expose-Headers"] = exposeHeaders.join(",");
  }
  if (allowCredentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  if (allowed) {
    headers["Access-Control-Allow-Origin"] = origin || (wildcard ? "*" : "");
  }

  return { headers, allowed };
}
