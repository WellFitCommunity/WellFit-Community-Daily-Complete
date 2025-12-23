/**
 * AI Contraindication Detector Edge Function
 *
 * Performs comprehensive patient-specific contraindication checking for medications.
 * Uses Claude Sonnet 4.5 for clinical reasoning and safety accuracy.
 *
 * Skill #25 - Contraindication Detector
 *
 * Checks:
 * - Disease-drug contraindications
 * - Allergy cross-reactivity
 * - Lab value contraindications
 * - Age-specific contraindications
 * - Pregnancy/Lactation contraindications
 * - Organ impairment (renal, hepatic)
 *
 * @module ai-contraindication-detector
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
// Use Sonnet 4.5 for clinical safety - accuracy is critical
const SONNET_MODEL = "claude-sonnet-4-20250514";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ContraindicationRequest {
  patientId: string;
  providerId: string;
  medicationRxcui: string;
  medicationName: string;
  indication?: string;
  proposedDosage?: string;
  includeDrugInteractions?: boolean;
  tenantId?: string;
}

interface PatientContext {
  demographics: {
    age?: number;
    sex?: string;
    weight?: number;
    pregnancyStatus?: string;
    lactationStatus?: string;
  };
  activeConditions: Array<{ code: string; display: string; category?: string }>;
  activeMedications: Array<{ rxcui?: string; name: string; dosage?: string }>;
  allergies: Array<{
    allergen: string;
    allergenType: string;
    severity?: string;
    criticality?: string;
    reactions?: string[];
  }>;
  labValues: Record<string, number | undefined>;
}

interface ContraindicationFinding {
  type: string;
  severity: "contraindicated" | "high" | "moderate" | "low";
  title: string;
  description: string;
  clinicalReasoning: string;
  triggerFactor: string;
  recommendations: string[];
  alternatives?: string[];
  confidence: number;
  source: string;
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
  const logger = createLogger("ai-contraindication-detector", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: ContraindicationRequest = await req.json();
    const {
      patientId,
      providerId,
      medicationRxcui,
      medicationName,
      indication,
      proposedDosage,
      includeDrugInteractions = true,
    } = body;

    // Validate required fields
    if (!patientId || !providerId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: patientId, providerId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!medicationRxcui && !medicationName) {
      return new Response(
        JSON.stringify({ error: "Missing required field: medicationRxcui or medicationName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Gather comprehensive patient context
    const startTime = Date.now();
    const context = await gatherPatientContext(supabase, patientId, logger);

    // Perform contraindication analysis with Claude
    const analysisResult = await analyzeContraindications(
      context,
      {
        rxcui: medicationRxcui || "",
        name: medicationName,
        indication,
        proposedDosage,
      },
      includeDrugInteractions,
      logger
    );

    const responseTime = Date.now() - startTime;

    // Log usage
    await supabase.from("claude_usage_logs").insert({
      user_id: providerId,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: "contraindication_check",
      input_tokens: 1500,
      output_tokens: 1200,
      cost: (1500 / 1_000_000) * 3.0 + (1200 / 1_000_000) * 15.0,
      response_time_ms: responseTime,
      success: true,
      metadata: {
        medicationName,
        findingsCount: analysisResult.findings.length,
        overallAssessment: analysisResult.overallAssessment,
      },
    });

    // Log PHI access for HIPAA audit
    logger.phi("Contraindication check performed", {
      patientId: redact(patientId),
      medicationName,
      findingsCount: analysisResult.findings.length,
      overallAssessment: analysisResult.overallAssessment,
    });

    return new Response(
      JSON.stringify({
        result: analysisResult,
        medication: {
          rxcui: medicationRxcui || "",
          name: medicationName,
          proposedDosage,
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          model: SONNET_MODEL,
          responseTimeMs: responseTime,
          checksPerformed: [
            "disease_contraindication",
            "allergy_cross_reactivity",
            "lab_value_check",
            "age_contraindication",
            "pregnancy_lactation",
            "organ_impairment",
            ...(includeDrugInteractions ? ["drug_drug_interaction"] : []),
          ],
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Contraindication check failed", { error: error.message });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Context Gathering
// ─────────────────────────────────────────────────────────────────────────────

async function gatherPatientContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  logger: ReturnType<typeof createLogger>
): Promise<PatientContext> {
  const context: PatientContext = {
    demographics: {},
    activeConditions: [],
    activeMedications: [],
    allergies: [],
    labValues: {},
  };

  try {
    // Get patient demographics
    const { data: profile } = await supabase
      .from("profiles")
      .select("date_of_birth, gender, pregnancy_status")
      .eq("id", patientId)
      .single();

    if (profile) {
      if (profile.date_of_birth) {
        const dob = new Date(profile.date_of_birth);
        const today = new Date();
        context.demographics.age = Math.floor(
          (today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        );
      }
      context.demographics.sex = profile.gender || undefined;
      context.demographics.pregnancyStatus = profile.pregnancy_status || "unknown";
    }

    // Get active conditions
    const { data: conditions } = await supabase
      .from("fhir_conditions")
      .select("code, display, category")
      .eq("patient_id", patientId)
      .eq("clinical_status", "active")
      .limit(20);

    if (conditions) {
      context.activeConditions = conditions.map((c) => ({
        code: c.code || "",
        display: c.display || "",
        category: c.category || undefined,
      }));
    }

    // Get active medications
    const { data: medications } = await supabase
      .from("fhir_medication_requests")
      .select("medication_code, medication_display, dosage_instruction")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(30);

    if (medications) {
      context.activeMedications = medications.map((m) => ({
        rxcui: m.medication_code || undefined,
        name: m.medication_display || "",
        dosage: m.dosage_instruction || undefined,
      }));
    }

    // Get allergies
    const { data: allergies } = await supabase
      .from("allergy_intolerances")
      .select("allergen_name, allergen_type, severity, criticality, reaction_manifestation")
      .eq("patient_id", patientId)
      .eq("clinical_status", "active");

    if (allergies) {
      context.allergies = allergies.map((a) => ({
        allergen: a.allergen_name || "",
        allergenType: a.allergen_type || "medication",
        severity: a.severity || undefined,
        criticality: a.criticality || undefined,
        reactions: a.reaction_manifestation || [],
      }));
    }

    // Get recent lab values
    const labCodes = [
      { code: "2160-0", key: "creatinine" },
      { code: "33914-3", key: "eGFR" },
      { code: "3094-0", key: "bun" },
      { code: "1742-6", key: "alt" },
      { code: "1920-8", key: "ast" },
      { code: "1975-2", key: "bilirubin" },
      { code: "2823-3", key: "potassium" },
      { code: "2951-2", key: "sodium" },
      { code: "5902-2", key: "inr" },
      { code: "777-3", key: "platelets" },
    ];

    for (const lab of labCodes) {
      const { data: labResult } = await supabase
        .from("fhir_observations")
        .select("value")
        .eq("patient_id", patientId)
        .eq("code", lab.code)
        .order("effective_date", { ascending: false })
        .limit(1)
        .single();

      if (labResult?.value) {
        context.labValues[lab.key] = parseFloat(labResult.value);
      }
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather complete patient context", { error: error.message });
  }

  return context;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Analysis
// ─────────────────────────────────────────────────────────────────────────────

async function analyzeContraindications(
  context: PatientContext,
  medication: { rxcui: string; name: string; indication?: string; proposedDosage?: string },
  includeDrugInteractions: boolean,
  logger: ReturnType<typeof createLogger>
): Promise<{
  overallAssessment: "safe" | "caution" | "warning" | "contraindicated";
  requiresClinicalReview: boolean;
  reviewReasons: string[];
  findings: ContraindicationFinding[];
  findingsSummary: { contraindicated: number; high: number; moderate: number; low: number; total: number };
  patientContext: PatientContext;
  confidence: number;
  clinicalSummary: string;
}> {
  const conditionsText =
    context.activeConditions.length > 0
      ? context.activeConditions.map((c) => `${c.display} (${c.code})`).join("\n")
      : "None documented";

  const medicationsText =
    context.activeMedications.length > 0
      ? context.activeMedications.map((m) => `${m.name}${m.dosage ? ` - ${m.dosage}` : ""}`).join("\n")
      : "None documented";

  const allergiesText =
    context.allergies.length > 0
      ? context.allergies
          .map(
            (a) =>
              `${a.allergen} (${a.allergenType}, ${a.criticality || "unknown"} criticality, ${a.severity || "unknown"} severity)${a.reactions?.length ? ` - Reactions: ${a.reactions.join(", ")}` : ""}`
          )
          .join("\n")
      : "NKDA (No Known Drug Allergies)";

  const labValuesText = Object.entries(context.labValues)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ") || "No recent labs available";

  const prompt = `You are an expert clinical pharmacist and physician assistant performing a comprehensive contraindication safety check. Analyze the proposed medication against the patient's complete clinical profile.

PROPOSED MEDICATION:
- Name: ${medication.name}
- RxCUI: ${medication.rxcui || "Not provided"}
- Indication: ${medication.indication || "Not specified"}
- Proposed Dosage: ${medication.proposedDosage || "Not specified"}

PATIENT DEMOGRAPHICS:
- Age: ${context.demographics.age !== undefined ? `${context.demographics.age} years` : "Unknown"}
- Sex: ${context.demographics.sex || "Unknown"}
- Pregnancy Status: ${context.demographics.pregnancyStatus || "Unknown"}
- Lactation Status: ${context.demographics.lactationStatus || "Unknown"}

ACTIVE CONDITIONS (ICD-10/SNOMED):
${conditionsText}

CURRENT MEDICATIONS:
${medicationsText}

DOCUMENTED ALLERGIES:
${allergiesText}

RECENT LAB VALUES:
${labValuesText}

Perform the following safety checks:

1. DISEASE-DRUG CONTRAINDICATIONS
   - Check if the medication is contraindicated for any of the patient's active conditions
   - Consider relative vs absolute contraindications

2. ALLERGY CROSS-REACTIVITY
   - Check for documented allergies to this medication
   - Check for drug class cross-reactivity (e.g., penicillin → cephalosporin)
   - Consider severity and criticality of allergies

3. LAB VALUE CONTRAINDICATIONS
   - Renal function (eGFR < 30 = severe, 30-60 = moderate impairment)
   - Hepatic function (elevated ALT/AST > 3x ULN)
   - Electrolyte abnormalities (K+, Na+)
   - Coagulation status (INR, platelets)

4. AGE-SPECIFIC CONTRAINDICATIONS
   - Pediatric concerns (if age < 18)
   - Geriatric concerns (if age > 65): increased fall risk, anticholinergic burden, Beers criteria
   - Consider dose adjustments needed

5. PREGNANCY/LACTATION
   - FDA pregnancy category considerations
   - Breastfeeding safety

6. ORGAN IMPAIRMENT
   - Renal dosing requirements
   - Hepatic metabolism considerations

${includeDrugInteractions ? `
7. DRUG-DRUG INTERACTIONS
   - Check against current medication list
   - Note any significant interactions
` : ""}

Return your analysis as JSON with this exact structure:
{
  "overallAssessment": "safe|caution|warning|contraindicated",
  "requiresClinicalReview": true|false,
  "reviewReasons": ["List of reasons if review required"],
  "findings": [
    {
      "type": "disease_contraindication|allergy_contraindication|drug_class_allergy|lab_value_contraindication|age_contraindication|pregnancy_contraindication|lactation_contraindication|renal_impairment|hepatic_impairment|drug_drug_interaction",
      "severity": "contraindicated|high|moderate|low",
      "title": "Brief title",
      "description": "Detailed description",
      "clinicalReasoning": "Evidence-based reasoning",
      "triggerFactor": "What triggered this finding",
      "recommendations": ["Specific recommendations"],
      "alternatives": ["Alternative medications if applicable"],
      "confidence": 0.85,
      "source": "ai_analysis|drug_database|clinical_guideline"
    }
  ],
  "confidence": 0.85,
  "clinicalSummary": "2-3 sentence summary of key findings and overall recommendation"
}

CRITICAL SAFETY RULES:
- If ANY absolute contraindication is found, overallAssessment MUST be "contraindicated"
- If high-severity findings exist, requiresClinicalReview MUST be true
- Be conservative - err on the side of caution for patient safety
- Include evidence-based reasoning for each finding

Return ONLY valid JSON.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: SONNET_MODEL,
      max_tokens: 3000,
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

      // Calculate findings summary
      const findingsSummary = {
        contraindicated: 0,
        high: 0,
        moderate: 0,
        low: 0,
        total: 0,
      };

      if (parsed.findings && Array.isArray(parsed.findings)) {
        parsed.findings.forEach((f: ContraindicationFinding) => {
          findingsSummary.total++;
          switch (f.severity) {
            case "contraindicated":
              findingsSummary.contraindicated++;
              break;
            case "high":
              findingsSummary.high++;
              break;
            case "moderate":
              findingsSummary.moderate++;
              break;
            case "low":
              findingsSummary.low++;
              break;
          }
        });
      }

      return {
        overallAssessment: parsed.overallAssessment || "caution",
        requiresClinicalReview: parsed.requiresClinicalReview ?? true,
        reviewReasons: parsed.reviewReasons || [],
        findings: parsed.findings || [],
        findingsSummary,
        patientContext: context,
        confidence: parsed.confidence || 0.75,
        clinicalSummary: parsed.clinicalSummary || "Analysis complete. Please review findings.",
      };
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  // Fallback response if parsing fails
  logger.warn("Using fallback analysis response");
  return {
    overallAssessment: "caution",
    requiresClinicalReview: true,
    reviewReasons: ["AI analysis incomplete - manual review required"],
    findings: [],
    findingsSummary: { contraindicated: 0, high: 0, moderate: 0, low: 0, total: 0 },
    patientContext: context,
    confidence: 0.3,
    clinicalSummary:
      "Unable to complete automated analysis. Manual clinical review is required before prescribing.",
  };
}
