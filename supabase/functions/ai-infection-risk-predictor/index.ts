/**
 * AI Infection Risk Predictor (HAI) Edge Function
 *
 * Predicts Hospital-Acquired Infection (HAI) risk based on patient factors.
 * Covers major HAI categories:
 * - CLABSI (Central Line-Associated Bloodstream Infection)
 * - CAUTI (Catheter-Associated Urinary Tract Infection)
 * - SSI (Surgical Site Infection)
 * - VAP (Ventilator-Associated Pneumonia)
 * - C. difficile Infection
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy.
 *
 * @module ai-infection-risk-predictor
 * @skill #33 - Infection Risk Predictor (HAI)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SONNET_MODEL = "claude-sonnet-4-5-20250514";

// ============================================================================
// Types
// ============================================================================

type HAIType = "clabsi" | "cauti" | "ssi" | "vap" | "cdiff" | "overall";

interface InfectionRiskRequest {
  patientId: string;
  assessorId: string;
  haiTypes?: HAIType[];
  includePreventionBundle?: boolean;
}

interface RiskFactor {
  factor: string;
  category: "device" | "procedure" | "medication" | "comorbidity" | "lab" | "environmental" | "behavioral";
  severity: "low" | "moderate" | "high" | "critical";
  evidence: string;
  weight: number;
  mitigable: boolean;
  mitigation?: string;
}

interface ProtectiveFactor {
  factor: string;
  impact: string;
  category: string;
}

interface PreventionIntervention {
  intervention: string;
  category: "bundle_element" | "monitoring" | "environmental" | "medication" | "education";
  priority: "routine" | "recommended" | "strongly_recommended" | "mandatory";
  frequency: string;
  responsible: string;
  evidenceLevel: "A" | "B" | "C";
  estimatedRiskReduction: number;
}

interface HAIRiskScore {
  haiType: HAIType;
  riskScore: number; // 0-100
  riskCategory: "low" | "moderate" | "high" | "very_high";
  riskFactors: RiskFactor[];
  protectiveFactors: ProtectiveFactor[];
  preventionInterventions: PreventionIntervention[];
  daysAtRisk: number;
  deviceDays?: number;
}

interface InfectionRiskAssessment {
  assessmentId: string;
  patientId: string;
  assessorId: string;
  assessmentDate: string;

  // Overall risk
  overallRiskScore: number;
  overallRiskCategory: "low" | "moderate" | "high" | "very_high";
  primaryConcern: HAIType | null;

  // Individual HAI risks
  haiRisks: HAIRiskScore[];

  // Patient context
  lengthOfStay: number;
  hasInvasiveDevices: boolean;
  deviceList: string[];
  recentSurgeries: string[];
  immunocompromised: boolean;
  antibioticExposure: boolean;
  recentLabAbnormalities: string[];

  // Prevention
  bundleComplianceScore: number;
  recommendedBundles: string[];
  criticalInterventions: PreventionIntervention[];

  // Confidence and review
  confidence: number;
  requiresInfectionControlReview: boolean;
  reviewReasons: string[];

  // Summary
  clinicalSummary: string;
  patientEducationPoints: string[];
}

interface PatientContext {
  patientId: string;
  age?: number;
  admissionDate?: string;
  lengthOfStay: number;
  primaryDiagnosis?: string;
  comorbidities: string[];
  currentMedications: string[];
  recentProcedures: string[];
  activeDevices: string[];
  recentLabs: Array<{ test: string; value: string; abnormal: boolean }>;
  isolationStatus?: string;
  immunocompromised: boolean;
  diabetic: boolean;
  recentAntibiotics: string[];
}

// PHI Redaction
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]");

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  const logger = createLogger("ai-infection-risk-predictor", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: InfectionRiskRequest = await req.json();
    const { patientId, assessorId, haiTypes, includePreventionBundle } = body;

    if (!patientId || !assessorId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: patientId and assessorId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);
    const startTime = Date.now();

    // Gather patient context
    const patientContext = await gatherPatientContext(supabase, patientId, logger);

    // Determine which HAI types to assess
    const typesToAssess = haiTypes || determineRelevantHAITypes(patientContext);

    // Generate infection risk assessment
    const assessment = await analyzeInfectionRisk(
      patientContext,
      assessorId,
      typesToAssess,
      includePreventionBundle ?? true,
      logger
    );

    const responseTime = Date.now() - startTime;

    // Store assessment
    await storeAssessment(supabase, assessment, logger);

    // Log usage
    await supabase.from("claude_usage_logs").insert({
      user_id: assessorId,
      request_id: assessment.assessmentId,
      model: SONNET_MODEL,
      request_type: "infection_risk_prediction",
      input_tokens: 900,
      output_tokens: 700,
      cost: (900 / 1_000_000) * 3.0 + (700 / 1_000_000) * 15.0,
      response_time_ms: responseTime,
      success: true,
    });

    logger.info("Infection risk predicted", {
      patientId: redact(patientId),
      overallRisk: assessment.overallRiskCategory,
      primaryConcern: assessment.primaryConcern,
      haiTypesAssessed: typesToAssess.length,
    });

    return new Response(
      JSON.stringify({
        assessment,
        metadata: {
          generated_at: new Date().toISOString(),
          response_time_ms: responseTime,
          model: SONNET_MODEL,
          hai_types_assessed: typesToAssess,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Infection risk prediction failed", { error: error.message });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// Context Gathering
// ============================================================================

async function gatherPatientContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  logger: ReturnType<typeof createLogger>
): Promise<PatientContext> {
  const context: PatientContext = {
    patientId,
    lengthOfStay: 0,
    comorbidities: [],
    currentMedications: [],
    recentProcedures: [],
    activeDevices: [],
    recentLabs: [],
    immunocompromised: false,
    diabetic: false,
    recentAntibiotics: [],
  };

  try {
    // Get patient profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("date_of_birth")
      .eq("id", patientId)
      .single();

    if (profile?.date_of_birth) {
      context.age = Math.floor(
        (Date.now() - new Date(profile.date_of_birth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      );
    }

    // Get admission info
    const { data: admission } = await supabase
      .from("patient_admissions")
      .select("admission_date, primary_diagnosis, isolation_status")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(1)
      .single();

    if (admission) {
      context.admissionDate = admission.admission_date as string;
      context.primaryDiagnosis = admission.primary_diagnosis as string;
      context.isolationStatus = admission.isolation_status as string;

      const admitDate = new Date(admission.admission_date as string);
      context.lengthOfStay = Math.floor(
        (Date.now() - admitDate.getTime()) / (24 * 60 * 60 * 1000)
      );
    }

    // Get active devices
    const { data: devices } = await supabase
      .from("patient_devices")
      .select("device_type, insertion_date")
      .eq("patient_id", patientId)
      .eq("status", "active");

    if (devices) {
      context.activeDevices = devices.map((d) => d.device_type as string);
    }

    // Get recent procedures (last 30 days)
    const { data: procedures } = await supabase
      .from("patient_procedures")
      .select("procedure_name, procedure_date")
      .eq("patient_id", patientId)
      .gte("procedure_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(20);

    if (procedures) {
      context.recentProcedures = procedures.map((p) => p.procedure_name as string);
    }

    // Get current medications (look for antibiotics)
    const { data: meds } = await supabase
      .from("patient_medications")
      .select("medication_name, medication_class")
      .eq("patient_id", patientId)
      .eq("status", "active");

    if (meds) {
      context.currentMedications = meds.map((m) => m.medication_name as string);

      // Identify antibiotics
      const antibioticClasses = ["antibiotic", "antimicrobial", "antifungal"];
      context.recentAntibiotics = meds
        .filter((m) =>
          antibioticClasses.some((c) =>
            ((m.medication_class as string) || "").toLowerCase().includes(c)
          )
        )
        .map((m) => m.medication_name as string);
    }

    // Get care plan conditions
    const { data: carePlan } = await supabase
      .from("care_coordination_plans")
      .select("conditions")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(1)
      .single();

    if (carePlan?.conditions && Array.isArray(carePlan.conditions)) {
      context.comorbidities = carePlan.conditions as string[];

      // Check for immunocompromised and diabetes
      const conditions = context.comorbidities.map((c) => c.toLowerCase());
      context.immunocompromised = conditions.some(
        (c) =>
          c.includes("hiv") ||
          c.includes("aids") ||
          c.includes("transplant") ||
          c.includes("chemotherapy") ||
          c.includes("immunodeficiency") ||
          c.includes("leukemia") ||
          c.includes("lymphoma")
      );
      context.diabetic = conditions.some((c) => c.includes("diabetes"));
    }

    // Get recent labs
    const { data: labs } = await supabase
      .from("fhir_observations")
      .select("code, value, unit")
      .eq("patient_id", patientId)
      .in("code", ["WBC", "TEMP", "CRP", "PCT", "LACTATE", "GLUCOSE"])
      .gte("effective_date_time", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order("effective_date_time", { ascending: false })
      .limit(20);

    if (labs) {
      context.recentLabs = labs.map((l) => ({
        test: l.code as string,
        value: `${l.value} ${l.unit || ""}`,
        abnormal: isLabAbnormal(l.code as string, parseFloat(l.value as string)),
      }));
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather full patient context", { error: error.message });
  }

  return context;
}

function isLabAbnormal(code: string, value: number): boolean {
  const ranges: Record<string, { min: number; max: number }> = {
    WBC: { min: 4.5, max: 11.0 },
    TEMP: { min: 97.0, max: 99.5 },
    CRP: { min: 0, max: 10 },
    PCT: { min: 0, max: 0.5 },
    LACTATE: { min: 0.5, max: 2.0 },
    GLUCOSE: { min: 70, max: 140 },
  };

  const range = ranges[code];
  if (!range) return false;
  return value < range.min || value > range.max;
}

function determineRelevantHAITypes(context: PatientContext): HAIType[] {
  const types: HAIType[] = ["overall"];

  // CLABSI if has central line
  if (
    context.activeDevices.some((d) =>
      ["central line", "picc", "port", "cvc", "midline"].some((t) =>
        d.toLowerCase().includes(t)
      )
    )
  ) {
    types.push("clabsi");
  }

  // CAUTI if has urinary catheter
  if (
    context.activeDevices.some((d) =>
      ["foley", "urinary catheter", "indwelling catheter"].some((t) =>
        d.toLowerCase().includes(t)
      )
    )
  ) {
    types.push("cauti");
  }

  // SSI if recent surgery
  if (context.recentProcedures.some((p) => p.toLowerCase().includes("surgery"))) {
    types.push("ssi");
  }

  // VAP if on ventilator
  if (
    context.activeDevices.some((d) =>
      ["ventilator", "ett", "endotracheal", "trach"].some((t) =>
        d.toLowerCase().includes(t)
      )
    )
  ) {
    types.push("vap");
  }

  // C. diff if on antibiotics or elderly
  if (context.recentAntibiotics.length > 0 || (context.age && context.age >= 65)) {
    types.push("cdiff");
  }

  return types;
}

// ============================================================================
// AI Analysis
// ============================================================================

async function analyzeInfectionRisk(
  context: PatientContext,
  assessorId: string,
  haiTypes: HAIType[],
  includePreventionBundle: boolean,
  logger: ReturnType<typeof createLogger>
): Promise<InfectionRiskAssessment> {
  const assessmentId = crypto.randomUUID();

  // Calculate rule-based risks for each HAI type
  const haiRisks = haiTypes.map((type) => calculateHAIRisk(context, type));

  // Determine overall risk
  const maxRisk = Math.max(...haiRisks.map((r) => r.riskScore));
  const overallRiskCategory = getOverallRiskCategory(maxRisk);
  const primaryConcern =
    haiRisks.length > 0
      ? haiRisks.reduce((prev, current) =>
          prev.riskScore > current.riskScore ? prev : current
        ).haiType
      : null;

  // Try AI enhancement for comprehensive analysis
  try {
    const prompt = buildAnalysisPrompt(context, haiTypes, includePreventionBundle);

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
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.content[0]?.text || "";

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const aiAnalysis = JSON.parse(jsonMatch[0]);
        return buildAssessmentFromAI(
          assessmentId,
          context,
          assessorId,
          haiRisks,
          aiAnalysis
        );
      }
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("AI enhancement failed, using rule-based", { error: error.message });
  }

  // Fallback to rule-based assessment
  return buildRuleBasedAssessment(
    assessmentId,
    context,
    assessorId,
    haiRisks,
    maxRisk,
    overallRiskCategory,
    primaryConcern
  );
}

function calculateHAIRisk(context: PatientContext, haiType: HAIType): HAIRiskScore {
  let score = 0;
  const riskFactors: RiskFactor[] = [];
  const protectiveFactors: ProtectiveFactor[] = [];
  const interventions: PreventionIntervention[] = [];
  let deviceDays = 0;

  // Common risk factors
  if (context.lengthOfStay > 7) {
    score += 15;
    riskFactors.push({
      factor: `Extended length of stay (${context.lengthOfStay} days)`,
      category: "environmental",
      severity: context.lengthOfStay > 14 ? "high" : "moderate",
      evidence: "LOS > 7 days increases HAI risk",
      weight: 15,
      mitigable: false,
    });
  }

  if (context.immunocompromised) {
    score += 20;
    riskFactors.push({
      factor: "Immunocompromised status",
      category: "comorbidity",
      severity: "high",
      evidence: "Immunosuppression significantly increases infection risk",
      weight: 20,
      mitigable: false,
    });
  }

  if (context.age && context.age >= 65) {
    score += 10;
    riskFactors.push({
      factor: `Advanced age (${context.age} years)`,
      category: "comorbidity",
      severity: "moderate",
      evidence: "Age ≥65 associated with increased HAI risk",
      weight: 10,
      mitigable: false,
    });
  }

  if (context.diabetic) {
    score += 10;
    riskFactors.push({
      factor: "Diabetes mellitus",
      category: "comorbidity",
      severity: "moderate",
      evidence: "Diabetes impairs immune function and wound healing",
      weight: 10,
      mitigable: true,
      mitigation: "Maintain tight glycemic control",
    });
  }

  // HAI-specific factors
  switch (haiType) {
    case "clabsi":
      if (context.activeDevices.some((d) => d.toLowerCase().includes("central"))) {
        score += 25;
        deviceDays = context.lengthOfStay; // Simplified
        riskFactors.push({
          factor: "Central venous catheter in place",
          category: "device",
          severity: "high",
          evidence: "Central lines are primary CLABSI risk factor",
          weight: 25,
          mitigable: true,
          mitigation: "Daily assessment of line necessity; consider removal",
        });

        interventions.push({
          intervention: "Daily central line necessity assessment",
          category: "bundle_element",
          priority: "mandatory",
          frequency: "Daily",
          responsible: "Physician/NP",
          evidenceLevel: "A",
          estimatedRiskReduction: 30,
        });
      }
      break;

    case "cauti":
      if (context.activeDevices.some((d) => d.toLowerCase().includes("foley"))) {
        score += 20;
        deviceDays = context.lengthOfStay;
        riskFactors.push({
          factor: "Indwelling urinary catheter",
          category: "device",
          severity: "high",
          evidence: "Urinary catheters are primary CAUTI risk factor",
          weight: 20,
          mitigable: true,
          mitigation: "Daily catheter necessity review; early removal",
        });

        interventions.push({
          intervention: "Daily catheter necessity assessment",
          category: "bundle_element",
          priority: "mandatory",
          frequency: "Daily",
          responsible: "Nursing",
          evidenceLevel: "A",
          estimatedRiskReduction: 25,
        });
      }
      break;

    case "ssi":
      if (context.recentProcedures.some((p) => p.toLowerCase().includes("surgery"))) {
        score += 20;
        riskFactors.push({
          factor: "Recent surgical procedure",
          category: "procedure",
          severity: "moderate",
          evidence: "Surgery creates infection risk at surgical site",
          weight: 20,
          mitigable: true,
          mitigation: "Proper wound care and monitoring",
        });

        interventions.push({
          intervention: "Surgical site inspection every shift",
          category: "monitoring",
          priority: "mandatory",
          frequency: "Every 8 hours",
          responsible: "Nursing",
          evidenceLevel: "A",
          estimatedRiskReduction: 20,
        });
      }
      break;

    case "vap":
      if (context.activeDevices.some((d) => d.toLowerCase().includes("vent"))) {
        score += 30;
        deviceDays = context.lengthOfStay;
        riskFactors.push({
          factor: "Mechanical ventilation",
          category: "device",
          severity: "critical",
          evidence: "Intubation bypasses natural airway defenses",
          weight: 30,
          mitigable: true,
          mitigation: "VAP bundle compliance; daily sedation vacation",
        });

        interventions.push({
          intervention: "Head of bed elevation ≥30 degrees",
          category: "bundle_element",
          priority: "mandatory",
          frequency: "Continuous",
          responsible: "Nursing",
          evidenceLevel: "A",
          estimatedRiskReduction: 25,
        });
      }
      break;

    case "cdiff":
      if (context.recentAntibiotics.length > 0) {
        score += 20;
        riskFactors.push({
          factor: `Recent antibiotic exposure (${context.recentAntibiotics.length} agents)`,
          category: "medication",
          severity: "high",
          evidence: "Antibiotics disrupt gut microbiome, enabling C. diff overgrowth",
          weight: 20,
          mitigable: true,
          mitigation: "Antibiotic stewardship; consider probiotics",
        });

        interventions.push({
          intervention: "Antibiotic stewardship review",
          category: "medication",
          priority: "strongly_recommended",
          frequency: "Within 48 hours",
          responsible: "Pharmacist/ID",
          evidenceLevel: "A",
          estimatedRiskReduction: 30,
        });
      }
      break;

    case "overall":
      // Already captured common factors above
      break;
  }

  // Cap score at 100
  score = Math.min(score, 100);

  return {
    haiType,
    riskScore: score,
    riskCategory: getOverallRiskCategory(score),
    riskFactors,
    protectiveFactors,
    preventionInterventions: interventions,
    daysAtRisk: context.lengthOfStay,
    deviceDays: deviceDays > 0 ? deviceDays : undefined,
  };
}

function getOverallRiskCategory(score: number): "low" | "moderate" | "high" | "very_high" {
  if (score >= 70) return "very_high";
  if (score >= 50) return "high";
  if (score >= 30) return "moderate";
  return "low";
}

function buildAnalysisPrompt(
  context: PatientContext,
  haiTypes: HAIType[],
  includePreventionBundle: boolean
): string {
  return `You are an infection control specialist analyzing patient data for Hospital-Acquired Infection (HAI) risk.

PATIENT CONTEXT:
- Age: ${context.age || "Unknown"}
- Length of Stay: ${context.lengthOfStay} days
- Admission Date: ${context.admissionDate || "Unknown"}
- Primary Diagnosis: ${context.primaryDiagnosis || "Unknown"}
- Comorbidities: ${context.comorbidities.join(", ") || "None documented"}
- Immunocompromised: ${context.immunocompromised ? "Yes" : "No"}
- Diabetic: ${context.diabetic ? "Yes" : "No"}

ACTIVE DEVICES:
${context.activeDevices.join("\n") || "None"}

RECENT PROCEDURES (Last 30 days):
${context.recentProcedures.join("\n") || "None"}

CURRENT ANTIBIOTICS:
${context.recentAntibiotics.join(", ") || "None"}

RECENT LABS:
${context.recentLabs.map((l) => `- ${l.test}: ${l.value} ${l.abnormal ? "[ABNORMAL]" : ""}`).join("\n") || "None available"}

ISOLATION STATUS: ${context.isolationStatus || "None"}

Analyze risk for these HAI types: ${haiTypes.join(", ")}
${includePreventionBundle ? "Include evidence-based prevention bundle recommendations." : ""}

Return JSON:
{
  "clinicalSummary": "2-3 sentence clinical summary of infection risk",
  "overallRiskScore": 0-100,
  "primaryConcern": "clabsi|cauti|ssi|vap|cdiff|null",
  "bundleComplianceRecommendations": ["list of bundle elements"],
  "criticalInterventions": [
    {
      "intervention": "specific action",
      "priority": "mandatory|strongly_recommended|recommended|routine",
      "rationale": "clinical reasoning"
    }
  ],
  "patientEducationPoints": ["list of patient/family education points"],
  "requiresInfectionControlReview": true/false,
  "reviewReasons": ["reasons if review required"],
  "confidence": 0.0-1.0
}

Return ONLY the JSON.`;
}

function buildAssessmentFromAI(
  assessmentId: string,
  context: PatientContext,
  assessorId: string,
  haiRisks: HAIRiskScore[],
  aiAnalysis: Record<string, unknown>
): InfectionRiskAssessment {
  const maxScore = Math.max(...haiRisks.map((r) => r.riskScore));

  return {
    assessmentId,
    patientId: context.patientId,
    assessorId,
    assessmentDate: new Date().toISOString(),
    overallRiskScore: (aiAnalysis.overallRiskScore as number) || maxScore,
    overallRiskCategory: getOverallRiskCategory((aiAnalysis.overallRiskScore as number) || maxScore),
    primaryConcern: (aiAnalysis.primaryConcern as HAIType) || null,
    haiRisks,
    lengthOfStay: context.lengthOfStay,
    hasInvasiveDevices: context.activeDevices.length > 0,
    deviceList: context.activeDevices,
    recentSurgeries: context.recentProcedures.filter((p) => p.toLowerCase().includes("surgery")),
    immunocompromised: context.immunocompromised,
    antibioticExposure: context.recentAntibiotics.length > 0,
    recentLabAbnormalities: context.recentLabs.filter((l) => l.abnormal).map((l) => `${l.test}: ${l.value}`),
    bundleComplianceScore: 0, // Would need actual bundle data
    recommendedBundles: (aiAnalysis.bundleComplianceRecommendations as string[]) || [],
    criticalInterventions: ((aiAnalysis.criticalInterventions as Array<Record<string, string>>) || []).map((i) => ({
      intervention: i.intervention,
      category: "bundle_element" as const,
      priority: (i.priority as PreventionIntervention["priority"]) || "recommended",
      frequency: "As indicated",
      responsible: "Care Team",
      evidenceLevel: "B" as const,
      estimatedRiskReduction: 20,
    })),
    confidence: (aiAnalysis.confidence as number) || 0.75,
    requiresInfectionControlReview: (aiAnalysis.requiresInfectionControlReview as boolean) || maxScore >= 50,
    reviewReasons: (aiAnalysis.reviewReasons as string[]) || [],
    clinicalSummary: (aiAnalysis.clinicalSummary as string) || "Infection risk assessment completed.",
    patientEducationPoints: (aiAnalysis.patientEducationPoints as string[]) || [],
  };
}

function buildRuleBasedAssessment(
  assessmentId: string,
  context: PatientContext,
  assessorId: string,
  haiRisks: HAIRiskScore[],
  maxScore: number,
  overallRiskCategory: "low" | "moderate" | "high" | "very_high",
  primaryConcern: HAIType | null
): InfectionRiskAssessment {
  // Collect all critical interventions
  const allInterventions = haiRisks.flatMap((r) => r.preventionInterventions);
  const criticalInterventions = allInterventions.filter(
    (i) => i.priority === "mandatory" || i.priority === "strongly_recommended"
  );

  return {
    assessmentId,
    patientId: context.patientId,
    assessorId,
    assessmentDate: new Date().toISOString(),
    overallRiskScore: maxScore,
    overallRiskCategory,
    primaryConcern,
    haiRisks,
    lengthOfStay: context.lengthOfStay,
    hasInvasiveDevices: context.activeDevices.length > 0,
    deviceList: context.activeDevices,
    recentSurgeries: context.recentProcedures.filter((p) => p.toLowerCase().includes("surgery")),
    immunocompromised: context.immunocompromised,
    antibioticExposure: context.recentAntibiotics.length > 0,
    recentLabAbnormalities: context.recentLabs.filter((l) => l.abnormal).map((l) => `${l.test}: ${l.value}`),
    bundleComplianceScore: 0,
    recommendedBundles: getRecommendedBundles(haiRisks),
    criticalInterventions,
    confidence: 0.75,
    requiresInfectionControlReview: maxScore >= 50 || context.immunocompromised,
    reviewReasons: maxScore >= 50 ? [`High infection risk score: ${maxScore}`] : [],
    clinicalSummary: `Patient has ${overallRiskCategory} overall HAI risk (score: ${maxScore}/100). ${haiRisks.length} HAI type(s) assessed. ${criticalInterventions.length} critical intervention(s) recommended.`,
    patientEducationPoints: [
      "Importance of hand hygiene",
      "Signs of infection to report",
      "Care of invasive devices",
    ],
  };
}

function getRecommendedBundles(haiRisks: HAIRiskScore[]): string[] {
  const bundles: string[] = [];

  for (const risk of haiRisks) {
    switch (risk.haiType) {
      case "clabsi":
        if (risk.riskScore > 0) bundles.push("Central Line Bundle");
        break;
      case "cauti":
        if (risk.riskScore > 0) bundles.push("Urinary Catheter Bundle");
        break;
      case "vap":
        if (risk.riskScore > 0) bundles.push("Ventilator Bundle");
        break;
      case "ssi":
        if (risk.riskScore > 0) bundles.push("Surgical Site Infection Prevention Bundle");
        break;
      case "cdiff":
        if (risk.riskScore > 0) bundles.push("C. difficile Prevention Protocol");
        break;
    }
  }

  return [...new Set(bundles)];
}

// ============================================================================
// Storage
// ============================================================================

async function storeAssessment(
  supabase: ReturnType<typeof createClient>,
  assessment: InfectionRiskAssessment,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    await supabase.from("ai_risk_assessments").insert({
      patient_id: assessment.patientId,
      risk_category: "infection_hai",
      risk_level: assessment.overallRiskCategory,
      risk_score: assessment.overallRiskScore,
      confidence: assessment.confidence,
      risk_factors: assessment.haiRisks.flatMap((r) => r.riskFactors),
      protective_factors: assessment.haiRisks.flatMap((r) => r.protectiveFactors),
      recommendations: assessment.criticalInterventions,
      requires_review: assessment.requiresInfectionControlReview,
      review_reasons: assessment.reviewReasons,
      summary: assessment.clinicalSummary,
      model_used: SONNET_MODEL,
      assessed_at: assessment.assessmentDate,
    });

    logger.info("Infection risk assessment stored", {
      assessmentId: assessment.assessmentId,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to store assessment", { error: error.message });
  }
}
