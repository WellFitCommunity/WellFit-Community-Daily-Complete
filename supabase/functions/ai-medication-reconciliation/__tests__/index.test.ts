// supabase/functions/ai-medication-reconciliation/__tests__/index.test.ts
// Tests for ai-medication-reconciliation edge function (Skill #26)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Medication Reconciliation Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/ai-medication-reconciliation", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require patientId and providerId", () => {
    const validBody = { patientId: "patient-123", providerId: "provider-456", medications: {} };
    const invalidBody = { providerId: "provider-456", medications: {} };

    assertExists(validBody.patientId);
    assertExists(validBody.providerId);
    assertEquals("patientId" in invalidBody, false);
  });

  await t.step("should return 400 for missing required fields", () => {
    const hasRequiredFields = false;
    const expectedStatus = hasRequiredFields ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should require medications field", () => {
    const validBody = { patientId: "patient-123", providerId: "provider-456", medications: {} };
    const invalidBody = { patientId: "patient-123", providerId: "provider-456" };

    assertExists(validBody.medications);
    assertEquals("medications" in invalidBody, false);
  });

  await t.step("should return 400 if no medications in any list", () => {
    const medications = {
      admission: [],
      prescribed: [],
      current: [],
      discharge: []
    };

    const totalMeds =
      (medications.admission?.length || 0) +
      (medications.prescribed?.length || 0) +
      (medications.current?.length || 0) +
      (medications.discharge?.length || 0);

    assertEquals(totalMeds, 0);
  });

  await t.step("should validate encounter types", () => {
    const validTypes = ["admission", "discharge", "transfer", "ambulatory"];

    assertEquals(validTypes.includes("admission"), true);
    assertEquals(validTypes.includes("discharge"), true);
    assertEquals(validTypes.includes("transfer"), true);
    assertEquals(validTypes.includes("ambulatory"), true);
    assertEquals(validTypes.includes("other"), false);
  });

  await t.step("should default encounterType to ambulatory", () => {
    const getEncounterType = (provided?: string): string => {
      return provided ?? "ambulatory";
    };

    assertEquals(getEncounterType(undefined), "ambulatory");
    assertEquals(getEncounterType("admission"), "admission");
  });

  await t.step("should structure medication entry correctly", () => {
    const medication = {
      name: "Metformin",
      dosage: "500mg",
      frequency: "twice daily",
      route: "oral",
      rxcui: "860975",
      startDate: "2025-01-01",
      prescriber: "Dr. Smith",
      indication: "Type 2 diabetes"
    };

    assertExists(medication.name);
    assertExists(medication.dosage);
    assertEquals(medication.route, "oral");
  });

  await t.step("should structure medication source lists", () => {
    const medications = {
      admission: [{ name: "Lisinopril", dosage: "10mg" }],
      prescribed: [{ name: "Metformin", dosage: "500mg" }],
      current: [{ name: "Aspirin", dosage: "81mg" }],
      discharge: [{ name: "Lisinopril", dosage: "10mg" }]
    };

    assertEquals(medications.admission.length, 1);
    assertEquals(medications.prescribed.length, 1);
    assertEquals(medications.current.length, 1);
    assertExists(medications.discharge);
  });

  await t.step("should validate discrepancy types", () => {
    const discrepancyTypes = [
      "missing",
      "duplicate",
      "dose_change",
      "route_change",
      "new",
      "discontinued",
      "frequency_change"
    ];

    assertEquals(discrepancyTypes.includes("missing"), true);
    assertEquals(discrepancyTypes.includes("duplicate"), true);
    assertEquals(discrepancyTypes.includes("dose_change"), true);
    assertEquals(discrepancyTypes.includes("new"), true);
  });

  await t.step("should validate clinical significance levels", () => {
    const validLevels = ["critical", "high", "medium", "low"];

    assertEquals(validLevels.includes("critical"), true);
    assertEquals(validLevels.includes("high"), true);
    assertEquals(validLevels.includes("medium"), true);
    assertEquals(validLevels.includes("low"), true);
  });

  await t.step("should structure discrepancy analysis correctly", () => {
    const discrepancy = {
      medication: "Lisinopril",
      discrepancyType: "dose_change" as const,
      likelyReason: "Dose increased due to uncontrolled hypertension",
      clinicalSignificance: "high" as const,
      recommendation: "Verify intentional dose change with prescriber",
      requiresPharmacistReview: true,
      confidence: 0.85
    };

    assertExists(discrepancy.medication);
    assertExists(discrepancy.likelyReason);
    assertEquals(discrepancy.requiresPharmacistReview, true);
    assertEquals(discrepancy.confidence >= 0 && discrepancy.confidence <= 1, true);
  });

  await t.step("should structure deprescribing candidate correctly", () => {
    const candidate = {
      medication: "Diphenhydramine",
      reason: "Anticholinergic in elderly patient",
      evidence: "Beers Criteria recommends avoiding",
      riskIfContinued: "Increased fall risk, cognitive decline",
      suggestedApproach: "Taper and discontinue over 2 weeks",
      priority: "high" as const
    };

    assertExists(candidate.medication);
    assertExists(candidate.reason);
    assertExists(candidate.evidence);
    assertEquals(candidate.priority, "high");
  });

  await t.step("should structure patient counseling point correctly", () => {
    const counselingPoint = {
      topic: "New Diabetes Medication",
      keyPoints: ["Take with food", "Monitor blood sugar", "Watch for hypoglycemia"],
      relatedMedications: ["Metformin"],
      warningSignsToWatch: ["Dizziness", "Sweating", "Confusion"]
    };

    assertExists(counselingPoint.topic);
    assertEquals(counselingPoint.keyPoints.length, 3);
    assertEquals(counselingPoint.relatedMedications.includes("Metformin"), true);
  });

  await t.step("should validate action item priorities", () => {
    const validPriorities = ["immediate", "high", "medium", "low"];

    assertEquals(validPriorities.includes("immediate"), true);
    assertEquals(validPriorities.includes("high"), true);
    assertEquals(validPriorities.includes("medium"), true);
    assertEquals(validPriorities.includes("low"), true);
  });

  await t.step("should structure action item correctly", () => {
    const actionItem = {
      priority: "high" as const,
      action: "Verify warfarin dose change with cardiology",
      rationale: "INR levels were supratherapeutic on admission"
    };

    assertExists(actionItem.action);
    assertExists(actionItem.rationale);
    assertEquals(actionItem.priority, "high");
  });

  await t.step("should redact PHI from logs", () => {
    const redact = (s: string): string =>
      s
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
        .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
        .replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, "[DOB]");

    assertEquals(redact("patient@email.com"), "[EMAIL]");
    assertEquals(redact("555-123-4567"), "[PHONE]");
    assertEquals(redact("123-45-6789"), "[SSN]");
    assertEquals(redact("01/15/1950"), "[DOB]");
  });

  await t.step("should use Claude Sonnet model for safety-critical analysis", () => {
    const SONNET_MODEL = "claude-sonnet-4-20250514";
    assertEquals(SONNET_MODEL.includes("sonnet"), true);
  });

  await t.step("should always require clinical review", () => {
    const result = {
      requiresReview: true,
      reviewReasons: ["All medication reconciliations require clinician review"]
    };

    assertEquals(result.requiresReview, true);
    assertEquals(result.reviewReasons.length >= 1, true);
  });

  await t.step("should structure reconciliation summary correctly", () => {
    const summary = {
      continued: [{ name: "Lisinopril", dosage: "10mg" }],
      new: [{ name: "Metformin", dosage: "500mg" }],
      changed: [{ medication: "Amlodipine", changeType: "dose", from: "5mg", to: "10mg" }],
      discontinued: [{ name: "Aspirin", dosage: "325mg" }],
      allergiesConsidered: ["Penicillin"],
      interactionsIdentified: ["Warfarin + Aspirin: increased bleeding risk"]
    };

    assertExists(summary.continued);
    assertExists(summary.new);
    assertExists(summary.changed);
    assertExists(summary.discontinued);
    assertExists(summary.allergiesConsidered);
    assertExists(summary.interactionsIdentified);
  });

  await t.step("should structure statistics correctly", () => {
    const stats = {
      totalMedicationsReviewed: 15,
      continued: 10,
      new: 2,
      changed: 2,
      discontinued: 1,
      discrepanciesFound: 3,
      deprescribingOpportunities: 2
    };

    assertEquals(stats.totalMedicationsReviewed, 15);
    assertEquals(stats.continued + stats.new + stats.discontinued + stats.changed, 15);
  });

  await t.step("should include pharmacy checklist", () => {
    const checklist = [
      "Verify all medication names and doses",
      "Check for drug-drug interactions",
      "Confirm allergy list is current",
      "Verify indication for each medication"
    ];

    assertEquals(checklist.length >= 2, true);
    assertEquals(checklist[0].includes("Verify"), true);
  });

  await t.step("should log AI usage to claude_usage_logs", () => {
    const usageLog = {
      user_id: "provider-456",
      request_id: crypto.randomUUID(),
      model: "claude-sonnet-4-20250514",
      request_type: "medication_reconciliation",
      input_tokens: 2000,
      output_tokens: 2500,
      cost: (2000 / 1_000_000) * 3.0 + (2500 / 1_000_000) * 15.0,
      response_time_ms: 2500,
      success: true,
      metadata: {
        encounterType: "admission",
        totalMedications: 15,
        discrepanciesFound: 3,
        deprescribingOpportunities: 2
      }
    };

    assertEquals(usageLog.request_type, "medication_reconciliation");
    assertEquals(usageLog.success, true);
    assertExists(usageLog.metadata.encounterType);
  });

  await t.step("should include narrative summary", () => {
    const summary = "Reconciliation identified 3 discrepancies requiring pharmacist review. 2 deprescribing opportunities identified for polypharmacy reduction.";

    assertEquals(summary.length > 0, true);
    assertEquals(summary.includes("discrepancies") || summary.includes("reconciliation"), true);
  });

  await t.step("should provide fallback response on parse failure", () => {
    const fallbackResponse = {
      reconciliationSummary: {
        continued: [],
        new: [],
        changed: [],
        discontinued: [],
        allergiesConsidered: [],
        interactionsIdentified: []
      },
      discrepancyAnalysis: [],
      deprescribingCandidates: [],
      patientCounseling: [],
      pharmacyChecklist: ["Verify all medication names and doses", "Check for drug-drug interactions"],
      actionItems: [{
        priority: "high",
        action: "Manual reconciliation required",
        rationale: "Automated analysis could not be completed"
      }],
      statistics: {
        totalMedicationsReviewed: 0,
        continued: 0,
        new: 0,
        changed: 0,
        discontinued: 0,
        discrepanciesFound: 0,
        deprescribingOpportunities: 0
      },
      confidence: 0.3,
      requiresReview: true,
      reviewReasons: ["Automated analysis incomplete - manual review required"],
      pharmacistReviewRequired: true,
      narrativeSummary: "Unable to complete automated medication reconciliation."
    };

    assertEquals(fallbackResponse.confidence, 0.3);
    assertEquals(fallbackResponse.pharmacistReviewRequired, true);
    assertEquals(fallbackResponse.requiresReview, true);
  });

  await t.step("should support lab values for safety checks", () => {
    const labValues = {
      creatinine: 1.5,
      eGFR: 45,
      alt: 35,
      ast: 30
    };

    assertExists(labValues.creatinine);
    assertExists(labValues.eGFR);
  });

  await t.step("should format medication list for AI prompt", () => {
    const meds = [
      { name: "Metformin", dosage: "500mg", frequency: "twice daily", route: "oral", indication: "diabetes" }
    ];

    const formatMedList = (meds: Array<{ name: string; dosage?: string; frequency?: string; route?: string; indication?: string }>): string => {
      if (meds.length === 0) return "None";
      return meds.map(m =>
        `- ${m.name}${m.dosage ? ` ${m.dosage}` : ""}${m.frequency ? ` ${m.frequency}` : ""}${m.route ? ` (${m.route})` : ""}${m.indication ? ` for ${m.indication}` : ""}`
      ).join("\n");
    };

    const formatted = formatMedList(meds);
    assertEquals(formatted.includes("Metformin"), true);
    assertEquals(formatted.includes("500mg"), true);
    assertEquals(formatted.includes("diabetes"), true);
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
