/**
 * Patient Context Gathering
 *
 * Fetches patient demographics, conditions, medications, allergies,
 * labs, vitals, and screening history from the database.
 *
 * @module ai-clinical-guideline-matcher/patientContext
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { EdgeFunctionLogger } from "../_shared/auditLogger.ts";
import type {
  PatientContext,
  ConditionRecord,
  MedicationRecord,
  AllergyRecord,
} from "./types.ts";

// =====================================================
// LOINC CODE MAPS
// =====================================================

/** Maps LOINC codes to human-readable lab names */
const LAB_CODE_MAP: Record<string, string> = {
  "4548-4": "hba1c",
  "2339-0": "glucose",
  "2093-3": "total_cholesterol",
  "2085-9": "hdl",
  "13457-7": "ldl",
  "2571-8": "triglycerides",
  "2160-0": "creatinine",
  "33914-3": "egfr",
  "17861-6": "calcium",
  "3016-3": "tsh",
  "1742-6": "alt",
  "1920-8": "ast",
  "718-7": "hemoglobin",
  "4544-3": "hematocrit",
  "777-3": "platelets",
  "2951-2": "sodium",
  "2823-3": "potassium",
  "1751-7": "albumin",
  "5902-2": "pt_inr",
};

/** Maps LOINC codes to human-readable vital names */
const VITAL_CODE_MAP: Record<string, string> = {
  "8480-6": "systolic_bp",
  "8462-4": "diastolic_bp",
  "8867-4": "heart_rate",
  "29463-7": "weight",
  "39156-5": "bmi",
  "8310-5": "temperature",
  "9279-1": "respiratory_rate",
  "2708-6": "oxygen_saturation",
};

/** Maps procedure/screening codes to screening names */
const SCREENING_CODES: Record<string, string> = {
  "73761001": "colonoscopy",
  "77067": "mammogram",
  "91141-3": "pap_smear",
  "24619-6": "bone_density",
  "87628": "lung_cancer",
};

// =====================================================
// Database record types for observations and procedures
// =====================================================

interface ObservationRecord {
  code?: { coding?: Array<{ code?: string }> };
  value_quantity_value?: number;
  value_quantity_unit?: string;
  effective_datetime?: string;
}

interface ProcedureRecord {
  code?: { coding?: Array<{ code?: string }> };
  performed_datetime?: string;
}

// =====================================================
// PATIENT CONTEXT GATHERING
// =====================================================

/**
 * Gathers comprehensive patient context from the database.
 * Includes demographics, conditions, medications, allergies,
 * recent labs, vitals, and screening history.
 */
export async function gatherPatientContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  logger: EdgeFunctionLogger
): Promise<PatientContext> {
  const context: PatientContext = {
    demographics: { age: 50, ageGroup: "adult", sex: "unknown" },
    conditions: [],
    medications: [],
    allergies: [],
    recentLabs: {},
    vitals: {},
    lastScreenings: {},
  };

  try {
    await gatherDemographics(supabase, patientId, context);
    await gatherConditions(supabase, patientId, context);
    await gatherMedications(supabase, patientId, context);
    await gatherAllergies(supabase, patientId, context);
    await gatherRecentLabs(supabase, patientId, context);
    await gatherVitals(supabase, patientId, context);
    await gatherScreeningHistory(supabase, patientId, context);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather complete patient context", { error: error.message });
  }

  return context;
}

// =====================================================
// INDIVIDUAL CONTEXT GATHERERS
// =====================================================

async function gatherDemographics(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("date_of_birth, sex")
    .eq("user_id", patientId)
    .single();

  if (profile?.date_of_birth) {
    const age = Math.floor(
      (Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );
    context.demographics.age = age;
    if (age < 18) context.demographics.ageGroup = "pediatric";
    else if (age < 40) context.demographics.ageGroup = "young_adult";
    else if (age < 65) context.demographics.ageGroup = "adult";
    else if (age < 80) context.demographics.ageGroup = "elderly";
    else context.demographics.ageGroup = "very_elderly";
  }
  if (profile?.sex) {
    context.demographics.sex = profile.sex;
  }
}

async function gatherConditions(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: conditions } = await supabase
    .from("fhir_conditions")
    .select("code, clinical_status")
    .eq("patient_id", patientId)
    .eq("clinical_status", "active")
    .limit(30);

  if (conditions) {
    const typedConditions = conditions as ConditionRecord[];
    context.conditions = typedConditions.map((c: ConditionRecord) => ({
      code: c.code?.coding?.[0]?.code || "",
      display: c.code?.coding?.[0]?.display || "",
    }));
  }
}

async function gatherMedications(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: medications } = await supabase
    .from("fhir_medication_requests")
    .select("medication_codeable_concept")
    .eq("patient_id", patientId)
    .eq("status", "active")
    .limit(50);

  if (medications) {
    const typedMedications = medications as MedicationRecord[];
    context.medications = typedMedications.map((m: MedicationRecord) => ({
      name: m.medication_codeable_concept?.coding?.[0]?.display || "",
      rxcui: m.medication_codeable_concept?.rxcui,
    }));
  }
}

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
      .map((a: AllergyRecord) => a.code?.coding?.[0]?.display || a.code?.text || "")
      .filter(Boolean);
  }
}

async function gatherRecentLabs(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: labs } = await supabase
    .from("fhir_observations")
    .select("code, value_quantity_value, value_quantity_unit, effective_datetime")
    .eq("patient_id", patientId)
    .gte("effective_datetime", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
    .order("effective_datetime", { ascending: false })
    .limit(100);

  if (labs) {
    const typedLabs = labs as ObservationRecord[];
    for (const lab of typedLabs) {
      const code = lab.code?.coding?.[0]?.code;
      if (!code) continue;
      const labName = LAB_CODE_MAP[code];
      if (labName && lab.value_quantity_value != null && !context.recentLabs[labName]) {
        context.recentLabs[labName] = {
          value: lab.value_quantity_value,
          unit: lab.value_quantity_unit || "",
          date: lab.effective_datetime || "",
        };
      }
    }
  }
}

async function gatherVitals(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: vitals } = await supabase
    .from("fhir_observations")
    .select("code, value_quantity_value, value_quantity_unit")
    .eq("patient_id", patientId)
    .gte("effective_datetime", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order("effective_datetime", { ascending: false })
    .limit(30);

  if (vitals) {
    const typedVitals = vitals as ObservationRecord[];
    for (const vital of typedVitals) {
      const code = vital.code?.coding?.[0]?.code;
      if (!code) continue;
      const vitalName = VITAL_CODE_MAP[code];
      if (vitalName && vital.value_quantity_value != null && !context.vitals[vitalName]) {
        context.vitals[vitalName] = {
          value: vital.value_quantity_value,
          unit: vital.value_quantity_unit || "",
        };
      }
    }
  }
}

async function gatherScreeningHistory(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: procedures } = await supabase
    .from("fhir_procedures")
    .select("code, performed_datetime")
    .eq("patient_id", patientId)
    .order("performed_datetime", { ascending: false })
    .limit(50);

  if (procedures) {
    const typedProcedures = procedures as ProcedureRecord[];
    for (const proc of typedProcedures) {
      const code = proc.code?.coding?.[0]?.code;
      if (!code) continue;
      const screeningName = SCREENING_CODES[code];
      if (screeningName && proc.performed_datetime && !context.lastScreenings[screeningName]) {
        context.lastScreenings[screeningName] = proc.performed_datetime;
      }
    }
  }
}
