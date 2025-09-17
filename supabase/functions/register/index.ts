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
// 1) Define a BASE schema
const RegisterBase = z.object({
  phone: z.string().min(10),
  password: z.string().min(8),
  confirm_password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  hcaptcha_token: z.string().min(1),
});

// 2) Type from base
type RegisterInput = z.infer<typeof RegisterBase>;

// 3) Refine with a TYPED param (fixes the TS error on 'v')
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

// ---------- HANDLER ----------
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    if (!SB_URL || !SB_SECRET_KEY || !HCAPTCHA_SECRET) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ error: "Invalid data", details: parsed.error.errors }, 400);
    }

    const payload: RegisterInput = parsed.data;
    const phoneNumber = normalizePhone(payload.phone);

    const captchaValid = await verifyHcaptcha(payload.hcaptcha_token);
    if (!captchaValid) return jsonResponse({ error: "Captcha failed" }, 401);

    const supabase = createClient(SB_URL, SB_SECRET_KEY);

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      phone: phoneNumber,
      password: payload.password,
      phone_confirm: true,
      user_metadata: {
        role: "senior",
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
      return jsonResponse({ error: "Failed to create account", details: msg }, 500);
    }

    if (!authData?.user) return jsonResponse({ error: "User creation failed" }, 500);

    return jsonResponse({
      success: true,
      message: "Registration successful!",
      user: {
        user_id: authData.user.id,
        phone: phoneNumber,
        firstName: payload.first_name,
        lastName: payload.last_name,
        role: "senior",
      },
    }, 201);

  } catch (e) {
    console.error("[Register] Error:", e);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
