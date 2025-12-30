// supabase/functions/test-users/index.ts
import { SUPABASE_URL as IMPORTED_SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.28.0";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("test-users");

// ─── ENV ───────────────────────────────────────────────────────────
const SUPABASE_URL = IMPORTED_SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY =
  Deno.env.get("SB_SECRET_KEY") ?? SB_SECRET_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("Missing SUPABASE_URL or SB_SECRET_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// ─── Helper: get caller + roles (supports both Bearer token and X-Admin-Token) ─────────────────────────────────────
async function getCaller(req: Request) {
  // Check for X-Admin-Token (admin/nurse PIN-based auth)
  const adminToken = req.headers.get("X-Admin-Token");
  if (adminToken) {
    // Validate admin session token
    const { data: session, error: sessionError } = await supabase
      .from("admin_sessions")
      .select("user_id, role, expires_at")
      .eq("admin_token", adminToken)
      .single();

    if (sessionError || !session) {
      return { id: null as string | null, roles: [] as string[] };
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      return { id: null as string | null, roles: [] as string[] };
    }

    // Return admin/nurse with their role
    return { id: session.user_id, roles: [session.role] };
  }

  // Fallback to Bearer token (regular JWT auth)
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

// ─── Function ────────────────────────────────────────────────────────
// CORS handled via shared _shared/cors.ts module (white-label multi-tenant ready)
serve(async (req: Request) => {
  // Handle preflight requests using shared CORS module
  if (req.method === "OPTIONS") return handleOptions(req);

  // Get dynamic CORS headers for this request's origin
  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });

  try {
    // 1) AuthZ: must be admin or super_admin
    const { id: adminId, roles } = await getCaller(req);
    if (!adminId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const isAllowed = roles.includes("admin") || roles.includes("super_admin") || roles.includes("nurse");
    if (!isAllowed)
      return new Response(JSON.stringify({ error: "Insufficient privileges - admin, super_admin, or nurse role required" }), { status: 403, headers: corsHeaders });

    // 2) Parse request body to get optional parameters
    const body = await req.json().catch(() => ({}));
    const {
      phone: customPhone,
      password: customPassword,
      full_name: fullName,
      email: customEmail,
      test_tag: customTestTag
    } = body;

    // 3) Generate random test user data (use provided values or generate)
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const testPhone = customPhone || `+1555${String(timestamp).slice(-7)}`;
    const testEmail = customEmail || `test.user.${timestamp}.${random}@wellfit.test`;
    const testPassword = customPassword || `TestPass${timestamp}!`;

    // Parse full name if provided
    let firstName = `Test${random}`;
    let lastName = `User${timestamp}`;
    if (fullName) {
      const nameParts = String(fullName).trim().split(/\s+/);
      firstName = nameParts[0] || firstName;
      lastName = nameParts.slice(1).join(' ') || lastName;
    }

    // 4) Create auth user
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
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers: corsHeaders });
    }
    const newUserId = ures.user.id;

    // 5) Insert profile
    const { error: perr } = await supabase.from("profiles").insert({
      user_id: newUserId,
      role_id: 4,  // Explicitly set role_id to 4 (senior)
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
      test_tag: customTestTag || `auto-test-${new Date().toISOString().split('T')[0]}`,
      created_by: adminId,  // Track which staff member enrolled this patient
      created_at: new Date().toISOString(),
    });

    if (perr) {
      await supabase.auth.admin.deleteUser(newUserId).catch(() => {});
      return new Response(
        JSON.stringify({ error: perr.message ?? "Profile insertion failed" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 6) Audit log (non-blocking)
    try {
      const { error: auditError } = await supabase.from("admin_enroll_audit")
        .insert({ admin_id: adminId, user_id: newUserId });

      if (auditError) {
        logger.warn("Failed to log admin enrollment for compliance", { error: auditError.message, code: auditError.code });
        // Continue with enrollment - audit can be added via background job later
      }
    } catch (auditException: unknown) {
      const auditErrorMessage = auditException instanceof Error ? auditException.message : String(auditException);
      logger.warn("Audit logging exception", { error: auditErrorMessage });
      // Continue with enrollment
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
      headers: corsHeaders,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    logger.error("Test Users Error", { error: errorMessage, stack: err instanceof Error ? err.stack : undefined });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: corsHeaders }
    );
  }
});
