// supabase/functions/verify-hcaptcha/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify";

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
}

function json(body: unknown, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors(req),
  });
}

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, req);

  try {
    const secret = Deno.env.get("HCAPTCHA_SECRET") ?? Deno.env.get("SB_HCAPTCHA_SECRET");
    if (!secret) return json({ error: "Server missing HCAPTCHA_SECRET" }, 500, req);

    const { token } = await req.json().catch(() => ({} as any));
    if (!token) return json({ error: "Missing token" }, 400, req);

    // Optional remote IP pass-through (won't hurt if absent)
    const remoteIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") || undefined;

    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);

    const resp = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return json({ error: "hCaptcha upstream error", detail: text || null }, 502, req);
    }

    const data = await resp.json();
    if (data?.success === true) return json({ success: true }, 200, req);

    return json({ success: false, errors: data?.["error-codes"] ?? null }, 403, req);
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500, req);
  }
});
