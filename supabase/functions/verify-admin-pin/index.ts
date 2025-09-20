import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SB_PUB_KEY   = Deno.env.get("SB_PUBLISHABLE_API_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ADMIN_SESSION_TTL_MIN = Number(Deno.env.get("ADMIN_SESSION_TTL_MIN") ?? "120"); // 2h

const admin = createClient(SUPABASE_URL, SB_SECRET_KEY, { auth: { persistSession: false } });
const anon  = createClient(SUPABASE_URL, SB_PUB_KEY);

const schema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4–8 digits."),
  role: z.enum(["admin","super_admin"])
});

async function getCaller(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
  if (!token) return { id: null as string | null, roles: [] as string[] };
  const { data } = await anon.auth.getUser(token);
  const id = data?.user?.id ?? null;
  if (!id) return { id: null, roles: [] };

  const { data: rows } = await admin.from("user_roles").select("roles!inner(name)").eq("user_id", id);
  const roles = (rows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
  return { id, roles };
}

// simple rate-limit by (user_id + route)
async function rateLimit(key: string, max = 10, windowSec = 300) {
  const cutoff = new Date(Date.now() - windowSec * 1000).toISOString();
  const { error: logErr } = await admin.from("rate_limit_admin").insert({ key });
  if (logErr) console.warn("rate-limit log err:", logErr.message);
  const { count, error } = await admin
    .from("rate_limit_admin")
    .select("attempted_at", { count: "exact", head: true })
    .eq("key", key)
    .gte("attempted_at", cutoff);
  if (error) return false;
  return (count ?? 0) <= max;
}

// CORS Configuration - Explicit allowlist for security
const ALLOWED_ORIGINS = [
  "https://thewellfitcommunity.org",
  "https://wellfitcommunity.live",
  "http://localhost:3100",
  "https://localhost:3100"
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : null;
  return new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  });
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = getCorsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST")   return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    const { id, roles } = await getCaller(req);
    if (!id) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers });
    const { pin, role } = parsed.data;

    if (!roles.includes(role))
      return new Response(JSON.stringify({ error: "Insufficient privileges for selected role" }), { status: 403, headers });

    const allowed = await rateLimit(`verify-pin:${id}`, 8, 300);
    if (!allowed) return new Response(JSON.stringify({ error: "Too many attempts. Try again later." }), { status: 429, headers });

    const { data: row, error } = await admin.from("admin_pins").select("pin_hash, role").eq("user_id", id).single();
    if (error || !row) return new Response(JSON.stringify({ error: "PIN not set" }), { status: 400, headers });

    const ok = await bcrypt.compare(pin, row.pin_hash);
    if (!ok) return new Response(JSON.stringify({ error: "Incorrect PIN" }), { status: 401, headers });

    // create/refresh server-side admin session
    const expires = new Date(Date.now() + ADMIN_SESSION_TTL_MIN * 60 * 1000);
    const { error: upErr } = await admin.from("admin_sessions")
      .upsert({ user_id: id, role, expires_at: expires.toISOString() });
    if (upErr) throw new Error(upErr.message);

    return new Response(JSON.stringify({ success: true, expires_at: expires.toISOString() }), { status: 200, headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers });
  }
});
