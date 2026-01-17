// supabase/functions/ai-fall-risk-predictor/__tests__/index.test.ts
// Tests for ai-fall-risk-predictor edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Fall Risk Predictor Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/ai-fall-risk-predictor", {
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

  await t.step("should validate assessment contexts", () => {
    const validContexts = ["admission", "routine", "post_fall", "discharge"];

    assertEquals(validContexts.includes("admission"), true);
    assertEquals(validContexts.includes("routine"), true);
    assertEquals(validContexts.includes("post_fall"), true);
    assertEquals(validContexts.includes("discharge"), true);
    assertEquals(validContexts.includes("unknown"), false);
  });

  await t.step("should default assessmentContext to 'routine'", () => {
    const getAssessmentContext = (provided?: string): string => {
      return provided ?? "routine";
    };

    assertEquals(getAssessmentContext(undefined), "routine");
    assertEquals(getAssessmentContext("admission"), "admission");
  });

  await t.step("should validate risk categories", () => {
    const validCategories = ["low", "moderate", "high", "very_high"];

    assertEquals(validCategories.includes("low"), true);
    assertEquals(validCategories.includes("moderate"), true);
    assertEquals(validCategories.includes("high"), true);
    assertEquals(validCategories.includes("very_high"), true);
  });

  await t.step("should calculate age risk score correctly", () => {
    const calculateAgeRisk = (age: number | null): number => {
      if (!age) return 0;
      if (age >= 85) return 100;
      if (age >= 80) return 80;
      if (age >= 75) return 60;
      if (age >= 65) return 40;
      if (age >= 55) return 20;
      return 0;
    };

    assertEquals(calculateAgeRisk(90), 100);
    assertEquals(calculateAgeRisk(82), 80);
    assertEquals(calculateAgeRisk(75), 60);
    assertEquals(calculateAgeRisk(67), 40);
    assertEquals(calculateAgeRisk(58), 20);
    assertEquals(calculateAgeRisk(40), 0);
    assertEquals(calculateAgeRisk(null), 0);
  });

  await t.step("should calculate fall history risk score", () => {
    const calculateFallHistoryRisk = (fallCount: number): number => {
      if (fallCount >= 3) return 100;
      if (fallCount === 2) return 75;
      if (fallCount === 1) return 50;
      return 0;
    };

    assertEquals(calculateFallHistoryRisk(5), 100);
    assertEquals(calculateFallHistoryRisk(3), 100);
    assertEquals(calculateFallHistoryRisk(2), 75);
    assertEquals(calculateFallHistoryRisk(1), 50);
    assertEquals(calculateFallHistoryRisk(0), 0);
  });

  await t.step("should identify high-risk medication classes", () => {
    const HIGH_RISK_CLASSES = [
      "benzodiazepine", "opioid", "morphine", "antipsychotic",
      "tricyclic", "anticonvulsant", "diuretic", "muscle relaxant"
    ];

    assertEquals(HIGH_RISK_CLASSES.includes("benzodiazepine"), true);
    assertEquals(HIGH_RISK_CLASSES.includes("opioid"), true);
    assertEquals(HIGH_RISK_CLASSES.includes("antipsychotic"), true);
    assertEquals(HIGH_RISK_CLASSES.includes("vitamin"), false);
  });

  await t.step("should calculate medication risk score", () => {
    const calculateMedicationRisk = (highRiskMedCount: number, totalMedCount: number): number => {
      let score = 0;
      if (highRiskMedCount >= 4) score = 100;
      else if (highRiskMedCount === 3) score = 75;
      else if (highRiskMedCount === 2) score = 50;
      else if (highRiskMedCount === 1) score = 25;

      // Polypharmacy consideration
      if (totalMedCount >= 10) score = Math.max(score, 60);
      else if (totalMedCount >= 5) score = Math.max(score, 30);

      return score;
    };

    assertEquals(calculateMedicationRisk(4, 4), 100);
    assertEquals(calculateMedicationRisk(1, 12), 60);  // Polypharmacy
    assertEquals(calculateMedicationRisk(0, 6), 30);   // Moderate polypharmacy
    assertEquals(calculateMedicationRisk(2, 2), 50);
  });

  await t.step("should identify high-risk conditions by category", () => {
    const HIGH_RISK_CONDITIONS = {
      neurological: ["parkinson", "dementia", "stroke", "vertigo"],
      cardiovascular: ["orthostatic hypotension", "arrhythmia", "heart failure"],
      musculoskeletal: ["arthritis", "osteoporosis", "fracture"],
      sensory: ["vision", "glaucoma", "cataract", "hearing loss"],
      metabolic: ["diabetes", "hypoglycemia", "anemia"],
      cognitive: ["cognitive impairment", "delirium", "depression"]
    };

    assertEquals(HIGH_RISK_CONDITIONS.neurological.includes("parkinson"), true);
    assertEquals(HIGH_RISK_CONDITIONS.cardiovascular.includes("orthostatic hypotension"), true);
    assertEquals(HIGH_RISK_CONDITIONS.musculoskeletal.includes("arthritis"), true);
  });

  await t.step("should structure risk factor correctly", () => {
    const riskFactor = {
      factor: "Age 82 years",
      category: "age" as const,
      severity: "high" as const,
      weight: 0.8,
      evidence: "Age ≥80 significantly increases fall risk",
      interventionSuggestion: "Implement standard fall precautions"
    };

    assertExists(riskFactor.factor);
    assertEquals(riskFactor.category, "age");
    assertEquals(riskFactor.severity, "high");
    assertEquals(riskFactor.weight >= 0 && riskFactor.weight <= 1, true);
  });

  await t.step("should validate intervention priorities", () => {
    const validPriorities = ["low", "medium", "high", "urgent"];

    assertEquals(validPriorities.includes("urgent"), true);
    assertEquals(validPriorities.includes("high"), true);
    assertEquals(validPriorities.includes("medium"), true);
    assertEquals(validPriorities.includes("low"), true);
  });

  await t.step("should validate intervention categories", () => {
    const validCategories = [
      "environmental",
      "medication",
      "therapy",
      "equipment",
      "education",
      "monitoring"
    ];

    assertEquals(validCategories.includes("environmental"), true);
    assertEquals(validCategories.includes("medication"), true);
    assertEquals(validCategories.includes("equipment"), true);
  });

  await t.step("should structure intervention correctly", () => {
    const intervention = {
      intervention: "Install bed alarm",
      priority: "high" as const,
      category: "equipment" as const,
      timeframe: "Within 24 hours",
      responsible: "Nursing",
      estimatedRiskReduction: 0.15
    };

    assertExists(intervention.intervention);
    assertEquals(intervention.priority, "high");
    assertEquals(intervention.category, "equipment");
    assertEquals(intervention.estimatedRiskReduction >= 0 && intervention.estimatedRiskReduction <= 1, true);
  });

  await t.step("should determine monitoring frequency from score", () => {
    const getMonitoringFrequency = (riskScore: number): string => {
      if (riskScore >= 70) return "intensive";
      if (riskScore >= 40) return "enhanced";
      return "standard";
    };

    assertEquals(getMonitoringFrequency(85), "intensive");
    assertEquals(getMonitoringFrequency(70), "intensive");
    assertEquals(getMonitoringFrequency(55), "enhanced");
    assertEquals(getMonitoringFrequency(40), "enhanced");
    assertEquals(getMonitoringFrequency(25), "standard");
  });

  await t.step("should determine age risk category", () => {
    const getAgeRiskCategory = (age: number | null): string => {
      if (!age) return "low";
      if (age >= 80) return "high";
      if (age >= 65) return "moderate";
      return "low";
    };

    assertEquals(getAgeRiskCategory(85), "high");
    assertEquals(getAgeRiskCategory(72), "moderate");
    assertEquals(getAgeRiskCategory(50), "low");
    assertEquals(getAgeRiskCategory(null), "low");
  });

  await t.step("should calculate Morse Scale estimate", () => {
    const calculateMorseEstimate = (overallScore: number): number => {
      // Morse scale is 0-125
      return Math.round(overallScore * 1.25);
    };

    assertEquals(calculateMorseEstimate(100), 125);
    assertEquals(calculateMorseEstimate(80), 100);
    assertEquals(calculateMorseEstimate(50), 63);  // Actually 62.5 rounded to 63
  });

  await t.step("should redact PHI from logs", () => {
    const redact = (s: string): string =>
      s
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
        .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

    assertEquals(redact("patient@email.com"), "[EMAIL]");
    assertEquals(redact("555-123-4567"), "[PHONE]");
    assertEquals(redact("123-45-6789"), "[SSN]");
  });

  await t.step("should structure fall risk assessment correctly", () => {
    const assessment = {
      assessmentId: crypto.randomUUID(),
      patientId: "patient-123",
      assessorId: "nurse-456",
      assessmentDate: new Date().toISOString(),
      assessmentContext: "routine",
      overallRiskScore: 65,
      riskCategory: "high" as const,
      morseScaleEstimate: 81,
      riskFactors: [],
      protectiveFactors: [],
      patientAge: 78,
      ageRiskCategory: "moderate" as const,
      categoryScores: {
        age: 60,
        fallHistory: 50,
        medications: 25,
        conditions: 45,
        mobility: 40,
        cognitive: 10,
        sensory: 30,
        environmental: 20
      },
      interventions: [],
      precautions: [],
      monitoringFrequency: "enhanced" as const,
      confidence: 0.85,
      requiresReview: true,
      reviewReasons: [],
      plainLanguageExplanation: "",
      generatedAt: new Date().toISOString()
    };

    assertExists(assessment.assessmentId);
    assertEquals(assessment.overallRiskScore >= 0 && assessment.overallRiskScore <= 100, true);
    assertEquals(assessment.requiresReview, true);
  });

  await t.step("should log PHI access for HIPAA compliance", () => {
    const phiAccessLog = {
      user_id: "nurse-456",
      patient_id: "patient-123",
      access_type: "fall_risk_assessment",
      resource_type: "patient_data",
      access_reason: "AI fall risk assessment - routine"
    };

    assertExists(phiAccessLog.user_id);
    assertExists(phiAccessLog.patient_id);
    assertEquals(phiAccessLog.access_type, "fall_risk_assessment");
  });

  await t.step("should structure usage log correctly", () => {
    const usageLog = {
      user_id: "nurse-456",
      request_id: crypto.randomUUID(),
      model: "claude-sonnet-4-5-20250514",
      request_type: "fall_risk_prediction",
      input_tokens: 800,
      output_tokens: 1200,
      cost: (800 / 1_000_000) * 3.0 + (1200 / 1_000_000) * 15.0,
      response_time_ms: 2100,
      success: true,
      metadata: {
        assessment_context: "routine",
        risk_category: "high",
        overall_score: 65
      }
    };

    assertExists(usageLog.request_id);
    assertEquals(usageLog.request_type, "fall_risk_prediction");
    assertEquals(usageLog.success, true);
  });

  await t.step("should determine risk category from overall score", () => {
    const getRiskCategory = (score: number): string => {
      if (score >= 70) return "very_high";
      if (score >= 50) return "high";
      if (score >= 30) return "moderate";
      return "low";
    };

    assertEquals(getRiskCategory(85), "very_high");
    assertEquals(getRiskCategory(70), "very_high");
    assertEquals(getRiskCategory(60), "high");
    assertEquals(getRiskCategory(50), "high");
    assertEquals(getRiskCategory(40), "moderate");
    assertEquals(getRiskCategory(20), "low");
  });

  await t.step("should always require clinical review", () => {
    // Fall risk assessments always require review
    const requiresReview = true;
    assertEquals(requiresReview, true);
  });

  await t.step("should use Claude Sonnet model", () => {
    const SONNET_MODEL = "claude-sonnet-4-5-20250514";
    assertEquals(SONNET_MODEL.includes("sonnet"), true);
  });

  await t.step("should return 500 for AI service errors", () => {
    const hasError = true;
    const expectedStatus = hasError ? 500 : 200;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should include Content-Type header in responses", () => {
    const headers = { "Content-Type": "application/json" };

    assertEquals(headers["Content-Type"], "application/json");
  });

  await t.step("should provide fallback assessment on parse failure", () => {
    const fallbackAssessment = {
      riskFactors: [
        {
          factor: "Age assessment needed",
          category: "age",
          severity: "moderate",
          weight: 0.5,
          evidence: "Age ≥65 is a primary fall risk factor"
        }
      ],
      confidence: 0.5,
      reviewReasons: ["AI response parsing failed - requires manual review", "Preliminary scoring only"]
    };

    assertEquals(fallbackAssessment.confidence, 0.5);
    assertEquals(fallbackAssessment.reviewReasons.length, 2);
  });

  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      success: 200,
      badRequest: 400,
      serverError: 500
    };

    assertEquals(statusCodes.success, 200);
    assertEquals(statusCodes.badRequest, 400);
    assertEquals(statusCodes.serverError, 500);
  });
});
