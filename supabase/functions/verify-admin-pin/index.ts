import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8?target=deno";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { verifyPin, generateSecureToken, isClientHashedPin } from "../_shared/crypto.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const ADMIN_SESSION_TTL_MIN = 30; // 30 minutes for enhanced security (B2B2C healthcare platform) - rebuilt 2025-12-25

// Rate limiting constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

const schema = z.object({
  // PIN can be:
  // 1. Client-hashed (sha256:...) - preferred, new format
  // 2. TenantCode-PIN format (MH-6702-1234) - legacy, parsed below
  // 3. Plain numeric (1234) - legacy, will be deprecated
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
  ]),
  // Optional: client may provide tenant code separately when using new format
  tenantCode: z.string().optional(),
  // Optional: indicates the format being used
  pinFormat: z.enum(["pin_only", "tenant_code_pin"]).optional(),
});


Deno.serve(async (req: Request) => {
  const logger = createLogger('verify-admin-pin', req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") return handleOptions(req);

  const { headers } = corsFromRequest(req);

  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    // Extract client IP for audit logging
    // NOTE: actor_ip_address column is inet type - use null instead of 'unknown' if no IP available
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     req.headers.get('x-real-ip') || null;

    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const { data: u } = await supabase.auth.getUser(token);
    const user_id = u?.user?.id;
    if (!user_id) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("user_id", user_id)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Admin required" }), { status: 403, headers });
    }

    // Rate limiting: Check if user is locked out
    const { data: lockoutData, error: lockoutError } = await supabase
      .rpc('check_pin_lockout', { p_user_id: user_id });

    if (lockoutError) {
      logger.error("Failed to check PIN lockout status", {
        userId: user_id,
        error: lockoutError.message
      });
      // Continue with verification - don't block on rate limit check failure
    } else if (lockoutData && lockoutData.length > 0 && lockoutData[0].is_locked) {
      const unlockAt = new Date(lockoutData[0].unlock_at);
      const remainingMinutes = Math.ceil((unlockAt.getTime() - Date.now()) / 60000);

      logger.security("Admin PIN verification blocked - user locked out", {
        userId: user_id,
        clientIp,
        unlockAt: unlockAt.toISOString(),
        remainingMinutes
      });

      // HIPAA AUDIT LOGGING: Log lockout block
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'ADMIN_PIN_LOCKOUT_BLOCK',
          event_category: 'AUTHENTICATION',
          actor_user_id: user_id,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'VERIFY_ADMIN_PIN',
          resource_type: 'auth_event',
          success: false,
          error_code: 'ACCOUNT_LOCKED',
          error_message: `Account locked for ${remainingMinutes} more minutes`,
          metadata: {
            unlock_at: unlockAt.toISOString(),
            remaining_minutes: remainingMinutes
          }
        });
      } catch (logError) {
        console.error('[Audit Log Error]:', logError);
      }

      return new Response(
        JSON.stringify({
          error: `Account temporarily locked. Try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
          locked_until: unlockAt.toISOString(),
          remaining_minutes: remainingMinutes
        }),
        { status: 429, headers }
      );
    }

    // Get failed attempt count for informational purposes
    const failedCount = lockoutData?.[0]?.failed_count ?? 0;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400, headers });

    let { pin, role, tenantCode, pinFormat } = parsed.data;

    // SECURITY: Handle client-hashed PINs (new format, preferred)
    // Client sends PINs pre-hashed with SHA-256 to prevent plaintext exposure in logs/transit
    const clientHashed = isClientHashedPin(pin);

    // If client provided tenantCode separately (new format), validate it
    if (tenantCode && pinFormat === 'tenant_code_pin') {
      // Verify user has a tenant and the code matches
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user_id)
        .single();

      if (!userProfile?.tenant_id) {
        return new Response(
          JSON.stringify({ error: "No tenant assigned to your account" }),
          { status: 400, headers }
        );
      }

      const { data: tenant } = await supabase
        .from("tenants")
        .select("tenant_code")
        .eq("id", userProfile.tenant_id)
        .single();

      if (tenant?.tenant_code !== tenantCode) {
        logger.security("Tenant code mismatch in PIN verification", {
          userId: user_id,
          expectedCode: tenant?.tenant_code,
          providedCode: tenantCode,
          clientIp,
          clientHashed
        });

        return new Response(
          JSON.stringify({ error: `Incorrect tenant code. Expected ${tenant?.tenant_code}` }),
          { status: 401, headers }
        );
      }
      // PIN is already separated, no further parsing needed
    }
    // LEGACY: Parse TenantCode-PIN format if present (e.g., "MH-6702-1234")
    // This handles old clients that haven't updated yet
    else if (!clientHashed) {
      const tenantCodePinPattern = /^([A-Z]{1,4})-([0-9]{4,6})-([0-9]{4,8})$/;
      const match = pin.match(tenantCodePinPattern);

      if (match) {
        // TenantCode-PIN format detected
        const tenantCodePrefix = match[1];  // e.g., "MH"
        const tenantCodeNumber = match[2];  // e.g., "6702"
        const numericPin = match[3];        // e.g., "1234"
        const inputTenantCode = `${tenantCodePrefix}-${tenantCodeNumber}`; // e.g., "MH-6702"

        // Verify user has a tenant and the code matches
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", user_id)
          .single();

        if (!userProfile?.tenant_id) {
          return new Response(
            JSON.stringify({ error: "No tenant assigned to your account" }),
            { status: 400, headers }
          );
        }

        const { data: tenant } = await supabase
          .from("tenants")
          .select("tenant_code")
          .eq("id", userProfile.tenant_id)
          .single();

        if (tenant?.tenant_code !== inputTenantCode) {
          logger.security("Tenant code mismatch in PIN verification", {
            userId: user_id,
            expectedCode: tenant?.tenant_code,
            providedCode: inputTenantCode,
            clientIp
          });

          return new Response(
            JSON.stringify({ error: `Incorrect tenant code. Expected ${tenant?.tenant_code}` }),
            { status: 401, headers }
          );
        }

        // Use only the numeric PIN portion for verification
        pin = numericPin;
      } else if (!/^\d{4,8}$/.test(pin)) {
        // Not TenantCode-PIN format and not a simple numeric PIN
        return new Response(
          JSON.stringify({ error: "PIN must be 4-8 digits or TENANTCODE-PIN format" }),
          { status: 400, headers }
        );
      }
    }

    const { data: pinRow, error: pinErr } = await supabase
      .from("staff_pins")
      .select("pin_hash")
      .eq("user_id", user_id)
      .eq("role", role)
      .single();

    if (pinErr) {
      if ((pinErr as any).code === "PGRST116") {
        return new Response(JSON.stringify({ error: "PIN not set" }), { status: 400, headers });
      }
      throw pinErr;
    }

    const valid = await verifyPin(pin, pinRow?.pin_hash);
    if (!valid) {
      // Record failed attempt for rate limiting
      const { error: recordError } = await supabase
        .rpc('record_pin_attempt', {
          p_user_id: user_id,
          p_success: false,
          p_client_ip: clientIp,
          p_user_agent: req.headers.get('user-agent')
        });

      if (recordError) {
        logger.error("Failed to record PIN attempt", {
          userId: user_id,
          error: recordError.message
        });
      }

      // Calculate remaining attempts before lockout
      const newFailedCount = failedCount + 1;
      const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - newFailedCount);

      logger.security("Admin PIN verification failed", {
        userId: user_id,
        role,
        clientIp,
        failedAttempts: newFailedCount,
        remainingAttempts
      });

      // HIPAA AUDIT LOGGING: Log failed PIN verification
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'ADMIN_PIN_VERIFICATION_FAILED',
          event_category: 'AUTHENTICATION',
          actor_user_id: user_id,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'VERIFY_ADMIN_PIN',
          resource_type: 'auth_event',
          success: false,
          error_code: 'INCORRECT_PIN',
          error_message: 'Incorrect PIN provided',
          metadata: {
            role,
            failed_attempts: newFailedCount,
            remaining_attempts: remainingAttempts
          }
        });
      } catch (logError) {
        // Keep console.error for audit log failures (can't log audit failure to audit log)
        console.error('[Audit Log Error]:', logError);
      }

      // Build error response with remaining attempts info
      const errorResponse: Record<string, unknown> = {
        error: "Incorrect PIN"
      };

      if (remainingAttempts <= 2 && remainingAttempts > 0) {
        errorResponse.warning = `${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining before temporary lockout`;
        errorResponse.remaining_attempts = remainingAttempts;
      } else if (remainingAttempts === 0) {
        errorResponse.error = `Account locked for ${LOCKOUT_DURATION_MINUTES} minutes due to too many failed attempts`;
        errorResponse.locked_until = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();
      }

      return new Response(JSON.stringify(errorResponse), { status: 401, headers });
    }

    // Record successful attempt (clears any existing lockout)
    const { error: recordError } = await supabase
      .rpc('record_pin_attempt', {
        p_user_id: user_id,
        p_success: true,
        p_client_ip: clientIp,
        p_user_agent: req.headers.get('user-agent')
      });

    if (recordError) {
      logger.error("Failed to record successful PIN attempt", {
        userId: user_id,
        error: recordError.message
      });
    }

    const expires = new Date(Date.now() + ADMIN_SESSION_TTL_MIN * 60 * 1000);
    const admin_token = generateSecureToken();

    const { error: upErr } = await supabase.from("admin_sessions").upsert({
      user_id,
      role,
      admin_token,
      expires_at: expires.toISOString(),
    });
    if (upErr) throw upErr;

    logger.info("Admin PIN verification successful", {
      userId: user_id,
      role,
      clientIp,
      sessionTtlMinutes: ADMIN_SESSION_TTL_MIN
    });

    // HIPAA AUDIT LOGGING: Log successful PIN verification and admin session creation
    try {
      await supabase.from('audit_logs').insert({
        event_type: 'ADMIN_PIN_VERIFICATION_SUCCESS',
        event_category: 'AUTHENTICATION',
        actor_user_id: user_id,
        actor_ip_address: clientIp,
        actor_user_agent: req.headers.get('user-agent'),
        operation: 'VERIFY_ADMIN_PIN',
        resource_type: 'auth_event',
        success: true,
        metadata: {
          role,
          session_expires: expires.toISOString(),
          ttl_minutes: ADMIN_SESSION_TTL_MIN,
          used_tenant_code_format: pinFormat === 'tenant_code_pin'
        }
      });
    } catch (logError) {
      // Keep console.error for audit log failures (can't log audit failure to audit log)
      console.error('[Audit Log Error]:', logError);
    }

    return new Response(
      JSON.stringify({ success: true, expires_at: expires.toISOString(), admin_token }),
      { status: 200, headers }
    );
  } catch (e: any) {
    logger.error("Fatal error in verify-admin-pin", {
      error: e?.message ?? String(e),
      stack: e?.stack
    });
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers });
  }
});