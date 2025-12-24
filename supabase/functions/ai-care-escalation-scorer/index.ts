/**
 * AI Care Escalation Scorer Edge Function
 *
 * Provides confidence-level escalation scoring for patient care decisions.
 * Analyzes clinical indicators, trends, and risk factors to determine
 * when care should be escalated and with what level of urgency.
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy.
 *
 * @module ai-care-escalation-scorer
 * @skill #32 - Care Escalation Scorer
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

interface EscalationRequest {
  patientId: string;
  assessorId: string;
  context: "shift_handoff" | "routine_assessment" | "condition_change" | "urgent_review";
  triggerReason?: string;
}

interface VitalSign {
  code: string;
  value: number;
  unit: string;
  timestamp: string;
  isAbnormal: boolean;
}

interface ClinicalIndicator {
  indicator: string;
  category: "vital_signs" | "labs" | "symptoms" | "functional_status" | "behavioral";
  currentValue: string;
  trend: "improving" | "stable" | "worsening" | "critical";
  weight: number;
  concernLevel: "low" | "moderate" | "high" | "critical";
}

interface EscalationFactor {
  factor: string;
  category: string;
  severity: "low" | "moderate" | "high" | "critical";
  evidence: string;
  weight: number;
}

interface EscalationRecommendation {
  action: string;
  urgency: "routine" | "soon" | "urgent" | "immediate";
  responsible: string;
  timeframe: string;
  rationale: string;
}

interface EscalationScore {
  assessmentId: string;
  patientId: string;
  assessorId: string;
  assessmentDate: string;
  context: string;

  // Scores
  overallEscalationScore: number; // 0-100
  confidenceLevel: number; // 0-1
  escalationCategory: "none" | "monitor" | "notify" | "escalate" | "emergency";
  urgencyLevel: "routine" | "elevated" | "urgent" | "critical";

  // Clinical indicators
  clinicalIndicators: ClinicalIndicator[];
  escalationFactors: EscalationFactor[];
  protectiveFactors: string[];

  // Trend analysis
  overallTrend: "improving" | "stable" | "declining" | "rapidly_declining";
  trendConfidence: number;
  hoursToReassess: number;

  // Recommendations
  recommendations: EscalationRecommendation[];
  requiredNotifications: string[];
  documentationRequired: string[];

  // Safety
  requiresPhysicianReview: boolean;
  requiresRapidResponse: boolean;
  reviewReasons: string[];

  // Summary
  clinicalSummary: string;
  handoffPriority: "low" | "medium" | "high" | "critical";
}

interface PatientContext {
  patientId: string;
  patientName: string;
  age?: number;
  admissionDate?: string;
  primaryDiagnosis?: string;
  comorbidities: string[];
  currentMedications: string[];
  recentVitals: VitalSign[];
  recentLabs: Array<{ test: string; value: string; abnormal: boolean; date: string }>;
  activeAlerts: Array<{ type: string; severity: string; message: string }>;
  carePlanPriority?: string;
  codeStatus?: string;
  fallRisk?: string;
  isolationStatus?: string;
}

// PHI Redaction
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  const logger = createLogger("ai-care-escalation-scorer", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: EscalationRequest = await req.json();
    const { patientId, assessorId, context, triggerReason } = body;

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

    // Generate escalation score
    const escalationScore = await analyzeAndScore(
      patientContext,
      assessorId,
      context || "routine_assessment",
      triggerReason,
      logger
    );

    const responseTime = Date.now() - startTime;

    // Store assessment
    await storeAssessment(supabase, escalationScore, logger);

    // Log usage
    await supabase.from("claude_usage_logs").insert({
      user_id: assessorId,
      request_id: escalationScore.assessmentId,
      model: SONNET_MODEL,
      request_type: "care_escalation_scoring",
      input_tokens: 800,
      output_tokens: 600,
      cost: (800 / 1_000_000) * 3.0 + (600 / 1_000_000) * 15.0,
      response_time_ms: responseTime,
      success: true,
    });

    logger.info("Care escalation scored", {
      patientId: redact(patientId),
      escalationCategory: escalationScore.escalationCategory,
      overallScore: escalationScore.overallEscalationScore,
      confidence: escalationScore.confidenceLevel,
    });

    return new Response(
      JSON.stringify({
        assessment: escalationScore,
        metadata: {
          generated_at: new Date().toISOString(),
          response_time_ms: responseTime,
          model: SONNET_MODEL,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Care escalation scoring failed", { error: error.message });

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
    patientName: "Patient",
    comorbidities: [],
    currentMedications: [],
    recentVitals: [],
    recentLabs: [],
    activeAlerts: [],
  };

  try {
    // Get patient profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, date_of_birth")
      .eq("id", patientId)
      .single();

    if (profile) {
      context.patientName = profile.first_name || "Patient";
      if (profile.date_of_birth) {
        const age = Math.floor(
          (Date.now() - new Date(profile.date_of_birth).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000)
        );
        context.age = age;
      }
    }

    // Get recent vitals (last 24 hours)
    const { data: observations } = await supabase
      .from("fhir_observations")
      .select("code, value, unit, effective_date_time")
      .eq("patient_id", patientId)
      .gte("effective_date_time", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("effective_date_time", { ascending: false })
      .limit(50);

    if (observations) {
      context.recentVitals = observations.map((obs) => ({
        code: obs.code as string,
        value: parseFloat(obs.value as string) || 0,
        unit: (obs.unit as string) || "",
        timestamp: obs.effective_date_time as string,
        isAbnormal: isVitalAbnormal(obs.code as string, parseFloat(obs.value as string)),
      }));
    }

    // Get active alerts
    const { data: alerts } = await supabase
      .from("care_coordination_alerts")
      .select("alert_type, severity, title")
      .eq("patient_id", patientId)
      .in("status", ["active", "acknowledged"])
      .limit(10);

    if (alerts) {
      context.activeAlerts = alerts.map((a) => ({
        type: a.alert_type as string,
        severity: a.severity as string,
        message: a.title as string,
      }));
    }

    // Get care plan info
    const { data: carePlan } = await supabase
      .from("care_coordination_plans")
      .select("priority, goals, conditions")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(1)
      .single();

    if (carePlan) {
      context.carePlanPriority = carePlan.priority as string;
      if (Array.isArray(carePlan.conditions)) {
        context.comorbidities = carePlan.conditions.slice(0, 10) as string[];
      }
    }

    // Get current medications
    const { data: meds } = await supabase
      .from("patient_medications")
      .select("medication_name")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(20);

    if (meds) {
      context.currentMedications = meds.map((m) => m.medication_name as string);
    }

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather full patient context", { error: error.message });
  }

  return context;
}

function isVitalAbnormal(code: string, value: number): boolean {
  const normalRanges: Record<string, { min: number; max: number }> = {
    HR: { min: 60, max: 100 },
    BP_SYS: { min: 90, max: 140 },
    BP_DIA: { min: 60, max: 90 },
    TEMP: { min: 97.0, max: 99.5 },
    RR: { min: 12, max: 20 },
    SPO2: { min: 92, max: 100 },
  };

  const range = normalRanges[code];
  if (!range) return false;
  return value < range.min || value > range.max;
}

// ============================================================================
// AI Analysis
// ============================================================================

async function analyzeAndScore(
  patientContext: PatientContext,
  assessorId: string,
  context: string,
  triggerReason: string | undefined,
  logger: ReturnType<typeof createLogger>
): Promise<EscalationScore> {
  const assessmentId = crypto.randomUUID();

  // First, apply rule-based scoring
  const ruleBasedScore = calculateRuleBasedScore(patientContext);

  // If clear-cut case, use rule-based only
  if (ruleBasedScore.confidence > 0.9 && ruleBasedScore.escalationCategory === "none") {
    return buildAssessment(assessmentId, patientContext, assessorId, context, ruleBasedScore);
  }

  // Use AI for nuanced analysis
  try {
    const prompt = buildAnalysisPrompt(patientContext, context, triggerReason, ruleBasedScore);

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

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return buildAssessmentFromAI(assessmentId, patientContext, assessorId, context, parsed);
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("AI analysis failed, using rule-based fallback", { error: error.message });
  }

  return buildAssessment(assessmentId, patientContext, assessorId, context, ruleBasedScore);
}

interface RuleBasedResult {
  score: number;
  confidence: number;
  escalationCategory: "none" | "monitor" | "notify" | "escalate" | "emergency";
  factors: EscalationFactor[];
  indicators: ClinicalIndicator[];
}

function calculateRuleBasedScore(context: PatientContext): RuleBasedResult {
  let score = 0;
  const factors: EscalationFactor[] = [];
  const indicators: ClinicalIndicator[] = [];

  // Analyze vitals
  const abnormalVitals = context.recentVitals.filter((v) => v.isAbnormal);
  if (abnormalVitals.length > 0) {
    const vitalScore = Math.min(abnormalVitals.length * 15, 45);
    score += vitalScore;
    factors.push({
      factor: `${abnormalVitals.length} abnormal vital sign(s)`,
      category: "vital_signs",
      severity: abnormalVitals.length >= 3 ? "critical" : abnormalVitals.length >= 2 ? "high" : "moderate",
      evidence: abnormalVitals.map((v) => `${v.code}: ${v.value}`).join(", "),
      weight: vitalScore,
    });
  }

  // Check for critical vitals
  const criticalVitals = context.recentVitals.filter((v) => {
    if (v.code === "SPO2" && v.value < 88) return true;
    if (v.code === "BP_SYS" && (v.value > 180 || v.value < 80)) return true;
    if (v.code === "HR" && (v.value > 150 || v.value < 40)) return true;
    return false;
  });

  if (criticalVitals.length > 0) {
    score += 30;
    factors.push({
      factor: "Critical vital sign values detected",
      category: "vital_signs",
      severity: "critical",
      evidence: criticalVitals.map((v) => `${v.code}: ${v.value}`).join(", "),
      weight: 30,
    });
  }

  // Active alerts
  const criticalAlerts = context.activeAlerts.filter((a) => a.severity === "critical");
  const highAlerts = context.activeAlerts.filter((a) => a.severity === "high");

  if (criticalAlerts.length > 0) {
    score += 25;
    factors.push({
      factor: `${criticalAlerts.length} critical alert(s) active`,
      category: "alerts",
      severity: "critical",
      evidence: criticalAlerts.map((a) => a.message).join("; "),
      weight: 25,
    });
  }

  if (highAlerts.length > 0) {
    score += highAlerts.length * 10;
    factors.push({
      factor: `${highAlerts.length} high-severity alert(s) active`,
      category: "alerts",
      severity: "high",
      evidence: highAlerts.map((a) => a.message).join("; "),
      weight: highAlerts.length * 10,
    });
  }

  // Age factor
  if (context.age && context.age >= 80) {
    score += 10;
    factors.push({
      factor: "Advanced age (80+)",
      category: "demographics",
      severity: "moderate",
      evidence: `Patient age: ${context.age}`,
      weight: 10,
    });
  }

  // Comorbidities
  const highRiskConditions = ["heart failure", "copd", "ckd", "sepsis", "stroke"];
  const hasHighRisk = context.comorbidities.some((c) =>
    highRiskConditions.some((hr) => c.toLowerCase().includes(hr))
  );
  if (hasHighRisk) {
    score += 15;
    factors.push({
      factor: "High-risk comorbidity present",
      category: "medical_history",
      severity: "high",
      evidence: context.comorbidities.filter((c) =>
        highRiskConditions.some((hr) => c.toLowerCase().includes(hr))
      ).join(", "),
      weight: 15,
    });
  }

  // Determine category
  let escalationCategory: "none" | "monitor" | "notify" | "escalate" | "emergency";
  if (score >= 80) {
    escalationCategory = "emergency";
  } else if (score >= 60) {
    escalationCategory = "escalate";
  } else if (score >= 40) {
    escalationCategory = "notify";
  } else if (score >= 20) {
    escalationCategory = "monitor";
  } else {
    escalationCategory = "none";
  }

  // Confidence based on data completeness
  let confidence = 0.7;
  if (context.recentVitals.length > 5) confidence += 0.1;
  if (context.comorbidities.length > 0) confidence += 0.1;
  if (context.currentMedications.length > 0) confidence += 0.1;

  return {
    score: Math.min(score, 100),
    confidence: Math.min(confidence, 1.0),
    escalationCategory,
    factors,
    indicators,
  };
}

function buildAnalysisPrompt(
  context: PatientContext,
  assessmentContext: string,
  triggerReason: string | undefined,
  ruleBasedScore: RuleBasedResult
): string {
  return `You are a clinical decision support system analyzing patient data to determine care escalation needs.

PATIENT CONTEXT:
- Age: ${context.age || "Unknown"}
- Comorbidities: ${context.comorbidities.join(", ") || "None documented"}
- Current Medications: ${context.currentMedications.length} active medications
- Care Plan Priority: ${context.carePlanPriority || "Standard"}

ASSESSMENT CONTEXT: ${assessmentContext}
${triggerReason ? `TRIGGER REASON: ${triggerReason}` : ""}

RECENT VITALS (Last 24h):
${context.recentVitals.slice(0, 10).map((v) => `- ${v.code}: ${v.value} ${v.unit} ${v.isAbnormal ? "[ABNORMAL]" : ""}`).join("\n") || "No recent vitals"}

ACTIVE ALERTS:
${context.activeAlerts.map((a) => `- [${a.severity.toUpperCase()}] ${a.message}`).join("\n") || "No active alerts"}

RULE-BASED PRELIMINARY SCORE: ${ruleBasedScore.score}/100 (${ruleBasedScore.escalationCategory})

Analyze this patient's clinical status and provide a comprehensive escalation assessment.

Consider:
1. Vital sign trends and abnormalities
2. Interaction between comorbidities and current status
3. Clinical trajectory (improving, stable, declining)
4. Appropriateness of current care level
5. Need for physician notification or intervention

Return JSON:
{
  "overallEscalationScore": 0-100,
  "confidenceLevel": 0.0-1.0,
  "escalationCategory": "none|monitor|notify|escalate|emergency",
  "urgencyLevel": "routine|elevated|urgent|critical",
  "clinicalIndicators": [
    {
      "indicator": "description",
      "category": "vital_signs|labs|symptoms|functional_status|behavioral",
      "currentValue": "value",
      "trend": "improving|stable|worsening|critical",
      "weight": 0-30,
      "concernLevel": "low|moderate|high|critical"
    }
  ],
  "overallTrend": "improving|stable|declining|rapidly_declining",
  "trendConfidence": 0.0-1.0,
  "hoursToReassess": 1-24,
  "recommendations": [
    {
      "action": "specific action",
      "urgency": "routine|soon|urgent|immediate",
      "responsible": "role",
      "timeframe": "timeframe",
      "rationale": "clinical reasoning"
    }
  ],
  "requiredNotifications": ["list of who needs to be notified"],
  "documentationRequired": ["what needs to be documented"],
  "requiresPhysicianReview": true/false,
  "requiresRapidResponse": true/false,
  "reviewReasons": ["reasons if review required"],
  "clinicalSummary": "2-3 sentence clinical summary",
  "handoffPriority": "low|medium|high|critical"
}

Return ONLY the JSON.`;
}

function buildAssessment(
  assessmentId: string,
  context: PatientContext,
  assessorId: string,
  assessmentContext: string,
  ruleBasedScore: RuleBasedResult
): EscalationScore {
  const urgencyLevel = ruleBasedScore.escalationCategory === "emergency"
    ? "critical"
    : ruleBasedScore.escalationCategory === "escalate"
    ? "urgent"
    : ruleBasedScore.escalationCategory === "notify"
    ? "elevated"
    : "routine";

  const recommendations: EscalationRecommendation[] = [];

  if (ruleBasedScore.escalationCategory === "emergency") {
    recommendations.push({
      action: "Activate rapid response team",
      urgency: "immediate",
      responsible: "Charge Nurse",
      timeframe: "Immediately",
      rationale: "Critical escalation score requires immediate intervention",
    });
  } else if (ruleBasedScore.escalationCategory === "escalate") {
    recommendations.push({
      action: "Notify attending physician",
      urgency: "urgent",
      responsible: "Primary Nurse",
      timeframe: "Within 30 minutes",
      rationale: "High escalation score requires physician awareness",
    });
  } else if (ruleBasedScore.escalationCategory === "notify") {
    recommendations.push({
      action: "Increase monitoring frequency",
      urgency: "soon",
      responsible: "Primary Nurse",
      timeframe: "Within 1 hour",
      rationale: "Moderate concerns warrant closer observation",
    });
  }

  return {
    assessmentId,
    patientId: context.patientId,
    assessorId,
    assessmentDate: new Date().toISOString(),
    context: assessmentContext,
    overallEscalationScore: ruleBasedScore.score,
    confidenceLevel: ruleBasedScore.confidence,
    escalationCategory: ruleBasedScore.escalationCategory,
    urgencyLevel,
    clinicalIndicators: ruleBasedScore.indicators,
    escalationFactors: ruleBasedScore.factors,
    protectiveFactors: [],
    overallTrend: "stable",
    trendConfidence: 0.7,
    hoursToReassess: ruleBasedScore.escalationCategory === "emergency" ? 1 : ruleBasedScore.escalationCategory === "escalate" ? 2 : 4,
    recommendations,
    requiredNotifications: ruleBasedScore.escalationCategory === "emergency"
      ? ["Physician", "Charge Nurse", "Rapid Response Team"]
      : ruleBasedScore.escalationCategory === "escalate"
      ? ["Physician", "Charge Nurse"]
      : [],
    documentationRequired: ["Vital signs", "Assessment findings", "Interventions"],
    requiresPhysicianReview: ruleBasedScore.escalationCategory === "escalate" || ruleBasedScore.escalationCategory === "emergency",
    requiresRapidResponse: ruleBasedScore.escalationCategory === "emergency",
    reviewReasons: ruleBasedScore.factors.filter((f) => f.severity === "critical").map((f) => f.factor),
    clinicalSummary: `Patient assessment completed with escalation score of ${ruleBasedScore.score}/100. ${ruleBasedScore.factors.length} escalation factor(s) identified.`,
    handoffPriority: ruleBasedScore.escalationCategory === "emergency"
      ? "critical"
      : ruleBasedScore.escalationCategory === "escalate"
      ? "high"
      : ruleBasedScore.escalationCategory === "notify"
      ? "medium"
      : "low",
  };
}

function buildAssessmentFromAI(
  assessmentId: string,
  context: PatientContext,
  assessorId: string,
  assessmentContext: string,
  aiResponse: Record<string, unknown>
): EscalationScore {
  return {
    assessmentId,
    patientId: context.patientId,
    assessorId,
    assessmentDate: new Date().toISOString(),
    context: assessmentContext,
    overallEscalationScore: (aiResponse.overallEscalationScore as number) || 0,
    confidenceLevel: (aiResponse.confidenceLevel as number) || 0.7,
    escalationCategory: (aiResponse.escalationCategory as EscalationScore["escalationCategory"]) || "none",
    urgencyLevel: (aiResponse.urgencyLevel as EscalationScore["urgencyLevel"]) || "routine",
    clinicalIndicators: (aiResponse.clinicalIndicators as ClinicalIndicator[]) || [],
    escalationFactors: [],
    protectiveFactors: [],
    overallTrend: (aiResponse.overallTrend as EscalationScore["overallTrend"]) || "stable",
    trendConfidence: (aiResponse.trendConfidence as number) || 0.7,
    hoursToReassess: (aiResponse.hoursToReassess as number) || 4,
    recommendations: (aiResponse.recommendations as EscalationRecommendation[]) || [],
    requiredNotifications: (aiResponse.requiredNotifications as string[]) || [],
    documentationRequired: (aiResponse.documentationRequired as string[]) || [],
    requiresPhysicianReview: (aiResponse.requiresPhysicianReview as boolean) || false,
    requiresRapidResponse: (aiResponse.requiresRapidResponse as boolean) || false,
    reviewReasons: (aiResponse.reviewReasons as string[]) || [],
    clinicalSummary: (aiResponse.clinicalSummary as string) || "Assessment completed.",
    handoffPriority: (aiResponse.handoffPriority as EscalationScore["handoffPriority"]) || "low",
  };
}

// ============================================================================
// Storage
// ============================================================================

async function storeAssessment(
  supabase: ReturnType<typeof createClient>,
  assessment: EscalationScore,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    await supabase.from("ai_risk_assessments").insert({
      patient_id: assessment.patientId,
      risk_category: "care_escalation",
      risk_level: assessment.escalationCategory,
      risk_score: assessment.overallEscalationScore,
      confidence: assessment.confidenceLevel,
      risk_factors: assessment.escalationFactors,
      protective_factors: assessment.protectiveFactors,
      recommendations: assessment.recommendations,
      requires_review: assessment.requiresPhysicianReview,
      review_reasons: assessment.reviewReasons,
      summary: assessment.clinicalSummary,
      model_used: SONNET_MODEL,
      assessed_at: assessment.assessmentDate,
    });

    logger.info("Care escalation assessment stored", {
      assessmentId: assessment.assessmentId,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to store assessment", { error: error.message });
  }
}
