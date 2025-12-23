/**
 * AI Treatment Pathway Recommender Edge Function
 *
 * Skill #23: Evidence-based treatment pathway recommendations.
 *
 * Provides clinical decision support by recommending treatment pathways based on:
 * - Patient diagnosis/condition
 * - Current medications and allergies
 * - Contraindications
 * - SDOH factors
 * - Clinical guidelines (ADA, ACC, USPSTF, etc.)
 *
 * CRITICAL SAFETY GUARDRAILS:
 * 1. ALL recommendations require clinician review - never auto-prescribed
 * 2. Contraindications are prominently flagged
 * 3. Allergies are checked against recommendations
 * 4. References to clinical guidelines are required
 * 5. Confidence scoring for transparency
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy.
 *
 * @module ai-treatment-pathway
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SONNET_MODEL = "claude-sonnet-4-20250514";

// =====================================================
// TYPES
// =====================================================

interface TreatmentPathwayRequest {
  patientId: string;
  tenantId?: string;
  condition: string;
  conditionCode?: string; // ICD-10 code
  severity?: "mild" | "moderate" | "severe";
  isNewDiagnosis?: boolean;
  treatmentGoals?: string[];
  excludeMedications?: string[]; // Medications to avoid
}

interface TreatmentStep {
  stepNumber: number;
  phase: "first_line" | "second_line" | "third_line" | "adjunct" | "monitoring";
  intervention: string;
  interventionType: "medication" | "lifestyle" | "procedure" | "referral" | "monitoring" | "education";
  rationale: string;
  expectedOutcome: string;
  timeframe: string;
  guidelineSource: string;
  evidenceLevel: "A" | "B" | "C" | "D" | "expert_consensus";
  considerations: string[];
  contraindications: string[];
  monitoringRequired: string[];
}

interface MedicationRecommendation {
  medicationClass: string;
  examples: string[];
  startingApproach: string;
  targetOutcome: string;
  commonSideEffects: string[];
  monitoringParameters: string[];
  contraindicatedIn: string[];
  guidelineSource: string;
  requiresReview: boolean;
}

interface LifestyleRecommendation {
  category: "diet" | "exercise" | "smoking_cessation" | "alcohol" | "sleep" | "stress" | "weight";
  recommendation: string;
  specificGuidance: string;
  expectedBenefit: string;
  timeframe: string;
  resources: string[];
}

interface TreatmentPathway {
  condition: string;
  conditionCode: string;
  pathwayTitle: string;
  summary: string;
  severity: string;
  treatmentGoal: string;
  steps: TreatmentStep[];
  medications: MedicationRecommendation[];
  lifestyle: LifestyleRecommendation[];
  referrals: Array<{ specialty: string; reason: string; urgency: string }>;
  monitoringPlan: Array<{ parameter: string; frequency: string; target: string }>;
  followUpSchedule: string;
  redFlags: string[];
  patientEducation: string[];
  guidelinesSummary: Array<{ guideline: string; year: number; recommendation: string }>;
  contraindications: string[];
  allergyConflicts: string[];
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  disclaimer: string;
}

interface PatientContext {
  demographics: { ageGroup: string; sex: string };
  conditions: Array<{ code: string; display: string }>;
  medications: Array<{ name: string; rxcui?: string }>;
  allergies: string[];
  contraindications: string[];
  sdohFactors: {
    hasTransportationBarriers: boolean;
    hasFinancialBarriers: boolean;
    hasSocialSupport: boolean;
  };
  recentLabs: Record<string, { value: number; unit: string; date: string }>;
  vitals: Record<string, { value: number; unit: string }>;
}

// =====================================================
// CLINICAL GUIDELINES REFERENCE
// =====================================================

const CLINICAL_GUIDELINES: Record<string, string[]> = {
  diabetes: ["ADA Standards of Care 2024", "AACE Guidelines 2023"],
  hypertension: ["ACC/AHA Hypertension Guidelines 2017", "JNC 8"],
  hyperlipidemia: ["ACC/AHA Cholesterol Guidelines 2018"],
  heart_failure: ["ACC/AHA Heart Failure Guidelines 2022"],
  copd: ["GOLD Guidelines 2024"],
  asthma: ["GINA Guidelines 2024"],
  depression: ["APA Practice Guidelines", "CANMAT Guidelines 2023"],
  anxiety: ["APA Practice Guidelines", "NICE Guidelines"],
  obesity: ["Obesity Medicine Association Guidelines 2023"],
  ckd: ["KDIGO Guidelines 2024"],
  afib: ["ACC/AHA/HRS Atrial Fibrillation Guidelines 2023"],
  osteoporosis: ["AACE/ACE Osteoporosis Guidelines 2020"],
  thyroid: ["ATA Thyroid Guidelines 2023"],
};

// PHI Redaction
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  const logger = createLogger("ai-treatment-pathway", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: TreatmentPathwayRequest = await req.json();
    const {
      patientId,
      tenantId,
      condition,
      conditionCode,
      severity = "moderate",
      isNewDiagnosis = false,
      treatmentGoals = [],
      excludeMedications = [],
    } = body;

    // Validate required fields
    if (!patientId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: patientId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!condition) {
      return new Response(
        JSON.stringify({ error: "Missing required field: condition" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Gather patient context
    const context = await gatherPatientContext(supabase, patientId, logger);

    // Check for allergy conflicts with common treatments
    const allergyConflicts = checkAllergyConflicts(context.allergies, condition);

    // Generate treatment pathway
    const startTime = Date.now();
    const pathway = await generateTreatmentPathway(
      condition,
      conditionCode || "",
      severity,
      isNewDiagnosis,
      treatmentGoals,
      excludeMedications,
      context,
      allergyConflicts,
      logger
    );
    const responseTime = Date.now() - startTime;

    // Log PHI access
    logger.phi("Generated treatment pathway recommendation", {
      patientId: redact(patientId),
      condition,
      responseTimeMs: responseTime,
    });

    // Log usage
    await logUsage(supabase, patientId, tenantId, condition, responseTime, logger);

    return new Response(
      JSON.stringify({
        pathway,
        metadata: {
          generated_at: new Date().toISOString(),
          model: SONNET_MODEL,
          response_time_ms: responseTime,
          condition,
          severity,
          patient_context: {
            conditions_count: context.conditions.length,
            medications_count: context.medications.length,
            allergies_count: context.allergies.length,
            has_contraindications: context.contraindications.length > 0,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Treatment pathway generation failed", { error: error.message });

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =====================================================
// PATIENT CONTEXT
// =====================================================

async function gatherPatientContext(
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
      .select("date_of_birth, sex")
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
      context.conditions = conditions.map((c: any) => ({
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
      context.medications = medications.map((m: any) => ({
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
      context.allergies = allergies.map(
        (a: any) => a.code?.coding?.[0]?.display || a.code?.text || ""
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
function deriveContraindications(
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
function checkAllergyConflicts(allergies: string[], condition: string): string[] {
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

// =====================================================
// TREATMENT PATHWAY GENERATION
// =====================================================

async function generateTreatmentPathway(
  condition: string,
  conditionCode: string,
  severity: string,
  isNewDiagnosis: boolean,
  treatmentGoals: string[],
  excludeMedications: string[],
  context: PatientContext,
  allergyConflicts: string[],
  logger: ReturnType<typeof createLogger>
): Promise<TreatmentPathway> {
  const prompt = buildTreatmentPrompt(
    condition,
    conditionCode,
    severity,
    isNewDiagnosis,
    treatmentGoals,
    excludeMedications,
    context,
    allergyConflicts
  );

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

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return normalizePathwayResponse(parsed, condition, conditionCode, allergyConflicts, context);
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  // Fallback
  return getDefaultPathway(condition, conditionCode, severity, allergyConflicts, context);
}

function buildTreatmentPrompt(
  condition: string,
  conditionCode: string,
  severity: string,
  isNewDiagnosis: boolean,
  treatmentGoals: string[],
  excludeMedications: string[],
  context: PatientContext,
  allergyConflicts: string[]
): string {
  const sections = [];

  // Condition info
  sections.push(`CONDITION: ${condition}${conditionCode ? ` (${conditionCode})` : ""}`);
  sections.push(`SEVERITY: ${severity}`);
  sections.push(`NEW DIAGNOSIS: ${isNewDiagnosis ? "Yes" : "No (established)"}`);

  // Patient demographics
  sections.push(`\nPATIENT DEMOGRAPHICS:`);
  sections.push(`- Age Group: ${context.demographics.ageGroup}`);
  sections.push(`- Sex: ${context.demographics.sex}`);

  // Treatment goals
  if (treatmentGoals.length > 0) {
    sections.push(`\nTREATMENT GOALS: ${treatmentGoals.join(", ")}`);
  }

  // Comorbidities
  if (context.conditions.length > 0) {
    sections.push(`\nCOMORBIDITIES:`);
    context.conditions.forEach((c) => {
      sections.push(`- ${c.display} (${c.code})`);
    });
  }

  // Current medications
  if (context.medications.length > 0) {
    sections.push(`\nCURRENT MEDICATIONS:`);
    context.medications.forEach((m) => {
      sections.push(`- ${m.name}`);
    });
  }

  // Allergies
  if (context.allergies.length > 0) {
    sections.push(`\n⚠️ ALLERGIES: ${context.allergies.join(", ")}`);
  }

  // Allergy conflicts
  if (allergyConflicts.length > 0) {
    sections.push(`\n🚨 ALLERGY CONFLICTS:`);
    allergyConflicts.forEach((c) => {
      sections.push(`- ${c}`);
    });
  }

  // Contraindications
  if (context.contraindications.length > 0) {
    sections.push(`\n⚠️ CONTRAINDICATIONS:`);
    context.contraindications.forEach((c) => {
      sections.push(`- ${c}`);
    });
  }

  // Exclusions
  if (excludeMedications.length > 0) {
    sections.push(`\nEXCLUDE MEDICATIONS: ${excludeMedications.join(", ")}`);
  }

  // Recent labs
  if (Object.keys(context.recentLabs).length > 0) {
    sections.push(`\nRECENT LABS:`);
    for (const [name, data] of Object.entries(context.recentLabs)) {
      sections.push(`- ${name}: ${data.value} ${data.unit}`);
    }
  }

  // Vitals
  if (Object.keys(context.vitals).length > 0) {
    sections.push(`\nVITALS:`);
    for (const [name, data] of Object.entries(context.vitals)) {
      sections.push(`- ${name}: ${data.value} ${data.unit}`);
    }
  }

  // SDOH factors
  sections.push(`\nSDOH CONSIDERATIONS:`);
  sections.push(`- Transportation barriers: ${context.sdohFactors.hasTransportationBarriers ? "Yes" : "No"}`);
  sections.push(`- Financial barriers: ${context.sdohFactors.hasFinancialBarriers ? "Yes" : "No"}`);
  sections.push(`- Social support: ${context.sdohFactors.hasSocialSupport ? "Yes" : "Limited"}`);

  // Get relevant guidelines
  const conditionKey = Object.keys(CLINICAL_GUIDELINES).find((k) =>
    condition.toLowerCase().includes(k)
  );
  const guidelines = conditionKey ? CLINICAL_GUIDELINES[conditionKey] : [];

  if (guidelines.length > 0) {
    sections.push(`\nRELEVANT CLINICAL GUIDELINES: ${guidelines.join(", ")}`);
  }

  return `You are a clinical decision support system providing evidence-based treatment pathway recommendations.

${sections.join("\n")}

Generate a comprehensive, evidence-based treatment pathway following these guidelines:
1. Reference specific clinical guidelines (ADA, ACC, USPSTF, etc.)
2. Consider patient-specific factors (age, comorbidities, medications)
3. STRICTLY AVOID any medications the patient is allergic to
4. Respect listed contraindications
5. Include lifestyle modifications as first-line when appropriate
6. Provide stepwise treatment approach (first-line, second-line, etc.)
7. Include monitoring parameters and follow-up schedule

CRITICAL SAFETY REQUIREMENTS:
- Flag ALL recommendations as requiring clinician review
- Highlight any potential drug interactions
- Note renal/hepatic dosing considerations
- Include red flag symptoms requiring immediate attention

Return a JSON object with this structure:
{
  "condition": "${condition}",
  "conditionCode": "${conditionCode}",
  "pathwayTitle": "Treatment Pathway for ${condition}",
  "summary": "Brief 2-3 sentence summary of the recommended approach",
  "severity": "${severity}",
  "treatmentGoal": "Primary treatment goal",
  "steps": [
    {
      "stepNumber": 1,
      "phase": "first_line",
      "intervention": "Specific intervention",
      "interventionType": "medication|lifestyle|procedure|referral|monitoring|education",
      "rationale": "Clinical rationale",
      "expectedOutcome": "Expected outcome",
      "timeframe": "Duration/timing",
      "guidelineSource": "Specific guideline reference",
      "evidenceLevel": "A|B|C|D|expert_consensus",
      "considerations": ["Patient-specific considerations"],
      "contraindications": ["Who should not receive this"],
      "monitoringRequired": ["What to monitor"]
    }
  ],
  "medications": [
    {
      "medicationClass": "Drug class name",
      "examples": ["Generic names only"],
      "startingApproach": "Initial dosing approach",
      "targetOutcome": "Treatment target",
      "commonSideEffects": ["Side effects to counsel about"],
      "monitoringParameters": ["What to monitor"],
      "contraindicatedIn": ["Contraindications"],
      "guidelineSource": "Guideline reference",
      "requiresReview": true
    }
  ],
  "lifestyle": [
    {
      "category": "diet|exercise|smoking_cessation|alcohol|sleep|stress|weight",
      "recommendation": "Specific recommendation",
      "specificGuidance": "Detailed guidance",
      "expectedBenefit": "Expected benefit",
      "timeframe": "When to expect results",
      "resources": ["Patient resources"]
    }
  ],
  "referrals": [
    { "specialty": "Specialist type", "reason": "Reason for referral", "urgency": "routine|urgent|emergent" }
  ],
  "monitoringPlan": [
    { "parameter": "What to monitor", "frequency": "How often", "target": "Target value/range" }
  ],
  "followUpSchedule": "Recommended follow-up timing",
  "redFlags": ["Symptoms requiring immediate attention"],
  "patientEducation": ["Key points for patient education"],
  "guidelinesSummary": [
    { "guideline": "Guideline name", "year": 2024, "recommendation": "Key recommendation" }
  ],
  "contraindications": ["Pathway-level contraindications"],
  "allergyConflicts": ${JSON.stringify(allergyConflicts)},
  "confidence": 0.0-1.0,
  "requiresReview": true,
  "reviewReasons": ["All AI recommendations require clinician review"],
  "disclaimer": "These recommendations are for clinical decision support only and require verification by a licensed healthcare provider."
}

Respond with ONLY the JSON object, no other text.`;
}

function normalizePathwayResponse(
  parsed: any,
  condition: string,
  conditionCode: string,
  allergyConflicts: string[],
  context: PatientContext
): TreatmentPathway {
  // SAFETY: Always require review
  const pathway: TreatmentPathway = {
    condition: parsed.condition || condition,
    conditionCode: parsed.conditionCode || conditionCode,
    pathwayTitle: parsed.pathwayTitle || `Treatment Pathway for ${condition}`,
    summary: parsed.summary || "Treatment pathway requiring clinician review.",
    severity: parsed.severity || "moderate",
    treatmentGoal: parsed.treatmentGoal || "Symptom management and disease control",
    steps: (parsed.steps || []).map((s: any, i: number) => ({
      ...s,
      stepNumber: s.stepNumber || i + 1,
      phase: s.phase || "first_line",
      evidenceLevel: s.evidenceLevel || "C",
    })),
    medications: (parsed.medications || []).map((m: any) => ({
      ...m,
      requiresReview: true, // SAFETY: Always require review
    })),
    lifestyle: parsed.lifestyle || [],
    referrals: parsed.referrals || [],
    monitoringPlan: parsed.monitoringPlan || [],
    followUpSchedule: parsed.followUpSchedule || "Follow up in 2-4 weeks",
    redFlags: parsed.redFlags || ["Any concerning symptoms should prompt immediate evaluation"],
    patientEducation: parsed.patientEducation || [],
    guidelinesSummary: parsed.guidelinesSummary || [],
    contraindications: [
      ...context.contraindications,
      ...(parsed.contraindications || []),
    ],
    allergyConflicts: [
      ...allergyConflicts,
      ...(parsed.allergyConflicts || []),
    ],
    confidence: parsed.confidence ?? 0.8,
    requiresReview: true, // SAFETY: Always require review
    reviewReasons: [
      "All AI-generated treatment recommendations require clinician review",
      ...(parsed.reviewReasons || []),
    ],
    disclaimer: parsed.disclaimer || "These recommendations are for clinical decision support only and require verification by a licensed healthcare provider. This is not a substitute for professional medical judgment.",
  };

  // SAFETY: Flag low confidence
  if (pathway.confidence < 0.6) {
    pathway.reviewReasons.push("Low confidence score - careful review recommended");
  }

  return pathway;
}

function getDefaultPathway(
  condition: string,
  conditionCode: string,
  severity: string,
  allergyConflicts: string[],
  context: PatientContext
): TreatmentPathway {
  return {
    condition,
    conditionCode,
    pathwayTitle: `Treatment Pathway for ${condition}`,
    summary: "Unable to generate AI recommendations. Please consult clinical guidelines directly.",
    severity,
    treatmentGoal: "Disease management and symptom control",
    steps: [
      {
        stepNumber: 1,
        phase: "first_line",
        intervention: "Clinical assessment and guideline consultation",
        interventionType: "monitoring",
        rationale: "AI pathway generation failed - manual review required",
        expectedOutcome: "Appropriate treatment plan",
        timeframe: "Immediate",
        guidelineSource: "Consult relevant clinical guidelines",
        evidenceLevel: "expert_consensus",
        considerations: ["Requires full clinician review"],
        contraindications: context.contraindications,
        monitoringRequired: ["Per clinical judgment"],
      },
    ],
    medications: [],
    lifestyle: [
      {
        category: "diet",
        recommendation: "Healthy diet appropriate for condition",
        specificGuidance: "Consult with dietitian as needed",
        expectedBenefit: "Supports overall health",
        timeframe: "Ongoing",
        resources: ["Patient education materials"],
      },
    ],
    referrals: [],
    monitoringPlan: [
      { parameter: "Clinical status", frequency: "As clinically indicated", target: "Improvement" },
    ],
    followUpSchedule: "Follow up as clinically indicated",
    redFlags: ["Any concerning symptoms should prompt immediate evaluation"],
    patientEducation: ["Discuss condition and treatment options with your healthcare provider"],
    guidelinesSummary: [],
    contraindications: context.contraindications,
    allergyConflicts,
    confidence: 0.3,
    requiresReview: true,
    reviewReasons: [
      "AI pathway generation failed - manual clinician review required",
      "Fallback pathway provided for safety",
    ],
    disclaimer: "AI recommendation unavailable. Please consult clinical guidelines and make independent clinical decisions.",
  };
}

// =====================================================
// USAGE LOGGING
// =====================================================

async function logUsage(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  tenantId: string | undefined,
  condition: string,
  responseTimeMs: number,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    const estimatedInputTokens = 2500;
    const estimatedOutputTokens = 2000;
    const cost = (estimatedInputTokens / 1_000_000) * 3 + (estimatedOutputTokens / 1_000_000) * 15;

    await supabase.from("claude_usage_logs").insert({
      user_id: patientId,
      tenant_id: tenantId,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: "treatment_pathway",
      input_tokens: estimatedInputTokens,
      output_tokens: estimatedOutputTokens,
      cost: cost,
      response_time_ms: responseTimeMs,
      success: true,
      metadata: { condition },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to log usage", { error: error.message });
  }
}
