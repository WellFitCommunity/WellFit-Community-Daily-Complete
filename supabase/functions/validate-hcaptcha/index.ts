// supabase/functions/validate-hcaptcha/index.ts
// Lightweight standalone hCaptcha token validation (siteverify only — no user creation).
// Companion to verify-hcaptcha, which does the heavier captcha+signup flow.
// Restored to repo from the live deployment and brought up to standard:
// shared CORS (no wildcard), HCAPTCHA_SECRET from env, auditLogger (no console).
import { HCAPTCHA_SECRET } from "../_shared/env.ts";
import { cors } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify";

interface HcaptchaSiteverifyResponse {
  success?: boolean;
  "error-codes"?: string[];
}

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger("validate-hcaptcha", req);

  const { headers, allowed } = cors(req.headers.get("origin"), {
    methods: ["POST", "OPTIONS"],
    allowHeaders: ["authorization", "x-client-info", "apikey", "content-type"],
    maxAge: 600,
  });
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: allowed ? 204 : 403, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (!HCAPTCHA_SECRET) {
      logger.error("HCAPTCHA_SECRET is not set");
      return new Response(
        JSON.stringify({ error: "Server misconfig: missing hCaptcha secret" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const verifyResp = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: HCAPTCHA_SECRET, response: token }),
    });
    const result = (await verifyResp.json()) as HcaptchaSiteverifyResponse;

    if (result.success === true) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    return new Response(
      JSON.stringify({ success: false, errors: result["error-codes"] ?? null }),
      { status: 403, headers: jsonHeaders },
    );
  } catch (e: unknown) {
    logger.error("validate-hcaptcha failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return new Response(JSON.stringify({ error: "Validation failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
