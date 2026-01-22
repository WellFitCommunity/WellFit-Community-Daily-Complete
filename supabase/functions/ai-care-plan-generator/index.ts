/**
 * AI Care Plan Auto-Generator Edge Function
 *
 * Skill #20: Generates evidence-based care plans from diagnosis + SDOH factors.
 *
 * Integrates with:
 * - fhir_conditions (diagnoses)
 * - fhir_observations (vitals, lab results)
 * - fhir_medication_requests (current medications)
 * - sdoh_assessments (social determinants)
 * - patient_readmissions (utilization history)
 * - patient_diagnoses (chronic conditions)
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy and evidence-based recommendations.
 * HIPAA-compliant with audit logging.
 *
 * @module ai-care-plan-generator
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SONNET_MODEL = "claude-sonnet-4-20250514";

interface CarePlanRequest {
  patientId: string;
  tenantId?: string;
  planType: "readmission_prevention" | "chronic_care" | "transitional_care" | "high_utilizer" | "preventive";
  focusConditions?: string[];
  includeSDOH?: boolean;
  includeMedications?: boolean;
  careTeamRoles?: string[];
  durationWeeks?: number;
}

interface CarePlanGoal {
  goal: string;
  target: string;
  timeframe: string;
  measurementMethod: string;
  priority: "high" | "medium" | "low";
  evidenceBasis?: string;
}

interface CarePlanIntervention {
  intervention: string;
  frequency: string;
  responsible: string;
  duration: string;
  rationale: string;
  cptCode?: string;
  billingEligible: boolean;
}

interface CarePlanBarrier {
  barrier: string;
  category: "transportation" | "financial" | "social" | "cognitive" | "physical" | "language" | "other";
  solution: string;
  resources: string[];
  priority: "high" | "medium" | "low";
}

interface CarePlanActivity {
  activityType: "appointment" | "medication" | "education" | "monitoring" | "referral" | "follow_up";
  description: string;
  scheduledDate?: string;
  frequency?: string;
  status: "scheduled" | "pending" | "completed";
}

interface GeneratedCarePlan {
  title: string;
  description: string;
  planType: string;
  priority: "critical" | "high" | "medium" | "low";
  goals: CarePlanGoal[];
  interventions: CarePlanIntervention[];
  barriers: CarePlanBarrier[];
  activities: CarePlanActivity[];
  careTeam: Array<{ role: string; responsibilities: string[] }>;
  estimatedDuration: string;
  reviewSchedule: string;
  successCriteria: string[];
  riskFactors: string[];
  icd10Codes: Array<{ code: string; display: string }>;
  ccmEligible: boolean;
  tcmEligible: boolean;
  confidence: number;
  evidenceSources: string[];
  requiresReview: boolean;
  reviewReasons: string[];
}

interface PatientContext {
  demographics: {
    ageGroup: string;
    preferredLanguage: string;
  };
  conditions: Array<{
    code: string;
    display: string;
    status: string;
    isPrimary: boolean;
  }>;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
  vitals: Record<string, { value: number; unit: string; date: string }>;
  sdohFactors: {
    housing: string;
    food: string;
    transportation: string;
    social: string;
    financial: string;
    overallRisk: string;
    complexityScore: number;
  } | null;
  utilizationHistory: {
    edVisits30Days: number;
    edVisits90Days: number;
    admissions30Days: number;
    admissions90Days: number;
    readmissionRisk: string;
  };
  allergies: string[];
  careGaps: string[];
}

// Database record types
interface FHIRConditionRecord {
  code?: { coding?: Array<{ code?: string; display?: string }> };
  clinical_status?: string;
}

interface DiagnosisRecord {
  diagnosis_name?: string;
  icd10_code?: string;
  is_primary?: boolean;
  status?: string;
}

interface FHIRMedicationRecord {
  medication_codeable_concept?: { coding?: Array<{ display?: string }> };
  dosage_instruction?: Array<{ dose_and_rate?: Array<{ dose_quantity?: { value?: number } }>; timing?: { code?: { text?: string } } }>;
}

interface ReadmissionRecord {
  admission_date: string;
  facility_type?: string;
}

interface FHIRAllergyRecord {
  code?: { coding?: Array<{ display?: string }>; text?: string };
}

// Parsed AI response structure
interface ParsedCarePlanResponse {
  title?: string;
  description?: string;
  planType?: string;
  priority?: "critical" | "high" | "medium" | "low";
  goals?: CarePlanGoal[];
  interventions?: CarePlanIntervention[];
  barriers?: CarePlanBarrier[];
  activities?: CarePlanActivity[];
  careTeam?: Array<{ role: string; responsibilities: string[] }>;
  estimatedDuration?: string;
  reviewSchedule?: string;
  successCriteria?: string[];
  riskFactors?: string[];
  icd10Codes?: Array<{ code: string; display: string }>;
  ccmEligible?: boolean;
  tcmEligible?: boolean;
  confidence?: number;
  evidenceSources?: string[];
  requiresReview?: boolean;
  reviewReasons?: string[];
}

// PHI Redaction
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

serve(async (req) => {
  const logger = createLogger("ai-care-plan-generator", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: CarePlanRequest = await req.json();
    const {
      patientId,
      tenantId,
      planType,
      focusConditions,
      includeSDOH = true,
      includeMedications = true,
      careTeamRoles = ["nurse", "physician", "care_coordinator"],
      durationWeeks = 12,
    } = body;

    if (!patientId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: patientId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!planType) {
      return new Response(
        JSON.stringify({ error: "Missing required field: planType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Gather comprehensive patient context
    const context = await gatherPatientContext(
      supabase,
      patientId,
      includeSDOH,
      includeMedications,
      logger
    );

    // Generate care plan
    const startTime = Date.now();
    const carePlan = await generateCarePlan(
      context,
      planType,
      focusConditions || [],
      careTeamRoles,
      durationWeeks,
      logger
    );
    const responseTime = Date.now() - startTime;

    // Log PHI access
    logger.phi("Generated AI care plan", {
      patientId: redact(patientId),
      planType,
      responseTimeMs: responseTime,
    });

    // Log usage
    await logUsage(supabase, patientId, tenantId, planType, responseTime, logger);

    return new Response(
      JSON.stringify({
        carePlan,
        metadata: {
          generated_at: new Date().toISOString(),
          model: SONNET_MODEL,
          response_time_ms: responseTime,
          plan_type: planType,
          context_summary: {
            conditions_count: context.conditions.length,
            medications_count: context.medications.length,
            has_sdoh: !!context.sdohFactors,
            utilization_risk: context.utilizationHistory.readmissionRisk,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Care plan generation failed", { error: error.message });

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
 * Gather comprehensive patient context for care plan generation
 */
async function gatherPatientContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  includeSDOH: boolean,
  includeMedications: boolean,
  logger: ReturnType<typeof createLogger>
): Promise<PatientContext> {
  const context: PatientContext = {
    demographics: { ageGroup: "unknown", preferredLanguage: "English" },
    conditions: [],
    medications: [],
    vitals: {},
    sdohFactors: null,
    utilizationHistory: {
      edVisits30Days: 0,
      edVisits90Days: 0,
      admissions30Days: 0,
      admissions90Days: 0,
      readmissionRisk: "low",
    },
    allergies: [],
    careGaps: [],
  };

  try {
    // Get patient demographics
    const { data: profile } = await supabase
      .from("profiles")
      .select("date_of_birth, preferred_language")
      .eq("user_id", patientId)
      .single();

    if (profile?.date_of_birth) {
      const age = Math.floor(
        (Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      if (age < 18) context.demographics.ageGroup = "pediatric";
      else if (age < 40) context.demographics.ageGroup = "young_adult";
      else if (age < 65) context.demographics.ageGroup = "adult";
      else context.demographics.ageGroup = "geriatric";
    }
    if (profile?.preferred_language) {
      context.demographics.preferredLanguage = profile.preferred_language;
    }

    // Get active conditions from FHIR and patient_diagnoses
    const { data: fhirConditions } = await supabase
      .from("fhir_conditions")
      .select("code, clinical_status")
      .eq("patient_id", patientId)
      .order("recorded_date", { ascending: false })
      .limit(20);

    const { data: diagnoses } = await supabase
      .from("patient_diagnoses")
      .select("diagnosis_name, icd10_code, is_primary, status")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(15);

    if (fhirConditions) {
      const typedConditions = fhirConditions as FHIRConditionRecord[];
      context.conditions = typedConditions.map((c) => ({
        code: c.code?.coding?.[0]?.code || "",
        display: c.code?.coding?.[0]?.display || "",
        status: c.clinical_status || "active",
        isPrimary: false,
      }));
    }

    if (diagnoses) {
      const typedDiagnoses = diagnoses as DiagnosisRecord[];
      typedDiagnoses.forEach((d) => {
        // Merge with existing or add new
        const existing = context.conditions.find((c) => c.code === d.icd10_code);
        if (existing) {
          existing.isPrimary = d.is_primary ?? false;
        } else {
          context.conditions.push({
            code: d.icd10_code || "",
            display: d.diagnosis_name || "",
            status: d.status || "active",
            isPrimary: d.is_primary ?? false,
          });
        }
      });
    }

    // Get medications if requested
    if (includeMedications) {
      const { data: medications } = await supabase
        .from("fhir_medication_requests")
        .select("medication_codeable_concept, dosage_instruction")
        .eq("patient_id", patientId)
        .eq("status", "active")
        .limit(20);

      if (medications) {
        const typedMeds = medications as FHIRMedicationRecord[];
        context.medications = typedMeds.map((m) => ({
          name: m.medication_codeable_concept?.coding?.[0]?.display || "",
          dosage: m.dosage_instruction?.[0]?.dose_and_rate?.[0]?.dose_quantity?.value?.toString() || "",
          frequency: m.dosage_instruction?.[0]?.timing?.code?.text || "",
        }));
      }
    }

    // Get recent vitals
    const { data: vitals } = await supabase
      .from("fhir_observations")
      .select("code, value_quantity_value, value_quantity_unit, effective_datetime")
      .eq("patient_id", patientId)
      .gte("effective_datetime", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("effective_datetime", { ascending: false });

    if (vitals) {
      const vitalCodeMap: Record<string, string> = {
        "8480-6": "blood_pressure_systolic",
        "8462-4": "blood_pressure_diastolic",
        "8867-4": "heart_rate",
        "29463-7": "weight",
        "4548-4": "hba1c",
        "2339-0": "glucose",
        "2093-3": "cholesterol",
      };

      for (const obs of vitals) {
        const code = obs.code?.coding?.[0]?.code;
        const vitalName = vitalCodeMap[code];
        if (vitalName && obs.value_quantity_value != null && !context.vitals[vitalName]) {
          context.vitals[vitalName] = {
            value: obs.value_quantity_value,
            unit: obs.value_quantity_unit || "",
            date: obs.effective_datetime,
          };
        }
      }
    }

    // Get SDOH factors if requested
    if (includeSDOH) {
      const { data: sdoh } = await supabase
        .from("sdoh_assessments")
        .select("*")
        .eq("patient_id", patientId)
        .order("assessed_at", { ascending: false })
        .limit(1)
        .single();

      if (sdoh) {
        context.sdohFactors = {
          housing: sdoh.housing_instability ? "unstable" : "stable",
          food: sdoh.food_insecurity ? "insecure" : "secure",
          transportation: sdoh.transportation_barriers ? "barriers" : "adequate",
          social: sdoh.social_isolation ? "isolated" : "supported",
          financial: sdoh.financial_strain ? "strained" : "stable",
          overallRisk: sdoh.risk_level || "unknown",
          complexityScore: sdoh.overall_complexity_score || 0,
        };
      }
    }

    // Get utilization history
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: readmissions } = await supabase
      .from("patient_readmissions")
      .select("admission_date, facility_type")
      .eq("patient_id", patientId)
      .gte("admission_date", ninetyDaysAgo);

    if (readmissions) {
      const typedReadmissions = readmissions as ReadmissionRecord[];
      typedReadmissions.forEach((r) => {
        const isRecent = new Date(r.admission_date) >= new Date(thirtyDaysAgo);
        if (r.facility_type === "emergency") {
          if (isRecent) context.utilizationHistory.edVisits30Days++;
          context.utilizationHistory.edVisits90Days++;
        } else {
          if (isRecent) context.utilizationHistory.admissions30Days++;
          context.utilizationHistory.admissions90Days++;
        }
      });
    }

    // Calculate readmission risk level
    const riskScore =
      context.utilizationHistory.edVisits30Days * 3 +
      context.utilizationHistory.admissions30Days * 5 +
      context.utilizationHistory.edVisits90Days * 1 +
      context.utilizationHistory.admissions90Days * 2;

    if (riskScore >= 10) context.utilizationHistory.readmissionRisk = "critical";
    else if (riskScore >= 6) context.utilizationHistory.readmissionRisk = "high";
    else if (riskScore >= 3) context.utilizationHistory.readmissionRisk = "medium";

    // Get allergies
    const { data: allergies } = await supabase
      .from("fhir_allergy_intolerances")
      .select("code")
      .eq("patient_id", patientId)
      .limit(10);

    if (allergies) {
      const typedAllergies = allergies as FHIRAllergyRecord[];
      context.allergies = typedAllergies
        .map((a) => a.code?.coding?.[0]?.display || a.code?.text || "")
        .filter(Boolean);
    }

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather complete patient context", { error: error.message });
  }

  return context;
}

/**
 * Generate care plan using Claude Sonnet
 */
async function generateCarePlan(
  context: PatientContext,
  planType: string,
  focusConditions: string[],
  careTeamRoles: string[],
  durationWeeks: number,
  logger: ReturnType<typeof createLogger>
): Promise<GeneratedCarePlan> {
  const prompt = buildCarePlanPrompt(context, planType, focusConditions, careTeamRoles, durationWeeks);

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
      return normalizeCarePlanResponse(parsed, planType, context);
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  // Fallback
  return getDefaultCarePlan(planType, context);
}

/**
 * Build the prompt for care plan generation
 */
function buildCarePlanPrompt(
  context: PatientContext,
  planType: string,
  focusConditions: string[],
  careTeamRoles: string[],
  durationWeeks: number
): string {
  const sections = [];

  // Plan type context
  sections.push(`CARE PLAN TYPE: ${planType.replace(/_/g, " ").toUpperCase()}`);
  sections.push(`DURATION: ${durationWeeks} weeks`);
  sections.push(`CARE TEAM ROLES: ${careTeamRoles.join(", ")}`);

  // Demographics
  sections.push(`\nPATIENT DEMOGRAPHICS:`);
  sections.push(`- Age Group: ${context.demographics.ageGroup}`);
  sections.push(`- Preferred Language: ${context.demographics.preferredLanguage}`);

  // Conditions
  if (context.conditions.length > 0) {
    sections.push(`\nACTIVE CONDITIONS:`);
    context.conditions.forEach((c, i) => {
      const primary = c.isPrimary ? " (PRIMARY)" : "";
      sections.push(`${i + 1}. ${c.display} (${c.code})${primary}`);
    });
  }

  // Focus conditions
  if (focusConditions.length > 0) {
    sections.push(`\nFOCUS CONDITIONS (prioritize in plan): ${focusConditions.join(", ")}`);
  }

  // Medications
  if (context.medications.length > 0) {
    sections.push(`\nCURRENT MEDICATIONS:`);
    context.medications.forEach((m) => {
      sections.push(`- ${m.name} ${m.dosage} ${m.frequency}`.trim());
    });
  }

  // Vitals
  if (Object.keys(context.vitals).length > 0) {
    sections.push(`\nRECENT VITALS:`);
    for (const [name, data] of Object.entries(context.vitals)) {
      sections.push(`- ${name.replace(/_/g, " ")}: ${data.value} ${data.unit}`);
    }
  }

  // SDOH
  if (context.sdohFactors) {
    sections.push(`\nSOCIAL DETERMINANTS OF HEALTH:`);
    sections.push(`- Housing: ${context.sdohFactors.housing}`);
    sections.push(`- Food Security: ${context.sdohFactors.food}`);
    sections.push(`- Transportation: ${context.sdohFactors.transportation}`);
    sections.push(`- Social Support: ${context.sdohFactors.social}`);
    sections.push(`- Financial Status: ${context.sdohFactors.financial}`);
    sections.push(`- Overall SDOH Risk: ${context.sdohFactors.overallRisk}`);
    sections.push(`- Complexity Score: ${context.sdohFactors.complexityScore}/10`);
  }

  // Utilization
  sections.push(`\nUTILIZATION HISTORY:`);
  sections.push(`- ED Visits (30 days): ${context.utilizationHistory.edVisits30Days}`);
  sections.push(`- ED Visits (90 days): ${context.utilizationHistory.edVisits90Days}`);
  sections.push(`- Admissions (30 days): ${context.utilizationHistory.admissions30Days}`);
  sections.push(`- Admissions (90 days): ${context.utilizationHistory.admissions90Days}`);
  sections.push(`- Readmission Risk: ${context.utilizationHistory.readmissionRisk.toUpperCase()}`);

  // Allergies
  if (context.allergies.length > 0) {
    sections.push(`\nALLERGIES: ${context.allergies.join(", ")}`);
  }

  return `You are an expert clinical care coordinator creating an evidence-based care plan.

${sections.join("\n")}

Generate a comprehensive, individualized care plan following these guidelines:
1. Goals should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
2. Interventions should include specific frequencies and responsible parties
3. Address identified SDOH barriers with practical solutions
4. Include CCM/TCM billing eligibility assessment
5. Reference clinical guidelines where applicable

Return a JSON object with this structure:
{
  "title": "Descriptive care plan title",
  "description": "Brief 2-3 sentence summary of the plan focus",
  "planType": "${planType}",
  "priority": "critical|high|medium|low",
  "goals": [
    {
      "goal": "Specific goal statement",
      "target": "Measurable target (e.g., 'A1c below 7.0')",
      "timeframe": "e.g., '8 weeks'",
      "measurementMethod": "How progress will be tracked",
      "priority": "high|medium|low",
      "evidenceBasis": "Clinical guideline or evidence source"
    }
  ],
  "interventions": [
    {
      "intervention": "Specific action",
      "frequency": "e.g., 'weekly', 'daily', 'monthly'",
      "responsible": "Role responsible (e.g., 'nurse', 'physician')",
      "duration": "How long (e.g., '4 weeks')",
      "rationale": "Why this intervention",
      "cptCode": "Optional CPT code if billable",
      "billingEligible": true/false
    }
  ],
  "barriers": [
    {
      "barrier": "Identified obstacle",
      "category": "transportation|financial|social|cognitive|physical|language|other",
      "solution": "How to address",
      "resources": ["Available resources to help"],
      "priority": "high|medium|low"
    }
  ],
  "activities": [
    {
      "activityType": "appointment|medication|education|monitoring|referral|follow_up",
      "description": "What needs to happen",
      "frequency": "How often",
      "status": "scheduled|pending"
    }
  ],
  "careTeam": [
    {
      "role": "Role name",
      "responsibilities": ["List of responsibilities"]
    }
  ],
  "estimatedDuration": "e.g., '12 weeks'",
  "reviewSchedule": "e.g., 'Every 2 weeks'",
  "successCriteria": ["Measurable outcomes indicating success"],
  "riskFactors": ["Factors that could impede success"],
  "icd10Codes": [{"code": "E11.9", "display": "Type 2 diabetes"}],
  "ccmEligible": true/false,
  "tcmEligible": true/false,
  "confidence": 0.0-1.0,
  "evidenceSources": ["Guidelines or evidence used"],
  "requiresReview": true/false,
  "reviewReasons": ["Reasons requiring clinician review"]
}

Respond with ONLY the JSON object, no other text.`;
}

/**
 * Normalize the AI response
 */
function normalizeCarePlanResponse(
  parsed: ParsedCarePlanResponse,
  planType: string,
  context: PatientContext
): GeneratedCarePlan {
  return {
    title: parsed.title || `${planType.replace(/_/g, " ")} Care Plan`,
    description: parsed.description || "AI-generated care plan requiring review.",
    planType: parsed.planType || planType,
    priority: parsed.priority || "medium",
    goals: parsed.goals || [],
    interventions: parsed.interventions || [],
    barriers: parsed.barriers || [],
    activities: parsed.activities || [],
    careTeam: parsed.careTeam || [],
    estimatedDuration: parsed.estimatedDuration || "12 weeks",
    reviewSchedule: parsed.reviewSchedule || "Every 2 weeks",
    successCriteria: parsed.successCriteria || [],
    riskFactors: parsed.riskFactors || [],
    icd10Codes: parsed.icd10Codes || context.conditions.map((c) => ({ code: c.code, display: c.display })),
    ccmEligible: parsed.ccmEligible ?? (context.conditions.length >= 2),
    tcmEligible: parsed.tcmEligible ?? (context.utilizationHistory.admissions30Days > 0),
    confidence: parsed.confidence ?? 0.8,
    evidenceSources: parsed.evidenceSources || ["Clinical guidelines", "AI analysis"],
    requiresReview: parsed.requiresReview ?? true,
    reviewReasons: parsed.reviewReasons || ["AI-generated content requires clinician review"],
  };
}

/**
 * Default care plan if AI generation fails
 */
function getDefaultCarePlan(planType: string, context: PatientContext): GeneratedCarePlan {
  const templates: Record<string, Partial<GeneratedCarePlan>> = {
    readmission_prevention: {
      title: "Readmission Prevention Care Plan",
      description: "Focused on preventing hospital readmission through close monitoring and care coordination.",
      priority: "high",
      goals: [
        {
          goal: "Prevent 30-day readmission",
          target: "Zero hospital readmissions",
          timeframe: "30 days",
          measurementMethod: "Hospital admission tracking",
          priority: "high",
        },
      ],
      interventions: [
        {
          intervention: "Post-discharge phone calls",
          frequency: "Daily for 7 days, then weekly",
          responsible: "nurse",
          duration: "4 weeks",
          rationale: "Early identification of deterioration",
          billingEligible: true,
        },
        {
          intervention: "Medication reconciliation",
          frequency: "Within 48 hours of discharge",
          responsible: "pharmacist",
          duration: "One-time",
          rationale: "Prevent medication errors",
          cptCode: "99495",
          billingEligible: true,
        },
      ],
      tcmEligible: true,
    },
    chronic_care: {
      title: "Chronic Care Management Plan",
      description: "Comprehensive management of chronic conditions to improve outcomes and quality of life.",
      priority: "medium",
      goals: [
        {
          goal: "Improve chronic condition control",
          target: "Meet clinical targets for primary conditions",
          timeframe: "90 days",
          measurementMethod: "Lab values and clinical assessments",
          priority: "high",
        },
      ],
      interventions: [
        {
          intervention: "Monthly care coordination calls",
          frequency: "Monthly",
          responsible: "care_coordinator",
          duration: "Ongoing",
          rationale: "Regular monitoring and support",
          cptCode: "99490",
          billingEligible: true,
        },
      ],
      ccmEligible: true,
    },
    high_utilizer: {
      title: "High Utilizer Care Management Plan",
      description: "Intensive care management to reduce emergency utilization and improve care access.",
      priority: "critical",
      goals: [
        {
          goal: "Reduce ED visits",
          target: "Less than 2 ED visits per month",
          timeframe: "90 days",
          measurementMethod: "ED visit tracking",
          priority: "high",
        },
      ],
      interventions: [
        {
          intervention: "Weekly care coordination",
          frequency: "Weekly",
          responsible: "care_coordinator",
          duration: "12 weeks",
          rationale: "Intensive support for high-risk patients",
          billingEligible: true,
        },
      ],
    },
    transitional_care: {
      title: "Transitional Care Plan",
      description: "Supporting safe transition from hospital to home or next care setting.",
      priority: "high",
      goals: [
        {
          goal: "Safe transition to home",
          target: "No complications within 14 days",
          timeframe: "14 days",
          measurementMethod: "Follow-up assessments",
          priority: "high",
        },
      ],
      interventions: [
        {
          intervention: "48-hour post-discharge follow-up",
          frequency: "Within 48 hours",
          responsible: "nurse",
          duration: "One-time",
          rationale: "Identify early complications",
          cptCode: "99495",
          billingEligible: true,
        },
      ],
      tcmEligible: true,
    },
    preventive: {
      title: "Preventive Care Plan",
      description: "Focused on health maintenance and disease prevention.",
      priority: "low",
      goals: [
        {
          goal: "Complete all age-appropriate screenings",
          target: "100% screening compliance",
          timeframe: "12 months",
          measurementMethod: "Screening completion tracking",
          priority: "medium",
        },
      ],
      interventions: [
        {
          intervention: "Annual wellness visit coordination",
          frequency: "Annually",
          responsible: "care_coordinator",
          duration: "Ongoing",
          rationale: "Preventive care access",
          billingEligible: true,
        },
      ],
    },
  };

  const template = templates[planType] || templates.chronic_care;

  return {
    title: template.title || "Care Plan",
    description: template.description || "Care plan requiring review.",
    planType,
    priority: template.priority || "medium",
    goals: template.goals || [],
    interventions: template.interventions || [],
    barriers: [],
    activities: [],
    careTeam: [
      { role: "nurse", responsibilities: ["Daily monitoring", "Patient education"] },
      { role: "care_coordinator", responsibilities: ["Care plan oversight", "Resource coordination"] },
    ],
    estimatedDuration: "12 weeks",
    reviewSchedule: "Every 2 weeks",
    successCriteria: ["Goals achieved", "No hospitalizations"],
    riskFactors: context.utilizationHistory.readmissionRisk !== "low" ? ["High utilization history"] : [],
    icd10Codes: context.conditions.slice(0, 5).map((c) => ({ code: c.code, display: c.display })),
    ccmEligible: template.ccmEligible || context.conditions.length >= 2,
    tcmEligible: template.tcmEligible || false,
    confidence: 0.5,
    evidenceSources: ["Template-based fallback"],
    requiresReview: true,
    reviewReasons: ["AI generation failed - template-based plan requires complete review"],
  };
}

/**
 * Log usage for cost tracking
 */
async function logUsage(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  tenantId: string | undefined,
  planType: string,
  responseTimeMs: number,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    const estimatedInputTokens = 2000;
    const estimatedOutputTokens = 2500;
    const cost = (estimatedInputTokens / 1_000_000) * 3 + (estimatedOutputTokens / 1_000_000) * 15;

    await supabase.from("claude_usage_logs").insert({
      user_id: patientId,
      tenant_id: tenantId,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: `care_plan_${planType}`,
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
