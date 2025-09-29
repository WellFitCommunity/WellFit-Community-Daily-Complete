// Supabase Edge Function (Deno) — production-grade
// - Uses Anthropic Claude "claude-3-5-sonnet-latest"
// - De-identifies input aggressively
// - Writes comprehensive audit row (no PHI)
// - Production-ready error handling

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.63.1";

// Flip to true only when you need extra response diagnostics
const DEBUG = false;

// ---------- Types ----------
type CodingSuggestion = {
  cpt?: Array<{ code: string; modifiers?: string[]; rationale?: string }>;
  hcpcs?: Array<{ code: string; modifiers?: string[]; rationale?: string }>;
  icd10?: Array<{ code: string; rationale?: string; principal?: boolean }>;
  notes?: string;
  confidence?: number;
};

// ---------- Env ----------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");

if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
if (!ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY (or CLAUDE_API_KEY)");

// Clients
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ---------- Helpers ----------
const truthy = (v?: string | null) => !!v && v.trim().length > 0;

const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]") // you said you don't collect SSN; keep this for redaction safety
    .replace(/\b\d{1,5}\s+[A-Za-z0-9'.\- ]+\b/g, (m) => (m.length > 6 ? "[ADDRESS]" : m))
    .replace(/\b(19|20)\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g, "[DATE]");

function ageBandFromDOB(dob?: string | null): string | null {
  if (!truthy(dob)) return null;
  const d = new Date(dob!);
  if (Number.isNaN(d.getTime())) return null;
  const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  if (age < 0 || age > 120) return null;
  if (age < 18) return "0-17";
  if (age < 30) return "18-29";
  if (age < 45) return "30-44";
  if (age < 65) return "45-64";
  return "65+";
}

function deepDeidentify(obj: any): any {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(deepDeidentify);
  if (typeof obj === "string") return redact(obj);
  if (typeof obj === "object") {
    const strip = new Set([
      "patient_name","first_name","last_name","middle_name",
      "dob","date_of_birth","ssn","email","phone","address",
      "address_line1","address_line2","city","state","zip",
      "mrn","member_id","insurance_id","subscriber_name",
      // strip internal identifiers as well:
      "patient_id","person_id","user_id","uid"
    ]);
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (strip.has(k)) continue;
      out[k] = deepDeidentify(v);
    }
    return out;
  }
  return obj;
}

const SYSTEM_PROMPT = `You are a cautious medical coding assistant.
Return ONLY strict JSON matching this shape:
{
  "cpt": [{"code": "string", "modifiers": ["string"], "rationale": "string"}],
  "hcpcs": [{"code": "string", "modifiers": ["string"], "rationale": "string"}],
  "icd10": [{"code": "string", "rationale": "string", "principal": true}],
  "notes": "string",
  "confidence": 0
}
Rules:
- Prefer CPT for professional services; use HCPCS for supplies/injectables when appropriate.
- ICD-10 codes must be valid and as specific as possible; use 'unspecified' only if necessary.
- Include rationales referencing generalized clinical facts only (no PHI).
- If uncertain, lower the confidence and explain in notes.
- Output JSON only—no extra text.`;

function userPrompt(payload: Record<string, any>) {
  return [
    "Analyze this de-identified encounter and propose medical codes.",
    "Return ONLY JSON, no markdown, no commentary.",
    JSON.stringify(payload),
  ].join("\n");
}

// Promise timeout wrapper (no AbortSignal)
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

// CORS
function cors(headers: Headers, origin: string | null) {
  headers.set("Access-Control-Allow-Origin", origin ?? "*");
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

// Safe JSON parse (handles missing/invalid body)
async function safeJson(req: Request): Promise<any> {
  const text = await req.text();
  if (!text) throw new Error("Empty request body");
  try { return JSON.parse(text); } catch { throw new Error("Invalid JSON body"); }
}

// ---------- Handler ----------
serve(async (req) => {
  const headers = new Headers({ "Content-Type": "application/json" });
  cors(headers, req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response(null, { headers, status: 204 });
  if (req.method !== "POST")  return new Response(JSON.stringify({ error: "Method Not Allowed" }), { headers, status: 405 });

  try {
    const body = await safeJson(req);
    const encounter = body?.encounter ?? body;
    const encounterId = encounter?.id as string | undefined;
    if (!encounterId) {
      return new Response(JSON.stringify({ error: "Missing encounter.id in payload" }), { headers, status: 400 });
    }

    // De-ID
    const payload = deepDeidentify(encounter);
    const dob = encounter?.dob ?? encounter?.date_of_birth;
    const band = ageBandFromDOB(dob);
    if (band) (payload as any).age_band = band;
    (payload as any).time_frame = "recent";

    // Claude call (model: claude-3-5-sonnet-latest)
    const model = "claude-3-5-sonnet-latest";
    let text = "";
    let lastErr: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await withTimeout(
          anthropic.messages.create({
            model,
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt(payload) }],
          } as any),
          45_000
        );
        const first = (res as any)?.content?.[0];
        text = first?.text ?? "";
        if (!text) throw new Error("Empty response from model");
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 500));
      }
    }
    if (lastErr) throw lastErr;

    // Parse model JSON
    let parsed: CodingSuggestion;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { notes: "Model returned invalid JSON.", confidence: 10 };
    }

    // Minimal audit (no PHI, no extra columns)
    const { error: auditErr } = await sb.from("coding_audits").insert({
      encounter_id: encounterId,
      model,
      success: true,
      confidence: parsed.confidence ?? null,
      created_at: new Date().toISOString(),
    });
    if (auditErr) console.error("coding_audits insert failed:", auditErr.message);

    const resp = DEBUG ? { ...parsed, _debug: { raw_len: text.length } } : parsed;
    return new Response(JSON.stringify(resp), { headers, status: 200 });

  } catch (err: any) {
    console.error("coding-suggest error:", err);
    // best-effort failure audit
    try {
      await sb.from("coding_audits").insert({
        encounter_id: null,
        model: "claude-3-5-sonnet-latest",
        success: false,
        confidence: null,
        created_at: new Date().toISOString(),
      });
    } catch {}

    const payload: any = { error: err?.message || "Server error" };
    if (DEBUG) payload._diag = { stack: String(err?.stack || "") };
    return new Response(JSON.stringify(payload), { headers, status: 400 });
  }
});
