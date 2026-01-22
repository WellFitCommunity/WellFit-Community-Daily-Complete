// supabase/functions/generate-837p/index.ts
// Deno Edge Function — generates X12 and stores a claim row

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("generate-837p");

// 837P Data Interfaces
interface PatientInfo {
  last_name?: string;
  first_name?: string;
  member_id?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  zip?: string;
  dob?: string;
  gender?: string;
}

interface DiagnosisRecord {
  code: string;
  sequence?: number;
}

interface ProcedureRecord {
  code: string;
  charge_amount: number | null;
  units: number | null;
  modifiers?: string[] | null;
  service_date?: string;
}

interface EncounterData {
  id: string;
  patient?: PatientInfo;
  procedures?: ProcedureRecord[];
  diagnoses?: DiagnosisRecord[];
  date_of_service?: string;
  subscriber_relation_code?: string;
  claim_frequency_code?: string;
}

interface ProviderData {
  organization_name?: string;
  submitter_id?: string;
  contact_phone?: string;
  taxonomy_code?: string;
  npi?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  zip?: string;
  ein?: string;
}

interface PayerData {
  name?: string;
  receiver_id?: string;
  clearinghouse_id?: string;
}

/* ------------------------- CORS helpers (using shared module) ------------------------- */
function corsHeaders(req: Request, extra: HeadersInit = {}): HeadersInit {
  const { headers } = corsFromRequest(req);
  return { ...headers, ...extra };
}

function preflight(req: Request): Response {
  return handleOptions(req);
}

/* ------------------------- Supabase clients ------------------------- */

// Admin: service role (bypasses RLS where needed)
const adminClient = createClient(
  SUPABASE_URL,
  SB_SECRET_KEY);

// Per-request user client (for resolving the calling user via JWT)
function makeUserClient(req: Request) {
  const anon = SB_PUBLISHABLE_API_KEY;
  const url = SUPABASE_URL;
  const auth = req.headers.get("authorization") ?? "";
  return createClient(url, anon, { global: { headers: { Authorization: auth } } });
}

/* ------------------------------ Utilities ------------------------------ */

function padLeft(v: string | number, len: number, ch = "0") {
  const s = String(v ?? "");
  return s.length >= len ? s : ch.repeat(len - s.length) + s;
}
function yymmdd(d = new Date()) {
  return `${String(d.getFullYear()).slice(-2)}${padLeft(d.getMonth() + 1, 2)}${padLeft(d.getDate(), 2)}`;
}
function hhmm(d = new Date()) {
  return `${padLeft(d.getHours(), 2)}${padLeft(d.getMinutes(), 2)}`;
}
function safeText(s?: string | null) {
  return (s ?? "").replace(/[~*\^\|\\]/g, "").trim();
}
function formatD8(dateStr?: string | null, fallback = "20240101") {
  if (!dateStr) return fallback;
  const d = dateStr.replace(/-/g, "");
  return d.length >= 8 ? d.slice(0, 8) : fallback;
}
function removeICDDot(code?: string | null) {
  return safeText((code ?? "").replace(".", ""));
}
function generateRef() {
  return `WF${Date.now().toString(36).toUpperCase()}`;
}

/* ------------------------------ DB helpers ------------------------------ */

async function getEncounterData(encounterId: string) {
  const { data, error } = await adminClient
    .from("encounters")
    .select(`
      id,
      patient_id,
      date_of_service,
      claim_frequency_code,
      subscriber_relation_code,
      payer_id,
      patient:patients(
        first_name,last_name,dob,gender,
        address_line1,city,state,zip,
        member_id,ssn,phone
      ),
      provider:billing_providers(
        id,organization_name,npi,taxonomy_code,ein,
        address_line1,city,state,zip,submitter_id,contact_phone
      ),
      procedures:encounter_procedures(
        code,charge_amount,units,modifiers,service_date,diagnosis_pointers
      ),
      diagnoses:encounter_diagnoses(code,sequence)
    `)
    .eq("id", encounterId)
    .single();

  if (error || !data) throw new Error(`Encounter ${encounterId} not found: ${error?.message || ""}`);

  return {
    id: data.id,
    patient_id: data.patient_id,
    date_of_service: data.date_of_service,
    claim_frequency_code: data.claim_frequency_code ?? "1",
    subscriber_relation_code: data.subscriber_relation_code ?? "18",
    payer_id: data.payer_id,
    patient: data.patient ?? {},
    provider: data.provider ?? { id: "" },
    procedures: data.procedures ?? [],
    diagnoses: data.diagnoses ?? [],
  };
}

async function getProviderData(providerId: string) {
  const { data, error } = await adminClient
    .from("billing_providers")
    .select(
      "id,organization_name,npi,taxonomy_code,ein,address_line1,city,state,zip,submitter_id,contact_phone"
    )
    .eq("id", providerId)
    .single();

  if (error || !data) throw new Error(`Provider ${providerId} not found: ${error?.message || ""}`);
  return data;
}

async function getPayerData(payerId: string) {
  const { data, error } = await adminClient
    .from("payers")
    .select("id,name,receiver_id,clearinghouse_id")
    .eq("id", payerId)
    .single();

  if (error || !data) throw new Error(`Payer ${payerId} not found: ${error?.message || ""}`);
  return data;
}

// Control numbers via RPC on admin client
async function nextControl(seqName: "x12_isa_seq" | "x12_gs_seq" | "x12_st_seq"): Promise<number> {
  const { data, error } = await adminClient.rpc("next_seq", { seq: seqName });
  if (error) throw new Error(`Failed to get control from ${seqName}: ${error.message}`);
  return Number(data);
}

/* ------------------------------ X12 builders ------------------------------ */

function buildISA(senderId: string, receiverId: string, isaControl: number): string {
  const now = new Date();
  return [
    "ISA",
    "00",
    padLeft("", 10, " "),
    "00",
    padLeft("", 10, " "),
    "ZZ",
    padLeft(safeText(senderId), 15, " "),
    "ZZ",
    padLeft(safeText(receiverId), 15, " "),
    yymmdd(now),
    hhmm(now),
    "^",
    "00501",
    padLeft(isaControl, 9, "0"),
    "0",
    "P",
    ":",
  ].join("*");
}
function buildIEA(groupCount: number, isaControl: number) {
  return ["IEA", String(groupCount), padLeft(isaControl, 9, "0")].join("*");
}
function buildGS(appSender: string, appReceiver: string, gsControl: number) {
  const now = new Date();
  return [
    "GS",
    "HC",
    safeText(appSender),
    safeText(appReceiver),
    `${now.getFullYear()}${padLeft(now.getMonth() + 1, 2)}${padLeft(now.getDate(), 2)}`,
    `${padLeft(now.getHours(), 2)}${padLeft(now.getMinutes(), 2)}`,
    padLeft(gsControl, 9, "0"),
    "X",
    "005010X222A1",
  ].join("*");
}
function buildGE(txCount: number, gsControl: number) {
  return ["GE", String(txCount), padLeft(gsControl, 9, "0")].join("*");
}
function buildSV1(proc: { code: string; charge_amount: number | null; units: number | null; modifiers?: string[] | null }) {
  const code = safeText(proc.code || "99213");
  const mods = proc.modifiers && proc.modifiers.length ? `:${proc.modifiers.map(safeText).join(":")}` : "";
  const charge = Number(proc.charge_amount || 0).toFixed(2);
  const units = String(proc.units || 1);
  return ["SV1", `HC:${code}${mods}`, charge, "UN", units].join("*");
}
function build837P(enc: EncounterData, prov: ProviderData, payer: PayerData, stControl: number) {
  const stCtrl = padLeft(stControl, 4, "0");
  const segs: string[] = [];

  segs.push(["ST", "837", stCtrl, "005010X222A1"].join("*"));
  segs.push(["BHT", "0019", "00", generateRef(), yymmdd(), hhmm(), "TH"].join("*"));

  // 1000A Submitter
  segs.push([
    "NM1",
    "41",
    "2",
    safeText(prov.organization_name || "WELLFIT COMMUNITY"),
    "",
    "",
    "",
    "",
    "46",
    safeText(prov.submitter_id || "WELLFIT"),
  ].join("*"));
  if (prov.contact_phone) segs.push(["PER", "IC", "BILLING", "TE", safeText(prov.contact_phone)].join("*"));

  // 1000B Receiver
  segs.push([
    "NM1",
    "40",
    "2",
    safeText(payer.name || "RECEIVER"),
    "",
    "",
    "",
    "",
    "46",
    safeText(payer.receiver_id || payer.clearinghouse_id || "RECEIVERID"),
  ].join("*"));

  // 2000A Billing Provider
  segs.push(["HL", "1", "", "20", "1"].join("*"));
  if (prov.taxonomy_code) segs.push(["PRV", "BI", "PXC", safeText(prov.taxonomy_code)].join("*"));
  segs.push([
    "NM1",
    "85",
    "2",
    safeText(prov.organization_name || "WELLFIT COMMUNITY"),
    "",
    "",
    "",
    "",
    "XX",
    safeText(prov.npi || "0000000000"),
  ].join("*"));
  if (prov.address_line1) segs.push(["N3", safeText(prov.address_line1)].join("*"));
  if (prov.city || prov.state || prov.zip)
    segs.push(["N4", safeText(prov.city || ""), safeText(prov.state || ""), safeText(prov.zip || "")].join("*"));
  if (prov.ein) segs.push(["REF", "EI", safeText(prov.ein)].join("*"));

  // 2000B Subscriber / Patient
  segs.push(["HL", "2", "1", "22", "0"].join("*"));
  segs.push(["SBR", "P", "", "", "", "", "", "", safeText(enc.subscriber_relation_code || "18")].join("*"));
  const p = enc.patient || {};
  segs.push([
    "NM1",
    "IL",
    "1",
    safeText(p.last_name || "DOE"),
    safeText(p.first_name || "JOHN"),
    "",
    "",
    "",
    "MI",
    safeText(p.member_id || "MEM123456"),
  ].join("*"));
  if (p.address_line1) segs.push(["N3", safeText(p.address_line1)].join("*"));
  if (p.city || p.state || p.zip)
    segs.push(["N4", safeText(p.city || ""), safeText(p.state || ""), safeText(p.zip || "")].join("*"));
  segs.push(["DMG", "D8", formatD8(p.dob, "19800101"), safeText((p.gender || "U").substring(0, 1))].join("*"));

  // Claim
  const totalCharge = (enc.procedures ?? []).reduce((sum: number, pr: ProcedureRecord) => sum + (Number(pr.charge_amount) || 0), 0);
  segs.push(["CLM", safeText(enc.id), totalCharge.toFixed(2), "", "", "", safeText(enc.claim_frequency_code || "1")].join("*"));
  segs.push(["DTP", "434", "D8", formatD8(enc.date_of_service)].join("*"));

  // Diagnoses
  const diags = (enc.diagnoses ?? []).sort((a: DiagnosisRecord, b: DiagnosisRecord) => (a.sequence ?? 999) - (b.sequence ?? 999));
  if (diags.length > 0) {
    segs.push(["HI", `BK:${removeICDDot(diags[0].code)}`].join("*"));
    for (let i = 1; i < diags.length; i++) segs.push(["HI", `BF:${removeICDDot(diags[i].code)}`].join("*"));
  } else {
    segs.push(["HI", "BK:R69"].join("*"));
  }

  // Service lines
  const procs = enc.procedures ?? [];
  if (procs.length === 0) {
    segs.push(["LX", "1"].join("*"));
    segs.push(buildSV1({ code: "99213", charge_amount: 150, units: 1, modifiers: [] }));
    segs.push(["DTP", "472", "D8", formatD8(enc.date_of_service)].join("*"));
  } else {
    procs.forEach((pr: ProcedureRecord, idx: number) => {
      segs.push(["LX", String(idx + 1)].join("*"));
      segs.push(buildSV1(pr));
      segs.push(["DTP", "472", "D8", formatD8(pr.service_date || enc.date_of_service)].join("*"));
    });
  }

  // Trailer
  const segCount = segs.length + 1;
  segs.push(["SE", String(segCount), padLeft(stControl, 4, "0")].join("*"));

  return { stSegments: segs, stCtrl: padLeft(stControl, 4, "0"), segCount };
}

/* --------------------------------- Handler -------------------------------- */

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);

  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders(req) });
    }

    // Require JWT so we can attribute created_by
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing or invalid token" }), {
        status: 401,
        headers: corsHeaders(req, { "content-type": "application/json" }),
      });
    }

    const body = (await req.json()) as { encounterId?: string; billingProviderId?: string };
    const { encounterId, billingProviderId } = body;
    if (!encounterId || !billingProviderId) {
      return new Response(JSON.stringify({ error: "encounterId and billingProviderId are required" }), {
        status: 400,
        headers: corsHeaders(req, { "content-type": "application/json" }),
      });
    }

    // Resolve current user
    const userClient = makeUserClient(req);
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unable to resolve user" }), {
        status: 401,
        headers: corsHeaders(req, { "content-type": "application/json" }),
      });
    }
    const currentUser: User = userData.user;

    // Extract client IP for audit logging
    // NOTE: actor_ip_address column is inet type - use null instead of 'unknown' if no IP available
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     req.headers.get('x-real-ip') || null;

    const startTime = Date.now();

    // Load data (admin privileges)
    const enc = await getEncounterData(encounterId);
    const prov = await getProviderData(billingProviderId);
    const payr = await getPayerData(enc.payer_id);

    // Control numbers
    const isaControl = await nextControl("x12_isa_seq");
    const gsControl = await nextControl("x12_gs_seq");
    const stControl = await nextControl("x12_st_seq");

    // Build X12
    const segments: string[] = [];
    segments.push(
      buildISA(
        prov.submitter_id || "WELLFIT",
        payr.clearinghouse_id || payr.receiver_id || "CLEARING",
        isaControl
      )
    );
    segments.push(buildGS(prov.submitter_id || "WELLFIT", payr.receiver_id || payr.clearinghouse_id || "PAYER", gsControl));
    const { stSegments, stCtrl, segCount } = build837P(enc, prov, payr, stControl);
    segments.push(...stSegments);
    segments.push(buildGE(1, gsControl));
    segments.push(buildIEA(1, isaControl));
    const x12 = segments.join("~") + "~";

    // Store claim (column names per your screenshot: control_numb, segment_cou)
    const { error: insertErr } = await adminClient.from("claims").insert({
      encounter_id: enc.id,
      x12_content: x12,
      claim_type: "837P",
      status: "generated",
      control_numb: stCtrl,
      segment_cou: segCount,
      created_by: currentUser.id, // explicit attribution
      created_at: new Date().toISOString(),
    });

    if (insertErr) {
      logger.error("Failed to store claim", {
        code: insertErr.code,
        message: insertErr.message,
        encounterId: enc.id
      });

      // HIPAA AUDIT LOGGING: Log failed claim generation
      try {
        await adminClient.from('audit_logs').insert({
          event_type: 'CLAIMS_GENERATION_FAILED',
          event_category: 'FINANCIAL',
          actor_user_id: currentUser.id,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'GENERATE_CLAIM',
resource_type: 'auth_event',
          success: false,
          error_code: insertErr.code || 'CLAIM_STORAGE_ERROR',
          error_message: insertErr.message,
          metadata: {
            encounter_id: enc.id,
            billing_provider_id: billingProviderId,
            payer_id: enc.payer_id,
            control_number: stCtrl,
            segment_count: segCount
          }
        });
      } catch (logErr: unknown) {
        const errorMessage = logErr instanceof Error ? logErr.message : String(logErr);
        logger.error("Audit log insert failed", { message: errorMessage });
      }

      // Multi-status: return payload but include storage error context
      return new Response(
        JSON.stringify({ x12, claimId: enc.id, controlNumber: stCtrl, storeError: insertErr.message }),
        { status: 207, headers: corsHeaders(req, { "content-type": "application/json" }) }
      );
    }

    const processingTime = Date.now() - startTime;

    // HIPAA AUDIT LOGGING: Log successful claim generation
    try {
      await adminClient.from('audit_logs').insert({
        event_type: 'CLAIMS_GENERATION_SUCCESS',
        event_category: 'FINANCIAL',
        actor_user_id: currentUser.id,
        actor_ip_address: clientIp,
        actor_user_agent: req.headers.get('user-agent'),
        operation: 'GENERATE_CLAIM',
resource_type: 'auth_event',
        success: true,
        metadata: {
          encounter_id: enc.id,
          billing_provider_id: billingProviderId,
          payer_id: enc.payer_id,
          patient_id: enc.patient_id,
          control_number: stCtrl,
          segment_count: segCount,
          claim_type: '837P',
          processing_time_ms: processingTime,
          procedure_count: enc.procedures?.length || 0,
          diagnosis_count: enc.diagnoses?.length || 0
        }
      });
    } catch (logErr: unknown) {
      const errorMessage = logErr instanceof Error ? logErr.message : String(logErr);
      logger.error("Audit log insert failed", { message: errorMessage });
    }

    // PHI: User/Encounter IDs not logged per HIPAA - data stored in audit_logs table

    // Success: return text (your UI treats it as a downloadable string)
    return new Response(x12, {
      status: 200,
      headers: corsHeaders(req, { "content-type": "text/plain; charset=utf-8" }),
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("generate-837p error", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: corsHeaders(req, { "content-type": "application/json" }),
    });
  }
});
 