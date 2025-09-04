// supabase/functions/register/index.ts
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RegisterBody {
  phone: string;
  password: string;
  first_name: string;
  last_name: string;
  email?: string;
  consent?: boolean;
  hcaptcha_token?: string;
}

// --- Rate limit window ---
const MAX_REQUESTS = 5;
const TIME_WINDOW_MINUTES = 15;

// Official hCaptcha verify endpoint
const HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify";

// ✅ Standardized env helpers (new + legacy keys supported)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_PUBLISHABLE_API_KEY =
  Deno.env.get("SB_PUBLISHABLE_API_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "";
const SUPABASE_SECRET_KEY =
  Deno.env.get("SB_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

serve(async (req: Request) => {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": req.headers.get("Origin") || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    // ---------- 0) Admin client for rate limiting ----------
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      console.error("CRITICAL: Missing Supabase URL or Secret Key for register function.");
      return new Response(
        JSON.stringify({ error: "Server configuration error." }),
        { status: 500, headers }
      );
    }
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (clientIp !== "unknown") {
      await supabaseAdmin
        .from("rate_limit_registrations")
        .insert({ ip_address: clientIp });

      const timeWindowStart = new Date(
        Date.now() - TIME_WINDOW_MINUTES * 60 * 1000
      ).toISOString();

      const { count } = await supabaseAdmin
        .from("rate_limit_registrations")
        .select("attempted_at", { count: "exact", head: true })
        .eq("ip_address", clientIp)
        .gte("attempted_at", timeWindowStart);

      if ((count ?? 0) >= MAX_REQUESTS) {
        return new Response(
          JSON.stringify({
            error: "Too many registration attempts. Please try again later.",
          }),
          { status: 429, headers }
        );
      }
    }

    // ---------- 1) Parse and validate body ----------
    const body: RegisterBody = await req.json();

    for (const field of ["phone", "password", "first_name", "last_name"] as const) {
      const v = body[field];
      if (!v || typeof v !== "string" || !v.trim()) {
        return new Response(
          JSON.stringify({ error: `${field.replace("_", " ")} is required.` }),
          { status: 400, headers }
        );
      }
    }

    const rules = [
      { r: /.{8,}/, m: "at least 8 characters" },
      { r: /[A-Z]/, m: "one uppercase letter" },
      { r: /\d/, m: "one number" },
      { r: /[^A-Za-z0-9]/, m: "one special character" },
    ];
    const missing = rules.filter((x) => !x.r.test(body.password)).map((x) => x.m);
    if (missing.length) {
      return new Response(
        JSON.stringify({ error: `Password must contain ${missing.join(", ")}.` }),
        { status: 400, headers }
      );
    }

    // ---------- 2) Server-side hCaptcha verification ----------
    const hcaptchaSecret = Deno.env.get("HCAPTCHA_SECRET");
    if (!hcaptchaSecret) {
      return new Response(
        JSON.stringify({ error: "HCAPTCHA_SECRET is not configured." }),
        { status: 500, headers }
      );
    }
    if (!body.hcaptcha_token) {
      return new Response(
        JSON.stringify({ error: "hCaptcha token is missing." }),
        { status: 400, headers }
      );
    }

    const params = new URLSearchParams();
    params.append("secret", hcaptchaSecret);
    params.append("response", body.hcaptcha_token);
    const remoteIp =
      req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip");
    if (remoteIp) params.append("remoteip", remoteIp);

    const captchaRes = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      body: params,
    });
    const captchaData = await captchaRes.json();
    if (!captchaData?.success) {
      return new Response(
        JSON.stringify({ error: "hCaptcha verification failed. Please try again." }),
        { status: 400, headers }
      );
    }

    // ---------- 3) Create user in Supabase Auth ----------
    const { data: authUserResponse, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        phone: body.phone,
        password: body.password,
        phone_confirm: true,
        email: body.email || undefined,
        email_confirm: body.email ? true : undefined,
        user_metadata: {
          role: "senior",
          first_name: body.first_name,
          last_name: body.last_name,
        },
      });

    if (authError || !authUserResponse?.user) {
      const msg = authError?.message ?? "createUser failed";
      if (msg.toLowerCase().includes("exists")) {
        return new Response(
          JSON.stringify({ error: "Phone or email already registered." }),
          { status: 409, headers }
        );
      }
      throw new Error(`Auth creation failed: ${msg}`);
    }

    const userId = authUserResponse.user.id;

    // ---------- 4) Create profile ----------
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      phone: body.phone,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email ?? null,
      consent: Boolean(body.consent),
      phone_verified: true,
      email_verified: !!authUserResponse.user.email_confirmed_at,
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Profile insert failed: ${profileError.message}`);
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      status: 201,
      headers,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        details: err?.message || String(err),
      }),
      { status: 500, headers }
    );
  }
});
