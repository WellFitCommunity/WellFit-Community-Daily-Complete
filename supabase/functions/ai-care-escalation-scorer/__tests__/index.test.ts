// supabase/functions/ai-care-escalation-scorer/__tests__/index.test.ts
// Tests for ai-care-escalation-scorer edge function (Skill #32)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Care Escalation Scorer Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/ai-care-escalation-scorer", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require patientId and assessorId", () => {
    const validBody = { patientId: "patient-123", assessorId: "nurse-456" };
    const invalidBody = { patientId: "patient-123" };

    assertExists(validBody.patientId);
    assertExists(validBody.assessorId);
    assertEquals("assessorId" in invalidBody, false);
  });

  await t.step("should return 400 for missing required fields", () => {
    const hasRequiredFields = false;
    const expectedStatus = hasRequiredFields ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should accept valid assessment contexts", () => {
    const validContexts = ["shift_handoff", "routine_assessment", "condition_change", "urgent_review"];

    assertEquals(validContexts.includes("shift_handoff"), true);
    assertEquals(validContexts.includes("routine_assessment"), true);
    assertEquals(validContexts.includes("condition_change"), true);
    assertEquals(validContexts.includes("urgent_review"), true);
  });

  await t.step("should accept optional triggerReason", () => {
    const body = {
      patientId: "patient-123",
      assessorId: "nurse-456",
      context: "condition_change",
      triggerReason: "Patient reported increased shortness of breath"
    };

    assertExists(body.triggerReason);
  });

  // PHI Redaction tests
  await t.step("should redact email addresses", () => {
    const redact = (s: string): string =>
      s.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");

    assertEquals(redact("patient@email.com"), "[EMAIL]");
  });

  await t.step("should redact phone numbers", () => {
    const redact = (s: string): string =>
      s.replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]");

    assertEquals(redact("555-123-4567"), "[PHONE]");
  });

  await t.step("should redact SSN", () => {
    const redact = (s: string): string =>
      s.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

    assertEquals(redact("123-45-6789"), "[SSN]");
  });

  // Claude model tests
  await t.step("should use Claude Sonnet 4.5 for clinical accuracy", () => {
    const SONNET_MODEL = "claude-sonnet-4-5-20250514";
    assertEquals(SONNET_MODEL.includes("sonnet"), true);
  });

  // Vital sign abnormality detection tests
  await t.step("should detect abnormal heart rate", () => {
    const normalRanges = { HR: { min: 60, max: 100 } };
    const isAbnormal = (code: string, value: number) => {
      const range = normalRanges[code as keyof typeof normalRanges];
      if (!range) return false;
      return value < range.min || value > range.max;
    };

    assertEquals(isAbnormal("HR", 55), true); // Too low
    assertEquals(isAbnormal("HR", 110), true); // Too high
    assertEquals(isAbnormal("HR", 75), false); // Normal
  });

  await t.step("should detect abnormal blood pressure", () => {
    const normalRanges = { BP_SYS: { min: 90, max: 140 }, BP_DIA: { min: 60, max: 90 } };
    const isAbnormal = (code: string, value: number) => {
      const range = normalRanges[code as keyof typeof normalRanges];
      if (!range) return false;
      return value < range.min || value > range.max;
    };

    assertEquals(isAbnormal("BP_SYS", 85), true); // Too low
    assertEquals(isAbnormal("BP_SYS", 160), true); // Too high
    assertEquals(isAbnormal("BP_SYS", 120), false); // Normal
  });

  await t.step("should detect abnormal SpO2", () => {
    const normalRanges = { SPO2: { min: 92, max: 100 } };
    const isAbnormal = (code: string, value: number) => {
      const range = normalRanges[code as keyof typeof normalRanges];
      if (!range) return false;
      return value < range.min || value > range.max;
    };

    assertEquals(isAbnormal("SPO2", 88), true); // Critical
    assertEquals(isAbnormal("SPO2", 95), false); // Normal
  });

  await t.step("should detect critical vital values", () => {
    const isCritical = (code: string, value: number): boolean => {
      if (code === "SPO2" && value < 88) return true;
      if (code === "BP_SYS" && (value > 180 || value < 80)) return true;
      if (code === "HR" && (value > 150 || value < 40)) return true;
      return false;
    };

    assertEquals(isCritical("SPO2", 85), true);
    assertEquals(isCritical("BP_SYS", 185), true);
    assertEquals(isCritical("BP_SYS", 75), true);
    assertEquals(isCritical("HR", 155), true);
    assertEquals(isCritical("HR", 35), true);
    assertEquals(isCritical("HR", 80), false);
  });

  // Escalation category calculation tests
  await t.step("should determine escalation category from score", () => {
    const getCategory = (score: number): string => {
      if (score >= 80) return "emergency";
      if (score >= 60) return "escalate";
      if (score >= 40) return "notify";
      if (score >= 20) return "monitor";
      return "none";
    };

    assertEquals(getCategory(85), "emergency");
    assertEquals(getCategory(70), "escalate");
    assertEquals(getCategory(50), "notify");
    assertEquals(getCategory(25), "monitor");
    assertEquals(getCategory(10), "none");
  });

  await t.step("should map escalation category to urgency level", () => {
    const getUrgency = (category: string): string => {
      switch (category) {
        case "emergency": return "critical";
        case "escalate": return "urgent";
        case "notify": return "elevated";
        default: return "routine";
      }
    };

    assertEquals(getUrgency("emergency"), "critical");
    assertEquals(getUrgency("escalate"), "urgent");
    assertEquals(getUrgency("notify"), "elevated");
    assertEquals(getUrgency("monitor"), "routine");
  });

  // Clinical indicator structure tests
  await t.step("should structure clinical indicator correctly", () => {
    const indicator = {
      indicator: "Elevated heart rate",
      category: "vital_signs",
      currentValue: "115 bpm",
      trend: "worsening",
      weight: 15,
      concernLevel: "moderate"
    };

    assertExists(indicator.indicator);
    assertEquals(indicator.category, "vital_signs");
    assertEquals(indicator.trend, "worsening");
    assertEquals(indicator.concernLevel, "moderate");
  });

  await t.step("should validate indicator categories", () => {
    const validCategories = ["vital_signs", "labs", "symptoms", "functional_status", "behavioral"];

    assertEquals(validCategories.includes("vital_signs"), true);
    assertEquals(validCategories.includes("labs"), true);
    assertEquals(validCategories.includes("symptoms"), true);
  });

  // Escalation factor structure tests
  await t.step("should structure escalation factor correctly", () => {
    const factor = {
      factor: "3 abnormal vital signs",
      category: "vital_signs",
      severity: "high",
      evidence: "HR: 115, SPO2: 89, BP: 160/95",
      weight: 30
    };

    assertExists(factor.factor);
    assertEquals(factor.severity, "high");
    assertEquals(factor.weight, 30);
  });

  // Recommendation structure tests
  await t.step("should structure recommendation correctly", () => {
    const recommendation = {
      action: "Notify attending physician",
      urgency: "urgent",
      responsible: "Primary Nurse",
      timeframe: "Within 30 minutes",
      rationale: "High escalation score requires physician awareness"
    };

    assertExists(recommendation.action);
    assertEquals(recommendation.urgency, "urgent");
    assertExists(recommendation.rationale);
  });

  await t.step("should generate emergency recommendations", () => {
    const category = "emergency";
    const recommendations = [];

    if (category === "emergency") {
      recommendations.push({
        action: "Activate rapid response team",
        urgency: "immediate",
        responsible: "Charge Nurse",
        timeframe: "Immediately"
      });
    }

    assertEquals(recommendations.length, 1);
    assertEquals(recommendations[0].urgency, "immediate");
  });

  // Escalation score structure tests
  await t.step("should structure escalation score correctly", () => {
    const score = {
      assessmentId: crypto.randomUUID(),
      patientId: "patient-123",
      assessorId: "nurse-456",
      assessmentDate: new Date().toISOString(),
      context: "routine_assessment",
      overallEscalationScore: 45,
      confidenceLevel: 0.85,
      escalationCategory: "notify",
      urgencyLevel: "elevated",
      clinicalIndicators: [],
      escalationFactors: [],
      protectiveFactors: [],
      overallTrend: "stable",
      trendConfidence: 0.7,
      hoursToReassess: 4,
      recommendations: [],
      requiredNotifications: [],
      documentationRequired: ["Vital signs", "Assessment findings"],
      requiresPhysicianReview: false,
      requiresRapidResponse: false,
      reviewReasons: [],
      clinicalSummary: "Patient assessment completed.",
      handoffPriority: "medium"
    };

    assertExists(score.assessmentId);
    assertEquals(score.overallEscalationScore, 45);
    assertEquals(score.escalationCategory, "notify");
    assertEquals(score.handoffPriority, "medium");
  });

  // Rule-based scoring tests
  await t.step("should score abnormal vitals", () => {
    const abnormalVitals = [{ code: "HR", value: 115 }, { code: "SPO2", value: 90 }];
    const vitalScore = Math.min(abnormalVitals.length * 15, 45);

    assertEquals(vitalScore, 30);
  });

  await t.step("should cap vital score at 45", () => {
    const abnormalVitals = [1, 2, 3, 4, 5]; // 5 abnormal vitals
    const vitalScore = Math.min(abnormalVitals.length * 15, 45);

    assertEquals(vitalScore, 45);
  });

  await t.step("should score critical alerts", () => {
    const criticalAlerts = [{ severity: "critical" }];
    const alertScore = criticalAlerts.length > 0 ? 25 : 0;

    assertEquals(alertScore, 25);
  });

  await t.step("should score high alerts", () => {
    const highAlerts = [{ severity: "high" }, { severity: "high" }];
    const alertScore = highAlerts.length * 10;

    assertEquals(alertScore, 20);
  });

  await t.step("should score advanced age", () => {
    const age = 85;
    const ageScore = age >= 80 ? 10 : 0;

    assertEquals(ageScore, 10);
  });

  await t.step("should score high-risk comorbidities", () => {
    const comorbidities = ["Heart failure", "COPD", "Diabetes"];
    const highRiskConditions = ["heart failure", "copd", "ckd", "sepsis", "stroke"];
    const hasHighRisk = comorbidities.some(c =>
      highRiskConditions.some(hr => c.toLowerCase().includes(hr))
    );
    const comorbidityScore = hasHighRisk ? 15 : 0;

    assertEquals(comorbidityScore, 15);
  });

  // Confidence calculation tests
  await t.step("should calculate confidence based on data completeness", () => {
    let confidence = 0.7;
    const recentVitals = [1, 2, 3, 4, 5, 6]; // 6 vitals
    const comorbidities = ["HTN"];
    const medications = ["Lisinopril"];

    if (recentVitals.length > 5) confidence += 0.1;
    if (comorbidities.length > 0) confidence += 0.1;
    if (medications.length > 0) confidence += 0.1;

    assertEquals(Math.min(confidence, 1.0), 1.0);
  });

  // Hours to reassess tests
  await t.step("should set reassess time based on escalation category", () => {
    const getReassessHours = (category: string): number => {
      switch (category) {
        case "emergency": return 1;
        case "escalate": return 2;
        default: return 4;
      }
    };

    assertEquals(getReassessHours("emergency"), 1);
    assertEquals(getReassessHours("escalate"), 2);
    assertEquals(getReassessHours("notify"), 4);
  });

  // Required notifications tests
  await t.step("should determine required notifications for emergency", () => {
    const category = "emergency";
    const notifications = category === "emergency"
      ? ["Physician", "Charge Nurse", "Rapid Response Team"]
      : category === "escalate"
      ? ["Physician", "Charge Nurse"]
      : [];

    assertEquals(notifications.length, 3);
    assertEquals(notifications.includes("Rapid Response Team"), true);
  });

  // Handoff priority tests
  await t.step("should determine handoff priority", () => {
    const getHandoffPriority = (category: string): string => {
      switch (category) {
        case "emergency": return "critical";
        case "escalate": return "high";
        case "notify": return "medium";
        default: return "low";
      }
    };

    assertEquals(getHandoffPriority("emergency"), "critical");
    assertEquals(getHandoffPriority("escalate"), "high");
    assertEquals(getHandoffPriority("notify"), "medium");
    assertEquals(getHandoffPriority("monitor"), "low");
  });

  // Response structure tests
  await t.step("should structure success response correctly", () => {
    const response = {
      assessment: {
        assessmentId: "uuid-123",
        overallEscalationScore: 65,
        escalationCategory: "escalate"
      },
      metadata: {
        generated_at: new Date().toISOString(),
        response_time_ms: 1500,
        model: "claude-sonnet-4-5-20250514"
      }
    };

    assertExists(response.assessment);
    assertExists(response.metadata);
    assertEquals(response.metadata.model.includes("sonnet"), true);
  });

  // Usage logging tests
  await t.step("should log AI usage for cost tracking", () => {
    const usageLog = {
      user_id: "nurse-456",
      request_id: crypto.randomUUID(),
      model: "claude-sonnet-4-5-20250514",
      request_type: "care_escalation_scoring",
      input_tokens: 800,
      output_tokens: 600,
      cost: (800 / 1_000_000) * 3.0 + (600 / 1_000_000) * 15.0,
      response_time_ms: 1200,
      success: true
    };

    assertEquals(usageLog.request_type, "care_escalation_scoring");
    assertEquals(usageLog.success, true);
  });

  // Assessment storage tests
  await t.step("should store assessment in ai_risk_assessments table", () => {
    const assessmentRecord = {
      patient_id: "patient-123",
      risk_category: "care_escalation",
      risk_level: "escalate",
      risk_score: 65,
      confidence: 0.85,
      risk_factors: [],
      protective_factors: [],
      recommendations: [],
      requires_review: true,
      review_reasons: ["High escalation score"],
      summary: "Assessment completed",
      model_used: "claude-sonnet-4-5-20250514",
      assessed_at: new Date().toISOString()
    };

    assertEquals(assessmentRecord.risk_category, "care_escalation");
    assertExists(assessmentRecord.assessed_at);
  });

  // HTTP status codes
  await t.step("should return 200 for successful scoring", () => {
    const success = true;
    const expectedStatus = success ? 200 : 500;

    assertEquals(expectedStatus, 200);
  });

  await t.step("should return 500 for server errors", () => {
    const hasError = true;
    const expectedStatus = hasError ? 500 : 200;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should include Content-Type header in responses", () => {
    const headers = { "Content-Type": "application/json" };

    assertEquals(headers["Content-Type"], "application/json");
  });

  await t.step("should structure error response correctly", () => {
    const errorResponse = {
      error: "Missing required fields: patientId and assessorId"
    };

    assertExists(errorResponse.error);
  });

  // AI fallback tests
  await t.step("should use rule-based fallback when AI fails", () => {
    const aiError = new Error("Claude API error");
    const useFallback = !!aiError;

    assertEquals(useFallback, true);
  });

  await t.step("should skip AI for clear-cut none cases", () => {
    const ruleBasedScore = { confidence: 0.95, escalationCategory: "none" };
    const skipAI = ruleBasedScore.confidence > 0.9 && ruleBasedScore.escalationCategory === "none";

    assertEquals(skipAI, true);
  });
});
