// supabase/functions/register/index.ts
// Deno Edge Function: strict CORS + hCaptcha + create user + insert profile

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore Deno ?dts
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { z, type ZodIssue } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { SB_URL, SB_SECRET_KEY, HCAPTCHA_SECRET } from "../_shared/env.ts";
import { cors } from "../_shared/cors.ts";

// ---------- CONFIG ----------
const MAX_REQUESTS = 5;
const TIME_WINDOW_MINUTES = 15;
const HCAPTCHA_VERIFY_URL =
  Deno.env.get("HCAPTCHA_VERIFY_URL") || "https://hcaptcha.com/siteverify";

// ---------- VALIDATION SCHEMA ----------
const RegisterSchema = z.object({
  phone: z.string().min(1, "Phone is required"),
  password: z.string().min(8, "Password minimum is 8"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().nullable(),
  consent: z.boolean().optional(),
  hcaptcha_token: z.string().optional(), // can also come from header
});
type RegisterBody = z.infer<typeof RegisterSchema>;

// ---------- HELPERS ----------
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

// ---------- MAIN ----------
serve(async (req: Request) => {
  const { headers, allowed } = cors(req.headers.get("origin"), {
    methods: ["POST", "OPTIONS"],
    allowHeaders: [
      "authorization",
      "x-client-info",
      "apikey",
      "content-type",
      "x-hcaptcha-token",
    ],
  });

  // Early probe
  console.log("[register] hit", {
    method: req.method,
    origin: req.headers.get("origin") ?? "",
    allowed,
  });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!allowed) return j({ error: "Origin not allowed" }, 403, headers);
  if (req.method !== "POST") return j({ error: "Method not allowed" }, 405, headers);

  try {
    console.log("[step] env");
    console.log("[env] has", {
      SB_URL: Boolean(SB_URL),
      SB_SECRET_KEY: Boolean(SB_SECRET_KEY),
      HCAPTCHA_SECRET: Boolean(HCAPTCHA_SECRET),
    });

    if (!SB_URL || !SB_SECRET_KEY) {
      console.error("Missing SB_URL or SB_SECRET_KEY");
      return j({ error: "Server misconfiguration." }, 500, headers);
    }
    if (!HCAPTCHA_SECRET) {
      console.error("Missing HCAPTCHA_SECRET");
      return j({ error: "Captcha not configured." }, 500, headers);
    }

    const admin: SupabaseClient = createClient(SB_URL, SB_SECRET_KEY);

    // ---------- RATE LIMIT ----------
    console.log("[step] rate_limit:start");
    try {
      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-real-ip") ||
        "unknown";

      if (clientIp !== "unknown") {
        const { error: logErr } = await admin
          .from("rate_limit_registrations")
          .insert({ ip_address: clientIp });
        if (logErr) console.warn("[rate_limit] insert warn:", logErr);

        const since = new Date(Date.now() - TIME_WINDOW_MINUTES * 60 * 1000).toISOString();
        const { count, error: cntErr } = await admin
          .from("rate_limit_registrations")
          .select("attempted_at", { count: "exact", head: true })
          .eq("ip_address", clientIp)
          .gte("attempted_at", since);

        if (cntErr) console.warn("[rate_limit] count warn:", cntErr);
        if ((count ?? 0) >= MAX_REQUESTS) {
          console.log("[rate_limit] blocked");
          return j({ error: "Too many registration attempts. Try again later." }, 429, headers);
        }
      }
    } catch (rlErr) {
      console.warn("[rate_limit] soft error, continuing:", rlErr);
    }

    // ---------- VALIDATE ----------
    console.log("[step] validate");
    const raw = await req.json().catch(() => ({} as Record<string, unknown>));
    const parsed = RegisterSchema.safeParse(raw);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i: ZodIssue) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return j({ error: "Validation failed", details }, 400, headers);
    }
    const body: RegisterBody = parsed.data;

    // ---------- CAPTCHA ----------
    console.log("[step] captcha");
    const token =
      (body.hcaptcha_token ?? "").trim() ||
      (req.headers.get("x-hcaptcha-token") ?? "").trim();
    if (!token) return j({ error: "hCaptcha token missing." }, 400, headers);

    const form = new URLSearchParams();
    form.set("secret", HCAPTCHA_SECRET);
    form.set("response", token);
    const remoteIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      undefined;
    if (remoteIp) form.set("remoteip", remoteIp);

    const cap = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });

    console.info("[captcha.verify] status", cap.status);

    const capJson = await cap.json().catch(() => ({} as any));
    if (!cap.ok || !capJson?.success) {
      return j(
        {
          error: "hCaptcha verification failed. Please try again.",
          detail: capJson?.["error-codes"] ?? [],
        },
        401,
        headers
      );
    }

    // ---------- AUTH.CREATE ----------
    console.log("[step] auth.create");
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
      console.error("[auth.create] error:", msg);
      return j({ error: "Unable to create account." }, 500, headers);
    }
    const userId = created.user.id;

    // ---------- PROFILE ----------
    console.log("[step] profile.insert");
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
      console.error("[profile.insert] error:", profErr);
      try { await admin.auth.admin.deleteUser(userId); } catch {}
      return j({ error: "Unable to save profile. Please try again." }, 500, headers);
    }

    console.log("[step] done");
    return j({ success: true, user_id: userId }, 201, headers);
  } catch (err) {
    console.error("[register] unhandled:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return j({ error: "Internal Server Error", details: msg }, 500, headers);
  }
});
