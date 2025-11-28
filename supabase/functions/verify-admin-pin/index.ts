import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2?target=deno";
import { z } from "https://esm.sh/zod@3.23.8?target=deno";
import { cors } from "../_shared/cors.ts";
import { verifyPin, generateSecureToken, isClientHashedPin } from "../_shared/crypto.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SB_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_SESSION_TTL_MIN = 30; // 30 minutes for enhanced security (B2B2C healthcare platform)

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


serve(async (req: Request) => {
  const logger = createLogger('verify-admin-pin', req);

  const origin = req.headers.get("origin");
  const { headers, allowed } = cors(origin, {
    methods: ["POST", "OPTIONS"],
    allowHeaders: [
      "authorization",
      "content-type",
      "x-client-info",
      "apikey",
      "x-supabase-api-version"
    ]
  });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!allowed) return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
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
      logger.security("Admin PIN verification failed", {
        userId: user_id,
        role,
        clientIp
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
          metadata: { role }
        });
      } catch (logError) {
        // Keep console.error for audit log failures (can't log audit failure to audit log)
        console.error('[Audit Log Error]:', logError);
      }

      // TODO: Add to security_events table if multiple failed attempts from same IP
      // Check for burst of failed PIN attempts (potential brute force)

      return new Response(JSON.stringify({ error: "Incorrect PIN" }), { status: 401, headers });
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
          used_tenant_code_format: match ? true : false
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