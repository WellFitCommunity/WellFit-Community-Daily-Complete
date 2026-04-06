/**
 * Encounter Context Gatherer
 *
 * Gathers comprehensive clinical context from FHIR resources
 * for SOAP note generation.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/auditLogger.ts";
import type {
  EncounterContext,
  FHIRConditionRecord,
  FHIRMedicationRecord,
  FHIRAllergyRecord,
  DiagnosisRecord,
} from "./types.ts";

/**
 * Gather comprehensive encounter context for SOAP note generation
 */
export async function gatherEncounterContext(
  supabase: SupabaseClient,
  encounterId: string,
  patientId: string | undefined,
  includeTranscript: boolean,
  providerNotes: string | undefined,
  logger: ReturnType<typeof createLogger>
): Promise<EncounterContext> {
  const context: EncounterContext = {
    visitType: "general",
    vitals: {},
    diagnoses: [],
    medications: [],
    labResults: [],
    allergies: [],
    medicalHistory: [],
    providerNotes,
  };

  try {
    // Get encounter details
    interface EncounterRow {
      id: string;
      patient_id: string | null;
      chief_complaint: string | null;
      encounter_type: string | null;
      start_time: string | null;
      end_time: string | null;
    }
    const { data: encounterRaw } = await supabase
      .from("encounters")
      .select("id, patient_id, chief_complaint, encounter_type, start_time, end_time")
      .eq("id", encounterId)
      .single();

    const encounter = encounterRaw as unknown as EncounterRow | null;

    if (encounter) {
      context.chiefComplaint = encounter.chief_complaint ?? undefined;
      context.visitType = encounter.encounter_type || "general";

      if (encounter.start_time && encounter.end_time) {
        const start = new Date(encounter.start_time);
        const end = new Date(encounter.end_time);
        context.durationMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
      }

      const resolvedPatientId = patientId || encounter.patient_id;

      if (resolvedPatientId) {
        await gatherPatientData(supabase, resolvedPatientId, encounterId, includeTranscript, context);
      }
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather full encounter context", { error: error.message });
  }

  return context;
}

/**
 * Gather patient-specific clinical data (vitals, diagnoses, meds, allergies, history, transcript)
 */
async function gatherPatientData(
  supabase: SupabaseClient,
  patientId: string,
  encounterId: string,
  includeTranscript: boolean,
  context: EncounterContext
): Promise<void> {
  // Get vitals from fhir_observations
  const { data: vitalsData } = await supabase
    .from("fhir_observations")
    .select("code, value_quantity_value, value_quantity_unit, effective_datetime")
    .eq("patient_id", patientId)
    .gte("effective_datetime", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("effective_datetime", { ascending: false });

  // Cast vitals data at system boundary — fhir_observations has JSONB columns
  interface VitalObservation {
    code: { coding?: { code?: string }[] } | null;
    value_quantity_value: number | null;
    value_quantity_unit: string | null;
    effective_datetime: string | null;
  }
  const typedVitals = (vitalsData ?? []) as unknown as VitalObservation[];

  if (typedVitals.length > 0) {
    const vitalCodeMap: Record<string, string> = {
      "8310-5": "temperature",
      "8480-6": "blood_pressure_systolic",
      "8462-4": "blood_pressure_diastolic",
      "8867-4": "heart_rate",
      "9279-1": "respiratory_rate",
      "59408-5": "oxygen_saturation",
      "2708-6": "oxygen_saturation",
      "29463-7": "weight",
      "8302-2": "height",
    };

    for (const obs of typedVitals) {
      const code = obs.code?.coding?.[0]?.code;
      if (!code) continue;
      const vitalName = vitalCodeMap[code];
      if (vitalName && obs.value_quantity_value != null) {
        context.vitals[vitalName] = {
          value: obs.value_quantity_value,
          unit: obs.value_quantity_unit || "",
        };
      }
    }
  }

  // Get diagnoses from fhir_conditions
  const { data: conditionsData } = await supabase
    .from("fhir_conditions")
    .select("code, clinical_status")
    .eq("patient_id", patientId)
    .order("recorded_date", { ascending: false })
    .limit(15);

  if (conditionsData) {
    const typedConditions = conditionsData as FHIRConditionRecord[];
    context.diagnoses = typedConditions.map((c) => ({
      code: c.code?.coding?.[0]?.code || "",
      display: c.code?.coding?.[0]?.display || "",
      status: c.clinical_status || "active",
    }));
  }

  // Get medications from fhir_medication_requests
  const { data: medsData } = await supabase
    .from("fhir_medication_requests")
    .select("medication_codeable_concept, dosage_instruction, status")
    .eq("patient_id", patientId)
    .eq("status", "active")
    .order("authored_on", { ascending: false })
    .limit(20);

  if (medsData) {
    const typedMeds = medsData as FHIRMedicationRecord[];
    context.medications = typedMeds.map((m) => ({
      name: m.medication_codeable_concept?.coding?.[0]?.display || "",
      dosage: m.dosage_instruction?.[0]?.dose_and_rate?.[0]?.dose_quantity?.value?.toString() || "",
      frequency: m.dosage_instruction?.[0]?.timing?.code?.text || "",
    }));
  }

  // Get allergies
  const { data: allergiesData } = await supabase
    .from("fhir_allergy_intolerances")
    .select("code")
    .eq("patient_id", patientId);

  if (allergiesData) {
    const typedAllergies = allergiesData as FHIRAllergyRecord[];
    context.allergies = typedAllergies.map(
      (a) => a.code?.coding?.[0]?.display || a.code?.text || ""
    ).filter(Boolean);
  }

  // Get medical history (resolved conditions)
  const { data: historyData } = await supabase
    .from("patient_diagnoses")
    .select("diagnosis_name")
    .eq("patient_id", patientId)
    .eq("status", "resolved")
    .limit(10);

  if (historyData) {
    const typedHistory = historyData as DiagnosisRecord[];
    context.medicalHistory = typedHistory.map((h) => h.diagnosis_name);
  }

  // Get transcript if requested
  if (includeTranscript) {
    const { data: transcriptRaw } = await supabase
      .from("medical_transcripts")
      .select("transcript_text")
      .eq("encounter_id", encounterId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const transcriptData = transcriptRaw as unknown as { transcript_text: string | null } | null;

    if (transcriptData?.transcript_text) {
      // Limit transcript length to avoid token overflow
      context.transcript = transcriptData.transcript_text.slice(0, 8000);
    }
  }
}
