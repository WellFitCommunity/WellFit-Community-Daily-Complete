// supabase/functions/enrollClient/index.ts
import { SUPABASE_URL as IMPORTED_SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.28.0";
import { z } from "https://esm.sh/zod@3.21.4";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("enrollClient");

// ─── ENV (new names with legacy fallbacks) ───────────────────────────────────
const SUPABASE_URL = IMPORTED_SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY =
  Deno.env.get("SB_SECRET_KEY") ?? SB_SECRET_KEY ?? "";
const SUPABASE_PUBLISHABLE_API_KEY =
  Deno.env.get("SB_PUBLISHABLE_API_KEY") ?? SB_PUBLISHABLE_API_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SUPABASE_PUBLISHABLE_API_KEY) {
  throw new Error("Missing SUPABASE_URL, SB_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY, or SB_PUBLISHABLE_API_KEY/SUPABASE_ANON_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// ─── Input schema ────────────────────────────────────────────────────────────
// UPDATED: 2025-10-03 - Added fields from EnrollSeniorPage.tsx
// These fields are collected during admin enrollment and should be saved
// to avoid forcing seniors to re-enter this information in DemographicsPage
const EnrollSchema = z.object({
  phone:                      z.string().regex(/^\+\d{10,15}$/, "Must be full E.164 number"),
  password:                   z.string().min(8, "Password must be at least 8 characters"),
  first_name:                 z.string().min(1, "First name required"),
  last_name:                  z.string().min(1, "Last name required"),
  email:                      z.string().email().optional(),
  // Additional fields from EnrollSeniorPage (all optional)
  date_of_birth:              z.string().optional(), // Maps to profiles.dob
  emergency_contact_name:     z.string().optional(), // Next of Kin name in UI
  emergency_contact_phone:    z.string().optional(), // Next of Kin phone in UI
  caregiver_email:            z.string().email().optional(),
  notes:                      z.string().optional(), // Admin notes, stored in admin_enrollment_notes
  // Test user fields
  is_test_user:               z.boolean().optional(), // Mark as test user for easy deletion
  test_tag:                   z.string().optional(), // Tag for bulk operations (e.g., "demo-2025")
});

// ─── Helper: get caller + roles + tenant ────────────────────────────────────
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
      return { id: null as string | null, roles: [] as string[], tenantId: null as string | null };
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      return { id: null as string | null, roles: [] as string[], tenantId: null as string | null };
    }

    // Get admin's tenant_id from their profile
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", session.user_id)
      .single();

    // Return admin/nurse with their role and tenant
    return {
      id: session.user_id,
      roles: [session.role],
      tenantId: adminProfile?.tenant_id ?? null
    };
  }

  // Fallback to Bearer token (regular JWT auth)
  const hdr = req.headers.get("Authorization") || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  if (!token) return { id: null as string | null, roles: [] as string[], tenantId: null as string | null };

  const { data, error } = await supabase.auth.getUser(token);
  const id = data?.user?.id ?? null;
  if (error || !id) return { id: null, roles: [], tenantId: null };

  // Check role and tenant from profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, role_code, tenant_id")
    .eq("user_id", id)
    .single();

  if (!profile) return { id, roles: [], tenantId: null };

  // Return role as array for compatibility
  const roles = profile.role ? [profile.role] : [];
  return { id, roles, tenantId: profile.tenant_id ?? null };
}

// ─── Function ────────────────────────────────────────────────────────────────
// CORS handled via shared _shared/cors.ts module (white-label multi-tenant ready)
serve(async (req: Request) => {
  // Handle preflight requests
  if (req.method === "OPTIONS") return handleOptions(req);

  // Get dynamic CORS headers for this request's origin
  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });

  try {
    // 1) AuthZ: must be admin or super_admin
    const { id: adminId, roles, tenantId } = await getCaller(req);
    if (!adminId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const isAllowed = roles.includes("admin") || roles.includes("super_admin") || roles.includes("nurse");
    if (!isAllowed)
      return new Response(JSON.stringify({ error: "Insufficient privileges - admin, super_admin, or nurse role required" }), { status: 403, headers: corsHeaders });

    // Require tenant_id for enrollment (patient goes into same tenant as admin)
    if (!tenantId)
      return new Response(JSON.stringify({ error: "Admin has no tenant_id - cannot enroll patients" }), { status: 400, headers: corsHeaders });

    // 2) Validate input
    const body = await req.json();
    const parsed = EnrollSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    const {
      phone,
      password,
      first_name,
      last_name,
      email,
      date_of_birth,
      emergency_contact_name,
      emergency_contact_phone,
      caregiver_email,
      notes,
      is_test_user,
      test_tag
    } = parsed.data;

    // 3) Create auth user (service role required)
    const { data: ures, error: uerr } = await supabase.auth.admin.createUser({
      phone,
      password,
      email: email || undefined,
      phone_confirm: true,
      email_confirm: email ? true : undefined,
      user_metadata: { role: "senior", first_name, last_name },
    });
    if (uerr || !ures?.user) {
      const msg = uerr?.message ?? "User creation failed";
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers: corsHeaders });
    }
    const newUserId = ures.user.id;

    // 4) Update profile created by handle_new_user trigger
    // NOTE: The handle_new_user trigger on auth.users auto-creates a basic profile.
    // We UPDATE it with the full enrollment data instead of INSERT.
    // FIXED 2026-01-03: Changed from INSERT to UPDATE to avoid duplicate key errors
    const { error: perr } = await supabase.from("profiles").update({
      tenant_id: tenantId,  // Patient inherits admin's tenant
      role_id: 4,  // Senior role
      phone,
      first_name,
      last_name,
      email: email ?? null,
      dob: date_of_birth ?? null,
      emergency_contact_name: emergency_contact_name ?? null,
      emergency_contact_phone: emergency_contact_phone ?? null,
      caregiver_email: caregiver_email ?? null,
      enrollment_notes: notes ?? null,
      enrollment_type: "app",  // Community enrollment (not hospital)
      role: "senior",
      role_code: 4,
      phone_verified: true,
      demographics_complete: false,
      onboarded: false,
      is_test_user: is_test_user ?? false,
      test_tag: test_tag ?? null,
      enrolled_by: adminId,
    }).eq("user_id", newUserId);
    if (perr) {
      // Cleanup orphan to keep DB consistent
      await supabase.auth.admin.deleteUser(newUserId).catch(() => {});
      return new Response(
        JSON.stringify({ error: perr.message ?? "Profile insertion failed" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 5) Audit log (required for compliance)
    // NON-BLOCKING: Don't fail enrollment if audit logging fails
    try {
      const { error: auditError } = await supabase.from("admin_enroll_audit")
        .insert({ admin_id: adminId, user_id: newUserId });

      if (auditError) {
        logger.warn("Failed to log admin enrollment for compliance", { error: auditError.message, code: auditError.code });
        // Continue with enrollment - audit can be added via background job later
      }
    } catch (auditException: unknown) {
      const errorMessage = auditException instanceof Error ? auditException.message : String(auditException);
      logger.warn("Audit logging exception", { error: errorMessage });
      // Continue with enrollment
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    logger.error("EnrollClient Error", { error: errorMessage, stack: err instanceof Error ? err.stack : undefined });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: corsHeaders }
    );
  }
});