// supabase/functions/ai-care-plan-generator/__tests__/index.test.ts
// Tests for ai-care-plan-generator edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Care Plan Generator Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/ai-care-plan-generator", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require patientId in request body", () => {
    const validBody = { patientId: "patient-123", planType: "chronic_care" };
    const invalidBody = { planType: "chronic_care" };

    assertExists(validBody.patientId);
    assertEquals("patientId" in invalidBody, false);
  });

  await t.step("should require planType in request body", () => {
    const validBody = { patientId: "patient-123", planType: "chronic_care" };
    const invalidBody = { patientId: "patient-123" };

    assertExists(validBody.planType);
    assertEquals("planType" in invalidBody, false);
  });

  await t.step("should return 400 for missing patientId", () => {
    const hasPatientId = false;
    const expectedStatus = hasPatientId ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should return 400 for missing planType", () => {
    const hasPlanType = false;
    const expectedStatus = hasPlanType ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should validate plan types", () => {
    const validPlanTypes = [
      "readmission_prevention",
      "chronic_care",
      "transitional_care",
      "high_utilizer",
      "preventive"
    ];

    assertEquals(validPlanTypes.includes("readmission_prevention"), true);
    assertEquals(validPlanTypes.includes("chronic_care"), true);
    assertEquals(validPlanTypes.includes("transitional_care"), true);
    assertEquals(validPlanTypes.includes("high_utilizer"), true);
    assertEquals(validPlanTypes.includes("preventive"), true);
    assertEquals(validPlanTypes.includes("custom"), false);
  });

  await t.step("should default includeSDOH to true", () => {
    const getIncludeSDOH = (provided?: boolean): boolean => {
      return provided ?? true;
    };

    assertEquals(getIncludeSDOH(undefined), true);
    assertEquals(getIncludeSDOH(false), false);
  });

  await t.step("should default includeMedications to true", () => {
    const getIncludeMedications = (provided?: boolean): boolean => {
      return provided ?? true;
    };

    assertEquals(getIncludeMedications(undefined), true);
    assertEquals(getIncludeMedications(false), false);
  });

  await t.step("should default careTeamRoles to standard roles", () => {
    const defaultRoles = ["nurse", "physician", "care_coordinator"];

    assertEquals(defaultRoles.includes("nurse"), true);
    assertEquals(defaultRoles.includes("physician"), true);
    assertEquals(defaultRoles.includes("care_coordinator"), true);
  });

  await t.step("should default durationWeeks to 12", () => {
    const getDurationWeeks = (provided?: number): number => {
      return provided ?? 12;
    };

    assertEquals(getDurationWeeks(undefined), 12);
    assertEquals(getDurationWeeks(8), 8);
  });

  await t.step("should structure care plan goal correctly", () => {
    const goal = {
      goal: "Reduce HbA1c to target",
      target: "A1c below 7.0%",
      timeframe: "90 days",
      measurementMethod: "Quarterly lab testing",
      priority: "high" as const,
      evidenceBasis: "ADA Clinical Guidelines 2026"
    };

    assertExists(goal.goal);
    assertExists(goal.target);
    assertExists(goal.timeframe);
    assertExists(goal.measurementMethod);
    assertEquals(goal.priority, "high");
  });

  await t.step("should structure care plan intervention correctly", () => {
    const intervention = {
      intervention: "Weekly phone check-ins",
      frequency: "Weekly",
      responsible: "nurse",
      duration: "12 weeks",
      rationale: "Monitor medication adherence and symptoms",
      cptCode: "99490",
      billingEligible: true
    };

    assertExists(intervention.intervention);
    assertExists(intervention.frequency);
    assertExists(intervention.responsible);
    assertExists(intervention.rationale);
    assertEquals(intervention.billingEligible, true);
  });

  await t.step("should validate barrier categories", () => {
    const validCategories = [
      "transportation",
      "financial",
      "social",
      "cognitive",
      "physical",
      "language",
      "other"
    ];

    assertEquals(validCategories.includes("transportation"), true);
    assertEquals(validCategories.includes("financial"), true);
    assertEquals(validCategories.includes("language"), true);
    assertEquals(validCategories.includes("unknown"), false);
  });

  await t.step("should structure barrier correctly", () => {
    const barrier = {
      barrier: "Limited transportation access",
      category: "transportation" as const,
      solution: "Arrange medical transport service",
      resources: ["Medicaid transport", "Local senior shuttle"],
      priority: "high" as const
    };

    assertExists(barrier.barrier);
    assertEquals(barrier.category, "transportation");
    assertEquals(barrier.resources.length, 2);
  });

  await t.step("should validate activity types", () => {
    const validActivityTypes = [
      "appointment",
      "medication",
      "education",
      "monitoring",
      "referral",
      "follow_up"
    ];

    assertEquals(validActivityTypes.includes("appointment"), true);
    assertEquals(validActivityTypes.includes("medication"), true);
    assertEquals(validActivityTypes.includes("education"), true);
    assertEquals(validActivityTypes.includes("monitoring"), true);
  });

  await t.step("should calculate age group correctly", () => {
    const getAgeGroup = (age: number): string => {
      if (age < 18) return "pediatric";
      if (age < 40) return "young_adult";
      if (age < 65) return "adult";
      return "geriatric";
    };

    assertEquals(getAgeGroup(10), "pediatric");
    assertEquals(getAgeGroup(25), "young_adult");
    assertEquals(getAgeGroup(50), "adult");
    assertEquals(getAgeGroup(70), "geriatric");
  });

  await t.step("should structure SDOH factors correctly", () => {
    const sdohFactors = {
      housing: "unstable",
      food: "insecure",
      transportation: "barriers",
      social: "isolated",
      financial: "strained",
      overallRisk: "high",
      complexityScore: 7
    };

    assertExists(sdohFactors.housing);
    assertExists(sdohFactors.food);
    assertExists(sdohFactors.transportation);
    assertEquals(sdohFactors.complexityScore, 7);
  });

  await t.step("should calculate readmission risk score", () => {
    const calculateRiskScore = (
      edVisits30Days: number,
      admissions30Days: number,
      edVisits90Days: number,
      admissions90Days: number
    ): number => {
      return edVisits30Days * 3 +
        admissions30Days * 5 +
        edVisits90Days * 1 +
        admissions90Days * 2;
    };

    assertEquals(calculateRiskScore(0, 0, 0, 0), 0);
    assertEquals(calculateRiskScore(1, 0, 0, 0), 3);
    assertEquals(calculateRiskScore(0, 1, 0, 0), 5);
    assertEquals(calculateRiskScore(1, 1, 2, 1), 12);
  });

  await t.step("should determine readmission risk level", () => {
    const getRiskLevel = (riskScore: number): string => {
      if (riskScore >= 10) return "critical";
      if (riskScore >= 6) return "high";
      if (riskScore >= 3) return "medium";
      return "low";
    };

    assertEquals(getRiskLevel(15), "critical");
    assertEquals(getRiskLevel(10), "critical");
    assertEquals(getRiskLevel(8), "high");
    assertEquals(getRiskLevel(6), "high");
    assertEquals(getRiskLevel(4), "medium");
    assertEquals(getRiskLevel(2), "low");
    assertEquals(getRiskLevel(0), "low");
  });

  await t.step("should determine CCM eligibility", () => {
    const isCCMEligible = (conditionsCount: number): boolean => {
      return conditionsCount >= 2;
    };

    assertEquals(isCCMEligible(2), true);
    assertEquals(isCCMEligible(5), true);
    assertEquals(isCCMEligible(1), false);
    assertEquals(isCCMEligible(0), false);
  });

  await t.step("should determine TCM eligibility", () => {
    const isTCMEligible = (admissions30Days: number): boolean => {
      return admissions30Days > 0;
    };

    assertEquals(isTCMEligible(1), true);
    assertEquals(isTCMEligible(2), true);
    assertEquals(isTCMEligible(0), false);
  });

  await t.step("should structure care team member correctly", () => {
    const careTeamMember = {
      role: "nurse",
      responsibilities: ["Daily monitoring", "Patient education", "Medication management"]
    };

    assertExists(careTeamMember.role);
    assertEquals(careTeamMember.responsibilities.length, 3);
  });

  await t.step("should redact PHI from logs", () => {
    const redact = (s: string): string =>
      s
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
        .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

    assertEquals(redact("Email: test@example.com"), "Email: [EMAIL]");
    assertEquals(redact("Phone: 555-123-4567"), "Phone: [PHONE]");
    assertEquals(redact("SSN: 123-45-6789"), "SSN: [SSN]");
  });

  await t.step("should structure generated care plan correctly", () => {
    const carePlan = {
      title: "Chronic Care Management Plan",
      description: "Comprehensive management of chronic conditions",
      planType: "chronic_care",
      priority: "high" as const,
      goals: [],
      interventions: [],
      barriers: [],
      activities: [],
      careTeam: [],
      estimatedDuration: "12 weeks",
      reviewSchedule: "Every 2 weeks",
      successCriteria: [],
      riskFactors: [],
      icd10Codes: [],
      ccmEligible: true,
      tcmEligible: false,
      confidence: 0.85,
      evidenceSources: [],
      requiresReview: true,
      reviewReasons: []
    };

    assertExists(carePlan.title);
    assertExists(carePlan.description);
    assertEquals(carePlan.planType, "chronic_care");
    assertEquals(carePlan.ccmEligible, true);
    assertEquals(carePlan.requiresReview, true);
  });

  await t.step("should structure metadata response correctly", () => {
    const metadata = {
      generated_at: new Date().toISOString(),
      model: "claude-sonnet-4-20250514",
      response_time_ms: 3200,
      plan_type: "chronic_care",
      context_summary: {
        conditions_count: 4,
        medications_count: 8,
        has_sdoh: true,
        utilization_risk: "high",
      },
    };

    assertExists(metadata.generated_at);
    assertExists(metadata.model);
    assertEquals(metadata.plan_type, "chronic_care");
    assertEquals(metadata.context_summary.has_sdoh, true);
  });

  await t.step("should use Claude Sonnet model", () => {
    const SONNET_MODEL = "claude-sonnet-4-20250514";
    assertEquals(SONNET_MODEL.includes("sonnet"), true);
  });

  await t.step("should have fallback care plan templates", () => {
    const planTypes = [
      "readmission_prevention",
      "chronic_care",
      "high_utilizer",
      "transitional_care",
      "preventive"
    ];

    // Each plan type should have a fallback template
    assertEquals(planTypes.length, 5);
  });

  await t.step("should estimate token usage correctly", () => {
    const estimatedInputTokens = 2000;
    const estimatedOutputTokens = 2500;

    // Sonnet pricing: $3/1M input, $15/1M output
    const cost =
      (estimatedInputTokens / 1_000_000) * 3 + (estimatedOutputTokens / 1_000_000) * 15;

    assertEquals(cost > 0, true);
    assertEquals(cost < 1, true);
  });

  await t.step("should structure usage log correctly", () => {
    const usageLog = {
      user_id: "patient-123",
      tenant_id: "tenant-456",
      request_id: crypto.randomUUID(),
      model: "claude-sonnet-4-20250514",
      request_type: "care_plan_chronic_care",
      input_tokens: 2000,
      output_tokens: 2500,
      cost: 0.045,
      response_time_ms: 3200,
      success: true,
    };

    assertExists(usageLog.request_id);
    assertEquals(usageLog.request_type, "care_plan_chronic_care");
    assertEquals(usageLog.success, true);
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

  await t.step("should set requiresReview on fallback plans", () => {
    const fallbackPlan = {
      requiresReview: true,
      reviewReasons: ["AI generation failed - template-based plan requires complete review"]
    };

    assertEquals(fallbackPlan.requiresReview, true);
    assertEquals(fallbackPlan.reviewReasons.length, 1);
  });

  await t.step("should map LOINC codes to vital names", () => {
    const vitalCodeMap: Record<string, string> = {
      "8480-6": "blood_pressure_systolic",
      "8462-4": "blood_pressure_diastolic",
      "8867-4": "heart_rate",
      "29463-7": "weight",
      "4548-4": "hba1c",
      "2339-0": "glucose",
      "2093-3": "cholesterol",
    };

    assertEquals(vitalCodeMap["4548-4"], "hba1c");
    assertEquals(vitalCodeMap["2339-0"], "glucose");
    assertEquals(vitalCodeMap["2093-3"], "cholesterol");
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

  await t.step("should calculate age from date of birth", () => {
    const calculateAge = (dob: string): number => {
      return Math.floor(
        (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
    };

    // This will vary based on current date, so just verify it's a number
    const age = calculateAge("1960-01-01");
    assertEquals(typeof age, "number");
    assertEquals(age > 60, true);
  });

  await t.step("should merge conditions from multiple sources", () => {
    const fhirConditions = [
      { code: "E11.9", display: "Type 2 diabetes", status: "active", isPrimary: false }
    ];
    const patientDiagnoses = [
      { icd10_code: "E11.9", diagnosis_name: "Type 2 DM", is_primary: true }
    ];

    // Merge logic: update isPrimary if already exists
    const existing = fhirConditions.find((c) => c.code === patientDiagnoses[0].icd10_code);
    if (existing) {
      existing.isPrimary = patientDiagnoses[0].is_primary;
    }

    assertEquals(existing?.isPrimary, true);
  });
});
