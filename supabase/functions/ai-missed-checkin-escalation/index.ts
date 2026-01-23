/**
 * AI Missed Check-In Escalation Edge Function
 *
 * Analyzes missed check-ins and determines appropriate escalation level:
 * - Evaluates patient history, risk factors, and patterns
 * - Generates personalized escalation reasoning using AI
 * - Notifies family/caregivers with appropriate urgency
 * - Creates audit trail for compliance
 *
 * Uses Claude Haiku 4.5 for cost-effective analysis.
 *
 * @module ai-missed-checkin-escalation
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const HAIKU_MODEL = "claude-haiku-4-5-20250919";

// ============================================================================
// Types
// ============================================================================

interface EscalationRequest {
  patientId: string;
  checkInId?: string;
  triggerType: "single_missed" | "consecutive_missed" | "scheduled_check";
  consecutiveMissedCount?: number;
}

interface EscalationContext {
  patientName: string;
  patientAge?: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  consecutiveMissed: number;
  lastCheckInDate: string | null;
  lastCheckInStatus: string | null;
  lastWellnessScore: number | null;
  activeConditions: string[];
  recentAlerts: string[];
  caregivers: { id: string; name: string; relationship: string; phone?: string }[];
  carePlanPriority: string | null;
  livingAlone: boolean;
  hasEmergencyContact: boolean;
  /** Tenant license type: 0=Both, 8=Clinical Only, 9=WellFit Only */
  tenantLicenseType: "0" | "8" | "9" | null;
  /** Whether welfare checks are appropriate for this tenant type */
  welfareCheckEligible: boolean;
}

interface EscalationResult {
  escalationLevel: "none" | "low" | "medium" | "high" | "emergency";
  reasoning: string;
  recommendedActions: string[];
  /** Step 1: Notify the WellFit tenant organization first */
  notifyTenant: boolean;
  /** Step 2: Then notify caregiver */
  notifyCaregiver: boolean;
  /** Step 3: Notify emergency contact */
  notifyEmergencyContact: boolean;
  /** Step 4 (Last resort): Request welfare check - only for WellFit/law enforcement tenants */
  callForWelfareCheck: boolean;
  message: {
    subject: string;
    body: string;
    urgency: string;
  };
  riskFactors: string[];
  protectiveFactors: string[];
}

// Type for caregiver relationship with joined profile data
interface CaregiverRelationshipWithProfile {
  caregiver_id: string;
  relationship: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
}

// PHI Redaction for logging
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  const logger = createLogger("ai-missed-checkin-escalation", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: EscalationRequest = await req.json();
    const {
      patientId,
      checkInId,
      triggerType = "single_missed",
      consecutiveMissedCount = 1,
    } = body;

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

    // Gather patient context for escalation analysis
    const context = await gatherEscalationContext(
      supabase,
      patientId,
      consecutiveMissedCount,
      logger
    );

    // Determine if escalation is needed based on rules + AI analysis
    const startTime = Date.now();
    const escalation = await analyzeAndEscalate(context, triggerType, logger);
    const responseTime = Date.now() - startTime;

    // Execute escalation actions
    if (escalation.escalationLevel !== "none") {
      await executeEscalation(supabase, patientId, checkInId, context, escalation, logger);
    }

    // Log usage
    await supabase.from("claude_usage_logs").insert({
      user_id: patientId,
      request_id: crypto.randomUUID(),
      model: HAIKU_MODEL,
      request_type: "missed_checkin_escalation",
      input_tokens: 500,
      output_tokens: 400,
      cost: (500 / 1_000_000) * 0.8 + (400 / 1_000_000) * 4.0,
      response_time_ms: responseTime,
      success: true,
    });

    // Log for compliance
    logger.info("Missed check-in escalation analyzed", {
      patientId: redact(patientId),
      triggerType,
      consecutiveMissed: context.consecutiveMissed,
      escalationLevel: escalation.escalationLevel,
      notifyCaregiver: escalation.notifyCaregiver,
    });

    return new Response(
      JSON.stringify({
        escalation,
        context: {
          riskLevel: context.riskLevel,
          consecutiveMissed: context.consecutiveMissed,
          hasCaregiver: context.caregivers.length > 0,
          welfareCheckEligible: context.welfareCheckEligible,
          tenantLicenseType: context.tenantLicenseType,
        },
        metadata: {
          processed_at: new Date().toISOString(),
          trigger_type: triggerType,
          response_time_ms: responseTime,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Missed check-in escalation failed", { error: error.message });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// Context Gathering
// ============================================================================

async function gatherEscalationContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  consecutiveMissedCount: number,
  logger: ReturnType<typeof createLogger>
): Promise<EscalationContext> {
  const context: EscalationContext = {
    patientName: "Patient",
    riskLevel: "medium",
    consecutiveMissed: consecutiveMissedCount,
    lastCheckInDate: null,
    lastCheckInStatus: null,
    lastWellnessScore: null,
    activeConditions: [],
    recentAlerts: [],
    caregivers: [],
    carePlanPriority: null,
    livingAlone: false,
    hasEmergencyContact: false,
    tenantLicenseType: null,
    welfareCheckEligible: false, // Default: not eligible until we verify tenant type
  };

  try {
    // Get patient profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, date_of_birth, emergency_contact_name, emergency_contact_phone, lives_alone")
      .eq("id", patientId)
      .single();

    if (profile) {
      context.patientName = profile.first_name || "Patient";
      context.livingAlone = profile.lives_alone === true;
      context.hasEmergencyContact = !!profile.emergency_contact_phone;

      if (profile.date_of_birth) {
        const birthDate = new Date(profile.date_of_birth);
        const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        context.patientAge = age;
      }
    }

    // Get tenant information to determine welfare check eligibility
    // Tenant code format: {ORG}-{LICENSE}{SEQUENCE}
    // License digit: 0 = Both products, 8 = Envision Atlus Only (clinical), 9 = WellFit Only
    // Welfare checks are ONLY appropriate for WellFit tenants (0 or 9), NOT clinical-only (8)
    const { data: membership } = await supabase
      .from("user_tenants")
      .select("tenant_id, tenants!inner(tenant_code)")
      .eq("user_id", patientId)
      .limit(1)
      .single();

    if (membership?.tenants) {
      const tenantCode = (membership.tenants as { tenant_code: string }).tenant_code || "";
      // Extract license digit (first digit after the dash)
      const licenseMatch = tenantCode.match(/-([089])/);
      if (licenseMatch) {
        const licenseDigit = licenseMatch[1] as "0" | "8" | "9";
        context.tenantLicenseType = licenseDigit;
        // Welfare checks are eligible for WellFit tenants (0 = Both, 9 = WellFit Only)
        // NOT for clinical-only tenants (8 = Envision Atlus Only)
        context.welfareCheckEligible = licenseDigit === "0" || licenseDigit === "9";
      }
    }

    // Get recent check-ins to determine patterns
    const { data: checkIns } = await supabase
      .from("patient_daily_check_ins")
      .select("check_in_date, status, responses, concern_flags")
      .eq("patient_id", patientId)
      .order("check_in_date", { ascending: false })
      .limit(14);

    if (checkIns && checkIns.length > 0) {
      const lastCompleted = checkIns.find((c) => c.status === "completed");
      if (lastCompleted) {
        context.lastCheckInDate = lastCompleted.check_in_date;
        context.lastCheckInStatus = lastCompleted.status;
        context.lastWellnessScore = lastCompleted.responses?.feeling as number | null;
      }

      // Count actual consecutive missed
      let missed = 0;
      for (const checkIn of checkIns) {
        if (checkIn.status === "missed" || checkIn.status === "pending") {
          missed++;
        } else {
          break;
        }
      }
      context.consecutiveMissed = Math.max(consecutiveMissedCount, missed);
    }

    // Get active care plan and priority
    const { data: carePlan } = await supabase
      .from("care_coordination_plans")
      .select("priority, goals, conditions")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(1)
      .single();

    if (carePlan) {
      context.carePlanPriority = carePlan.priority;
      if (Array.isArray(carePlan.conditions)) {
        context.activeConditions = carePlan.conditions.slice(0, 5);
      }
    }

    // Get recent alerts
    const { data: alerts } = await supabase
      .from("care_coordination_alerts")
      .select("alert_type, title, severity")
      .eq("patient_id", patientId)
      .in("status", ["active", "acknowledged"])
      .order("created_at", { ascending: false })
      .limit(5);

    if (alerts) {
      context.recentAlerts = alerts.map((a) => `${a.severity}: ${a.title}`);
    }

    // Get caregivers
    const { data: caregivers } = await supabase
      .from("caregiver_relationships")
      .select("caregiver_id, relationship, profiles!caregiver_relationships_caregiver_id_fkey(first_name, last_name, phone)")
      .eq("patient_id", patientId)
      .eq("is_active", true);

    if (caregivers) {
      context.caregivers = (caregivers as CaregiverRelationshipWithProfile[]).map((c) => ({
        id: c.caregiver_id,
        name: `${c.profiles?.first_name || ""} ${c.profiles?.last_name || ""}`.trim(),
        relationship: c.relationship,
        phone: c.profiles?.phone ?? undefined,
      }));
    }

    // Determine risk level
    context.riskLevel = determineRiskLevel(context);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather full escalation context", { error: error.message });
  }

  return context;
}

function determineRiskLevel(context: EscalationContext): "low" | "medium" | "high" | "critical" {
  let riskScore = 0;

  // Age factor
  if (context.patientAge && context.patientAge >= 80) riskScore += 3;
  else if (context.patientAge && context.patientAge >= 70) riskScore += 2;
  else if (context.patientAge && context.patientAge >= 65) riskScore += 1;

  // Living situation
  if (context.livingAlone) riskScore += 2;

  // Consecutive missed check-ins
  if (context.consecutiveMissed >= 3) riskScore += 3;
  else if (context.consecutiveMissed >= 2) riskScore += 2;
  else if (context.consecutiveMissed >= 1) riskScore += 1;

  // Care plan priority
  if (context.carePlanPriority === "critical") riskScore += 3;
  else if (context.carePlanPriority === "high") riskScore += 2;

  // Recent alerts
  if (context.recentAlerts.some((a) => a.includes("critical"))) riskScore += 2;
  if (context.recentAlerts.some((a) => a.includes("high"))) riskScore += 1;

  // Last wellness score
  if (context.lastWellnessScore !== null && context.lastWellnessScore <= 3) riskScore += 2;
  else if (context.lastWellnessScore !== null && context.lastWellnessScore <= 5) riskScore += 1;

  // Active conditions
  const highRiskConditions = ["heart failure", "copd", "diabetes", "fall risk", "dementia"];
  const hasHighRiskCondition = context.activeConditions.some((c) =>
    highRiskConditions.some((hr) => c.toLowerCase().includes(hr))
  );
  if (hasHighRiskCondition) riskScore += 2;

  // Determine level
  if (riskScore >= 8) return "critical";
  if (riskScore >= 5) return "high";
  if (riskScore >= 3) return "medium";
  return "low";
}

// ============================================================================
// AI Analysis
// ============================================================================

async function analyzeAndEscalate(
  context: EscalationContext,
  triggerType: string,
  logger: ReturnType<typeof createLogger>
): Promise<EscalationResult> {
  // Rule-based escalation for clear cases
  if (context.riskLevel === "critical" && context.consecutiveMissed >= 2) {
    return buildEmergencyEscalation(context);
  }

  if (context.consecutiveMissed >= 5) {
    return buildEmergencyEscalation(context);
  }

  // For single missed with low risk, no escalation needed
  if (context.consecutiveMissed === 1 && context.riskLevel === "low") {
    return {
      escalationLevel: "none",
      reasoning: "Single missed check-in with low risk patient. No escalation needed at this time.",
      recommendedActions: ["Continue monitoring", "Send reminder for next check-in"],
      notifyTenant: false,
      notifyCaregiver: false,
      notifyEmergencyContact: false,
      callForWelfareCheck: false,
      message: { subject: "", body: "", urgency: "none" },
      riskFactors: [],
      protectiveFactors: context.hasEmergencyContact ? ["Has emergency contact on file"] : [],
    };
  }

  // Use AI for nuanced analysis
  const prompt = buildAnalysisPrompt(context, triggerType);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 1024,
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
        const parsed = JSON.parse(jsonMatch[0]) as EscalationResult;
        return validateEscalation(parsed, context);
      }
    } catch (parseErr: unknown) {
      const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
      logger.warn("Failed to parse AI escalation response", { error: error.message });
    }
  } catch (aiErr: unknown) {
    const error = aiErr instanceof Error ? aiErr : new Error(String(aiErr));
    logger.warn("AI analysis failed, using rule-based fallback", { error: error.message });
  }

  // Fallback to rule-based
  return buildRuleBasedEscalation(context);
}

function buildAnalysisPrompt(context: EscalationContext, triggerType: string): string {
  const welfareCheckNote = context.welfareCheckEligible
    ? "Welfare checks ARE available for this WellFit/community tenant."
    : "Welfare checks are NOT available for this clinical-only tenant. Use clinical escalation instead.";

  return `You are a healthcare escalation analyst. Analyze this missed check-in situation and determine appropriate escalation.

PATIENT CONTEXT:
- Name: ${context.patientName}
- Age: ${context.patientAge || "Unknown"}
- Risk Level: ${context.riskLevel}
- Living Alone: ${context.livingAlone ? "Yes" : "No"}
- Has Emergency Contact: ${context.hasEmergencyContact ? "Yes" : "No"}
- Has Caregiver: ${context.caregivers.length > 0 ? "Yes" : "No"}

CHECK-IN STATUS:
- Trigger: ${triggerType}
- Consecutive Missed: ${context.consecutiveMissed}
- Last Check-In: ${context.lastCheckInDate || "Never"}
- Last Wellness Score: ${context.lastWellnessScore || "N/A"}/10

HEALTH CONTEXT:
- Active Conditions: ${context.activeConditions.join(", ") || "None documented"}
- Care Plan Priority: ${context.carePlanPriority || "Standard"}
- Recent Alerts: ${context.recentAlerts.join("; ") || "None"}

TENANT CONTEXT:
- Tenant Type: ${context.tenantLicenseType === "8" ? "Clinical Only (Envision Atlus)" : context.tenantLicenseType === "9" ? "WellFit Only (Community)" : "Both Products"}
- ${welfareCheckNote}

ESCALATION FLOW (in order):
1. Notify tenant organization FIRST
2. Then notify caregiver
3. Then notify emergency contact (for high/critical)
4. Welfare check is LAST RESORT (only if WellFit/community tenant)

Determine the appropriate escalation response. Consider:
1. Patient safety as the top priority
2. Avoid over-escalation for low-risk situations
3. Balance between caregiver notification and privacy
4. Tenant notification should always come FIRST
5. Only recommend welfare check if this is a WellFit/community tenant (welfareCheckEligible: ${context.welfareCheckEligible})

Return JSON:
{
  "escalationLevel": "none|low|medium|high|emergency",
  "reasoning": "2-3 sentence clinical reasoning for this decision",
  "recommendedActions": ["List of specific actions in escalation order"],
  "notifyTenant": true/false,
  "notifyCaregiver": true/false,
  "notifyEmergencyContact": true/false,
  "callForWelfareCheck": true/false (ONLY if welfareCheckEligible is true),
  "message": {
    "subject": "Message subject for tenant/caregiver notification",
    "body": "Caring, non-alarming message body (2-3 sentences)",
    "urgency": "routine|important|urgent|emergency"
  },
  "riskFactors": ["List of identified risk factors"],
  "protectiveFactors": ["List of protective factors"]
}

Return ONLY the JSON.`;
}

function validateEscalation(escalation: EscalationResult, context: EscalationContext): EscalationResult {
  // Ensure high-risk patients get appropriate escalation
  if (context.riskLevel === "critical" && escalation.escalationLevel === "none") {
    escalation.escalationLevel = "medium";
    escalation.notifyTenant = true;
    escalation.notifyCaregiver = true;
    escalation.recommendedActions.push("Review escalation - critical patient marked as no escalation");
  }

  // Cap escalation for low-risk single missed
  if (context.consecutiveMissed === 1 && context.riskLevel === "low" && escalation.escalationLevel === "emergency") {
    escalation.escalationLevel = "low";
    escalation.callForWelfareCheck = false;
    escalation.notifyEmergencyContact = false;
  }

  // CRITICAL: Never allow welfare check for clinical-only tenants (license type 8)
  // Welfare checks are ONLY for WellFit/law enforcement tenants (license 0 or 9)
  if (!context.welfareCheckEligible && escalation.callForWelfareCheck) {
    escalation.callForWelfareCheck = false;
    escalation.recommendedActions = escalation.recommendedActions.filter(
      (a) => !a.toLowerCase().includes("welfare check")
    );
    escalation.recommendedActions.push("Escalate to clinical care team for follow-up (welfare check not available for clinical tenants)");
  }

  // Ensure notifyTenant is set for any escalation
  if (escalation.escalationLevel !== "none" && !escalation.notifyTenant) {
    escalation.notifyTenant = true;
  }

  return escalation;
}

function buildEmergencyEscalation(context: EscalationContext): EscalationResult {
  // Escalation flow: 1) Tenant, 2) Caregiver, 3) Emergency Contact, 4) Welfare Check (last resort, WellFit only)
  const welfareCheckAllowed = context.welfareCheckEligible && context.consecutiveMissed >= 3;

  const actions = [
    "Step 1: Notify tenant organization immediately",
    "Step 2: Attempt immediate phone contact",
    "Step 3: Notify caregiver and emergency contact",
  ];

  if (welfareCheckAllowed) {
    actions.push("Step 4 (Last resort): Request welfare check if no response within 1 hour");
  } else if (context.tenantLicenseType === "8") {
    actions.push("Step 4: Escalate to clinical care team for follow-up");
  }

  return {
    escalationLevel: "emergency",
    reasoning: `${context.consecutiveMissed} consecutive missed check-ins with ${context.riskLevel} risk level requires immediate attention. Patient ${context.livingAlone ? "lives alone" : "may need urgent contact"}.`,
    recommendedActions: actions,
    notifyTenant: true, // Always notify tenant first
    notifyCaregiver: true,
    notifyEmergencyContact: true,
    // Welfare check is ONLY for WellFit/law enforcement tenants (license 0 or 9), NOT clinical-only (8)
    callForWelfareCheck: welfareCheckAllowed,
    message: {
      subject: `Urgent: Unable to reach ${context.patientName}`,
      body: `We've been unable to reach ${context.patientName} for ${context.consecutiveMissed} consecutive check-ins. Please contact them or let us know if they are okay.`,
      urgency: "emergency",
    },
    riskFactors: [
      `${context.consecutiveMissed} consecutive missed check-ins`,
      context.livingAlone ? "Lives alone" : "",
      context.riskLevel === "critical" ? "Critical care plan priority" : "",
    ].filter(Boolean),
    protectiveFactors: context.hasEmergencyContact ? ["Emergency contact on file"] : [],
  };
}

function buildRuleBasedEscalation(context: EscalationContext): EscalationResult {
  let level: "none" | "low" | "medium" | "high" | "emergency" = "none";
  let notifyTenant = false;
  let notifyCaregiver = false;
  let notifyEmergencyContact = false;
  let callForWelfareCheck = false;

  // Escalation flow: 1) Tenant first, 2) Caregiver, 3) Emergency Contact, 4) Welfare Check (last resort)
  if (context.consecutiveMissed >= 3) {
    level = "high";
    notifyTenant = true; // Always notify tenant organization first
    notifyCaregiver = true;
    notifyEmergencyContact = context.riskLevel === "high" || context.riskLevel === "critical";
    // Welfare check is ONLY for WellFit/law enforcement tenants, NOT clinical-only
    callForWelfareCheck = context.welfareCheckEligible && context.livingAlone && context.riskLevel !== "low";
  } else if (context.consecutiveMissed >= 2) {
    level = "medium";
    notifyTenant = true; // Notify tenant first
    notifyCaregiver = context.riskLevel !== "low";
  } else if (context.riskLevel === "high" || context.riskLevel === "critical") {
    level = "medium";
    notifyTenant = true; // Notify tenant first
    notifyCaregiver = true;
  } else {
    level = "low";
    notifyTenant = true; // Even for low, notify tenant first
  }

  const actions: string[] = ["Step 1: Notify tenant organization"];
  if (notifyCaregiver) actions.push("Step 2: Notify caregiver");
  if (notifyEmergencyContact) actions.push("Step 3: Contact emergency contact");
  if (callForWelfareCheck) {
    actions.push("Step 4 (Last resort): Request welfare check if no response");
  } else if (level !== "none" && level !== "low") {
    actions.push("Review patient history and attempt phone contact");
  }

  return {
    escalationLevel: level,
    reasoning: `${context.consecutiveMissed} missed check-in(s) with ${context.riskLevel} risk level. Standard escalation protocol applied.`,
    recommendedActions: level === "none" ? ["Monitor for next check-in"] : actions,
    notifyTenant,
    notifyCaregiver,
    notifyEmergencyContact,
    callForWelfareCheck,
    message: {
      subject: level === "high" || level === "emergency"
        ? `Important: Check-in needed for ${context.patientName}`
        : `Update about ${context.patientName}`,
      body: `${context.patientName} has missed ${context.consecutiveMissed} check-in(s). If you are in contact with them, please let us know they are okay.`,
      urgency: level === "emergency" ? "emergency" : level === "high" ? "urgent" : "routine",
    },
    riskFactors: [`${context.consecutiveMissed} missed check-ins`],
    protectiveFactors: context.caregivers.length > 0 ? ["Active caregiver involvement"] : [],
  };
}

// ============================================================================
// Escalation Execution
// ============================================================================

async function executeEscalation(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  checkInId: string | undefined,
  context: EscalationContext,
  escalation: EscalationResult,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    // Update check-in status to escalated
    if (checkInId) {
      await supabase
        .from("patient_daily_check_ins")
        .update({
          status: "escalated",
          escalation_level: escalation.escalationLevel,
          escalation_reasoning: escalation.reasoning,
          escalated_at: new Date().toISOString(),
        })
        .eq("id", checkInId);
    }

    // Create care coordination alert
    await supabase.from("care_coordination_alerts").insert({
      patient_id: patientId,
      alert_type: "missed_check_in_escalation",
      severity: escalation.escalationLevel === "emergency" ? "critical" : escalation.escalationLevel,
      priority: escalation.escalationLevel === "emergency" ? "emergency" : "urgent",
      title: `Missed Check-In: ${context.patientName}`,
      description: escalation.reasoning,
      alert_data: {
        consecutive_missed: context.consecutiveMissed,
        risk_level: context.riskLevel,
        escalation_level: escalation.escalationLevel,
        risk_factors: escalation.riskFactors,
        recommended_actions: escalation.recommendedActions,
        welfare_check_eligible: context.welfareCheckEligible,
        tenant_license_type: context.tenantLicenseType,
      },
      status: "active",
    });

    // STEP 1: Notify tenant organization FIRST (always before caregiver)
    if (escalation.notifyTenant) {
      // Get tenant admins to notify
      const { data: tenantAdmins } = await supabase
        .from("user_tenants")
        .select("user_id, tenants!inner(tenant_code, name)")
        .eq("role", "admin")
        .limit(5);

      if (tenantAdmins && tenantAdmins.length > 0) {
        for (const admin of tenantAdmins) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: `[Tenant Alert] ${escalation.message.subject}`,
            message: `${escalation.message.body}\n\nEscalation Level: ${escalation.escalationLevel.toUpperCase()}\nRecommended Actions: ${escalation.recommendedActions.join(", ")}`,
            type: "missed_check_in_tenant_alert",
            severity: escalation.message.urgency,
            metadata: {
              patient_id: patientId,
              escalation_level: escalation.escalationLevel,
              consecutive_missed: context.consecutiveMissed,
              tenant_code: (admin.tenants as { tenant_code: string })?.tenant_code,
              welfare_check_recommended: escalation.callForWelfareCheck,
              escalation_step: "tenant_notification",
            },
          });
        }

        logger.info("Tenant organization notified of missed check-in", {
          tenantAdminCount: tenantAdmins.length,
          escalationLevel: escalation.escalationLevel,
        });
      }
    }

    // STEP 2: Notify caregivers (after tenant)
    if (escalation.notifyCaregiver && context.caregivers.length > 0) {
      for (const caregiver of context.caregivers) {
        await supabase.from("notifications").insert({
          user_id: caregiver.id,
          title: escalation.message.subject,
          message: escalation.message.body,
          type: "missed_check_in_alert",
          severity: escalation.message.urgency,
          metadata: {
            patient_id: patientId,
            escalation_level: escalation.escalationLevel,
            consecutive_missed: context.consecutiveMissed,
          },
        });

        logger.info("Caregiver notified of missed check-in", {
          caregiverId: redact(caregiver.id),
          escalationLevel: escalation.escalationLevel,
        });
      }
    }

    // Log the escalation for audit
    await supabase.from("security_events").insert({
      event_type: "missed_checkin_escalation",
      severity: escalation.escalationLevel === "emergency" ? "critical" : "warning",
      description: `Missed check-in escalation: ${escalation.escalationLevel}`,
      metadata: {
        patient_id: patientId,
        check_in_id: checkInId,
        consecutive_missed: context.consecutiveMissed,
        escalation_level: escalation.escalationLevel,
        // Escalation flow tracking
        notify_tenant: escalation.notifyTenant,
        notify_caregiver: escalation.notifyCaregiver,
        notify_emergency_contact: escalation.notifyEmergencyContact,
        welfare_check_recommended: escalation.callForWelfareCheck,
        // Welfare check eligibility info
        welfare_check_eligible: context.welfareCheckEligible,
        tenant_license_type: context.tenantLicenseType,
      },
      created_at: new Date().toISOString(),
    });

    logger.info("Escalation executed", {
      patientId: redact(patientId),
      escalationLevel: escalation.escalationLevel,
      actionsCount: escalation.recommendedActions.length,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Failed to execute escalation", { error: error.message });
    throw error;
  }
}
