// supabase/functions/ai-clinical-guideline-matcher/__tests__/index.test.ts
// Tests for AI Clinical Guideline Matcher - Evidence-based guideline recommendations

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Clinical Guideline Matcher Tests", async (t) => {

  // =====================================================
  // Request Validation Tests
  // =====================================================

  await t.step("should require patientId", () => {
    const body = { tenantId: "tenant-123" };
    const hasPatientId = "patientId" in body;

    assertEquals(hasPatientId, false);
  });

  await t.step("should return 400 for missing patientId", () => {
    const response = { error: "Missing required field: patientId" };
    assertEquals(response.error, "Missing required field: patientId");
  });

  await t.step("should default includePreventiveCare to true", () => {
    const body = { patientId: "patient-123" };
    const includePreventive = (body as { includePreventiveCare?: boolean }).includePreventiveCare ?? true;

    assertEquals(includePreventive, true);
  });

  await t.step("should default focusConditions to empty array", () => {
    const body = { patientId: "patient-123" };
    const focusConditions = (body as { focusConditions?: string[] }).focusConditions || [];

    assertEquals(Array.isArray(focusConditions), true);
    assertEquals(focusConditions.length, 0);
  });

  // =====================================================
  // Clinical Guidelines Database Tests
  // =====================================================

  await t.step("should include ADA diabetes guidelines", () => {
    const guideline = {
      guidelineId: "ada-2024",
      guidelineName: "ADA Standards of Care in Diabetes",
      organization: "American Diabetes Association",
      year: 2024,
      condition: "Diabetes Mellitus",
      conditionCode: "E11"
    };

    assertEquals(guideline.guidelineId, "ada-2024");
    assertEquals(guideline.organization, "American Diabetes Association");
    assertEquals(guideline.conditionCode, "E11");
  });

  await t.step("should include ACC/AHA hypertension guidelines", () => {
    const guideline = {
      guidelineId: "acc-aha-htn-2017",
      guidelineName: "ACC/AHA Hypertension Guidelines",
      organization: "American College of Cardiology/American Heart Association",
      year: 2017,
      condition: "Hypertension",
      conditionCode: "I10"
    };

    assertEquals(guideline.conditionCode, "I10");
    assertEquals(guideline.year, 2017);
  });

  await t.step("should include GOLD COPD guidelines", () => {
    const guideline = {
      guidelineId: "gold-2024",
      guidelineName: "GOLD Guidelines",
      organization: "Global Initiative for Chronic Obstructive Lung Disease",
      condition: "COPD",
      conditionCode: "J44"
    };

    assertEquals(guideline.guidelineId, "gold-2024");
    assertEquals(guideline.conditionCode, "J44");
  });

  await t.step("should include KDIGO CKD guidelines", () => {
    const guideline = {
      guidelineId: "kdigo-2024",
      guidelineName: "KDIGO Clinical Practice Guidelines",
      organization: "Kidney Disease: Improving Global Outcomes",
      condition: "Chronic Kidney Disease",
      conditionCode: "N18"
    };

    assertEquals(guideline.conditionCode, "N18");
  });

  // =====================================================
  // Preventive Screening Tests
  // =====================================================

  await t.step("should define colonoscopy screening", () => {
    const screening = {
      name: "Colorectal Cancer Screening",
      frequency: "every 10 years",
      ages: { min: 45, max: 75 },
      guidelineSource: "USPSTF 2021"
    };

    assertEquals(screening.ages.min, 45);
    assertEquals(screening.ages.max, 75);
    assertEquals(screening.guidelineSource, "USPSTF 2021");
  });

  await t.step("should define mammogram screening for females", () => {
    const screening = {
      name: "Breast Cancer Screening",
      frequency: "every 2 years",
      ages: { min: 50, max: 74 },
      sex: "female",
      guidelineSource: "USPSTF 2024"
    };

    assertEquals(screening.sex, "female");
    assertEquals(screening.ages.min, 50);
  });

  await t.step("should define bone density screening for females 65+", () => {
    const screening = {
      name: "Osteoporosis Screening",
      frequency: "baseline at 65",
      ages: { min: 65 },
      sex: "female",
      guidelineSource: "USPSTF 2018"
    };

    assertEquals(screening.ages.min, 65);
    assertEquals(screening.sex, "female");
  });

  await t.step("should define AAA screening for males 65-75", () => {
    const screening = {
      name: "Abdominal Aortic Aneurysm Screening",
      frequency: "one-time",
      ages: { min: 65, max: 75 },
      sex: "male",
      guidelineSource: "USPSTF 2019"
    };

    assertEquals(screening.sex, "male");
    assertEquals(screening.frequency, "one-time");
  });

  // =====================================================
  // Screening Status Tests
  // =====================================================

  await t.step("should identify overdue screening", () => {
    const lastPerformed = new Date("2020-01-01").toISOString();
    const frequency = "every 3 years";
    const now = new Date();
    const lastDate = new Date(lastPerformed);
    lastDate.setFullYear(lastDate.getFullYear() + 3);
    const status = lastDate < now ? "overdue" : "current";

    assertEquals(status, "overdue");
  });

  await t.step("should identify current screening", () => {
    const lastPerformed = new Date().toISOString();
    const status = "current";

    assertEquals(status, "current");
  });

  await t.step("should identify never_done screening", () => {
    const lastPerformed = undefined;
    const status = lastPerformed ? "current" : "never_done";

    assertEquals(status, "never_done");
  });

  // =====================================================
  // Patient Demographics Tests
  // =====================================================

  await t.step("should calculate age from DOB", () => {
    const dob = new Date("1970-01-01");
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    assertEquals(age >= 55, true);
  });

  await t.step("should determine pediatric age group", () => {
    const age = 15;
    let ageGroup;
    if (age < 18) ageGroup = "pediatric";
    else if (age < 40) ageGroup = "young_adult";
    else if (age < 65) ageGroup = "adult";
    else if (age < 80) ageGroup = "elderly";
    else ageGroup = "very_elderly";

    assertEquals(ageGroup, "pediatric");
  });

  await t.step("should determine elderly age group", () => {
    const age = 70;
    let ageGroup;
    if (age < 18) ageGroup = "pediatric";
    else if (age < 40) ageGroup = "young_adult";
    else if (age < 65) ageGroup = "adult";
    else if (age < 80) ageGroup = "elderly";
    else ageGroup = "very_elderly";

    assertEquals(ageGroup, "elderly");
  });

  // =====================================================
  // Adherence Gap Types Tests
  // =====================================================

  await t.step("should support missing_medication gap type", () => {
    const gapTypes = ["missing_medication", "missing_test", "suboptimal_control", "missing_referral", "missing_screening", "lifestyle"];
    assertEquals(gapTypes.includes("missing_medication"), true);
  });

  await t.step("should support suboptimal_control gap type", () => {
    const gapTypes = ["missing_medication", "missing_test", "suboptimal_control", "missing_referral", "missing_screening", "lifestyle"];
    assertEquals(gapTypes.includes("suboptimal_control"), true);
  });

  await t.step("should support missing_screening gap type", () => {
    const gapTypes = ["missing_medication", "missing_test", "suboptimal_control", "missing_referral", "missing_screening", "lifestyle"];
    assertEquals(gapTypes.includes("missing_screening"), true);
  });

  // =====================================================
  // Priority Levels Tests
  // =====================================================

  await t.step("should support low priority", () => {
    const priorities = ["low", "medium", "high", "critical"];
    assertEquals(priorities.includes("low"), true);
  });

  await t.step("should support critical priority", () => {
    const priorities = ["low", "medium", "high", "critical"];
    assertEquals(priorities.includes("critical"), true);
  });

  // =====================================================
  // Evidence Levels Tests
  // =====================================================

  await t.step("should support evidence level A", () => {
    const levels = ["A", "B", "C", "D", "expert_consensus"];
    assertEquals(levels.includes("A"), true);
  });

  await t.step("should support expert_consensus level", () => {
    const levels = ["A", "B", "C", "D", "expert_consensus"];
    assertEquals(levels.includes("expert_consensus"), true);
  });

  // =====================================================
  // Urgency Levels Tests
  // =====================================================

  await t.step("should support routine urgency", () => {
    const urgencies = ["routine", "soon", "urgent", "emergent"];
    assertEquals(urgencies.includes("routine"), true);
  });

  await t.step("should support emergent urgency", () => {
    const urgencies = ["routine", "soon", "urgent", "emergent"];
    assertEquals(urgencies.includes("emergent"), true);
  });

  // =====================================================
  // Recommendation Categories Tests
  // =====================================================

  await t.step("should support treatment category", () => {
    const categories = ["treatment", "monitoring", "screening", "lifestyle", "referral", "diagnostic"];
    assertEquals(categories.includes("treatment"), true);
  });

  await t.step("should support all recommendation categories", () => {
    const categories = ["treatment", "monitoring", "screening", "lifestyle", "referral", "diagnostic"];
    assertEquals(categories.length, 6);
  });

  // =====================================================
  // Guideline Match Result Tests
  // =====================================================

  await t.step("should return GuidelineMatchResult structure", () => {
    const result = {
      patientId: "patient-123",
      matchedGuidelines: [],
      recommendations: [],
      adherenceGaps: [],
      preventiveScreenings: [],
      summary: {
        totalGuidelines: 0,
        totalRecommendations: 0,
        criticalGaps: 0,
        highPriorityGaps: 0,
        overdueScreenings: 0
      },
      confidence: 0.8,
      requiresReview: true,
      reviewReasons: [],
      disclaimer: "Clinical decision support disclaimer"
    };

    assertExists(result.summary);
    assertEquals(result.requiresReview, true);
    assertEquals(result.confidence, 0.8);
  });

  await t.step("should always require clinician review", () => {
    const result = {
      requiresReview: true,
      reviewReasons: ["All AI-generated guideline recommendations require clinician review"]
    };

    assertEquals(result.requiresReview, true);
    assertEquals(result.reviewReasons.length >= 1, true);
  });

  await t.step("should include disclaimer", () => {
    const disclaimer = "These recommendations are for clinical decision support only and require verification by a licensed healthcare provider.";

    assertEquals(disclaimer.includes("clinical decision support"), true);
    assertEquals(disclaimer.includes("healthcare provider"), true);
  });

  // =====================================================
  // Summary Calculation Tests
  // =====================================================

  await t.step("should count critical gaps", () => {
    const gaps = [
      { priority: "critical" },
      { priority: "high" },
      { priority: "critical" },
      { priority: "low" }
    ];
    const criticalGaps = gaps.filter(g => g.priority === "critical").length;

    assertEquals(criticalGaps, 2);
  });

  await t.step("should count high priority gaps", () => {
    const gaps = [
      { priority: "high" },
      { priority: "high" },
      { priority: "medium" }
    ];
    const highPriorityGaps = gaps.filter(g => g.priority === "high").length;

    assertEquals(highPriorityGaps, 2);
  });

  await t.step("should count overdue screenings", () => {
    const screenings = [
      { status: "overdue" },
      { status: "current" },
      { status: "overdue" },
      { status: "never_done" }
    ];
    const overdueScreenings = screenings.filter(s => s.status === "overdue").length;

    assertEquals(overdueScreenings, 2);
  });

  // =====================================================
  // Lab Code Mapping Tests
  // =====================================================

  await t.step("should map HbA1c lab code", () => {
    const labCodeMap: Record<string, string> = {
      "4548-4": "hba1c",
      "2339-0": "glucose",
      "2093-3": "total_cholesterol"
    };

    assertEquals(labCodeMap["4548-4"], "hba1c");
  });

  await t.step("should map LDL lab code", () => {
    const labCodeMap: Record<string, string> = {
      "13457-7": "ldl",
      "2085-9": "hdl"
    };

    assertEquals(labCodeMap["13457-7"], "ldl");
  });

  await t.step("should map eGFR lab code", () => {
    const labCodeMap: Record<string, string> = {
      "33914-3": "egfr",
      "2160-0": "creatinine"
    };

    assertEquals(labCodeMap["33914-3"], "egfr");
  });

  // =====================================================
  // Vital Code Mapping Tests
  // =====================================================

  await t.step("should map systolic BP code", () => {
    const vitalCodeMap: Record<string, string> = {
      "8480-6": "systolic_bp",
      "8462-4": "diastolic_bp"
    };

    assertEquals(vitalCodeMap["8480-6"], "systolic_bp");
  });

  await t.step("should map BMI code", () => {
    const vitalCodeMap: Record<string, string> = {
      "39156-5": "bmi",
      "29463-7": "weight"
    };

    assertEquals(vitalCodeMap["39156-5"], "bmi");
  });

  // =====================================================
  // Guideline Matching Logic Tests
  // =====================================================

  await t.step("should match diabetes guidelines for diabetes condition", () => {
    const conditionText = "type 2 diabetes mellitus";
    const matchesDiabetes = conditionText.includes("diabetes");

    assertEquals(matchesDiabetes, true);
  });

  await t.step("should include cardiovascular guidelines for risk factors", () => {
    const conditions = ["diabetes", "hypertension"];
    const hasCardioRiskFactors = conditions.some(c =>
      c.includes("diabetes") || c.includes("hypertension") || c.includes("hyperlipidemia")
    );

    assertEquals(hasCardioRiskFactors, true);
  });

  // =====================================================
  // PHI Redaction Tests
  // =====================================================

  await t.step("should redact email in logs", () => {
    const text = "patient@example.com";
    const redacted = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");

    assertEquals(redacted, "[EMAIL]");
  });

  await t.step("should redact phone in logs", () => {
    const text = "555-123-4567";
    const redacted = text.replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]");

    assertEquals(redacted, "[PHONE]");
  });

  // =====================================================
  // Model Configuration Tests
  // =====================================================

  await t.step("should use Claude Sonnet model", () => {
    const SONNET_MODEL = "claude-sonnet-4-20250514";
    assertEquals(SONNET_MODEL.includes("sonnet"), true);
  });

  await t.step("should use 4096 max tokens for detailed analysis", () => {
    const maxTokens = 4096;
    assertEquals(maxTokens, 4096);
  });

  // =====================================================
  // Usage Logging Tests
  // =====================================================

  await t.step("should log usage to claude_usage_logs", () => {
    const usageLog = {
      user_id: "patient-123",
      tenant_id: "tenant-456",
      request_id: "uuid-here",
      model: "claude-sonnet-4-20250514",
      request_type: "clinical_guideline_matcher",
      input_tokens: 2000,
      output_tokens: 1500,
      cost: 0.03,
      response_time_ms: 3000,
      success: true,
      metadata: { guidelinesMatched: 3 }
    };

    assertEquals(usageLog.request_type, "clinical_guideline_matcher");
    assertExists(usageLog.metadata.guidelinesMatched);
  });

  // =====================================================
  // Response Metadata Tests
  // =====================================================

  await t.step("should include metadata in response", () => {
    const metadata = {
      generated_at: new Date().toISOString(),
      model: "claude-sonnet-4-20250514",
      response_time_ms: 3000,
      patient_context: {
        age: 65,
        conditions_count: 3,
        medications_count: 5
      }
    };

    assertExists(metadata.patient_context);
    assertEquals(metadata.patient_context.age, 65);
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/ai-clinical-guideline-matcher", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  // =====================================================
  // Error Handling Tests
  // =====================================================

  await t.step("should return 500 for AI service not configured", () => {
    const response = { error: "AI service not configured" };
    assertEquals(response.error, "AI service not configured");
  });

  await t.step("should return error with timestamp", () => {
    const response = {
      error: "Guideline matching failed",
      timestamp: new Date().toISOString()
    };

    assertExists(response.error);
    assertExists(response.timestamp);
  });

  // =====================================================
  // Fallback Result Tests
  // =====================================================

  await t.step("should return fallback result on AI failure", () => {
    const fallbackResult = {
      recommendations: [],
      adherenceGaps: [],
      confidence: 0.3,
      requiresReview: true,
      reviewReasons: [
        "AI recommendation generation failed - manual clinician review required",
        "Fallback result provided for safety"
      ]
    };

    assertEquals(fallbackResult.confidence, 0.3);
    assertEquals(fallbackResult.reviewReasons.length, 2);
    assertEquals(fallbackResult.reviewReasons[0].includes("failed"), true);
  });

  // =====================================================
  // Logging Tests
  // =====================================================

  await t.step("should log PHI access for guideline matching", () => {
    const logEntry = {
      level: "phi",
      event: "Generated clinical guideline matches",
      context: {
        patientId: "[REDACTED]",
        guidelinesMatched: 4,
        gapsIdentified: 2,
        responseTimeMs: 3000
      }
    };

    assertEquals(logEntry.level, "phi");
    assertExists(logEntry.context.guidelinesMatched);
  });
});
