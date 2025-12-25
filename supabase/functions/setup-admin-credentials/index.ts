/**
 * Setup Admin Credentials Edge Function
 *
 * One-time use function to set password_hash and pin_hash for super admins.
 * Call with admin secret to prevent unauthorized use.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { hashPassword, hashPin } from "../_shared/crypto.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('setup-admin-credentials', req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const SUPABASE_URL = getEnv("SB_URL", "SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = getEnv("SB_SERVICE_ROLE_KEY", "SB_SECRET_KEY");
  const SETUP_SECRET = getEnv("ADMIN_SETUP_SECRET", "ADMIN_SECRET");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing Supabase environment variables");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { secret, email, password, pin } = body;

    // Validate secret
    if (!SETUP_SECRET || secret !== SETUP_SECRET) {
      logger.security("Unauthorized setup attempt", { email });
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Find the super admin by email
    const { data: admin, error: lookupError } = await supabase
      .from('super_admin_users')
      .select('id, email, full_name')
      .ilike('email', email)
      .single();

    if (lookupError || !admin) {
      return new Response(
        JSON.stringify({ error: "Super admin not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare update object
    const updateData: Record<string, string> = {};

    if (password) {
      const passwordHash = await hashPassword(password);
      updateData.password_hash = passwordHash;
      logger.info("Password hash generated for", { email: admin.email });
    }

    if (pin) {
      const pinHash = await hashPin(pin);
      updateData.pin_hash = pinHash;
      logger.info("PIN hash generated for", { email: admin.email });
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: "No password or PIN provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the super admin
    const { error: updateError } = await supabase
      .from('super_admin_users')
      .update(updateData)
      .eq('id', admin.id);

    if (updateError) {
      logger.error("Failed to update credentials", { error: updateError.message });
      return new Response(
        JSON.stringify({ error: "Failed to update credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'ADMIN_CREDENTIALS_SET',
      resource_type: 'super_admin_users',
      resource_id: admin.id,
      metadata: {
        email: admin.email,
        password_updated: !!password,
        pin_updated: !!pin
      }
    }).catch(() => {});

    logger.info("Credentials updated successfully", {
      email: admin.email,
      passwordUpdated: !!password,
      pinUpdated: !!pin
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Credentials updated for ${admin.full_name} (${admin.email})`,
        updated: {
          password: !!password,
          pin: !!pin
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in setup-admin-credentials", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
