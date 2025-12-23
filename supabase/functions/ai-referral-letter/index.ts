/**
 * AI Referral Letter Generator Edge Function
 *
 * Generates professional referral letters from referring physician to specialist.
 * Uses Claude Haiku 4.5 for cost-effective generation.
 *
 * HIPAA-compliant with:
 * - Audit logging for all PHI access
 * - PHI redaction in logs
 * - Secure data handling
 *
 * Skill #22 - Referral Letter Generator
 *
 * @module ai-referral-letter
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const HAIKU_MODEL = "claude-haiku-4-5-20250919";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ReferralLetterRequest {
  patientId: string;
  referringProviderId: string;
  specialistSpecialty: string;
  specialistProviderId?: string;
  clinicalReason: string;
  clinicalNotes?: string;
  diagnoses?: string[];
  medications?: string[];
  allergies?: string[];
  insurancePayer?: string;
  urgency?: "routine" | "urgent" | "emergent";
  tenantId?: string;
}

interface ReferringProvider {
  name: string;
  credentials?: string;
  npi?: string;
  practice?: string;
  phone?: string;
  fax?: string;
}

interface RecipientProvider {
  name?: string;
  specialty: string;
  practice?: string;
  address?: string;
}

interface ReferralLetter {
  letterDate: string;
  referringProvider: ReferringProvider;
  recipientProvider: RecipientProvider;
  patientName: string;
  patientDOB: string;
  mrn: string;
  chiefComplaint: string;
  relevantHistory: string;
  currentMedications: string[];
  allergies: string[];
  clinicalReason: string;
  specificQuestions: string[];
  expectedTimeline: string;
  contactInfo: string;
  closingStatements: string;
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  insuranceNotes?: string;
}

interface ReferralContext {
  patientFirstName: string;
  patientDOB?: string;
  patientMRN?: string;
  referringProviderName: string;
  referringProviderCredentials?: string;
  referringProviderNPI?: string;
  conditions: Array<{ code: string; display: string }>;
  medications: Array<{ name: string; dose?: string; frequency?: string }>;
  allergies: string[];
  recentVitals?: Record<string, unknown>;
  socialHistory?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHI Redaction for Logging
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
  const logger = createLogger("ai-referral-letter", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: ReferralLetterRequest = await req.json();
    const {
      patientId,
      referringProviderId,
      specialistSpecialty,
      clinicalReason,
      urgency = "routine",
    } = body;

    // Validate required fields
    if (!patientId || !referringProviderId || !specialistSpecialty || !clinicalReason) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: patientId, referringProviderId, specialistSpecialty, clinicalReason",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Gather patient and provider context
    const startTime = Date.now();
    const context = await gatherReferralContext(
      supabase,
      patientId,
      referringProviderId,
      body,
      logger
    );

    // Generate referral letter
    const letter = await generateReferralLetter(context, body, logger);
    const responseTime = Date.now() - startTime;

    // Format the letter for printing
    const formattedLetter = formatLetterForPrint(letter);

    // Log usage for cost tracking
    await supabase.from("claude_usage_logs").insert({
      user_id: referringProviderId,
      request_id: crypto.randomUUID(),
      model: HAIKU_MODEL,
      request_type: "referral_letter_generation",
      input_tokens: 800, // Estimated
      output_tokens: 600, // Estimated
      cost: (800 / 1_000_000) * 0.8 + (600 / 1_000_000) * 4.0,
      response_time_ms: responseTime,
      success: true,
      metadata: {
        specialty: specialistSpecialty,
        urgency,
        confidence: letter.confidence,
      },
    });

    // Log PHI access for HIPAA audit trail
    logger.phi("Referral letter generated", {
      patientId: redact(patientId),
      specialty: specialistSpecialty,
      urgency,
    });

    return new Response(
      JSON.stringify({
        letter,
        formattedLetter,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: HAIKU_MODEL,
          responseTimeMs: responseTime,
          specialty: specialistSpecialty,
          patientContext: {
            conditionsCount: context.conditions.length,
            medicationsCount: context.medications.length,
            allergiesCount: context.allergies.length,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Referral letter generation failed", { error: error.message });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Context Gathering
// ─────────────────────────────────────────────────────────────────────────────

async function gatherReferralContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  referringProviderId: string,
  request: ReferralLetterRequest,
  logger: ReturnType<typeof createLogger>
): Promise<ReferralContext> {
  const context: ReferralContext = {
    patientFirstName: "Patient",
    referringProviderName: "Provider",
    conditions: [],
    medications: [],
    allergies: [],
  };

  try {
    // Get patient profile (minimal PII needed for letter)
    const { data: patientProfile } = await supabase
      .from("profiles")
      .select("first_name, date_of_birth")
      .eq("id", patientId)
      .single();

    if (patientProfile?.first_name) {
      context.patientFirstName = patientProfile.first_name;
    }
    if (patientProfile?.date_of_birth) {
      context.patientDOB = patientProfile.date_of_birth;
    }

    // Get referring provider info
    const { data: providerProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name, credentials, npi_number")
      .eq("id", referringProviderId)
      .single();

    if (providerProfile) {
      context.referringProviderName = `${providerProfile.first_name || ""} ${providerProfile.last_name || ""}`.trim() || "Provider";
      context.referringProviderCredentials = providerProfile.credentials;
      context.referringProviderNPI = providerProfile.npi_number;
    }

    // Get active conditions (for relevant history)
    const { data: conditions } = await supabase
      .from("fhir_conditions")
      .select("code, display")
      .eq("patient_id", patientId)
      .eq("clinical_status", "active")
      .limit(10);

    if (conditions) {
      context.conditions = conditions.map((c) => ({
        code: c.code || "",
        display: c.display || "",
      }));
    }

    // Use request-provided medications if available, else fetch from DB
    if (request.medications && request.medications.length > 0) {
      context.medications = request.medications.map((m) => ({ name: m }));
    } else {
      const { data: medications } = await supabase
        .from("fhir_medication_requests")
        .select("medication_name, dosage_instruction")
        .eq("patient_id", patientId)
        .eq("status", "active")
        .limit(15);

      if (medications) {
        context.medications = medications.map((m) => ({
          name: m.medication_name || "",
          dose: m.dosage_instruction || "",
        }));
      }
    }

    // Use request-provided allergies if available, else fetch from DB
    if (request.allergies && request.allergies.length > 0) {
      context.allergies = request.allergies;
    } else {
      const { data: allergies } = await supabase
        .from("fhir_allergies")
        .select("substance, reaction_severity")
        .eq("patient_id", patientId);

      if (allergies) {
        context.allergies = allergies.map((a) =>
          a.reaction_severity
            ? `${a.substance} (${a.reaction_severity})`
            : a.substance
        );
      }
    }

    // Get recent vitals for clinical context
    const { data: vitals } = await supabase
      .from("fhir_observations")
      .select("code, value, unit, effective_date")
      .eq("patient_id", patientId)
      .eq("category", "vital-signs")
      .order("effective_date", { ascending: false })
      .limit(5);

    if (vitals && vitals.length > 0) {
      context.recentVitals = vitals.reduce((acc, v) => {
        acc[v.code] = { value: v.value, unit: v.unit, date: v.effective_date };
        return acc;
      }, {} as Record<string, unknown>);
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather full referral context", { error: error.message });
    // Continue with partial context - better than failing entirely
  }

  return context;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Letter Generation
// ─────────────────────────────────────────────────────────────────────────────

async function generateReferralLetter(
  context: ReferralContext,
  request: ReferralLetterRequest,
  logger: ReturnType<typeof createLogger>
): Promise<ReferralLetter> {
  const urgencyNotes =
    request.urgency === "emergent"
      ? "This referral is URGENT/EMERGENT and requires expedited evaluation as soon as possible."
      : request.urgency === "urgent"
      ? "This referral is URGENT and should be scheduled within 1-2 weeks."
      : "This is a routine referral and can be scheduled at the patient's convenience.";

  const diagnosesText =
    request.diagnoses && request.diagnoses.length > 0
      ? request.diagnoses.join(", ")
      : context.conditions.length > 0
      ? context.conditions.map((c) => `${c.display} (${c.code})`).join(", ")
      : "None documented";

  const medicationsText =
    context.medications.length > 0
      ? context.medications
          .map((m) => (m.dose ? `${m.name} ${m.dose}` : m.name))
          .join("\n")
      : "None documented";

  const allergiesText =
    context.allergies.length > 0 ? context.allergies.join(", ") : "NKDA (No Known Drug Allergies)";

  const prompt = `You are a professional medical referral letter generator. Generate a formal, professional referral letter from a referring physician to a specialist.

PATIENT INFORMATION:
- Name: ${context.patientFirstName} (use first name only for privacy)
- DOB: ${context.patientDOB || "Not provided"}
- MRN: ${context.patientMRN || "To be assigned"}

REFERRING PROVIDER:
- Name: ${context.referringProviderName}
- Credentials: ${context.referringProviderCredentials || "MD"}
- NPI: ${context.referringProviderNPI || "On file"}

REFERRAL TARGET:
- Specialty: ${request.specialistSpecialty}
- Urgency: ${urgencyNotes}

CLINICAL REASON FOR REFERRAL:
${request.clinicalReason}

ADDITIONAL CLINICAL NOTES:
${request.clinicalNotes || "None provided"}

CURRENT DIAGNOSES:
${diagnosesText}

CURRENT MEDICATIONS:
${medicationsText}

ALLERGIES:
${allergiesText}

Generate a professional, comprehensive referral letter. Include:
1. Professional letterhead format with date
2. Clear identification of patient
3. Chief complaint / reason for referral
4. Relevant medical history pertinent to this referral
5. Current medications and allergies
6. Specific clinical questions for the specialist
7. Expected timeline for evaluation
8. Professional closing

Important guidelines:
- Be concise but thorough
- Use professional medical terminology
- Avoid unnecessary redundancy
- Ensure all critical clinical information is included
- The letter should be ready to send after physician review

Return your response as valid JSON with this exact structure:
{
  "letterDate": "YYYY-MM-DD",
  "referringProvider": {
    "name": "${context.referringProviderName}",
    "credentials": "${context.referringProviderCredentials || "MD"}",
    "npi": "${context.referringProviderNPI || ""}",
    "practice": "",
    "phone": "",
    "fax": ""
  },
  "recipientProvider": {
    "name": null,
    "specialty": "${request.specialistSpecialty}",
    "practice": "",
    "address": ""
  },
  "patientName": "${context.patientFirstName}",
  "patientDOB": "${context.patientDOB || ""}",
  "mrn": "${context.patientMRN || ""}",
  "chiefComplaint": "Brief summary of primary complaint",
  "relevantHistory": "Relevant medical history paragraph",
  "currentMedications": ["List of current medications"],
  "allergies": ["List of allergies"],
  "clinicalReason": "Detailed clinical reason for referral",
  "specificQuestions": ["List of 2-4 specific questions for specialist"],
  "expectedTimeline": "Expected timeline for evaluation",
  "contactInfo": "Contact information for follow-up",
  "closingStatements": "Professional closing paragraph",
  "confidence": 0.85,
  "requiresReview": true,
  "reviewReasons": ["All referral letters require physician review before sending"]
}

Return ONLY the JSON object, no additional text.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 1500,
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
      const parsed = JSON.parse(jsonMatch[0]) as ReferralLetter;

      // Ensure required fields have defaults
      return {
        letterDate: parsed.letterDate || new Date().toISOString().split("T")[0],
        referringProvider: parsed.referringProvider || {
          name: context.referringProviderName,
          credentials: context.referringProviderCredentials || "MD",
        },
        recipientProvider: parsed.recipientProvider || {
          specialty: request.specialistSpecialty,
        },
        patientName: parsed.patientName || context.patientFirstName,
        patientDOB: parsed.patientDOB || context.patientDOB || "",
        mrn: parsed.mrn || context.patientMRN || "",
        chiefComplaint: parsed.chiefComplaint || request.clinicalReason,
        relevantHistory: parsed.relevantHistory || "",
        currentMedications: parsed.currentMedications || [],
        allergies: parsed.allergies || context.allergies,
        clinicalReason: parsed.clinicalReason || request.clinicalReason,
        specificQuestions: parsed.specificQuestions || [],
        expectedTimeline: parsed.expectedTimeline || getDefaultTimeline(request.urgency),
        contactInfo: parsed.contactInfo || "",
        closingStatements: parsed.closingStatements || "Thank you for your consultation on this patient.",
        confidence: parsed.confidence || 0.75,
        requiresReview: true, // SAFETY: Always require review
        reviewReasons: ["All referral letters require physician review before sending"],
        insuranceNotes: parsed.insuranceNotes,
      };
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  // Fallback letter if AI response parsing fails
  logger.warn("Using fallback letter template");
  return {
    letterDate: new Date().toISOString().split("T")[0],
    referringProvider: {
      name: context.referringProviderName,
      credentials: context.referringProviderCredentials || "MD",
      npi: context.referringProviderNPI,
    },
    recipientProvider: {
      specialty: request.specialistSpecialty,
    },
    patientName: context.patientFirstName,
    patientDOB: context.patientDOB || "",
    mrn: context.patientMRN || "",
    chiefComplaint: request.clinicalReason,
    relevantHistory: context.conditions.length > 0
      ? `Active conditions: ${context.conditions.map((c) => c.display).join(", ")}`
      : "Please see patient chart for full history.",
    currentMedications: context.medications.map((m) => m.name),
    allergies: context.allergies,
    clinicalReason: request.clinicalReason,
    specificQuestions: [
      `Please evaluate and provide recommendations for ${request.clinicalReason}`,
    ],
    expectedTimeline: getDefaultTimeline(request.urgency),
    contactInfo: "Please contact our office for any questions.",
    closingStatements:
      "Thank you for your consultation. Please do not hesitate to contact our office if you require additional information.",
    confidence: 0.5, // Lower confidence for fallback
    requiresReview: true,
    reviewReasons: [
      "All referral letters require physician review before sending",
      "This letter was generated using fallback template - review carefully",
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getDefaultTimeline(urgency?: string): string {
  switch (urgency) {
    case "emergent":
      return "Immediate evaluation requested - please contact patient as soon as possible";
    case "urgent":
      return "Evaluation within 1-2 weeks is recommended";
    default:
      return "Routine evaluation at patient's earliest convenience";
  }
}

function formatLetterForPrint(letter: ReferralLetter): string {
  const lines: string[] = [
    letter.referringProvider.practice || "",
    letter.referringProvider.name,
    letter.referringProvider.credentials || "",
    letter.referringProvider.npi ? `NPI: ${letter.referringProvider.npi}` : "",
    letter.referringProvider.phone ? `Phone: ${letter.referringProvider.phone}` : "",
    letter.referringProvider.fax ? `Fax: ${letter.referringProvider.fax}` : "",
    "",
    `Date: ${letter.letterDate}`,
    "",
    letter.recipientProvider.name || letter.recipientProvider.specialty,
    letter.recipientProvider.practice || "",
    letter.recipientProvider.address || "",
    "",
    `RE: ${letter.patientName}`,
    letter.patientDOB ? `DOB: ${letter.patientDOB}` : "",
    letter.mrn ? `MRN: ${letter.mrn}` : "",
    "",
    `Dear ${letter.recipientProvider.name || "Colleague"}:`,
    "",
    `I am writing to refer the above patient to your office for evaluation and management of ${letter.chiefComplaint}.`,
    "",
    "CLINICAL REASON FOR REFERRAL:",
    letter.clinicalReason,
    "",
    "RELEVANT HISTORY:",
    letter.relevantHistory,
    "",
  ];

  if (letter.currentMedications.length > 0) {
    lines.push("CURRENT MEDICATIONS:");
    letter.currentMedications.forEach((med) => lines.push(`  - ${med}`));
    lines.push("");
  }

  if (letter.allergies.length > 0) {
    lines.push(`ALLERGIES: ${letter.allergies.join(", ")}`);
    lines.push("");
  }

  if (letter.specificQuestions.length > 0) {
    lines.push("SPECIFIC QUESTIONS FOR YOUR EVALUATION:");
    letter.specificQuestions.forEach((q, i) => lines.push(`  ${i + 1}. ${q}`));
    lines.push("");
  }

  lines.push(
    letter.closingStatements,
    "",
    "Sincerely,",
    "",
    letter.referringProvider.name,
    letter.referringProvider.credentials || ""
  );

  if (letter.referringProvider.npi) {
    lines.push(`NPI: ${letter.referringProvider.npi}`);
  }

  return lines.filter((line) => line !== undefined && line !== "").join("\n");
}
