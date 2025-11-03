// supabase/functions/get-risk-assessments/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

// Parse allowed origins from env (comma-separated)
const allowedOrigins = (Deno.env.get("CORS_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Build CORS headers for a given request
function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allow =
    allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? "*";
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

// Safely extract patient_id from GET ?patient_id=… or POST { patient_id: "…" }
async function getPatientId(req: Request): Promise<string | null> {
  try {
    const u = new URL(req.url);
    const qs = u.searchParams.get("patient_id");
    if (qs) return qs;
  } catch {
    // ignore URL parse issues
  }
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body && typeof body.patient_id === "string") return body.patient_id;
    } catch {
      // ignore bad JSON
    }
  }
  return null;
}

serve(async (req: Request) => {
  const headers = corsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    // Required env vars
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const PHI_KEY = Deno.env.get("PHI_ENCRYPTION_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE || !PHI_KEY) {
      return new Response(
        "Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / PHI_ENCRYPTION_KEY",
        { status: 500, headers },
      );
    }

    // Server-side Supabase client
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Set the per-connection decryption key inside Postgres
    const { error: keyErr } = await supabase.rpc("set_phi_key", { k: PHI_KEY });
    if (keyErr) {
      return new Response(`Key error: ${keyErr.message}`, {
        status: 500,
        headers,
      });
    }

    const patientId = await getPatientId(req);

    // Query decrypted view
    let q = supabase
      .from("risk_assessments_decrypted")
      .select(
        "id,patient_id,assessor_id,risk_level,priority,assessment_notes,risk_factors,recommended_actions,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (patientId) q = q.eq("patient_id", patientId);

    const { data, error } = await q;
    if (error) {
      return new Response(`DB error: ${error.message}`, {
        status: 500,
        headers,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, count: data?.length ?? 0, data }),
      { headers: { "content-type": "application/json", ...headers } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Server error: ${msg}`, { status: 500, headers });
  }
});

