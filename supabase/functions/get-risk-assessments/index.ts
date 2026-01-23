// supabase/functions/get-risk-assessments/index.ts
// SECURITY: Requires authentication and tenant-scoped access
import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

// Profile with joined role data
interface ProfileWithRole {
  tenant_id: string | null;
  is_admin: boolean;
  role_id: string | null;
  roles: { name: string } | null;
}

// Safely extract patient_id from GET ?patient_id=… or POST { patient_id: "…" }
async function getPatientId(req: Request): Promise<string | null> {
  try {
    const u = new URL(req.url);
    const qs = u.searchParams.get("patient_id");
    if (qs) return qs;
  } catch {
    // ignore URL parse issues
  }
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body && typeof body.patient_id === "string") return body.patient_id;
    } catch {
      // ignore bad JSON
    }
  }
  return null;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers } = corsFromRequest(req);

  try {
    // Required env vars
    const SUPABASE_URL = SUPABASE_URL;
    const SERVICE_ROLE = SB_SECRET_KEY;
    const PHI_KEY = Deno.env.get("PHI_ENCRYPTION_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE || !PHI_KEY) {
      return new Response(
        "Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / PHI_ENCRYPTION_KEY",
        { status: 500, headers },
      );
    }

    // Server-side Supabase client
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // =========================================================================
    // AUTHENTICATION - REQUIRED
    // =========================================================================
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { "content-type": "application/json", ...headers } },
      );
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { "content-type": "application/json", ...headers } },
      );
    }

    // Get user's profile to determine tenant and check admin/clinical role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id, is_admin, role_id, roles:role_id(name)")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 403, headers: { "content-type": "application/json", ...headers } },
      );
    }

    // Check if user has clinical/admin role (required for viewing risk assessments)
    const typedProfile = profile as ProfileWithRole;
    const roleName = typedProfile.roles?.name;
    const allowedRoles = ["admin", "super_admin", "nurse", "physician", "doctor", "case_manager", "nurse_practitioner"];
    const hasAccess = profile.is_admin || allowedRoles.includes(roleName);

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: "Access denied - clinical or admin role required" }),
        { status: 403, headers: { "content-type": "application/json", ...headers } },
      );
    }

    // Get tenant_id - required for non-super-admins
    const { data: superAdminData } = await supabase
      .from("super_admin_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const isSuperAdmin = !!superAdminData;
    const tenantId = profile.tenant_id;

    // Non-super-admins must have a tenant assigned
    if (!isSuperAdmin && !tenantId) {
      return new Response(
        JSON.stringify({ error: "No tenant assigned to user" }),
        { status: 403, headers: { "content-type": "application/json", ...headers } },
      );
    }

    // Set the per-connection decryption key inside Postgres
    const { error: keyErr } = await supabase.rpc("set_phi_key", { k: PHI_KEY });
    if (keyErr) {
      return new Response(`Key error: ${keyErr.message}`, {
        status: 500,
        headers,
      });
    }

    const patientId = await getPatientId(req);

    // =========================================================================
    // QUERY - TENANT-SCOPED
    // =========================================================================
    // Build query with tenant filtering
    let q = supabase
      .from("risk_assessments_decrypted")
      .select(
        "id,patient_id,assessor_id,risk_level,priority,assessment_notes,risk_factors,recommended_actions,created_at,tenant_id",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    // Apply tenant filter (super-admins can see all, others see their tenant only)
    if (!isSuperAdmin && tenantId) {
      q = q.eq("tenant_id", tenantId);
    }

    if (patientId) {
      // If specific patient requested, also verify they belong to user's tenant
      if (!isSuperAdmin && tenantId) {
        // Verify patient belongs to this tenant
        const { data: patientProfile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", patientId)
          .single();

        if (patientProfile && patientProfile.tenant_id !== tenantId) {
          return new Response(
            JSON.stringify({ error: "Patient does not belong to your organization" }),
            { status: 403, headers: { "content-type": "application/json", ...headers } },
          );
        }
      }
      q = q.eq("patient_id", patientId);
    }

    const { data, error } = await q;
    if (error) {
      return new Response(`DB error: ${error.message}`, {
        status: 500,
        headers,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, count: data?.length ?? 0, data }),
      { headers: { "content-type": "application/json", ...headers } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Server error: ${msg}`, { status: 500, headers });
  }
});

