// File: supabase/functions/verify-hcaptcha/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// ── Config ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

function makeCorsHeaders(origin: string | null): HeadersInit {
  const allowOrigin =
    ALLOWED_ORIGINS.includes("*")
      ? "*"
      : origin && ALLOWED_ORIGINS.includes(origin)
        ? origin
        : "null";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

interface ReqBody { token?: string }

// ── Handler ────────────────────────────────────────────────────────────────────
serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = makeCorsHeaders(origin);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { token } = (await req.json()) as ReqBody;
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const secret = Deno.env.get("HCAPTCHA_SECRET_KEY");
    if (!secret) {
      return new Response(JSON.stringify({ error: "Server misconfig: missing HCAPTCHA_SECRET_KEY" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const verifyResp = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });

    const result = await verifyResp.json();

    if (result.success === true) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Bubble up hCaptcha error codes for debugging
    return new Response(
      JSON.stringify({ success: false, errors: result["error-codes"] ?? null }),
      { status: 403, headers: corsHeaders },
    );

  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
