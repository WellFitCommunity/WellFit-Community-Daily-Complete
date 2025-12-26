/**
 * AI Medication Instructions Edge Function
 *
 * Generates personalized, patient-friendly medication instructions
 * using Claude Haiku 4.5 for cost-effective generation.
 *
 * Features:
 * - Personalized dosing schedules
 * - Visual pill identification
 * - Food/drug interaction warnings
 * - 6th-grade reading level
 * - Multi-language support
 * - Caregiver-friendly formatting
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.39.0";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

interface MedicationInfo {
  name: string;
  genericName?: string;
  dosage: string;
  form: string;
  frequency: string;
  route?: string;
  purpose?: string;
  prescriber?: string;
  startDate?: string;
  endDate?: string;
  specialInstructions?: string;
  refillsRemaining?: number;
  ndcCode?: string;
  pillImprint?: string;
  pillColor?: string;
  pillShape?: string;
}

interface PatientContext {
  age?: number;
  weightKg?: number;
  allergies?: string[];
  conditions?: string[];
  otherMedications?: string[];
  kidneyFunction?: string;
  liverFunction?: string;
  pregnancyStatus?: string;
  language?: string;
  readingLevel?: string;
  hasVisionImpairment?: boolean;
  hasCognitiveImpairment?: boolean;
  caregiverAdministered?: boolean;
}

interface RequestBody {
  patientId: string;
  medication: MedicationInfo;
  patientContext?: PatientContext;
  includeVisualAids?: boolean;
  tenantId?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger("ai-medication-instructions", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const ANTHROPIC_API_KEY = getEnv("ANTHROPIC_API_KEY", "CLAUDE_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    logger.error("Missing Anthropic API key");
    return new Response(
      JSON.stringify({ error: "AI service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const startTime = Date.now();
    const body: RequestBody = await req.json();

    // Validate input
    if (!body.patientId || !body.medication?.name || !body.medication?.dosage) {
      return new Response(
        JSON.stringify({ error: "Patient ID, medication name, and dosage are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { medication, patientContext = {} } = body;
    const language = patientContext.language || "English";
    const readingLevel = patientContext.readingLevel || "simple";

    // Build the prompt
    const systemPrompt = `You are a medication education specialist who creates patient-friendly medication instructions.

Your instructions MUST be:
- Written at a 6th-grade reading level (simple words, short sentences)
- Clear, specific, and actionable
- Safe (always include appropriate warnings)
- Culturally sensitive and non-judgmental
- Formatted for easy scanning

Language: ${language}
Reading Level: ${readingLevel === "simple" ? "Very simple (6th grade)" : readingLevel === "detailed" ? "Detailed with medical terms" : "Standard patient education"}
${patientContext.hasVisionImpairment ? "Patient has vision impairment - use clear, large-text-friendly descriptions" : ""}
${patientContext.hasCognitiveImpairment ? "Patient has cognitive considerations - use extra simple language and reminders" : ""}
${patientContext.caregiverAdministered ? "A caregiver will be administering this medication - include caregiver-specific instructions" : ""}

IMPORTANT SAFETY RULES:
1. Always recommend contacting healthcare provider for questions
2. Include poison control number (1-800-222-1222)
3. Never suggest stopping medication without doctor approval
4. Always mention to avoid alcohol unless medication is explicitly safe
5. Include pregnancy/breastfeeding warnings when relevant`;

    const userPrompt = `Generate comprehensive medication instructions for the following:

MEDICATION DETAILS:
- Name: ${medication.name}${medication.genericName ? ` (Generic: ${medication.genericName})` : ""}
- Dosage: ${medication.dosage}
- Form: ${medication.form}
- Frequency: ${medication.frequency}
${medication.route ? `- Route: ${medication.route}` : ""}
${medication.purpose ? `- Purpose: ${medication.purpose}` : ""}
${medication.specialInstructions ? `- Special Instructions from Doctor: ${medication.specialInstructions}` : ""}
${medication.pillColor ? `- Pill Color: ${medication.pillColor}` : ""}
${medication.pillShape ? `- Pill Shape: ${medication.pillShape}` : ""}
${medication.pillImprint ? `- Pill Imprint: ${medication.pillImprint}` : ""}
${medication.refillsRemaining !== undefined ? `- Refills Remaining: ${medication.refillsRemaining}` : ""}

PATIENT CONTEXT:
${patientContext.age ? `- Age: ${patientContext.age}` : ""}
${patientContext.allergies?.length ? `- Allergies: ${patientContext.allergies.join(", ")}` : ""}
${patientContext.conditions?.length ? `- Conditions: ${patientContext.conditions.join(", ")}` : ""}
${patientContext.otherMedications?.length ? `- Other Medications: ${patientContext.otherMedications.join(", ")}` : ""}
${patientContext.kidneyFunction && patientContext.kidneyFunction !== "normal" ? `- Kidney Function: ${patientContext.kidneyFunction}` : ""}
${patientContext.liverFunction && patientContext.liverFunction !== "normal" ? `- Liver Function: ${patientContext.liverFunction}` : ""}
${patientContext.pregnancyStatus && patientContext.pregnancyStatus !== "not_pregnant" ? `- Pregnancy Status: ${patientContext.pregnancyStatus}` : ""}

Respond with a JSON object containing:
{
  "medicationName": "friendly name for the medication",
  "whatItDoes": "simple 1-2 sentence explanation of what this medication does",
  "whyYouTakeIt": "personalized reason based on patient's conditions",
  "pillIdentification": {
    "color": "color description",
    "shape": "shape description",
    "size": "size in simple terms (small, medium, large)",
    "imprint": "any letters or numbers on the pill",
    "coating": "film-coated, scored, etc.",
    "visualDescription": "A complete sentence describing how to identify your pills"
  },
  "dosingSchedule": [
    {
      "timeOfDay": "Morning/Afternoon/Evening/Bedtime",
      "specificTime": "suggested time like 8:00 AM",
      "doseAmount": "1 tablet, 2 capsules, etc.",
      "withFood": "required/recommended/avoid/no_preference",
      "timingNotes": "any special timing like 'wait 30 minutes before eating'"
    }
  ],
  "howToTake": ["step 1", "step 2", "step 3..."],
  "foodDrinkInteractions": [
    {
      "substance": "grapefruit juice",
      "type": "food",
      "severity": "avoid/caution/monitor",
      "description": "why this is an issue",
      "recommendation": "what to do instead"
    }
  ],
  "drugInteractions": [
    {
      "substance": "medication name",
      "type": "drug",
      "severity": "avoid/caution/monitor",
      "description": "why this is an issue",
      "recommendation": "what to do"
    }
  ],
  "storageInstructions": ["instruction 1", "instruction 2"],
  "missedDoseInstructions": ["what to do if you miss a dose"],
  "sideEffects": [
    {
      "effect": "headache",
      "likelihood": "common/less_common/rare",
      "severity": "mild/moderate/severe",
      "action": "what to do",
      "callDoctorIf": "when this becomes concerning"
    }
  ],
  "warningSigns": [
    {
      "sign": "symptom to watch for",
      "action": "what to do",
      "urgency": "call_doctor/seek_emergency/monitor"
    }
  ],
  "refillInfo": {
    "refillsRemaining": number,
    "howToRefill": "instructions"
  },
  "reminderTips": ["tip 1", "tip 2"],
  "questionsForDoctor": ["question 1", "question 2"],
  "dosAndDonts": {
    "dos": ["do this", "do that"],
    "donts": ["don't do this", "avoid that"]
  },
  "caregiverNotes": ["note for caregivers if applicable"],
  "emergencyInfo": {
    "overdoseSymptoms": ["symptom 1", "symptom 2"],
    "overdoseAction": "Call 911 or Poison Control immediately",
    "poisonControlNumber": "1-800-222-1222"
  }
}`;

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20250929",
      max_tokens: 4000,
      messages: [
        { role: "user", content: userPrompt }
      ],
      system: systemPrompt,
    });

    const responseText = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON from response
    let result;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
      result = JSON.parse(jsonStr);
    } catch (parseErr) {
      logger.error("Failed to parse AI response", { error: String(parseErr), response: responseText.slice(0, 500) });
      return new Response(
        JSON.stringify({ error: "Failed to parse medication instructions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseTimeMs = Date.now() - startTime;

    logger.info("Medication instructions generated", {
      patientId: body.patientId,
      medication: medication.name,
      responseTimeMs,
    });

    return new Response(
      JSON.stringify({
        result,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: "claude-haiku-4-5-20250929",
          responseTimeMs,
          language,
          readingLevel,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("Failed to generate medication instructions", { error });
    return new Response(
      JSON.stringify({ error: "Failed to generate medication instructions" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
