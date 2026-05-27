// supabase/functions/weather-proxy/index.ts
// Server-side proxy for WeatherAPI.com.
//
// Why this exists (S-OBS-1):
// WeatherAPI.com keys are per-account rate-limited and NOT public-by-design.
// Exposing the key in the browser via VITE_WEATHER_API_KEY lets anyone drain
// the account's quota. This proxy keeps the secret server-side and lets only
// authenticated callers fetch current weather for a user-supplied location.
//
// Caller contract:
//   POST /functions/v1/weather-proxy
//   Authorization: Bearer <supabase user JWT>
//   Body: { "q": "<city|lat,lon|zip>" }
//
// Response: the WeatherAPI.com /current.json payload, passed through.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { checkMCPRateLimit, type RateLimitConfig } from "../_shared/mcpRateLimiter.ts";

const logger = createLogger("weather-proxy");

const WEATHER_RATE_LIMIT: RateLimitConfig = {
  // Generous limit — weather widget polls on dashboard load + manual city changes.
  maxRequests: 60,
  windowMs: 60 * 1000,
  keyPrefix: "weather-proxy",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Verify bearer token
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing bearer token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const supabase = createClient(SUPABASE_URL!, SB_SECRET_KEY!);
  const { data: userResult, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userResult?.user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Rate limit per user (in-memory is sufficient — weather is low-cost and idempotent)
  const rl = checkMCPRateLimit(userResult.user.id, WEATHER_RATE_LIMIT);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 1000) / 1000)),
      },
    });
  }

  // 3. Read + validate body
  let body: { q?: string };
  try {
    body = (await req.json()) as { q?: string };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const q = body.q?.trim();
  if (!q) {
    return new Response(JSON.stringify({ error: "Missing q in body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // Defensive length cap — WeatherAPI accepts "city", "lat,lon", or "zip"
  if (q.length > 100) {
    return new Response(JSON.stringify({ error: "q too long" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4. Read server-side secret
  const apiKey = Deno.env.get("WEATHER_API_KEY");
  if (!apiKey) {
    logger.error("WEATHER_API_KEY not configured");
    return new Response(JSON.stringify({ error: "Weather service not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 5. Proxy to WeatherAPI.com
  try {
    const proxied = new URL("https://api.weatherapi.com/v1/current.json");
    proxied.searchParams.set("key", apiKey);
    proxied.searchParams.set("q", q);
    proxied.searchParams.set("aqi", "no");

    const response = await fetch(proxied.toString());
    const text = await response.text();

    if (!response.ok) {
      logger.warn("WeatherAPI returned non-ok", { status: response.status });
      return new Response(text, {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(text, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Weather proxy fetch failed", { error: msg });
    return new Response(JSON.stringify({ error: "Weather fetch failed" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
