/// <reference types="jsr:@supabase/functions-js/edge-runtime" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { z, type ZodIssue } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { cors } from "../_shared/cors.ts";

const MAX_REQUESTS = 5;
const TIME_WINDOW_MINUTES = 15;

const loginSchema = z.object({
  phone: z.string().min(1, "Phone is required."),
  password: z.string().min(1, "Password is required."),
});
type LoginBody = z.infer<typeof loginSchema>;

function toE164(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

serve(async (req: Request) => {
  const { headers, allowed } = cors(req.headers.get("origin"), {
    methods: ["POST", "OPTIONS"],
    allowHeaders: ["authorization", "x-client-info", "apikey", "content-type"],
  });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!allowed) return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    const supabaseUrl =
      Deno.env.get("SB_URL") ??
      Deno.env.get("SUPABASE_URL") ??
      "";

    const serviceRoleKey =
      Deno.env.get("SB_SECRET_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SB_SERVICE_ROLE") ??
      "";

    const anonKey =
      Deno.env.get("SB_PUBLISHABLE_API_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SB_ANON_KEY") ??
      "";

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("Missing Supabase envs for login function.", {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceRoleKey,
        hasAnonKey: !!anonKey,
      });
      return new Response(JSON.stringify({ error: "Server configuration error." }), { status: 500, headers });
    }

    const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);
    const supabase: SupabaseClient = createClient(supabaseUrl, anonKey); // GoTrue auth

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // ---- Rate limiting (fail-open on logging/count errors) ----
    if (clientIp !== "unknown") {
      const { error: logError } = await admin
        .from("rate_limit_logins")
        .insert({ ip_address: clientIp });
      if (logError) console.warn("rate_limit_logins insert failed:", logError);

      const since = new Date(Date.now() - TIME_WINDOW_MINUTES * 60 * 1000).toISOString();
      const { count, error: countError } = await admin
        .from("rate_limit_logins")
        .select("attempted_at", { count: "exact", head: true })
        .eq("ip_address", clientIp)
        .gte("attempted_at", since);

      if (countError) {
        console.warn("rate_limit_logins count failed (failing open):", countError);
      } else if ((count ?? 0) >= MAX_REQUESTS) {
        return new Response(JSON.stringify({ error: "Too many login attempts. Try again later." }), { status: 429, headers });
      }
    }

    // ---- Validate body ----
    const raw = await req.json().catch(() => null);
    if (!raw) {
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), { status: 400, headers });
    }

    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      const details = parsed.error.issues.map((e: ZodIssue) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return new Response(JSON.stringify({ error: "Validation failed", details }), { status: 400, headers });
    }

    const { phone, password } = parsed.data as LoginBody;
    const e164 = toE164(phone);

    // ---- Authenticate ----
    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      phone: e164,
      password,
    });

    if (signInError) {
      const msg = signInError.message?.toLowerCase?.() ?? "";
      let errorMessage = "Invalid phone number or password.";
      let status = 401;

      if (msg.includes("email not confirmed") || msg.includes("phone not confirmed")) {
        errorMessage = "Account not confirmed. Please check your messages.";
        status = 403;
      } else if (msg.includes("too many requests")) {
        errorMessage = "Too many login attempts. Please wait before trying again.";
        status = 429;
      } else if (!msg.includes("invalid login credentials")) {
        console.error("Unexpected sign-in error:", signInError);
        errorMessage = "Login service temporarily unavailable. Please try again.";
        status = 503;
      }

      return new Response(JSON.stringify({ error: errorMessage, details: signInError.message }), { status, headers });
    }

    if (!sessionData?.session || !sessionData?.user) {
      console.error("signInWithPassword returned no error but also no session/user");
      return new Response(JSON.stringify({ error: "Login failed. Please try again." }), { status: 500, headers });
    }

    // ---- Post-login route ----
    let nextRoute = "/dashboard";
    try {
      const { data: profile, error: profileErr } = await admin
        .from("profiles")
        .select("force_password_change, onboarded, consent")
        .eq("user_id", sessionData.user.id)
        .single();

      if (!profileErr && profile) {
        if (profile.force_password_change) nextRoute = "/change-password";
        else if (!profile.consent) nextRoute = "/consent-photo";
        else if (!profile.onboarded) nextRoute = "/demographics";
      } else if (profileErr) {
        console.warn("Profile routing fetch error:", profileErr);
      }
    } catch (profileError) {
      console.warn("Profile routing unexpected error:", profileError);
    }

    // ---- Success ----
    return new Response(JSON.stringify({
      success: true,
      message: "Login successful",
      data: {
        user_id: sessionData.user.id,
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at,
        token_type: sessionData.session.token_type,
        next_route: nextRoute,
      },
    }), { status: 200, headers });

  } catch (err) {
    const detailMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Login function error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error", details: detailMessage }), { status: 500, headers });
  }
});
