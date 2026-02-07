// supabase/functions/create-checkin/index.ts
// Creates a check-in record in public.check_ins with tenant isolation.
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

    // ✅ SB_* env names with fallbacks
    const SB_URL = Deno.env.get("SB_URL") || Deno.env.get("SUPABASE_URL");
    const SB_ANON_KEY = Deno.env.get("SB_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    const sb = createClient(SB_URL!, SB_ANON_KEY!, {
      global: { headers: { Authorization: auth } },
    });

    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid JWT" }), { status: 401, headers });
    }
    const uid = userData.user.id;

    // Resolve tenant_id from user profile (required — check_ins.tenant_id is NOT NULL)
    const { data: profileData, error: profileErr } = await sb
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", uid)
      .single();

    if (profileErr || !profileData?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Unable to resolve tenant for user" }),
        { status: 400, headers },
      );
    }
    const tenant_id = profileData.tenant_id;

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();

    const clamp = (n: unknown, lo: number, hi: number) => {
      const x = typeof n === "number" ? n : Number(n);
      return Number.isFinite(x) && x >= lo && x <= hi ? x : null;
    };

    const safeStr = (val: unknown, maxLen: number): string | null => {
      if (val == null || val === "") return null;
      return String(val).slice(0, maxLen);
    };

    const label = String(body?.label ?? "Daily Self-Report").slice(0, 128);
    const is_quick = !!body?.is_quick;

    let is_emergency = !!body?.is_emergency;
    const L = label.toLowerCase();
    if (L.includes("🚨") || L.includes("injured") || L.includes("not feeling well")) is_emergency = true;

    const emotional_state =
      is_quick ? (is_emergency ? "Emergency" : "Quick Update")
               : (String(body?.emotional_state ?? "").slice(0, 64) || null);

    const payload: Record<string, unknown> = {
      user_id: uid,
      tenant_id,
      timestamp: now,
      label,
      is_emergency,
      emotional_state,
      heart_rate: is_quick ? null : clamp(body?.heart_rate, 30, 220),
      pulse_oximeter: is_quick ? null : clamp(body?.pulse_oximeter, 50, 100),
      bp_systolic: is_quick ? null : clamp(body?.bp_systolic, 70, 250),
      bp_diastolic: is_quick ? null : clamp(body?.bp_diastolic, 40, 150),
      glucose_mg_dl: is_quick ? null : clamp(body?.glucose_mg_dl, 40, 600),
      weight: is_quick ? null : clamp(body?.weight, 50, 800),
      physical_activity: is_quick ? null : safeStr(body?.physical_activity, 128),
      social_engagement: is_quick ? null : safeStr(body?.social_engagement, 128),
      symptoms: is_quick ? null : safeStr(body?.symptoms, 500),
      notes: is_quick ? null : safeStr(body?.activity_notes, 500),
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
