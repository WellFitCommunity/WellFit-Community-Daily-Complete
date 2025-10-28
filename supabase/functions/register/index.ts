
// supabase/functions/register/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { cors } from "../_shared/cors.ts";
import { hashPassword } from "../_shared/crypto.ts";

// ---------- ENV ----------
const SB_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL") || "";
const SB_SECRET_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SB_SECRET_KEY") || "";
const HCAPTCHA_SECRET = Deno.env.get("HCAPTCHA_SECRET") || "";

function getCorsHeaders(origin: string | null) {
  const { headers } = cors(origin, {
    methods: ["POST", "OPTIONS"]
  });
  return headers;
}

// ---------- VALIDATION ----------
const RegisterBase = z.object({
  phone: z.string().min(10),
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

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
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
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     req.headers.get('x-real-ip') || 'unknown';

    // Verify hCaptcha
    const captchaValid = await verifyHcaptcha(payload.hcaptcha_token);
    if (!captchaValid) {
      console.error("[register] hCaptcha verification failed for token:", payload.hcaptcha_token?.substring(0, 20) + "...");

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

    // Check if phone already exists in auth.users or pending_registrations
    const { data: existingAuth } = await supabase.auth.admin.listUsers();
    const phoneExists = existingAuth?.users?.some(u => u.phone === phoneNumber);

    if (phoneExists) {
      // HIPAA AUDIT LOGGING: Log duplicate phone registration attempt
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
          error_code: 'PHONE_ALREADY_REGISTERED',
          error_message: 'Phone number already registered',
          metadata: { phone: phoneNumber }
        });
      } catch (logError) {
        console.error('[Audit Log Error]:', logError);
      }

      return jsonResponse({ error: "Phone number already registered" }, 409, origin);
    }

    const { data: existingPending } = await supabase
      .from("pending_registrations")
      .select("phone")
      .eq("phone", phoneNumber)
      .maybeSingle();

    if (existingPending) {
      // HIPAA AUDIT LOGGING: Log duplicate pending registration attempt
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
          error_code: 'REGISTRATION_PENDING',
          error_message: 'Registration already pending for this phone number',
          metadata: { phone: phoneNumber }
        });
      } catch (logError) {
        console.error('[Audit Log Error]:', logError);
      }

      return jsonResponse({ error: "Registration already pending for this phone number. Check your SMS for verification code." }, 409, origin);
    }

    // Hash password before storing
    // Using Web Crypto API (PBKDF2) - compatible with Deno Edge Functions
    const hashedPassword = await hashPassword(payload.password);

    // Store registration data in pending table with hashed password
    const { error: pendingError } = await supabase
      .from("pending_registrations")
      .insert({
        phone: phoneNumber,
        password_hash: hashedPassword, // Store hashed password for security
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

    // Send SMS verification code via Twilio
    let smsSent = false;
    try {
      const smsResponse = await fetch(`${SB_URL}/functions/v1/sms-send-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SB_SECRET_KEY}`
        },
        body: JSON.stringify({ phone: phoneNumber })
      });

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
        const errorText = await smsResponse.text();
        console.error("[register] SMS send failed:", errorText);

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
          error_message: errorText,
          metadata: { phone: phoneNumber }
        });
      }
    } catch (smsError) {
      console.error("[register] SMS send error:", smsError);

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
        error_message: smsError instanceof Error ? smsError.message : String(smsError),
        metadata: { phone: phoneNumber }
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
      : "Registration received! You can proceed to verify your account.";

    return jsonResponse({
      success: true,
      message: message,
      pending: true,
      phone: phoneNumber,
      sms_sent: smsSent
    }, 201);

  } catch (e) {
    console.error("[register] Unhandled error:", e instanceof Error ? e.name : "Unknown");
    return jsonResponse({ error: "Internal server error" }, 500, origin);
  }
});
