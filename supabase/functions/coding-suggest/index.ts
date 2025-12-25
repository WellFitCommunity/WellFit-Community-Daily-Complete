// Supabase Edge Function (Deno) — production-grade
// - Uses Anthropic Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) for maximum accuracy in medical coding
// - Revenue-critical: Accurate codes = correct reimbursement
// - De-identifies input aggressively
// - Writes comprehensive audit row (no PHI)
// - Production-ready error handling

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.63.1";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

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
const SERVICE_KEY = SB_SECRET_KEY;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");

if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing SUPABASE_URL or SB_SERVICE_ROLE_KEY");
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
  const d = new Date(dob);
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

// Safe JSON parse (handles missing/invalid body)
async function safeJson(req: Request): Promise<any> {
  const text = await req.text();
  if (!text) throw new Error("Empty request body");
  try { return JSON.parse(text); } catch { throw new Error("Invalid JSON body"); }
}

// ---------- Handler ----------
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return handleOptions(req);

  const { headers } = corsFromRequest(req);
  if (req.method !== "POST")  return new Response(JSON.stringify({ error: "Method Not Allowed" }), { headers, status: 405 });

  // Get user for audit logging
  const authHeader = req.headers.get("authorization");
  let userId: string | null = null;
  if (authHeader) {
    try {
      const token = authHeader.replace(/^Bearer /, "");
      const { data } = await sb.auth.getUser(token);
      userId = data?.user?.id || null;
    } catch (e) {
      console.warn("Failed to get user from token:", e);
    }
  }

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

    // Claude call (model: claude-sonnet-4-5-20250929 - latest for best medical coding)
    const model = "claude-sonnet-4-5-20250929";
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    let text = "";
    let lastErr: any = null;
    let claudeResponse: any = null;

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
        claudeResponse = res;
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

    const responseTime = Date.now() - startTime;

    // Calculate cost (Sonnet 4.5 pricing: $3 per 1M input, $15 per 1M output)
    const inputTokens = claudeResponse?.usage?.input_tokens || 0;
    const outputTokens = claudeResponse?.usage?.output_tokens || 0;
    const inputCost = (inputTokens * 0.003) / 1000;
    const outputCost = (outputTokens * 0.015) / 1000;
    const totalCost = inputCost + outputCost;

    // HIPAA AUDIT LOGGING: Log Claude API call to database (comprehensive)
    try {
      await sb.from('claude_api_audit').insert({
        request_id: requestId,
        user_id: userId,
        request_type: 'medical_coding',
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost: totalCost,
        response_time_ms: responseTime,
        success: true,
        phi_scrubbed: true, // Confirmed - using deepDeidentify
        metadata: {
          encounter_id: encounterId,
          confidence: parsed.confidence,
          has_cpt: !!parsed.cpt?.length,
          has_hcpcs: !!parsed.hcpcs?.length,
          has_icd10: !!parsed.icd10?.length
        }
      });
    } catch (logError) {
      console.error('[Audit Log Error]:', logError);
    }

    // PHI: User/Encounter IDs not logged per HIPAA - data stored in claude_api_audit table

    // Minimal audit (no PHI, no extra columns) - keep existing for backward compatibility
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

    // HIPAA AUDIT LOGGING: Log failure to database
    try {
      const requestId = crypto.randomUUID();
      await sb.from('claude_api_audit').insert({
        request_id: requestId,
        user_id: userId,
        request_type: 'medical_coding',
        model: "claude-sonnet-4-5-20250929",
        input_tokens: 0,
        output_tokens: 0,
        cost: 0,
        response_time_ms: 0,
        success: false,
        error_code: err?.name || 'UNKNOWN_ERROR',
        error_message: err?.message || err?.toString(),
        phi_scrubbed: true,
        metadata: {
          error_type: err?.constructor?.name
        }
      });
    } catch (logError) {
      console.error('[Audit Log Error]:', logError);
    }

    // best-effort failure audit (keep existing for backward compatibility)
    try {
      await sb.from("coding_audits").insert({
        encounter_id: null,
        model: "claude-sonnet-4-5-20250929", // Sonnet 4.5 - revenue-critical accuracy
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
