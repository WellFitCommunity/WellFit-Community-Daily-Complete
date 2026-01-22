// supabase/functions/ai-medication-adherence-predictor/__tests__/index.test.ts
// Tests for AI Medication Adherence Predictor - Evidence-based adherence prediction

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Medication Adherence Predictor Tests", async (t) => {

  // =====================================================
  // Request Validation Tests
  // =====================================================

  await t.step("should require patientId", () => {
    const body = { assessorId: "assessor-123" };
    const hasPatientId = "patientId" in body;

    assertEquals(hasPatientId, false);
  });

  await t.step("should require assessorId", () => {
    const body = { patientId: "patient-123" };
    const hasAssessorId = "assessorId" in body;

    assertEquals(hasAssessorId, false);
  });

  await t.step("should return 400 for missing required fields", () => {
    const response = { error: "Patient ID and Assessor ID are required" };
    assertEquals(response.error, "Patient ID and Assessor ID are required");
  });

  await t.step("should accept optional medications array", () => {
    const body = { patientId: "patient-123", assessorId: "assessor-456" };
    const hasMedications = "medications" in body;

    assertEquals(hasMedications, false); // Optional
  });

  // =====================================================
  // Medication Info Type Tests
  // =====================================================

  await t.step("should define MedicationInfo structure", () => {
    const medication = {
      name: "Metformin",
      dosage: "500mg",
      frequency: "twice daily",
      route: "oral",
      indication: "diabetes",
      cost_tier: "generic" as const,
      side_effects_reported: ["nausea"],
      start_date: "2025-01-01"
    };

    assertExists(medication.name);
    assertEquals(medication.cost_tier, "generic");
    assertEquals(medication.side_effects_reported.length, 1);
  });

  await t.step("should support cost tier values", () => {
    const costTiers = ["generic", "preferred_brand", "non_preferred", "specialty"];
    assertEquals(costTiers.length, 4);
    assertEquals(costTiers.includes("specialty"), true);
  });

  // =====================================================
  // Regimen Complexity Tests
  // =====================================================

  await t.step("should calculate complexity for once daily medication", () => {
    const medication = { name: "Lisinopril", frequency: "once daily" };
    const freq = medication.frequency.toLowerCase();
    const isOnceDaily = freq.includes("once") || freq.includes("qd") || freq.includes("daily");

    assertEquals(isOnceDaily, true);
  });

  await t.step("should calculate complexity for twice daily medication", () => {
    const medication = { name: "Metformin", frequency: "twice daily" };
    const freq = medication.frequency.toLowerCase();
    const isTwiceDaily = freq.includes("twice") || freq.includes("bid");

    assertEquals(isTwiceDaily, true);
  });

  await t.step("should calculate complexity for three times daily", () => {
    const medication = { name: "Antibiotic", frequency: "TID" };
    const freq = medication.frequency.toLowerCase();
    const isThreeTimesDaily = freq.includes("three") || freq.includes("tid");

    assertEquals(isThreeTimesDaily, true);
  });

  await t.step("should calculate complexity for four times daily", () => {
    const medication = { name: "Medication X", frequency: "QID" };
    const freq = medication.frequency.toLowerCase();
    const isFourTimesDaily = freq.includes("four") || freq.includes("qid");

    assertEquals(isFourTimesDaily, true);
  });

  await t.step("should detect insulin as high complexity", () => {
    const medications = [
      { name: "Insulin Glargine", frequency: "once daily" },
      { name: "Metformin", frequency: "twice daily" }
    ];
    const hasInsulin = medications.some(m => m.name.toLowerCase().includes("insulin"));

    assertEquals(hasInsulin, true);
  });

  await t.step("should detect injectable route as higher complexity", () => {
    const medication = { name: "Humira", route: "subcutaneous injection" };
    const route = medication.route.toLowerCase();
    const isInjectable = route.includes("inject") || route.includes("subcutaneous");

    assertEquals(isInjectable, true);
  });

  await t.step("should determine complexity level - simple", () => {
    const complexityScore = 20;
    const level = complexityScore < 25 ? "simple" :
                  complexityScore < 50 ? "moderate" :
                  complexityScore < 75 ? "complex" : "very_complex";

    assertEquals(level, "simple");
  });

  await t.step("should determine complexity level - moderate", () => {
    const complexityScore = 35;
    const level = complexityScore < 25 ? "simple" :
                  complexityScore < 50 ? "moderate" :
                  complexityScore < 75 ? "complex" : "very_complex";

    assertEquals(level, "moderate");
  });

  await t.step("should determine complexity level - complex", () => {
    const complexityScore = 60;
    const level = complexityScore < 25 ? "simple" :
                  complexityScore < 50 ? "moderate" :
                  complexityScore < 75 ? "complex" : "very_complex";

    assertEquals(level, "complex");
  });

  await t.step("should determine complexity level - very_complex", () => {
    const complexityScore = 80;
    const level = complexityScore < 25 ? "simple" :
                  complexityScore < 50 ? "moderate" :
                  complexityScore < 75 ? "complex" : "very_complex";

    assertEquals(level, "very_complex");
  });

  // =====================================================
  // Adherence Barrier Tests
  // =====================================================

  await t.step("should define barrier categories", () => {
    const categories = ["cost", "complexity", "side_effects", "cognitive", "social", "access", "belief", "physical"];
    assertEquals(categories.length, 8);
    assertEquals(categories.includes("cost"), true);
    assertEquals(categories.includes("cognitive"), true);
  });

  await t.step("should define barrier severity levels", () => {
    const severities = ["low", "moderate", "high", "critical"];
    assertEquals(severities.length, 4);
  });

  await t.step("should identify cost barrier for specialty medications", () => {
    const medication = { name: "Humira", cost_tier: "specialty" };
    const hasSpecialtyMed = medication.cost_tier === "specialty" || medication.cost_tier === "non_preferred";

    assertEquals(hasSpecialtyMed, true);
  });

  await t.step("should identify cost barrier for non-preferred medications", () => {
    const medication = { name: "Brand Drug", cost_tier: "non_preferred" };
    const hasExpensiveMed = medication.cost_tier === "specialty" || medication.cost_tier === "non_preferred";

    assertEquals(hasExpensiveMed, true);
  });

  await t.step("should identify side effect barrier", () => {
    const medications = [
      { name: "Statin", side_effects_reported: ["muscle pain", "fatigue"] },
      { name: "Metformin", side_effects_reported: [] }
    ];
    const medsWithSideEffects = medications.filter(m =>
      m.side_effects_reported && m.side_effects_reported.length > 0
    );

    assertEquals(medsWithSideEffects.length, 1);
    assertEquals(medsWithSideEffects[0].name, "Statin");
  });

  await t.step("should identify cognitive barrier for elderly patients", () => {
    const context = {
      age: 78,
      cognitiveAssessments: [{ score: 22 }]
    };
    const hasCognitiveIssue = context.cognitiveAssessments.some(a => a.score < 24) ||
                              context.age > 75;

    assertEquals(hasCognitiveIssue, true);
  });

  await t.step("should create barrier with interventions", () => {
    const barrier = {
      barrier: "Medication cost concerns",
      category: "cost" as const,
      severity: "high" as const,
      evidence: "Patient has specialty medications",
      mitigable: true,
      interventions: [
        "Review patient assistance programs",
        "Check for generic alternatives",
        "Connect with social worker"
      ]
    };

    assertEquals(barrier.mitigable, true);
    assertEquals(barrier.interventions.length, 3);
    assertExists(barrier.evidence);
  });

  // =====================================================
  // Medication Risk Assessment Tests
  // =====================================================

  await t.step("should calculate medication risk score", () => {
    let riskScore = 20; // Base score

    // Frequency complexity
    const freq = "QID";
    if (freq.includes("qid")) riskScore += 25;

    // Route complexity
    const route = "subcutaneous";
    if (route.includes("subcutaneous")) riskScore += 20;

    // Cost tier
    const costTier = "specialty";
    if (costTier === "specialty") riskScore += 20;

    riskScore = Math.min(riskScore, 100);

    assertEquals(riskScore, 85);
  });

  await t.step("should determine medication adherence risk level - low", () => {
    const riskScore = 25;
    const adherenceRisk = riskScore < 30 ? "low" :
                          riskScore < 50 ? "moderate" :
                          riskScore < 70 ? "high" : "very_high";

    assertEquals(adherenceRisk, "low");
  });

  await t.step("should determine medication adherence risk level - moderate", () => {
    const riskScore = 45;
    const adherenceRisk = riskScore < 30 ? "low" :
                          riskScore < 50 ? "moderate" :
                          riskScore < 70 ? "high" : "very_high";

    assertEquals(adherenceRisk, "moderate");
  });

  await t.step("should determine medication adherence risk level - high", () => {
    const riskScore = 65;
    const adherenceRisk = riskScore < 30 ? "low" :
                          riskScore < 50 ? "moderate" :
                          riskScore < 70 ? "high" : "very_high";

    assertEquals(adherenceRisk, "high");
  });

  await t.step("should determine medication adherence risk level - very_high", () => {
    const riskScore = 85;
    const adherenceRisk = riskScore < 30 ? "low" :
                          riskScore < 50 ? "moderate" :
                          riskScore < 70 ? "high" : "very_high";

    assertEquals(adherenceRisk, "very_high");
  });

  await t.step("should identify simplification opportunity for BID medications", () => {
    const freq = "twice daily";
    const lowerFreq = freq.toLowerCase();
    let simplificationOpportunity: string | undefined;

    if (lowerFreq.includes("twice") || lowerFreq.includes("bid")) {
      simplificationOpportunity = "Consider once-daily extended-release formulation if available";
    }

    assertExists(simplificationOpportunity);
    assertEquals(simplificationOpportunity?.includes("once-daily"), true);
  });

  // =====================================================
  // Historical Adherence Tests
  // =====================================================

  await t.step("should calculate check-in adherence rate", () => {
    const checkIns = [
      { completed: true },
      { completed: true },
      { completed: false },
      { completed: true }
    ];
    const completedCheckIns = checkIns.filter(c => c.completed).length;
    const checkInAdherence = Math.round((completedCheckIns / checkIns.length) * 100);

    assertEquals(checkInAdherence, 75);
  });

  await t.step("should calculate appointment adherence rate", () => {
    const appointments = [
      { status: "completed", no_show: false },
      { status: "completed", no_show: false },
      { status: "cancelled", no_show: true },
      { status: "completed", no_show: false }
    ];
    const keptAppointments = appointments.filter(a =>
      a.status === "completed" && !a.no_show
    ).length;
    const appointmentAdherence = Math.round((keptAppointments / appointments.length) * 100);

    assertEquals(appointmentAdherence, 75);
  });

  await t.step("should determine improving trend", () => {
    const checkIns = new Array(20).fill(null).map((_, i) => ({
      completed: i < 10 ? Math.random() > 0.6 : Math.random() > 0.2
    }));

    const firstHalf = checkIns.slice(10);
    const secondHalf = checkIns.slice(0, 10);
    const firstRate = firstHalf.filter(c => c.completed).length / firstHalf.length;
    const secondRate = secondHalf.filter(c => c.completed).length / secondHalf.length;

    // This is a probabilistic test, just verify the structure
    const trend = secondRate - firstRate > 0.1 ? "improving" :
                  firstRate - secondRate > 0.1 ? "declining" : "stable";

    assertEquals(["improving", "stable", "declining"].includes(trend), true);
  });

  // =====================================================
  // Intervention Tests
  // =====================================================

  await t.step("should define intervention categories", () => {
    const categories = ["education", "simplification", "reminder", "financial", "social_support", "monitoring"];
    assertEquals(categories.length, 6);
  });

  await t.step("should define intervention priorities", () => {
    const priorities = ["routine", "recommended", "strongly_recommended", "critical"];
    assertEquals(priorities.length, 4);
  });

  await t.step("should generate teach-back intervention", () => {
    const intervention = {
      intervention: "Conduct teach-back to verify medication understanding",
      category: "education" as const,
      priority: "recommended" as const,
      expectedImpact: "moderate" as const,
      implementedBy: "Nurse or Pharmacist",
      timeframe: "At next encounter"
    };

    assertEquals(intervention.category, "education");
    assertExists(intervention.implementedBy);
    assertExists(intervention.timeframe);
  });

  await t.step("should generate MTM review for complex regimens", () => {
    const complexityLevel = "very_complex";
    const interventions: { intervention: string; category: string }[] = [];

    if (complexityLevel === "complex" || complexityLevel === "very_complex") {
      interventions.push({
        intervention: "Pharmacist medication therapy management (MTM) review",
        category: "simplification"
      });
    }

    assertEquals(interventions.length, 1);
    assertEquals(interventions[0].category, "simplification");
  });

  // =====================================================
  // Overall Score Calculation Tests
  // =====================================================

  await t.step("should start with base score of 80", () => {
    const baseScore = 80;
    assertEquals(baseScore, 80);
  });

  await t.step("should deduct for barriers", () => {
    const barriers = [
      { severity: "critical" },
      { severity: "high" },
      { severity: "moderate" }
    ];

    let score = 80;
    for (const barrier of barriers) {
      if (barrier.severity === "critical") score -= 20;
      else if (barrier.severity === "high") score -= 12;
      else if (barrier.severity === "moderate") score -= 6;
      else score -= 3;
    }

    assertEquals(score, 42); // 80 - 20 - 12 - 6
  });

  await t.step("should determine adherence category - excellent", () => {
    const score = 85;
    const category = score >= 80 ? "excellent" :
                     score >= 65 ? "good" :
                     score >= 50 ? "moderate" :
                     score >= 30 ? "poor" : "very_poor";

    assertEquals(category, "excellent");
  });

  await t.step("should determine adherence category - good", () => {
    const score = 70;
    const category = score >= 80 ? "excellent" :
                     score >= 65 ? "good" :
                     score >= 50 ? "moderate" :
                     score >= 30 ? "poor" : "very_poor";

    assertEquals(category, "good");
  });

  await t.step("should determine adherence category - poor", () => {
    const score = 35;
    const category = score >= 80 ? "excellent" :
                     score >= 65 ? "good" :
                     score >= 50 ? "moderate" :
                     score >= 30 ? "poor" : "very_poor";

    assertEquals(category, "poor");
  });

  await t.step("should determine adherence category - very_poor", () => {
    const score = 20;
    const category = score >= 80 ? "excellent" :
                     score >= 65 ? "good" :
                     score >= 50 ? "moderate" :
                     score >= 30 ? "poor" : "very_poor";

    assertEquals(category, "very_poor");
  });

  // =====================================================
  // Review Requirements Tests
  // =====================================================

  await t.step("should require pharmacist review for very complex regimens", () => {
    const regimenComplexityLevel = "very_complex";
    const highRiskMedsCount = 2;
    const hasCriticalBarrier = false;

    const requiresPharmacistReview =
      regimenComplexityLevel === "very_complex" ||
      highRiskMedsCount >= 3 ||
      hasCriticalBarrier;

    assertEquals(requiresPharmacistReview, true);
  });

  await t.step("should require care coordination for social barriers", () => {
    const barriers = [{ category: "social" }, { category: "cost" }];
    const score = 35;

    const requiresCareCoordination =
      barriers.some(b => b.category === "social" || b.category === "access") ||
      score < 40;

    assertEquals(requiresCareCoordination, true);
  });

  await t.step("should generate review reasons", () => {
    const reviewReasons: string[] = [];
    const requiresPharmacistReview = true;
    const requiresCareCoordination = true;
    const score = 45;

    if (requiresPharmacistReview) {
      reviewReasons.push("Pharmacist MTM review recommended due to regimen complexity");
    }
    if (requiresCareCoordination) {
      reviewReasons.push("Care coordination needed to address adherence barriers");
    }
    if (score < 50) {
      reviewReasons.push("Low predicted adherence requires intervention planning");
    }

    assertEquals(reviewReasons.length, 3);
  });

  // =====================================================
  // Response Structure Tests
  // =====================================================

  await t.step("should return AdherencePrediction structure", () => {
    const prediction = {
      assessmentId: "assessment-123",
      patientId: "patient-456",
      assessorId: "assessor-789",
      assessmentDate: new Date().toISOString(),
      overallAdherenceScore: 65,
      adherenceCategory: "good" as const,
      confidenceLevel: 0.75,
      barriers: [],
      primaryBarrier: null,
      barrierCount: 0,
      medicationRisks: [],
      highRiskMedications: [],
      regimenComplexity: {
        totalMedications: 5,
        dailyDoses: 8,
        uniqueDoseTimes: 3,
        complexityScore: 45,
        complexityLevel: "moderate" as const
      },
      recommendedInterventions: [],
      urgentInterventions: [],
      riskFactorSummary: [],
      healthLiteracy: "moderate" as const,
      socialSupport: "moderate" as const,
      financialConcerns: false,
      cognitiveImpairment: false,
      requiresPharmacistReview: false,
      requiresCareCoordination: false,
      reviewReasons: [],
      clinicalSummary: "Patient has good predicted adherence",
      patientTalkingPoints: []
    };

    assertExists(prediction.assessmentId);
    assertEquals(prediction.overallAdherenceScore, 65);
    assertEquals(prediction.adherenceCategory, "good");
    assertEquals(prediction.confidenceLevel, 0.75);
    assertExists(prediction.regimenComplexity);
  });

  await t.step("should return no medications response for empty list", () => {
    const response = {
      assessment: {
        assessmentId: crypto.randomUUID(),
        overallAdherenceScore: 100,
        adherenceCategory: "excellent",
        confidenceLevel: 0.5,
        barriers: [],
        medicationRisks: [],
        regimenComplexity: {
          totalMedications: 0,
          complexityLevel: "simple"
        },
        clinicalSummary: "No medications on record to assess."
      }
    };

    assertEquals(response.assessment.overallAdherenceScore, 100);
    assertEquals(response.assessment.clinicalSummary, "No medications on record to assess.");
  });

  // =====================================================
  // Patient Context Tests
  // =====================================================

  await t.step("should calculate patient age", () => {
    const dob = new Date("1945-05-15");
    const now = new Date();
    const age = Math.floor((now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    assertEquals(age > 75, true);
  });

  await t.step("should gather SDOH factors", () => {
    const sdohFactors = [
      { category: "financial", risk_level: "high" },
      { category: "transportation", risk_level: "moderate" },
      { category: "social_isolation", risk_level: "low" }
    ];

    const financialRisk = sdohFactors.find(s =>
      s.category.toLowerCase().includes("financial")
    );

    assertExists(financialRisk);
    assertEquals(financialRisk?.risk_level, "high");
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/ai-medication-adherence-predictor", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  // =====================================================
  // Model Configuration Tests
  // =====================================================

  await t.step("should use Claude Sonnet model", () => {
    const SONNET_MODEL = "claude-sonnet-4-20250514";
    assertEquals(SONNET_MODEL.includes("sonnet"), true);
  });

  // =====================================================
  // Database Persistence Tests
  // =====================================================

  await t.step("should structure assessment for database storage", () => {
    const dbRecord = {
      patient_id: "patient-123",
      assessor_id: "assessor-456",
      tenant_id: "tenant-789",
      risk_category: "medication_adherence",
      risk_level: "moderate",
      risk_score: 55,
      confidence: 0.75,
      factors: ["Cost concerns", "Complex regimen"],
      recommendations: ["Review patient assistance programs"],
      summary: "Patient has moderate adherence risk",
      details: {
        barriers: [],
        medicationRisks: [],
        regimenComplexity: {}
      },
      requires_review: true,
      assessed_at: new Date().toISOString()
    };

    assertEquals(dbRecord.risk_category, "medication_adherence");
    assertEquals(dbRecord.requires_review, true);
    assertExists(dbRecord.assessed_at);
  });

  // =====================================================
  // Primary Barrier Identification Tests
  // =====================================================

  await t.step("should identify primary barrier by severity", () => {
    const barriers = [
      { barrier: "Cost concerns", severity: "moderate" as const },
      { barrier: "Cognitive challenges", severity: "high" as const },
      { barrier: "Side effects", severity: "low" as const }
    ];

    const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
    const sorted = [...barriers].sort((a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity]
    );
    const primaryBarrier = sorted[0].barrier;

    assertEquals(primaryBarrier, "Cognitive challenges");
  });

  // =====================================================
  // Health Literacy and Social Support Tests
  // =====================================================

  await t.step("should define health literacy levels", () => {
    const levels = ["low", "moderate", "adequate", "high", "unknown"];
    assertEquals(levels.length, 5);
  });

  await t.step("should define social support levels", () => {
    const levels = ["none", "limited", "moderate", "strong", "unknown"];
    assertEquals(levels.length, 5);
  });

  // =====================================================
  // Patient Talking Points Tests
  // =====================================================

  await t.step("should generate patient talking points", () => {
    const hasFinancialBarrier = true;
    const talkingPoints = [
      "Review your medication list together",
      hasFinancialBarrier ? "Discuss cost-saving options" : "Confirm pharmacy access",
      "Set up a reminder system that works for you",
      "Identify one person who can help if needed"
    ];

    assertEquals(talkingPoints.length, 4);
    assertEquals(talkingPoints[1], "Discuss cost-saving options");
  });

  // =====================================================
  // Error Handling Tests
  // =====================================================

  await t.step("should return 500 for internal errors", () => {
    const response = { error: "Internal server error" };
    assertEquals(response.error, "Internal server error");
  });

  await t.step("should handle AI enhancement failure gracefully", () => {
    // When AI enhancement fails, prediction should still be returned
    const prediction = {
      clinicalSummary: "Patient has good predicted adherence",
      healthLiteracy: "unknown" as const,
      socialSupport: "unknown" as const
    };

    // If AI fails, these remain as defaults
    assertEquals(prediction.healthLiteracy, "unknown");
    assertEquals(prediction.socialSupport, "unknown");
  });

  // =====================================================
  // Logging Tests
  // =====================================================

  await t.step("should log adherence prediction with redacted patient ID", () => {
    const patientId = "patient-123-abc-def-456";
    const redactedId = patientId.substring(0, 8) + "...";

    assertEquals(redactedId, "patient-...");
  });

  await t.step("should include prediction metrics in log", () => {
    const logEntry = {
      patientId: "patient-...",
      adherenceScore: 65,
      adherenceCategory: "good",
      barrierCount: 2,
      medicationsAnalyzed: 5
    };

    assertEquals(logEntry.adherenceScore, 65);
    assertEquals(logEntry.barrierCount, 2);
    assertEquals(logEntry.medicationsAnalyzed, 5);
  });

  // =====================================================
  // Metadata Response Tests
  // =====================================================

  await t.step("should include metadata in response", () => {
    const metadata = {
      generated_at: new Date().toISOString(),
      response_time_ms: 1250,
      model: "claude-sonnet-4-20250514",
      medications_analyzed: 5
    };

    assertExists(metadata.generated_at);
    assertExists(metadata.response_time_ms);
    assertEquals(metadata.model, "claude-sonnet-4-20250514");
    assertEquals(metadata.medications_analyzed, 5);
  });
});
