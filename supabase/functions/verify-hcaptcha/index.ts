// supabase/functions/verify-hcaptcha/index.ts
// Deno Edge Function: strict CORS + hCaptcha + create user + insert profile (US-only, E.164 locked: +1XXXXXXXXXX)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { SB_URL, SB_SECRET_KEY, HCAPTCHA_SECRET } from "../_shared/env.ts";
import { cors } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const MAX_REQUESTS = 5;
const TIME_WINDOW_MINUTES = 15;
const HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify";

// NOTE: hcaptcha_token optional in body; also accepted via header
const RegisterSchema = z.object({
  phone: z.string().min(1, "Phone is required"),
  password: z.string().min(8, "Password minimum is 8"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().nullable(),
  consent: z.boolean().optional(),
  hcaptcha_token: z.string().optional()
});
type RegisterBody = z.infer<typeof RegisterSchema>;

function j(body: unknown, status: number, headers: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

/**
 * Normalize to **US E.164** exclusively.
 * Returns: +1XXXXXXXXXX (12–char string)
 * Throws if not a valid US 10-digit number optionally prefixed with +1 / 1.
 */
function toE164_US(input: string): string {
  const digits = (input || "").replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (input.startsWith("+1") && digits.length === 11) return `+${digits}`;
  throw new Error("Phone must be a valid US number (10 digits) or E.164 +1 format.");
}

function passwordMissingRules(pw: string): string[] {
  const rules = [
    { r: /.{8,}/, m: "at least 8 characters" },
    { r: /[A-Z]/, m: "one uppercase letter" },
    { r: /\d/, m: "one number" },
    { r: /[^A-Za-z0-9]/, m: "one special character" }
  ];
  return rules.filter(x => !x.r.test(pw)).map(x => x.m);
}

export default async function handler(req: Request): Promise<Response> {
  const logger = createLogger('verify-hcaptcha', req);

  const { headers, allowed } = cors(req.headers.get("origin"), {
    methods: ["POST", "OPTIONS"],
    allowHeaders: ["authorization", "x-client-info", "apikey", "content-type", "x-hcaptcha-token"]
  });

  // Preflight
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!allowed) return j({ error: "Origin not allowed" }, 403, headers);
  if (req.method !== "POST") return j({ error: "Method not allowed" }, 405, headers);

  try {
    if (!SB_URL || !SB_SECRET_KEY) {
      logger.error("Missing Supabase configuration", {
        hasUrl: Boolean(SB_URL),
        hasKey: Boolean(SB_SECRET_KEY)
      });
      return j({ error: "Server misconfiguration." }, 500, headers);
    }
    if (!HCAPTCHA_SECRET) {
      logger.error("Missing hCaptcha secret configuration");
      return j({ error: "Captcha not configured." }, 500, headers);
    }

    const admin: SupabaseClient = createClient(SB_URL, SB_SECRET_KEY);

    // Rate limit: per IP
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (clientIp !== "unknown") {
      const { error: logErr } = await admin.from("rate_limit_registrations").insert({ ip_address: clientIp });
      if (logErr) logger.warn("Rate limit logging failed", {
        error: logErr.message,
        clientIp
      });

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

    // Parse & validate
    const raw = await req.json().catch(() => ({}));
    const parsed = RegisterSchema.safeParse(raw);

    if (!parsed.success) {
      const details = parsed.error.issues.map((i: any) => ({
        path: (i.path as (string | number)[]).map(String).join("."),
        message: i.message
      }));
      return j({ error: "Validation failed", details }, 400, headers);
    }

    const body: RegisterBody = parsed.data;

    // Canonicalize phone to **+1XXXXXXXXXX**
    let e164: string;
    try {
      e164 = toE164_US(body.phone);
    } catch (e) {
      return j({ error: (e as Error).message }, 400, headers);
    }

    // hCaptcha token (body or header)
    const token = (body.hcaptcha_token ?? req.headers.get("x-hcaptcha-token") ?? "").trim();
    if (!token) return j({ error: "hCaptcha token missing." }, 400, headers);

    // Password complexity
    const missing = passwordMissingRules(body.password);
    if (missing.length) {
      return j({ error: `Password must contain ${missing.join(", ")}.` }, 400, headers);
    }

    // Verify hCaptcha
    const form = new URLSearchParams();
    form.set("secret", HCAPTCHA_SECRET);
    form.set("response", token);
    const remoteIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      undefined;
    if (remoteIp) form.set("remoteip", remoteIp);

    const cap = await fetch(HCAPTCHA_VERIFY_URL, { method: "POST", body: form });
    const capJson = await cap.json().catch(() => ({}));
    if (!cap.ok || !capJson?.success) {
      logger.security("hCaptcha verification failed", {
        phone: e164,
        clientIp,
        errorCodes: capJson?.["error-codes"] ?? [],
        httpStatus: cap.status
      });
      return j(
        { error: "hCaptcha verification failed. Please try again.", detail: capJson?.["error-codes"] ?? [] },
        401,
        headers
      );
    }

    // Create auth user with **E.164** phone (keeps +1)
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      phone: e164,
      password: body.password,
      phone_confirm: true,
      email: body.email ?? undefined,
      email_confirm: body.email ? true : undefined,
      user_metadata: {
        role: "senior",
        first_name: body.first_name,
        last_name: body.last_name
      }
    });
    if (authErr || !created?.user) {
      const msg = authErr?.message ?? "Auth createUser failed";
      if (msg.toLowerCase().includes("exists")) {
        logger.warn("Registration attempted with existing phone/email", {
          phone: e164,
          email: body.email,
          clientIp
        });
        return j({ error: "Phone or email already registered." }, 409, headers);
      }
      logger.error("User account creation failed", {
        phone: e164,
        email: body.email,
        error: msg,
        clientIp
      });
      return j({ error: "Unable to create account." }, 500, headers);
    }
    const userId = created.user.id;

    // Insert profile row with the same **E.164** phone
    const { error: profErr } = await admin.from("profiles").insert({
      user_id: userId,
      phone: e164,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email ?? null,
      consent: Boolean(body.consent),
      phone_verified: true,
      email_verified: !!created.user.email_confirmed_at
      // created_at: new Date().toISOString() // include only if your schema has it
    });
    if (profErr) {
      logger.error("Profile creation failed, rolling back user", {
        userId,
        phone: e164,
        email: body.email,
        error: profErr.message,
        clientIp
      });
      await admin.auth.admin.deleteUser(userId);
      return j({ error: "Unable to save profile. Please try again." }, 500, headers);
    }

    logger.info("User registration completed successfully", {
      userId,
      phone: e164,
      email: body.email,
      firstName: body.first_name,
      lastName: body.last_name,
      clientIp
    });

    return j({ success: true, user_id: userId, phone: e164 }, 201, headers);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Fatal error in verify-hcaptcha", {
      error: msg,
      stack: err instanceof Error ? err.stack : undefined
    });
    return j({ error: "Internal Server Error", details: msg }, 500, headers);
  }
}
