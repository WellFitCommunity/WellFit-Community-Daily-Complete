/**
 * AI Appointment Prep Instructions Edge Function
 *
 * Generates personalized, condition-specific preparation instructions for patient appointments.
 * Uses Claude Haiku 4.5 for cost-effective generation of patient-friendly content.
 *
 * Skill #27 - Appointment Prep Instructions
 *
 * Features:
 * - Condition-specific preparation (fasting, medication holds, etc.)
 * - Appointment-type-specific instructions
 * - What-to-bring checklists
 * - 6th grade reading level content
 * - Multi-language support
 *
 * @module ai-appointment-prep-instructions
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
// Use Haiku 4.5 for cost-effective generation
const HAIKU_MODEL = "claude-haiku-4-20250514";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AppointmentDetails {
  type: string;
  specialty?: string;
  providerName?: string;
  appointmentDateTime: string;
  location?: string;
  durationMinutes?: number;
  plannedTests?: string[];
  schedulerNotes?: string;
}

interface PatientContext {
  age?: number;
  activeConditions?: Array<{ code: string; display: string }>;
  currentMedications?: Array<{ name: string; dosage?: string; frequency?: string }>;
  allergies?: string[];
  mobilityLimitations?: string[];
  language?: string;
  specialNeeds?: string[];
}

interface PrepRequest {
  patientId: string;
  appointment: AppointmentDetails;
  patientContext?: PatientContext;
  tenantId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHI Redaction
// ─────────────────────────────────────────────────────────────────────────────

const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
    .replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, "[DOB]");

// ─────────────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  const logger = createLogger("ai-appointment-prep-instructions", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: PrepRequest = await req.json();
    const { patientId, appointment, patientContext = {} } = body;

    // Validate required fields
    if (!patientId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: patientId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!appointment?.type || !appointment?.appointmentDateTime) {
      return new Response(
        JSON.stringify({ error: "Missing required appointment details" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);
    const startTime = Date.now();

    // Fetch additional patient context if not provided
    let enrichedContext = { ...patientContext };
    if (!patientContext.activeConditions || !patientContext.currentMedications) {
      enrichedContext = await enrichPatientContext(supabase, patientId, patientContext, logger);
    }

    // Generate prep instructions
    const result = await generatePrepInstructions(appointment, enrichedContext, logger);

    const responseTime = Date.now() - startTime;
    const language = patientContext.language || "English";

    // Log usage
    await supabase.from("claude_usage_logs").insert({
      user_id: patientId,
      request_id: crypto.randomUUID(),
      model: HAIKU_MODEL,
      request_type: "appointment_prep_instructions",
      input_tokens: 800,
      output_tokens: 1200,
      cost: (800 / 1_000_000) * 0.25 + (1200 / 1_000_000) * 1.25,
      response_time_ms: responseTime,
      success: true,
      metadata: {
        appointmentType: appointment.type,
        language,
        hasConditions: (enrichedContext.activeConditions?.length || 0) > 0,
        hasMedications: (enrichedContext.currentMedications?.length || 0) > 0,
      },
    });

    // Log PHI access
    logger.phi("Appointment prep instructions generated", {
      patientId: redact(patientId),
      appointmentType: appointment.type,
    });

    return new Response(
      JSON.stringify({
        result,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: HAIKU_MODEL,
          responseTimeMs: responseTime,
          appointmentType: appointment.type,
          language,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Appointment prep generation failed", { error: error.message });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Context Enrichment
// ─────────────────────────────────────────────────────────────────────────────

async function enrichPatientContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  existingContext: PatientContext,
  logger: ReturnType<typeof createLogger>
): Promise<PatientContext> {
  const context = { ...existingContext };

  try {
    // Get patient age
    if (!context.age) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("date_of_birth")
        .eq("id", patientId)
        .single();

      if (profile?.date_of_birth) {
        const dob = new Date(profile.date_of_birth);
        const today = new Date();
        context.age = Math.floor(
          (today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        );
      }
    }

    // Get active conditions
    if (!context.activeConditions) {
      const { data: conditions } = await supabase
        .from("fhir_conditions")
        .select("code, display")
        .eq("patient_id", patientId)
        .eq("clinical_status", "active")
        .limit(10);

      if (conditions) {
        context.activeConditions = conditions.map((c) => ({
          code: c.code || "",
          display: c.display || "",
        }));
      }
    }

    // Get current medications
    if (!context.currentMedications) {
      const { data: medications } = await supabase
        .from("fhir_medication_requests")
        .select("medication_display, dosage_instruction")
        .eq("patient_id", patientId)
        .eq("status", "active")
        .limit(15);

      if (medications) {
        context.currentMedications = medications.map((m) => ({
          name: m.medication_display || "",
          dosage: m.dosage_instruction || undefined,
        }));
      }
    }

    // Get allergies
    if (!context.allergies) {
      const { data: allergies } = await supabase
        .from("allergy_intolerances")
        .select("allergen_name")
        .eq("patient_id", patientId)
        .eq("clinical_status", "active");

      if (allergies) {
        context.allergies = allergies.map((a) => a.allergen_name || "").filter(Boolean);
      }
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to enrich patient context", { error: error.message });
  }

  return context;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Generation
// ─────────────────────────────────────────────────────────────────────────────

async function generatePrepInstructions(
  appointment: AppointmentDetails,
  context: PatientContext,
  logger: ReturnType<typeof createLogger>
): Promise<{
  greeting: string;
  appointmentSummary: string;
  instructions: Array<{
    category: string;
    priority: string;
    timing?: string;
    instruction: string;
    rationale?: string;
  }>;
  bringChecklist: Array<{ item: string; required: boolean; note?: string }>;
  medicationInstructions: Array<{
    medication: string;
    instruction: string;
    timing: string;
    warning?: string;
  }>;
  dietaryInstructions?: {
    fastingRequired: boolean;
    fastingHours?: number;
    foodRestrictions?: string[];
    hydrationGuidance?: string;
  };
  transportationNotes?: string[];
  whatToExpect: string[];
  estimatedDuration?: string;
  suggestedQuestions?: string[];
  contactInfo?: string;
  keyReminders: string[];
}> {
  const appointmentDate = new Date(appointment.appointmentDateTime);
  const formattedDate = appointmentDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const formattedTime = appointmentDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const conditionsText =
    context.activeConditions && context.activeConditions.length > 0
      ? context.activeConditions.map((c) => c.display).join(", ")
      : "None documented";

  const medicationsText =
    context.currentMedications && context.currentMedications.length > 0
      ? context.currentMedications.map((m) => `${m.name}${m.dosage ? ` (${m.dosage})` : ""}`).join(", ")
      : "None documented";

  const allergiesText =
    context.allergies && context.allergies.length > 0 ? context.allergies.join(", ") : "NKDA";

  const prompt = `You are a friendly medical assistant helping a patient prepare for their upcoming appointment. Generate clear, helpful preparation instructions at a 6th-grade reading level.

APPOINTMENT DETAILS:
- Type: ${appointment.type.replace(/_/g, " ")}
- Date: ${formattedDate} at ${formattedTime}
- Specialty: ${appointment.specialty || "General"}
- Provider: ${appointment.providerName || "Healthcare provider"}
- Location: ${appointment.location || "Clinic"}
- Duration: ${appointment.durationMinutes ? `${appointment.durationMinutes} minutes` : "Standard appointment"}
${appointment.plannedTests ? `- Planned Tests: ${appointment.plannedTests.join(", ")}` : ""}
${appointment.schedulerNotes ? `- Notes: ${appointment.schedulerNotes}` : ""}

PATIENT INFORMATION:
- Age: ${context.age || "Unknown"}
- Active Conditions: ${conditionsText}
- Current Medications: ${medicationsText}
- Allergies: ${allergiesText}
${context.mobilityLimitations ? `- Mobility: ${context.mobilityLimitations.join(", ")}` : ""}
${context.specialNeeds ? `- Special Needs: ${context.specialNeeds.join(", ")}` : ""}

Generate personalized preparation instructions considering:
1. The specific appointment type and any tests/procedures
2. The patient's medical conditions (especially diabetes, blood pressure, heart conditions)
3. Current medications (blood thinners, insulin, etc.) and whether to hold/take them
4. Fasting requirements if applicable
5. What the patient should bring
6. What to expect during the appointment

Return JSON with this exact structure:
{
  "greeting": "Warm, friendly greeting using patient's appointment context",
  "appointmentSummary": "Brief 1-2 sentence summary of what this appointment is for",
  "instructions": [
    {
      "category": "before|day_of|bring|medication|dietary|transportation|after",
      "priority": "required|recommended|optional",
      "timing": "When to do this (e.g., '24 hours before', 'Morning of')",
      "instruction": "Clear, simple instruction",
      "rationale": "Brief reason why this is important"
    }
  ],
  "bringChecklist": [
    { "item": "Item to bring", "required": true|false, "note": "Optional note" }
  ],
  "medicationInstructions": [
    {
      "medication": "Medication name",
      "instruction": "Take as usual|Hold|Special instruction",
      "timing": "When to take/hold",
      "warning": "Optional warning"
    }
  ],
  "dietaryInstructions": {
    "fastingRequired": true|false,
    "fastingHours": 8|12|null,
    "foodRestrictions": ["If any"],
    "hydrationGuidance": "Water guidance"
  },
  "transportationNotes": ["Any transportation considerations"],
  "whatToExpect": ["Step-by-step what will happen during the visit"],
  "estimatedDuration": "Estimated total time",
  "suggestedQuestions": ["3-5 questions patient might want to ask"],
  "keyReminders": ["Top 3-5 most important things to remember"]
}

IMPORTANT RULES:
- Use simple, clear language (6th-grade reading level)
- Be warm and reassuring in tone
- For diabetes patients: include blood sugar monitoring guidance
- For blood thinner patients: note if any tests might be affected
- For lab work: always check if fasting is standard for the test type
- For imaging: mention metal/jewelry removal if applicable
- Always include insurance card and photo ID in checklist
- Include medication list in checklist for all appointments

Return ONLY valid JSON.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 2000,
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
      return {
        greeting: parsed.greeting || `We're looking forward to seeing you on ${formattedDate}!`,
        appointmentSummary: parsed.appointmentSummary || `Your ${appointment.type.replace(/_/g, " ")} appointment`,
        instructions: parsed.instructions || [],
        bringChecklist: parsed.bringChecklist || [
          { item: "Photo ID", required: true },
          { item: "Insurance card", required: true },
          { item: "List of current medications", required: true },
        ],
        medicationInstructions: parsed.medicationInstructions || [],
        dietaryInstructions: parsed.dietaryInstructions,
        transportationNotes: parsed.transportationNotes,
        whatToExpect: parsed.whatToExpect || ["Check in at the front desk", "Wait to be called", "Meet with your provider"],
        estimatedDuration: parsed.estimatedDuration || `${appointment.durationMinutes || 30} minutes`,
        suggestedQuestions: parsed.suggestedQuestions,
        keyReminders: parsed.keyReminders || ["Arrive 15 minutes early", "Bring your ID and insurance card"],
      };
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  // Fallback response
  logger.warn("Using fallback prep instructions");
  return {
    greeting: `We're looking forward to your appointment on ${formattedDate} at ${formattedTime}!`,
    appointmentSummary: `Your ${appointment.type.replace(/_/g, " ")} appointment with ${appointment.providerName || "your provider"}`,
    instructions: [
      {
        category: "before",
        priority: "required",
        timing: "Before your visit",
        instruction: "Review any paperwork or forms you received",
        rationale: "This helps the visit go smoothly",
      },
    ],
    bringChecklist: [
      { item: "Photo ID (driver's license or state ID)", required: true },
      { item: "Insurance card", required: true },
      { item: "List of all current medications", required: true },
      { item: "List of questions for your provider", required: false, note: "Write them down so you don't forget" },
    ],
    medicationInstructions: [],
    whatToExpect: [
      "Check in at the front desk when you arrive",
      "A medical assistant will take your vitals",
      "Your provider will discuss your health with you",
    ],
    estimatedDuration: `${appointment.durationMinutes || 30} minutes`,
    keyReminders: [
      "Arrive 15 minutes early to complete check-in",
      "Bring your insurance card and photo ID",
      "Bring a list of your current medications",
    ],
  };
}
