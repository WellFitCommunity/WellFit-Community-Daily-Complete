// supabase/functions/test-users/index.ts
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.28.0";

// ─── ENV ───────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SECRET_KEY =
  Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("Missing SUPABASE_URL or SB_SECRET_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// ─── Helper: get caller + roles ─────────────────────────────────────
async function getCaller(req: Request) {
  const hdr = req.headers.get("Authorization") || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  if (!token) return { id: null as string | null, roles: [] as string[] };

  const { data, error } = await supabase.auth.getUser(token);
  const id = data?.user?.id ?? null;
  if (error || !id) return { id: null, roles: [] };

  // Check role from profiles table instead of user_roles (simpler and more reliable)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, role_code")
    .eq("user_id", id)
    .single();

  if (!profile) return { id, roles: [] };

  // Return role as array for compatibility
  const roles = profile.role ? [profile.role] : [];
  return { id, roles };
}

// CORS Configuration
const ALLOWED_ORIGINS = [
  "https://thewellfitcommunity.org",
  "https://www.thewellfitcommunity.org",
  "https://wellfitcommunity.live",
  "https://www.wellfitcommunity.live",
  "http://localhost:3100",
  "https://localhost:3100",
  "https://houston.thewellfitcommunity.org",
  "https://miami.thewellfitcommunity.org",
  "https://phoenix.thewellfitcommunity.org",
  "https://seattle.thewellfitcommunity.org",
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : null;
  return new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
    "Access-Control-Allow-Credentials": "true",
  });
}

// ─── Function ────────────────────────────────────────────────────────
serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const headers = getCorsHeaders(origin);

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

    // 2) Generate random test user data
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const testPhone = `+1555${String(timestamp).slice(-7)}`;
    const testEmail = `test.user.${timestamp}.${random}@wellfit.test`;
    const testPassword = `TestPass${timestamp}!`;
    const firstName = `Test${random}`;
    const lastName = `User${timestamp}`;

    // 3) Create auth user
    const { data: ures, error: uerr } = await supabase.auth.admin.createUser({
      phone: testPhone,
      password: testPassword,
      email: testEmail,
      phone_confirm: true,
      email_confirm: true,
      user_metadata: { role: "senior", first_name: firstName, last_name: lastName },
    });

    if (uerr || !ures?.user) {
      const msg = uerr?.message ?? "User creation failed";
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers });
    }
    const newUserId = ures.user.id;

    // 4) Insert profile
    const { error: perr } = await supabase.from("profiles").insert({
      user_id: newUserId,
      phone: testPhone,
      first_name: firstName,
      last_name: lastName,
      email: testEmail,
      role: "senior",
      role_code: 4,
      authenticated: true,
      verified: true,
      phone_verified: true,
      demographics_complete: false,
      onboarded: false,
      is_test_user: true,
      test_tag: `auto-test-${new Date().toISOString().split('T')[0]}`,
      created_at: new Date().toISOString(),
    });

    if (perr) {
      await supabase.auth.admin.deleteUser(newUserId).catch(() => {});
      return new Response(
        JSON.stringify({ error: perr.message ?? "Profile insertion failed" }),
        { status: 500, headers }
      );
    }

    // 5) Audit log
    const { error: auditError } = await supabase.from("admin_enroll_audit")
      .insert({ admin_id: adminId, user_id: newUserId });

    if (auditError) {
      console.error("Critical: Failed to log admin enrollment for compliance:", auditError);
      await supabase.auth.admin.deleteUser(newUserId).catch(() => {});
      return new Response(
        JSON.stringify({ error: "System error: Unable to record enrollment for compliance." }),
        { status: 500, headers }
      );
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: newUserId,
      phone: testPhone,
      email: testEmail,
      password: testPassword,
      first_name: firstName,
      last_name: lastName
    }), {
      status: 201,
      headers,
    });
  } catch (err: any) {
    console.error("Test Users Error:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal server error" }),
      { status: 500, headers }
    );
  }
});
