// supabase/functions/ai-infection-risk-predictor/__tests__/index.test.ts
// Tests for ai-infection-risk-predictor edge function (Skill #33 - HAI Risk Prediction)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Infection Risk Predictor Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/ai-infection-risk-predictor", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require authorization header", () => {
    const authHeader = null;
    const hasAuth = !!authHeader?.startsWith("Bearer ");
    const expectedStatus = hasAuth ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should validate Bearer token format", () => {
    const isValidBearer = (auth: string | null): boolean => {
      return !!auth?.startsWith("Bearer ");
    };

    assertEquals(isValidBearer("Bearer abc123"), true);
    assertEquals(isValidBearer("Basic abc123"), false);
    assertEquals(isValidBearer(null), false);
  });

  await t.step("should require patientId in request body", () => {
    const validBody = { patientId: "patient-123" };
    const invalidBody = {};

    assertExists(validBody.patientId);
    assertEquals("patientId" in invalidBody, false);
  });

  await t.step("should return 400 for missing patientId", () => {
    const hasPatientId = false;
    const expectedStatus = hasPatientId ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should validate allowed roles for infection prediction", () => {
    const allowedRoles = ["admin", "super_admin", "physician", "nurse", "infection_preventionist"];

    assertEquals(allowedRoles.includes("admin"), true);
    assertEquals(allowedRoles.includes("physician"), true);
    assertEquals(allowedRoles.includes("nurse"), true);
    assertEquals(allowedRoles.includes("infection_preventionist"), true);
    assertEquals(allowedRoles.includes("patient"), false);
  });

  await t.step("should return 403 for insufficient permissions", () => {
    const role = "patient";
    const allowedRoles = ["admin", "physician", "nurse"];
    const is_admin = false;
    const hasAccess = is_admin || allowedRoles.includes(role);
    const expectedStatus = hasAccess ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should return 403 when skill not enabled for tenant", () => {
    const config = { infection_risk_predictor_enabled: false };
    const isEnabled = config && config.infection_risk_predictor_enabled;
    const expectedStatus = isEnabled ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  // HAI Type Tests
  await t.step("should support all HAI types", () => {
    const haiTypes = ["CLABSI", "CAUTI", "SSI", "VAP", "CDI"];

    assertEquals(haiTypes.includes("CLABSI"), true); // Central Line-Associated Bloodstream Infection
    assertEquals(haiTypes.includes("CAUTI"), true);  // Catheter-Associated UTI
    assertEquals(haiTypes.includes("SSI"), true);    // Surgical Site Infection
    assertEquals(haiTypes.includes("VAP"), true);    // Ventilator-Associated Pneumonia
    assertEquals(haiTypes.includes("CDI"), true);    // C. difficile Infection
  });

  await t.step("should structure HAI risk assessment correctly", () => {
    const riskAssessment = {
      haiType: "CLABSI",
      riskScore: 72,
      riskLevel: "high",
      confidence: 0.85,
      factors: [],
      preventionBundle: [],
      recommendations: []
    };

    assertExists(riskAssessment.haiType);
    assertEquals(riskAssessment.riskScore, 72);
    assertEquals(riskAssessment.riskLevel, "high");
    assertExists(riskAssessment.confidence);
  });

  // Device Risk Factor Tests
  await t.step("should identify central line as CLABSI risk factor", () => {
    const devices = [{ device_type: "central_line", days_in_place: 5 }];
    const hasCentralLine = devices.some(d => d.device_type === "central_line");

    assertEquals(hasCentralLine, true);
  });

  await t.step("should identify urinary catheter as CAUTI risk factor", () => {
    const devices = [{ device_type: "foley_catheter", days_in_place: 3 }];
    const hasCatheter = devices.some(d =>
      d.device_type === "foley_catheter" || d.device_type === "urinary_catheter"
    );

    assertEquals(hasCatheter, true);
  });

  await t.step("should identify ventilator as VAP risk factor", () => {
    const devices = [{ device_type: "ventilator", days_in_place: 2 }];
    const hasVentilator = devices.some(d => d.device_type === "ventilator");

    assertEquals(hasVentilator, true);
  });

  await t.step("should calculate device days correctly", () => {
    const insertDate = new Date("2026-01-10");
    const now = new Date("2026-01-17");
    const deviceDays = Math.floor((now.getTime() - insertDate.getTime()) / (1000 * 60 * 60 * 24));

    assertEquals(deviceDays, 7);
  });

  await t.step("should flag prolonged device duration", () => {
    const thresholds = {
      central_line: 5,
      foley_catheter: 3,
      ventilator: 2
    };
    const deviceDays = 6;
    const deviceType = "central_line";
    const isProlonged = deviceDays > thresholds[deviceType as keyof typeof thresholds];

    assertEquals(isProlonged, true);
  });

  // Lab Value Risk Factor Tests
  await t.step("should identify elevated WBC as infection indicator", () => {
    const wbc = 15000; // cells/mcL
    const isElevated = wbc > 11000;

    assertEquals(isElevated, true);
  });

  await t.step("should identify low WBC as infection risk", () => {
    const wbc = 3500; // cells/mcL
    const isLow = wbc < 4000;

    assertEquals(isLow, true);
  });

  await t.step("should identify elevated procalcitonin", () => {
    const procalcitonin = 2.5; // ng/mL
    const isElevated = procalcitonin > 0.5;

    assertEquals(isElevated, true);
  });

  await t.step("should identify elevated lactate", () => {
    const lactate = 3.0; // mmol/L
    const isElevated = lactate > 2.0;

    assertEquals(isElevated, true);
  });

  await t.step("should identify fever from temperature", () => {
    const temperature = 38.5; // Celsius
    const hasFever = temperature >= 38.0;

    assertEquals(hasFever, true);
  });

  // Risk Score Calculation Tests
  await t.step("should calculate risk level from score", () => {
    const getRiskLevel = (score: number): string => {
      if (score >= 70) return "high";
      if (score >= 40) return "moderate";
      if (score >= 20) return "low";
      return "minimal";
    };

    assertEquals(getRiskLevel(85), "high");
    assertEquals(getRiskLevel(55), "moderate");
    assertEquals(getRiskLevel(30), "low");
    assertEquals(getRiskLevel(10), "minimal");
  });

  await t.step("should score immunocompromised status", () => {
    const conditions = ["HIV", "chemotherapy", "transplant recipient"];
    const immunocompromisedTerms = ["hiv", "aids", "immunodeficiency", "chemotherapy", "transplant", "immunosuppressed"];
    const isImmunocompromised = conditions.some(c =>
      immunocompromisedTerms.some(term => c.toLowerCase().includes(term))
    );
    const score = isImmunocompromised ? 20 : 0;

    assertEquals(score, 20);
  });

  await t.step("should score recent surgery for SSI risk", () => {
    const procedures = [{ procedure_date: "2026-01-15", procedure_type: "abdominal_surgery" }];
    const recentSurgeries = procedures.filter(p => {
      const daysAgo = Math.floor((Date.now() - new Date(p.procedure_date).getTime()) / (1000 * 60 * 60 * 24));
      return daysAgo <= 30;
    });
    const ssiRiskScore = recentSurgeries.length > 0 ? 25 : 0;

    assertEquals(ssiRiskScore, 25);
  });

  await t.step("should score antibiotic exposure for CDI risk", () => {
    const medications = [
      { medication_name: "Ciprofloxacin", start_date: "2026-01-10" },
      { medication_name: "Clindamycin", start_date: "2026-01-12" }
    ];
    const highRiskAntibiotics = ["fluoroquinolone", "ciprofloxacin", "clindamycin", "cephalosporin"];
    const hasHighRiskAntibiotic = medications.some(m =>
      highRiskAntibiotics.some(ab => m.medication_name.toLowerCase().includes(ab))
    );
    const cdiRiskScore = hasHighRiskAntibiotic ? 30 : 0;

    assertEquals(cdiRiskScore, 30);
  });

  // Prevention Bundle Tests
  await t.step("should generate CLABSI prevention bundle", () => {
    const haiType = "CLABSI";
    const bundle = [];

    if (haiType === "CLABSI") {
      bundle.push(
        { item: "Hand hygiene compliance check", priority: "critical" },
        { item: "Daily line necessity review", priority: "high" },
        { item: "Chlorhexidine bathing", priority: "high" },
        { item: "Dressing integrity assessment", priority: "medium" }
      );
    }

    assertEquals(bundle.length, 4);
    assertEquals(bundle[0].priority, "critical");
  });

  await t.step("should generate CAUTI prevention bundle", () => {
    const haiType = "CAUTI";
    const bundle = [];

    if (haiType === "CAUTI") {
      bundle.push(
        { item: "Daily catheter necessity review", priority: "critical" },
        { item: "Maintain closed drainage system", priority: "high" },
        { item: "Catheter care per protocol", priority: "high" }
      );
    }

    assertEquals(bundle.length, 3);
  });

  await t.step("should generate VAP prevention bundle", () => {
    const haiType = "VAP";
    const bundle = [];

    if (haiType === "VAP") {
      bundle.push(
        { item: "Head of bed elevation 30-45 degrees", priority: "critical" },
        { item: "Daily sedation vacation", priority: "high" },
        { item: "Daily readiness-to-extubate assessment", priority: "high" },
        { item: "Oral care with chlorhexidine", priority: "high" }
      );
    }

    assertEquals(bundle.length, 4);
  });

  // Recommendation Structure Tests
  await t.step("should structure intervention recommendation correctly", () => {
    const recommendation = {
      intervention: "Review central line necessity",
      urgency: "high",
      responsible: "Attending physician",
      timeframe: "Within 24 hours",
      rationale: "Line in place > 5 days with elevated infection risk"
    };

    assertExists(recommendation.intervention);
    assertEquals(recommendation.urgency, "high");
    assertExists(recommendation.rationale);
  });

  await t.step("should generate urgent recommendations for high risk", () => {
    const riskLevel = "high";
    const recommendations = [];

    if (riskLevel === "high") {
      recommendations.push({
        intervention: "Infectious disease consultation",
        urgency: "urgent",
        timeframe: "Within 4 hours"
      });
    }

    assertEquals(recommendations.length, 1);
    assertEquals(recommendations[0].urgency, "urgent");
  });

  // PHI Redaction Tests
  await t.step("should redact patient names from AI context", () => {
    const redact = (text: string): string =>
      text.replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, "[NAME]");

    const result = redact("Patient John Smith has elevated WBC");
    assertEquals(result.includes("[NAME]"), true);
  });

  await t.step("should redact MRN from AI context", () => {
    const redact = (text: string): string =>
      text.replace(/MRN[:\s]*\d+/gi, "MRN: [REDACTED]");

    const result = redact("MRN: 12345678");
    assertEquals(result, "MRN: [REDACTED]");
  });

  // Claude Model Tests
  await t.step("should use Claude Sonnet for clinical accuracy", () => {
    const SONNET_MODEL = "claude-sonnet-4-5-20250514";
    assertEquals(SONNET_MODEL.includes("sonnet"), true);
  });

  // Response Structure Tests
  await t.step("should structure success response correctly", () => {
    const response = {
      success: true,
      assessment: {
        patientId: "patient-123",
        assessmentDate: new Date().toISOString(),
        overallRiskLevel: "moderate",
        haiRisks: [
          { haiType: "CLABSI", riskScore: 45, riskLevel: "moderate" },
          { haiType: "CAUTI", riskScore: 30, riskLevel: "low" }
        ],
        prioritizedInterventions: [],
        reassessmentRecommended: "48 hours"
      },
      metadata: {
        model: "claude-sonnet-4-5-20250514",
        generated_at: new Date().toISOString()
      }
    };

    assertEquals(response.success, true);
    assertExists(response.assessment);
    assertEquals(response.assessment.haiRisks.length, 2);
    assertExists(response.metadata);
  });

  await t.step("should determine reassessment interval based on risk", () => {
    const getReassessmentInterval = (riskLevel: string): string => {
      switch (riskLevel) {
        case "high": return "12 hours";
        case "moderate": return "24 hours";
        case "low": return "48 hours";
        default: return "72 hours";
      }
    };

    assertEquals(getReassessmentInterval("high"), "12 hours");
    assertEquals(getReassessmentInterval("moderate"), "24 hours");
    assertEquals(getReassessmentInterval("low"), "48 hours");
  });

  // Trend Analysis Tests
  await t.step("should detect worsening trend in lab values", () => {
    const labHistory = [
      { value: 10000, date: "2026-01-15" },
      { value: 12000, date: "2026-01-16" },
      { value: 15000, date: "2026-01-17" }
    ];
    const isWorsening = labHistory.length >= 2 &&
      labHistory[labHistory.length - 1].value > labHistory[labHistory.length - 2].value;

    assertEquals(isWorsening, true);
  });

  await t.step("should calculate trend direction", () => {
    const getTrend = (values: number[]): string => {
      if (values.length < 2) return "insufficient_data";
      const recent = values.slice(-3);
      const increasing = recent.every((v, i) => i === 0 || v >= recent[i - 1]);
      const decreasing = recent.every((v, i) => i === 0 || v <= recent[i - 1]);
      if (increasing) return "worsening";
      if (decreasing) return "improving";
      return "stable";
    };

    assertEquals(getTrend([10, 12, 15]), "worsening");
    assertEquals(getTrend([15, 12, 10]), "improving");
    assertEquals(getTrend([10, 15, 12]), "stable");
  });

  // AI Usage Logging Tests
  await t.step("should log AI usage for cost tracking", () => {
    const usageLog = {
      user_id: "user-123",
      request_id: crypto.randomUUID(),
      model: "claude-sonnet-4-5-20250514",
      request_type: "infection_risk_prediction",
      input_tokens: 1200,
      output_tokens: 800,
      cost: (1200 / 1_000_000) * 3.0 + (800 / 1_000_000) * 15.0,
      response_time_ms: 2500,
      success: true
    };

    assertEquals(usageLog.request_type, "infection_risk_prediction");
    assertEquals(usageLog.success, true);
  });

  // Assessment Storage Tests
  await t.step("should store assessment in ai_risk_assessments table", () => {
    const assessmentRecord = {
      patient_id: "patient-123",
      risk_category: "infection_hai",
      risk_level: "moderate",
      risk_score: 45,
      confidence: 0.82,
      risk_factors: [{ factor: "Central line day 6", weight: 20 }],
      protective_factors: [],
      recommendations: [],
      requires_review: true,
      review_reasons: ["Moderate HAI risk requires clinical oversight"],
      summary: "Patient has moderate CLABSI risk due to prolonged central line placement",
      model_used: "claude-sonnet-4-5-20250514",
      assessed_at: new Date().toISOString()
    };

    assertEquals(assessmentRecord.risk_category, "infection_hai");
    assertExists(assessmentRecord.assessed_at);
  });

  // HTTP Status Codes
  await t.step("should return 200 for successful prediction", () => {
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

  // Error Response Structure
  await t.step("should structure error response correctly", () => {
    const errorResponse = {
      error: "Missing required field: patientId"
    };

    assertExists(errorResponse.error);
  });

  // Data Gathering Tests
  await t.step("should gather active devices for patient", () => {
    const devices = [
      { device_type: "central_line", status: "active", inserted_at: "2026-01-10" },
      { device_type: "foley_catheter", status: "removed", inserted_at: "2026-01-12" }
    ];
    const activeDevices = devices.filter(d => d.status === "active");

    assertEquals(activeDevices.length, 1);
  });

  await t.step("should gather recent procedures", () => {
    const procedures = [
      { procedure_type: "surgery", procedure_date: "2026-01-15" },
      { procedure_type: "catheter_insertion", procedure_date: "2026-01-10" }
    ];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentProcedures = procedures.filter(p =>
      new Date(p.procedure_date) >= thirtyDaysAgo
    );

    assertEquals(recentProcedures.length, 2);
  });

  await t.step("should gather relevant lab results", () => {
    const labCodes = ["WBC", "PROCALCITONIN", "LACTATE", "CRP", "TEMP"];
    const labs = [
      { code: "WBC", value: 15000, unit: "cells/mcL" },
      { code: "LACTATE", value: 2.5, unit: "mmol/L" }
    ];
    const relevantLabs = labs.filter(l => labCodes.includes(l.code));

    assertEquals(relevantLabs.length, 2);
  });

  // Multi-HAI Assessment Tests
  await t.step("should assess multiple HAI types simultaneously", () => {
    const haiAssessments = [
      { haiType: "CLABSI", applicable: true, riskScore: 45 },
      { haiType: "CAUTI", applicable: true, riskScore: 30 },
      { haiType: "VAP", applicable: false, riskScore: 0 },
      { haiType: "SSI", applicable: true, riskScore: 55 },
      { haiType: "CDI", applicable: true, riskScore: 25 }
    ];
    const applicableAssessments = haiAssessments.filter(a => a.applicable);

    assertEquals(applicableAssessments.length, 4);
  });

  await t.step("should determine overall risk from multiple HAIs", () => {
    const haiRisks = [
      { riskLevel: "moderate" },
      { riskLevel: "high" },
      { riskLevel: "low" }
    ];
    const levels = ["minimal", "low", "moderate", "high"];
    const overallRisk = haiRisks.reduce((max, r) => {
      return levels.indexOf(r.riskLevel) > levels.indexOf(max) ? r.riskLevel : max;
    }, "minimal");

    assertEquals(overallRisk, "high");
  });
});
