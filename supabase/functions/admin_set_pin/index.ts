/**
 * Admin Set PIN Edge Function
 *
 * Sets or updates the admin PIN for a user.
 *
 * Security Requirements:
 * - If user already has a PIN: Must provide current PIN (old_pin) to change
 * - OR: Must provide valid OTP token from SMS reset flow (otp_token)
 * - First-time PIN setup: No old_pin/otp_token required
 * - SMS notification sent on PIN change (if user has phone on file)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2?target=deno";
import { z } from "https://esm.sh/zod@3.23.8?target=deno";
import { cors } from "../_shared/cors.ts";
import { hashPin, verifyPin, isClientHashedPin } from "../_shared/crypto.ts";
import { createLogger } from "../_shared/auditLogger.ts";

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

const SUPABASE_URL = getEnv("SB_URL", "SUPABASE_URL");
// CRITICAL: Use legacy JWT format for RLS bypass - sb_secret_* format doesn't work with JS client
const SB_SECRET_KEY = getEnv("SB_SERVICE_ROLE_KEY", "SB_SECRET_KEY");
const TWILIO_ACCOUNT_SID = getEnv("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = getEnv("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = getEnv("TWILIO_FROM_NUMBER");

const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

const schema = z.object({
  // PIN can be:
  // 1. Client-hashed (sha256:...) - preferred, new format from updated clients
  // 2. Plain numeric (1234-12345678) - legacy format, will be deprecated
  pin: z.string().min(4, "PIN must be at least 4 characters"),
  role: z.enum([
    "admin",
    "super_admin",
    "it_admin",
    "nurse",
    "physician",
    "doctor",
    "nurse_practitioner",
    "physician_assistant",
    "clinical_supervisor",
    "department_head",
    "physical_therapist"
  ]).default("admin"),
  // Old PIN required when changing an existing PIN (unless using OTP token)
  old_pin: z.string().optional(),
  // OTP token from SMS reset flow (alternative to old_pin)
  otp_token: z.string().uuid().optional(),
});

/**
 * Hash a token using SHA-256 for comparison
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Send SMS notification via Twilio
 */
async function sendPinChangeNotification(phone: string, logger: ReturnType<typeof createLogger>): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    logger.warn("Twilio not configured for PIN change notifications");
    return false;
  }

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const form = new URLSearchParams({
      To: phone,
      From: TWILIO_FROM_NUMBER,
      Body: "Your WellFit admin PIN was recently changed. If you did not make this change, contact your administrator immediately."
    });

    const resp = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      logger.error("Failed to send PIN change notification SMS", {
        status: resp.status,
        error: errorText
      });
      return false;
    }

    logger.info("PIN change notification SMS sent successfully");
    return true;
  } catch (err) {
    logger.error("Error sending PIN change notification", {
      error: err instanceof Error ? err.message : String(err)
    });
    return false;
  }
}

serve(async (req) => {
  const logger = createLogger('admin_set_pin', req);

  const { headers, allowed } = cors(req.headers.get("origin"), {
    methods: ["POST", "OPTIONS"],
  });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!allowed) return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers });
    }

    const { pin, role, old_pin, otp_token } = parsed.data;

    let user_id: string | undefined;
    let profile: { is_admin: boolean; phone: string | null } | null = null;
    let authenticatedViaOtp = false; // Track if we used OTP for auth (skip second validation)

    // Try Bearer token authentication first
    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
    if (token) {
      const { data: u } = await supabase.auth.getUser(token);
      user_id = u?.user?.id;

      if (user_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("is_admin, phone")
          .eq("user_id", user_id)
          .single();
        profile = p;
      }
    }

    // If no valid Bearer token but OTP token provided, authenticate via OTP
    // This supports the "forgot PIN" flow where user may not have an active session
    if (!user_id && otp_token) {
      const tokenHash = await hashToken(otp_token);

      const { data: tokenRecord, error: tokenError } = await supabase
        .from('staff_pin_reset_tokens')
        .select('id, user_id, expires_at, used_at')
        .eq('token_hash', tokenHash)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!tokenError && tokenRecord) {
        user_id = tokenRecord.user_id;
        authenticatedViaOtp = true; // We validated OTP here, skip later check

        // Get profile for this user
        const { data: p } = await supabase
          .from("profiles")
          .select("is_admin, phone")
          .eq("user_id", user_id)
          .single();
        profile = p;

        // Mark token as used immediately for OTP-only auth
        await supabase
          .from('staff_pin_reset_tokens')
          .update({ used_at: new Date().toISOString() })
          .eq('id', tokenRecord.id);

        logger.info("Authenticated via OTP token for PIN reset", { userId: user_id });
      }
    }

    // Must have valid auth via one method
    if (!user_id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Admin required" }), { status: 403, headers });
    }

    // Check if user already has a PIN set for this role
    const { data: existingPin, error: pinCheckError } = await supabase
      .from("staff_pins")
      .select("pin_hash")
      .eq("user_id", user_id)
      .eq("role", role)
      .single();

    const hasExistingPin = !pinCheckError && existingPin?.pin_hash;
    let authMethod: 'old_pin' | 'otp_token' | 'first_time' = 'first_time';

    // If PIN already exists, require either old_pin or otp_token
    if (hasExistingPin) {
      if (authenticatedViaOtp) {
        // Already validated and consumed OTP token during authentication
        authMethod = 'otp_token';
        logger.info("PIN change authorized via OTP token (used for auth)", { userId: user_id, role });

      } else if (otp_token) {
        // Validate OTP token from SMS reset flow (user has valid Bearer token but using OTP to bypass old_pin)
        const tokenHash = await hashToken(otp_token);

        const { data: tokenRecord, error: tokenError } = await supabase
          .from('staff_pin_reset_tokens')
          .select('id, user_id, expires_at, used_at')
          .eq('user_id', user_id)
          .eq('token_hash', tokenHash)
          .is('used_at', null)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (tokenError || !tokenRecord) {
          logger.security("Invalid or expired OTP token for PIN change", {
            userId: user_id,
            role
          });

          return new Response(
            JSON.stringify({ error: "Invalid or expired reset token. Please request a new PIN reset." }),
            { status: 401, headers }
          );
        }

        // Mark token as used
        await supabase
          .from('staff_pin_reset_tokens')
          .update({ used_at: new Date().toISOString() })
          .eq('id', tokenRecord.id);

        authMethod = 'otp_token';
        logger.info("PIN change authorized via OTP token", { userId: user_id, role });

      } else if (old_pin) {
        // Validate old PIN
        let oldPinToVerify = old_pin;

        // Handle client-hashed old PIN
        if (!isClientHashedPin(old_pin) && !/^\d{4,8}$/.test(old_pin)) {
          return new Response(
            JSON.stringify({ error: "Current PIN must be 4-8 digits or pre-hashed format" }),
            { status: 400, headers }
          );
        }

        const oldPinValid = await verifyPin(oldPinToVerify, existingPin.pin_hash);

        if (!oldPinValid) {
          logger.security("Incorrect current PIN provided for PIN change", {
            userId: user_id,
            role
          });

          // Audit log the failed attempt
          await supabase.from('audit_logs').insert({
            user_id: user_id,
            action: 'PIN_CHANGE_FAILED',
            resource_type: 'staff_pin',
            metadata: {
              role,
              reason: 'incorrect_current_pin'
            }
          }).catch(() => {});

          return new Response(
            JSON.stringify({ error: "Current PIN is incorrect" }),
            { status: 401, headers }
          );
        }

        authMethod = 'old_pin';
        logger.info("PIN change authorized via current PIN", { userId: user_id, role });

      } else {
        // Neither old_pin nor otp_token provided
        logger.security("PIN change attempted without authorization", {
          userId: user_id,
          role
        });

        return new Response(
          JSON.stringify({
            error: "Current PIN or reset token required to change PIN",
            requires_auth: true,
            has_existing_pin: true
          }),
          { status: 401, headers }
        );
      }
    }

    // SECURITY: Handle client-hashed PINs (new format, preferred)
    // Client sends PINs pre-hashed with SHA-256 to prevent plaintext exposure in logs/transit
    // We apply PBKDF2 to the client hash for storage security
    let pinToHash = pin;
    if (!isClientHashedPin(pin)) {
      // LEGACY: Plain numeric PIN - validate format
      // This path will be deprecated once all clients are updated
      if (!/^\d{4,8}$/.test(pin)) {
        return new Response(
          JSON.stringify({ error: "PIN must be 4-8 digits or pre-hashed format" }),
          { status: 400, headers }
        );
      }
    }

    // Hash the PIN (or client-hash) with PBKDF2 for storage
    const pin_hash = await hashPin(pinToHash);

    const { error } = await supabase.from("staff_pins").upsert(
      {
        user_id,
        role,
        pin_hash,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,role',
        ignoreDuplicates: false
      }
    );

    if (error) {
      logger.error("Failed to upsert staff_pins", {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    // Audit log the successful PIN change
    await supabase.from('audit_logs').insert({
      user_id: user_id,
      action: hasExistingPin ? 'PIN_CHANGED' : 'PIN_SET',
      resource_type: 'staff_pin',
      metadata: {
        role,
        auth_method: authMethod
      }
    }).catch(() => {});

    // Send SMS notification if this was a PIN change (not first-time setup)
    if (hasExistingPin && profile.phone) {
      logger.info("Sending PIN change notification SMS", {
        userId: user_id,
        phoneLastFour: profile.phone.slice(-4)
      });

      // Send notification asynchronously (don't block response)
      sendPinChangeNotification(profile.phone, logger).catch(() => {});
    }

    logger.info("PIN updated successfully", {
      userId: user_id,
      role,
      authMethod,
      isFirstTime: !hasExistingPin
    });

    return new Response(JSON.stringify({ success: true, message: "PIN updated" }), { status: 200, headers });
  } catch (e: any) {
    logger.error("Fatal error in admin_set_pin", {
      error: e?.message ?? String(e),
      stack: e?.stack
    });
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers });
  }
});