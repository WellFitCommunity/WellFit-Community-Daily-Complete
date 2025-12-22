/**
 * WellFit Verify PIN Edge Function
 *
 * Second step of WellFit admin authentication - PIN verification.
 * Validates PIN against the hash stored in super_admin_users table.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { verifyPin, generateSecureToken } from "../_shared/crypto.ts";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const SESSION_TTL_MINUTES = 120; // 2 hours for verified session

const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('wellfit-verify-pin', req);

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
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     req.headers.get('x-real-ip') || null;
    const userAgent = req.headers.get('user-agent') || null;

    const body = await req.json().catch(() => ({}));
    const { session_token, pin, validate_only } = body;

    if (!session_token) {
      return new Response(
        JSON.stringify({ error: "Session token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Find the session
    const { data: session, error: sessionError } = await supabase
      .from('admin_sessions')
      .select('id, user_id, role, admin_token, expires_at')
      .eq('admin_token', session_token)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session", valid: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      // Delete expired session
      await supabase.from('admin_sessions').delete().eq('id', session.id);
      return new Response(
        JSON.stringify({ error: "Session expired", valid: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If validate_only, just return validity
    if (validate_only) {
      return new Response(
        JSON.stringify({ valid: true, expires_at: session.expires_at }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PIN verification required
    if (!pin) {
      return new Response(
        JSON.stringify({ error: "PIN is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get admin user with PIN hash
    const { data: adminUser, error: userError } = await supabase
      .from('super_admin_users')
      .select('id, email, full_name, role, pin_hash, permissions')
      .eq('user_id', session.user_id)
      .single();

    if (userError || !adminUser) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!adminUser.pin_hash) {
      return new Response(
        JSON.stringify({ error: "PIN not configured for this account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify PIN
    const pinValid = await verifyPin(pin, adminUser.pin_hash);

    if (!pinValid) {
      logger.security("WellFit admin PIN verification failed", {
        adminId: adminUser.id,
        email: adminUser.email,
        clientIp
      });

      await supabase.from('audit_logs').insert({
        user_id: session.user_id,
        action: 'WELLFIT_ADMIN_PIN_FAILED',
        resource_type: 'wellfit_auth',
        resource_id: adminUser.id,
        metadata: { email: adminUser.email, client_ip: clientIp }
      }).catch(() => {});

      return new Response(
        JSON.stringify({ error: "Incorrect PIN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PIN verified - extend session
    const newExpiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000).toISOString();
    const newToken = generateSecureToken();

    await supabase
      .from('admin_sessions')
      .update({
        admin_token: newToken,
        expires_at: newExpiresAt
      })
      .eq('id', session.id);

    logger.info("WellFit admin PIN verified successfully", {
      adminId: adminUser.id,
      email: adminUser.email,
      clientIp,
      sessionExpiresAt: newExpiresAt
    });

    await supabase.from('audit_logs').insert({
      user_id: session.user_id,
      action: 'WELLFIT_ADMIN_PIN_SUCCESS',
      resource_type: 'wellfit_auth',
      resource_id: adminUser.id,
      metadata: { email: adminUser.email, client_ip: clientIp, session_expires: newExpiresAt }
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        session_token: newToken,
        expires_at: newExpiresAt,
        user: {
          id: adminUser.id,
          email: adminUser.email,
          full_name: adminUser.full_name,
          role: adminUser.role,
          permissions: adminUser.permissions
        },
        message: "PIN verified. Welcome to the admin portal."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in wellfit-verify-pin", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
