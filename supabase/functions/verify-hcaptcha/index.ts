// supabase/functions/verify-hcaptcha/index.ts
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify";

/** Minimal CORS (no external imports) */
function cors(origin: string | null): Headers {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes("*")
    ? "*"
    : (origin && allowed.includes(origin) ? origin : "");
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", allowOrigin || "*");
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  h.set("Content-Type", "application/json");
  return h;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);

  // Preflight
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers
    });
  }

  try {
    const secret =
      Deno.env.get("SB_HCAPTCHA_SECRET") || Deno.env.get("HCAPTCHA_SECRET");
    if (!secret) {
      return new Response(JSON.stringify({ error: "Server misconfig: SB_HCAPTCHA_SECRET not set" }), {
        status: 500, headers
      });
    }

    const { token } = await req.json().catch(() => ({} as any));
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400, headers
      });
    }

    const remoteIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      undefined;

    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (remoteIp) form.set("remoteip", remoteIp);

    const resp = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form
    });
    const json = await resp.json();

    if (json?.success === true) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }
    return new Response(
      JSON.stringify({ success: false, errors: json?.["error-codes"] ?? null }),
      { status: 403, headers }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers
    });
  }
});

