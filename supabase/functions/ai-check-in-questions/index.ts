/**
 * AI Smart Check-In Questions Edge Function
 *
 * Generates personalized daily check-in questions based on:
 * - Patient's active diagnoses and conditions
 * - Current care plan goals
 * - SDOH factors detected
 * - Recent check-in patterns and responses
 *
 * Uses Claude Haiku 4.5 for cost-effective, fast generation.
 *
 * @module ai-check-in-questions
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const HAIKU_MODEL = "claude-haiku-4-5-20250919";

interface CheckInQuestionRequest {
  patientId: string;
  carePlanId?: string;
  tenantId?: string;
  questionCount?: number;
  focusAreas?: string[];
}

interface GeneratedQuestion {
  question: string;
  type: "yes_no" | "scale" | "text" | "multiple_choice";
  scale?: { min: number; max: number; label_min?: string; label_max?: string };
  choices?: string[];
  required: boolean;
  category: string;
  rationale: string;
}

interface PatientContext {
  diagnoses: string[];
  carePlanGoals: string[];
  sdohFactors: string[];
  recentConcerns: string[];
  missedCheckIns: number;
  averageWellnessScore?: number;
}

// PHI Redaction - HIPAA Compliance
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
    .replace(/\b\d{1,5}\s+[A-Za-z0-9'.\- ]+\b/g, (m) => (m.length > 6 ? "[ADDRESS]" : m))
    .replace(/\b(19|20)\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g, "[DATE]");

serve(async (req) => {
  const logger = createLogger("ai-check-in-questions", req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Parse request
    const body: CheckInQuestionRequest = await req.json();
    const { patientId, carePlanId, tenantId, questionCount = 5, focusAreas } = body;

    // Validate required fields
    if (!patientId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: patientId" }),
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

    // Gather patient context (de-identified)
    const context = await gatherPatientContext(supabase, patientId, carePlanId, logger);

    // Generate personalized questions
    const startTime = Date.now();
    const questions = await generateQuestions(context, questionCount, focusAreas, logger);
    const responseTime = Date.now() - startTime;

    // Log usage for cost tracking
    await logUsage(supabase, patientId, tenantId, responseTime, questions.length, logger);

    logger.info("Generated check-in questions", {
      patientId: redact(patientId),
      questionCount: questions.length,
      responseTimeMs: responseTime,
    });

    return new Response(
      JSON.stringify({
        questions,
        metadata: {
          generated_at: new Date().toISOString(),
          model: HAIKU_MODEL,
          response_time_ms: responseTime,
          context_used: {
            diagnoses_count: context.diagnoses.length,
            sdoh_factors_count: context.sdohFactors.length,
            care_plan_goals_count: context.carePlanGoals.length,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Check-in question generation failed", { error: error.message });

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
 * Gather de-identified patient context for question generation
 */
async function gatherPatientContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  carePlanId: string | undefined,
  logger: ReturnType<typeof createLogger>
): Promise<PatientContext> {
  const context: PatientContext = {
    diagnoses: [],
    carePlanGoals: [],
    sdohFactors: [],
    recentConcerns: [],
    missedCheckIns: 0,
  };

  try {
    // Get active diagnoses (de-identified - only condition names)
    const { data: diagnoses } = await supabase
      .from("patient_diagnoses")
      .select("diagnosis_name, icd10_code, is_primary")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(10);

    if (diagnoses) {
      context.diagnoses = diagnoses.map(
        (d) => `${d.diagnosis_name}${d.is_primary ? " (primary)" : ""}`
      );
    }

    // Get care plan goals if available
    if (carePlanId) {
      const { data: carePlan } = await supabase
        .from("care_coordination_plans")
        .select("goals, care_plan_type, priority")
        .eq("id", carePlanId)
        .single();

      if (carePlan?.goals) {
        context.carePlanGoals = Array.isArray(carePlan.goals)
          ? carePlan.goals.slice(0, 5)
          : [];
      }
    }

    // Get SDOH factors detected
    const { data: sdohData } = await supabase
      .from("sdoh_assessments")
      .select("category, risk_level")
      .eq("patient_id", patientId)
      .order("assessed_at", { ascending: false })
      .limit(5);

    if (sdohData) {
      context.sdohFactors = sdohData
        .filter((s) => s.risk_level !== "low")
        .map((s) => `${s.category} (${s.risk_level} risk)`);
    }

    // Get recent check-in patterns
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentCheckIns } = await supabase
      .from("patient_daily_check_ins")
      .select("status, concern_flags, responses")
      .eq("patient_id", patientId)
      .gte("check_in_date", sevenDaysAgo)
      .order("check_in_date", { ascending: false })
      .limit(7);

    if (recentCheckIns) {
      context.missedCheckIns = recentCheckIns.filter((c) => c.status === "missed").length;

      // Extract recent concerns
      const concerns = new Set<string>();
      for (const checkIn of recentCheckIns) {
        if (checkIn.concern_flags) {
          for (const flag of checkIn.concern_flags) {
            concerns.add(flag);
          }
        }
      }
      context.recentConcerns = Array.from(concerns);

      // Calculate average wellness score
      const scores = recentCheckIns
        .filter((c) => c.responses?.feeling)
        .map((c) => c.responses.feeling as number);
      if (scores.length > 0) {
        context.averageWellnessScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather full patient context", { error: error.message });
  }

  return context;
}

/**
 * Generate personalized check-in questions using Claude Haiku
 */
async function generateQuestions(
  context: PatientContext,
  count: number,
  focusAreas: string[] | undefined,
  logger: ReturnType<typeof createLogger>
): Promise<GeneratedQuestion[]> {
  const prompt = buildPrompt(context, count, focusAreas);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 2048,
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
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const questions = JSON.parse(jsonMatch[0]) as GeneratedQuestion[];
      return questions.slice(0, count);
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response, using fallback", { error: error.message });
  }

  // Fallback to default questions
  return getDefaultQuestions();
}

/**
 * Build the prompt for question generation
 */
function buildPrompt(
  context: PatientContext,
  count: number,
  focusAreas: string[] | undefined
): string {
  const contextSummary = [];

  if (context.diagnoses.length > 0) {
    contextSummary.push(`Active conditions: ${context.diagnoses.join(", ")}`);
  }

  if (context.carePlanGoals.length > 0) {
    contextSummary.push(`Care plan goals: ${context.carePlanGoals.join(", ")}`);
  }

  if (context.sdohFactors.length > 0) {
    contextSummary.push(`SDOH factors: ${context.sdohFactors.join(", ")}`);
  }

  if (context.recentConcerns.length > 0) {
    contextSummary.push(`Recent concerns: ${context.recentConcerns.join(", ")}`);
  }

  if (context.missedCheckIns > 2) {
    contextSummary.push(`Note: Patient has missed ${context.missedCheckIns} check-ins in the past week`);
  }

  if (context.averageWellnessScore !== undefined) {
    contextSummary.push(`Average wellness score: ${context.averageWellnessScore.toFixed(1)}/10`);
  }

  const focusNote = focusAreas?.length
    ? `Focus areas requested: ${focusAreas.join(", ")}`
    : "";

  return `You are a clinical care assistant helping generate personalized daily check-in questions for a patient.

PATIENT CONTEXT (de-identified):
${contextSummary.length > 0 ? contextSummary.join("\n") : "No specific context available - generate general wellness questions."}

${focusNote}

Generate exactly ${count} personalized check-in questions. Each question should be:
- Empathetic and easy to understand (6th-grade reading level)
- Clinically relevant based on the patient's conditions
- Actionable (responses help care team identify issues early)

Return a JSON array with this exact structure:
[
  {
    "question": "The question text",
    "type": "yes_no" | "scale" | "text" | "multiple_choice",
    "scale": { "min": 0, "max": 10, "label_min": "Low", "label_max": "High" },
    "choices": ["Option 1", "Option 2"],
    "required": true,
    "category": "wellness" | "medication" | "symptoms" | "safety" | "mood" | "nutrition" | "mobility" | "social",
    "rationale": "Brief clinical rationale for this question"
  }
]

ALWAYS include at least:
1. One general wellness question (scale 1-10)
2. One medication adherence question (yes/no)
3. One safety/emergency question (yes/no)

Respond with ONLY the JSON array, no other text.`;
}

/**
 * Default questions if AI generation fails
 */
function getDefaultQuestions(): GeneratedQuestion[] {
  return [
    {
      question: "How are you feeling today overall?",
      type: "scale",
      scale: { min: 1, max: 10, label_min: "Very Poor", label_max: "Excellent" },
      required: true,
      category: "wellness",
      rationale: "General wellness assessment",
    },
    {
      question: "Did you take all your medications today?",
      type: "yes_no",
      required: true,
      category: "medication",
      rationale: "Medication adherence tracking",
    },
    {
      question: "On a scale of 1-10, how would you rate your pain level?",
      type: "scale",
      scale: { min: 0, max: 10, label_min: "No Pain", label_max: "Worst Pain" },
      required: true,
      category: "symptoms",
      rationale: "Pain monitoring",
    },
    {
      question: "Are you experiencing any emergency symptoms (chest pain, difficulty breathing, severe bleeding)?",
      type: "yes_no",
      required: true,
      category: "safety",
      rationale: "Emergency symptom detection",
    },
    {
      question: "Do you have any concerns you want to share with your care team?",
      type: "text",
      required: false,
      category: "wellness",
      rationale: "Open-ended patient concerns",
    },
  ];
}

/**
 * Log usage for cost tracking
 */
async function logUsage(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  tenantId: string | undefined,
  responseTimeMs: number,
  questionCount: number,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    // Estimate tokens (~100 input, ~200 output per question)
    const estimatedInputTokens = 300;
    const estimatedOutputTokens = questionCount * 150;

    // Haiku pricing: $0.80/1M input, $4.00/1M output
    const cost =
      (estimatedInputTokens / 1_000_000) * 0.8 +
      (estimatedOutputTokens / 1_000_000) * 4.0;

    await supabase.from("claude_usage_logs").insert({
      user_id: patientId,
      tenant_id: tenantId,
      request_id: crypto.randomUUID(),
      model: HAIKU_MODEL,
      request_type: "check_in_questions",
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
