import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Env / Supabase ─────────────────────────────────────────────────────────────

// Prefer your SB_* names; fall back to official SUPABASE_* names.
const SUPA_URL =
  Deno.env.get("SB_URL") ??
  Deno.env.get("SUPABASE_URL");

const SERVICE_ROLE_KEY =
  Deno.env.get("SB_SERVICE_ROLE_KEY") ??
  Deno.env.get("SB_SECRET_KEY") ??              // your previous name
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");    // official name

if (!SUPA_URL) throw new Error("Missing SB_URL/SUPABASE_URL");
if (!SERVICE_ROLE_KEY) throw new Error("Missing SB_SERVICE_ROLE_KEY/SB_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY");

const supabaseAdmin = createClient(SUPA_URL, SERVICE_ROLE_KEY);


// ─── CORS ───────────────────────────────────────────────────────────────────────
function cors(origin: string | null): Headers {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
    .split(",").map(s => s.trim()).filter(Boolean);
  const allowOrigin = allowed.includes("*")
    ? "*"
    : (origin && allowed.includes(origin) ? origin : "");
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", allowOrigin || "www.wellfitcommunity.org");
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
  h.set("Content-Type", "application/json");
  return h;
}

// ─── Auth helper ────────────────────────────────────────────────────────────────
async function requireUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Missing bearer token" }), { status: 401 });
  }
  const token = auth.slice(7).trim();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    throw new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401 });
  }
  return data.user; // { id, ... }
}

// ─── Vitals parsing / clamping ─────────────────────────────────────────────────
function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function clamp(val: number | null, lo: number, hi: number): number | null {
  if (val == null) return null;
  return val >= lo && val <= hi ? Math.round(val) : null;
}
function normalizeVitals(input: Record<string, unknown>) {
  const hr  = clamp(numOrNull(input.heart_rate),       30, 220);
  const sp  = clamp(numOrNull(input.pulse_oximeter),   50, 100);
  const sys = clamp(numOrNull(input.bp_systolic),      70, 250);
  const dia = clamp(numOrNull(input.bp_diastolic),     40, 150);
  const glu = clamp(numOrNull(input.glucose_mg_dl),    40, 600);
  return { heart_rate: hr, pulse_oximeter: sp, bp_systolic: sys, bp_diastolic: dia, glucose_mg_dl: glu };
}

// Conservative server-side emergency logic (tune later if needed)
const BP_SYS_EMERG = 180;
const BP_DIA_EMERG = 120;
const GLU_LOW      = 70;
const GLU_HIGH     = 400;

function computeEmergency(label: string, vitals: ReturnType<typeof normalizeVitals>, explicit?: boolean): boolean {
  if (typeof explicit === "boolean") return explicit;
  const L = (label || "").toLowerCase();
  const keywordHit = ["🚨", "emergency", "injured", "fallen", "not feeling well", "hospital"]
    .some(k => L.includes(k));
  const bpHit  = (vitals.bp_systolic != null && vitals.bp_systolic >= BP_SYS_EMERG)
              || (vitals.bp_diastolic != null && vitals.bp_diastolic >= BP_DIA_EMERG);
  const gluHit = (vitals.glucose_mg_dl != null && (vitals.glucose_mg_dl < GLU_LOW || vitals.glucose_mg_dl > GLU_HIGH));
  return keywordHit || bpHit || gluHit;
}

// ─── Handler ───────────────────────────────────────────────────────────────────
serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const user = await requireUser(req);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label) {
      return new Response(JSON.stringify({ error: "Label is required" }), { status: 400, headers });
    }

    const isQuick = Boolean(body.is_quick);
    const vitals  = normalizeVitals(body);
    const isEmergency = computeEmergency(label, vitals,
      typeof body.is_emergency === "boolean" ? (body.is_emergency as boolean) : undefined
    );

    let emotional_state: string | null = null;
    if (isQuick) {
      emotional_state = isEmergency ? "Emergency" : "Quick Update";
    } else {
      emotional_state = typeof body.emotional_state === "string" && body.emotional_state.trim()
        ? body.emotional_state.trim()
        : null;
    }

    const timestamp = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("check_ins")
      .insert({
        user_id: user.id,
        timestamp,
        label,
        is_emergency: isEmergency,
        emotional_state,
        heart_rate:       vitals.heart_rate,
        pulse_oximeter:   vitals.pulse_oximeter,
        bp_systolic:      vitals.bp_systolic,
        bp_diastolic:     vitals.bp_diastolic,
        glucose_mg_dl:    vitals.glucose_mg_dl,
      })
      .select()
      .single();

    if (error) {
      console.error("create-checkin insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ success: true, checkin: data }), { status: 200, headers });

  } catch (e) {
    if (e instanceof Response) return e;
    console.error("create-checkin fatal:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers });
  }
});
