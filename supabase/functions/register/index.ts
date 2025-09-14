// supabase/functions/register/index.ts
// UPDATED FOR PORT 3100 SUPPORT (final)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { z, type ZodIssue } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ---------- ENVIRONMENT & CORS ----------
// supabase/functions/register/index.ts - ENVIRONMENT VARIABLE FIX
// Just update the environment variable section at the top

const getEnv = (key: string, fallbacks: string[] = []): string => {
  const all = [key, ...fallbacks];
  for (const k of all) {
    const val = Deno.env.get(k);
    if (val?.trim()) return val.trim();
  }
  return "";
};

// FIXED: Check all possible environment variable names
const SB_URL = getEnv("SB_URL", ["SUPABASE_URL"]);
const SB_SECRET_KEY = getEnv("SB_SECRET_KEY", [
  "SUPABASE_SERVICE_ROLE_KEY", 
  "SB_SERVICE_ROLE", 
  "SUPABASE_SERVICE_ROLE", // Add this common variant
  "SERVICE_ROLE_KEY" // And this one
]);
const HCAPTCHA_SECRET = getEnv("HCAPTCHA_SECRET", ["SB_HCAPTCHA_SECRET"]);
const HCAPTCHA_VERIFY_URL = getEnv("HCAPTCHA_VERIFY_URL", ["HCAPTCHA_ENDPOINT"]) || "https://hcaptcha.com/siteverify";

// Enhanced environment logging
console.log("[Register] Environment check:", {
  SB_URL: SB_URL ? `${SB_URL.slice(0, 20)}...` : "MISSING",
  SB_SECRET_KEY: SB_SECRET_KEY ? `${SB_SECRET_KEY.slice(0, 8)}...` : "MISSING",
  HCAPTCHA_SECRET: HCAPTCHA_SECRET ? `${HCAPTCHA_SECRET.slice(0, 8)}...` : "MISSING",
  HCAPTCHA_VERIFY_URL,
});

// Add this right after environment variable setup
console.log("[DEBUG] Environment variables found:", {
  hasUrl: !!SB_URL,
  hasKey: !!SB_SECRET_KEY,
  urlStart: SB_URL?.slice(0, 20),
  keyStart: SB_SECRET_KEY?.slice(0, 20),
});

// Enhanced CORS for localhost:3100
const DEVELOPMENT_ORIGINS = [
  "http://localhost:3100",
  "https://localhost:3100",
  "http://127.0.0.1:3100",
];

const PRODUCTION_ORIGINS = getEnv("ALLOWED_ORIGINS", [])
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ALL_ALLOWED_ORIGINS = [...DEVELOPMENT_ORIGINS, ...PRODUCTION_ORIGINS];

function corsHeaders(origin: string | null): { headers: Record<string, string>; allowed: boolean } {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-hcaptcha-token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };

  let allowed = false;
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const normalizedOrigin = `${originUrl.protocol}//${originUrl.host}`;
      allowed = ALL_ALLOWED_ORIGINS.includes(normalizedOrigin);

      // Special handling for localhost development
      if (
        !allowed &&
        (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1")
      ) {
        allowed = originUrl.port === "3100";
      }

      if (allowed) {
        headers["Access-Control-Allow-Origin"] = normalizedOrigin;
      }
    } catch {
      allowed = false;
    }
  }

  console.log(`[CORS] Origin: ${origin} → Allowed: ${allowed}`);
  return { headers, allowed };
}

// ---------- VALIDATION SCHEMA ----------
const RegisterSchema = z.object({
  phone: z.string().min(10, "Phone number required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain uppercase letter")
    .regex(/\d/, "Password must contain number")
    .regex(/[^A-Za-z0-9]/, "Password must contain special character"),
  first_name: z.string().min(1, "First name required").max(50),
  last_name: z.string().min(1, "Last name required").max(50),
  email: z.string().email("Invalid email").optional().nullable(),
  consent: z.boolean().default(true),
  hcaptcha_token: z.string().min(1, "Captcha verification required"),
});

// ---------- HELPERS ----------
function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

// ---------- HCAPTCHA VERIFICATION ----------
async function verifyHcaptcha(token: string, remoteIp?: string): Promise<boolean> {
  try {
    const form = new URLSearchParams();
    form.set("secret", HCAPTCHA_SECRET);
    form.set("response", token);
    if (remoteIp) form.set("remoteip", remoteIp);

    console.log("[hCaptcha] Verifying token with endpoint:", HCAPTCHA_VERIFY_URL);

    const response = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error("[hCaptcha] HTTP error:", response.status, response.statusText);
      return false;
    }

    const result = await response.json();
    console.log("[hCaptcha] Verification result:", {
      success: result.success,
      errors: result["error-codes"],
    });

    return !!result.success;
  } catch (error) {
    console.error("[hCaptcha] Verification failed:", error);
    return false;
  }
}

// ---------- MAIN ----------
serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const { headers, allowed } = corsHeaders(origin);

  console.log(`[Register] ${req.method} request from origin: ${origin}`);

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // CORS
  if (!allowed) {
    console.warn("[Register] Blocked by CORS:", origin);
    return jsonResponse({ error: "Origin not allowed" }, 403, headers);
  }

  // Method
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  }

  try {
    // Env check
    console.log("[Register] Checking environment...");
    const envStatus = {
      SB_URL: !!SB_URL,
      SB_SECRET_KEY: !!SB_SECRET_KEY,
      HCAPTCHA_SECRET: !!HCAPTCHA_SECRET,
      HCAPTCHA_VERIFY_URL: !!HCAPTCHA_VERIFY_URL,
    };
    console.log("[Register] Environment status:", envStatus);

    if (!SB_URL || !SB_SECRET_KEY) {
      console.error("[Register] Missing critical Supabase configuration");
      return jsonResponse(
        { error: "Server configuration error", debug: "Missing SB_URL or SB_SECRET_KEY" },
        500,
        headers,
      );
    }

    if (!HCAPTCHA_SECRET) {
      console.error("[Register] Missing hCaptcha configuration");
      return jsonResponse(
        { error: "Captcha service not configured", debug: "Missing HCAPTCHA_SECRET" },
        500,
        headers,
      );
    }

    const admin: SupabaseClient = createClient(SB_URL, SB_SECRET_KEY);

    // Parse request
    console.log("[Register] Parsing request body...");
    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return jsonResponse({ error: "Invalid JSON in request body" }, 400, headers);
    }

    console.log("[Register] Request data keys:", Object.keys(rawBody));

    const validation = RegisterSchema.safeParse(rawBody);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: ZodIssue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      console.log("[Register] Validation failed:", errors);
      return jsonResponse({ error: "Validation failed", details: errors }, 400, headers);
    }

    const data = validation.data;
    const e164Phone = normalizePhone(data.phone);
    console.log("[Register] Normalized phone:", e164Phone);

    // hCaptcha
    console.log("[Register] Verifying hCaptcha...");
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const captchaValid = await verifyHcaptcha(data.hcaptcha_token, clientIp);
    if (!captchaValid) {
      console.warn("[Register] hCaptcha verification failed");
      return jsonResponse(
        { error: "Captcha verification failed. Please try again.", debug: "hCaptcha token invalid or expired" },
        401,
        headers,
      );
    }
    console.log("[Register] hCaptcha verified successfully");

    // Auth.create
    console.log("[Register] Creating user account...");
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      phone: e164Phone,
      password: data.password,
      phone_confirm: true,
      email: data.email || undefined,
      email_confirm: data.email ? false : undefined,
      user_metadata: {
        role: "senior",
        first_name: data.first_name,
        last_name: data.last_name,
        registration_method: "hcaptcha_verified",
        registered_at: new Date().toISOString(),
      },
    });

    if (authError || !authData?.user) {
      console.error("[Register] User creation failed:", authError);
      if (authError?.message?.toLowerCase().includes("already exists")) {
        return jsonResponse(
          { error: "An account with this phone number or email already exists.", debug: authError.message },
          409,
          headers,
        );
      }
      return jsonResponse(
        { error: "Unable to create account. Please try again.", debug: authError?.message || "Unknown auth error" },
        500,
        headers,
      );
    }

    const userId = authData.user.id;
    console.log("[Register] User created successfully:", userId);

    // Profile insert
    console.log("[Register] Creating profile record...");
    const { error: profileError } = await admin.from("profiles").insert({
      user_id: userId,
      phone: e164Phone,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email || null,
      consent: data.consent,
      phone_verified: true,
      email_verified: !!authData.user.email_confirmed_at,
      onboarded: false,
      force_password_change: false,
      role_id: 4, // senior
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      console.error("[Register] Profile creation failed:", profileError);
      try {
        await admin.auth.admin.deleteUser(userId);
        console.log("[Register] Cleaned up orphaned user:", userId);
      } catch (cleanupError) {
        console.error("[Register] Failed to cleanup user:", cleanupError);
      }
      return jsonResponse(
        { error: "Registration failed. Please try again.", debug: profileError.message },
        500,
        headers,
      );
    }

    console.log("[Register] Registration completed successfully for:", userId);

    return jsonResponse(
      {
        success: true,
        message: "Registration successful! You can now log in.",
        user_id: userId,
        next_step: "login",
      },
      201,
      headers,
    );
  } catch (error) {
    console.error("[Register] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: "Internal server error", debug: errorMessage }, 500, headers);
  }
});
