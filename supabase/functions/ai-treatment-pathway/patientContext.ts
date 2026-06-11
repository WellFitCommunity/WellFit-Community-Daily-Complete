/**
 * Patient context gathering for the AI Treatment Pathway Recommender.
 *
 * Aggregates demographics, conditions, medications, allergies, SDOH factors,
 * recent labs, and vitals from FHIR tables, then derives contraindications and
 * allergy conflicts used to ground the AI prompt.
 *
 * @module ai-treatment-pathway/patientContext
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { createLogger } from "../_shared/auditLogger.ts";
import type {
  PatientContext,
  FHIRConditionRecord,
  FHIRMedicationRecord,
  FHIRAllergyRecord,
} from "./types.ts";

export async function gatherPatientContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  logger: ReturnType<typeof createLogger>
): Promise<PatientContext> {
  const context: PatientContext = {
    demographics: { ageGroup: "adult", sex: "unknown" },
    conditions: [],
    medications: [],
    allergies: [],
    contraindications: [],
    sdohFactors: {
      hasTransportationBarriers: false,
      hasFinancialBarriers: false,
      hasSocialSupport: true,
    },
    recentLabs: {},
    vitals: {},
  };

  try {
    // Get patient demographics
    const { data: profile } = await supabase
      .from("profiles")
      // profiles columns are dob/gender (not date_of_birth/sex); alias to keep shape
      .select("date_of_birth:dob, sex:gender")
      .eq("user_id", patientId)
      .single();

    if (profile?.date_of_birth) {
      const age = Math.floor(
        (Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      if (age < 18) context.demographics.ageGroup = "pediatric";
      else if (age < 40) context.demographics.ageGroup = "young_adult";
      else if (age < 65) context.demographics.ageGroup = "adult";
      else if (age < 80) context.demographics.ageGroup = "elderly";
      else context.demographics.ageGroup = "very_elderly";
    }
    if (profile?.sex) {
      context.demographics.sex = profile.sex;
    }

    // Get active conditions
    const { data: conditions } = await supabase
      .from("fhir_conditions")
      .select("code, clinical_status")
      .eq("patient_id", patientId)
      .eq("clinical_status", "active")
      .limit(20);

    if (conditions) {
      const typedConditions = conditions as FHIRConditionRecord[];
      context.conditions = typedConditions.map((c) => ({
        code: c.code?.coding?.[0]?.code || "",
        display: c.code?.coding?.[0]?.display || "",
      }));
    }

    // Get active medications
    const { data: medications } = await supabase
      .from("fhir_medication_requests")
      .select("medication_codeable_concept")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(30);

    if (medications) {
      const typedMedications = medications as FHIRMedicationRecord[];
      context.medications = typedMedications.map((m) => ({
        name: m.medication_codeable_concept?.coding?.[0]?.display || "",
        rxcui: m.medication_codeable_concept?.rxcui,
      }));
    }

    // Get allergies
    const { data: allergies } = await supabase
      .from("fhir_allergy_intolerances")
      .select("code, criticality")
      .eq("patient_id", patientId)
      .limit(20);

    if (allergies) {
      const typedAllergies = allergies as FHIRAllergyRecord[];
      context.allergies = typedAllergies.map(
        (a) => a.code?.coding?.[0]?.display || a.code?.text || ""
      ).filter(Boolean);
    }

    // Derive contraindications from conditions
    context.contraindications = deriveContraindications(context.conditions, context.medications);

    // Get SDOH factors
    const { data: sdoh } = await supabase
      .from("sdoh_assessments")
      .select("transportation_barriers, financial_strain, social_isolation")
      .eq("patient_id", patientId)
      .order("assessed_at", { ascending: false })
      .limit(1)
      .single();

    if (sdoh) {
      context.sdohFactors = {
        hasTransportationBarriers: sdoh.transportation_barriers || false,
        hasFinancialBarriers: sdoh.financial_strain || false,
        hasSocialSupport: !sdoh.social_isolation,
      };
    }

    // Get recent labs
    const { data: labs } = await supabase
      .from("fhir_observations")
      .select("code, value_quantity_value, value_quantity_unit, effective_datetime")
      .eq("patient_id", patientId)
      .gte("effective_datetime", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("effective_datetime", { ascending: false })
      .limit(50);

    if (labs) {
      const labCodeMap: Record<string, string> = {
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
      };

      for (const lab of labs) {
        const code = lab.code?.coding?.[0]?.code;
        const labName = labCodeMap[code];
        if (labName && lab.value_quantity_value != null && !context.recentLabs[labName]) {
          context.recentLabs[labName] = {
            value: lab.value_quantity_value,
            unit: lab.value_quantity_unit || "",
            date: lab.effective_datetime,
          };
        }
      }
    }

    // Get vitals
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
        "29463-7": "weight",
        "39156-5": "bmi",
      };

      for (const vital of vitals) {
        const code = vital.code?.coding?.[0]?.code;
        const vitalName = vitalCodeMap[code];
        if (vitalName && vital.value_quantity_value != null && !context.vitals[vitalName]) {
          context.vitals[vitalName] = {
            value: vital.value_quantity_value,
            unit: vital.value_quantity_unit || "",
          };
        }
      }
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather complete patient context", { error: error.message });
  }

  return context;
}

/**
 * Derive contraindications from patient conditions and medications
 */
export function deriveContraindications(
  conditions: Array<{ code: string; display: string }>,
  medications: Array<{ name: string }>
): string[] {
  const contraindications: string[] = [];

  // Check conditions for common contraindications
  const conditionLower = conditions.map((c) => c.display.toLowerCase()).join(" ");

  if (conditionLower.includes("kidney") || conditionLower.includes("renal")) {
    contraindications.push("Renal impairment - dose adjustments may be required");
  }
  if (conditionLower.includes("liver") || conditionLower.includes("hepatic")) {
    contraindications.push("Hepatic impairment - avoid hepatotoxic medications");
  }
  if (conditionLower.includes("heart failure")) {
    contraindications.push("Heart failure - avoid fluid-retaining medications");
  }
  if (conditionLower.includes("bleeding") || conditionLower.includes("coagulopathy")) {
    contraindications.push("Bleeding risk - caution with anticoagulants/NSAIDs");
  }

  return contraindications;
}

/**
 * Check for allergy conflicts with common treatments for a condition
 */
export function checkAllergyConflicts(allergies: string[], condition: string): string[] {
  const conflicts: string[] = [];
  const allergyLower = allergies.map((a) => a.toLowerCase());
  const conditionLower = condition.toLowerCase();

  // Common allergy-condition conflicts
  if (conditionLower.includes("infection") && allergyLower.some((a) => a.includes("penicillin"))) {
    conflicts.push("Penicillin allergy - avoid penicillin-class antibiotics");
  }
  if (conditionLower.includes("pain") && allergyLower.some((a) => a.includes("nsaid") || a.includes("aspirin"))) {
    conflicts.push("NSAID/Aspirin allergy - avoid NSAIDs for pain management");
  }
  if (allergyLower.some((a) => a.includes("sulfa"))) {
    conflicts.push("Sulfa allergy - avoid sulfonamide medications");
  }
  if (allergyLower.some((a) => a.includes("ace inhibitor"))) {
    conflicts.push("ACE inhibitor sensitivity - consider ARBs instead");
  }
  if (allergyLower.some((a) => a.includes("statin"))) {
    conflicts.push("Statin intolerance - consider alternative lipid-lowering therapy");
  }

  return conflicts;
}
