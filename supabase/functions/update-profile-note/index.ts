import { createUserClient, createAdminClient } from "../_shared/supabaseClient.ts";
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("update-profile-note");

serve(async (req) => {
  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method === "OPTIONS") return handleOptions(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Require Bearer token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Verify user identity
  const token = authHeader.replace("Bearer ", "");
  const supabase = createUserClient(authHeader);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. Check role — only admin/clinical staff can update profile notes
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_id, role_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Role IDs: 1=super_admin, 2=admin, 3=clinical, 4=member
  const allowedRoles = [1, 2, 3];
  if (!allowedRoles.includes(profile.role_id)) {
    return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { id, notes } = await req.json();

    if (!id || typeof notes !== "string") {
      return new Response(JSON.stringify({ error: "id and notes (string) are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Tenant isolation — target profile must belong to caller's tenant
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", id)
      .single();

    if (!targetProfile || targetProfile.tenant_id !== profile.tenant_id) {
      return new Response(JSON.stringify({ error: "Profile not found in your organization" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Update using user_id (profiles PK), not id
    const { error } = await admin
      .from("profiles")
      .update({ notes })
      .eq("user_id", id);

    if (error) {
      logger.error("Failed to update profile note", { targetUserId: id, error: error.message });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logger.info("Profile note updated", { actorUserId: user.id, targetUserId: id });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Unhandled error in update-profile-note", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
