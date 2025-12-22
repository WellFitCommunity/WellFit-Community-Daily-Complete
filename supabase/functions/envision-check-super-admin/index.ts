/**
 * Envision Check Super Admin Edge Function
 *
 * Verifies if the authenticated user is a super admin.
 * Returns user info and 2FA requirements.
 *
 * Used after Supabase auth login to determine if user has Envision access.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('envision-check-super-admin', req);

  // Handle CORS
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

  // Environment variables
  const SUPABASE_URL = getEnv("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = getEnv("SB_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing Supabase environment variables");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get the authorization header (Supabase access token)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    // Create Supabase client with user's token to get their identity
    const supabaseUser = createClient(SUPABASE_URL, getEnv("SUPABASE_ANON_KEY", "SB_PUBLISHABLE_KEY"), {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      logger.warn("Invalid or expired access token");
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Now use service role to check super_admin_users
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Look up super admin by user_id
    const { data: superAdmin, error: lookupError } = await supabase
      .from('super_admin_users')
      .select('id, email, full_name, role, permissions, is_active, totp_enabled, totp_secret')
      .eq('user_id', user.id)
      .single();

    if (lookupError || !superAdmin) {
      // Not a super admin - this is not an error, just means they don't have access
      logger.info("User is not a super admin", { userId: user.id, email: user.email });
      return new Response(
        JSON.stringify({
          is_super_admin: false,
          message: "This account does not have Envision portal access"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if account is active
    if (!superAdmin.is_active) {
      logger.security("Inactive super admin attempted access", {
        superAdminId: superAdmin.id,
        email: superAdmin.email
      });
      return new Response(
        JSON.stringify({
          is_super_admin: true,
          is_active: false,
          error: "Your Envision account has been deactivated"
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if TOTP is enabled
    const totpEnabled = Boolean(superAdmin.totp_enabled && superAdmin.totp_secret);

    // Update last login time
    await supabase
      .from('super_admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', superAdmin.id);

    logger.info("Super admin authenticated via Supabase", {
      superAdminId: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role,
      totpEnabled
    });

    // Audit log (fire and forget, don't block login)
    try {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'ENVISION_LOGIN_CHECK',
        resource_type: 'envision_auth',
        resource_id: superAdmin.id,
        metadata: {
          email: superAdmin.email,
          role: superAdmin.role,
          totp_enabled: totpEnabled
        }
      });
    } catch {
      // Ignore audit log errors
    }

    return new Response(
      JSON.stringify({
        is_super_admin: true,
        is_active: true,
        totp_enabled: totpEnabled,
        requires_totp: totpEnabled, // If TOTP enabled, need to verify before full access
        user: {
          id: superAdmin.id,
          email: superAdmin.email,
          full_name: superAdmin.full_name,
          role: superAdmin.role,
          permissions: superAdmin.permissions
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in envision-check-super-admin", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
