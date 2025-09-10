// supabase/functions/register/index.ts
// Deno Edge Function: strict CORS + hCaptcha + create user + insert profile

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore Deno ?dts
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { SB_URL, SB_SECRET_KEY, HCAPTCHA_SECRET } from "../_shared/env.ts";
import { cors } from "../_shared/cors.ts";

const MAX_REQUESTS = 5;
const TIME_WINDOW_MINUTES = 15;
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

function j(body: unknown, status: number, headers: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function toE164(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
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
  const { headers, allowed } = cors(req.headers.get("origin"), { methods: ["POST", "OPTIONS"] });

  // Preflight
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!allowed) return j({ error: "Origin not allowed" }, 403, headers);
  if (req.method !== "POST") return j({ error: "Method not allowed" }, 405, headers);

  try {
    if (!SB_URL || !SB_SECRET_KEY) {
      console.error("Missing SB_URL or SB_SECRET_KEY");
      return j({ error: "Server misconfiguration." }, 500, headers);
    }
    if (!HCAPTCHA_SECRET) {
      console.error("Missing HCAPTCHA_SECRET");
      return j({ error: "Captcha not configured." }, 500, headers);
    }
    const admin: SupabaseClient = createClient(SB_URL, SB_SECRET_KEY);

    // Rate limit: per IP in time window
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

      if (cntErr) return j({ error: "Rate limit check failed." }, 500, headers);
      if ((count ?? 0) >= MAX_REQUESTS) {
        return j({ error: "Too many registration attempts. Try again later." }, 429, headers);
      }
    }

    // Validate body
    const raw = await req.json();
    const parsed = RegisterSchema.safeParse(raw);
    if (!parsed.success) {
      const details = parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message }));
      return j({ error: "Validation failed", details }, 400, headers);
    }
    const body: RegisterBody = parsed.data;

    const missing = passwordMissingRules(body.password);
    if (missing.length) {
      return j({ error: `Password must contain ${missing.join(", ")}.` }, 400, headers);
    }

    // hCaptcha verify
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
      return j({ error: "hCaptcha verification failed. Please try again." }, 400, headers);
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
        return j({ error: "Phone or email already registered." }, 409, headers);
      }
      console.error("Auth create error:", msg);
      return j({ error: "Unable to create account." }, 500, headers);
    }
    const userId = created.user.id;

    // Insert profile row (✅ correct column is user_id)
    const { error: profErr } = await admin.from("profiles").insert({
      user_id: userId,
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
      return j({ error: "Unable to save profile. Please try again." }, 500, headers);
    }

    return j({ success: true, user_id: userId }, 201, headers);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("register error:", msg);
    return j({ error: "Internal Server Error", details: msg }, 500, headers);
  }
});
