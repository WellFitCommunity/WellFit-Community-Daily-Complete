// supabase/functions/_shared/auth.ts  (drop-in replacement for the helper you pasted)
// Deno Edge auth helpers: strict CORS, JWT -> user, role check via profiles.role_id -> roles.id

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- ENV ----
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")  ?? "";
const SB_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") ?? ""; // for internal-only handlers
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map(s => s.trim().replace(/\/+$/, "")).filter(Boolean);

// Admin client (bypasses RLS)
export const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SB_SECRET_KEY);

// ---- CORS (strict allow-list) ----
function normalizeOrigin(o: string | null): string | null {
  if (!o) return null;
  try { const u = new URL(o); return `${u.protocol}//${u.host}`; } catch { return null; }
}
// Wrap a handler with CORS & preflight
export function withCORS(handler: (req: Request) => Promise<Response> | Response, methods = ["GET","POST","PUT","PATCH","DELETE","OPTIONS"]) {
  return async (req: Request) => {
    const origin = normalizeOrigin(req.headers.get("origin"));
    const allowed = !!(origin && ALLOWED_ORIGINS.includes(origin));
    const base: Record<string,string> = {
      Vary: "Origin",
      "Access-Control-Allow-Methods": methods.join(", "),
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-internal-secret",
      "Access-Control-Max-Age": "86400",
      "Content-Type": "application/json",
    };
    if (allowed && origin) base["Access-Control-Allow-Origin"] = origin;

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: base });
    if (!allowed) return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers: base });

    const res = await handler(req);
    const h = new Headers(res.headers);
    Object.entries(base).forEach(([k,v]) => { if (!h.has(k)) h.set(k, v); });
    return new Response(res.body, { status: res.status, headers: h });
  };
}

// ---- AuthZ helpers ----

// Require a valid Supabase JWT (from Authorization: Bearer <token>).
export async function requireUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Response(JSON.stringify({ error: "Missing bearer" }), { status: 401 });
  const token = auth.slice(7).trim();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) throw new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  return data.user; // { id, email, phone, ... }
}

// ✅ Correct for your schema: profiles.role_id -> roles.id, check roles.name in allowed[]
export async function requireRole(userId: string, allowed: string[] = ["admin","super_admin"]) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role_id, roles:role_id ( id, name )")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Response(JSON.stringify({ error: "Role lookup failed" }), { status: 500 });
  const roleName = data?.roles?.name ?? null;
  if (!roleName || !allowed.includes(roleName)) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
  return roleName; // e.g. 'admin' | 'super_admin'
}

// Internal-only guard (for maintenance hooks, webhooks, etc.)
export function requireInternal(req: Request) {
  const key = req.headers.get("x-internal-secret") || "";
  if (!INTERNAL_SECRET || key !== INTERNAL_SECRET) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }
}
