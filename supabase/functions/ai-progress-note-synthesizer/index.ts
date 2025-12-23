/**
 * AI Progress Note Synthesizer Edge Function
 *
 * Synthesizes patient progress notes from multiple check-ins over a time period:
 * - Aggregates vitals trends (HR, BP, SpO2, glucose)
 * - Identifies concerning patterns
 * - Summarizes emotional state changes
 * - Generates clinical-quality progress notes
 *
 * Uses Claude Haiku 4.5 for cost-effective summarization.
 *
 * @module ai-progress-note-synthesizer
 * @skill #21 - Progress Note Synthesizer
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

interface ProgressNoteRequest {
  patientId: string;
  providerId: string;
  periodDays?: number; // 7, 14, 30 days (default: 7)
  noteType?: "routine" | "focused" | "comprehensive";
  focusAreas?: string[]; // Optional: specific areas to focus on
  includeVitals?: boolean;
  includeMood?: boolean;
  includeActivities?: boolean;
}

interface VitalsTrend {
  parameter: string;
  unit: string;
  readings: { date: string; value: number }[];
  average: number | null;
  min: number | null;
  max: number | null;
  trend: "stable" | "improving" | "declining" | "variable" | "insufficient_data";
  concernLevel: "normal" | "monitor" | "concerning" | "critical";
}

interface MoodSummary {
  dominantMood: string | null;
  moodDistribution: Record<string, number>;
  trend: "stable" | "improving" | "declining" | "variable";
  concernLevel: "normal" | "monitor" | "concerning";
}

interface ActivitySummary {
  physicalActivityDays: number;
  socialEngagementDays: number;
  totalCheckIns: number;
  completedCheckIns: number;
  missedCheckIns: number;
  adherenceRate: number;
}

interface ConcernFlag {
  type: "vital" | "mood" | "adherence" | "symptom" | "pattern";
  severity: "low" | "medium" | "high";
  description: string;
  recommendation: string;
}

interface ProgressNoteSummary {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface GeneratedProgressNote {
  noteId: string;
  patientId: string;
  providerId: string;
  periodStart: string;
  periodEnd: string;
  noteType: string;

  // Aggregated data
  vitalsTrends: VitalsTrend[];
  moodSummary: MoodSummary;
  activitySummary: ActivitySummary;
  concernFlags: ConcernFlag[];

  // Generated content
  summary: ProgressNoteSummary;
  keyFindings: string[];
  recommendations: string[];

  // Metadata
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  dataQuality: "excellent" | "good" | "fair" | "poor";
  generatedAt: string;
}

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
  const logger = createLogger("ai-progress-note-synthesizer", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: ProgressNoteRequest = await req.json();
    const {
      patientId,
      providerId,
      periodDays = 7,
      noteType = "routine",
      focusAreas = [],
      includeVitals = true,
      includeMood = true,
      includeActivities = true,
    } = body;

    // Validate required fields
    if (!patientId || !providerId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: patientId, providerId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate period
    const validPeriods = [7, 14, 30, 60, 90];
    const period = validPeriods.includes(periodDays) ? periodDays : 7;

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Log PHI access
    await supabase.from("audit_phi_access").insert({
      user_id: providerId,
      patient_id: patientId,
      access_type: "progress_note_synthesis",
      resource_type: "check_ins",
      access_reason: `AI progress note synthesis for ${period}-day period`,
    });

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - period * 24 * 60 * 60 * 1000);

    // Gather patient context
    const context = await gatherPatientContext(
      supabase,
      patientId,
      startDate,
      endDate,
      { includeVitals, includeMood, includeActivities },
      logger
    );

    // Calculate trends and summaries
    const vitalsTrends = includeVitals ? calculateVitalsTrends(context.vitals) : [];
    const moodSummary = includeMood ? calculateMoodSummary(context.moods) : getEmptyMoodSummary();
    const activitySummary = calculateActivitySummary(context.checkIns, period);

    // Identify concerns
    const concernFlags = identifyConcerns(vitalsTrends, moodSummary, activitySummary);

    // Determine data quality
    const dataQuality = assessDataQuality(context.checkIns.length, period);

    // Generate progress note using AI
    const startTime = Date.now();
    const aiResponse = await generateProgressNote(
      context,
      vitalsTrends,
      moodSummary,
      activitySummary,
      concernFlags,
      noteType,
      focusAreas,
      logger
    );
    const responseTime = Date.now() - startTime;

    // Calculate confidence
    const confidence = calculateConfidence(dataQuality, context.checkIns.length, concernFlags);

    // Determine if review is required
    const reviewReasons: string[] = [];
    if (confidence < 0.7) reviewReasons.push("Low confidence score");
    if (concernFlags.some((c) => c.severity === "high")) reviewReasons.push("High severity concerns identified");
    if (dataQuality === "poor") reviewReasons.push("Insufficient data for reliable synthesis");
    if (vitalsTrends.some((v) => v.concernLevel === "critical")) reviewReasons.push("Critical vital signs detected");

    // Build result
    const noteId = crypto.randomUUID();
    const progressNote: GeneratedProgressNote = {
      noteId,
      patientId,
      providerId,
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      noteType,
      vitalsTrends,
      moodSummary,
      activitySummary,
      concernFlags,
      summary: aiResponse.summary,
      keyFindings: aiResponse.keyFindings,
      recommendations: aiResponse.recommendations,
      confidence,
      requiresReview: true, // ALWAYS require review for clinical notes
      reviewReasons: reviewReasons.length > 0 ? reviewReasons : ["Standard clinical review required"],
      dataQuality,
      generatedAt: new Date().toISOString(),
    };

    // Log usage
    await supabase.from("claude_usage_logs").insert({
      user_id: providerId,
      request_id: noteId,
      model: HAIKU_MODEL,
      request_type: "progress_note_synthesis",
      input_tokens: 500,
      output_tokens: 800,
      cost: (500 / 1_000_000) * 0.8 + (800 / 1_000_000) * 4.0,
      response_time_ms: responseTime,
      success: true,
      metadata: {
        period_days: period,
        note_type: noteType,
        check_in_count: context.checkIns.length,
        data_quality: dataQuality,
      },
    });

    logger.phi("Progress note synthesized", {
      patientId: redact(patientId),
      providerId: redact(providerId),
      periodDays: period,
      checkInCount: context.checkIns.length,
      confidence,
    });

    return new Response(
      JSON.stringify({
        progressNote,
        metadata: {
          generated_at: progressNote.generatedAt,
          response_time_ms: responseTime,
          model: HAIKU_MODEL,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Progress note synthesis failed", { error: error.message });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// Data Gathering
// ============================================================================

interface PatientContext {
  patientInfo: { firstName: string; lastName: string; dateOfBirth?: string };
  checkIns: CheckInRecord[];
  vitals: VitalRecord[];
  moods: MoodRecord[];
  symptoms: string[];
  activities: ActivityRecord[];
  conditions: string[];
  medications: string[];
}

interface CheckInRecord {
  id: string;
  date: string;
  status: string;
  label: string;
  isEmergency: boolean;
  responses?: Record<string, unknown>;
}

interface VitalRecord {
  date: string;
  heartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  pulseOximeter?: number;
  glucoseMgDl?: number;
  weight?: number;
}

interface MoodRecord {
  date: string;
  emotionalState: string;
  wellnessScore?: number;
}

interface ActivityRecord {
  date: string;
  physicalActivity?: string;
  socialEngagement?: string;
  notes?: string;
}

async function gatherPatientContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  startDate: Date,
  endDate: Date,
  options: { includeVitals: boolean; includeMood: boolean; includeActivities: boolean },
  logger: ReturnType<typeof createLogger>
): Promise<PatientContext> {
  const context: PatientContext = {
    patientInfo: { firstName: "Patient", lastName: "" },
    checkIns: [],
    vitals: [],
    moods: [],
    symptoms: [],
    activities: [],
    conditions: [],
    medications: [],
  };

  try {
    // Get patient info
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, date_of_birth")
      .eq("id", patientId)
      .single();

    if (profile) {
      context.patientInfo = {
        firstName: profile.first_name || "Patient",
        lastName: profile.last_name || "",
        dateOfBirth: profile.date_of_birth,
      };
    }

    // Get check-ins from both tables
    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    // Primary check_ins table
    const { data: checkIns1 } = await supabase
      .from("check_ins")
      .select("id, timestamp, label, is_emergency, emotional_state, heart_rate, pulse_oximeter, bp_systolic, bp_diastolic, glucose_mg_dl")
      .eq("user_id", patientId)
      .gte("timestamp", startStr)
      .lte("timestamp", endStr)
      .order("timestamp", { ascending: true });

    if (checkIns1) {
      for (const c of checkIns1) {
        context.checkIns.push({
          id: c.id,
          date: c.timestamp,
          status: "completed",
          label: c.label || "Check-in",
          isEmergency: c.is_emergency || false,
        });

        if (options.includeVitals) {
          context.vitals.push({
            date: c.timestamp,
            heartRate: c.heart_rate || undefined,
            bloodPressureSystolic: c.bp_systolic || undefined,
            bloodPressureDiastolic: c.bp_diastolic || undefined,
            pulseOximeter: c.pulse_oximeter || undefined,
            glucoseMgDl: c.glucose_mg_dl || undefined,
          });
        }

        if (options.includeMood && c.emotional_state) {
          context.moods.push({
            date: c.timestamp,
            emotionalState: c.emotional_state,
          });
        }
      }
    }

    // Secondary patient_daily_check_ins table
    const { data: checkIns2 } = await supabase
      .from("patient_daily_check_ins")
      .select("id, check_in_date, status, responses, concern_flags")
      .eq("patient_id", patientId)
      .gte("check_in_date", startDate.toISOString().split("T")[0])
      .lte("check_in_date", endDate.toISOString().split("T")[0])
      .order("check_in_date", { ascending: true });

    if (checkIns2) {
      for (const c of checkIns2) {
        // Avoid duplicates by checking date
        const existingDates = new Set(context.checkIns.map((x) => x.date.split("T")[0]));
        if (!existingDates.has(c.check_in_date)) {
          context.checkIns.push({
            id: c.id,
            date: c.check_in_date,
            status: c.status || "completed",
            label: "Daily Check-in",
            isEmergency: false,
            responses: c.responses,
          });
        }

        // Extract symptoms from concern flags
        if (c.concern_flags && Array.isArray(c.concern_flags)) {
          context.symptoms.push(...c.concern_flags);
        }

        // Extract wellness score
        if (options.includeMood && c.responses?.feeling) {
          context.moods.push({
            date: c.check_in_date,
            emotionalState: getMoodFromScore(c.responses.feeling as number),
            wellnessScore: c.responses.feeling as number,
          });
        }
      }
    }

    // Get active conditions
    const { data: conditions } = await supabase
      .from("fhir_conditions")
      .select("display, clinical_status")
      .eq("patient_id", patientId)
      .eq("clinical_status", "active")
      .limit(10);

    if (conditions) {
      context.conditions = conditions.map((c) => c.display).filter(Boolean);
    }

    // Get active medications
    const { data: medications } = await supabase
      .from("fhir_medication_statements")
      .select("medication_display, status")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .limit(10);

    if (medications) {
      context.medications = medications.map((m) => m.medication_display).filter(Boolean);
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to gather complete patient context", { error: error.message });
  }

  return context;
}

function getMoodFromScore(score: number): string {
  if (score >= 8) return "Excellent";
  if (score >= 6) return "Good";
  if (score >= 4) return "Fair";
  if (score >= 2) return "Poor";
  return "Very Poor";
}

// ============================================================================
// Trend Calculations
// ============================================================================

function calculateVitalsTrends(vitals: VitalRecord[]): VitalsTrend[] {
  const trends: VitalsTrend[] = [];

  // Heart Rate
  const hrReadings = vitals
    .filter((v) => v.heartRate != null)
    .map((v) => ({ date: v.date, value: v.heartRate! }));
  if (hrReadings.length > 0) {
    trends.push(createVitalTrend("Heart Rate", "bpm", hrReadings, 60, 100));
  }

  // Blood Pressure Systolic
  const bpSysReadings = vitals
    .filter((v) => v.bloodPressureSystolic != null)
    .map((v) => ({ date: v.date, value: v.bloodPressureSystolic! }));
  if (bpSysReadings.length > 0) {
    trends.push(createVitalTrend("Blood Pressure (Systolic)", "mmHg", bpSysReadings, 90, 140));
  }

  // Blood Pressure Diastolic
  const bpDiaReadings = vitals
    .filter((v) => v.bloodPressureDiastolic != null)
    .map((v) => ({ date: v.date, value: v.bloodPressureDiastolic! }));
  if (bpDiaReadings.length > 0) {
    trends.push(createVitalTrend("Blood Pressure (Diastolic)", "mmHg", bpDiaReadings, 60, 90));
  }

  // SpO2
  const spo2Readings = vitals
    .filter((v) => v.pulseOximeter != null)
    .map((v) => ({ date: v.date, value: v.pulseOximeter! }));
  if (spo2Readings.length > 0) {
    trends.push(createVitalTrend("Oxygen Saturation", "%", spo2Readings, 95, 100));
  }

  // Glucose
  const glucoseReadings = vitals
    .filter((v) => v.glucoseMgDl != null)
    .map((v) => ({ date: v.date, value: v.glucoseMgDl! }));
  if (glucoseReadings.length > 0) {
    trends.push(createVitalTrend("Blood Glucose", "mg/dL", glucoseReadings, 70, 140));
  }

  return trends;
}

function createVitalTrend(
  parameter: string,
  unit: string,
  readings: { date: string; value: number }[],
  normalLow: number,
  normalHigh: number
): VitalsTrend {
  if (readings.length === 0) {
    return {
      parameter,
      unit,
      readings: [],
      average: null,
      min: null,
      max: null,
      trend: "insufficient_data",
      concernLevel: "normal",
    };
  }

  const values = readings.map((r) => r.value);
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Calculate trend
  let trend: VitalsTrend["trend"] = "stable";
  if (readings.length >= 3) {
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const change = secondAvg - firstAvg;
    const percentChange = Math.abs(change / firstAvg) * 100;

    if (percentChange > 15) {
      // For vitals, "improving" depends on context
      // Generally, moving toward normal range is improving
      const avgToNormalLow = Math.abs(secondAvg - normalLow);
      const avgToNormalHigh = Math.abs(secondAvg - normalHigh);
      const inNormalRange = secondAvg >= normalLow && secondAvg <= normalHigh;

      if (inNormalRange) {
        trend = "stable";
      } else if (change > 0 && secondAvg > normalHigh) {
        trend = "declining"; // Getting further from normal (high)
      } else if (change < 0 && secondAvg < normalLow) {
        trend = "declining"; // Getting further from normal (low)
      } else {
        trend = "improving"; // Moving toward normal
      }
    }

    // Check for variability
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - average, 2), 0) / values.length);
    if (stdDev / average > 0.2) {
      trend = "variable";
    }
  } else {
    trend = "insufficient_data";
  }

  // Determine concern level
  let concernLevel: VitalsTrend["concernLevel"] = "normal";
  if (average < normalLow * 0.8 || average > normalHigh * 1.3) {
    concernLevel = "critical";
  } else if (average < normalLow * 0.9 || average > normalHigh * 1.15) {
    concernLevel = "concerning";
  } else if (average < normalLow || average > normalHigh) {
    concernLevel = "monitor";
  }

  return {
    parameter,
    unit,
    readings,
    average: Math.round(average * 10) / 10,
    min,
    max,
    trend,
    concernLevel,
  };
}

function calculateMoodSummary(moods: MoodRecord[]): MoodSummary {
  if (moods.length === 0) {
    return getEmptyMoodSummary();
  }

  // Calculate distribution
  const distribution: Record<string, number> = {};
  for (const m of moods) {
    const state = m.emotionalState || "Unknown";
    distribution[state] = (distribution[state] || 0) + 1;
  }

  // Find dominant mood
  let dominantMood: string | null = null;
  let maxCount = 0;
  for (const [mood, count] of Object.entries(distribution)) {
    if (count > maxCount) {
      maxCount = count;
      dominantMood = mood;
    }
  }

  // Calculate trend based on wellness scores
  const scores = moods.filter((m) => m.wellnessScore != null).map((m) => m.wellnessScore!);
  let trend: MoodSummary["trend"] = "stable";
  if (scores.length >= 3) {
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (secondAvg > firstAvg + 1) trend = "improving";
    else if (secondAvg < firstAvg - 1) trend = "declining";
    else trend = "stable";
  }

  // Determine concern level
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;
  let concernLevel: MoodSummary["concernLevel"] = "normal";
  if (avgScore < 3) concernLevel = "concerning";
  else if (avgScore < 5) concernLevel = "monitor";

  return {
    dominantMood,
    moodDistribution: distribution,
    trend,
    concernLevel,
  };
}

function getEmptyMoodSummary(): MoodSummary {
  return {
    dominantMood: null,
    moodDistribution: {},
    trend: "stable",
    concernLevel: "normal",
  };
}

function calculateActivitySummary(checkIns: CheckInRecord[], periodDays: number): ActivitySummary {
  const completed = checkIns.filter((c) => c.status === "completed").length;
  const total = checkIns.length;
  const expectedCheckIns = periodDays; // Assume 1 check-in per day expected

  return {
    physicalActivityDays: 0, // Would need activity data
    socialEngagementDays: 0, // Would need activity data
    totalCheckIns: total,
    completedCheckIns: completed,
    missedCheckIns: Math.max(0, expectedCheckIns - total),
    adherenceRate: expectedCheckIns > 0 ? Math.round((total / expectedCheckIns) * 100) : 0,
  };
}

// ============================================================================
// Concern Identification
// ============================================================================

function identifyConcerns(
  vitalsTrends: VitalsTrend[],
  moodSummary: MoodSummary,
  activitySummary: ActivitySummary
): ConcernFlag[] {
  const concerns: ConcernFlag[] = [];

  // Vital concerns
  for (const trend of vitalsTrends) {
    if (trend.concernLevel === "critical") {
      concerns.push({
        type: "vital",
        severity: "high",
        description: `${trend.parameter} is critically out of range (avg: ${trend.average} ${trend.unit})`,
        recommendation: "Immediate clinical review recommended",
      });
    } else if (trend.concernLevel === "concerning") {
      concerns.push({
        type: "vital",
        severity: "medium",
        description: `${trend.parameter} showing concerning values (avg: ${trend.average} ${trend.unit})`,
        recommendation: "Schedule follow-up assessment",
      });
    } else if (trend.trend === "declining") {
      concerns.push({
        type: "pattern",
        severity: "medium",
        description: `${trend.parameter} showing declining trend`,
        recommendation: "Monitor closely over next week",
      });
    }
  }

  // Mood concerns
  if (moodSummary.concernLevel === "concerning") {
    concerns.push({
      type: "mood",
      severity: "medium",
      description: "Patient reporting consistently low wellness scores",
      recommendation: "Consider behavioral health screening or support services",
    });
  } else if (moodSummary.trend === "declining") {
    concerns.push({
      type: "mood",
      severity: "low",
      description: "Mood/wellness scores showing downward trend",
      recommendation: "Discuss emotional wellbeing at next visit",
    });
  }

  // Adherence concerns
  if (activitySummary.adherenceRate < 50) {
    concerns.push({
      type: "adherence",
      severity: "medium",
      description: `Low check-in adherence (${activitySummary.adherenceRate}%)`,
      recommendation: "Assess barriers to daily monitoring compliance",
    });
  } else if (activitySummary.adherenceRate < 70) {
    concerns.push({
      type: "adherence",
      severity: "low",
      description: `Moderate check-in adherence (${activitySummary.adherenceRate}%)`,
      recommendation: "Encourage consistent daily check-ins",
    });
  }

  return concerns;
}

// ============================================================================
// Data Quality Assessment
// ============================================================================

function assessDataQuality(checkInCount: number, periodDays: number): "excellent" | "good" | "fair" | "poor" {
  const adherence = checkInCount / periodDays;
  if (adherence >= 0.9) return "excellent";
  if (adherence >= 0.7) return "good";
  if (adherence >= 0.4) return "fair";
  return "poor";
}

function calculateConfidence(
  dataQuality: string,
  checkInCount: number,
  concerns: ConcernFlag[]
): number {
  let confidence = 0.7; // Base confidence

  // Adjust for data quality
  if (dataQuality === "excellent") confidence += 0.2;
  else if (dataQuality === "good") confidence += 0.1;
  else if (dataQuality === "fair") confidence -= 0.1;
  else confidence -= 0.2;

  // Adjust for data volume
  if (checkInCount >= 10) confidence += 0.05;
  else if (checkInCount < 3) confidence -= 0.1;

  // Adjust for concern complexity
  if (concerns.filter((c) => c.severity === "high").length > 2) {
    confidence -= 0.1; // Complex cases need human review
  }

  return Math.max(0.3, Math.min(0.95, confidence));
}

// ============================================================================
// AI Generation
// ============================================================================

interface AIProgressNoteResponse {
  summary: ProgressNoteSummary;
  keyFindings: string[];
  recommendations: string[];
}

async function generateProgressNote(
  context: PatientContext,
  vitalsTrends: VitalsTrend[],
  moodSummary: MoodSummary,
  activitySummary: ActivitySummary,
  concerns: ConcernFlag[],
  noteType: string,
  focusAreas: string[],
  logger: ReturnType<typeof createLogger>
): Promise<AIProgressNoteResponse> {
  const vitalsText = vitalsTrends
    .map((v) => `${v.parameter}: avg ${v.average} ${v.unit} (${v.trend}, ${v.concernLevel})`)
    .join("\n");

  const concernsText = concerns
    .map((c) => `[${c.severity.toUpperCase()}] ${c.description}`)
    .join("\n");

  const prompt = `Generate a clinical progress note synthesizing patient check-in data.

PATIENT: ${context.patientInfo.firstName} ${context.patientInfo.lastName}
NOTE TYPE: ${noteType}
PERIOD: ${activitySummary.totalCheckIns} check-ins over monitoring period
${focusAreas.length > 0 ? `FOCUS AREAS: ${focusAreas.join(", ")}` : ""}

ACTIVE CONDITIONS:
${context.conditions.join(", ") || "None documented"}

CURRENT MEDICATIONS:
${context.medications.join(", ") || "None documented"}

VITALS SUMMARY:
${vitalsText || "No vital signs recorded"}

MOOD/WELLNESS:
Dominant mood: ${moodSummary.dominantMood || "Not assessed"}
Trend: ${moodSummary.trend}
Concern level: ${moodSummary.concernLevel}

ADHERENCE:
Check-in adherence: ${activitySummary.adherenceRate}%
Completed: ${activitySummary.completedCheckIns}/${activitySummary.totalCheckIns}

IDENTIFIED CONCERNS:
${concernsText || "No significant concerns identified"}

REPORTED SYMPTOMS:
${context.symptoms.slice(0, 10).join(", ") || "None reported"}

Generate a comprehensive progress note. Include:
1. SOAP-format summary (Subjective, Objective, Assessment, Plan)
2. Key findings (3-5 bullet points)
3. Recommendations (2-4 actionable items)

Be concise, clinical, and factual. Do not include information not present in the data.
Focus on trends and patterns across the monitoring period.

Return ONLY valid JSON:
{
  "summary": {
    "subjective": "Patient-reported symptoms and concerns...",
    "objective": "Vital signs trends, adherence data...",
    "assessment": "Clinical assessment of patient status...",
    "plan": "Recommended next steps..."
  },
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

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
      return JSON.parse(jsonMatch[0]) as AIProgressNoteResponse;
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  // Fallback response
  return {
    summary: {
      subjective: `Patient completed ${activitySummary.completedCheckIns} check-ins during the monitoring period. ${moodSummary.dominantMood ? `Overall mood reported as ${moodSummary.dominantMood}.` : "Mood not consistently reported."}`,
      objective: vitalsTrends.length > 0
        ? `Vital signs: ${vitalsTrends.map((v) => `${v.parameter} avg ${v.average} ${v.unit}`).join("; ")}`
        : "Limited vital sign data available for this period.",
      assessment: concerns.length > 0
        ? `${concerns.length} concern(s) identified requiring attention.`
        : "Patient appears stable based on available data.",
      plan: "Continue current monitoring. Review at next scheduled appointment.",
    },
    keyFindings: [
      `Check-in adherence: ${activitySummary.adherenceRate}%`,
      ...(concerns.length > 0 ? [`${concerns.length} concern flag(s) identified`] : ["No significant concerns"]),
    ],
    recommendations: [
      "Continue daily monitoring",
      "Review findings at next appointment",
    ],
  };
}
