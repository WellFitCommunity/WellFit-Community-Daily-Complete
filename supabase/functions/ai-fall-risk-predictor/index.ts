/**
 * AI Fall Risk Predictor Edge Function
 *
 * Predicts patient fall risk using Claude Sonnet 4.5 for clinical accuracy.
 * Analyzes multiple risk factors based on validated assessment tools:
 * - Morse Fall Scale factors
 * - STRATIFY risk assessment criteria
 * - Evidence-based clinical predictors
 *
 * Risk Factors Analyzed:
 * - Age and demographics
 * - Fall history
 * - Medications (high-risk categories)
 * - Medical conditions (neurological, cardiovascular, musculoskeletal)
 * - Mobility and gait
 * - Cognitive status
 * - Vision impairment
 * - Environmental factors
 *
 * @module ai-fall-risk-predictor
 * @skill #30 - Fall Risk Predictor
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

interface FallRiskRequest {
  patientId: string;
  assessorId: string;
  assessmentContext?: "admission" | "routine" | "post_fall" | "discharge";
  includeEnvironmentalFactors?: boolean;
  customFactors?: string[];
}

interface RiskFactor {
  factor: string;
  category: "age" | "history" | "medication" | "condition" | "mobility" | "cognitive" | "sensory" | "environmental";
  severity: "low" | "moderate" | "high";
  weight: number; // 0-1 contribution to overall risk
  evidence: string;
  interventionSuggestion?: string;
}

interface ProtectiveFactor {
  factor: string;
  impact: string;
  category: string;
}

interface Intervention {
  intervention: string;
  priority: "low" | "medium" | "high" | "urgent";
  category: "environmental" | "medication" | "therapy" | "equipment" | "education" | "monitoring";
  timeframe: string;
  responsible: string;
  estimatedRiskReduction: number; // 0-1
}

interface FallRiskAssessment {
  assessmentId: string;
  patientId: string;
  assessorId: string;
  assessmentDate: string;
  assessmentContext: string;

  // Risk scores
  overallRiskScore: number; // 0-100
  riskCategory: "low" | "moderate" | "high" | "very_high";
  morseScaleEstimate: number; // 0-125 (Morse Fall Scale equivalent)

  // Risk breakdown
  riskFactors: RiskFactor[];
  protectiveFactors: ProtectiveFactor[];

  // Demographics
  patientAge: number | null;
  ageRiskCategory: "low" | "moderate" | "high";

  // Category scores (0-100)
  categoryScores: {
    age: number;
    fallHistory: number;
    medications: number;
    conditions: number;
    mobility: number;
    cognitive: number;
    sensory: number;
    environmental: number;
  };

  // Recommendations
  interventions: Intervention[];
  precautions: string[];
  monitoringFrequency: "standard" | "enhanced" | "intensive";

  // AI metadata
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  plainLanguageExplanation: string;

  generatedAt: string;
}

// ============================================================================
// High-Risk Medication Categories (evidence-based)
// ============================================================================

const HIGH_RISK_MEDICATION_CLASSES = [
  // Sedatives/Hypnotics
  "benzodiazepine", "zolpidem", "eszopiclone", "zaleplon",
  // Opioids
  "opioid", "morphine", "oxycodone", "hydrocodone", "fentanyl", "tramadol",
  // Antipsychotics
  "antipsychotic", "haloperidol", "risperidone", "quetiapine", "olanzapine",
  // Antidepressants (especially TCAs)
  "tricyclic", "amitriptyline", "nortriptyline",
  // Anticonvulsants
  "anticonvulsant", "phenytoin", "carbamazepine", "gabapentin", "pregabalin",
  // Antihypertensives
  "antihypertensive", "diuretic", "furosemide", "hydrochlorothiazide",
  "alpha blocker", "doxazosin", "prazosin",
  // Antihistamines (sedating)
  "diphenhydramine", "hydroxyzine",
  // Muscle relaxants
  "muscle relaxant", "cyclobenzaprine", "methocarbamol",
  // Anticholinergics
  "anticholinergic", "oxybutynin",
];

// ============================================================================
// High-Risk Conditions (ICD-10/SNOMED)
// ============================================================================

const HIGH_RISK_CONDITIONS = {
  neurological: [
    "parkinson", "dementia", "alzheimer", "stroke", "cva", "tia",
    "neuropathy", "multiple sclerosis", "epilepsy", "seizure",
    "vertigo", "dizziness", "syncope",
  ],
  cardiovascular: [
    "orthostatic hypotension", "arrhythmia", "atrial fibrillation",
    "heart failure", "hypotension", "bradycardia",
  ],
  musculoskeletal: [
    "arthritis", "osteoarthritis", "rheumatoid", "osteoporosis",
    "fracture", "joint replacement", "amputation", "weakness",
    "sarcopenia", "muscle wasting",
  ],
  sensory: [
    "vision", "blind", "glaucoma", "cataract", "macular degeneration",
    "hearing loss", "deaf",
  ],
  metabolic: [
    "diabetes", "hypoglycemia", "anemia", "vitamin d deficiency",
    "dehydration", "electrolyte",
  ],
  cognitive: [
    "cognitive impairment", "confusion", "delirium", "depression",
    "anxiety",
  ],
};

// ============================================================================
// PHI Redaction
// ============================================================================

const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  const logger = createLogger("ai-fall-risk-predictor", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: FallRiskRequest = await req.json();
    const {
      patientId,
      assessorId,
      assessmentContext = "routine",
      includeEnvironmentalFactors = true,
      customFactors = [],
    } = body;

    if (!patientId || !assessorId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: patientId, assessorId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Log PHI access
    await supabase.from("audit_phi_access").insert({
      user_id: assessorId,
      patient_id: patientId,
      access_type: "fall_risk_assessment",
      resource_type: "patient_data",
      access_reason: `AI fall risk assessment - ${assessmentContext}`,
    });

    // Gather patient data
    const patientData = await gatherPatientData(supabase, patientId, logger);

    // Calculate preliminary scores
    const preliminaryScores = calculatePreliminaryScores(patientData);

    // Generate AI assessment
    const startTime = Date.now();
    const aiAssessment = await generateAIAssessment(
      patientData,
      preliminaryScores,
      assessmentContext,
      customFactors,
      logger
    );
    const responseTime = Date.now() - startTime;

    // Build final assessment
    const assessmentId = crypto.randomUUID();
    const assessment: FallRiskAssessment = {
      assessmentId,
      patientId,
      assessorId,
      assessmentDate: new Date().toISOString(),
      assessmentContext,
      overallRiskScore: aiAssessment.overallRiskScore,
      riskCategory: aiAssessment.riskCategory,
      morseScaleEstimate: aiAssessment.morseScaleEstimate,
      riskFactors: aiAssessment.riskFactors,
      protectiveFactors: aiAssessment.protectiveFactors,
      patientAge: patientData.age,
      ageRiskCategory: patientData.age ? (patientData.age >= 80 ? "high" : patientData.age >= 65 ? "moderate" : "low") : "low",
      categoryScores: preliminaryScores,
      interventions: aiAssessment.interventions,
      precautions: aiAssessment.precautions,
      monitoringFrequency: aiAssessment.overallRiskScore >= 70 ? "intensive" : aiAssessment.overallRiskScore >= 40 ? "enhanced" : "standard",
      confidence: aiAssessment.confidence,
      requiresReview: true, // Always require review for clinical assessments
      reviewReasons: aiAssessment.reviewReasons,
      plainLanguageExplanation: aiAssessment.plainLanguageExplanation,
      generatedAt: new Date().toISOString(),
    };

    // Log usage
    await supabase.from("claude_usage_logs").insert({
      user_id: assessorId,
      request_id: assessmentId,
      model: SONNET_MODEL,
      request_type: "fall_risk_prediction",
      input_tokens: 800,
      output_tokens: 1200,
      cost: (800 / 1_000_000) * 3.0 + (1200 / 1_000_000) * 15.0,
      response_time_ms: responseTime,
      success: true,
      metadata: {
        assessment_context: assessmentContext,
        risk_category: assessment.riskCategory,
        overall_score: assessment.overallRiskScore,
      },
    });

    logger.phi("Fall risk assessment completed", {
      patientId: redact(patientId),
      assessorId: redact(assessorId),
      riskCategory: assessment.riskCategory,
      overallScore: assessment.overallRiskScore,
    });

    return new Response(
      JSON.stringify({
        assessment,
        metadata: {
          generated_at: assessment.generatedAt,
          response_time_ms: responseTime,
          model: SONNET_MODEL,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Fall risk assessment failed", { error: error.message });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// Data Gathering
// ============================================================================

interface PatientData {
  age: number | null;
  gender: string | null;
  conditions: { code: string; display: string; status: string }[];
  medications: { name: string; status: string }[];
  recentVitals: { type: string; value: number; date: string }[];
  fallHistory: { date: string; severity: string; location: string }[];
  mobilityAids: string[];
  cognitiveStatus: string | null;
  recentCheckIns: { date: string; concerns: string[] }[];
}

async function gatherPatientData(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  logger: ReturnType<typeof createLogger>
): Promise<PatientData> {
  const data: PatientData = {
    age: null,
    gender: null,
    conditions: [],
    medications: [],
    recentVitals: [],
    fallHistory: [],
    mobilityAids: [],
    cognitiveStatus: null,
    recentCheckIns: [],
  };

  try {
    // Get patient demographics
    const { data: profile } = await supabase
      .from("profiles")
      .select("dob, gender")
      .eq("id", patientId)
      .single();

    if (profile?.dob) {
      const dob = new Date(profile.dob);
      const today = new Date();
      data.age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
    data.gender = profile?.gender || null;

    // Get active conditions
    const { data: conditions } = await supabase
      .from("fhir_conditions")
      .select("code, code_display, clinical_status")
      .eq("patient_id", patientId)
      .eq("clinical_status", "active")
      .limit(30);

    if (conditions) {
      data.conditions = conditions.map((c) => ({
        code: c.code,
        display: c.code_display,
        status: c.clinical_status,
      }));
    }

    // Get active medications
    const { data: medications } = await supabase
      .from("fhir_medication_statements")
      .select("medication_display, status")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(30);

    if (medications) {
      data.medications = medications.map((m) => ({
        name: m.medication_display,
        status: m.status,
      }));
    }

    // Get recent vitals (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: vitals } = await supabase
      .from("fhir_observations")
      .select("code_display, value_quantity_value, effective_datetime")
      .eq("patient_id", patientId)
      .gte("effective_datetime", thirtyDaysAgo)
      .in("code", ["8480-6", "8462-4", "8867-4", "29463-7"]) // BP systolic, diastolic, HR, weight
      .order("effective_datetime", { ascending: false })
      .limit(20);

    if (vitals) {
      data.recentVitals = vitals.map((v) => ({
        type: v.code_display,
        value: v.value_quantity_value,
        date: v.effective_datetime,
      }));
    }

    // Get fall history from adverse events or incidents
    const { data: fallEvents } = await supabase
      .from("adverse_events")
      .select("event_date, severity, location")
      .eq("patient_id", patientId)
      .ilike("event_type", "%fall%")
      .order("event_date", { ascending: false })
      .limit(10);

    if (fallEvents) {
      data.fallHistory = fallEvents.map((f) => ({
        date: f.event_date,
        severity: f.severity || "unknown",
        location: f.location || "unknown",
      }));
    }

    // Get recent check-ins for concerns
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: checkIns } = await supabase
      .from("patient_daily_check_ins")
      .select("check_in_date, concern_flags")
      .eq("patient_id", patientId)
      .gte("check_in_date", sevenDaysAgo.split("T")[0])
      .order("check_in_date", { ascending: false })
      .limit(7);

    if (checkIns) {
      data.recentCheckIns = checkIns.map((c) => ({
        date: c.check_in_date,
        concerns: c.concern_flags || [],
      }));
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather complete patient data", { error: error.message });
  }

  return data;
}

// ============================================================================
// Preliminary Score Calculation
// ============================================================================

interface CategoryScores {
  age: number;
  fallHistory: number;
  medications: number;
  conditions: number;
  mobility: number;
  cognitive: number;
  sensory: number;
  environmental: number;
}

function calculatePreliminaryScores(data: PatientData): CategoryScores {
  const scores: CategoryScores = {
    age: 0,
    fallHistory: 0,
    medications: 0,
    conditions: 0,
    mobility: 0,
    cognitive: 0,
    sensory: 0,
    environmental: 20, // Default baseline
  };

  // Age risk (0-100)
  if (data.age) {
    if (data.age >= 85) scores.age = 100;
    else if (data.age >= 80) scores.age = 80;
    else if (data.age >= 75) scores.age = 60;
    else if (data.age >= 65) scores.age = 40;
    else if (data.age >= 55) scores.age = 20;
  }

  // Fall history risk
  if (data.fallHistory.length > 0) {
    const recentFalls = data.fallHistory.filter((f) => {
      const fallDate = new Date(f.date);
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      return fallDate >= oneYearAgo;
    });

    if (recentFalls.length >= 3) scores.fallHistory = 100;
    else if (recentFalls.length === 2) scores.fallHistory = 75;
    else if (recentFalls.length === 1) scores.fallHistory = 50;
  }

  // Medication risk
  const highRiskMeds = data.medications.filter((m) =>
    HIGH_RISK_MEDICATION_CLASSES.some((cls) =>
      m.name.toLowerCase().includes(cls.toLowerCase())
    )
  );
  if (highRiskMeds.length >= 4) scores.medications = 100;
  else if (highRiskMeds.length === 3) scores.medications = 75;
  else if (highRiskMeds.length === 2) scores.medications = 50;
  else if (highRiskMeds.length === 1) scores.medications = 25;

  // Polypharmacy consideration
  if (data.medications.length >= 10) scores.medications = Math.max(scores.medications, 60);
  else if (data.medications.length >= 5) scores.medications = Math.max(scores.medications, 30);

  // Condition risk - check each category
  let conditionScore = 0;
  const conditionTexts = data.conditions.map((c) => c.display.toLowerCase());

  for (const category of Object.values(HIGH_RISK_CONDITIONS)) {
    for (const condition of category) {
      if (conditionTexts.some((ct) => ct.includes(condition))) {
        conditionScore += 15;
      }
    }
  }
  scores.conditions = Math.min(100, conditionScore);

  // Mobility risk - inferred from conditions
  const mobilityConditions = ["arthritis", "parkinson", "weakness", "amputation", "fracture"];
  const hasMobilityIssue = conditionTexts.some((ct) =>
    mobilityConditions.some((mc) => ct.includes(mc))
  );
  scores.mobility = hasMobilityIssue ? 60 : 20;

  // Cognitive risk
  const cognitiveConditions = ["dementia", "alzheimer", "cognitive", "confusion", "delirium"];
  const hasCognitiveIssue = conditionTexts.some((ct) =>
    cognitiveConditions.some((cc) => ct.includes(cc))
  );
  scores.cognitive = hasCognitiveIssue ? 70 : 10;

  // Sensory risk
  const sensoryConditions = ["vision", "blind", "glaucoma", "cataract", "hearing"];
  const hasSensoryIssue = conditionTexts.some((ct) =>
    sensoryConditions.some((sc) => ct.includes(sc))
  );
  scores.sensory = hasSensoryIssue ? 50 : 10;

  return scores;
}

// ============================================================================
// AI Assessment Generation
// ============================================================================

interface AIAssessmentResult {
  overallRiskScore: number;
  riskCategory: "low" | "moderate" | "high" | "very_high";
  morseScaleEstimate: number;
  riskFactors: RiskFactor[];
  protectiveFactors: ProtectiveFactor[];
  interventions: Intervention[];
  precautions: string[];
  confidence: number;
  reviewReasons: string[];
  plainLanguageExplanation: string;
}

async function generateAIAssessment(
  patientData: PatientData,
  preliminaryScores: CategoryScores,
  assessmentContext: string,
  customFactors: string[],
  logger: ReturnType<typeof createLogger>
): Promise<AIAssessmentResult> {
  const conditionsList = patientData.conditions.map((c) => c.display).join(", ") || "None documented";
  const medicationsList = patientData.medications.map((m) => m.name).join(", ") || "None documented";
  const fallHistoryText = patientData.fallHistory.length > 0
    ? patientData.fallHistory.map((f) => `${f.date}: ${f.severity} fall at ${f.location}`).join("; ")
    : "No documented falls";

  const prompt = `You are a clinical fall risk assessment specialist. Analyze this patient data and provide a comprehensive fall risk assessment.

PATIENT DATA:
- Age: ${patientData.age || "Unknown"}
- Gender: ${patientData.gender || "Unknown"}
- Assessment Context: ${assessmentContext}

ACTIVE CONDITIONS:
${conditionsList}

CURRENT MEDICATIONS:
${medicationsList}

FALL HISTORY:
${fallHistoryText}

PRELIMINARY RISK SCORES (0-100):
- Age Risk: ${preliminaryScores.age}
- Fall History: ${preliminaryScores.fallHistory}
- Medication Risk: ${preliminaryScores.medications}
- Condition Risk: ${preliminaryScores.conditions}
- Mobility: ${preliminaryScores.mobility}
- Cognitive: ${preliminaryScores.cognitive}
- Sensory: ${preliminaryScores.sensory}
- Environmental: ${preliminaryScores.environmental}

${customFactors.length > 0 ? `ADDITIONAL FACTORS NOTED:\n${customFactors.join("\n")}` : ""}

Provide a comprehensive fall risk assessment. Consider:
1. Morse Fall Scale criteria (history of falling, secondary diagnosis, ambulatory aid, IV/heparin lock, gait, mental status)
2. Evidence-based risk factors and their weights
3. Specific, actionable interventions prioritized by urgency
4. Plain language explanation for patient/family (6th grade reading level)

Return ONLY valid JSON:
{
  "overallRiskScore": <0-100>,
  "riskCategory": "low" | "moderate" | "high" | "very_high",
  "morseScaleEstimate": <0-125>,
  "riskFactors": [
    {
      "factor": "Description",
      "category": "age" | "history" | "medication" | "condition" | "mobility" | "cognitive" | "sensory" | "environmental",
      "severity": "low" | "moderate" | "high",
      "weight": <0-1>,
      "evidence": "Clinical evidence or guideline",
      "interventionSuggestion": "Specific intervention"
    }
  ],
  "protectiveFactors": [
    {
      "factor": "Description",
      "impact": "How it reduces risk",
      "category": "Category"
    }
  ],
  "interventions": [
    {
      "intervention": "Specific action",
      "priority": "low" | "medium" | "high" | "urgent",
      "category": "environmental" | "medication" | "therapy" | "equipment" | "education" | "monitoring",
      "timeframe": "When to implement",
      "responsible": "Role responsible",
      "estimatedRiskReduction": <0-1>
    }
  ],
  "precautions": ["List of fall precautions to implement"],
  "confidence": <0-1>,
  "reviewReasons": ["Reasons requiring clinical review"],
  "plainLanguageExplanation": "Simple explanation for patient/family"
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: SONNET_MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("Claude API error", { status: response.status, error: errorText });
    throw new Error(`Claude API error: ${response.status}`);
  }

  const responseData = await response.json();
  const content = responseData.content[0]?.text || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as AIAssessmentResult;

      // Ensure review reasons are populated
      if (!parsed.reviewReasons || parsed.reviewReasons.length === 0) {
        parsed.reviewReasons = ["Standard clinical review required"];
      }

      return parsed;
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  // Fallback response based on preliminary scores
  const avgScore = Object.values(preliminaryScores).reduce((a, b) => a + b, 0) / 8;

  return {
    overallRiskScore: Math.round(avgScore),
    riskCategory: avgScore >= 70 ? "very_high" : avgScore >= 50 ? "high" : avgScore >= 30 ? "moderate" : "low",
    morseScaleEstimate: Math.round(avgScore * 1.25),
    riskFactors: [
      {
        factor: patientData.age && patientData.age >= 65 ? `Age ${patientData.age} years` : "Age assessment needed",
        category: "age",
        severity: patientData.age && patientData.age >= 75 ? "high" : "moderate",
        weight: preliminaryScores.age / 100,
        evidence: "Age ≥65 is a primary fall risk factor",
      },
    ],
    protectiveFactors: [],
    interventions: [
      {
        intervention: "Complete comprehensive fall risk assessment",
        priority: "high",
        category: "monitoring",
        timeframe: "Within 24 hours",
        responsible: "Nursing",
        estimatedRiskReduction: 0.1,
      },
    ],
    precautions: ["Implement fall precautions per protocol", "Ensure call light within reach"],
    confidence: 0.5,
    reviewReasons: ["AI response parsing failed - requires manual review", "Preliminary scoring only"],
    plainLanguageExplanation: `Based on available information, fall risk appears to be ${avgScore >= 50 ? "higher than average" : "moderate"}. A healthcare provider should complete a full assessment.`,
  };
}
