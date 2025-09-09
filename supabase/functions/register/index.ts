import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
// @ts-ignore Deno types via ?dts are fine at runtime
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { SUPABASE_URL, SB_SECRET_KEY, HCAPTCHA_SECRET } from "../_shared/env.ts";
import { cors } from "../_shared/cors.ts";

const MAX_REQUESTS = 5;          // attempts per IP
const TIME_WINDOW_MINUTES = 15;  // minutes
const HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify";

const RegisterSchema = z.object({
  phone: z.string().min(1, "Phone is required"),
  password: z.string().min(8, "Password minimum is 8"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().nullable(),
  consent: z.boolean().optional(),
  hcaptcha_token: z.string().min(1, "hCaptcha token is required"),
});
type RegisterBody = z.infer<typeof RegisterSchema>;

function toE164(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}
function passwordMissingRules(pw: string): string[] {
  const rules = [
    { r: /.{8,}/, m: "at least 8 characters" },
    { r: /[A-Z]/, m: "one uppercase letter" },
    { r: /\d/, m: "one number" },
    { r: /[^A-Za-z0-9]/, m: "one special character" },
  ];
  return rules.filter(x => !x.r.test(pw)).map(x => x.m);
}

serve(async (req: Request) => {
  const { headers, allowed } = cors(req.headers.get("origin"), { methods: ['POST','OPTIONS'] });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!allowed) return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    if (!SUPABASE_URL || !SB_SECRET_KEY) {
      console.error("Missing SUPABASE_URL or SB_SECRET_KEY");
      return new Response(JSON.stringify({ error: "Server misconfiguration." }), { status: 500, headers });
    }
    if (!HCAPTCHA_SECRET) {
      console.error("Missing SB_HCAPTCHA_SECRET");
      return new Response(JSON.stringify({ error: "Captcha not configured." }), { status: 500, headers });
    }
    const admin: SupabaseClient = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Rate limit per IP
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (clientIp !== "unknown") {
      const { error: logErr } = await admin.from("rate_limit_registrations").insert({ ip_address: clientIp });
      if (logErr) console.warn("rate_limit_registrations insert failed:", logErr);

      const since = new Date(Date.now() - TIME_WINDOW_MINUTES * 60 * 1000).toISOString();
      const { count, error: cntErr } = await admin
        .from("rate_limit_registrations")
        .select("attempted_at", { count: "exact", head: true })
        .eq("ip_address", clientIp)
        .gte("attempted_at", since);

      if (cntErr) return new Response(JSON.stringify({ error: "Rate limit check failed." }), { status: 500, headers });
      if ((count ?? 0) >= MAX_REQUESTS) {
        return new Response(JSON.stringify({ error: "Too many registration attempts. Try again later." }), { status: 429, headers });
      }
    }

    // Validate body
    const raw: unknown = await req.json();
    const parsed = RegisterSchema.safeParse(raw);
    if (!parsed.success) {
      const details = parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message }));
      return new Response(JSON.stringify({ error: "Validation failed", details }), { status: 400, headers });
    }
    const body: RegisterBody = parsed.data;

    const missing = passwordMissingRules(body.password);
    if (missing.length) {
      return new Response(JSON.stringify({ error: `Password must contain ${missing.join(", ")}.` }), { status: 400, headers });
    }

    // hCaptcha
    const form = new URLSearchParams();
    form.set("secret", HCAPTCHA_SECRET);
    form.set("response", body.hcaptcha_token);
    const remoteIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      undefined;
    if (remoteIp) form.set("remoteip", remoteIp);

    const cap = await fetch(HCAPTCHA_VERIFY_URL, { method: "POST", body: form });
    const capJson = await cap.json();
    if (!capJson?.success) {
      return new Response(JSON.stringify({ error: "hCaptcha verification failed. Please try again." }), { status: 400, headers });
    }

    // Create user (confirmed)
    const e164 = toE164(body.phone);
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      phone: e164,
      password: body.password,
      phone_confirm: true,
      email: body.email ?? undefined,
      email_confirm: body.email ? true : undefined,
      user_metadata: {
        role: "senior",
        first_name: body.first_name,
        last_name: body.last_name,
      },
    });
    if (authErr || !created?.user) {
      const msg = authErr?.message ?? "Auth createUser failed";
      if (msg.toLowerCase().includes("exists")) {
        return new Response(JSON.stringify({ error: "Phone or email already registered." }), { status: 409, headers });
      }
      console.error("Auth create error:", msg);
      return new Response(JSON.stringify({ error: "Unable to create account." }), { status: 500, headers });
    }
    const userId = created.user.id;

    // Insert profile row (your columns kept)
    const { error: profErr } = await admin.from("profiles").insert({
      id: userId,
      phone: e164,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email ?? null,
      consent: Boolean(body.consent),
      phone_verified: true,
      email_verified: !!created.user.email_confirmed_at,
      created_at: new Date().toISOString(),
    });
    if (profErr) {
      console.error("Profile insert failed:", profErr);
      await admin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: "Unable to save profile. Please try again." }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), { status: 201, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "Internal Server Error", details: msg }), { status: 500, headers });
  }
});
