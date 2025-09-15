// supabase/functions/register/index.ts
// FINAL VERSION for deployment

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const SB_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL") || "";
const SB_SECRET_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SB_SECRET_KEY") || "";
const HCAPTCHA_SECRET = Deno.env.get("HCAPTCHA_SECRET") || "";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RegisterSchema = z.object({
  phone: z.string().min(10),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  hcaptcha_token: z.string().min(1),
});

function jsonResponse(body: any, status: number) {
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    if (!SB_URL || !SB_SECRET_KEY || !HCAPTCHA_SECRET) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const body = await req.json();
    const validation = RegisterSchema.safeParse(body);
    if (!validation.success) return jsonResponse({ error: "Invalid data" }, 400);

    const data = validation.data;
    const phoneNumber = normalizePhone(data.phone);

    const captchaValid = await verifyHcaptcha(data.hcaptcha_token);
    if (!captchaValid) return jsonResponse({ error: "Captcha failed" }, 401);

    const supabase = createClient(SB_URL, SB_SECRET_KEY);

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      phone: phoneNumber,
      password: data.password,
      phone_confirm: true,
      user_metadata: {
        role: "senior",
        first_name: data.first_name,
        last_name: data.last_name,
        registration_method: "self_register",
        registered_at: new Date().toISOString(),
      },
    });

    if (authError) {
      if ((authError.message || "").includes("already exists")) {
        return jsonResponse({ error: "Account already exists" }, 409);
      }
      return jsonResponse({ error: "Failed to create account", details: authError.message }, 500);
    }

    if (!authData?.user) return jsonResponse({ error: "User creation failed" }, 500);

    return jsonResponse({
      success: true,
      message: "Registration successful!",
      user: {
        user_id: authData.user.id,
        phone: phoneNumber,
        firstName: data.first_name,
        lastName: data.last_name,
        role: "senior",
      },
    }, 201);

  } catch (e) {
    console.error("[Register] Error:", e);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
