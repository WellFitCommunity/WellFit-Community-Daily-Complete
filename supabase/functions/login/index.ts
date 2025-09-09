/// <reference types="jsr:@supabase/functions-js/edge-runtime" />

import { serve } from "std/http/server.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
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
  const { headers, allowed } = cors(req.headers.get("origin"), { methods: ['POST','OPTIONS'] });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!allowed) return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    // Use service role for rate-limiting table
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_ROLE");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("Missing Supabase envs for login function.");
      return new Response(JSON.stringify({ error: "Server configuration error." }), { status: 500, headers });
    }

    const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(',')[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (clientIp !== "unknown") {
      const { error: logError } = await admin.from('rate_limit_logins').insert({ ip_address: clientIp });
      if (logError) console.warn("rate_limit_logins insert failed:", logError);

      const since = new Date(Date.now() - TIME_WINDOW_MINUTES * 60 * 1000).toISOString();
      const { count, error: countError } = await admin
        .from('rate_limit_logins')
        .select('attempted_at', { count: 'exact', head: true })
        .eq('ip_address', clientIp)
        .gte('attempted_at', since);

      if (countError) {
        console.error("rate_limit_logins count failed:", countError);
        return new Response(JSON.stringify({ error: "Rate limit check failed." }), { status: 500, headers });
      }
      if ((count ?? 0) >= MAX_REQUESTS) {
        return new Response(JSON.stringify({ error: "Too many login attempts. Try again later." }), { status: 429, headers });
      }
    }

    const raw = await req.json();
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      const details = parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }));
      return new Response(JSON.stringify({ error: "Validation failed", details }), { status: 400, headers });
    }
    const { phone, password } = parsed.data;
    const e164 = toE164(phone);

    // Use anon client for GoTrue sign-in
    const supabase: SupabaseClient = createClient(supabaseUrl, anonKey);
    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      phone: e164,
      password,
    });

    if (signInError) {
      const msg = signInError.message.toLowerCase();
      let errorMessage = "Invalid phone number or password.";
      let status = 401;

      if (msg.includes("email not confirmed") || msg.includes("phone not confirmed")) {
        errorMessage = "Account not confirmed. Please check your messages.";
        status = 403;
      } else if (!msg.includes("invalid login credentials")) {
        console.error("Unexpected sign-in error:", signInError);
        errorMessage = "An error occurred during login. Please try again.";
        status = 500;
      }

      return new Response(JSON.stringify({ error: errorMessage, details: signInError.message }), { status, headers });
    }

    if (!sessionData?.session || !sessionData?.user) {
      console.error("signInWithPassword returned no error but also no session/user");
      return new Response(JSON.stringify({ error: "Login failed. Please try again." }), { status: 500, headers });
    }

    // NOTE: This function returns tokens to the client.
    // If you migrate to the Vercel BFF with HttpOnly cookies, stop returning tokens from here.
    return new Response(JSON.stringify({
      success: true,
      data: {
        userId: sessionData.user.id,
        token: sessionData.session.access_token,
        refreshToken: sessionData.session.refresh_token,
        expiresAt: sessionData.session.expires_at,
      }
    }), { status: 200, headers });

  } catch (err) {
    const detailMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Internal Server Error", details: detailMessage }), { status: 500, headers });
  }
});
