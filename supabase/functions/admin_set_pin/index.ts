// supabase/functions/admin_set_pin/index.ts — PRODUCTION-READY (Maria copy-paste)
// Sets/updates an admin PIN (4–8 digits) for role=admin|super_admin.
// Validates caller auth via bearer token; checks roles from user_roles.
// Hashes PIN with bcrypt (cost 12). Rate-limits attempts per IP.
// CORS: echoes only allowed origins from ALLOWED_ORIGINS (comma-separated).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { z } from "https://esm.sh/zod@3.23.8";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// ---------- ENV ----------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL") || "";
const SB_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SB_PUB_KEY = Deno.env.get("SB_PUBLISHABLE_API_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

if (!SUPABASE_URL || !SB_SECRET_KEY) {
  throw new Error("Missing required environment variables: SUPABASE_URL and SB_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).");
}

const admin = createClient(SUPABASE_URL, SB_SECRET_KEY, { auth: { persistSession: false } });
const anon = createClient(SUPABASE_URL, SB_PUB_KEY);

// ---------- SCHEMA ----------
const schema = z.object({
  pin: z
    .string()
    .regex(/^\d{4,8}$/, { message: "PIN must be 4–8 digits" })
    .refine((val: string) => !/^(.)\1+$/.test(val), {
      message: "PIN cannot be all the same digit (e.g., 1111)",
    })
    .refine((val: string) => {
      // explicitly block these sequences
      const banned = ["0123", "1234", "2345", "3456", "4567", "5678", "6789"];
      return !banned.includes(val);
    }, { message: "PIN cannot be a simple sequence" }),
  role: z.enum(["admin", "super_admin"]).default("admin"),
});


// ---------- HELPERS ----------
function corsHeadersFor(origin: string | null): { headers: Headers; allowed: boolean } {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Vary": "Origin",
  });

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    return { headers, allowed: true };
  }
  // If no origin (server-to-server), allow; otherwise block
  if (!origin) return { headers, allowed: true };
  return { headers, allowed: false };
}

type CallerInfo = { id: string | null; roles: string[] };

async function getCaller(req: Request): Promise<CallerInfo> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return { id: null, roles: [] };

  const token = authHeader.slice(7).trim();
  if (!token) return { id: null, roles: [] };

  try {
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data?.user?.id) return { id: null, roles: [] };
    const id = data.user.id;

    // Option A: roles stored directly in user_roles(user_id, role)
    const { data: rows, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", id);

    if (roleErr) {
      console.warn("Role fetch error:", roleErr.message);
      return { id, roles: [] };
    }

    const roles = (rows ?? []).map((r: any) => r.role).filter(Boolean);

    /* Option B (uncomment if you use a roles table with a join):
    const { data: rowsJoin, error: roleErrJoin } = await admin
      .from("user_roles")
      .select("roles!inner(name)")
      .eq("user_id", id);

    if (roleErrJoin) {
      console.warn("Role fetch error:", roleErrJoin.message);
      return { id, roles: [] };
    }
    const roles = (rowsJoin ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    */

    return { id, roles };
  } catch (e) {
    console.error("Auth getUser error:", e);
    return { id: null, roles: [] };
  }
}

// Simple in-memory rate limit (per cold start instance)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_REQUESTS = 3;             // 3 attempts per window
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;  // 15 minutes

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const current = rateLimitMap.get(identifier);
  if (!current || now > current.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (current.count >= RATE_LIMIT_REQUESTS) return false;
  current.count++;
  return true;
}

// ---------- HANDLER ----------
serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const { headers, allowed } = corsHeadersFor(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    // Rate limit
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";
    if (!checkRateLimit(`pin-set:${clientIp}`)) {
      return new Response(JSON.stringify({ error: "Too many PIN set attempts. Try again in ~15 minutes." }), {
        status: 429, headers
      });
    }

    // AuthN + AuthZ
    const { id, roles } = await getCaller(req);
    if (!id) {
      return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers });
    }
    const hasAdminRole = roles.includes("super_admin") || roles.includes("admin");
    if (!hasAdminRole) {
      return new Response(JSON.stringify({ error: "Admin privileges required" }), { status: 403, headers });
    }

    // Parse body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return new Response(JSON.stringify({ error: first.message, field: first.path.join(".") }), {
        status: 400, headers
      });
    }

    const { pin, role } = parsed.data;

    // Only super_admin may set super_admin PIN
    if (role === "super_admin" && !roles.includes("super_admin")) {
      return new Response(JSON.stringify({ error: "Only super_admin may set a super_admin PIN" }), {
        status: 403, headers
      });
    }

    // Hash PIN (cost 12)
    const pin_hash = await bcrypt.hash(pin, 12);

    // Upsert
    // NOTE: Ensure a unique constraint exists: create unique index on admin_pins(user_id, role)
    const { error: upErr } = await admin
      .from("admin_pins")
      .upsert({
        user_id: id,
        role,
        pin_hash,
        updated_at: new Date().toISOString(),
        updated_by_ip: clientIp
      }, {
        onConflict: "user_id,role"
      });

    if (upErr) {
      console.error("PIN upsert error:", upErr);
      return new Response(JSON.stringify({ error: "Failed to update PIN. Please try again." }), {
        status: 500, headers
      });
    }

    // Optional audit log
    try {
      await admin.from("admin_audit_log").insert({
        user_id: id,
        action: "pin_updated",
        target_role: role,
        ip_address: clientIp,
        user_agent: req.headers.get("user-agent"),
        timestamp: new Date().toISOString()
      });
    } catch (err: unknown) {
      console.warn("Audit log failed:", err);
    }

    return new Response(JSON.stringify({ success: true, message: "PIN updated successfully", role }), {
      status: 200, headers
    });

  } catch (e: unknown) {
    console.error("admin_set_pin fatal error:", e);
    return new Response(JSON.stringify({ error: "An internal error occurred" }), { status: 500, headers });
  }
});
