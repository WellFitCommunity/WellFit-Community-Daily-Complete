/**
 * Login Security Edge Function
 *
 * Server-side security checks for login flow:
 * - Check if account is locked (pre-login)
 * - Record login attempts (success/failure)
 * - Rate limiting enforcement
 *
 * This runs server-side with service role key, so it works
 * even before user authentication (for pre-login checks).
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

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SB_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");

interface CheckLockRequest {
  action: "check_lock";
  identifier: string;
}

interface RecordAttemptRequest {
  action: "record_attempt";
  identifier: string;
  attemptType: "password" | "pin" | "mfa";
  success: boolean;
  userId?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

type RequestBody = CheckLockRequest | RecordAttemptRequest;

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger("login-security", req);

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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing Supabase environment variables");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: RequestBody = await req.json();

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get client IP from headers (set by edge runtime or proxy)
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                     req.headers.get("x-real-ip") ||
                     "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    if (body.action === "check_lock") {
      // Check if account is locked
      const { identifier } = body as CheckLockRequest;

      if (!identifier) {
        return new Response(
          JSON.stringify({ error: "Identifier required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: isLocked, error: rpcError } = await supabase.rpc("is_account_locked", {
        p_identifier: identifier,
      });

      if (rpcError) {
        logger.warn("Failed to check account lock status", {
          identifier: identifier.slice(-4),
          error: rpcError.message,
        });
        // Fail open - don't block login if check fails
        return new Response(
          JSON.stringify({ isLocked: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If locked, get lockout details
      if (isLocked) {
        const { data: lockoutData } = await supabase
          .from("account_lockouts")
          .select("locked_until, metadata")
          .eq("identifier", identifier)
          .is("unlocked_at", null)
          .gte("locked_until", new Date().toISOString())
          .single();

        if (lockoutData) {
          const lockedUntil = new Date(lockoutData.locked_until);
          const now = new Date();
          const minutesRemaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);

          logger.security("Account locked - login blocked", {
            identifierSuffix: identifier.slice(-4),
            minutesRemaining,
          });

          return new Response(
            JSON.stringify({
              isLocked: true,
              lockedUntil: lockoutData.locked_until,
              failedAttempts: lockoutData.metadata?.failed_attempts,
              minutesRemaining: Math.max(0, minutesRemaining),
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ isLocked: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (body.action === "record_attempt") {
      // Record login attempt
      const { identifier, attemptType, success, userId, errorMessage, metadata } = body as RecordAttemptRequest;

      if (!identifier || !attemptType) {
        return new Response(
          JSON.stringify({ error: "Identifier and attemptType required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: rpcError } = await supabase.rpc("record_login_attempt", {
        p_identifier: identifier,
        p_attempt_type: attemptType,
        p_success: success,
        p_user_id: userId || null,
        p_ip_address: clientIP,
        p_user_agent: userAgent,
        p_error_message: errorMessage || null,
        p_metadata: metadata || {},
      });

      if (rpcError) {
        logger.warn("Failed to record login attempt", {
          identifierSuffix: identifier.slice(-4),
          success,
          error: rpcError.message,
        });
        // Don't fail the login flow if audit logging fails
      } else {
        logger.info("Login attempt recorded", {
          identifierSuffix: identifier.slice(-4),
          attemptType,
          success,
        });
      }

      return new Response(
        JSON.stringify({ recorded: !rpcError }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Use 'check_lock' or 'record_attempt'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in login-security", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
