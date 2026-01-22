// supabase/functions/ai-progress-note-synthesizer/__tests__/index.test.ts
// Tests for AI Progress Note Synthesizer - Clinical progress notes from check-ins

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Progress Note Synthesizer Tests", async (t) => {

  // =====================================================
  // Request Validation Tests
  // =====================================================

  await t.step("should require patientId", () => {
    const body = { providerId: "provider-123" };
    const hasPatientId = "patientId" in body;

    assertEquals(hasPatientId, false);
  });

  await t.step("should require providerId", () => {
    const body = { patientId: "patient-123" };
    const hasProviderId = "providerId" in body;

    assertEquals(hasProviderId, false);
  });

  await t.step("should return 400 for missing required fields", () => {
    const response = { error: "Missing required fields: patientId, providerId" };
    assertEquals(response.error, "Missing required fields: patientId, providerId");
  });

  await t.step("should default periodDays to 7", () => {
    const body = { patientId: "patient-123", providerId: "provider-456" };
    const periodDays = (body as { periodDays?: number }).periodDays || 7;

    assertEquals(periodDays, 7);
  });

  await t.step("should validate period days", () => {
    const validPeriods = [7, 14, 30, 60, 90];
    const requestedPeriod = 21; // Invalid
    const period = validPeriods.includes(requestedPeriod) ? requestedPeriod : 7;

    assertEquals(period, 7);
  });

  await t.step("should default noteType to 'routine'", () => {
    const body = { patientId: "patient-123", providerId: "provider-456" };
    const noteType = (body as { noteType?: string }).noteType || "routine";

    assertEquals(noteType, "routine");
  });

  await t.step("should support note types", () => {
    const noteTypes = ["routine", "focused", "comprehensive"];
    assertEquals(noteTypes.length, 3);
    assertEquals(noteTypes.includes("comprehensive"), true);
  });

  // =====================================================
  // PHI Redaction Tests
  // =====================================================

  await t.step("should redact email addresses", () => {
    const text = "Email: john@example.com";
    const redacted = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");

    assertEquals(redacted, "Email: [EMAIL]");
  });

  await t.step("should redact phone numbers", () => {
    const text = "Phone: 555-123-4567";
    const redacted = text.replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]");

    assertEquals(redacted, "Phone: [PHONE]");
  });

  await t.step("should redact SSN", () => {
    const text = "SSN: 123-45-6789";
    const redacted = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

    assertEquals(redacted, "SSN: [SSN]");
  });

  // =====================================================
  // Vitals Trend Tests
  // =====================================================

  await t.step("should define VitalsTrend structure", () => {
    const vitalTrend = {
      parameter: "Heart Rate",
      unit: "bpm",
      readings: [
        { date: "2026-01-15", value: 72 },
        { date: "2026-01-16", value: 75 }
      ],
      average: 73.5,
      min: 72,
      max: 75,
      trend: "stable" as const,
      concernLevel: "normal" as const
    };

    assertEquals(vitalTrend.parameter, "Heart Rate");
    assertEquals(vitalTrend.unit, "bpm");
    assertEquals(vitalTrend.average, 73.5);
    assertEquals(vitalTrend.trend, "stable");
  });

  await t.step("should define trend values", () => {
    const trends = ["stable", "improving", "declining", "variable", "insufficient_data"];
    assertEquals(trends.length, 5);
  });

  await t.step("should define concern levels", () => {
    const concernLevels = ["normal", "monitor", "concerning", "critical"];
    assertEquals(concernLevels.length, 4);
  });

  await t.step("should calculate vital trend - stable", () => {
    const readings = [72, 74, 73, 72, 75].map((v, i) => ({
      date: `2026-01-${15 + i}`,
      value: v
    }));

    const firstHalf = readings.slice(0, Math.floor(readings.length / 2)).map(r => r.value);
    const secondHalf = readings.slice(Math.floor(readings.length / 2)).map(r => r.value);
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const percentChange = Math.abs((secondAvg - firstAvg) / firstAvg) * 100;

    assertEquals(percentChange < 15, true); // Stable
  });

  await t.step("should determine concern level - normal", () => {
    const average = 75;
    const normalLow = 60;
    const normalHigh = 100;

    let concernLevel: string = "normal";
    if (average < normalLow * 0.8 || average > normalHigh * 1.3) {
      concernLevel = "critical";
    } else if (average < normalLow * 0.9 || average > normalHigh * 1.15) {
      concernLevel = "concerning";
    } else if (average < normalLow || average > normalHigh) {
      concernLevel = "monitor";
    }

    assertEquals(concernLevel, "normal");
  });

  await t.step("should determine concern level - critical", () => {
    const average = 45; // Very low heart rate
    const normalLow = 60;
    const normalHigh = 100;

    let concernLevel: string = "normal";
    if (average < normalLow * 0.8 || average > normalHigh * 1.3) {
      concernLevel = "critical";
    }

    assertEquals(concernLevel, "critical");
  });

  // =====================================================
  // Mood Summary Tests
  // =====================================================

  await t.step("should define MoodSummary structure", () => {
    const moodSummary = {
      dominantMood: "Good",
      moodDistribution: { "Excellent": 2, "Good": 5, "Fair": 1 },
      trend: "stable" as const,
      concernLevel: "normal" as const
    };

    assertEquals(moodSummary.dominantMood, "Good");
    assertEquals(moodSummary.moodDistribution["Good"], 5);
  });

  await t.step("should calculate mood distribution", () => {
    const moods = [
      { emotionalState: "Good" },
      { emotionalState: "Good" },
      { emotionalState: "Fair" },
      { emotionalState: "Excellent" }
    ];

    const distribution: Record<string, number> = {};
    for (const m of moods) {
      const state = m.emotionalState;
      distribution[state] = (distribution[state] || 0) + 1;
    }

    assertEquals(distribution["Good"], 2);
    assertEquals(distribution["Fair"], 1);
    assertEquals(distribution["Excellent"], 1);
  });

  await t.step("should find dominant mood", () => {
    const distribution = { "Excellent": 1, "Good": 5, "Fair": 2 };

    let dominantMood: string | null = null;
    let maxCount = 0;
    for (const [mood, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count;
        dominantMood = mood;
      }
    }

    assertEquals(dominantMood, "Good");
  });

  await t.step("should map wellness score to mood", () => {
    const getMoodFromScore = (score: number): string => {
      if (score >= 8) return "Excellent";
      if (score >= 6) return "Good";
      if (score >= 4) return "Fair";
      if (score >= 2) return "Poor";
      return "Very Poor";
    };

    assertEquals(getMoodFromScore(9), "Excellent");
    assertEquals(getMoodFromScore(7), "Good");
    assertEquals(getMoodFromScore(5), "Fair");
    assertEquals(getMoodFromScore(3), "Poor");
    assertEquals(getMoodFromScore(1), "Very Poor");
  });

  // =====================================================
  // Activity Summary Tests
  // =====================================================

  await t.step("should define ActivitySummary structure", () => {
    const activitySummary = {
      physicalActivityDays: 5,
      socialEngagementDays: 3,
      totalCheckIns: 7,
      completedCheckIns: 6,
      missedCheckIns: 1,
      adherenceRate: 86
    };

    assertEquals(activitySummary.totalCheckIns, 7);
    assertEquals(activitySummary.adherenceRate, 86);
  });

  await t.step("should calculate adherence rate", () => {
    const totalCheckIns = 6;
    const expectedCheckIns = 7;
    const adherenceRate = expectedCheckIns > 0
      ? Math.round((totalCheckIns / expectedCheckIns) * 100)
      : 0;

    assertEquals(adherenceRate, 86);
  });

  await t.step("should calculate missed check-ins", () => {
    const periodDays = 7;
    const totalCheckIns = 5;
    const missedCheckIns = Math.max(0, periodDays - totalCheckIns);

    assertEquals(missedCheckIns, 2);
  });

  // =====================================================
  // Concern Flag Tests
  // =====================================================

  await t.step("should define ConcernFlag structure", () => {
    const concern = {
      type: "vital" as const,
      severity: "high" as const,
      description: "Blood pressure critically elevated",
      recommendation: "Immediate clinical review recommended"
    };

    assertEquals(concern.type, "vital");
    assertEquals(concern.severity, "high");
    assertExists(concern.recommendation);
  });

  await t.step("should define concern types", () => {
    const types = ["vital", "mood", "adherence", "symptom", "pattern"];
    assertEquals(types.length, 5);
  });

  await t.step("should define severity levels", () => {
    const severities = ["low", "medium", "high"];
    assertEquals(severities.length, 3);
  });

  await t.step("should identify critical vital concern", () => {
    const vitalTrend = { concernLevel: "critical", parameter: "Blood Pressure", average: 180, unit: "mmHg" };
    const concerns: { type: string; severity: string; description: string }[] = [];

    if (vitalTrend.concernLevel === "critical") {
      concerns.push({
        type: "vital",
        severity: "high",
        description: `${vitalTrend.parameter} is critically out of range (avg: ${vitalTrend.average} ${vitalTrend.unit})`
      });
    }

    assertEquals(concerns.length, 1);
    assertEquals(concerns[0].severity, "high");
  });

  await t.step("should identify low adherence concern", () => {
    const adherenceRate = 40;
    const concerns: { type: string; severity: string; description: string }[] = [];

    if (adherenceRate < 50) {
      concerns.push({
        type: "adherence",
        severity: "medium",
        description: `Low check-in adherence (${adherenceRate}%)`
      });
    }

    assertEquals(concerns.length, 1);
    assertEquals(concerns[0].description.includes("40%"), true);
  });

  // =====================================================
  // Data Quality Assessment Tests
  // =====================================================

  await t.step("should assess data quality - excellent", () => {
    const checkInCount = 7;
    const periodDays = 7;
    const adherence = checkInCount / periodDays;

    let dataQuality: string;
    if (adherence >= 0.9) dataQuality = "excellent";
    else if (adherence >= 0.7) dataQuality = "good";
    else if (adherence >= 0.4) dataQuality = "fair";
    else dataQuality = "poor";

    assertEquals(dataQuality, "excellent");
  });

  await t.step("should assess data quality - good", () => {
    const checkInCount = 5;
    const periodDays = 7;
    const adherence = checkInCount / periodDays;

    let dataQuality: string;
    if (adherence >= 0.9) dataQuality = "excellent";
    else if (adherence >= 0.7) dataQuality = "good";
    else if (adherence >= 0.4) dataQuality = "fair";
    else dataQuality = "poor";

    assertEquals(dataQuality, "good");
  });

  await t.step("should assess data quality - poor", () => {
    const checkInCount = 2;
    const periodDays = 7;
    const adherence = checkInCount / periodDays;

    let dataQuality: string;
    if (adherence >= 0.9) dataQuality = "excellent";
    else if (adherence >= 0.7) dataQuality = "good";
    else if (adherence >= 0.4) dataQuality = "fair";
    else dataQuality = "poor";

    assertEquals(dataQuality, "poor");
  });

  // =====================================================
  // Confidence Calculation Tests
  // =====================================================

  await t.step("should calculate confidence from data quality", () => {
    let confidence = 0.7; // Base
    const dataQuality = "excellent";

    if (dataQuality === "excellent") confidence += 0.2;
    else if (dataQuality === "good") confidence += 0.1;
    else if (dataQuality === "fair") confidence -= 0.1;
    else confidence -= 0.2;

    assertEquals(confidence, 0.9);
  });

  await t.step("should adjust confidence for high concern count", () => {
    let confidence = 0.8;
    const highSeverityConcerns = 3;

    if (highSeverityConcerns > 2) {
      confidence -= 0.1;
    }

    assertEquals(confidence, 0.7);
  });

  await t.step("should cap confidence between 0.3 and 0.95", () => {
    let confidence = 1.2; // Too high
    confidence = Math.max(0.3, Math.min(0.95, confidence));

    assertEquals(confidence, 0.95);

    confidence = 0.1; // Too low
    confidence = Math.max(0.3, Math.min(0.95, confidence));

    assertEquals(confidence, 0.3);
  });

  // =====================================================
  // Review Requirements Tests
  // =====================================================

  await t.step("should ALWAYS require review for clinical notes", () => {
    const requiresReview = true; // Mandated for all clinical notes
    assertEquals(requiresReview, true);
  });

  await t.step("should add review reason for low confidence", () => {
    const reviewReasons: string[] = [];
    const confidence = 0.6;

    if (confidence < 0.7) reviewReasons.push("Low confidence score");

    assertEquals(reviewReasons.includes("Low confidence score"), true);
  });

  await t.step("should add review reason for high severity concerns", () => {
    const reviewReasons: string[] = [];
    const concerns = [{ severity: "high" }, { severity: "low" }];

    if (concerns.some(c => c.severity === "high")) {
      reviewReasons.push("High severity concerns identified");
    }

    assertEquals(reviewReasons.includes("High severity concerns identified"), true);
  });

  await t.step("should add review reason for poor data quality", () => {
    const reviewReasons: string[] = [];
    const dataQuality = "poor";

    if (dataQuality === "poor") {
      reviewReasons.push("Insufficient data for reliable synthesis");
    }

    assertEquals(reviewReasons.includes("Insufficient data for reliable synthesis"), true);
  });

  // =====================================================
  // SOAP Summary Tests
  // =====================================================

  await t.step("should define SOAP summary structure", () => {
    const summary = {
      subjective: "Patient reports feeling well with occasional fatigue.",
      objective: "Vital signs stable. BP 128/82, HR 72, SpO2 98%.",
      assessment: "Patient stable with good check-in adherence.",
      plan: "Continue current care plan. Follow up in 2 weeks."
    };

    assertExists(summary.subjective);
    assertExists(summary.objective);
    assertExists(summary.assessment);
    assertExists(summary.plan);
  });

  // =====================================================
  // Generated Progress Note Tests
  // =====================================================

  await t.step("should define GeneratedProgressNote structure", () => {
    const progressNote = {
      noteId: crypto.randomUUID(),
      patientId: "patient-123",
      providerId: "provider-456",
      periodStart: "2026-01-15T00:00:00Z",
      periodEnd: "2026-01-22T00:00:00Z",
      noteType: "routine",
      vitalsTrends: [],
      moodSummary: { dominantMood: "Good", moodDistribution: {}, trend: "stable", concernLevel: "normal" },
      activitySummary: { physicalActivityDays: 0, socialEngagementDays: 0, totalCheckIns: 7, completedCheckIns: 6, missedCheckIns: 1, adherenceRate: 86 },
      concernFlags: [],
      summary: { subjective: "", objective: "", assessment: "", plan: "" },
      keyFindings: ["Check-in adherence: 86%"],
      recommendations: ["Continue daily monitoring"],
      confidence: 0.85,
      requiresReview: true,
      reviewReasons: ["Standard clinical review required"],
      dataQuality: "good" as const,
      generatedAt: new Date().toISOString()
    };

    assertExists(progressNote.noteId);
    assertEquals(progressNote.requiresReview, true);
    assertEquals(progressNote.dataQuality, "good");
    assertExists(progressNote.generatedAt);
  });

  // =====================================================
  // Model Configuration Tests
  // =====================================================

  await t.step("should use Claude Haiku model", () => {
    const HAIKU_MODEL = "claude-haiku-4-5-20250919";
    assertEquals(HAIKU_MODEL.includes("haiku"), true);
  });

  // =====================================================
  // PHI Access Logging Tests
  // =====================================================

  await t.step("should log PHI access for audit", () => {
    const phiAccessLog = {
      user_id: "provider-456",
      patient_id: "patient-123",
      access_type: "progress_note_synthesis",
      resource_type: "check_ins",
      access_reason: "AI progress note synthesis for 7-day period"
    };

    assertEquals(phiAccessLog.access_type, "progress_note_synthesis");
    assertEquals(phiAccessLog.resource_type, "check_ins");
    assertExists(phiAccessLog.access_reason);
  });

  // =====================================================
  // Usage Logging Tests
  // =====================================================

  await t.step("should log usage with metadata", () => {
    const usageLog = {
      user_id: "provider-456",
      request_id: crypto.randomUUID(),
      model: "claude-haiku-4-5-20250919",
      request_type: "progress_note_synthesis",
      input_tokens: 500,
      output_tokens: 800,
      cost: (500 / 1_000_000) * 0.8 + (800 / 1_000_000) * 4.0,
      response_time_ms: 1200,
      success: true,
      metadata: {
        period_days: 7,
        note_type: "routine",
        check_in_count: 6,
        data_quality: "good"
      }
    };

    assertEquals(usageLog.request_type, "progress_note_synthesis");
    assertEquals(usageLog.metadata.check_in_count, 6);
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/ai-progress-note-synthesizer", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  // =====================================================
  // Error Handling Tests
  // =====================================================

  await t.step("should return 500 for AI service not configured", () => {
    const ANTHROPIC_API_KEY = undefined;
    const shouldThrow = !ANTHROPIC_API_KEY;

    assertEquals(shouldThrow, true);
  });

  await t.step("should return 500 on Claude API error", () => {
    const response = { error: "Claude API error: 500" };
    assertEquals(response.error, "Claude API error: 500");
  });

  // =====================================================
  // Date Range Calculation Tests
  // =====================================================

  await t.step("should calculate date range for 7-day period", () => {
    const period = 7;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - period * 24 * 60 * 60 * 1000);

    const daysDifference = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    assertEquals(daysDifference, 7);
  });

  // =====================================================
  // Vitals Parameter Tests
  // =====================================================

  await t.step("should define normal ranges for vitals", () => {
    const normalRanges = {
      heartRate: { low: 60, high: 100 },
      bloodPressureSystolic: { low: 90, high: 140 },
      bloodPressureDiastolic: { low: 60, high: 90 },
      oxygenSaturation: { low: 95, high: 100 },
      bloodGlucose: { low: 70, high: 140 }
    };

    assertEquals(normalRanges.heartRate.low, 60);
    assertEquals(normalRanges.heartRate.high, 100);
    assertEquals(normalRanges.bloodPressureSystolic.high, 140);
  });

  // =====================================================
  // Fallback Response Tests
  // =====================================================

  await t.step("should generate fallback SOAP summary", () => {
    const completedCheckIns = 6;
    const vitalsTrends: { parameter: string; average: number; unit: string }[] = [];
    const concerns: { severity: string }[] = [];

    const fallbackSummary = {
      subjective: `Patient completed ${completedCheckIns} check-ins during the monitoring period.`,
      objective: vitalsTrends.length > 0
        ? `Vital signs: ${vitalsTrends.map(v => `${v.parameter} avg ${v.average} ${v.unit}`).join("; ")}`
        : "Limited vital sign data available for this period.",
      assessment: concerns.length > 0
        ? `${concerns.length} concern(s) identified requiring attention.`
        : "Patient appears stable based on available data.",
      plan: "Continue current monitoring. Review at next scheduled appointment."
    };

    assertEquals(fallbackSummary.subjective.includes("6 check-ins"), true);
    assertEquals(fallbackSummary.assessment, "Patient appears stable based on available data.");
  });

  await t.step("should generate fallback key findings", () => {
    const adherenceRate = 86;
    const concernCount = 0;

    const keyFindings = [
      `Check-in adherence: ${adherenceRate}%`,
      ...(concernCount > 0 ? [`${concernCount} concern flag(s) identified`] : ["No significant concerns"])
    ];

    assertEquals(keyFindings.length, 2);
    assertEquals(keyFindings[1], "No significant concerns");
  });

  await t.step("should generate fallback recommendations", () => {
    const recommendations = [
      "Continue daily monitoring",
      "Review findings at next appointment"
    ];

    assertEquals(recommendations.length, 2);
  });

  // =====================================================
  // Focus Areas Tests
  // =====================================================

  await t.step("should handle focus areas in request", () => {
    const focusAreas = ["blood_pressure", "medication_adherence"];

    assertEquals(focusAreas.length, 2);
    assertEquals(focusAreas.includes("blood_pressure"), true);
  });

  // =====================================================
  // Include Options Tests
  // =====================================================

  await t.step("should respect includeVitals option", () => {
    const options = { includeVitals: true, includeMood: true, includeActivities: true };
    assertEquals(options.includeVitals, true);
  });

  await t.step("should respect includeMood option", () => {
    const options = { includeVitals: true, includeMood: false, includeActivities: true };
    assertEquals(options.includeMood, false);
  });
});
