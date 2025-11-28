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

// ─── Helper: get caller + roles ─────────────────────────────────────────────
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

// CORS Configuration - Explicit allowlist for security
// UPDATED 2025-10-03: Added white-label tenant subdomains
const ALLOWED_ORIGINS = [
  "https://thewellfitcommunity.org",
  "https://www.thewellfitcommunity.org",
  "https://wellfitcommunity.live",
  "https://www.wellfitcommunity.live",
  "http://localhost:3100",
  "https://localhost:3100",
  // White-label tenant subdomains
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey, X-Admin-Token",
    "Access-Control-Allow-Credentials": "true",
  });
}

// ─── Function ────────────────────────────────────────────────────────────────
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

    const isAllowed = roles.includes("admin") || roles.includes("super_admin") || roles.includes("nurse");
    if (!isAllowed)
      return new Response(JSON.stringify({ error: "Insufficient privileges - admin, super_admin, or nurse role required" }), { status: 403, headers });

    // 2) Validate input
    const body = await req.json();
    const parsed = EnrollSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), {
        status: 400,
        headers,
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
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers });
    }
    const newUserId = ures.user.id;

    // 4) Insert profile with PK == auth.users.id  (CRITICAL)
    // FIXED 2025-10-03: Changed 'id' to 'user_id' to match schema in
    // migration 20250916000000_new_init_roles_and_security.sql:5-16
    // Added all fields from EnrollSeniorPage to avoid data loss
    // FIXED 2025-10-26: Added role_id: 4 (senior) - was defaulting to 1 (admin) causing security issue
    // FIXED 2025-11-28: Added created_by to track which staff member enrolled this patient
    const { error: perr } = await supabase.from("profiles").insert({
      user_id: newUserId,  // ✅ FIXED: Was 'id', now 'user_id' (matches schema)
      role_id: 4,  // ✅ FIXED 2025-10-26: Explicitly set role_id to 4 (senior) - was missing, defaulting to 1 (admin)
      phone,
      first_name,
      last_name,
      email: email ?? null,
      dob: date_of_birth ?? null,  // Date of birth (optional)
      emergency_contact_name: emergency_contact_name ?? null,  // Next of Kin name
      emergency_contact_phone: emergency_contact_phone ?? null,  // Next of Kin phone
      caregiver_email: caregiver_email ?? null,  // Caregiver email (optional)
      admin_enrollment_notes: notes ?? null,  // Admin notes (not visible to patient)
      role: "senior",
      role_code: 4,
      authenticated: true,
      verified: true,
      phone_verified: true,  // Set to true since phone_confirm: true in auth
      demographics_complete: false,  // Will be set to true after DemographicsPage
      onboarded: false,  // Will be set to true after full onboarding
      is_test_user: is_test_user ?? false,  // Mark as test user for easy deletion
      test_tag: test_tag ?? null,  // Tag for bulk operations
      created_by: adminId,  // ✅ FIXED 2025-11-28: Track which staff member enrolled this patient
      created_at: new Date().toISOString(),
    });
    if (perr) {
      // Cleanup orphan to keep DB consistent
      await supabase.auth.admin.deleteUser(newUserId).catch(() => {});
      return new Response(
        JSON.stringify({ error: perr.message ?? "Profile insertion failed" }),
        { status: 500, headers }
      );
    }

    // 5) Audit log (required for compliance)
    // NON-BLOCKING: Don't fail enrollment if audit logging fails
    try {
      const { error: auditError } = await supabase.from("admin_enroll_audit")
        .insert({ admin_id: adminId, user_id: newUserId });

      if (auditError) {
        console.error("Warning: Failed to log admin enrollment for compliance:", auditError);
        // Continue with enrollment - audit can be added via background job later
      }
    } catch (auditException) {
      console.error("Warning: Audit logging exception:", auditException);
      // Continue with enrollment
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      status: 200,
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