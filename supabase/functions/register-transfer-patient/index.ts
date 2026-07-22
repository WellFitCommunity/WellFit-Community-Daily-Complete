/**
 * Register Transfer Patient Edge Function (decision D3, tracker 2026-07-22)
 *
 * Purpose: create a patient record for an EMS arrival or hospital transfer
 * when no existing profile matches. Browser code can NEVER do this
 * (auth.admin.createUser requires the service role), so both integration
 * writers call this function instead.
 *
 * Auth: caller JWT verified + clinical/admin role required + tenant scoped.
 * The created profile is stamped with the CALLER's tenant_id and flagged as
 * a temp record (user_metadata.is_temp_record) for later MPI merge.
 * Akima ratification flagged in the tracker for the temp-record policy.
 */

import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { createLogger } from "../_shared/auditLogger.ts";

interface RegisterTransferPatientRequest {
  first_name: string;
  last_name: string;
  dob?: string | null; // YYYY-MM-DD
  gender?: string | null;
  mrn?: string | null;
  source: "ems" | "hospital_transfer";
  source_reference?: string | null; // handoff/packet id for the audit trail
}

const ALLOWED_ROLES = new Set([
  "admin",
  "super_admin",
  "nurse",
  "nurse_practitioner",
  "physician",
  "case_manager",
]);

serve(async (req) => {
  const logger = createLogger("register-transfer-patient", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // 1. Require Bearer token + verify identity (never decode manually)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const admin = createClient(SUPABASE_URL ?? "", SB_SECRET_KEY ?? "", {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    // 2. Role + tenant from the caller's profile (column is user_id, never id)
    const { data: callerProfile, error: profileError } = await admin
      .from("profiles")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !callerProfile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Caller profile not found" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }
    if (!ALLOWED_ROLES.has(callerProfile.role ?? "")) {
      return new Response(
        JSON.stringify({ error: "Clinical or admin role required" }),
        { status: 403, headers: jsonHeaders },
      );
    }

    // 3. Validate input
    const body = (await req.json()) as RegisterTransferPatientRequest;
    const firstName = (body.first_name ?? "").trim();
    const lastName = (body.last_name ?? "").trim();
    if (!firstName || !lastName || !["ems", "hospital_transfer"].includes(body.source)) {
      return new Response(
        JSON.stringify({ error: "first_name, last_name, and valid source are required" }),
        { status: 400, headers: jsonHeaders },
      );
    }
    if (body.dob && !/^\d{4}-\d{2}-\d{2}$/.test(body.dob)) {
      return new Response(JSON.stringify({ error: "dob must be YYYY-MM-DD" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    // 4. If an MRN is supplied and already exists in this tenant, return the match
    if (body.mrn) {
      const { data: existing } = await admin
        .from("profiles")
        .select("user_id")
        .eq("mrn", body.mrn)
        .eq("tenant_id", callerProfile.tenant_id)
        .limit(1);
      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ success: true, patient_id: existing[0].user_id, matched: true }),
          { status: 200, headers: jsonHeaders },
        );
      }
    }

    // 5. Create the auth user (handle_new_user trigger creates the profile row)
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: `transfer-${crypto.randomUUID()}@temp.wellfit.health`,
      email_confirm: true,
      user_metadata: {
        role: "patient",
        is_temp_record: true,
        source: body.source,
        source_reference: body.source_reference ?? null,
      },
    });

    if (createError || !newUser.user) {
      logger.error("Auth user creation failed", { error: createError?.message ?? "no user" });
      return new Response(JSON.stringify({ error: "Failed to create patient record" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    // 6. Update the trigger-created profile with real demographics + caller tenant.
    //    Live vocabulary: role 'patient' <-> role_code 1 (verified 2026-07-22).
    const { error: updateError } = await admin
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        dob: body.dob ?? null,
        gender: body.gender ?? null,
        mrn: body.mrn ?? null,
        role: "patient",
        role_code: 1,
        tenant_id: callerProfile.tenant_id,
        created_by: user.id,
      })
      .eq("user_id", newUser.user.id);

    if (updateError) {
      logger.error("Profile update failed after user creation", {
        patient_id: newUser.user.id,
        error: updateError.message,
      });
      return new Response(
        JSON.stringify({ error: "Patient created but profile update failed" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    // 7. Audit (canonical columns; identity = the clinical caller)
    await admin.from("audit_logs").insert({
      actor_user_id: user.id,
      event_type: "TRANSFER_PATIENT_REGISTERED",
      metadata: {
        patient_id: newUser.user.id,
        source: body.source,
        source_reference: body.source_reference ?? null,
        tenant_id: callerProfile.tenant_id,
        temp_record: true,
      },
    });

    return new Response(
      JSON.stringify({ success: true, patient_id: newUser.user.id, matched: false }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("register-transfer-patient failed", { error: message });
    return new Response(JSON.stringify({ error: "Registration failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
