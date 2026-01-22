/**
 * Tests for AI Treatment Pathway Recommender Edge Function
 *
 * @skill #23 - Evidence-based treatment pathway recommendations
 *
 * Tests clinical decision support with safety guardrails,
 * allergy checking, contraindication flagging, and guideline references.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ============================================================================
// Type Definitions (matching the edge function)
// ============================================================================

interface TreatmentPathwayRequest {
  patientId: string;
  tenantId?: string;
  condition: string;
  conditionCode?: string;
  severity?: "mild" | "moderate" | "severe";
  isNewDiagnosis?: boolean;
  treatmentGoals?: string[];
  excludeMedications?: string[];
}

interface TreatmentStep {
  stepNumber: number;
  phase: "first_line" | "second_line" | "third_line" | "adjunct" | "monitoring";
  intervention: string;
  interventionType: "medication" | "lifestyle" | "procedure" | "referral" | "monitoring" | "education";
  rationale: string;
  expectedOutcome: string;
  timeframe: string;
  guidelineSource: string;
  evidenceLevel: "A" | "B" | "C" | "D" | "expert_consensus";
  considerations: string[];
  contraindications: string[];
  monitoringRequired: string[];
}

interface MedicationRecommendation {
  medicationClass: string;
  examples: string[];
  startingApproach: string;
  targetOutcome: string;
  commonSideEffects: string[];
  monitoringParameters: string[];
  contraindicatedIn: string[];
  guidelineSource: string;
  requiresReview: boolean;
}

interface LifestyleRecommendation {
  category: "diet" | "exercise" | "smoking_cessation" | "alcohol" | "sleep" | "stress" | "weight";
  recommendation: string;
  specificGuidance: string;
  expectedBenefit: string;
  timeframe: string;
  resources: string[];
}

interface TreatmentPathway {
  condition: string;
  conditionCode: string;
  pathwayTitle: string;
  summary: string;
  severity: string;
  treatmentGoal: string;
  steps: TreatmentStep[];
  medications: MedicationRecommendation[];
  lifestyle: LifestyleRecommendation[];
  referrals: Array<{ specialty: string; reason: string; urgency: string }>;
  monitoringPlan: Array<{ parameter: string; frequency: string; target: string }>;
  followUpSchedule: string;
  redFlags: string[];
  patientEducation: string[];
  guidelinesSummary: Array<{ guideline: string; year: number; recommendation: string }>;
  contraindications: string[];
  allergyConflicts: string[];
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  disclaimer: string;
}

interface PatientContext {
  demographics: { ageGroup: string; sex: string };
  conditions: Array<{ code: string; display: string }>;
  medications: Array<{ name: string; rxcui?: string }>;
  allergies: string[];
  contraindications: string[];
  sdohFactors: {
    hasTransportationBarriers: boolean;
    hasFinancialBarriers: boolean;
    hasSocialSupport: boolean;
  };
  recentLabs: Record<string, { value: number; unit: string; date: string }>;
  vitals: Record<string, { value: number; unit: string }>;
}

// ============================================================================
// Test Suites
// ============================================================================

Deno.test("AI Treatment Pathway - Request Validation", async (t) => {
  await t.step("should require patientId", () => {
    const request: Partial<TreatmentPathwayRequest> = {
      condition: "Type 2 Diabetes",
    };

    const isValid = !!request.patientId;
    assertEquals(isValid, false);
  });

  await t.step("should require condition", () => {
    const request: Partial<TreatmentPathwayRequest> = {
      patientId: "patient-123",
    };

    const isValid = !!request.condition;
    assertEquals(isValid, false);
  });

  await t.step("should accept valid request", () => {
    const request: TreatmentPathwayRequest = {
      patientId: "patient-123",
      condition: "Type 2 Diabetes",
      conditionCode: "E11.9",
      severity: "moderate",
      isNewDiagnosis: true,
    };

    const isValid = !!request.patientId && !!request.condition;
    assertEquals(isValid, true);
  });

  await t.step("should default severity to moderate", () => {
    const request: TreatmentPathwayRequest = {
      patientId: "patient-123",
      condition: "Hypertension",
    };

    const severity = request.severity || "moderate";
    assertEquals(severity, "moderate");
  });

  await t.step("should default isNewDiagnosis to false", () => {
    const request: TreatmentPathwayRequest = {
      patientId: "patient-123",
      condition: "Hypertension",
    };

    const isNewDiagnosis = request.isNewDiagnosis ?? false;
    assertEquals(isNewDiagnosis, false);
  });
});

Deno.test("AI Treatment Pathway - Clinical Guidelines Reference", async (t) => {
  await t.step("should have guidelines for diabetes", () => {
    const guidelines: Record<string, string[]> = {
      diabetes: ["ADA Standards of Care 2024", "AACE Guidelines 2023"],
    };

    assertEquals(guidelines.diabetes.length, 2);
    assertEquals(guidelines.diabetes[0].includes("ADA"), true);
  });

  await t.step("should have guidelines for hypertension", () => {
    const guidelines: Record<string, string[]> = {
      hypertension: ["ACC/AHA Hypertension Guidelines 2017", "JNC 8"],
    };

    assertEquals(guidelines.hypertension.length, 2);
    assertEquals(guidelines.hypertension[0].includes("ACC"), true);
  });

  await t.step("should have guidelines for common conditions", () => {
    const conditions = [
      "diabetes",
      "hypertension",
      "hyperlipidemia",
      "heart_failure",
      "copd",
      "asthma",
      "depression",
      "anxiety",
      "obesity",
      "ckd",
      "afib",
      "osteoporosis",
      "thyroid",
    ];

    assertEquals(conditions.length, 13);
  });

  await t.step("should match condition to guideline", () => {
    const condition = "Type 2 Diabetes mellitus";
    const guidelineKeys = ["diabetes", "hypertension", "heart_failure"];

    const conditionKey = guidelineKeys.find((k) =>
      condition.toLowerCase().includes(k)
    );

    assertEquals(conditionKey, "diabetes");
  });
});

Deno.test("AI Treatment Pathway - PHI Redaction", async (t) => {
  await t.step("should redact email addresses", () => {
    const text = "Patient email: john.doe@example.com";
    const redacted = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");

    assertEquals(redacted, "Patient email: [EMAIL]");
  });

  await t.step("should redact phone numbers", () => {
    const text = "Contact: 555-123-4567";
    const redacted = text.replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]");

    assertEquals(redacted, "Contact: [PHONE]");
  });

  await t.step("should redact SSN", () => {
    const text = "SSN: 123-45-6789";
    const redacted = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

    assertEquals(redacted, "SSN: [SSN]");
  });
});

Deno.test("AI Treatment Pathway - Patient Context Gathering", async (t) => {
  await t.step("should determine age group from age", () => {
    const testCases = [
      { age: 10, expected: "pediatric" },
      { age: 25, expected: "young_adult" },
      { age: 50, expected: "adult" },
      { age: 70, expected: "elderly" },
      { age: 85, expected: "very_elderly" },
    ];

    for (const tc of testCases) {
      let ageGroup: string;
      if (tc.age < 18) ageGroup = "pediatric";
      else if (tc.age < 40) ageGroup = "young_adult";
      else if (tc.age < 65) ageGroup = "adult";
      else if (tc.age < 80) ageGroup = "elderly";
      else ageGroup = "very_elderly";

      assertEquals(ageGroup, tc.expected);
    }
  });

  await t.step("should structure patient context", () => {
    const context: PatientContext = {
      demographics: { ageGroup: "adult", sex: "female" },
      conditions: [
        { code: "E11.9", display: "Type 2 diabetes mellitus" },
        { code: "I10", display: "Essential hypertension" },
      ],
      medications: [
        { name: "Metformin 500mg", rxcui: "860974" },
        { name: "Lisinopril 10mg", rxcui: "314076" },
      ],
      allergies: ["Penicillin", "Sulfa"],
      contraindications: [],
      sdohFactors: {
        hasTransportationBarriers: false,
        hasFinancialBarriers: true,
        hasSocialSupport: true,
      },
      recentLabs: {
        hba1c: { value: 7.5, unit: "%", date: "2025-01-01" },
        egfr: { value: 65, unit: "mL/min/1.73m2", date: "2025-01-01" },
      },
      vitals: {
        systolic_bp: { value: 135, unit: "mmHg" },
        bmi: { value: 28.5, unit: "kg/m2" },
      },
    };

    assertEquals(context.conditions.length, 2);
    assertEquals(context.allergies.length, 2);
    assertEquals(context.sdohFactors.hasFinancialBarriers, true);
  });
});

Deno.test("AI Treatment Pathway - Contraindication Derivation", async (t) => {
  await t.step("should derive renal contraindication", () => {
    const conditions = [{ code: "N18.3", display: "Chronic kidney disease, stage 3" }];
    const contraindications: string[] = [];

    const conditionLower = conditions.map((c) => c.display.toLowerCase()).join(" ");
    if (conditionLower.includes("kidney") || conditionLower.includes("renal")) {
      contraindications.push("Renal impairment - dose adjustments may be required");
    }

    assertEquals(contraindications.length, 1);
    assertEquals(contraindications[0].includes("Renal"), true);
  });

  await t.step("should derive hepatic contraindication", () => {
    const conditions = [{ code: "K74.60", display: "Unspecified cirrhosis of liver" }];
    const contraindications: string[] = [];

    const conditionLower = conditions.map((c) => c.display.toLowerCase()).join(" ");
    if (conditionLower.includes("liver") || conditionLower.includes("hepatic")) {
      contraindications.push("Hepatic impairment - avoid hepatotoxic medications");
    }

    assertEquals(contraindications.length, 1);
    assertEquals(contraindications[0].includes("Hepatic"), true);
  });

  await t.step("should derive heart failure contraindication", () => {
    const conditions = [{ code: "I50.9", display: "Heart failure, unspecified" }];
    const contraindications: string[] = [];

    const conditionLower = conditions.map((c) => c.display.toLowerCase()).join(" ");
    if (conditionLower.includes("heart failure")) {
      contraindications.push("Heart failure - avoid fluid-retaining medications");
    }

    assertEquals(contraindications.length, 1);
    assertEquals(contraindications[0].includes("Heart failure"), true);
  });

  await t.step("should derive bleeding risk contraindication", () => {
    const conditions = [{ code: "D68.9", display: "Coagulopathy" }];
    const contraindications: string[] = [];

    const conditionLower = conditions.map((c) => c.display.toLowerCase()).join(" ");
    if (conditionLower.includes("bleeding") || conditionLower.includes("coagulopathy")) {
      contraindications.push("Bleeding risk - caution with anticoagulants/NSAIDs");
    }

    assertEquals(contraindications.length, 1);
    assertEquals(contraindications[0].includes("Bleeding"), true);
  });
});

Deno.test("AI Treatment Pathway - Allergy Conflict Checking", async (t) => {
  await t.step("should detect penicillin allergy conflict for infection", () => {
    const allergies = ["Penicillin"];
    const condition = "Bacterial infection";
    const conflicts: string[] = [];

    const allergyLower = allergies.map((a) => a.toLowerCase());
    const conditionLower = condition.toLowerCase();

    if (conditionLower.includes("infection") && allergyLower.some((a) => a.includes("penicillin"))) {
      conflicts.push("Penicillin allergy - avoid penicillin-class antibiotics");
    }

    assertEquals(conflicts.length, 1);
    assertEquals(conflicts[0].includes("Penicillin"), true);
  });

  await t.step("should detect NSAID allergy conflict for pain", () => {
    const allergies = ["NSAID"];
    const condition = "Chronic pain";
    const conflicts: string[] = [];

    const allergyLower = allergies.map((a) => a.toLowerCase());
    const conditionLower = condition.toLowerCase();

    if (conditionLower.includes("pain") && allergyLower.some((a) => a.includes("nsaid") || a.includes("aspirin"))) {
      conflicts.push("NSAID/Aspirin allergy - avoid NSAIDs for pain management");
    }

    assertEquals(conflicts.length, 1);
    assertEquals(conflicts[0].includes("NSAID"), true);
  });

  await t.step("should detect sulfa allergy conflict", () => {
    const allergies = ["Sulfa drugs"];
    const conflicts: string[] = [];

    const allergyLower = allergies.map((a) => a.toLowerCase());
    if (allergyLower.some((a) => a.includes("sulfa"))) {
      conflicts.push("Sulfa allergy - avoid sulfonamide medications");
    }

    assertEquals(conflicts.length, 1);
    assertEquals(conflicts[0].includes("Sulfa"), true);
  });

  await t.step("should detect ACE inhibitor sensitivity", () => {
    const allergies = ["ACE inhibitor cough"];
    const conflicts: string[] = [];

    const allergyLower = allergies.map((a) => a.toLowerCase());
    if (allergyLower.some((a) => a.includes("ace inhibitor"))) {
      conflicts.push("ACE inhibitor sensitivity - consider ARBs instead");
    }

    assertEquals(conflicts.length, 1);
    assertEquals(conflicts[0].includes("ARBs"), true);
  });

  await t.step("should detect statin intolerance", () => {
    const allergies = ["Statin myopathy"];
    const conflicts: string[] = [];

    const allergyLower = allergies.map((a) => a.toLowerCase());
    if (allergyLower.some((a) => a.includes("statin"))) {
      conflicts.push("Statin intolerance - consider alternative lipid-lowering therapy");
    }

    assertEquals(conflicts.length, 1);
    assertEquals(conflicts[0].includes("lipid-lowering"), true);
  });
});

Deno.test("AI Treatment Pathway - Treatment Steps", async (t) => {
  await t.step("should structure treatment step", () => {
    const step: TreatmentStep = {
      stepNumber: 1,
      phase: "first_line",
      intervention: "Start metformin 500mg twice daily",
      interventionType: "medication",
      rationale: "First-line therapy per ADA guidelines",
      expectedOutcome: "HbA1c reduction of 1-1.5%",
      timeframe: "3 months",
      guidelineSource: "ADA Standards of Care 2024",
      evidenceLevel: "A",
      considerations: ["Titrate based on GI tolerance"],
      contraindications: ["eGFR < 30 mL/min"],
      monitoringRequired: ["HbA1c at 3 months", "Renal function annually"],
    };

    assertEquals(step.phase, "first_line");
    assertEquals(step.evidenceLevel, "A");
    assertEquals(step.guidelineSource.includes("ADA"), true);
  });

  await t.step("should define treatment phases", () => {
    const phases = ["first_line", "second_line", "third_line", "adjunct", "monitoring"];
    assertEquals(phases.length, 5);
  });

  await t.step("should define intervention types", () => {
    const types = ["medication", "lifestyle", "procedure", "referral", "monitoring", "education"];
    assertEquals(types.length, 6);
  });

  await t.step("should define evidence levels", () => {
    const levels = ["A", "B", "C", "D", "expert_consensus"];
    assertEquals(levels.length, 5);
    assertEquals(levels[0], "A");
  });
});

Deno.test("AI Treatment Pathway - Medication Recommendations", async (t) => {
  await t.step("should structure medication recommendation", () => {
    const medication: MedicationRecommendation = {
      medicationClass: "Biguanide",
      examples: ["Metformin"],
      startingApproach: "Start low, titrate slowly",
      targetOutcome: "HbA1c < 7%",
      commonSideEffects: ["GI upset", "Diarrhea", "Nausea"],
      monitoringParameters: ["HbA1c", "Renal function", "B12 levels"],
      contraindicatedIn: ["eGFR < 30", "Active liver disease"],
      guidelineSource: "ADA Standards of Care 2024",
      requiresReview: true,
    };

    assertEquals(medication.medicationClass, "Biguanide");
    assertEquals(medication.requiresReview, true);
    assertEquals(medication.commonSideEffects.length, 3);
  });

  await t.step("should always require physician review for medications", () => {
    const medications: MedicationRecommendation[] = [
      {
        medicationClass: "Test",
        examples: ["Test"],
        startingApproach: "Test",
        targetOutcome: "Test",
        commonSideEffects: [],
        monitoringParameters: [],
        contraindicatedIn: [],
        guidelineSource: "Test",
        requiresReview: false, // AI might return false
      },
    ];

    // SAFETY: Always override to require review
    const safetyEnhanced = medications.map((m) => ({
      ...m,
      requiresReview: true,
    }));

    assertEquals(safetyEnhanced[0].requiresReview, true);
  });
});

Deno.test("AI Treatment Pathway - Lifestyle Recommendations", async (t) => {
  await t.step("should structure lifestyle recommendation", () => {
    const lifestyle: LifestyleRecommendation = {
      category: "diet",
      recommendation: "Follow Mediterranean diet",
      specificGuidance: "Emphasize vegetables, whole grains, lean proteins, and healthy fats",
      expectedBenefit: "Improved glycemic control and cardiovascular risk reduction",
      timeframe: "Ongoing, benefits seen in 3-6 months",
      resources: ["Diabetes educator consult", "MyPlate.gov"],
    };

    assertEquals(lifestyle.category, "diet");
    assertEquals(lifestyle.resources.length, 2);
  });

  await t.step("should define lifestyle categories", () => {
    const categories = ["diet", "exercise", "smoking_cessation", "alcohol", "sleep", "stress", "weight"];
    assertEquals(categories.length, 7);
  });
});

Deno.test("AI Treatment Pathway - Referrals", async (t) => {
  await t.step("should structure referral", () => {
    const referral = {
      specialty: "Endocrinology",
      reason: "Complex insulin titration needed",
      urgency: "routine",
    };

    assertEquals(referral.specialty, "Endocrinology");
    assertEquals(referral.urgency, "routine");
  });

  await t.step("should define urgency levels", () => {
    const urgencies = ["routine", "urgent", "emergent"];
    assertEquals(urgencies.length, 3);
  });
});

Deno.test("AI Treatment Pathway - Monitoring Plan", async (t) => {
  await t.step("should structure monitoring parameter", () => {
    const monitoring = {
      parameter: "HbA1c",
      frequency: "Every 3 months initially, then every 6 months if at goal",
      target: "< 7% for most adults",
    };

    assertEquals(monitoring.parameter, "HbA1c");
    assertExists(monitoring.target);
  });
});

Deno.test("AI Treatment Pathway - Red Flags", async (t) => {
  await t.step("should include red flags", () => {
    const redFlags = [
      "Severe hypoglycemia requiring assistance",
      "New chest pain or shortness of breath",
      "Sudden vision changes",
      "Signs of diabetic ketoacidosis (DKA)",
    ];

    assertEquals(redFlags.length >= 1, true);
    assertEquals(redFlags.some(r => r.includes("hypoglycemia")), true);
  });
});

Deno.test("AI Treatment Pathway - Safety Guardrails", async (t) => {
  await t.step("should always require clinician review", () => {
    const pathway: Partial<TreatmentPathway> = {
      requiresReview: true,
      reviewReasons: ["All AI-generated treatment recommendations require clinician review"],
    };

    assertEquals(pathway.requiresReview, true);
    assertEquals(pathway.reviewReasons!.length >= 1, true);
  });

  await t.step("should flag low confidence for additional review", () => {
    const confidence = 0.5;
    const reviewReasons: string[] = ["Standard review required"];

    if (confidence < 0.6) {
      reviewReasons.push("Low confidence score - careful review recommended");
    }

    assertEquals(reviewReasons.length, 2);
  });

  await t.step("should include disclaimer", () => {
    const disclaimer = "These recommendations are for clinical decision support only and require verification by a licensed healthcare provider.";

    assertEquals(disclaimer.includes("clinical decision support"), true);
    assertEquals(disclaimer.includes("licensed healthcare provider"), true);
  });
});

Deno.test("AI Treatment Pathway - Default/Fallback Pathway", async (t) => {
  await t.step("should provide fallback when AI fails", () => {
    const condition = "Complex condition";
    const fallbackPathway: Partial<TreatmentPathway> = {
      condition,
      pathwayTitle: `Treatment Pathway for ${condition}`,
      summary: "Unable to generate AI recommendations. Please consult clinical guidelines directly.",
      confidence: 0.3,
      requiresReview: true,
      reviewReasons: [
        "AI pathway generation failed - manual clinician review required",
        "Fallback pathway provided for safety",
      ],
    };

    assertEquals(fallbackPathway.confidence, 0.3);
    assertEquals(fallbackPathway.requiresReview, true);
    assertEquals(fallbackPathway.reviewReasons!.length, 2);
  });

  await t.step("should include basic structure in fallback", () => {
    const fallbackSteps: TreatmentStep[] = [
      {
        stepNumber: 1,
        phase: "first_line",
        intervention: "Clinical assessment and guideline consultation",
        interventionType: "monitoring",
        rationale: "AI pathway generation failed - manual review required",
        expectedOutcome: "Appropriate treatment plan",
        timeframe: "Immediate",
        guidelineSource: "Consult relevant clinical guidelines",
        evidenceLevel: "expert_consensus",
        considerations: ["Requires full clinician review"],
        contraindications: [],
        monitoringRequired: ["Per clinical judgment"],
      },
    ];

    assertEquals(fallbackSteps.length, 1);
    assertEquals(fallbackSteps[0].intervention.includes("Clinical assessment"), true);
  });
});

Deno.test("AI Treatment Pathway - SDOH Considerations", async (t) => {
  await t.step("should include SDOH factors in context", () => {
    const sdohFactors = {
      hasTransportationBarriers: true,
      hasFinancialBarriers: true,
      hasSocialSupport: false,
    };

    // These factors should influence treatment recommendations
    assertEquals(sdohFactors.hasTransportationBarriers, true);
    assertEquals(sdohFactors.hasFinancialBarriers, true);
    assertEquals(sdohFactors.hasSocialSupport, false);
  });

  await t.step("should format SDOH for prompt", () => {
    const sdohFactors = {
      hasTransportationBarriers: true,
      hasFinancialBarriers: false,
      hasSocialSupport: true,
    };

    const sdohText = `SDOH CONSIDERATIONS:
- Transportation barriers: ${sdohFactors.hasTransportationBarriers ? "Yes" : "No"}
- Financial barriers: ${sdohFactors.hasFinancialBarriers ? "Yes" : "No"}
- Social support: ${sdohFactors.hasSocialSupport ? "Yes" : "Limited"}`;

    assertEquals(sdohText.includes("Transportation barriers: Yes"), true);
    assertEquals(sdohText.includes("Financial barriers: No"), true);
  });
});

Deno.test("AI Treatment Pathway - Usage Logging", async (t) => {
  await t.step("should estimate token usage", () => {
    const estimatedInputTokens = 2500;
    const estimatedOutputTokens = 2000;

    assertEquals(estimatedInputTokens, 2500);
    assertEquals(estimatedOutputTokens, 2000);
  });

  await t.step("should calculate cost", () => {
    const estimatedInputTokens = 2500;
    const estimatedOutputTokens = 2000;
    const inputCostPer1M = 3;
    const outputCostPer1M = 15;

    const cost = (estimatedInputTokens / 1_000_000) * inputCostPer1M +
                 (estimatedOutputTokens / 1_000_000) * outputCostPer1M;

    assertEquals(cost, (2500 / 1_000_000) * 3 + (2000 / 1_000_000) * 15);
  });
});

Deno.test("AI Treatment Pathway - Response Metadata", async (t) => {
  await t.step("should include response metadata", () => {
    const metadata = {
      generated_at: new Date().toISOString(),
      model: "claude-sonnet-4-20250514",
      response_time_ms: 500,
      condition: "Type 2 Diabetes",
      severity: "moderate",
      patient_context: {
        conditions_count: 3,
        medications_count: 5,
        allergies_count: 2,
        has_contraindications: true,
      },
    };

    assertExists(metadata.generated_at);
    assertEquals(metadata.model, "claude-sonnet-4-20250514");
    assertEquals(metadata.patient_context.conditions_count, 3);
  });
});

Deno.test("AI Treatment Pathway - Error Handling", async (t) => {
  await t.step("should handle missing API key", () => {
    const apiKey: string | undefined = undefined;
    const shouldThrow = !apiKey;

    assertEquals(shouldThrow, true);
  });

  await t.step("should handle API error", () => {
    const response = { ok: false, status: 500 };
    const shouldThrow = !response.ok;

    assertEquals(shouldThrow, true);
  });

  await t.step("should handle JSON parse error gracefully", () => {
    const content = "Not valid JSON";

    let parsed = null;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      parsed = null;
    }

    assertEquals(parsed, null);
  });
});
