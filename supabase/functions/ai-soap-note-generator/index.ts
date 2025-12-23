/**
 * AI SOAP Note Auto-Generator Edge Function
 *
 * Skill #18: Generates comprehensive SOAP notes from encounter data using Claude Sonnet.
 * Integrates with:
 * - fhir_observations (vitals, lab results)
 * - fhir_conditions (diagnoses)
 * - fhir_medication_requests (treatment plans)
 * - encounters (visit data)
 * - Medical transcripts (if available)
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy.
 * HIPAA-compliant with audit logging.
 *
 * @module ai-soap-note-generator
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SONNET_MODEL = "claude-sonnet-4-20250514";

interface SOAPNoteRequest {
  encounterId: string;
  patientId?: string;
  tenantId?: string;
  includeTranscript?: boolean;
  providerNotes?: string;
  templateStyle?: "standard" | "comprehensive" | "brief";
}

interface SOAPNoteSection {
  content: string;
  confidence: number;
  sources: string[];
}

interface GeneratedSOAPNote {
  subjective: SOAPNoteSection;
  objective: SOAPNoteSection;
  assessment: SOAPNoteSection;
  plan: SOAPNoteSection;
  hpi?: SOAPNoteSection;
  ros?: SOAPNoteSection;
  icd10Suggestions: Array<{ code: string; display: string; confidence: number }>;
  cptSuggestions: Array<{ code: string; display: string; confidence: number }>;
  requiresReview: boolean;
  reviewReasons: string[];
}

interface EncounterContext {
  chiefComplaint?: string;
  visitType: string;
  durationMinutes?: number;
  vitals: Record<string, { value: number; unit: string }>;
  diagnoses: Array<{ code: string; display: string; status: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string }>;
  labResults: Array<{ test: string; value: string; unit: string; interpretation?: string }>;
  transcript?: string;
  providerNotes?: string;
  allergies: string[];
  socialHistory?: string;
  medicalHistory: string[];
}

// PHI Redaction - HIPAA Compliance
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
    .replace(/\b(19|20)\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g, "[DATE]");

serve(async (req) => {
  const logger = createLogger("ai-soap-note-generator", req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Parse request
    const body: SOAPNoteRequest = await req.json();
    const {
      encounterId,
      patientId,
      tenantId,
      includeTranscript = true,
      providerNotes,
      templateStyle = "standard",
    } = body;

    // Validate required fields
    if (!encounterId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: encounterId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate Anthropic API key
    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Gather encounter context
    const context = await gatherEncounterContext(
      supabase,
      encounterId,
      patientId,
      includeTranscript,
      providerNotes,
      logger
    );

    // Generate SOAP note
    const startTime = Date.now();
    const soapNote = await generateSOAPNote(context, templateStyle, logger);
    const responseTime = Date.now() - startTime;

    // Log PHI access for HIPAA compliance
    logger.phi("Generated AI SOAP note", {
      encounterId: redact(encounterId),
      patientId: patientId ? redact(patientId) : undefined,
      responseTimeMs: responseTime,
    });

    // Log usage for cost tracking
    await logUsage(supabase, encounterId, tenantId, responseTime, logger);

    return new Response(
      JSON.stringify({
        soapNote,
        metadata: {
          generated_at: new Date().toISOString(),
          model: SONNET_MODEL,
          response_time_ms: responseTime,
          template_style: templateStyle,
          context_sources: {
            vitals_count: Object.keys(context.vitals).length,
            diagnoses_count: context.diagnoses.length,
            medications_count: context.medications.length,
            lab_results_count: context.labResults.length,
            has_transcript: !!context.transcript,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("SOAP note generation failed", { error: error.message });

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Gather comprehensive encounter context for SOAP note generation
 */
async function gatherEncounterContext(
  supabase: ReturnType<typeof createClient>,
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
    const { data: encounter } = await supabase
      .from("encounters")
      .select("*")
      .eq("id", encounterId)
      .single();

    if (encounter) {
      context.chiefComplaint = encounter.chief_complaint;
      context.visitType = encounter.encounter_type || "general";

      if (encounter.start_time && encounter.end_time) {
        const start = new Date(encounter.start_time);
        const end = new Date(encounter.end_time);
        context.durationMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
      }

      // Use patient_id from encounter if not provided
      const resolvedPatientId = patientId || encounter.patient_id;

      if (resolvedPatientId) {
        // Get vitals from fhir_observations
        const { data: vitalsData } = await supabase
          .from("fhir_observations")
          .select("code, value_quantity_value, value_quantity_unit, effective_datetime")
          .eq("patient_id", resolvedPatientId)
          .gte("effective_datetime", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order("effective_datetime", { ascending: false });

        if (vitalsData) {
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

          for (const obs of vitalsData) {
            const code = obs.code?.coding?.[0]?.code;
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
          .eq("patient_id", resolvedPatientId)
          .order("recorded_date", { ascending: false })
          .limit(15);

        if (conditionsData) {
          context.diagnoses = conditionsData.map((c: any) => ({
            code: c.code?.coding?.[0]?.code || "",
            display: c.code?.coding?.[0]?.display || "",
            status: c.clinical_status || "active",
          }));
        }

        // Get medications from fhir_medication_requests
        const { data: medsData } = await supabase
          .from("fhir_medication_requests")
          .select("medication_codeable_concept, dosage_instruction, status")
          .eq("patient_id", resolvedPatientId)
          .eq("status", "active")
          .order("authored_on", { ascending: false })
          .limit(20);

        if (medsData) {
          context.medications = medsData.map((m: any) => ({
            name: m.medication_codeable_concept?.coding?.[0]?.display || "",
            dosage: m.dosage_instruction?.[0]?.dose_and_rate?.[0]?.dose_quantity?.value?.toString() || "",
            frequency: m.dosage_instruction?.[0]?.timing?.code?.text || "",
          }));
        }

        // Get allergies
        const { data: allergiesData } = await supabase
          .from("fhir_allergy_intolerances")
          .select("code")
          .eq("patient_id", resolvedPatientId);

        if (allergiesData) {
          context.allergies = allergiesData.map(
            (a: any) => a.code?.coding?.[0]?.display || a.code?.text || ""
          ).filter(Boolean);
        }

        // Get medical history (conditions with "resolved" status or significant past conditions)
        const { data: historyData } = await supabase
          .from("patient_diagnoses")
          .select("diagnosis_name")
          .eq("patient_id", resolvedPatientId)
          .eq("status", "resolved")
          .limit(10);

        if (historyData) {
          context.medicalHistory = historyData.map((h: any) => h.diagnosis_name);
        }

        // Get transcript if requested
        if (includeTranscript) {
          const { data: transcriptData } = await supabase
            .from("medical_transcripts")
            .select("transcript_text")
            .eq("encounter_id", encounterId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (transcriptData?.transcript_text) {
            // Limit transcript length to avoid token overflow
            context.transcript = transcriptData.transcript_text.slice(0, 8000);
          }
        }
      }
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather full encounter context", { error: error.message });
  }

  return context;
}

/**
 * Generate SOAP note using Claude Sonnet
 */
async function generateSOAPNote(
  context: EncounterContext,
  templateStyle: string,
  logger: ReturnType<typeof createLogger>
): Promise<GeneratedSOAPNote> {
  const prompt = buildSOAPPrompt(context, templateStyle);

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

  // Parse JSON response
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return normalizeSOAPResponse(parsed);
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response, using fallback", { error: error.message });
  }

  // Fallback - return structured but incomplete SOAP note
  return getDefaultSOAPNote(context);
}

/**
 * Build the prompt for SOAP note generation
 */
function buildSOAPPrompt(context: EncounterContext, templateStyle: string): string {
  const sections = [];

  // Chief Complaint
  if (context.chiefComplaint) {
    sections.push(`Chief Complaint: ${context.chiefComplaint}`);
  }

  // Visit Information
  sections.push(`Visit Type: ${context.visitType}`);
  if (context.durationMinutes) {
    sections.push(`Visit Duration: ${context.durationMinutes} minutes`);
  }

  // Vitals
  if (Object.keys(context.vitals).length > 0) {
    sections.push("\nVital Signs:");
    for (const [name, data] of Object.entries(context.vitals)) {
      const displayName = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      sections.push(`- ${displayName}: ${data.value} ${data.unit}`);
    }
  }

  // Active Diagnoses
  if (context.diagnoses.length > 0) {
    sections.push("\nActive Diagnoses:");
    context.diagnoses.forEach((d, i) => {
      sections.push(`${i + 1}. ${d.display} (${d.code}) - ${d.status}`);
    });
  }

  // Current Medications
  if (context.medications.length > 0) {
    sections.push("\nCurrent Medications:");
    context.medications.forEach((m) => {
      sections.push(`- ${m.name} ${m.dosage} ${m.frequency}`.trim());
    });
  }

  // Lab Results
  if (context.labResults.length > 0) {
    sections.push("\nRecent Lab Results:");
    context.labResults.forEach((l) => {
      sections.push(`- ${l.test}: ${l.value} ${l.unit}${l.interpretation ? ` (${l.interpretation})` : ""}`);
    });
  }

  // Allergies
  if (context.allergies.length > 0) {
    sections.push(`\nAllergies: ${context.allergies.join(", ")}`);
  }

  // Medical History
  if (context.medicalHistory.length > 0) {
    sections.push(`\nPast Medical History: ${context.medicalHistory.join(", ")}`);
  }

  // Transcript
  if (context.transcript) {
    sections.push(`\nEncounter Transcript:\n${context.transcript}`);
  }

  // Provider Notes
  if (context.providerNotes) {
    sections.push(`\nProvider Notes:\n${context.providerNotes}`);
  }

  const styleInstructions = {
    brief: "Keep sections concise (2-3 sentences each). Focus on key clinical points.",
    standard: "Use standard clinical documentation style with moderate detail.",
    comprehensive: "Include full detail with clinical reasoning and differential considerations.",
  };

  return `You are an expert clinical documentation specialist. Generate a comprehensive SOAP note based on the following encounter data.

ENCOUNTER DATA:
${sections.join("\n")}

DOCUMENTATION STYLE: ${templateStyle}
${styleInstructions[templateStyle as keyof typeof styleInstructions] || styleInstructions.standard}

Generate a complete SOAP note following these guidelines:
1. SUBJECTIVE: Patient's reported symptoms, concerns, and relevant history
2. OBJECTIVE: Measurable findings - vitals, exam findings, test results
3. ASSESSMENT: Clinical interpretation, working diagnoses with ICD-10 codes
4. PLAN: Treatment plan, medications, follow-up, patient education

Also include:
- HPI (History of Present Illness) using OLDCARTS format if chief complaint available
- ROS (Review of Systems) if enough data is available
- ICD-10 code suggestions with confidence scores
- CPT code suggestions for the encounter

Return a JSON object with this structure:
{
  "subjective": { "content": "...", "confidence": 0.95, "sources": ["chief_complaint", "transcript"] },
  "objective": { "content": "...", "confidence": 0.98, "sources": ["vitals", "lab_results"] },
  "assessment": { "content": "...", "confidence": 0.90, "sources": ["diagnoses", "clinical_reasoning"] },
  "plan": { "content": "...", "confidence": 0.92, "sources": ["medications", "guidelines"] },
  "hpi": { "content": "...", "confidence": 0.85, "sources": ["chief_complaint"] },
  "ros": { "content": "...", "confidence": 0.80, "sources": ["transcript"] },
  "icd10Suggestions": [{ "code": "E11.9", "display": "Type 2 diabetes", "confidence": 0.95 }],
  "cptSuggestions": [{ "code": "99214", "display": "Office visit, 30-39 min", "confidence": 0.90 }],
  "requiresReview": false,
  "reviewReasons": []
}

IMPORTANT:
- Use professional clinical language
- Be specific and accurate
- Flag uncertainty with lower confidence scores
- Set requiresReview=true if critical information is missing or unclear
- Add reviewReasons for any items requiring clinician attention

Respond with ONLY the JSON object, no other text.`;
}

/**
 * Normalize the AI response to ensure consistent structure
 */
function normalizeSOAPResponse(parsed: any): GeneratedSOAPNote {
  const normalizeSection = (section: any, defaultContent: string): SOAPNoteSection => {
    if (typeof section === "string") {
      return { content: section, confidence: 0.8, sources: [] };
    }
    return {
      content: section?.content || defaultContent,
      confidence: section?.confidence ?? 0.8,
      sources: section?.sources || [],
    };
  };

  return {
    subjective: normalizeSection(parsed.subjective, "Unable to generate subjective section."),
    objective: normalizeSection(parsed.objective, "Unable to generate objective section."),
    assessment: normalizeSection(parsed.assessment, "Assessment pending clinician review."),
    plan: normalizeSection(parsed.plan, "Plan pending clinician review."),
    hpi: parsed.hpi ? normalizeSection(parsed.hpi, "") : undefined,
    ros: parsed.ros ? normalizeSection(parsed.ros, "") : undefined,
    icd10Suggestions: parsed.icd10Suggestions || [],
    cptSuggestions: parsed.cptSuggestions || [],
    requiresReview: parsed.requiresReview ?? true,
    reviewReasons: parsed.reviewReasons || ["AI-generated content requires clinician review"],
  };
}

/**
 * Default SOAP note if AI generation fails
 */
function getDefaultSOAPNote(context: EncounterContext): GeneratedSOAPNote {
  const subjective = context.chiefComplaint
    ? `Patient presents with: ${context.chiefComplaint}`
    : "Subjective information not documented.";

  const vitalStrings = [];
  if (context.vitals.blood_pressure_systolic && context.vitals.blood_pressure_diastolic) {
    vitalStrings.push(
      `BP: ${context.vitals.blood_pressure_systolic.value}/${context.vitals.blood_pressure_diastolic.value} mmHg`
    );
  }
  if (context.vitals.heart_rate) {
    vitalStrings.push(`HR: ${context.vitals.heart_rate.value} bpm`);
  }
  if (context.vitals.temperature) {
    vitalStrings.push(`Temp: ${context.vitals.temperature.value}°F`);
  }
  if (context.vitals.respiratory_rate) {
    vitalStrings.push(`RR: ${context.vitals.respiratory_rate.value}/min`);
  }
  if (context.vitals.oxygen_saturation) {
    vitalStrings.push(`SpO2: ${context.vitals.oxygen_saturation.value}%`);
  }

  const objective = vitalStrings.length > 0 ? `Vitals: ${vitalStrings.join(", ")}` : "No vitals documented.";

  const assessment =
    context.diagnoses.length > 0
      ? context.diagnoses.map((d, i) => `${i + 1}. ${d.display} (${d.code})`).join("\n")
      : "Assessment pending further evaluation.";

  const plan =
    context.medications.length > 0
      ? `Medications:\n${context.medications.map((m) => `- ${m.name} ${m.dosage} ${m.frequency}`).join("\n")}\n\nFollow-up as scheduled.`
      : "Plan pending clinician review.";

  return {
    subjective: { content: subjective, confidence: 0.6, sources: ["fallback"] },
    objective: { content: objective, confidence: 0.7, sources: ["vitals"] },
    assessment: { content: assessment, confidence: 0.5, sources: ["diagnoses"] },
    plan: { content: plan, confidence: 0.5, sources: ["medications"] },
    icd10Suggestions: context.diagnoses.map((d) => ({
      code: d.code,
      display: d.display,
      confidence: 0.7,
    })),
    cptSuggestions: [],
    requiresReview: true,
    reviewReasons: ["AI generation failed - fallback content requires complete review"],
  };
}

/**
 * Log usage for cost tracking
 */
async function logUsage(
  supabase: ReturnType<typeof createClient>,
  encounterId: string,
  tenantId: string | undefined,
  responseTimeMs: number,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    // Estimate tokens (Sonnet is more expensive)
    const estimatedInputTokens = 1500;
    const estimatedOutputTokens = 2000;

    // Sonnet pricing: $3/1M input, $15/1M output
    const cost =
      (estimatedInputTokens / 1_000_000) * 3 + (estimatedOutputTokens / 1_000_000) * 15;

    await supabase.from("claude_usage_logs").insert({
      user_id: encounterId, // Using encounterId as reference
      tenant_id: tenantId,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: "soap_note_generation",
      input_tokens: estimatedInputTokens,
      output_tokens: estimatedOutputTokens,
      cost: cost,
      response_time_ms: responseTimeMs,
      success: true,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to log usage", { error: error.message });
  }
}
