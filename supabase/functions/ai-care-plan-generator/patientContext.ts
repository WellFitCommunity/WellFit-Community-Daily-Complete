/**
 * Patient Context Gathering for AI Care Plan Generator
 *
 * Queries database tables to build a comprehensive patient context:
 * - Demographics from profiles
 * - Conditions from fhir_conditions + patient_diagnoses
 * - Medications from fhir_medication_requests
 * - Recent vitals from fhir_observations
 * - SDOH factors from sdoh_assessments
 * - Utilization history from patient_readmissions
 * - Allergies from fhir_allergy_intolerances
 *
 * @module ai-care-plan-generator/patientContext
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/auditLogger.ts";
import type {
  PatientContext,
  FHIRConditionRecord,
  DiagnosisRecord,
  FHIRMedicationRecord,
  ReadmissionRecord,
  FHIRAllergyRecord,
} from "./types.ts";

/**
 * Gather comprehensive patient context for care plan generation.
 *
 * Fetches demographics, conditions, medications, vitals, SDOH,
 * utilization history, and allergies from the database.
 */
export async function gatherPatientContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  includeSDOH: boolean,
  includeMedications: boolean,
  logger: ReturnType<typeof createLogger>
): Promise<PatientContext> {
  const context: PatientContext = {
    demographics: { ageGroup: "unknown", preferredLanguage: "English" },
    conditions: [],
    medications: [],
    vitals: {},
    sdohFactors: null,
    utilizationHistory: {
      edVisits30Days: 0,
      edVisits90Days: 0,
      admissions30Days: 0,
      admissions90Days: 0,
      readmissionRisk: "low",
    },
    allergies: [],
    careGaps: [],
  };

  try {
    await fetchDemographics(supabase, patientId, context);
    await fetchConditions(supabase, patientId, context);

    if (includeMedications) {
      await fetchMedications(supabase, patientId, context);
    }

    await fetchVitals(supabase, patientId, context);

    if (includeSDOH) {
      await fetchSDOH(supabase, patientId, context);
    }

    await fetchUtilizationHistory(supabase, patientId, context);
    await fetchAllergies(supabase, patientId, context);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather complete patient context", {
      error: error.message,
    });
  }

  return context;
}

// =====================================================
// INTERNAL HELPERS
// =====================================================

async function fetchDemographics(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("date_of_birth, preferred_language")
    .eq("user_id", patientId)
    .single();

  if (profile?.date_of_birth) {
    const age = Math.floor(
      (Date.now() - new Date(profile.date_of_birth).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000)
    );
    if (age < 18) context.demographics.ageGroup = "pediatric";
    else if (age < 40) context.demographics.ageGroup = "young_adult";
    else if (age < 65) context.demographics.ageGroup = "adult";
    else context.demographics.ageGroup = "geriatric";
  }

  if (profile?.preferred_language) {
    context.demographics.preferredLanguage = profile.preferred_language;
  }
}

async function fetchConditions(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: fhirConditions } = await supabase
    .from("fhir_conditions")
    .select("code, clinical_status")
    .eq("patient_id", patientId)
    .order("recorded_date", { ascending: false })
    .limit(20);

  const { data: diagnoses } = await supabase
    .from("patient_diagnoses")
    .select("diagnosis_name, icd10_code, is_primary, status")
    .eq("patient_id", patientId)
    .eq("status", "active")
    .limit(15);

  if (fhirConditions) {
    const typedConditions = fhirConditions as FHIRConditionRecord[];
    context.conditions = typedConditions.map((c) => ({
      code: c.code?.coding?.[0]?.code || "",
      display: c.code?.coding?.[0]?.display || "",
      status: c.clinical_status || "active",
      isPrimary: false,
    }));
  }

  if (diagnoses) {
    const typedDiagnoses = diagnoses as DiagnosisRecord[];
    typedDiagnoses.forEach((d) => {
      const existing = context.conditions.find(
        (c) => c.code === d.icd10_code
      );
      if (existing) {
        existing.isPrimary = d.is_primary ?? false;
      } else {
        context.conditions.push({
          code: d.icd10_code || "",
          display: d.diagnosis_name || "",
          status: d.status || "active",
          isPrimary: d.is_primary ?? false,
        });
      }
    });
  }
}

async function fetchMedications(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: medications } = await supabase
    .from("fhir_medication_requests")
    .select("medication_codeable_concept, dosage_instruction")
    .eq("patient_id", patientId)
    .eq("status", "active")
    .limit(20);

  if (medications) {
    const typedMeds = medications as FHIRMedicationRecord[];
    context.medications = typedMeds.map((m) => ({
      name:
        m.medication_codeable_concept?.coding?.[0]?.display || "",
      dosage:
        m.dosage_instruction?.[0]?.dose_and_rate?.[0]?.dose_quantity?.value?.toString() ||
        "",
      frequency:
        m.dosage_instruction?.[0]?.timing?.code?.text || "",
    }));
  }
}

/** LOINC code to human-readable vital name mapping */
const VITAL_CODE_MAP: Record<string, string> = {
  "8480-6": "blood_pressure_systolic",
  "8462-4": "blood_pressure_diastolic",
  "8867-4": "heart_rate",
  "29463-7": "weight",
  "4548-4": "hba1c",
  "2339-0": "glucose",
  "2093-3": "cholesterol",
};

async function fetchVitals(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: vitals } = await supabase
    .from("fhir_observations")
    .select(
      "code, value_quantity_value, value_quantity_unit, effective_datetime"
    )
    .eq("patient_id", patientId)
    .gte("effective_datetime", sevenDaysAgo)
    .order("effective_datetime", { ascending: false });

  if (vitals) {
    for (const obs of vitals) {
      const code = obs.code?.coding?.[0]?.code;
      const vitalName = VITAL_CODE_MAP[code];
      if (
        vitalName &&
        obs.value_quantity_value != null &&
        !context.vitals[vitalName]
      ) {
        context.vitals[vitalName] = {
          value: obs.value_quantity_value,
          unit: obs.value_quantity_unit || "",
          date: obs.effective_datetime,
        };
      }
    }
  }
}

async function fetchSDOH(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: sdoh } = await supabase
    .from("sdoh_assessments")
    .select(
      "housing_instability, food_insecurity, transportation_barriers, social_isolation, financial_strain, risk_level, overall_complexity_score"
    )
    .eq("patient_id", patientId)
    .order("assessed_at", { ascending: false })
    .limit(1)
    .single();

  if (sdoh) {
    context.sdohFactors = {
      housing: sdoh.housing_instability ? "unstable" : "stable",
      food: sdoh.food_insecurity ? "insecure" : "secure",
      transportation: sdoh.transportation_barriers
        ? "barriers"
        : "adequate",
      social: sdoh.social_isolation ? "isolated" : "supported",
      financial: sdoh.financial_strain ? "strained" : "stable",
      overallRisk: sdoh.risk_level || "unknown",
      complexityScore: sdoh.overall_complexity_score || 0,
    };
  }
}

async function fetchUtilizationHistory(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const ninetyDaysAgo = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: readmissions } = await supabase
    .from("patient_readmissions")
    .select("admission_date, facility_type")
    .eq("patient_id", patientId)
    .gte("admission_date", ninetyDaysAgo);

  if (readmissions) {
    const typedReadmissions = readmissions as ReadmissionRecord[];
    typedReadmissions.forEach((r) => {
      const isRecent =
        new Date(r.admission_date) >= new Date(thirtyDaysAgo);
      if (r.facility_type === "emergency") {
        if (isRecent) context.utilizationHistory.edVisits30Days++;
        context.utilizationHistory.edVisits90Days++;
      } else {
        if (isRecent) context.utilizationHistory.admissions30Days++;
        context.utilizationHistory.admissions90Days++;
      }
    });
  }

  // Calculate readmission risk level
  const riskScore =
    context.utilizationHistory.edVisits30Days * 3 +
    context.utilizationHistory.admissions30Days * 5 +
    context.utilizationHistory.edVisits90Days * 1 +
    context.utilizationHistory.admissions90Days * 2;

  if (riskScore >= 10)
    context.utilizationHistory.readmissionRisk = "critical";
  else if (riskScore >= 6)
    context.utilizationHistory.readmissionRisk = "high";
  else if (riskScore >= 3)
    context.utilizationHistory.readmissionRisk = "medium";
}

async function fetchAllergies(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  context: PatientContext
): Promise<void> {
  const { data: allergies } = await supabase
    .from("fhir_allergy_intolerances")
    .select("code")
    .eq("patient_id", patientId)
    .limit(10);

  if (allergies) {
    const typedAllergies = allergies as FHIRAllergyRecord[];
    context.allergies = typedAllergies
      .map(
        (a) => a.code?.coding?.[0]?.display || a.code?.text || ""
      )
      .filter(Boolean);
  }
}
