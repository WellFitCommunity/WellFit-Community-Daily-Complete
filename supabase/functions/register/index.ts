
// supabase/functions/register/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ---------- ENV ----------
const SB_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL") || "";
const SB_SECRET_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SB_SECRET_KEY") || "";
const HCAPTCHA_SECRET = Deno.env.get("HCAPTCHA_SECRET") || "";

// ---------- CORS ----------
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

async function verifyHcaptcha(token: string): Promise<boolean> {
  try {
    const form = new URLSearchParams();
    form.set("secret", HCAPTCHA_SECRET);
    form.set("response", token);

    const response = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const result = await response.json();
    return result.success === true;
  } catch {
    return false;
  }
}

// Public roles allowed from the web form
const PUBLIC_ALLOWED = new Set([4, 5, 6, 11, 13]); // senior, volunteer, caregiver, contractor, regular
function effectiveRole(requested?: number): { role_code: number; role_slug: string } {
  const rc = PUBLIC_ALLOWED.has(requested ?? 4) ? (requested as number) : 4;
  const slug =
    rc === 4 ? "senior" :
    rc === 5 ? "volunteer" :
    rc === 6 ? "caregiver" :
    rc === 11 ? "contractor" :
    rc === 13 ? "regular" : "senior";
  return { role_code: rc, role_slug: slug };
}

// ---------- HANDLER ----------
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    if (!SB_URL || !SB_SECRET_KEY || !HCAPTCHA_SECRET) {
      console.error("[register] misconfig env", { hasUrl: !!SB_URL, hasKey: !!SB_SECRET_KEY, hasHC: !!HCAPTCHA_SECRET });
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    // Parse JSON safely
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ error: "Invalid data", details: parsed.error.errors }, 400);
    }

    const payload: RegisterInput = parsed.data;
    const phoneNumber = normalizePhone(payload.phone);

    // Captcha first
    const captchaValid = await verifyHcaptcha(payload.hcaptcha_token);
    if (!captchaValid) return jsonResponse({ error: "Captcha failed" }, 401);

    const supabase = createClient(SB_URL, SB_SECRET_KEY);

    // Enforce safe public role (defaults to senior)
    const enforced = effectiveRole(payload.role_code);

    // Create Auth user (phone_confirm: false for SMS verification)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      phone: phoneNumber,
      password: payload.password,
      phone_confirm: false,  // Changed: require SMS verification
      email: payload.email || undefined,
      email_confirm: false,
      user_metadata: {
        role_code: enforced.role_code,
        role_slug: enforced.role_slug,
        first_name: payload.first_name,
        last_name: payload.last_name,
        registration_method: "self_register",
        registered_at: new Date().toISOString(),
      },
    });

    if (authError) {
      const msg = authError.message || "";
      if (msg.includes("already exists")) {
        return jsonResponse({ error: "Account already exists" }, 409);
      }
      // 400 so client can surface actual cause in UI
      return jsonResponse({ error: "Failed to create account", details: msg }, 400);
    }

    if (!authData?.user) return jsonResponse({ error: "User creation failed" }, 500);

    // Upsert profile immediately to prevent bad defaults elsewhere
    const profileRow = {
      id: authData.user.id,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email ?? null,
      phone: phoneNumber,
      role_code: enforced.role_code,
      role_slug: enforced.role_slug,
      created_by: null,
    };

    const { error: upsertErr } = await supabase
      .from("profiles")
      .upsert(profileRow, { onConflict: "id" });

    if (upsertErr) {
      console.error("[register] profiles upsert error:", upsertErr.message);
      // Do not fail registration if profile write hiccups; auth user is created
    }

    // Send SMS verification code via Twilio
    try {
      const smsResponse = await fetch(`${SB_URL}/functions/v1/sms-send-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SB_SECRET_KEY}`
        },
        body: JSON.stringify({ phone: phoneNumber })
      });

      if (!smsResponse.ok) {
        console.error("[register] SMS send failed:", await smsResponse.text());
        // Don't fail registration if SMS fails - user can resend
      }
    } catch (smsError) {
      console.error("[register] SMS send error:", smsError);
      // Don't fail registration if SMS fails - user can resend
    }

    return jsonResponse({
      success: true,
      message: "Registration successful! Check your phone for verification code.",
      user: {
        user_id: authData.user.id,
        phone: phoneNumber,
        firstName: payload.first_name,
        lastName: payload.last_name,
        role_code: enforced.role_code,
        role_slug: enforced.role_slug,
      },
    }, 201);

  } catch (e) {
    console.error("[register] unhandled:", e);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
