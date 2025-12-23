/**
 * AI Caregiver Briefing Generator Edge Function
 *
 * Generates personalized briefings for family caregivers about their loved one:
 * - Recent check-in summaries
 * - Health trend highlights
 * - Care plan progress
 * - Upcoming appointments
 *
 * Uses Claude Haiku 4.5 for cost-effective generation.
 *
 * @module ai-caregiver-briefing
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const HAIKU_MODEL = "claude-haiku-4-5-20250919";

interface BriefingRequest {
  patientId: string;
  caregiverId: string;
  caregiverName?: string;
  briefingType?: "daily" | "weekly" | "urgent";
  language?: string;
}

interface CaregiverBriefing {
  greeting: string;
  summary: string;
  health_highlights: string[];
  check_in_summary: {
    total: number;
    completed: number;
    average_wellness: number | null;
    concerns: string[];
  };
  care_plan_progress: string;
  upcoming_items: string[];
  action_items: string[];
  encouragement: string;
}

// PHI Redaction
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

serve(async (req) => {
  const logger = createLogger("ai-caregiver-briefing", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: BriefingRequest = await req.json();
    const {
      patientId,
      caregiverId,
      caregiverName = "Caregiver",
      briefingType = "daily",
      language = "English",
    } = body;

    if (!patientId || !caregiverId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: patientId, caregiverId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Gather patient context (de-identified for caregiver view)
    const context = await gatherCaregiverContext(supabase, patientId, briefingType, logger);

    // Generate briefing
    const startTime = Date.now();
    const briefing = await generateBriefing(context, caregiverName, briefingType, language, logger);
    const responseTime = Date.now() - startTime;

    // Log usage
    await supabase.from("claude_usage_logs").insert({
      user_id: caregiverId,
      request_id: crypto.randomUUID(),
      model: HAIKU_MODEL,
      request_type: "caregiver_briefing",
      input_tokens: 400,
      output_tokens: 600,
      cost: (400 / 1_000_000) * 0.8 + (600 / 1_000_000) * 4.0,
      response_time_ms: responseTime,
      success: true,
    });

    // Log PHI access for audit
    logger.phi("Caregiver briefing generated", {
      patientId: redact(patientId),
      caregiverId: redact(caregiverId),
      briefingType,
    });

    return new Response(
      JSON.stringify({
        briefing,
        metadata: {
          generated_at: new Date().toISOString(),
          briefing_type: briefingType,
          language,
          response_time_ms: responseTime,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Caregiver briefing generation failed", { error: error.message });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface CaregiverContext {
  patientFirstName: string;
  recentCheckIns: { date: string; status: string; wellness?: number; concerns: string[] }[];
  averageWellness: number | null;
  carePlanGoals: string[];
  carePlanProgress: string;
  upcomingAppointments: { date: string; type: string }[];
  alerts: { type: string; message: string }[];
}

async function gatherCaregiverContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  briefingType: string,
  logger: ReturnType<typeof createLogger>
): Promise<CaregiverContext> {
  const context: CaregiverContext = {
    patientFirstName: "Your loved one",
    recentCheckIns: [],
    averageWellness: null,
    carePlanGoals: [],
    carePlanProgress: "No active care plan",
    upcomingAppointments: [],
    alerts: [],
  };

  try {
    // Get patient first name only (no PHI beyond that)
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("id", patientId)
      .single();

    if (profile?.first_name) {
      context.patientFirstName = profile.first_name;
    }

    // Get recent check-ins
    const daysBack = briefingType === "weekly" ? 7 : 1;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    const { data: checkIns } = await supabase
      .from("patient_daily_check_ins")
      .select("check_in_date, status, responses, concern_flags")
      .eq("patient_id", patientId)
      .gte("check_in_date", startDate)
      .order("check_in_date", { ascending: false });

    if (checkIns) {
      context.recentCheckIns = checkIns.map((c) => ({
        date: c.check_in_date,
        status: c.status,
        wellness: c.responses?.feeling as number | undefined,
        concerns: c.concern_flags || [],
      }));

      // Calculate average wellness
      const wellnessScores = checkIns
        .filter((c) => c.responses?.feeling)
        .map((c) => c.responses.feeling as number);
      if (wellnessScores.length > 0) {
        context.averageWellness = wellnessScores.reduce((a, b) => a + b, 0) / wellnessScores.length;
      }
    }

    // Get care plan info
    const { data: carePlan } = await supabase
      .from("care_coordination_plans")
      .select("goals, status, care_plan_type")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(1)
      .single();

    if (carePlan) {
      context.carePlanGoals = Array.isArray(carePlan.goals) ? carePlan.goals.slice(0, 3) : [];
      context.carePlanProgress = `Active ${carePlan.care_plan_type || "care"} plan`;
    }

    // Get upcoming appointments (next 7 days)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: appointments } = await supabase
      .from("patient_appointments")
      .select("appointment_date, appointment_type")
      .eq("patient_id", patientId)
      .gte("appointment_date", new Date().toISOString())
      .lte("appointment_date", nextWeek)
      .order("appointment_date", { ascending: true })
      .limit(3);

    if (appointments) {
      context.upcomingAppointments = appointments.map((a) => ({
        date: a.appointment_date,
        type: a.appointment_type || "Appointment",
      }));
    }

    // Get active alerts
    const { data: alerts } = await supabase
      .from("care_coordination_alerts")
      .select("alert_type, title")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(3);

    if (alerts) {
      context.alerts = alerts.map((a) => ({
        type: a.alert_type,
        message: a.title,
      }));
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather full context", { error: error.message });
  }

  return context;
}

async function generateBriefing(
  context: CaregiverContext,
  caregiverName: string,
  briefingType: string,
  language: string,
  logger: ReturnType<typeof createLogger>
): Promise<CaregiverBriefing> {
  const checkInSummary = context.recentCheckIns.length > 0
    ? `${context.recentCheckIns.filter((c) => c.status === "completed").length} of ${context.recentCheckIns.length} check-ins completed`
    : "No recent check-ins";

  const prompt = `Generate a caring, supportive caregiver briefing in ${language}.

CAREGIVER: ${caregiverName}
PATIENT: ${context.patientFirstName}
BRIEFING TYPE: ${briefingType}

RECENT CHECK-INS:
${checkInSummary}
Average wellness score: ${context.averageWellness?.toFixed(1) || "N/A"}/10

CARE PLAN:
${context.carePlanProgress}
Goals: ${context.carePlanGoals.join(", ") || "None specified"}

UPCOMING:
${context.upcomingAppointments.map((a) => `- ${a.type} on ${a.date}`).join("\n") || "No upcoming appointments"}

ALERTS:
${context.alerts.map((a) => `- ${a.message}`).join("\n") || "No active alerts"}

Generate a warm, supportive briefing. Be empathetic and encouraging.
Do NOT include specific medical details or PHI.
Focus on general wellness and encouragement.

Return JSON:
{
  "greeting": "Personalized greeting",
  "summary": "2-3 sentence wellness summary",
  "health_highlights": ["2-3 positive highlights or neutral updates"],
  "check_in_summary": {
    "total": ${context.recentCheckIns.length},
    "completed": ${context.recentCheckIns.filter((c) => c.status === "completed").length},
    "average_wellness": ${context.averageWellness || "null"},
    "concerns": ["Any concerns mentioned, or empty array"]
  },
  "care_plan_progress": "Brief progress note",
  "upcoming_items": ["List of upcoming items"],
  "action_items": ["1-2 things caregiver can do to help"],
  "encouragement": "Warm closing message"
}

Return ONLY the JSON.`;

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
      return JSON.parse(jsonMatch[0]) as CaregiverBriefing;
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  // Fallback briefing
  return {
    greeting: `Hello ${caregiverName},`,
    summary: `Here's an update about ${context.patientFirstName}'s recent activity.`,
    health_highlights: [
      `${context.recentCheckIns.filter((c) => c.status === "completed").length} check-ins completed`,
    ],
    check_in_summary: {
      total: context.recentCheckIns.length,
      completed: context.recentCheckIns.filter((c) => c.status === "completed").length,
      average_wellness: context.averageWellness,
      concerns: [],
    },
    care_plan_progress: context.carePlanProgress,
    upcoming_items: context.upcomingAppointments.map((a) => `${a.type} on ${a.date}`),
    action_items: ["Continue to offer your support"],
    encouragement: "Thank you for being a caring family member.",
  };
}
