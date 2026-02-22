/**
 * Patient context gathering for discharge summary generation
 *
 * Queries patient demographics, encounter details, allergies, conditions,
 * procedures, medications, vitals, labs, clinical notes, and discharge plans
 * from the database to build a comprehensive context for AI summarization.
 *
 * @module ai-discharge-summary/patientContext
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/auditLogger.ts";
import type {
  PatientContext,
  AllergyRecord,
  ConditionRecord,
  ProcedureRecord,
  MedicationRequestRecord,
  LabRecord,
  NoteRecord,
} from "./types.ts";

/** LOINC code to vital sign name mapping */
const VITAL_CODE_MAP: Record<string, string> = {
  "8480-6": "systolic_bp",
  "8462-4": "diastolic_bp",
  "8867-4": "heart_rate",
  "8310-5": "temperature",
  "9279-1": "respiratory_rate",
  "59408-5": "oxygen_saturation",
};

/**
 * Gather comprehensive patient context from multiple database tables
 * for discharge summary generation.
 *
 * Gracefully handles missing data -- partial context is returned
 * even if some queries fail.
 */
export async function gatherPatientContext(
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
      .select("start_datetime, created_at, chief_complaint, admission_diagnosis")
      .eq("id", encounterId)
      .single();

    if (encounter) {
      context.admissionDate = encounter.start_datetime || encounter.created_at;
      context.chiefComplaint = encounter.chief_complaint || "";
      context.admissionDiagnosis = encounter.admission_diagnosis || context.chiefComplaint;
    }

    // Get allergies
    await gatherAllergies(supabase, patientId, context);

    // Get conditions/diagnoses
    await gatherConditions(supabase, patientId, context);

    // Get procedures
    await gatherProcedures(supabase, patientId, context);

    // Get admission medications (before hospitalization)
    await gatherAdmissionMedications(supabase, patientId, context);

    // Get discharge medications (current active)
    await gatherDischargeMedications(supabase, patientId, context);

    // Get recent vital signs
    await gatherVitalSigns(supabase, patientId, context);

    // Get recent lab results
    await gatherLabResults(supabase, patientId, context);

    // Get clinical notes
    await gatherClinicalNotes(supabase, patientId, encounterId, context);

    // Get discharge plan if available
    await gatherDischargePlan(supabase, dischargePlanId, context);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather complete patient context", { error: error.message });
  }

  return context;
}

// =====================================================
// INDIVIDUAL DATA GATHERING FUNCTIONS
// =====================================================

async function gatherAllergies(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: allergies } = await supabase
    .from("fhir_allergy_intolerances")
    .select("code, criticality")
    .eq("patient_id", patientId)
    .limit(20);

  if (allergies) {
    const typedAllergies = allergies as AllergyRecord[];
    context.allergies = typedAllergies
      .map((a: AllergyRecord) => {
        const display = a.code?.coding?.[0]?.display || a.code?.text || "";
        const criticality = a.criticality === "high" ? " (SEVERE)" : "";
        return display + criticality;
      })
      .filter(Boolean);
  }
}

async function gatherConditions(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: conditions } = await supabase
    .from("fhir_conditions")
    .select("code, clinical_status, onset_datetime")
    .eq("patient_id", patientId)
    .order("onset_datetime", { ascending: false })
    .limit(20);

  if (conditions) {
    const typedConditions = conditions as ConditionRecord[];
    context.conditions = typedConditions
      .map((c: ConditionRecord) => ({
        code: c.code?.coding?.[0]?.code || "",
        display: c.code?.coding?.[0]?.display || "",
      }))
      .filter((c) => c.display);
  }
}

async function gatherProcedures(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: procedures } = await supabase
    .from("fhir_procedures")
    .select("code, performed_datetime, status")
    .eq("patient_id", patientId)
    .eq("status", "completed")
    .order("performed_datetime", { ascending: false })
    .limit(20);

  if (procedures) {
    const typedProcedures = procedures as ProcedureRecord[];
    context.procedures = typedProcedures
      .map((p: ProcedureRecord) => ({
        code: p.code?.coding?.[0]?.code || "",
        display: p.code?.coding?.[0]?.display || "",
        date: p.performed_datetime || "",
      }))
      .filter((p) => p.display);
  }
}

async function gatherAdmissionMedications(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: admissionMeds } = await supabase
    .from("fhir_medication_requests")
    .select("medication_codeable_concept, dosage_instruction")
    .eq("patient_id", patientId)
    .eq("status", "active")
    .lt("authored_on", context.admissionDate)
    .limit(30);

  if (admissionMeds) {
    const typedAdmissionMeds = admissionMeds as MedicationRequestRecord[];
    context.admissionMedications = typedAdmissionMeds
      .map((m: MedicationRequestRecord) => ({
        name: m.medication_codeable_concept?.coding?.[0]?.display || "",
        dose: m.dosage_instruction?.[0]?.dose_and_rate?.[0]?.dose_quantity?.value || "",
        frequency: m.dosage_instruction?.[0]?.timing?.code?.text || "",
      }))
      .filter((m) => m.name);
  }
}

async function gatherDischargeMedications(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: dischargeMeds } = await supabase
    .from("fhir_medication_requests")
    .select("medication_codeable_concept, dosage_instruction, status, intent")
    .eq("patient_id", patientId)
    .in("status", ["active", "completed"])
    .order("authored_on", { ascending: false })
    .limit(30);

  if (dischargeMeds) {
    const typedDischargeMeds = dischargeMeds as MedicationRequestRecord[];
    context.dischargeMedications = typedDischargeMeds
      .map((m: MedicationRequestRecord) => ({
        name: m.medication_codeable_concept?.coding?.[0]?.display || "",
        dose: m.dosage_instruction?.[0]?.dose_and_rate?.[0]?.dose_quantity?.value || "",
        frequency: m.dosage_instruction?.[0]?.timing?.code?.text || "",
        status: m.status || "active",
      }))
      .filter((m) => m.name);
  }
}

async function gatherVitalSigns(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: vitals } = await supabase
    .from("fhir_observations")
    .select("code, value_quantity_value, value_quantity_unit")
    .eq("patient_id", patientId)
    .gte("effective_datetime", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("effective_datetime", { ascending: false })
    .limit(20);

  if (vitals) {
    for (const vital of vitals) {
      const code = vital.code?.coding?.[0]?.code;
      const vitalName = VITAL_CODE_MAP[code];
      if (vitalName && vital.value_quantity_value != null && !context.vitalSigns[vitalName]) {
        context.vitalSigns[vitalName] = {
          value: vital.value_quantity_value,
          unit: vital.value_quantity_unit || "",
        };
      }
    }
  }
}

async function gatherLabResults(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
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
        abnormal:
          l.interpretation?.coding?.[0]?.code === "A" ||
          l.interpretation?.coding?.[0]?.code === "H" ||
          l.interpretation?.coding?.[0]?.code === "L",
      }))
      .filter((l) => l.name);
  }
}

async function gatherClinicalNotes(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  encounterId: string,
  context: PatientContext
): Promise<void> {
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
}

async function gatherDischargePlan(
  supabase: ReturnType<typeof createClient>,
  dischargePlanId: string | undefined,
  context: PatientContext
): Promise<void> {
  if (!dischargePlanId) return;

  const { data: plan } = await supabase
    .from("discharge_plans")
    .select("discharge_disposition, follow_up_appointment_date, follow_up_appointment_provider, home_health_needed, dme_needed, readmission_risk_score")
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
