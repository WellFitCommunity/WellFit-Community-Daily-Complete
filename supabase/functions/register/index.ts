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
    const supabaseUrlForRateLimit = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL");
    const serviceRoleKeyForRateLimit = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_ROLE");
    if (!supabaseUrlForRateLimit || !serviceRoleKeyForRateLimit) {
      console.error("CRITICAL: Missing Supabase URL or Service Role Key for rate limiting in register function.");
      return new Response(JSON.stringify({ error: "Server configuration error for rate limiting." }), { status: 500, headers });
    }
    const supabaseAdminForRateLimit = createClient(supabaseUrlForRateLimit, serviceRoleKeyForRateLimit);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      || req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || "unknown";

    if (clientIp !== "unknown") {
      // Log attempt
      const { error: logError } = await supabaseAdminForRateLimit
        .from("rate_limit_registrations")
        .insert({ ip_address: clientIp });
      if (logError) console.error("Error logging registration attempt:", logError);

      // Count attempts in window (use count only; avoid pulling rows)
      const timeWindowStart = new Date(Date.now() - TIME_WINDOW_MINUTES * 60 * 1000).toISOString();
      const { count, error: countError } = await supabaseAdminForRateLimit
        .from("rate_limit_registrations")
        .select("attempted_at", { count: "exact", head: true })
        .eq("ip_address", clientIp)
        .gte("attempted_at", timeWindowStart);
      if (countError) {
        console.error("Error checking rate limit:", countError);
        return new Response(JSON.stringify({ error: "Error checking rate limit. Please try again later." }), { status: 500, headers });
      }
      if ((count ?? 0) >= MAX_REQUESTS) {
        return new Response(JSON.stringify({ error: "Too many registration attempts. Please try again later." }), { status: 429, headers });
      }
    } else {
      console.warn("Could not determine client IP for rate limiting; allowing but logging.");
    }

    // ---------- 1) Parse and validate body ----------
    const body: RegisterBody = await req.json();

    for (const field of ["phone", "password", "first_name", "last_name"] as const) {
      const v = body[field];
      if (!v || typeof v !== "string" || !v.trim()) {
        return new Response(JSON.stringify({ error: `${field.replace("_", " ")} is required.` }), { status: 400, headers });
      }
    }

    // Minimal password policy (client should also enforce)
    const rules = [
      { r: /.{8,}/, m: "at least 8 characters" },
      { r: /[A-Z]/, m: "one uppercase letter" },
      { r: /\d/, m: "one number" },
      { r: /[^A-Za-z0-9]/, m: "one special character" },
    ];
    const missing = rules.filter(x => !x.r.test(body.password)).map(x => x.m);
    if (missing.length) {
      return new Response(JSON.stringify({ error: `Password must contain ${missing.join(", ")}.` }), { status: 400, headers });
    }

    // ---------- 2) Server-side hCaptcha verification ----------
    const hcaptchaSecret = Deno.env.get("HCAPTCHA_SECRET");
    if (!hcaptchaSecret) {
      console.error("HCAPTCHA_SECRET is not set.");
      return new Response(JSON.stringify({ error: "HCAPTCHA_SECRET is not configured." }), { status: 500, headers });
    }
    if (!body.hcaptcha_token) {
      return new Response(JSON.stringify({ error: "hCaptcha token is missing." }), { status: 400, headers });
    }

    const params = new URLSearchParams();
    params.append("secret", hcaptchaSecret);
    params.append("response", body.hcaptcha_token);
    const remoteIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip");
    if (remoteIp) params.append("remoteip", remoteIp);

    const captchaRes = await fetch(HCAPTCHA_VERIFY_URL, { method: "POST", body: params });
    const captchaData = await captchaRes.json();
    if (!captchaData?.success) {
      console.warn("hCaptcha verification failed:", captchaData);
      return new Response(JSON.stringify({ error: "hCaptcha verification failed. Please try again." }), { status: 400, headers });
    }

    // ---------- 3) Create user in Supabase Auth (no manual id) ----------
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_ROLE");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret");
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: authUserResponse, error: authError } = await supabaseAdmin.auth.admin.createUser({
      // DO NOT set a custom id here—let Supabase generate it
      phone: body.phone,
      password: body.password,
      phone_confirm: true,                     // phone is considered verified (server-side trusted)
      email: body.email || undefined,
      email_confirm: body.email ? true : undefined, // if email provided, confirm it server-side
      user_metadata: {
        role: "senior",
        first_name: body.first_name,
        last_name: body.last_name,
      },
    });

    if (authError || !authUserResponse?.user) {
      console.error("❌ Auth user creation error:", authError);
      const msg = authError?.message ?? "createUser failed";
      if (msg.includes("already") || msg.toLowerCase().includes("exists")) {
        return new Response(JSON.stringify({ error: "Phone or email already registered." }), { status: 409, headers });
      }
      throw new Error(`Failed to create authentication user: ${msg}`);
    }

    const userId = authUserResponse.user.id;
    console.log("✅ Auth user created:", userId);

    // ---------- 4) Create profile row; PK must equal auth.users.id ----------
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId, // CRITICAL: profiles.id === auth.users.id
        phone: body.phone,
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email ?? null,
        consent: Boolean(body.consent),
        phone_verified: true,
        email_verified: authUserResponse.user.email_confirmed_at ? true : false,
        created_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error("❌ Profile creation error:", profileError);
      // Clean up orphaned auth user to keep DB consistent
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (delErr) console.error("❌ Failed to delete orphaned auth user:", delErr);
      throw new Error(`Insert into profiles failed: ${profileError.message}`);
    }

    // ---------- 5) (Optional) write a consent record in a dedicated table ----------
    // If you have a 'consents' table, insert here.
    // await supabaseAdmin.from("consents").insert({ user_id: userId, version: "v1", consented_at: new Date().toISOString() });

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      status: 201,
      headers,
    });

  } catch (err) {
    console.error("❌ register error:", err);
    const errorMessage = err && typeof err === "object" && "message" in err
      ? (err as { message: string }).message
      : String(err);
    return new Response(JSON.stringify({ error: "Internal Server Error", details: errorMessage }), {
      status: 500,
      headers,
    });
  }
});
