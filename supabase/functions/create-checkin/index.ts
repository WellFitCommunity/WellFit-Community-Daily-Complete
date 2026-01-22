// supabase/functions/create-checkin/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return handleOptions(req);

  const { headers } = corsFromRequest(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization" }), { status: 401, headers });
    }

    // ✅ SB_* env names (no "supabase" in names)
    const SB_URL = Deno.env.get("SB_URL");
    const SB_ANON_KEY = Deno.env.get("SB_ANON_KEY");
    const sb = createClient(SB_URL, SB_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });

    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid JWT" }), { status: 401, headers });
    }
    const uid = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();

    const clamp = (n: unknown, lo: number, hi: number) => {
      const x = typeof n === "number" ? n : Number(n);
      return Number.isFinite(x) && x >= lo && x <= hi ? x : null;
    };

    const label = String(body?.label ?? "Daily Self-Report").slice(0, 128);
    const is_quick = !!body?.is_quick;

    let is_emergency = !!body?.is_emergency;
    const L = label.toLowerCase();
    if (L.includes("🚨") || L.includes("injured") || L.includes("not feeling well")) is_emergency = true;

    const emotional_state =
      is_quick ? (is_emergency ? "Emergency" : "Quick Update")
               : (String(body?.emotional_state ?? "").slice(0, 64) || null);

    const payload = {
      user_id: uid,
      timestamp: now,
      label,
      is_emergency,
      emotional_state,
      heart_rate: is_quick ? null : clamp(body?.heart_rate, 30, 220),
      pulse_oximeter: is_quick ? null : clamp(body?.pulse_oximeter, 50, 100),
      bp_systolic: is_quick ? null : clamp(body?.bp_systolic, 70, 250),
      bp_diastolic: is_quick ? null : clamp(body?.bp_diastolic, 40, 150),
      glucose_mg_dl: is_quick ? null : clamp(body?.glucose_mg_dl, 40, 600),
    };

    const { error: insErr } = await sb.from("check_ins").insert(payload);
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 400, headers });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: errorMessage || "Server error" }), { status: 500, headers });
  }
});