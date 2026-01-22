/**
 * AI Discharge Summary Generator Edge Function
 *
 * Skill #19: Auto-generate comprehensive discharge summaries with medication reconciliation.
 *
 * Generates structured discharge summaries including:
 * - Hospital course narrative
 * - Admission diagnosis and principal diagnoses
 * - Procedures performed
 * - Medication reconciliation (continued, new, changed, discontinued)
 * - Follow-up care instructions
 * - Patient education points
 * - Red flags and warning signs
 *
 * CRITICAL SAFETY GUARDRAILS:
 * 1. ALL summaries require clinician review before finalization
 * 2. Medication changes are clearly flagged for pharmacist verification
 * 3. Allergy conflicts are prominently displayed
 * 4. High-risk patients get additional review flags
 * 5. Confidence scoring for transparency
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy.
 *
 * @module ai-discharge-summary
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SONNET_MODEL = "claude-sonnet-4-20250514";

// =====================================================
// TYPES
// =====================================================

interface DischargeSummaryRequest {
  patientId: string;
  encounterId: string;
  tenantId?: string;
  dischargePlanId?: string;
  dischargeDisposition?: string;
  attendingPhysician?: string;
  includePatientInstructions?: boolean;
}

interface MedicationReconciliation {
  continued: MedicationEntry[];
  new: MedicationEntry[];
  changed: MedicationChange[];
  discontinued: MedicationEntry[];
  allergies: string[];
  interactions: string[];
}

interface MedicationEntry {
  name: string;
  dose: string;
  route: string;
  frequency: string;
  indication: string;
  instructions?: string;
}

interface MedicationChange {
  name: string;
  previousDose: string;
  newDose: string;
  reason: string;
  instructions?: string;
}

interface DischargeDiagnosis {
  code: string;
  display: string;
  type: "principal" | "secondary" | "complication";
}

interface ProcedurePerformed {
  code: string;
  display: string;
  date: string;
  provider?: string;
}

interface FollowUpAppointment {
  specialty: string;
  provider?: string;
  timeframe: string;
  purpose: string;
  urgency: "routine" | "urgent" | "as_needed";
}

interface PatientInstruction {
  category: "activity" | "diet" | "wound_care" | "medication" | "symptoms" | "general";
  instruction: string;
  importance: "critical" | "important" | "informational";
}

interface WarningSign {
  sign: string;
  action: string;
  urgency: "call_office" | "urgent_care" | "emergency";
}

interface DischargeSummary {
  // Header
  patientName: string;
  dateOfBirth: string;
  admissionDate: string;
  dischargeDate: string;
  lengthOfStay: number;
  attendingPhysician: string;
  dischargeDisposition: string;

  // Clinical Content
  chiefComplaint: string;
  admissionDiagnosis: string;
  hospitalCourse: string;
  dischargeDiagnoses: DischargeDiagnosis[];
  proceduresPerformed: ProcedurePerformed[];

  // Medications
  medicationReconciliation: MedicationReconciliation;
  dischargePharmacy?: string;

  // Follow-up
  followUpAppointments: FollowUpAppointment[];
  pendingTests: string[];
  pendingConsults: string[];

  // Patient Instructions
  patientInstructions: PatientInstruction[];
  warningSigns: WarningSign[];
  activityRestrictions: string[];
  dietaryInstructions: string[];

  // Care Coordination
  homeHealthOrdered: boolean;
  homeHealthAgency?: string;
  dmeOrdered: boolean;
  dmeItems?: string[];

  // Quality Metrics
  readmissionRiskScore: number;
  readmissionRiskCategory: "low" | "moderate" | "high" | "very_high";

  // Safety
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  disclaimer: string;
}

interface PatientContext {
  name: string;
  dateOfBirth: string;
  sex: string;
  allergies: string[];
  admissionDate: string;
  chiefComplaint: string;
  admissionDiagnosis: string;
  conditions: Array<{ code: string; display: string }>;
  procedures: Array<{ code: string; display: string; date: string }>;
  admissionMedications: Array<{ name: string; dose: string; frequency: string }>;
  dischargeMedications: Array<{ name: string; dose: string; frequency: string; status: string }>;
  vitalSigns: Record<string, { value: number; unit: string }>;
  labResults: Array<{ name: string; value: string; unit: string; date: string; abnormal: boolean }>;
  notes: string[];
  dischargePlan?: {
    disposition: string;
    followUpDate?: string;
    followUpProvider?: string;
    homeHealthNeeded: boolean;
    dmeNeeded: boolean;
    readmissionRiskScore: number;
  };
}

// Database record types for query results
interface AllergyRecord {
  code?: { coding?: Array<{ display?: string }>; text?: string };
  criticality?: string;
}

interface ConditionRecord {
  code?: { coding?: Array<{ code?: string; display?: string }> };
  clinical_status?: string;
  onset_datetime?: string;
}

interface ProcedureRecord {
  code?: { coding?: Array<{ code?: string; display?: string }> };
  performed_datetime?: string;
  status?: string;
}

interface MedicationRequestRecord {
  medication_codeable_concept?: { coding?: Array<{ display?: string }> };
  dosage_instruction?: Array<{
    dose_and_rate?: Array<{ dose_quantity?: { value?: string } }>;
    timing?: { code?: { text?: string } };
  }>;
  status?: string;
  intent?: string;
}

interface VitalRecord {
  code?: { coding?: Array<{ code?: string }> };
  value_quantity_value?: number;
  value_quantity_unit?: string;
}

interface LabRecord {
  code?: { coding?: Array<{ display?: string }>; text?: string };
  value_quantity_value?: number | null;
  value_quantity_unit?: string;
  effective_datetime?: string;
  interpretation?: { coding?: Array<{ code?: string }> };
}

interface NoteRecord {
  note_type?: string;
  content?: string;
  created_at?: string;
}

interface ParsedSummary {
  patientName?: string;
  dateOfBirth?: string;
  admissionDate?: string;
  dischargeDate?: string;
  lengthOfStay?: number;
  attendingPhysician?: string;
  dischargeDisposition?: string;
  chiefComplaint?: string;
  admissionDiagnosis?: string;
  hospitalCourse?: string;
  dischargeDiagnoses?: DischargeDiagnosis[];
  proceduresPerformed?: ProcedurePerformed[];
  medicationReconciliation?: {
    continued?: MedicationEntry[];
    new?: MedicationEntry[];
    changed?: MedicationChange[];
    discontinued?: MedicationEntry[];
    interactions?: string[];
  };
  dischargePharmacy?: string;
  followUpAppointments?: FollowUpAppointment[];
  pendingTests?: string[];
  pendingConsults?: string[];
  patientInstructions?: PatientInstruction[];
  warningSigns?: WarningSign[];
  activityRestrictions?: string[];
  dietaryInstructions?: string[];
  homeHealthOrdered?: boolean;
  homeHealthAgency?: string;
  dmeOrdered?: boolean;
  dmeItems?: string[];
  readmissionRiskScore?: number;
  confidence?: number;
  reviewReasons?: string[];
  disclaimer?: string;
}

// PHI Redaction
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  const logger = createLogger("ai-discharge-summary", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: DischargeSummaryRequest = await req.json();
    const {
      patientId,
      encounterId,
      tenantId,
      dischargePlanId,
      dischargeDisposition = "home",
      attendingPhysician = "Attending Physician",
      includePatientInstructions = true,
    } = body;

    // Validate required fields
    if (!patientId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: patientId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!encounterId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: encounterId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Gather patient and encounter context
    const context = await gatherPatientContext(
      supabase,
      patientId,
      encounterId,
      dischargePlanId,
      logger
    );

    // Generate discharge summary
    const startTime = Date.now();
    const summary = await generateDischargeSummary(
      context,
      dischargeDisposition,
      attendingPhysician,
      includePatientInstructions,
      logger
    );
    const responseTime = Date.now() - startTime;

    // Log PHI access
    logger.phi("Generated discharge summary", {
      patientId: redact(patientId),
      encounterId,
      responseTimeMs: responseTime,
    });

    // Log usage
    await logUsage(supabase, patientId, tenantId, encounterId, responseTime, logger);

    return new Response(
      JSON.stringify({
        summary,
        metadata: {
          generated_at: new Date().toISOString(),
          model: SONNET_MODEL,
          response_time_ms: responseTime,
          encounter_id: encounterId,
          discharge_disposition: dischargeDisposition,
          context_summary: {
            conditions_count: context.conditions.length,
            procedures_count: context.procedures.length,
            medications_count: context.dischargeMedications.length,
            allergies_count: context.allergies.length,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Discharge summary generation failed", { error: error.message });

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =====================================================
// PATIENT CONTEXT GATHERING
// =====================================================

async function gatherPatientContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  encounterId: string,
  dischargePlanId: string | undefined,
  logger: ReturnType<typeof createLogger>
): Promise<PatientContext> {
  const context: PatientContext = {
    name: "Patient",
    dateOfBirth: "",
    sex: "unknown",
    allergies: [],
    admissionDate: new Date().toISOString(),
    chiefComplaint: "",
    admissionDiagnosis: "",
    conditions: [],
    procedures: [],
    admissionMedications: [],
    dischargeMedications: [],
    vitalSigns: {},
    labResults: [],
    notes: [],
  };

  try {
    // Get patient profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, date_of_birth, sex")
      .eq("user_id", patientId)
      .single();

    if (profile) {
      context.name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Patient";
      context.dateOfBirth = profile.date_of_birth || "";
      context.sex = profile.sex || "unknown";
    }

    // Get encounter details
    const { data: encounter } = await supabase
      .from("encounters")
      .select("*")
      .eq("id", encounterId)
      .single();

    if (encounter) {
      context.admissionDate = encounter.start_datetime || encounter.created_at;
      context.chiefComplaint = encounter.chief_complaint || "";
      context.admissionDiagnosis = encounter.admission_diagnosis || context.chiefComplaint;
    }

    // Get allergies
    const { data: allergies } = await supabase
      .from("fhir_allergy_intolerances")
      .select("code, criticality")
      .eq("patient_id", patientId)
      .limit(20);

    if (allergies) {
      const typedAllergies = allergies as AllergyRecord[];
      context.allergies = typedAllergies.map(
        (a: AllergyRecord) => {
          const display = a.code?.coding?.[0]?.display || a.code?.text || "";
          const criticality = a.criticality === "high" ? " (SEVERE)" : "";
          return display + criticality;
        }
      ).filter(Boolean);
    }

    // Get conditions/diagnoses
    const { data: conditions } = await supabase
      .from("fhir_conditions")
      .select("code, clinical_status, onset_datetime")
      .eq("patient_id", patientId)
      .order("onset_datetime", { ascending: false })
      .limit(20);

    if (conditions) {
      const typedConditions = conditions as ConditionRecord[];
      context.conditions = typedConditions.map((c: ConditionRecord) => ({
        code: c.code?.coding?.[0]?.code || "",
        display: c.code?.coding?.[0]?.display || "",
      })).filter((c) => c.display);
    }

    // Get procedures
    const { data: procedures } = await supabase
      .from("fhir_procedures")
      .select("code, performed_datetime, status")
      .eq("patient_id", patientId)
      .eq("status", "completed")
      .order("performed_datetime", { ascending: false })
      .limit(20);

    if (procedures) {
      const typedProcedures = procedures as ProcedureRecord[];
      context.procedures = typedProcedures.map((p: ProcedureRecord) => ({
        code: p.code?.coding?.[0]?.code || "",
        display: p.code?.coding?.[0]?.display || "",
        date: p.performed_datetime || "",
      })).filter((p) => p.display);
    }

    // Get admission medications (before hospitalization)
    const { data: admissionMeds } = await supabase
      .from("fhir_medication_requests")
      .select("medication_codeable_concept, dosage_instruction")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .lt("authored_on", context.admissionDate)
      .limit(30);

    if (admissionMeds) {
      const typedAdmissionMeds = admissionMeds as MedicationRequestRecord[];
      context.admissionMedications = typedAdmissionMeds.map((m: MedicationRequestRecord) => ({
        name: m.medication_codeable_concept?.coding?.[0]?.display || "",
        dose: m.dosage_instruction?.[0]?.dose_and_rate?.[0]?.dose_quantity?.value || "",
        frequency: m.dosage_instruction?.[0]?.timing?.code?.text || "",
      })).filter((m) => m.name);
    }

    // Get discharge medications (current active)
    const { data: dischargeMeds } = await supabase
      .from("fhir_medication_requests")
      .select("medication_codeable_concept, dosage_instruction, status, intent")
      .eq("patient_id", patientId)
      .in("status", ["active", "completed"])
      .order("authored_on", { ascending: false })
      .limit(30);

    if (dischargeMeds) {
      const typedDischargeMeds = dischargeMeds as MedicationRequestRecord[];
      context.dischargeMedications = typedDischargeMeds.map((m: MedicationRequestRecord) => ({
        name: m.medication_codeable_concept?.coding?.[0]?.display || "",
        dose: m.dosage_instruction?.[0]?.dose_and_rate?.[0]?.dose_quantity?.value || "",
        frequency: m.dosage_instruction?.[0]?.timing?.code?.text || "",
        status: m.status || "active",
      })).filter((m) => m.name);
    }

    // Get recent vital signs
    const { data: vitals } = await supabase
      .from("fhir_observations")
      .select("code, value_quantity_value, value_quantity_unit")
      .eq("patient_id", patientId)
      .gte("effective_datetime", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("effective_datetime", { ascending: false })
      .limit(20);

    if (vitals) {
      const vitalCodeMap: Record<string, string> = {
        "8480-6": "systolic_bp",
        "8462-4": "diastolic_bp",
        "8867-4": "heart_rate",
        "8310-5": "temperature",
        "9279-1": "respiratory_rate",
        "59408-5": "oxygen_saturation",
      };

      for (const vital of vitals) {
        const code = vital.code?.coding?.[0]?.code;
        const vitalName = vitalCodeMap[code];
        if (vitalName && vital.value_quantity_value != null && !context.vitalSigns[vitalName]) {
          context.vitalSigns[vitalName] = {
            value: vital.value_quantity_value,
            unit: vital.value_quantity_unit || "",
          };
        }
      }
    }

    // Get recent lab results
    const { data: labs } = await supabase
      .from("fhir_observations")
      .select("code, value_quantity_value, value_quantity_unit, effective_datetime, interpretation")
      .eq("patient_id", patientId)
      .gte("effective_datetime", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order("effective_datetime", { ascending: false })
      .limit(30);

    if (labs) {
      const typedLabs = labs as LabRecord[];
      context.labResults = typedLabs
        .filter((l: LabRecord) => l.value_quantity_value != null)
        .map((l: LabRecord) => ({
          name: l.code?.coding?.[0]?.display || l.code?.text || "",
          value: String(l.value_quantity_value),
          unit: l.value_quantity_unit || "",
          date: l.effective_datetime || "",
          abnormal: l.interpretation?.coding?.[0]?.code === "A" ||
            l.interpretation?.coding?.[0]?.code === "H" ||
            l.interpretation?.coding?.[0]?.code === "L",
        }))
        .filter((l) => l.name);
    }

    // Get clinical notes
    const { data: notes } = await supabase
      .from("clinical_notes")
      .select("note_type, content, created_at")
      .eq("patient_id", patientId)
      .eq("encounter_id", encounterId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (notes) {
      const typedNotes = notes as NoteRecord[];
      context.notes = typedNotes.map((n: NoteRecord) => `${n.note_type || ""}: ${n.content || ""}`);
    }

    // Get discharge plan if available
    if (dischargePlanId) {
      const { data: plan } = await supabase
        .from("discharge_plans")
        .select("*")
        .eq("id", dischargePlanId)
        .single();

      if (plan) {
        context.dischargePlan = {
          disposition: plan.discharge_disposition,
          followUpDate: plan.follow_up_appointment_date,
          followUpProvider: plan.follow_up_appointment_provider,
          homeHealthNeeded: plan.home_health_needed,
          dmeNeeded: plan.dme_needed,
          readmissionRiskScore: plan.readmission_risk_score,
        };
      }
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather complete patient context", { error: error.message });
  }

  return context;
}

// =====================================================
// DISCHARGE SUMMARY GENERATION
// =====================================================

async function generateDischargeSummary(
  context: PatientContext,
  dischargeDisposition: string,
  attendingPhysician: string,
  includePatientInstructions: boolean,
  logger: ReturnType<typeof createLogger>
): Promise<DischargeSummary> {
  const prompt = buildDischargeSummaryPrompt(
    context,
    dischargeDisposition,
    attendingPhysician,
    includePatientInstructions
  );

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: SONNET_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("Claude API error", { status: response.status, error: errorText });
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return normalizeSummaryResponse(parsed, context, dischargeDisposition, attendingPhysician);
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  // Fallback
  return getDefaultSummary(context, dischargeDisposition, attendingPhysician);
}

function buildDischargeSummaryPrompt(
  context: PatientContext,
  dischargeDisposition: string,
  attendingPhysician: string,
  includePatientInstructions: boolean
): string {
  const sections = [];

  sections.push(`PATIENT INFORMATION:`);
  sections.push(`- Name: ${context.name}`);
  sections.push(`- Date of Birth: ${context.dateOfBirth}`);
  sections.push(`- Sex: ${context.sex}`);
  sections.push(`- Admission Date: ${context.admissionDate}`);
  sections.push(`- Discharge Disposition: ${dischargeDisposition}`);
  sections.push(`- Attending Physician: ${attendingPhysician}`);

  sections.push(`\nCHIEF COMPLAINT: ${context.chiefComplaint || "Not documented"}`);
  sections.push(`ADMISSION DIAGNOSIS: ${context.admissionDiagnosis || "Not documented"}`);

  if (context.allergies.length > 0) {
    sections.push(`\n⚠️ ALLERGIES: ${context.allergies.join(", ")}`);
  } else {
    sections.push(`\nALLERGIES: NKDA (No Known Drug Allergies)`);
  }

  if (context.conditions.length > 0) {
    sections.push(`\nACTIVE DIAGNOSES:`);
    context.conditions.slice(0, 10).forEach((c, i) => {
      sections.push(`${i + 1}. ${c.display} (${c.code})`);
    });
  }

  if (context.procedures.length > 0) {
    sections.push(`\nPROCEDURES PERFORMED:`);
    context.procedures.slice(0, 10).forEach((p) => {
      sections.push(`- ${p.display} (${p.date})`);
    });
  }

  sections.push(`\nADMISSION MEDICATIONS (${context.admissionMedications.length} total):`);
  context.admissionMedications.slice(0, 15).forEach((m) => {
    sections.push(`- ${m.name} ${m.dose} ${m.frequency}`.trim());
  });

  sections.push(`\nDISCHARGE MEDICATIONS (${context.dischargeMedications.length} total):`);
  context.dischargeMedications.slice(0, 15).forEach((m) => {
    sections.push(`- ${m.name} ${m.dose} ${m.frequency} [${m.status}]`.trim());
  });

  if (Object.keys(context.vitalSigns).length > 0) {
    sections.push(`\nMOST RECENT VITAL SIGNS:`);
    for (const [name, data] of Object.entries(context.vitalSigns)) {
      sections.push(`- ${name}: ${data.value} ${data.unit}`);
    }
  }

  if (context.labResults.length > 0) {
    sections.push(`\nKEY LAB RESULTS:`);
    const abnormalLabs = context.labResults.filter((l) => l.abnormal);
    if (abnormalLabs.length > 0) {
      sections.push(`ABNORMAL:`);
      abnormalLabs.slice(0, 10).forEach((l) => {
        sections.push(`- ${l.name}: ${l.value} ${l.unit} ⚠️`);
      });
    }
  }

  if (context.notes.length > 0) {
    sections.push(`\nCLINICAL NOTES SUMMARY:`);
    context.notes.slice(0, 5).forEach((n) => {
      sections.push(`- ${n.substring(0, 200)}...`);
    });
  }

  if (context.dischargePlan) {
    sections.push(`\nDISCHARGE PLAN:`);
    sections.push(`- Disposition: ${context.dischargePlan.disposition}`);
    if (context.dischargePlan.followUpDate) {
      sections.push(`- Follow-up: ${context.dischargePlan.followUpDate} with ${context.dischargePlan.followUpProvider || "PCP"}`);
    }
    sections.push(`- Home Health: ${context.dischargePlan.homeHealthNeeded ? "Yes" : "No"}`);
    sections.push(`- DME: ${context.dischargePlan.dmeNeeded ? "Yes" : "No"}`);
    sections.push(`- Readmission Risk Score: ${context.dischargePlan.readmissionRiskScore}%`);
  }

  return `You are a clinical documentation specialist generating a comprehensive discharge summary.

${sections.join("\n")}

Generate a complete discharge summary following hospital standards. Compare admission and discharge medications to identify:
- CONTINUED: Medications that were continued unchanged
- NEW: Medications started during hospitalization
- CHANGED: Medications with dose/frequency changes
- DISCONTINUED: Medications that were stopped

${includePatientInstructions ? "Include patient-friendly discharge instructions and warning signs." : "Focus on clinical documentation without patient instructions."}

CRITICAL SAFETY REQUIREMENTS:
- Flag all medication changes prominently
- Note any allergy-medication conflicts
- Include red flags/warning signs for the patient
- All summaries require physician review before release

Return a JSON object with this structure:
{
  "patientName": "${context.name}",
  "dateOfBirth": "${context.dateOfBirth}",
  "admissionDate": "${context.admissionDate}",
  "dischargeDate": "${new Date().toISOString()}",
  "lengthOfStay": <calculated days>,
  "attendingPhysician": "${attendingPhysician}",
  "dischargeDisposition": "${dischargeDisposition}",
  "chiefComplaint": "<brief chief complaint>",
  "admissionDiagnosis": "<admission diagnosis>",
  "hospitalCourse": "<1-2 paragraph narrative of hospital course>",
  "dischargeDiagnoses": [
    { "code": "<ICD-10>", "display": "<diagnosis>", "type": "principal|secondary|complication" }
  ],
  "proceduresPerformed": [
    { "code": "<CPT>", "display": "<procedure>", "date": "<date>", "provider": "<name>" }
  ],
  "medicationReconciliation": {
    "continued": [
      { "name": "<drug>", "dose": "<dose>", "route": "oral", "frequency": "<freq>", "indication": "<why>", "instructions": "<how to take>" }
    ],
    "new": [...],
    "changed": [
      { "name": "<drug>", "previousDose": "<old>", "newDose": "<new>", "reason": "<why changed>", "instructions": "<how to take>" }
    ],
    "discontinued": [...],
    "allergies": ${JSON.stringify(context.allergies)},
    "interactions": ["<any drug interactions to note>"]
  },
  "followUpAppointments": [
    { "specialty": "Primary Care", "provider": "<name>", "timeframe": "7 days", "purpose": "<reason>", "urgency": "routine|urgent|as_needed" }
  ],
  "pendingTests": ["<any pending results to follow up>"],
  "pendingConsults": ["<any pending consults>"],
  "patientInstructions": [
    { "category": "activity|diet|wound_care|medication|symptoms|general", "instruction": "<instruction>", "importance": "critical|important|informational" }
  ],
  "warningSigns": [
    { "sign": "<symptom to watch for>", "action": "<what to do>", "urgency": "call_office|urgent_care|emergency" }
  ],
  "activityRestrictions": ["<activity limits>"],
  "dietaryInstructions": ["<diet guidance>"],
  "homeHealthOrdered": ${context.dischargePlan?.homeHealthNeeded || false},
  "homeHealthAgency": "<agency name if ordered>",
  "dmeOrdered": ${context.dischargePlan?.dmeNeeded || false},
  "dmeItems": ["<equipment if ordered>"],
  "readmissionRiskScore": ${context.dischargePlan?.readmissionRiskScore || 50},
  "readmissionRiskCategory": "low|moderate|high|very_high",
  "confidence": 0.0-1.0,
  "requiresReview": true,
  "reviewReasons": ["All AI-generated summaries require physician review"],
  "disclaimer": "This discharge summary was generated with AI assistance and requires physician review and approval before release."
}

Respond with ONLY the JSON object, no other text.`;
}

function normalizeSummaryResponse(
  parsed: ParsedSummary,
  context: PatientContext,
  dischargeDisposition: string,
  attendingPhysician: string
): DischargeSummary {
  // Calculate length of stay
  const admissionDate = new Date(context.admissionDate);
  const dischargeDate = new Date();
  const lengthOfStay = Math.max(1, Math.ceil((dischargeDate.getTime() - admissionDate.getTime()) / (24 * 60 * 60 * 1000)));

  // Determine risk category
  const riskScore = parsed.readmissionRiskScore || context.dischargePlan?.readmissionRiskScore || 50;
  let riskCategory: "low" | "moderate" | "high" | "very_high" = "moderate";
  if (riskScore < 30) riskCategory = "low";
  else if (riskScore < 60) riskCategory = "moderate";
  else if (riskScore < 80) riskCategory = "high";
  else riskCategory = "very_high";

  const summary: DischargeSummary = {
    patientName: parsed.patientName || context.name,
    dateOfBirth: parsed.dateOfBirth || context.dateOfBirth,
    admissionDate: parsed.admissionDate || context.admissionDate,
    dischargeDate: parsed.dischargeDate || new Date().toISOString(),
    lengthOfStay: parsed.lengthOfStay || lengthOfStay,
    attendingPhysician: parsed.attendingPhysician || attendingPhysician,
    dischargeDisposition: parsed.dischargeDisposition || dischargeDisposition,
    chiefComplaint: parsed.chiefComplaint || context.chiefComplaint,
    admissionDiagnosis: parsed.admissionDiagnosis || context.admissionDiagnosis,
    hospitalCourse: parsed.hospitalCourse || "Hospital course documentation requires physician review.",
    dischargeDiagnoses: parsed.dischargeDiagnoses || context.conditions.map((c, i) => ({
      code: c.code,
      display: c.display,
      type: i === 0 ? "principal" : "secondary",
    })),
    proceduresPerformed: parsed.proceduresPerformed || context.procedures.map((p) => ({
      code: p.code,
      display: p.display,
      date: p.date,
    })),
    medicationReconciliation: {
      continued: parsed.medicationReconciliation?.continued || [],
      new: parsed.medicationReconciliation?.new || [],
      changed: parsed.medicationReconciliation?.changed || [],
      discontinued: parsed.medicationReconciliation?.discontinued || [],
      allergies: context.allergies,
      interactions: parsed.medicationReconciliation?.interactions || [],
    },
    dischargePharmacy: parsed.dischargePharmacy,
    followUpAppointments: parsed.followUpAppointments || [
      {
        specialty: "Primary Care",
        timeframe: "7 days",
        purpose: "Post-discharge follow-up",
        urgency: "routine",
      },
    ],
    pendingTests: parsed.pendingTests || [],
    pendingConsults: parsed.pendingConsults || [],
    patientInstructions: parsed.patientInstructions || [],
    warningSigns: parsed.warningSigns || [
      {
        sign: "Fever over 101°F",
        action: "Contact your doctor or go to urgent care",
        urgency: "urgent_care",
      },
      {
        sign: "Severe chest pain or difficulty breathing",
        action: "Call 911 or go to the emergency room immediately",
        urgency: "emergency",
      },
    ],
    activityRestrictions: parsed.activityRestrictions || [],
    dietaryInstructions: parsed.dietaryInstructions || [],
    homeHealthOrdered: parsed.homeHealthOrdered || context.dischargePlan?.homeHealthNeeded || false,
    homeHealthAgency: parsed.homeHealthAgency,
    dmeOrdered: parsed.dmeOrdered || context.dischargePlan?.dmeNeeded || false,
    dmeItems: parsed.dmeItems,
    readmissionRiskScore: riskScore,
    readmissionRiskCategory: riskCategory,
    confidence: parsed.confidence ?? 0.8,
    requiresReview: true, // SAFETY: Always require review
    reviewReasons: [
      "All AI-generated discharge summaries require physician review and approval",
      ...(parsed.reviewReasons || []),
    ],
    disclaimer: parsed.disclaimer || "This discharge summary was generated with AI assistance and requires physician review and approval before release to the patient or external providers.",
  };

  // SAFETY: Add additional review flags
  if (summary.medicationReconciliation.new.length > 0 || summary.medicationReconciliation.changed.length > 0) {
    summary.reviewReasons.push("Medication changes require pharmacist verification");
  }

  if (summary.medicationReconciliation.interactions.length > 0) {
    summary.reviewReasons.unshift("ALERT: Potential drug interactions identified");
  }

  if (riskCategory === "high" || riskCategory === "very_high") {
    summary.reviewReasons.push("High readmission risk - ensure comprehensive discharge planning");
  }

  if (summary.confidence < 0.6) {
    summary.reviewReasons.push("Low confidence score - careful review recommended");
  }

  return summary;
}

function getDefaultSummary(
  context: PatientContext,
  dischargeDisposition: string,
  attendingPhysician: string
): DischargeSummary {
  const admissionDate = new Date(context.admissionDate);
  const dischargeDate = new Date();
  const lengthOfStay = Math.max(1, Math.ceil((dischargeDate.getTime() - admissionDate.getTime()) / (24 * 60 * 60 * 1000)));

  return {
    patientName: context.name,
    dateOfBirth: context.dateOfBirth,
    admissionDate: context.admissionDate,
    dischargeDate: dischargeDate.toISOString(),
    lengthOfStay,
    attendingPhysician,
    dischargeDisposition,
    chiefComplaint: context.chiefComplaint || "Not documented",
    admissionDiagnosis: context.admissionDiagnosis || "Not documented",
    hospitalCourse: "AI summary generation failed. Please document hospital course manually.",
    dischargeDiagnoses: context.conditions.slice(0, 5).map((c, i) => ({
      code: c.code,
      display: c.display,
      type: i === 0 ? "principal" as const : "secondary" as const,
    })),
    proceduresPerformed: context.procedures.slice(0, 10).map((p) => ({
      code: p.code,
      display: p.display,
      date: p.date,
    })),
    medicationReconciliation: {
      continued: [],
      new: [],
      changed: [],
      discontinued: [],
      allergies: context.allergies,
      interactions: [],
    },
    followUpAppointments: [
      {
        specialty: "Primary Care",
        timeframe: "7 days",
        purpose: "Post-discharge follow-up",
        urgency: "routine",
      },
    ],
    pendingTests: [],
    pendingConsults: [],
    patientInstructions: [
      {
        category: "general",
        instruction: "Follow up with your primary care provider within 7 days",
        importance: "critical",
      },
    ],
    warningSigns: [
      {
        sign: "Fever over 101°F that does not respond to medication",
        action: "Contact your doctor or go to urgent care",
        urgency: "urgent_care",
      },
      {
        sign: "Severe chest pain or difficulty breathing",
        action: "Call 911 or go to the emergency room immediately",
        urgency: "emergency",
      },
    ],
    activityRestrictions: [],
    dietaryInstructions: [],
    homeHealthOrdered: context.dischargePlan?.homeHealthNeeded || false,
    dmeOrdered: context.dischargePlan?.dmeNeeded || false,
    readmissionRiskScore: context.dischargePlan?.readmissionRiskScore || 50,
    readmissionRiskCategory: "moderate",
    confidence: 0.3,
    requiresReview: true,
    reviewReasons: [
      "AI summary generation failed - manual documentation required",
      "Medication reconciliation requires manual review",
      "All fields require physician verification",
    ],
    disclaimer: "This is a template discharge summary. Complete documentation and physician review required before release.",
  };
}

// =====================================================
// USAGE LOGGING
// =====================================================

async function logUsage(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  tenantId: string | undefined,
  encounterId: string,
  responseTimeMs: number,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    const estimatedInputTokens = 3000;
    const estimatedOutputTokens = 2500;
    const cost = (estimatedInputTokens / 1_000_000) * 3 + (estimatedOutputTokens / 1_000_000) * 15;

    await supabase.from("claude_usage_logs").insert({
      user_id: patientId,
      tenant_id: tenantId,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: "discharge_summary",
      input_tokens: estimatedInputTokens,
      output_tokens: estimatedOutputTokens,
      cost: cost,
      response_time_ms: responseTimeMs,
      success: true,
      metadata: { encounter_id: encounterId },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to log usage", { error: error.message });
  }
}
