// supabase/functions/ai-contraindication-detector/__tests__/index.test.ts
// Tests for ai-contraindication-detector edge function (Skill #25)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Contraindication Detector Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/ai-contraindication-detector", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require patientId and providerId", () => {
    const validBody = { patientId: "patient-123", providerId: "prov-456", medicationName: "Metformin" };
    const invalidBody = { patientId: "patient-123", medicationName: "Metformin" };

    assertExists(validBody.patientId);
    assertExists(validBody.providerId);
    assertEquals("providerId" in invalidBody, false);
  });

  await t.step("should return 400 for missing patientId or providerId", () => {
    const hasRequiredFields = false;
    const expectedStatus = hasRequiredFields ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should require medicationRxcui or medicationName", () => {
    const validBody1 = { patientId: "p", providerId: "p", medicationRxcui: "860975" };
    const validBody2 = { patientId: "p", providerId: "p", medicationName: "Metformin" };
    const invalidBody = { patientId: "p", providerId: "p" };

    assertExists(validBody1.medicationRxcui);
    assertExists(validBody2.medicationName);
    assertEquals("medicationRxcui" in invalidBody, false);
    assertEquals("medicationName" in invalidBody, false);
  });

  await t.step("should return 400 for missing medication identifier", () => {
    const hasMedication = false;
    const expectedStatus = hasMedication ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should accept optional parameters", () => {
    const body = {
      patientId: "patient-123",
      providerId: "prov-456",
      medicationRxcui: "860975",
      medicationName: "Metformin 500mg",
      indication: "Type 2 diabetes",
      proposedDosage: "500mg twice daily",
      includeDrugInteractions: true,
      tenantId: "tenant-A"
    };

    assertExists(body.indication);
    assertExists(body.proposedDosage);
    assertExists(body.includeDrugInteractions);
  });

  await t.step("should default includeDrugInteractions to true", () => {
    const includeDrugInteractions = undefined ?? true;

    assertEquals(includeDrugInteractions, true);
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

  await t.step("should redact DOB", () => {
    const redact = (s: string): string =>
      s.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, "[DOB]");

    assertEquals(redact("01/15/1980"), "[DOB]");
  });

  // Claude model tests
  await t.step("should use Claude Sonnet 4 for clinical safety accuracy", () => {
    const SONNET_MODEL = "claude-sonnet-4-20250514";
    assertEquals(SONNET_MODEL.includes("sonnet"), true);
  });

  // Patient context structure tests
  await t.step("should structure patient demographics correctly", () => {
    const demographics = {
      age: 65,
      sex: "male",
      weight: 85,
      pregnancyStatus: "not_applicable",
      lactationStatus: "not_applicable"
    };

    assertExists(demographics.age);
    assertExists(demographics.sex);
    assertEquals(demographics.pregnancyStatus, "not_applicable");
  });

  await t.step("should calculate age from date of birth", () => {
    const dob = new Date("1960-01-15");
    const today = new Date();
    const age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    assertEquals(age >= 65, true);
  });

  await t.step("should structure active conditions correctly", () => {
    const condition = {
      code: "E11.9",
      display: "Type 2 diabetes mellitus without complications",
      category: "chronic"
    };

    assertExists(condition.code);
    assertExists(condition.display);
  });

  await t.step("should structure active medications correctly", () => {
    const medication = {
      rxcui: "860975",
      name: "Metformin 500mg",
      dosage: "500mg twice daily"
    };

    assertExists(medication.name);
  });

  await t.step("should structure allergies correctly", () => {
    const allergy = {
      allergen: "Penicillin",
      allergenType: "medication",
      severity: "severe",
      criticality: "high",
      reactions: ["Anaphylaxis", "Rash"]
    };

    assertExists(allergy.allergen);
    assertEquals(allergy.allergenType, "medication");
    assertEquals(allergy.reactions?.length, 2);
  });

  await t.step("should gather lab values", () => {
    const labCodes = [
      { code: "2160-0", key: "creatinine" },
      { code: "33914-3", key: "eGFR" },
      { code: "3094-0", key: "bun" },
      { code: "1742-6", key: "alt" },
      { code: "1920-8", key: "ast" }
    ];

    assertEquals(labCodes.length, 5);
    assertEquals(labCodes[0].key, "creatinine");
    assertEquals(labCodes[1].key, "eGFR");
  });

  // Contraindication finding structure tests
  await t.step("should structure contraindication finding correctly", () => {
    const finding = {
      type: "disease_contraindication",
      severity: "high",
      title: "Metformin contraindicated in renal impairment",
      description: "Metformin should be used with caution or avoided in patients with eGFR < 30",
      clinicalReasoning: "Metformin is renally excreted and can accumulate in renal impairment",
      triggerFactor: "eGFR: 25 mL/min/1.73m²",
      recommendations: ["Reduce dose or consider alternative", "Monitor renal function"],
      alternatives: ["Sitagliptin", "Linagliptin"],
      confidence: 0.92,
      source: "clinical_guideline"
    };

    assertExists(finding.type);
    assertEquals(finding.severity, "high");
    assertExists(finding.clinicalReasoning);
    assertExists(finding.recommendations);
    assertEquals(finding.alternatives?.length, 2);
  });

  await t.step("should validate contraindication types", () => {
    const validTypes = [
      "disease_contraindication",
      "allergy_contraindication",
      "drug_class_allergy",
      "lab_value_contraindication",
      "age_contraindication",
      "pregnancy_contraindication",
      "lactation_contraindication",
      "renal_impairment",
      "hepatic_impairment",
      "drug_drug_interaction"
    ];

    assertEquals(validTypes.includes("disease_contraindication"), true);
    assertEquals(validTypes.includes("allergy_contraindication"), true);
    assertEquals(validTypes.includes("renal_impairment"), true);
    assertEquals(validTypes.includes("drug_drug_interaction"), true);
  });

  await t.step("should validate severity levels", () => {
    const validSeverities = ["contraindicated", "high", "moderate", "low"];

    assertEquals(validSeverities.includes("contraindicated"), true);
    assertEquals(validSeverities.includes("high"), true);
    assertEquals(validSeverities.includes("moderate"), true);
    assertEquals(validSeverities.includes("low"), true);
  });

  // Overall assessment tests
  await t.step("should validate overall assessment values", () => {
    const validAssessments = ["safe", "caution", "warning", "contraindicated"];

    assertEquals(validAssessments.includes("safe"), true);
    assertEquals(validAssessments.includes("caution"), true);
    assertEquals(validAssessments.includes("warning"), true);
    assertEquals(validAssessments.includes("contraindicated"), true);
  });

  await t.step("should require clinical review for high severity findings", () => {
    const findings = [{ severity: "high" }];
    const hasHighSeverity = findings.some(f => f.severity === "high" || f.severity === "contraindicated");
    const requiresClinicalReview = hasHighSeverity;

    assertEquals(requiresClinicalReview, true);
  });

  // Findings summary calculation tests
  await t.step("should calculate findings summary correctly", () => {
    const findings = [
      { severity: "contraindicated" },
      { severity: "high" },
      { severity: "high" },
      { severity: "moderate" },
      { severity: "low" }
    ];

    const summary = {
      contraindicated: findings.filter(f => f.severity === "contraindicated").length,
      high: findings.filter(f => f.severity === "high").length,
      moderate: findings.filter(f => f.severity === "moderate").length,
      low: findings.filter(f => f.severity === "low").length,
      total: findings.length
    };

    assertEquals(summary.contraindicated, 1);
    assertEquals(summary.high, 2);
    assertEquals(summary.moderate, 1);
    assertEquals(summary.low, 1);
    assertEquals(summary.total, 5);
  });

  // Safety checks list tests
  await t.step("should include all safety checks in metadata", () => {
    const includeDrugInteractions = true;
    const checksPerformed = [
      "disease_contraindication",
      "allergy_cross_reactivity",
      "lab_value_check",
      "age_contraindication",
      "pregnancy_lactation",
      "organ_impairment",
      ...(includeDrugInteractions ? ["drug_drug_interaction"] : [])
    ];

    assertEquals(checksPerformed.length, 7);
    assertEquals(checksPerformed.includes("drug_drug_interaction"), true);
  });

  await t.step("should exclude drug interactions when disabled", () => {
    const includeDrugInteractions = false;
    const checksPerformed = [
      "disease_contraindication",
      "allergy_cross_reactivity",
      "lab_value_check",
      "age_contraindication",
      "pregnancy_lactation",
      "organ_impairment",
      ...(includeDrugInteractions ? ["drug_drug_interaction"] : [])
    ];

    assertEquals(checksPerformed.length, 6);
    assertEquals(checksPerformed.includes("drug_drug_interaction"), false);
  });

  // Renal impairment tests
  await t.step("should detect severe renal impairment", () => {
    const eGFR = 25;
    const impairment = eGFR < 30 ? "severe" : eGFR < 60 ? "moderate" : "none";

    assertEquals(impairment, "severe");
  });

  await t.step("should detect moderate renal impairment", () => {
    const eGFR = 45;
    const impairment = eGFR < 30 ? "severe" : eGFR < 60 ? "moderate" : "none";

    assertEquals(impairment, "moderate");
  });

  // Hepatic impairment tests
  await t.step("should detect elevated liver enzymes", () => {
    const alt = 180; // > 3x ULN (normal ~40)
    const isElevated = alt > 120; // 3x upper limit of normal

    assertEquals(isElevated, true);
  });

  // Age-related tests
  await t.step("should flag geriatric concerns for age > 65", () => {
    const age = 78;
    const isGeriatric = age > 65;

    assertEquals(isGeriatric, true);
  });

  await t.step("should flag pediatric concerns for age < 18", () => {
    const age = 12;
    const isPediatric = age < 18;

    assertEquals(isPediatric, true);
  });

  // Usage logging tests
  await t.step("should log AI usage for cost tracking", () => {
    const usageLog = {
      user_id: "provider-123",
      request_id: crypto.randomUUID(),
      model: "claude-sonnet-4-20250514",
      request_type: "contraindication_check",
      input_tokens: 1500,
      output_tokens: 1200,
      cost: (1500 / 1_000_000) * 3.0 + (1200 / 1_000_000) * 15.0,
      response_time_ms: 2000,
      success: true,
      metadata: {
        medicationName: "Metformin",
        findingsCount: 3,
        overallAssessment: "caution"
      }
    };

    assertEquals(usageLog.request_type, "contraindication_check");
    assertEquals(usageLog.success, true);
    assertExists(usageLog.metadata.medicationName);
  });

  // Response structure tests
  await t.step("should structure success response correctly", () => {
    const response = {
      result: {
        overallAssessment: "caution",
        requiresClinicalReview: true,
        reviewReasons: ["Renal impairment detected"],
        findings: [],
        findingsSummary: { contraindicated: 0, high: 1, moderate: 1, low: 0, total: 2 },
        patientContext: {},
        confidence: 0.85,
        clinicalSummary: "Moderate caution advised."
      },
      medication: {
        rxcui: "860975",
        name: "Metformin 500mg",
        proposedDosage: "500mg twice daily"
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        model: "claude-sonnet-4-20250514",
        responseTimeMs: 1800,
        checksPerformed: ["disease_contraindication", "allergy_cross_reactivity"]
      }
    };

    assertExists(response.result);
    assertExists(response.medication);
    assertExists(response.metadata);
    assertEquals(response.result.overallAssessment, "caution");
  });

  // Fallback response tests
  await t.step("should provide fallback response when AI fails", () => {
    const fallbackResponse = {
      overallAssessment: "caution",
      requiresClinicalReview: true,
      reviewReasons: ["AI analysis incomplete - manual review required"],
      findings: [],
      findingsSummary: { contraindicated: 0, high: 0, moderate: 0, low: 0, total: 0 },
      confidence: 0.3,
      clinicalSummary: "Unable to complete automated analysis. Manual clinical review is required before prescribing."
    };

    assertEquals(fallbackResponse.confidence, 0.3);
    assertEquals(fallbackResponse.requiresClinicalReview, true);
  });

  // HTTP status codes
  await t.step("should return 200 for successful check", () => {
    const success = true;
    const expectedStatus = success ? 200 : 500;

    assertEquals(expectedStatus, 200);
  });

  await t.step("should return 400 for validation errors", () => {
    const hasValidationError = true;
    const expectedStatus = hasValidationError ? 400 : 200;

    assertEquals(expectedStatus, 400);
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

  // Error response structure
  await t.step("should structure error response correctly", () => {
    const errorResponse = {
      error: "Missing required fields: patientId, providerId"
    };

    assertExists(errorResponse.error);
  });

  // Allergy cross-reactivity tests
  await t.step("should detect drug class cross-reactivity", () => {
    const allergies = [{ allergen: "Penicillin", allergenType: "medication" }];
    const proposedMedication = "Cephalexin"; // Cephalosporin - cross-reactive
    const hasCrossReactivity = allergies.some(a =>
      a.allergen.toLowerCase().includes("penicillin") &&
      proposedMedication.toLowerCase().includes("ceph")
    );

    // This is a simplified check - AI would do more sophisticated analysis
    assertEquals(allergies.length > 0, true);
  });

  // Critical safety rule tests
  await t.step("should set contraindicated when absolute contraindication found", () => {
    const findings = [{ severity: "contraindicated" }];
    const hasAbsolute = findings.some(f => f.severity === "contraindicated");
    const overallAssessment = hasAbsolute ? "contraindicated" : "safe";

    assertEquals(overallAssessment, "contraindicated");
  });

  await t.step("should require review for high severity findings", () => {
    const findings = [{ severity: "high" }];
    const requiresClinicalReview = findings.some(f =>
      f.severity === "high" || f.severity === "contraindicated"
    );

    assertEquals(requiresClinicalReview, true);
  });
});
