/**
 * AI Patient Q&A Bot Edge Function
 *
 * Skill #56: Answers patient health questions using Claude Sonnet with safety guardrails.
 *
 * Features:
 * - Personalized answers based on patient's conditions & medications
 * - Safety guardrails for medical advice
 * - Emergency detection and escalation
 * - 6th-grade reading level responses
 * - Multi-language support
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy with safety constraints.
 * HIPAA-compliant - never stores or returns PHI in responses.
 *
 * @module ai-patient-qa-bot
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SONNET_MODEL = "claude-sonnet-4-20250514";

interface QARequest {
  question: string;
  patientId?: string;
  tenantId?: string;
  language?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  includePatientContext?: boolean;
}

interface SafetyCheck {
  isEmergency: boolean;
  emergencyReason?: string;
  requiresProviderConsult: boolean;
  consultReason?: string;
  blockedTopics: string[];
}

interface QAResponse {
  answer: string;
  readingLevel: string;
  confidence: number;
  safetyCheck: SafetyCheck;
  relatedTopics: string[];
  sources: string[];
  disclaimers: string[];
  suggestedFollowUp?: string;
}

interface PatientContext {
  conditions: string[];
  medications: string[];
  allergies: string[];
  age_group?: string;
  preferred_language: string;
}

// Emergency keywords that trigger immediate escalation
const EMERGENCY_KEYWORDS = [
  "chest pain",
  "heart attack",
  "can't breathe",
  "difficulty breathing",
  "stroke",
  "face drooping",
  "slurred speech",
  "severe bleeding",
  "unconscious",
  "seizure",
  "suicidal",
  "want to die",
  "overdose",
  "poisoning",
  "choking",
  "allergic reaction",
  "anaphylaxis",
  "severe pain",
];

// Topics that require provider consultation
const PROVIDER_CONSULT_TOPICS = [
  "stop taking medication",
  "change dosage",
  "discontinue",
  "pregnant",
  "pregnancy",
  "surgery",
  "diagnosis",
  "cancer",
  "hiv",
  "mental health crisis",
];

// Topics we don't provide advice on
const BLOCKED_TOPICS = [
  "illegal drugs",
  "recreational drug",
  "harm myself",
  "harm others",
  "weapons",
  "violence",
];

// PHI Redaction
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

serve(async (req) => {
  const logger = createLogger("ai-patient-qa-bot", req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Parse request
    const body: QARequest = await req.json();
    const {
      question,
      patientId,
      tenantId,
      language = "English",
      conversationHistory = [],
      includePatientContext = true,
    } = body;

    // Validate required fields
    if (!question || question.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required field: question" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate Anthropic API key
    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    // Perform safety checks first
    const safetyCheck = performSafetyCheck(question);

    // If emergency detected, return immediately
    if (safetyCheck.isEmergency) {
      logger.security("Emergency detected in patient question", {
        patientId: patientId ? redact(patientId) : undefined,
        reason: safetyCheck.emergencyReason,
      });

      return new Response(
        JSON.stringify({
          answer: getEmergencyResponse(safetyCheck.emergencyReason!, language),
          readingLevel: "6th grade",
          confidence: 1.0,
          safetyCheck,
          relatedTopics: [],
          sources: [],
          disclaimers: ["This is an emergency situation. Please seek immediate medical attention."],
          suggestedFollowUp: "Call 911 or go to the nearest emergency room immediately.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for blocked topics
    if (safetyCheck.blockedTopics.length > 0) {
      return new Response(
        JSON.stringify({
          answer: "I'm sorry, but I can't provide information on that topic. Please speak with your healthcare provider directly about this.",
          readingLevel: "6th grade",
          confidence: 1.0,
          safetyCheck,
          relatedTopics: [],
          sources: [],
          disclaimers: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Gather patient context if available and requested
    let patientContext: PatientContext | null = null;
    if (patientId && includePatientContext) {
      patientContext = await gatherPatientContext(supabase, patientId, language, logger);
    }

    // Generate answer
    const startTime = Date.now();
    const response = await generateAnswer(
      question,
      patientContext,
      conversationHistory,
      language,
      safetyCheck,
      logger
    );
    const responseTime = Date.now() - startTime;

    // Log usage
    await logUsage(supabase, patientId, tenantId, question, responseTime, logger);

    logger.info("Generated patient Q&A response", {
      patientId: patientId ? redact(patientId) : undefined,
      questionLength: question.length,
      responseTimeMs: responseTime,
      requiresConsult: safetyCheck.requiresProviderConsult,
    });

    return new Response(
      JSON.stringify({
        ...response,
        metadata: {
          generated_at: new Date().toISOString(),
          model: SONNET_MODEL,
          response_time_ms: responseTime,
          language,
          had_patient_context: !!patientContext,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Patient Q&A failed", { error: error.message });

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
 * Perform safety checks on the question
 */
function performSafetyCheck(question: string): SafetyCheck {
  const lowerQuestion = question.toLowerCase();
  const result: SafetyCheck = {
    isEmergency: false,
    requiresProviderConsult: false,
    blockedTopics: [],
  };

  // Check for emergency keywords
  for (const keyword of EMERGENCY_KEYWORDS) {
    if (lowerQuestion.includes(keyword)) {
      result.isEmergency = true;
      result.emergencyReason = keyword;
      return result;
    }
  }

  // Check for provider consult topics
  for (const topic of PROVIDER_CONSULT_TOPICS) {
    if (lowerQuestion.includes(topic)) {
      result.requiresProviderConsult = true;
      result.consultReason = `Question involves ${topic}`;
    }
  }

  // Check for blocked topics
  for (const topic of BLOCKED_TOPICS) {
    if (lowerQuestion.includes(topic)) {
      result.blockedTopics.push(topic);
    }
  }

  return result;
}

/**
 * Get emergency response text
 */
function getEmergencyResponse(reason: string, language: string): string {
  const responses: Record<string, string> = {
    English: `⚠️ **EMERGENCY ALERT**

Based on your message about "${reason}", this may be a medical emergency.

**Please take immediate action:**
1. **Call 911** (or your local emergency number) immediately
2. If you're with someone, ask them to help
3. If you have prescribed emergency medication (like an EpiPen or nitroglycerin), use it as directed
4. Stay as calm as possible until help arrives

**Do not wait** - these symptoms require immediate medical attention.

If this is not an emergency, please rephrase your question and I'll be happy to help.`,

    Spanish: `⚠️ **ALERTA DE EMERGENCIA**

Basándome en su mensaje sobre "${reason}", esto puede ser una emergencia médica.

**Por favor tome acción inmediata:**
1. **Llame al 911** inmediatamente
2. Si está con alguien, pida ayuda
3. Si tiene medicamento de emergencia recetado, úselo según las indicaciones
4. Manténgase lo más tranquilo posible hasta que llegue la ayuda

**No espere** - estos síntomas requieren atención médica inmediata.`,
  };

  return responses[language] || responses["English"];
}

/**
 * Gather patient context for personalized responses
 */
async function gatherPatientContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  language: string,
  logger: ReturnType<typeof createLogger>
): Promise<PatientContext | null> {
  try {
    const context: PatientContext = {
      conditions: [],
      medications: [],
      allergies: [],
      preferred_language: language,
    };

    // Get active conditions (de-identified - only condition names)
    const { data: conditions } = await supabase
      .from("patient_diagnoses")
      .select("diagnosis_name")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(10);

    if (conditions) {
      context.conditions = conditions.map((c) => c.diagnosis_name);
    }

    // Get active medications (names only)
    const { data: medications } = await supabase
      .from("fhir_medication_requests")
      .select("medication_codeable_concept")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(15);

    if (medications) {
      context.medications = medications
        .map((m) => m.medication_codeable_concept?.coding?.[0]?.display)
        .filter(Boolean);
    }

    // Get allergies
    const { data: allergies } = await supabase
      .from("fhir_allergy_intolerances")
      .select("code")
      .eq("patient_id", patientId)
      .limit(10);

    if (allergies) {
      context.allergies = allergies
        .map((a: any) => a.code?.coding?.[0]?.display || a.code?.text)
        .filter(Boolean);
    }

    // Get patient profile for age group
    const { data: profile } = await supabase
      .from("profiles")
      .select("date_of_birth")
      .eq("user_id", patientId)
      .single();

    if (profile?.date_of_birth) {
      const age = Math.floor(
        (Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      if (age < 18) context.age_group = "pediatric";
      else if (age < 65) context.age_group = "adult";
      else context.age_group = "geriatric";
    }

    return context;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather patient context", { error: error.message });
    return null;
  }
}

/**
 * Generate answer using Claude Sonnet
 */
async function generateAnswer(
  question: string,
  patientContext: PatientContext | null,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  language: string,
  safetyCheck: SafetyCheck,
  logger: ReturnType<typeof createLogger>
): Promise<QAResponse> {
  const prompt = buildQAPrompt(question, patientContext, language, safetyCheck);

  // Build messages array with conversation history
  const messages = [
    ...conversationHistory.slice(-6), // Keep last 3 exchanges
    { role: "user" as const, content: prompt },
  ];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: SONNET_MODEL,
      max_tokens: 2048,
      system: getSystemPrompt(language),
      messages,
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
      return normalizeQAResponse(parsed, safetyCheck);
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  // Fallback - use raw content
  return {
    answer: content || "I'm sorry, I couldn't generate a response. Please try rephrasing your question.",
    readingLevel: "6th grade",
    confidence: 0.5,
    safetyCheck,
    relatedTopics: [],
    sources: ["AI-generated"],
    disclaimers: [
      "This information is for educational purposes only and is not a substitute for professional medical advice.",
      "Always consult your healthcare provider for personalized medical guidance.",
    ],
  };
}

/**
 * Get system prompt for the Q&A bot
 */
function getSystemPrompt(language: string): string {
  return `You are a compassionate, knowledgeable health assistant helping patients understand their health better.

CRITICAL RULES:
1. NEVER diagnose conditions or provide definitive medical advice
2. ALWAYS recommend consulting a healthcare provider for specific concerns
3. Use simple language at a 6th-grade reading level
4. Be empathetic and supportive
5. If unsure, say so and recommend professional consultation
6. For medication questions, emphasize following prescribed instructions
7. Never recommend stopping or changing medications without provider guidance
8. Respond in ${language}

SAFETY BOUNDARIES:
- Do not provide advice on illegal substances
- Do not provide advice that could cause self-harm
- Always escalate suicidal ideation to emergency resources
- Do not make promises about treatment outcomes

RESPONSE FORMAT:
Always respond with a JSON object containing:
{
  "answer": "Your helpful response here...",
  "readingLevel": "6th grade",
  "confidence": 0.85,
  "relatedTopics": ["Topic 1", "Topic 2"],
  "sources": ["General health knowledge"],
  "disclaimers": ["Standard medical disclaimer"],
  "suggestedFollowUp": "Optional follow-up question for the user"
}`;
}

/**
 * Build the Q&A prompt
 */
function buildQAPrompt(
  question: string,
  patientContext: PatientContext | null,
  language: string,
  safetyCheck: SafetyCheck
): string {
  let prompt = `Patient Question: "${question}"

`;

  if (patientContext) {
    prompt += `PATIENT CONTEXT (use to personalize response):
`;
    if (patientContext.conditions.length > 0) {
      prompt += `- Active conditions: ${patientContext.conditions.join(", ")}
`;
    }
    if (patientContext.medications.length > 0) {
      prompt += `- Current medications: ${patientContext.medications.join(", ")}
`;
    }
    if (patientContext.allergies.length > 0) {
      prompt += `- Known allergies: ${patientContext.allergies.join(", ")}
`;
    }
    if (patientContext.age_group) {
      prompt += `- Age group: ${patientContext.age_group}
`;
    }
    prompt += "\n";
  }

  if (safetyCheck.requiresProviderConsult) {
    prompt += `⚠️ NOTE: This question involves ${safetyCheck.consultReason}.
Emphasize that the patient should discuss this with their healthcare provider.

`;
  }

  prompt += `Please provide a helpful, accurate response in ${language} at a 6th-grade reading level.
Include relevant health education while emphasizing the importance of professional medical care.

Respond with a JSON object as specified in the system prompt.`;

  return prompt;
}

/**
 * Normalize the AI response
 */
function normalizeQAResponse(parsed: any, safetyCheck: SafetyCheck): QAResponse {
  const baseDisclaimers = [
    "This information is for educational purposes only.",
    "Please consult your healthcare provider for personalized advice.",
  ];

  if (safetyCheck.requiresProviderConsult) {
    baseDisclaimers.push(
      `This topic (${safetyCheck.consultReason}) should be discussed directly with your healthcare provider.`
    );
  }

  return {
    answer: parsed.answer || "Unable to generate response.",
    readingLevel: parsed.readingLevel || "6th grade",
    confidence: parsed.confidence ?? 0.7,
    safetyCheck,
    relatedTopics: parsed.relatedTopics || [],
    sources: parsed.sources || ["AI-generated health information"],
    disclaimers: [...baseDisclaimers, ...(parsed.disclaimers || [])],
    suggestedFollowUp: parsed.suggestedFollowUp,
  };
}

/**
 * Log usage for cost tracking
 */
async function logUsage(
  supabase: ReturnType<typeof createClient>,
  patientId: string | undefined,
  tenantId: string | undefined,
  question: string,
  responseTimeMs: number,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    // Estimate tokens
    const estimatedInputTokens = Math.ceil(question.length / 4) + 500; // prompt overhead
    const estimatedOutputTokens = 800;

    // Sonnet pricing: $3/1M input, $15/1M output
    const cost =
      (estimatedInputTokens / 1_000_000) * 3 + (estimatedOutputTokens / 1_000_000) * 15;

    await supabase.from("claude_usage_logs").insert({
      user_id: patientId || "anonymous",
      tenant_id: tenantId,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: "patient_qa",
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
