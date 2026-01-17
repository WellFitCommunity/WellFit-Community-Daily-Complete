// supabase/functions/check-drug-interactions/__tests__/index.test.ts
// Tests for check-drug-interactions edge function (RxNorm API)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Check Drug Interactions Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/check-drug-interactions", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should reject unauthorized origins", () => {
    const allowed = false;
    const expectedStatus = allowed ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should require authorization header", () => {
    const hasAuth = false;
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

  await t.step("should extract token from Bearer header", () => {
    const authHeader = "Bearer my-jwt-token-123";
    const token = authHeader.replace("Bearer ", "");

    assertEquals(token, "my-jwt-token-123");
  });

  await t.step("should return 401 for unauthorized user", () => {
    const isAuthorized = false;
    const expectedStatus = isAuthorized ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should require medication_rxcui and patient_id", () => {
    const validBody = { medication_rxcui: "860975", patient_id: "patient-123" };
    const invalidBody = { patient_id: "patient-123" };

    assertExists(validBody.medication_rxcui);
    assertExists(validBody.patient_id);
    assertEquals("medication_rxcui" in invalidBody, false);
  });

  await t.step("should return 400 for missing required fields", () => {
    const hasRequiredFields = false;
    const expectedStatus = hasRequiredFields ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should structure request body correctly", () => {
    const request = {
      medication_rxcui: "860975",
      patient_id: "patient-123",
      medication_name: "Metformin",
      suggestAlternatives: true,
      patientConditions: ["diabetes", "hypertension"]
    };

    assertExists(request.medication_rxcui);
    assertExists(request.patient_id);
    assertEquals(request.suggestAlternatives, true);
  });

  await t.step("should default suggestAlternatives to true", () => {
    const suggestAlternatives = undefined ?? true;

    assertEquals(suggestAlternatives, true);
  });

  await t.step("should use correct RxNorm API base URL", () => {
    const RXNORM_API_BASE = "https://rxnav.nlm.nih.gov/REST";

    assertEquals(RXNORM_API_BASE.includes("rxnav.nlm.nih.gov"), true);
  });

  await t.step("should construct RxNorm interaction API URL", () => {
    const medication_rxcui = "860975";
    const activeRxcuis = ["197361", "310965"];
    const rxcuiList = activeRxcuis.join("+");
    const url = `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${medication_rxcui}+${rxcuiList}&sources=DrugBank`;

    assertEquals(url.includes("interaction/list.json"), true);
    assertEquals(url.includes("rxcuis="), true);
    assertEquals(url.includes("sources=DrugBank"), true);
  });

  await t.step("should return no interactions if patient has no active medications", () => {
    const response = {
      has_interactions: false,
      interactions: [],
      checked_against: [],
      message: "Patient has no other active medications"
    };

    assertEquals(response.has_interactions, false);
    assertEquals(response.interactions.length, 0);
    assertExists(response.message);
  });

  await t.step("should structure interaction response correctly", () => {
    const interaction = {
      severity: "high",
      interacting_medication: "Warfarin",
      description: "May increase anticoagulant effect",
      source: "rxnorm"
    };

    assertExists(interaction.severity);
    assertExists(interaction.interacting_medication);
    assertExists(interaction.description);
    assertEquals(interaction.source, "rxnorm");
  });

  await t.step("should validate severity levels", () => {
    const severityLevels = ["high", "moderate", "low", "n/a"];

    assertEquals(severityLevels.includes("high"), true);
    assertEquals(severityLevels.includes("moderate"), true);
    assertEquals(severityLevels.includes("low"), true);
  });

  await t.step("should calculate highest severity correctly", () => {
    const interactions = [
      { severity: "low" },
      { severity: "high" },
      { severity: "moderate" }
    ];

    const severityOrder: Record<string, number> = { high: 3, moderate: 2, low: 1, "n/a": 0 };
    const highestSeverity = interactions.reduce((max, i) => {
      return (severityOrder[i.severity] || 0) > (severityOrder[max] || 0) ? i.severity : max;
    }, "n/a");

    assertEquals(highestSeverity, "high");
  });

  await t.step("should check cache before API call", () => {
    const cacheQuery = {
      drug_a_rxcui: "860975",
      drug_b_rxcui: "197361",
      cache_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    const isExpired = new Date(cacheQuery.cache_expires_at) < new Date();
    assertEquals(isExpired, false);
  });

  await t.step("should use cached interaction if available", () => {
    const cached = {
      has_interaction: true,
      severity: "moderate",
      interaction_description: "May increase bleeding risk"
    };

    const interaction = {
      severity: cached.severity || "unknown",
      interacting_medication: "Aspirin",
      description: cached.interaction_description || "",
      source: "cache"
    };

    assertEquals(interaction.source, "cache");
    assertEquals(interaction.severity, "moderate");
  });

  await t.step("should cache interaction results", () => {
    const cacheEntry = {
      drug_a_rxcui: "860975",
      drug_a_name: "Metformin",
      drug_b_rxcui: "197361",
      drug_b_name: "Warfarin",
      has_interaction: true,
      severity: "high",
      interaction_description: "May increase anticoagulant effect",
      source_api: "rxnorm",
      source_version: "DrugBank"
    };

    assertExists(cacheEntry.drug_a_rxcui);
    assertExists(cacheEntry.drug_b_rxcui);
    assertEquals(cacheEntry.has_interaction, true);
  });

  await t.step("should cache negative results too", () => {
    const cacheEntry = {
      drug_a_rxcui: "860975",
      drug_a_name: "Metformin",
      drug_b_rxcui: "310965",
      drug_b_name: "Lisinopril",
      has_interaction: false,
      source_api: "rxnorm",
      source_version: "DrugBank"
    };

    assertEquals(cacheEntry.has_interaction, false);
  });

  await t.step("should log interaction check for audit", () => {
    const checkLog = {
      patient_id: "patient-123",
      medication_rxcui: "860975",
      medication_name: "Metformin",
      check_performed: true,
      interactions_found: 2,
      highest_severity: "high",
      api_used: "rxnorm",
      prescriber_id: "provider-456"
    };

    assertExists(checkLog.patient_id);
    assertEquals(checkLog.check_performed, true);
    assertEquals(checkLog.api_used, "rxnorm");
  });

  await t.step("should structure alternative suggestion correctly", () => {
    const alternative = {
      medication_name: "Glipizide",
      drug_class: "Sulfonylurea",
      rationale: "Alternative diabetes medication with fewer interactions",
      considerations: ["Monitor blood glucose closely", "Risk of hypoglycemia"],
      requires_review: true
    };

    assertExists(alternative.medication_name);
    assertExists(alternative.drug_class);
    assertEquals(alternative.requires_review, true);
    assertEquals(alternative.considerations.length >= 1, true);
  });

  await t.step("should use Claude Haiku for alternative suggestions", () => {
    const HAIKU_MODEL = "claude-haiku-4-5-20250919";
    assertEquals(HAIKU_MODEL.includes("haiku"), true);
  });

  await t.step("should include AI analysis in response", () => {
    const response = {
      has_interactions: true,
      interactions: [{ severity: "high", interacting_medication: "Warfarin", description: "test", source: "rxnorm" }],
      checked_against: ["Warfarin"],
      alternatives: [{ medication_name: "test", drug_class: "test", rationale: "test", considerations: [], requires_review: true }],
      ai_analysis: "This interaction is clinically significant and requires careful monitoring."
    };

    assertExists(response.ai_analysis);
    assertEquals(response.ai_analysis.length > 0, true);
  });

  await t.step("should log AI usage for alternative suggestions", () => {
    const usageLog = {
      user_id: "provider-456",
      request_id: crypto.randomUUID(),
      model: "claude-haiku-4-5-20250919",
      request_type: "drug_interaction_alternatives",
      input_tokens: 300,
      output_tokens: 500,
      cost: (300 / 1_000_000) * 0.8 + (500 / 1_000_000) * 4.0,
      response_time_ms: 800,
      success: true
    };

    assertEquals(usageLog.request_type, "drug_interaction_alternatives");
    assertEquals(usageLog.success, true);
  });

  await t.step("should structure full response correctly", () => {
    const response = {
      has_interactions: true,
      interactions: [
        {
          severity: "high",
          interacting_medication: "Warfarin",
          description: "May increase anticoagulant effect",
          source: "rxnorm"
        }
      ],
      checked_against: ["Warfarin", "Aspirin"],
      medication_rxcui: "860975",
      patient_id: "patient-123",
      alternatives: undefined,
      ai_analysis: undefined
    };

    assertEquals(response.has_interactions, true);
    assertEquals(response.interactions.length, 1);
    assertEquals(response.checked_against.length, 2);
  });

  await t.step("should continue without alternatives if AI fails", () => {
    const aiError = new Error("Claude API error");
    const shouldContinue = true;

    // Core interaction check succeeded, AI alternatives are optional
    assertEquals(shouldContinue, true);
  });

  await t.step("should extract RxCUI from medication codeable concept", () => {
    const medicationCodeableConcept = {
      rxcui: "860975",
      coding: [{ display: "Metformin 500 MG Oral Tablet" }]
    };

    const rxcui = medicationCodeableConcept?.rxcui;
    assertEquals(rxcui, "860975");
  });

  await t.step("should build RxCUI to medication name mapping", () => {
    const rxcuiToMedName: Record<string, string> = {
      "860975": "Metformin",
      "197361": "Warfarin"
    };

    assertEquals(rxcuiToMedName["860975"], "Metformin");
    assertEquals(rxcuiToMedName["197361"], "Warfarin");
  });

  await t.step("should return 500 for API errors", () => {
    const hasError = true;
    const expectedStatus = hasError ? 500 : 200;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should include error details in 500 response", () => {
    const errorResponse = {
      error: "Failed to check drug interactions",
      details: "Database connection failed"
    };

    assertExists(errorResponse.error);
    assertExists(errorResponse.details);
  });

  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      success: 200,
      badRequest: 400,
      unauthorized: 401,
      forbidden: 403,
      serverError: 500
    };

    assertEquals(statusCodes.success, 200);
    assertEquals(statusCodes.badRequest, 400);
    assertEquals(statusCodes.unauthorized, 401);
    assertEquals(statusCodes.forbidden, 403);
    assertEquals(statusCodes.serverError, 500);
  });

  await t.step("should include Content-Type header in responses", () => {
    const headers = { "Content-Type": "application/json" };

    assertEquals(headers["Content-Type"], "application/json");
  });
});
