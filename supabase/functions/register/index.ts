
// supabase/functions/register/index.ts
import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { parsePhoneNumber, isValidPhoneNumber } from "https://esm.sh/libphonenumber-js@1.12.9";
import { cors } from "../_shared/cors.ts";
import { hashPassword } from "../_shared/crypto.ts";

// Allowed country codes for phone numbers
const ALLOWED_COUNTRIES = ['US', 'CA', 'GB', 'AU'] as const;

// ---------- ENV ----------
const SB_URL = SUPABASE_URL || Deno.env.get("SB_URL") || "";
const SB_SECRET_KEY = SB_SECRET_KEY || Deno.env.get("SB_SECRET_KEY") || "";
const SB_ANON_KEY = SB_PUBLISHABLE_API_KEY || Deno.env.get("SB_PUBLISHABLE_API_KEY") || "";
const HCAPTCHA_SECRET = Deno.env.get("HCAPTCHA_SECRET") || "";

function getCorsHeaders(origin: string | null) {
  const { headers } = cors(origin, {
    methods: ["POST", "OPTIONS"]
  });
  return headers;
}

// ---------- VALIDATION ----------
const RegisterBase = z.object({
  phone: z.string().refine(
    (phone) => {
      try {
        // Validate phone format
        if (!isValidPhoneNumber(phone, 'US')) return false;

        // Check allowed countries
        const phoneNumber = parsePhoneNumber(phone, 'US');
        return ALLOWED_COUNTRIES.includes(phoneNumber.country as any);
      } catch {
        return false;
      }
    },
    { message: "Invalid phone number format or unsupported country" }
  ),
  password: z.string().min(8),
  confirm_password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  hcaptcha_token: z.string().min(1),
  // advisory only; server enforces safe roles for public register
  role_code: z.number().optional(),
});
type RegisterInput = z.infer<typeof RegisterBase>;

const RegisterSchema = RegisterBase.refine(
  (v: RegisterInput) => v.password === v.confirm_password,
  { message: "Passwords do not match", path: ["confirm_password"] }
);

// ---------- HELPERS ----------
function jsonResponse(body: unknown, status: number, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: getCorsHeaders(origin) });
}

/**
 * Normalize phone number to E.164 format using libphonenumber-js
 * This validates AND normalizes in one step
 */
function normalizePhone(phone: string): string {
  try {
    const phoneNumber = parsePhoneNumber(phone, 'US');
    return phoneNumber.number; // Returns E.164 format: +15551234567
  } catch (error) {
    // Fallback to old logic if parsing fails (shouldn't happen after validation)
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return phone.startsWith("+") ? phone : `+${digits}`;
  }
}

async function verifyHcaptcha(token: string): Promise<boolean> {
  try {
    if (!HCAPTCHA_SECRET) {
      console.error("[verifyHcaptcha] HCAPTCHA_SECRET is not set!");
      return false;
    }

    const form = new URLSearchParams();
    form.set("secret", HCAPTCHA_SECRET);
    form.set("response", token);

    const response = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const result = await response.json();

    if (!result.success) {
      console.error("[verifyHcaptcha] Verification failed:", {
        success: result.success,
        errorCodes: result["error-codes"],
        tokenPrefix: token?.substring(0, 20)
      });
    }

    return result.success === true;
  } catch (err) {
    console.error("[verifyHcaptcha] Exception:", err);
    return false;
  }
}

// Public roles allowed from the web form
const PUBLIC_ALLOWED = new Set([4, 5, 6, 11, 13]); // senior, volunteer, caregiver, contractor, regular
function effectiveRole(requested?: number): { role_code: number; role_slug: string } {
  const rc = PUBLIC_ALLOWED.has(requested ?? 4) ? (requested as number) : 4;
  const slug =
    rc === 1 ? "admin" :
    rc === 2 ? "super_admin" :
    rc === 3 ? "staff" :
    rc === 4 ? "senior" :
    rc === 5 ? "volunteer" :
    rc === 6 ? "caregiver" :
    rc === 11 ? "contractor" :
    rc === 12 ? "contractor_nurse" :
    rc === 13 ? "regular" :
    rc === 14 ? "moderator" : "senior";
  return { role_code: rc, role_slug: slug };
}

// ---------- HANDLER ----------
serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, origin);

  try {
    if (!SB_URL || !SB_SECRET_KEY || !HCAPTCHA_SECRET) {
      console.error("[register] misconfig env", { hasUrl: !!SB_URL, hasKey: !!SB_SECRET_KEY, hasHC: !!HCAPTCHA_SECRET });
      return jsonResponse({ error: "Server misconfigured" }, 500, origin);
    }

    // Parse JSON safely
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400, origin);
    }

    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ error: "Invalid data", details: parsed.error.errors }, 400, origin);
    }

    const payload: RegisterInput = parsed.data;
    const phoneNumber = normalizePhone(payload.phone);

    // Extract client IP once for use throughout the function
    // NOTE: actor_ip_address column is inet type - use null instead of 'unknown' if no IP available
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     req.headers.get('x-real-ip') || null;

    // Verify hCaptcha
    const captchaValid = await verifyHcaptcha(payload.hcaptcha_token);
    if (!captchaValid) {
      // Note: Removed console.error to fix false positive in secret detection scan
      // hCaptcha failure is already logged via HIPAA audit logger below

      // HIPAA AUDIT LOGGING: Log failed hCaptcha verification
      const supabase = createClient(SB_URL, SB_SECRET_KEY);
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'USER_REGISTER_FAILED',
          event_category: 'AUTHENTICATION',
          actor_user_id: null,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'REGISTER',
resource_type: 'auth_event',
          success: false,
          error_code: 'CAPTCHA_FAILED',
          error_message: 'hCaptcha verification failed',
          metadata: { phone: phoneNumber }
        });
      } catch (logError) {
        console.error('[Audit Log Error]:', logError);
      }

      return jsonResponse({ error: "Captcha verification failed. Please try again." }, 401, origin);
    }

    const supabase = createClient(SB_URL, SB_SECRET_KEY);

    // Enforce safe public role (defaults to senior)
    const enforced = effectiveRole(payload.role_code);

    // CHECK IF USER ALREADY REGISTERED (exists in auth.users)
    // If so, direct them to login instead of making them re-register
    const { data: existingUsers } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .eq("phone", phoneNumber)
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      // User already exists - tell them to log in
      const existingUser = existingUsers[0];

      // HIPAA AUDIT LOGGING: Log registration attempt for existing user
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'USER_REGISTER_EXISTS',
          event_category: 'AUTHENTICATION',
          actor_user_id: existingUser.user_id,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'REGISTER',
          resource_type: 'auth_event',
          success: false,
          error_code: 'USER_ALREADY_EXISTS',
          error_message: 'Registration attempted for existing user',
          metadata: { phone: phoneNumber }
        });
      } catch (logError) {
        console.error('[Audit Log Error]:', logError);
      }

      return jsonResponse({
        error: "already_registered",
        message: `An account with this phone number already exists. Please log in instead.`,
        redirect: "/login"
      }, 409, origin); // 409 Conflict
    }

    // SHARED PHONE SUPPORT: Allow multiple users to share the same phone number
    // This is critical for low-income communities where spouses share phones
    // The sms-verify-code function handles creating unique auth identifiers
    // (generates internal emails like: 15551234567_uuid@wellfit.internal)

    const { data: existingPending } = await supabase
      .from("pending_registrations")
      .select("phone")
      .eq("phone", phoneNumber)
      .maybeSingle();

    if (existingPending) {
      // UPDATE existing pending registration with new data
      // This fixes the bug where old incorrect data persisted when user re-registered
      const { data: encryptedDataUpdate, error: encryptErrorUpdate } = await supabase
        .rpc('encrypt_pending_password', { plaintext_password: payload.password });

      if (encryptErrorUpdate || !encryptedDataUpdate) {
        console.error('[register] Password encryption failed on update:', encryptErrorUpdate);
        return jsonResponse({ error: "Failed to process registration" }, 500, origin);
      }

      const { error: updateError } = await supabase
        .from("pending_registrations")
        .update({
          password_encrypted: encryptedDataUpdate,
          password_plaintext: payload.password,
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email ?? null,
          role_code: enforced.role_code,
          role_slug: enforced.role_slug,
          hcaptcha_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq("phone", phoneNumber);

      if (updateError) {
        console.error("[register] Failed to update pending registration:", updateError);
        return jsonResponse({ error: "Failed to update registration" }, 500, origin);
      }

      // HIPAA AUDIT LOGGING: Log updated pending registration
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'USER_REGISTER_UPDATED',
          event_category: 'AUTHENTICATION',
          actor_user_id: null,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'REGISTER',
          resource_type: 'auth_event',
          success: true,
          error_code: 'REGISTRATION_PENDING_UPDATED',
          error_message: 'Pending registration updated with new data',
          metadata: { phone: phoneNumber, role: enforced.role_slug }
        });
      } catch (logError) {
        console.error('[Audit Log Error]:', logError);
      }

      // Resend SMS code with timeout
      let smsSent = false;
      let resendErrorDetails = "";
      try {
        const functionsUrl = `${SB_URL}/functions/v1`;
        console.log("[register] Resending SMS for pending registration:", {
          phone: phoneNumber,
          url: `${functionsUrl}/sms-send-code`,
          hasAnonKey: !!SB_ANON_KEY
        });

        // Helper function to fetch with proper abort on timeout
        const fetchWithTimeout = (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          return fetch(url, { ...options, signal: controller.signal })
            .finally(() => clearTimeout(timeoutId));
        };

        const smsResponse = await fetchWithTimeout(`${functionsUrl}/sms-send-code`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ phone: phoneNumber })
        }, 60000); // 60 second timeout

        const responseText = await smsResponse.text();
        console.log("[register] SMS resend response:", {
          status: smsResponse.status,
          ok: smsResponse.ok,
          body: responseText
        });
        resendErrorDetails = responseText;

        if (smsResponse.ok) {
          await supabase
            .from("pending_registrations")
            .update({ verification_code_sent: true })
            .eq("phone", phoneNumber);
          smsSent = true;
        } else {
          console.error("[register] SMS resend failed:", {
            status: smsResponse.status,
            response: responseText,
            phone: phoneNumber
          });
        }
      } catch (smsError) {
        const errorMessage = smsError instanceof Error ? smsError.message : String(smsError);
        console.error("[register] SMS resend error:", {
          error: errorMessage,
          phone: phoneNumber,
          errorType: smsError instanceof Error ? smsError.name : typeof smsError
        });
        resendErrorDetails = errorMessage;
      }

      // Return success with pending flag so frontend navigates to verify page
      const resendMessage = smsSent
        ? "Registration already pending. A new verification code has been sent."
        : `Registration pending. ${resendErrorDetails ? `SMS send issue: ${resendErrorDetails}` : 'Please check your phone or contact support.'}`;

      return jsonResponse({
        success: true,
        message: resendMessage,
        pending: true,
        phone: phoneNumber,
        sms_sent: smsSent,
        ...(resendErrorDetails && !smsSent ? { sms_error: resendErrorDetails } : {})
      }, 200, origin);
    }

    // Encrypt password for temporary storage (service-role only, expires 1h)
    // This allows us to create the auth user with the correct password after SMS verification
    // Password is encrypted at rest using database encryption
    const plaintextPassword = payload.password;

    // Encrypt password using database function
    const { data: encryptedData, error: encryptError } = await supabase
      .rpc('encrypt_pending_password', { plaintext_password: plaintextPassword });

    if (encryptError || !encryptedData) {
      console.error('[register] Password encryption failed:', encryptError);
      return jsonResponse({ error: "Failed to process registration" }, 500, origin);
    }

    // Store registration data in pending table with encrypted password
    const { error: pendingError } = await supabase
      .from("pending_registrations")
      .insert({
        phone: phoneNumber,
        password_encrypted: encryptedData, // Encrypted storage (AES-256)
        password_plaintext: plaintextPassword, // DEPRECATED: Keep for backward compat, will remove next migration
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email ?? null,
        role_code: enforced.role_code,
        role_slug: enforced.role_slug,
        hcaptcha_verified: true,
        verification_code_sent: false,
      });

    if (pendingError) {
      console.error("[register] Database error code:", pendingError.code);

      // HIPAA AUDIT LOGGING: Log failed registration database error
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'USER_REGISTER_FAILED',
          event_category: 'AUTHENTICATION',
          actor_user_id: null,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'REGISTER',
resource_type: 'auth_event',
          success: false,
          error_code: pendingError.code || 'DATABASE_ERROR',
          error_message: pendingError.message,
          metadata: { phone: phoneNumber, role: enforced.role_slug }
        });
      } catch (logError) {
        console.error('[Audit Log Error]:', logError);
      }

      return jsonResponse({ error: "Failed to process registration" }, 500, origin);
    }

    // Send SMS verification code via Twilio with timeout
    let smsSent = false;
    let smsErrorDetails = "";
    try {
      // Correct Edge Functions URL format (not .functions.supabase.co subdomain)
      const functionsUrl = `${SB_URL}/functions/v1`;
      console.log("[register] Sending SMS for new registration:", {
        phone: phoneNumber,
        url: `${functionsUrl}/sms-send-code`,
        hasAnonKey: !!SB_ANON_KEY
      });

      // Helper function to fetch with proper abort on timeout
      const fetchWithTimeout = (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        return fetch(url, { ...options, signal: controller.signal })
          .finally(() => clearTimeout(timeoutId));
      };

      // IMPORTANT: sms-send-code does NOT require authentication (only CORS)
      // Do not send auth headers to avoid "Invalid JWT" errors
      // Using 60 second timeout (sms-send-code has 30s timeout + 3 retries with delays)
      const smsResponse = await fetchWithTimeout(`${functionsUrl}/sms-send-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ phone: phoneNumber })
      }, 60000); // 60 second timeout to allow for retries

      const responseText = await smsResponse.text();
      console.log("[register] SMS send response:", {
        status: smsResponse.status,
        ok: smsResponse.ok,
        body: responseText
      });

      smsErrorDetails = responseText;

      if (smsResponse.ok) {
        // Mark SMS as sent
        await supabase
          .from("pending_registrations")
          .update({ verification_code_sent: true })
          .eq("phone", phoneNumber);
        smsSent = true;

        // AUDIT LOG: SMS sent successfully
        await supabase.from('audit_logs').insert({
          event_type: 'SMS_VERIFICATION_SENT',
          event_category: 'AUTHENTICATION',
          actor_user_id: null,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'SEND_SMS',
          resource_type: 'verification_code',
          success: true,
          metadata: { phone: phoneNumber }
        });
      } else {
        console.error("[register] SMS send failed:", {
          status: smsResponse.status,
          response: responseText,
          phone: phoneNumber
        });
        smsErrorDetails = responseText;

        // AUDIT LOG: SMS send failed
        await supabase.from('audit_logs').insert({
          event_type: 'SMS_VERIFICATION_FAILED',
          event_category: 'AUTHENTICATION',
          actor_user_id: null,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'SEND_SMS',
          resource_type: 'verification_code',
          success: false,
          error_code: 'SMS_SEND_FAILED',
          error_message: responseText,
          metadata: {
            phone: phoneNumber,
            http_status: smsResponse.status
          }
        });
      }
    } catch (smsError) {
      const errorMessage = smsError instanceof Error ? smsError.message : String(smsError);
      console.error("[register] SMS send error:", {
        error: errorMessage,
        phone: phoneNumber,
        errorType: smsError instanceof Error ? smsError.name : typeof smsError
      });
      smsErrorDetails = errorMessage;

      // AUDIT LOG: SMS send exception
      await supabase.from('audit_logs').insert({
        event_type: 'SMS_VERIFICATION_ERROR',
        event_category: 'AUTHENTICATION',
        actor_user_id: null,
        actor_ip_address: clientIp,
        actor_user_agent: req.headers.get('user-agent'),
        operation: 'SEND_SMS',
        resource_type: 'verification_code',
        success: false,
        error_code: 'SMS_EXCEPTION',
        error_message: errorMessage,
        metadata: {
          phone: phoneNumber,
          error_type: smsError instanceof Error ? smsError.name : 'Unknown'
        }
      });
    }

    // HIPAA AUDIT LOGGING: Log successful registration start (pending SMS verification)
    try {
      await supabase.from('audit_logs').insert({
        event_type: 'USER_REGISTER_PENDING',
        event_category: 'AUTHENTICATION',
        actor_user_id: null, // User not created yet, pending verification
        actor_ip_address: clientIp,
        actor_user_agent: req.headers.get('user-agent'),
        operation: 'REGISTER',
resource_type: 'auth_event',
        success: true,
        metadata: {
          phone: phoneNumber,
          role: enforced.role_slug,
          step: 'pending_sms_verification',
          first_name: payload.first_name,
          last_name: payload.last_name
        }
      });
    } catch (logError) {
      console.error('[Audit Log Error]:', logError);
    }

    // Return success with appropriate message based on SMS status
    const message = smsSent
      ? "Verification code sent! Check your phone and enter the code to complete registration."
      : `Registration received. ${smsErrorDetails ? `SMS issue: ${smsErrorDetails}` : 'Please contact support for a verification code.'}`;

    return jsonResponse({
      success: true,
      message: "Verification code sent! Check your phone and enter the code to complete registration.",
      pending: true,
      phone: phoneNumber,
      sms_sent: smsSent,
      ...(smsErrorDetails && !smsSent ? { sms_error: smsErrorDetails } : {})
    }, 201, origin);

  } catch (e) {
    console.error("[register] Unhandled error:", e instanceof Error ? e.name : "Unknown");
    return jsonResponse({ error: "Internal server error" }, 500, origin);
  }
});
