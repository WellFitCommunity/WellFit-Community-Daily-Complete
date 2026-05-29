// Bulk Export Edge Function — orchestrator
// Handles bulk data exports for admin users.
// SECURITY: All exports are tenant-scoped to prevent cross-tenant data leakage.
//
// Decomposed (2026-05-29): query builders → exportQueries.ts, background
// processing → exportProcessor.ts, CSV → csv.ts, FHIR Bundle → fhirBundle.ts,
// types → types.ts. This file is the HTTP handler only.

import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { createLogger } from "../_shared/auditLogger.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { buildCountQuery } from "./exportQueries.ts";
import { processExportInBackground } from "./exportProcessor.ts";
import type { ExportRequest, ProfileWithRoles } from "./types.ts";

serve(async (req) => {
  const logger = createLogger("bulk-export", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }
  const { headers: corsHeaders } = corsFromRequest(req);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const startTime = Date.now();

  try {
    const supabaseAdmin = createClient(SUPABASE_URL ?? "", SB_SECRET_KEY ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ---- Authentication ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      logger.warn("Bulk export attempted without authentication");
      return json(401, { error: "Authorization required" });
    }
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      logger.warn("Bulk export attempted with invalid token");
      return json(401, { error: "Invalid authentication token" });
    }

    // ---- Authorization (admin) ----
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id, is_admin, role_id, roles:role_id(name)")
      .eq("user_id", user.id)
      .single();
    if (profileError || !profile) {
      logger.warn("Bulk export attempted by user without profile", { userId: user.id });
      return json(403, { error: "User profile not found" });
    }

    const typedProfile = profile as ProfileWithRoles;
    const roleName = typedProfile.roles?.name ?? "";
    const isAdmin = typedProfile.is_admin || ["admin", "super_admin"].includes(roleName);
    if (!isAdmin) {
      logger.security("Bulk export denied - non-admin user", { userId: user.id });
      return json(403, { error: "Admin access required for bulk exports" });
    }

    // ---- Super-admin (cross-tenant) check ----
    const { data: superAdminData } = await supabaseAdmin
      .from("super_admin_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    const isSuperAdmin = !!superAdminData;

    // ---- Parse + validate request ----
    const body: ExportRequest = await req.json();
    const { jobId, exportType, filters, requestedBy, tenantId: requestedTenantId } = body;

    let effectiveTenantId: string;
    if (isSuperAdmin && requestedTenantId) {
      effectiveTenantId = requestedTenantId;
      logger.info("Super admin exporting for specific tenant", {
        superAdminId: user.id,
        targetTenantId: requestedTenantId,
      });
    } else if (profile.tenant_id) {
      effectiveTenantId = profile.tenant_id;
    } else {
      logger.warn("Bulk export attempted by user without tenant assignment", { userId: user.id });
      return json(403, { error: "No tenant assigned to user" });
    }

    logger.security("Bulk export requested", {
      jobId,
      exportType,
      requestedBy,
      userId: user.id,
      tenantId: effectiveTenantId,
      isSuperAdmin,
      dateRange: `${filters?.dateFrom} to ${filters?.dateTo}`,
    });

    if (!jobId || !exportType || !requestedBy) {
      logger.warn("Missing required fields in bulk export request", { jobId, exportType, requestedBy });
      return json(400, { error: "Missing required fields: jobId, exportType, requestedBy" });
    }

    // ---- Estimated record count (tenant-scoped) ----
    let estimatedRecords = 0;
    const countQuery = buildCountQuery(supabaseAdmin, exportType, filters, effectiveTenantId);
    if (countQuery === null) {
      return json(400, { error: `Unknown export type: ${exportType}` });
    }
    const { count } = await countQuery;
    estimatedRecords = count || 0;

    // ---- Create the export job (tenant-isolated) ----
    const { error: insertError } = await supabaseAdmin.from("export_jobs").insert({
      id: jobId,
      export_type: exportType,
      export_format: filters?.format ?? "json",
      status: "processing",
      progress: 0,
      total_records: estimatedRecords,
      processed_records: 0,
      filters: filters,
      user_id: user.id,
      requested_by: user.id, // the authenticated admin; client-supplied requestedBy is not trusted for the UUID column
      tenant_id: effectiveTenantId,
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    });
    if (insertError) {
      logger.error("Error creating export job", { jobId, exportType, error: insertError.message });
      return json(500, { error: "Failed to create export job", details: insertError.message });
    }

    logger.info("Export job created successfully", { jobId, exportType, estimatedRecords, requestedBy });

    // Kick off async processing (tenant-scoped).
    processExportInBackground(
      jobId,
      exportType,
      filters,
      estimatedRecords,
      effectiveTenantId,
      supabaseAdmin,
      logger,
    );

    logger.info("Bulk export initiated", {
      jobId,
      exportType,
      processingTimeMs: Date.now() - startTime,
    });

    return json(200, {
      success: true,
      jobId,
      estimatedRecords,
      message: "Export job started successfully",
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Error in bulk-export function", {
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    });
    return json(500, { error: "Internal server error", details: errorMessage });
  }
});
