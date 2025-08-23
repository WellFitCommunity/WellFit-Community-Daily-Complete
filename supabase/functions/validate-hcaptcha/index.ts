import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body { token?: string; }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

    const { token } = (await req.json()) as Body;
    if (!token) return new Response("Missing token", { status: 400, headers: corsHeaders });

    const secret = Deno.env.get("HCAPTCHA_SECRET");
    if (!secret) return new Response("Server misconfig", { status: 500, headers: corsHeaders });

    const resp = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });

    const result = await resp.json();
    if (result.success === true) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }
    return new Response(JSON.stringify(result), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(`Error: ${e}`, { status: 500, headers: corsHeaders });
  }
});
