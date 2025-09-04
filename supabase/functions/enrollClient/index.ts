// supabase/functions/enrollClient/index.ts
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.28.0";
import { z } from "https://esm.sh/zod@3.21.4";

// ─── ENV (new names with legacy fallbacks) ───────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SECRET_KEY =
  Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_PUBLISHABLE_API_KEY =
  Deno.env.get("SB_PUBLISHABLE_API_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SUPABASE_PUBLISHABLE_API_KEY) {
  throw new Error("Missing SUPABASE_URL, SB_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY, or SB_PUBLISHABLE_API_KEY/SUPABASE_ANON_KEY");
}

const sSvc  = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const sAnon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_API_KEY);

// ─── Input schema ────────────────────────────────────────────────────────────
const EnrollSchema = z.object({
  phone:      z.string().regex(/^\+\d{10,15}$/, "Must be full E.164 number"),
  password:   z.string().min(8, "Password must be at least 8 characters"),
  first_name: z.string().min(1, "First name required"),
  last_name:  z.string().min(1, "Last name required"),
  email:      z.string().email().optional(),
});

// ─── Helper: get caller + roles ─────────────────────────────────────────────
async function getCaller(req: Request) {
  const hdr = req.headers.get("Authorization") || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  if (!token) return { id: null as string | null, roles: [] as string[] };

  const { data, error } = await sAnon.auth.getUser(token);
  const id = data?.user?.id ?? null;
  if (error || !id) return { id: null, roles: [] };

  // Adjust column/rel names if yours differ
  const { data: rows } = await sSvc
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", id);

  const roles = (rows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
  return { id, roles };
}

// ─── Function ────────────────────────────────────────────────────────────────
serve(async (req) => {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": req.headers.get("Origin") ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    // 1) AuthZ: must be admin or super_admin
    const { id: adminId, roles } = await getCaller(req);
    if (!adminId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const isAllowed = roles.includes("admin") || roles.includes("super_admin");
    if (!isAllowed)
      return new Response(JSON.stringify({ error: "Insufficient privileges" }), { status: 403, headers });

    // 2) Validate input
    const body = await req.json();
    const parsed = EnrollSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), {
        status: 400,
        headers,
      });
    }
    const { phone, password, first_name, last_name, email } = parsed.data;

    // 3) Create auth user (service role required)
    const { data: ures, error: uerr } = await sSvc.auth.admin.createUser({
      phone,
      password,
      email: email || undefined,
      phone_confirm: true,
      email_confirm: email ? true : undefined,
      user_metadata: { role: "senior", first_name, last_name },
    });
    if (uerr || !ures?.user) {
      const msg = uerr?.message ?? "User creation failed";
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers });
    }
    const newUserId = ures.user.id;

    // 4) Insert profile with PK == auth.users.id  (CRITICAL)
    const { error: perr } = await sSvc.from("profiles").insert({
      id: newUserId, // profiles.id = auth.users.id
      phone,
      first_name,
      last_name,
      email: email ?? null,
      authenticated: true,
      verified: true,
      created_at: new Date().toISOString(),
    });
    if (perr) {
      // Cleanup orphan to keep DB consistent
      await sSvc.auth.admin.deleteUser(newUserId).catch(() => {});
      return new Response(
        JSON.stringify({ error: perr.message ?? "Profile insertion failed" }),
        { status: 500, headers }
      );
    }

    // 5) Audit log (best-effort)
    await sSvc.from("admin_enroll_audit")
      .insert({ admin_id: adminId, user_id: newUserId })
      .catch(() => {});

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      status: 201,
      headers,
    });
  } catch (err: any) {
    console.error("EnrollClient Error:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal server error" }),
      { status: 500, headers }
    );
  }
});
