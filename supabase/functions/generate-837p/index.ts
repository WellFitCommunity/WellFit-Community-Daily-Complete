// supabase/functions/generate-837p/index.ts
// Runs on Deno (Edge Functions). Generates X12 837P and stores it in `claims`.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- Supabase (server) client ----
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // service role key required (keep secret)
);

type EncounterProcedure = {
  code: string;
  charge_amount: number | null;
  units: number | null;
  modifiers?: string[] | null;
  service_date?: string | null; // YYYY-MM-DD
  diagnosis_pointers?: number[] | null;
};

type EncounterDiagnosis = {
  code: string;
  sequence?: number | null;
};

type Patient = {
  first_name?: string | null;
  last_name?: string | null;
  dob?: string | null;
  gender?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  member_id?: string | null;
  ssn?: string | null;
  phone?: string | null;
};

type Provider = {
  id: string;
  organization_name?: string | null;
  npi?: string | null;
  taxonomy_code?: string | null;
  ein?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  submitter_id?: string | null;
  contact_phone?: string | null;
};

type Payer = {
  id: string;
  name?: string | null;
  receiver_id?: string | null;
  clearinghouse_id?: string | null;
};

type Encounter = {
  id: string;
  date_of_service: string;
  claim_frequency_code?: string | null;
  subscriber_relation_code?: string | null;
  payer_id: string;
  patient: Patient;
  provider: Provider;
  procedures: EncounterProcedure[];
  diagnoses: EncounterDiagnosis[];
};

// ---------- small utils ----------
function padLeft(value: string | number, length: number, char = "0"): string {
  const s = String(value ?? "");
  return s.length >= length ? s : char.repeat(length - s.length) + s;
}
function yymmdd(date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = padLeft(date.getMonth() + 1, 2);
  const dd = padLeft(date.getDate(), 2);
  return `${yy}${mm}${dd}`;
}
function hhmm(date = new Date()): string {
  const h = padLeft(date.getHours(), 2);
  const m = padLeft(date.getMinutes(), 2);
  return `${h}${m}`;
}
function safeText(s: string | null | undefined): string {
  return (s ?? "").replace(/[~*\^\|\\]/g, "").trim();
}
function formatD8(dateStr?: string | null, fallback = "20240101"): string {
  if (!dateStr) return fallback;
  const d = dateStr.replace(/-/g, "");
  return d.length >= 8 ? d.slice(0, 8) : fallback;
}
function removeICDDot(code?: string | null): string {
  return safeText((code ?? "").replace(".", ""));
}

// ---------- DB helpers ----------
async function getEncounterData(encounterId: string): Promise<Encounter> {
  const { data, error } = await supabase
    .from("encounters")
    .select(`
      id,
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

async function getProviderData(providerId: string): Promise<Provider> {
  const { data, error } = await supabase
    .from("billing_providers")
    .select("id,organization_name,npi,taxonomy_code,ein,address_line1,city,state,zip,submitter_id,contact_phone")
    .eq("id", providerId)
    .single();

  if (error || !data) throw new Error(`Provider ${providerId} not found: ${error?.message || ""}`);
  return data as Provider;
}

async function getPayerData(payerId: string): Promise<Payer> {
  const { data, error } = await supabase
    .from("payers")
    .select("id,name,receiver_id,clearinghouse_id")
    .eq("id", payerId)
    .single();

  if (error || !data) throw new Error(`Payer ${payerId} not found: ${error?.message || ""}`);
  return data as Payer;
}

// ---- Control numbers (monotonic) using DB sequences via RPC ----
// Create these once in SQL (see snippet below):
//   CREATE SEQUENCE IF NOT EXISTS x12_isa_seq START WITH 1 INCREMENT BY 1;
//   CREATE SEQUENCE IF NOT EXISTS x12_gs_seq  START WITH 1 INCREMENT BY 1;
//   CREATE SEQUENCE IF NOT EXISTS x12_st_seq  START WITH 1 INCREMENT BY 1;
//   CREATE OR REPLACE FUNCTION next_seq(seq text) RETURNS bigint
//   LANGUAGE plpgsql AS $$ DECLARE v bigint; BEGIN EXECUTE format('SELECT nextval(''%I'')', seq) INTO v; RETURN v; END $$;

async function nextControl(seqName: "x12_isa_seq" | "x12_gs_seq" | "x12_st_seq"): Promise<number> {
  // We call an RPC function `next_seq` that wraps nextval(seq)
  const { data, error } = await supabase.rpc("next_seq", { seq: seqName });
  if (error) throw new Error(`Failed to get control from ${seqName}: ${error.message}`);
  return Number(data);
}

// ---------- X12 builders ----------
function buildISA(senderId: string, receiverId: string, isaControl: number): string {
  const now = new Date();
  return [
    "ISA","00", padLeft("",10," "),
          "00", padLeft("",10," "),
          "ZZ", padLeft(safeText(senderId), 15, " "),
          "ZZ", padLeft(safeText(receiverId), 15, " "),
          yymmdd(now), hhmm(now),
          "^",
          "00501",
          padLeft(isaControl, 9, "0"),
          "0",
          "P",
          ":" // repetition sep
  ].join("*");
}

function buildIEA(groupCount: number, isaControl: number): string {
  return ["IEA", String(groupCount), padLeft(isaControl, 9, "0")].join("*");
}

function buildGS(appSender: string, appReceiver: string, gsControl: number): string {
  const now = new Date();
  return [
    "GS","HC",
    safeText(appSender),
    safeText(appReceiver),
    `${now.getFullYear()}${padLeft(now.getMonth()+1,2)}${padLeft(now.getDate(),2)}`,
    `${padLeft(now.getHours(),2)}${padLeft(now.getMinutes(),2)}`,
    padLeft(gsControl, 9, "0"),
    "X",
    "005010X222A1",
  ].join("*");
}

function buildGE(transactionCount: number, gsControl: number): string {
  return ["GE", String(transactionCount), padLeft(gsControl, 9, "0")].join("*");
}

function buildSV1(proc: EncounterProcedure): string {
  const code = safeText(proc.code || "99213");
  const mods = proc.modifiers && proc.modifiers.length ? `:${proc.modifiers.map(safeText).join(":")}` : "";
  const charge = Number(proc.charge_amount || 0).toFixed(2);
  const units  = String(proc.units || 1);
  return ["SV1", `HC:${code}${mods}`, charge, "UN", units].join("*");
}

function generateRef(): string {
  return `WF${Date.now().toString(36).toUpperCase()}`;
}

function build837P(enc: Encounter, prov: Provider, payer: Payer, stControl: number) {
  const stCtrl = padLeft(stControl, 4, "0");
  const segs: string[] = [];

  segs.push(["ST","837", stCtrl, "005010X222A1"].join("*"));
  segs.push(["BHT","0019","00", generateRef(), yymmdd(), hhmm(), "TH"].join("*"));

  // 1000A Submitter
  segs.push(["NM1","41","2", safeText(prov.organization_name || "WELLFIT COMMUNITY"), "","","","", "46", safeText(prov.submitter_id || "WELLFIT")].join("*"));
  if (prov.contact_phone) segs.push(["PER","IC","BILLING","TE", safeText(prov.contact_phone)].join("*"));

  // 1000B Receiver
  segs.push(["NM1","40","2", safeText(payer.name || "RECEIVER"), "","","","", "46", safeText(payer.receiver_id || payer.clearinghouse_id || "RECEIVERID")].join("*"));

  // 2000A Billing Provider
  segs.push(["HL","1","","20","1"].join("*"));
  if (prov.taxonomy_code) segs.push(["PRV","BI","PXC", safeText(prov.taxonomy_code)].join("*"));
  segs.push(["NM1","85","2", safeText(prov.organization_name || "WELLFIT COMMUNITY"),"","","","","XX", safeText(prov.npi || "0000000000")].join("*"));
  if (prov.address_line1) segs.push(["N3", safeText(prov.address_line1)].join("*"));
  if (prov.city || prov.state || prov.zip) segs.push(["N4", safeText(prov.city || ""), safeText(prov.state || ""), safeText(prov.zip || "")].join("*"));
  if (prov.ein) segs.push(["REF","EI", safeText(prov.ein)].join("*"));

  // 2000B Subscriber
  segs.push(["HL","2","1","22","0"].join("*"));
  segs.push(["SBR","P","","","","","","", safeText(enc.subscriber_relation_code || "18")].join("*"));

  const p = enc.patient || {};
  segs.push(["NM1","IL","1", safeText(p.last_name || "DOE"), safeText(p.first_name || "JOHN"),"","","","MI", safeText(p.member_id || "MEM123456")].join("*"));
  if (p.address_line1) segs.push(["N3", safeText(p.address_line1)].join("*"));
  if (p.city || p.state || p.zip) segs.push(["N4", safeText(p.city || ""), safeText(p.state || ""), safeText(p.zip || "")].join("*"));
  segs.push(["DMG","D8", formatD8(p.dob,"19800101"), safeText((p.gender || "U").substring(0,1))].join("*"));

  // 2300 Claim
  const totalCharge = (enc.procedures ?? []).reduce((sum, pr) => sum + (Number(pr.charge_amount) || 0), 0);
  segs.push(["CLM", safeText(enc.id), totalCharge.toFixed(2), "", "", "", safeText(enc.claim_frequency_code || "1")].join("*"));
  segs.push(["DTP","434","D8", formatD8(enc.date_of_service)].join("*"));

  // HI Diagnoses
  const diags = (enc.diagnoses ?? []).sort((a,b) => (a.sequence ?? 999) - (b.sequence ?? 999));
  if (diags.length > 0) {
    segs.push(["HI", `BK:${removeICDDot(diags[0].code)}`].join("*"));
    for (let i=1;i<diags.length;i++) segs.push(["HI", `BF:${removeICDDot(diags[i].code)}`].join("*"));
  } else {
    segs.push(["HI","BK:R69"].join("*"));
  }

  // 2400 Service lines
  const procs = enc.procedures ?? [];
  if (procs.length === 0) {
    segs.push(["LX","1"].join("*"));
    segs.push(buildSV1({ code: "99213", charge_amount: 150, units: 1, modifiers: [] }));
    segs.push(["DTP","472","D8", formatD8(enc.date_of_service)].join("*"));
  } else {
    procs.forEach((pr, idx) => {
      segs.push(["LX", String(idx + 1)].join("*"));
      segs.push(buildSV1(pr));
      segs.push(["DTP","472","D8", formatD8(pr.service_date || enc.date_of_service)].join("*"));
    });
  }

  // SE trailer
  const segCount = segs.length + 1; // include SE itself
  segs.push(["SE", String(segCount), stCtrl].join("*"));

  return { stSegments: segs, stCtrl, segCount };
}

async function storeClaim(encounterId: string, x12: string, type: string, stControl: string, segCount: number) {
  const { error } = await supabase
    .from("claims")
    .insert({
      encounter_id: encounterId,
      x12_content: x12,
      claim_type: type,
      status: "generated",
      control_number: stControl,
      segment_count: segCount,
      created_at: new Date().toISOString(),
    });
  if (error) console.error("Failed to store claim:", error);
}

// ---------- HTTP handler ----------
serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    const { encounterId, billingProviderId } = await req.json();
    if (!encounterId || !billingProviderId) {
      return new Response("encounterId and billingProviderId are required", { status: 400 });
    }

    // Load data
    const enc = await getEncounterData(encounterId);
    const prov = await getProviderData(billingProviderId);
    const payr = await getPayerData(enc.payer_id);

    // Control numbers from DB sequences (monotonic)
    const isaControl = await nextControl("x12_isa_seq");
    const gsControl  = await nextControl("x12_gs_seq");
    const stControl  = await nextControl("x12_st_seq");

    const segments: string[] = [];
    segments.push(buildISA(prov.submitter_id || "WELLFIT", payr.clearinghouse_id || payr.receiver_id || "CLEARING", isaControl));
    segments.push(buildGS(prov.submitter_id || "WELLFIT", payr.receiver_id || payr.clearinghouse_id || "PAYER", gsControl));

    const { stSegments, stCtrl, segCount } = build837P(enc, prov, payr, stControl);
    segments.push(...stSegments);

    segments.push(buildGE(1, gsControl));
    segments.push(buildIEA(1, isaControl));

    const x12 = segments.join("~") + "~";

    await storeClaim(enc.id, x12, "837P", stCtrl, segCount);

    return new Response(x12, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  } catch (err: any) {
    console.error(err);
    return new Response(`Error: ${err.message || String(err)}`, { status: 500 });
  }
});
