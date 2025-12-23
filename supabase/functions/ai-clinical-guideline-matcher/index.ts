/**
 * AI Clinical Guideline Matcher Edge Function
 *
 * Skill #24: Smart guideline recommendations.
 *
 * Matches patient conditions, medications, and labs against evidence-based
 * clinical guidelines to identify:
 * - Applicable guidelines for the patient's conditions
 * - Adherence gaps (where care doesn't match guidelines)
 * - Specific recommendations with guideline references
 * - Preventive care opportunities
 *
 * CRITICAL SAFETY GUARDRAILS:
 * 1. ALL recommendations require clinician review - never auto-actioned
 * 2. References specific guideline sources (ADA, ACC/AHA, USPSTF, etc.)
 * 3. Confidence scoring for transparency
 * 4. Identifies contraindications and allergies
 * 5. Prioritizes recommendations by clinical urgency
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy.
 *
 * @module ai-clinical-guideline-matcher
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

interface GuidelineMatchRequest {
  patientId: string;
  tenantId?: string;
  /** Optional: Focus on specific conditions */
  focusConditions?: string[];
  /** Include preventive care screening recommendations */
  includePreventiveCare?: boolean;
  /** Match against specific guideline categories */
  guidelineCategories?: string[];
}

interface ClinicalGuideline {
  guidelineId: string;
  guidelineName: string;
  organization: string;
  year: number;
  condition: string;
  conditionCode?: string;
  url?: string;
}

interface GuidelineRecommendation {
  recommendationId: string;
  guideline: ClinicalGuideline;
  category: "treatment" | "monitoring" | "screening" | "lifestyle" | "referral" | "diagnostic";
  recommendation: string;
  rationale: string;
  evidenceLevel: "A" | "B" | "C" | "D" | "expert_consensus";
  urgency: "routine" | "soon" | "urgent" | "emergent";
  targetValue?: string;
  currentValue?: string;
  gap?: string;
  actionItems: string[];
}

interface AdherenceGap {
  gapId: string;
  guideline: ClinicalGuideline;
  gapType: "missing_medication" | "missing_test" | "suboptimal_control" | "missing_referral" | "missing_screening" | "lifestyle";
  description: string;
  expectedCare: string;
  currentState: string;
  recommendation: string;
  priority: "low" | "medium" | "high" | "critical";
}

interface PreventiveScreening {
  screeningId: string;
  screeningName: string;
  guidelineSource: string;
  applicableFor: string;
  frequency: string;
  lastPerformed?: string;
  nextDue?: string;
  status: "current" | "overdue" | "never_done" | "not_applicable";
  recommendation: string;
}

interface GuidelineMatchResult {
  patientId: string;
  matchedGuidelines: ClinicalGuideline[];
  recommendations: GuidelineRecommendation[];
  adherenceGaps: AdherenceGap[];
  preventiveScreenings: PreventiveScreening[];
  summary: {
    totalGuidelines: number;
    totalRecommendations: number;
    criticalGaps: number;
    highPriorityGaps: number;
    overdueScreenings: number;
  };
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  disclaimer: string;
}

interface PatientContext {
  demographics: {
    age: number;
    ageGroup: string;
    sex: string;
  };
  conditions: Array<{ code: string; display: string }>;
  medications: Array<{ name: string; rxcui?: string }>;
  allergies: string[];
  recentLabs: Record<string, { value: number; unit: string; date: string }>;
  vitals: Record<string, { value: number; unit: string }>;
  lastScreenings: Record<string, string>; // screening name -> date
}

// =====================================================
// CLINICAL GUIDELINES DATABASE
// =====================================================

const MAJOR_GUIDELINES: Record<string, ClinicalGuideline[]> = {
  diabetes: [
    {
      guidelineId: "ada-2024",
      guidelineName: "ADA Standards of Care in Diabetes",
      organization: "American Diabetes Association",
      year: 2024,
      condition: "Diabetes Mellitus",
      conditionCode: "E11",
      url: "https://diabetesjournals.org/care",
    },
    {
      guidelineId: "aace-2023",
      guidelineName: "AACE Clinical Practice Guidelines",
      organization: "American Association of Clinical Endocrinologists",
      year: 2023,
      condition: "Diabetes Mellitus",
      conditionCode: "E11",
    },
  ],
  hypertension: [
    {
      guidelineId: "acc-aha-htn-2017",
      guidelineName: "ACC/AHA Hypertension Guidelines",
      organization: "American College of Cardiology/American Heart Association",
      year: 2017,
      condition: "Hypertension",
      conditionCode: "I10",
    },
  ],
  hyperlipidemia: [
    {
      guidelineId: "acc-aha-chol-2018",
      guidelineName: "ACC/AHA Cholesterol Guidelines",
      organization: "American College of Cardiology/American Heart Association",
      year: 2018,
      condition: "Hyperlipidemia",
      conditionCode: "E78",
    },
  ],
  heart_failure: [
    {
      guidelineId: "acc-aha-hf-2022",
      guidelineName: "ACC/AHA Heart Failure Guidelines",
      organization: "American College of Cardiology/American Heart Association",
      year: 2022,
      condition: "Heart Failure",
      conditionCode: "I50",
    },
  ],
  copd: [
    {
      guidelineId: "gold-2024",
      guidelineName: "GOLD Guidelines",
      organization: "Global Initiative for Chronic Obstructive Lung Disease",
      year: 2024,
      condition: "COPD",
      conditionCode: "J44",
    },
  ],
  asthma: [
    {
      guidelineId: "gina-2024",
      guidelineName: "GINA Guidelines",
      organization: "Global Initiative for Asthma",
      year: 2024,
      condition: "Asthma",
      conditionCode: "J45",
    },
  ],
  afib: [
    {
      guidelineId: "acc-aha-afib-2023",
      guidelineName: "ACC/AHA/ACCP/HRS Atrial Fibrillation Guidelines",
      organization: "American College of Cardiology",
      year: 2023,
      condition: "Atrial Fibrillation",
      conditionCode: "I48",
    },
  ],
  ckd: [
    {
      guidelineId: "kdigo-2024",
      guidelineName: "KDIGO Clinical Practice Guidelines",
      organization: "Kidney Disease: Improving Global Outcomes",
      year: 2024,
      condition: "Chronic Kidney Disease",
      conditionCode: "N18",
    },
  ],
  osteoporosis: [
    {
      guidelineId: "aace-osteo-2020",
      guidelineName: "AACE/ACE Osteoporosis Guidelines",
      organization: "American Association of Clinical Endocrinologists",
      year: 2020,
      condition: "Osteoporosis",
      conditionCode: "M81",
    },
  ],
  depression: [
    {
      guidelineId: "apa-mdd-2023",
      guidelineName: "APA Practice Guidelines for Depression",
      organization: "American Psychiatric Association",
      year: 2023,
      condition: "Major Depressive Disorder",
      conditionCode: "F32",
    },
  ],
  cad: [
    {
      guidelineId: "acc-aha-cad-2023",
      guidelineName: "ACC/AHA Chronic Coronary Disease Guidelines",
      organization: "American College of Cardiology/American Heart Association",
      year: 2023,
      condition: "Coronary Artery Disease",
      conditionCode: "I25",
    },
  ],
};

const PREVENTIVE_SCREENINGS: Record<string, { name: string; frequency: string; ages: { min: number; max?: number }; sex?: string; guidelineSource: string }> = {
  colonoscopy: { name: "Colorectal Cancer Screening", frequency: "every 10 years", ages: { min: 45, max: 75 }, guidelineSource: "USPSTF 2021" },
  mammogram: { name: "Breast Cancer Screening", frequency: "every 2 years", ages: { min: 50, max: 74 }, sex: "female", guidelineSource: "USPSTF 2024" },
  pap_smear: { name: "Cervical Cancer Screening", frequency: "every 3 years", ages: { min: 21, max: 65 }, sex: "female", guidelineSource: "USPSTF 2018" },
  bone_density: { name: "Osteoporosis Screening", frequency: "baseline at 65", ages: { min: 65 }, sex: "female", guidelineSource: "USPSTF 2018" },
  aaa_screening: { name: "Abdominal Aortic Aneurysm Screening", frequency: "one-time", ages: { min: 65, max: 75 }, sex: "male", guidelineSource: "USPSTF 2019" },
  lung_cancer: { name: "Lung Cancer Screening (LDCT)", frequency: "annually", ages: { min: 50, max: 80 }, guidelineSource: "USPSTF 2021" },
  diabetes_screening: { name: "Diabetes Screening", frequency: "every 3 years", ages: { min: 35, max: 70 }, guidelineSource: "USPSTF 2021" },
  lipid_panel: { name: "Lipid Panel", frequency: "every 5 years", ages: { min: 40, max: 75 }, guidelineSource: "USPSTF 2016" },
  hiv_screening: { name: "HIV Screening", frequency: "at least once", ages: { min: 15, max: 65 }, guidelineSource: "USPSTF 2019" },
  hep_c: { name: "Hepatitis C Screening", frequency: "one-time", ages: { min: 18, max: 79 }, guidelineSource: "USPSTF 2020" },
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
  const logger = createLogger("ai-clinical-guideline-matcher", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: GuidelineMatchRequest = await req.json();
    const {
      patientId,
      tenantId,
      focusConditions = [],
      includePreventiveCare = true,
      guidelineCategories = [],
    } = body;

    // Validate required fields
    if (!patientId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: patientId" }),
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

    // Match guidelines and identify gaps
    const startTime = Date.now();
    const result = await matchGuidelines(
      context,
      focusConditions,
      includePreventiveCare,
      guidelineCategories,
      logger
    );
    const responseTime = Date.now() - startTime;

    result.patientId = patientId;

    // Log PHI access
    logger.phi("Generated clinical guideline matches", {
      patientId: redact(patientId),
      guidelinesMatched: result.matchedGuidelines.length,
      gapsIdentified: result.adherenceGaps.length,
      responseTimeMs: responseTime,
    });

    // Log usage
    await logUsage(supabase, patientId, tenantId, result.matchedGuidelines.length, responseTime, logger);

    return new Response(
      JSON.stringify({
        result,
        metadata: {
          generated_at: new Date().toISOString(),
          model: SONNET_MODEL,
          response_time_ms: responseTime,
          patient_context: {
            age: context.demographics.age,
            conditions_count: context.conditions.length,
            medications_count: context.medications.length,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Guideline matching failed", { error: error.message });

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
    demographics: { age: 50, ageGroup: "adult", sex: "unknown" },
    conditions: [],
    medications: [],
    allergies: [],
    recentLabs: {},
    vitals: {},
    lastScreenings: {},
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
      context.demographics.age = age;
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
      .limit(30);

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
      .limit(50);

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
      context.allergies = allergies
        .map((a: any) => a.code?.coding?.[0]?.display || a.code?.text || "")
        .filter(Boolean);
    }

    // Get recent labs (last 12 months)
    const { data: labs } = await supabase
      .from("fhir_observations")
      .select("code, value_quantity_value, value_quantity_unit, effective_datetime")
      .eq("patient_id", patientId)
      .gte("effective_datetime", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
      .order("effective_datetime", { ascending: false })
      .limit(100);

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
        "1742-6": "alt",
        "1920-8": "ast",
        "718-7": "hemoglobin",
        "4544-3": "hematocrit",
        "777-3": "platelets",
        "2951-2": "sodium",
        "2823-3": "potassium",
        "1751-7": "albumin",
        "5902-2": "pt_inr",
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
      .gte("effective_datetime", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("effective_datetime", { ascending: false })
      .limit(30);

    if (vitals) {
      const vitalCodeMap: Record<string, string> = {
        "8480-6": "systolic_bp",
        "8462-4": "diastolic_bp",
        "8867-4": "heart_rate",
        "29463-7": "weight",
        "39156-5": "bmi",
        "8310-5": "temperature",
        "9279-1": "respiratory_rate",
        "2708-6": "oxygen_saturation",
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

    // Get last screening dates
    const { data: procedures } = await supabase
      .from("fhir_procedures")
      .select("code, performed_datetime")
      .eq("patient_id", patientId)
      .order("performed_datetime", { ascending: false })
      .limit(50);

    if (procedures) {
      const screeningCodes: Record<string, string> = {
        "73761001": "colonoscopy",
        "77067": "mammogram",
        "91141-3": "pap_smear",
        "24619-6": "bone_density",
        "87628": "lung_cancer",
      };

      for (const proc of procedures) {
        const code = proc.code?.coding?.[0]?.code;
        const screeningName = screeningCodes[code];
        if (screeningName && proc.performed_datetime && !context.lastScreenings[screeningName]) {
          context.lastScreenings[screeningName] = proc.performed_datetime;
        }
      }
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather complete patient context", { error: error.message });
  }

  return context;
}

// =====================================================
// GUIDELINE MATCHING
// =====================================================

async function matchGuidelines(
  context: PatientContext,
  focusConditions: string[],
  includePreventiveCare: boolean,
  guidelineCategories: string[],
  logger: ReturnType<typeof createLogger>
): Promise<GuidelineMatchResult> {
  // First, do rule-based matching
  const matchedGuidelines = matchGuidelinesToConditions(context.conditions, focusConditions);

  // Determine applicable preventive screenings
  const preventiveScreenings = includePreventiveCare
    ? getApplicableScreenings(context)
    : [];

  // Use AI to generate detailed recommendations and identify gaps
  const prompt = buildGuidelinePrompt(context, matchedGuidelines, preventiveScreenings);

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
      return normalizeMatchResult(parsed, matchedGuidelines, preventiveScreenings, context);
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  // Fallback
  return getDefaultMatchResult(matchedGuidelines, preventiveScreenings);
}

function matchGuidelinesToConditions(
  conditions: Array<{ code: string; display: string }>,
  focusConditions: string[]
): ClinicalGuideline[] {
  const matched: ClinicalGuideline[] = [];
  const conditionText = conditions.map((c) => c.display.toLowerCase()).join(" ");

  // If focus conditions specified, use those
  const searchTerms =
    focusConditions.length > 0
      ? focusConditions.map((c) => c.toLowerCase())
      : Object.keys(MAJOR_GUIDELINES);

  for (const key of searchTerms) {
    // Check if patient has condition matching this guideline category
    const hasCondition =
      conditionText.includes(key) ||
      conditions.some((c) => c.code.startsWith(MAJOR_GUIDELINES[key]?.[0]?.conditionCode || "XXX"));

    if (hasCondition && MAJOR_GUIDELINES[key]) {
      matched.push(...MAJOR_GUIDELINES[key]);
    }
  }

  // Always include cardiovascular guidelines for patients with risk factors
  if (
    (conditionText.includes("diabetes") ||
      conditionText.includes("hypertension") ||
      conditionText.includes("hyperlipidemia")) &&
    !matched.some((g) => g.guidelineId.includes("cad"))
  ) {
    const cadGuidelines = MAJOR_GUIDELINES["cad"];
    if (cadGuidelines) {
      matched.push(...cadGuidelines);
    }
  }

  return matched;
}

function getApplicableScreenings(context: PatientContext): PreventiveScreening[] {
  const screenings: PreventiveScreening[] = [];
  const { age, sex } = context.demographics;

  for (const [key, screening] of Object.entries(PREVENTIVE_SCREENINGS)) {
    // Check age eligibility
    if (age < screening.ages.min) continue;
    if (screening.ages.max && age > screening.ages.max) continue;

    // Check sex eligibility
    if (screening.sex && screening.sex !== sex) continue;

    const lastPerformed = context.lastScreenings[key];
    let status: PreventiveScreening["status"] = "never_done";
    let nextDue: string | undefined;

    if (lastPerformed) {
      const lastDate = new Date(lastPerformed);
      const frequencyMatch = screening.frequency.match(/(\d+)\s+(year|month)/);

      if (frequencyMatch) {
        const amount = parseInt(frequencyMatch[1]);
        const unit = frequencyMatch[2];

        const nextDueDate = new Date(lastDate);
        if (unit === "year") {
          nextDueDate.setFullYear(nextDueDate.getFullYear() + amount);
        } else {
          nextDueDate.setMonth(nextDueDate.getMonth() + amount);
        }

        nextDue = nextDueDate.toISOString().split("T")[0];

        if (nextDueDate > new Date()) {
          status = "current";
        } else {
          status = "overdue";
        }
      } else if (screening.frequency.includes("one-time")) {
        status = "current";
      }
    }

    let recommendation = "";
    switch (status) {
      case "overdue":
        recommendation = `${screening.name} is overdue. Schedule as soon as possible.`;
        break;
      case "never_done":
        recommendation = `${screening.name} recommended for your age group. Discuss with your provider.`;
        break;
      case "current":
        recommendation = nextDue ? `Next ${screening.name} due around ${nextDue}.` : `${screening.name} is current.`;
        break;
    }

    screenings.push({
      screeningId: `screen-${key}-${Date.now()}`,
      screeningName: screening.name,
      guidelineSource: screening.guidelineSource,
      applicableFor: `Ages ${screening.ages.min}${screening.ages.max ? `-${screening.ages.max}` : "+"}${screening.sex ? `, ${screening.sex}` : ""}`,
      frequency: screening.frequency,
      lastPerformed,
      nextDue,
      status,
      recommendation,
    });
  }

  return screenings;
}

function buildGuidelinePrompt(
  context: PatientContext,
  matchedGuidelines: ClinicalGuideline[],
  preventiveScreenings: PreventiveScreening[]
): string {
  const sections = [];

  // Patient demographics
  sections.push(`PATIENT DEMOGRAPHICS:`);
  sections.push(`- Age: ${context.demographics.age}`);
  sections.push(`- Sex: ${context.demographics.sex}`);

  // Conditions
  if (context.conditions.length > 0) {
    sections.push(`\nACTIVE CONDITIONS:`);
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

  // Recent labs
  if (Object.keys(context.recentLabs).length > 0) {
    sections.push(`\nRECENT LABS:`);
    for (const [name, data] of Object.entries(context.recentLabs)) {
      sections.push(`- ${name}: ${data.value} ${data.unit} (${new Date(data.date).toLocaleDateString()})`);
    }
  }

  // Vitals
  if (Object.keys(context.vitals).length > 0) {
    sections.push(`\nVITALS:`);
    for (const [name, data] of Object.entries(context.vitals)) {
      sections.push(`- ${name}: ${data.value} ${data.unit}`);
    }
  }

  // Matched guidelines
  if (matchedGuidelines.length > 0) {
    sections.push(`\nAPPLICABLE GUIDELINES:`);
    matchedGuidelines.forEach((g) => {
      sections.push(`- ${g.guidelineName} (${g.organization}, ${g.year})`);
    });
  }

  // Preventive screenings
  if (preventiveScreenings.length > 0) {
    sections.push(`\nPREVENTIVE SCREENING STATUS:`);
    preventiveScreenings.forEach((s) => {
      sections.push(`- ${s.screeningName}: ${s.status} (${s.guidelineSource})`);
    });
  }

  return `You are a clinical decision support system that matches patient data against evidence-based clinical guidelines.

${sections.join("\n")}

Analyze this patient's data against the applicable clinical guidelines. Identify:
1. ADHERENCE GAPS - Where current care doesn't align with guideline recommendations
2. RECOMMENDATIONS - Specific evidence-based recommendations with guideline references
3. LAB/VITAL CONCERNS - Values outside guideline targets

CRITICAL REQUIREMENTS:
- Reference specific guideline sources (e.g., "ADA 2024 recommends...")
- Include evidence levels (A/B/C/D)
- Prioritize by clinical urgency
- Consider patient allergies and contraindications
- Flag items requiring clinician review

Return a JSON object with this structure:
{
  "recommendations": [
    {
      "recommendationId": "rec-001",
      "guideline": {
        "guidelineId": "guideline-id",
        "guidelineName": "Guideline Name",
        "organization": "Organization",
        "year": 2024,
        "condition": "Condition"
      },
      "category": "treatment|monitoring|screening|lifestyle|referral|diagnostic",
      "recommendation": "Specific recommendation",
      "rationale": "Clinical rationale with guideline reference",
      "evidenceLevel": "A|B|C|D|expert_consensus",
      "urgency": "routine|soon|urgent|emergent",
      "targetValue": "Target if applicable",
      "currentValue": "Current value if applicable",
      "gap": "Description of gap if applicable",
      "actionItems": ["Specific action items"]
    }
  ],
  "adherenceGaps": [
    {
      "gapId": "gap-001",
      "guideline": {
        "guidelineId": "guideline-id",
        "guidelineName": "Guideline Name",
        "organization": "Organization",
        "year": 2024,
        "condition": "Condition"
      },
      "gapType": "missing_medication|missing_test|suboptimal_control|missing_referral|missing_screening|lifestyle",
      "description": "Description of the gap",
      "expectedCare": "What guideline recommends",
      "currentState": "Current patient status",
      "recommendation": "How to address the gap",
      "priority": "low|medium|high|critical"
    }
  ],
  "confidence": 0.0-1.0,
  "reviewReasons": ["Reasons this needs clinician review"]
}

Respond with ONLY the JSON object, no other text.`;
}

function normalizeMatchResult(
  parsed: any,
  matchedGuidelines: ClinicalGuideline[],
  preventiveScreenings: PreventiveScreening[],
  context: PatientContext
): GuidelineMatchResult {
  const recommendations = (parsed.recommendations || []).map((r: any, i: number) => ({
    ...r,
    recommendationId: r.recommendationId || `rec-${i + 1}-${Date.now()}`,
    guideline: r.guideline || matchedGuidelines[0] || {
      guidelineId: "unknown",
      guidelineName: "Clinical Guidelines",
      organization: "Unknown",
      year: 2024,
      condition: "Unknown",
    },
    category: r.category || "treatment",
    evidenceLevel: r.evidenceLevel || "C",
    urgency: r.urgency || "routine",
    actionItems: r.actionItems || [],
  }));

  const adherenceGaps = (parsed.adherenceGaps || []).map((g: any, i: number) => ({
    ...g,
    gapId: g.gapId || `gap-${i + 1}-${Date.now()}`,
    guideline: g.guideline || matchedGuidelines[0] || {
      guidelineId: "unknown",
      guidelineName: "Clinical Guidelines",
      organization: "Unknown",
      year: 2024,
      condition: "Unknown",
    },
    gapType: g.gapType || "suboptimal_control",
    priority: g.priority || "medium",
  }));

  const criticalGaps = adherenceGaps.filter((g: any) => g.priority === "critical").length;
  const highPriorityGaps = adherenceGaps.filter((g: any) => g.priority === "high").length;
  const overdueScreenings = preventiveScreenings.filter((s) => s.status === "overdue").length;

  const reviewReasons = [
    "All AI-generated guideline recommendations require clinician review",
    ...(parsed.reviewReasons || []),
  ];

  if (criticalGaps > 0) {
    reviewReasons.unshift(`CRITICAL: ${criticalGaps} critical adherence gap(s) identified`);
  }

  return {
    patientId: "",
    matchedGuidelines,
    recommendations,
    adherenceGaps,
    preventiveScreenings,
    summary: {
      totalGuidelines: matchedGuidelines.length,
      totalRecommendations: recommendations.length,
      criticalGaps,
      highPriorityGaps,
      overdueScreenings,
    },
    confidence: parsed.confidence ?? 0.8,
    requiresReview: true,
    reviewReasons,
    disclaimer: "These recommendations are for clinical decision support only and require verification by a licensed healthcare provider. Guidelines should be applied with consideration of individual patient circumstances.",
  };
}

function getDefaultMatchResult(
  matchedGuidelines: ClinicalGuideline[],
  preventiveScreenings: PreventiveScreening[]
): GuidelineMatchResult {
  return {
    patientId: "",
    matchedGuidelines,
    recommendations: [],
    adherenceGaps: [],
    preventiveScreenings,
    summary: {
      totalGuidelines: matchedGuidelines.length,
      totalRecommendations: 0,
      criticalGaps: 0,
      highPriorityGaps: 0,
      overdueScreenings: preventiveScreenings.filter((s) => s.status === "overdue").length,
    },
    confidence: 0.3,
    requiresReview: true,
    reviewReasons: [
      "AI recommendation generation failed - manual clinician review required",
      "Fallback result provided for safety",
    ],
    disclaimer: "AI recommendation unavailable. Please consult clinical guidelines directly.",
  };
}

// =====================================================
// USAGE LOGGING
// =====================================================

async function logUsage(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  tenantId: string | undefined,
  guidelinesMatched: number,
  responseTimeMs: number,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    const estimatedInputTokens = 2000;
    const estimatedOutputTokens = 1500;
    const cost = (estimatedInputTokens / 1_000_000) * 3 + (estimatedOutputTokens / 1_000_000) * 15;

    await supabase.from("claude_usage_logs").insert({
      user_id: patientId,
      tenant_id: tenantId,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: "clinical_guideline_matcher",
      input_tokens: estimatedInputTokens,
      output_tokens: estimatedOutputTokens,
      cost: cost,
      response_time_ms: responseTimeMs,
      success: true,
      metadata: { guidelinesMatched },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to log usage", { error: error.message });
  }
}
