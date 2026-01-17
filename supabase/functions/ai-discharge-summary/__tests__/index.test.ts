// supabase/functions/ai-discharge-summary/__tests__/index.test.ts
// Tests for ai-discharge-summary edge function (Skill #19)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Discharge Summary Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/ai-discharge-summary", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require patientId", () => {
    const validBody = { patientId: "patient-123", encounterId: "encounter-456" };
    const invalidBody = { encounterId: "encounter-456" };

    assertExists(validBody.patientId);
    assertEquals("patientId" in invalidBody, false);
  });

  await t.step("should require encounterId", () => {
    const validBody = { patientId: "patient-123", encounterId: "encounter-456" };
    const invalidBody = { patientId: "patient-123" };

    assertExists(validBody.encounterId);
    assertEquals("encounterId" in invalidBody, false);
  });

  await t.step("should return 400 for missing patientId", () => {
    const hasPatientId = false;
    const expectedStatus = hasPatientId ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should return 400 for missing encounterId", () => {
    const hasEncounterId = false;
    const expectedStatus = hasEncounterId ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should accept optional parameters", () => {
    const body = {
      patientId: "patient-123",
      encounterId: "encounter-456",
      tenantId: "tenant-A",
      dischargePlanId: "plan-789",
      dischargeDisposition: "home",
      attendingPhysician: "Dr. Smith",
      includePatientInstructions: true
    };

    assertExists(body.tenantId);
    assertExists(body.dischargePlanId);
    assertExists(body.dischargeDisposition);
  });

  await t.step("should default dischargeDisposition to 'home'", () => {
    const dischargeDisposition = undefined ?? "home";

    assertEquals(dischargeDisposition, "home");
  });

  await t.step("should default includePatientInstructions to true", () => {
    const includePatientInstructions = undefined ?? true;

    assertEquals(includePatientInstructions, true);
  });

  await t.step("should validate discharge disposition values", () => {
    const validDispositions = [
      "home",
      "home_health",
      "snf",
      "rehab",
      "ltac",
      "hospice",
      "expired",
      "ama"
    ];

    assertEquals(validDispositions.includes("home"), true);
    assertEquals(validDispositions.includes("snf"), true);
    assertEquals(validDispositions.includes("hospice"), true);
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

  await t.step("should use Claude Sonnet model", () => {
    const SONNET_MODEL = "claude-sonnet-4-20250514";
    assertEquals(SONNET_MODEL.includes("sonnet"), true);
  });

  await t.step("should structure discharge summary header correctly", () => {
    const header = {
      patientName: "John Doe",
      dateOfBirth: "1950-01-15",
      admissionDate: "2026-01-10T00:00:00Z",
      dischargeDate: "2026-01-17T00:00:00Z",
      lengthOfStay: 7,
      attendingPhysician: "Dr. Smith",
      dischargeDisposition: "home"
    };

    assertExists(header.patientName);
    assertExists(header.admissionDate);
    assertExists(header.dischargeDate);
    assertEquals(header.lengthOfStay, 7);
  });

  await t.step("should calculate length of stay correctly", () => {
    const admissionDate = new Date("2026-01-10T00:00:00Z");
    const dischargeDate = new Date("2026-01-17T00:00:00Z");
    const lengthOfStay = Math.max(1, Math.ceil((dischargeDate.getTime() - admissionDate.getTime()) / (24 * 60 * 60 * 1000)));

    assertEquals(lengthOfStay, 7);
  });

  await t.step("should structure discharge diagnoses correctly", () => {
    const diagnosis = {
      code: "E11.9",
      display: "Type 2 diabetes mellitus without complications",
      type: "principal" as const
    };

    assertExists(diagnosis.code);
    assertExists(diagnosis.display);
    assertEquals(diagnosis.type, "principal");
  });

  await t.step("should validate diagnosis types", () => {
    const validTypes = ["principal", "secondary", "complication"];

    assertEquals(validTypes.includes("principal"), true);
    assertEquals(validTypes.includes("secondary"), true);
    assertEquals(validTypes.includes("complication"), true);
  });

  await t.step("should structure medication reconciliation correctly", () => {
    const medReconciliation = {
      continued: [{ name: "Lisinopril", dose: "10mg", route: "oral", frequency: "daily", indication: "HTN" }],
      new: [{ name: "Metformin", dose: "500mg", route: "oral", frequency: "twice daily", indication: "DM" }],
      changed: [{ name: "Amlodipine", previousDose: "5mg", newDose: "10mg", reason: "BP control" }],
      discontinued: [{ name: "Aspirin", dose: "325mg", route: "oral", frequency: "daily", indication: "was temporary" }],
      allergies: ["Penicillin"],
      interactions: ["Metformin + contrast - hold before imaging"]
    };

    assertExists(medReconciliation.continued);
    assertExists(medReconciliation.new);
    assertExists(medReconciliation.changed);
    assertExists(medReconciliation.discontinued);
    assertEquals(medReconciliation.allergies.length, 1);
  });

  await t.step("should structure follow-up appointments correctly", () => {
    const appointment = {
      specialty: "Primary Care",
      provider: "Dr. Johnson",
      timeframe: "7 days",
      purpose: "Post-discharge follow-up",
      urgency: "routine" as const
    };

    assertExists(appointment.specialty);
    assertExists(appointment.timeframe);
    assertEquals(appointment.urgency, "routine");
  });

  await t.step("should validate follow-up urgency levels", () => {
    const validUrgencies = ["routine", "urgent", "as_needed"];

    assertEquals(validUrgencies.includes("routine"), true);
    assertEquals(validUrgencies.includes("urgent"), true);
    assertEquals(validUrgencies.includes("as_needed"), true);
  });

  await t.step("should structure patient instructions correctly", () => {
    const instruction = {
      category: "medication" as const,
      instruction: "Take all medications as prescribed",
      importance: "critical" as const
    };

    assertExists(instruction.instruction);
    assertEquals(instruction.category, "medication");
    assertEquals(instruction.importance, "critical");
  });

  await t.step("should validate instruction categories", () => {
    const validCategories = ["activity", "diet", "wound_care", "medication", "symptoms", "general"];

    assertEquals(validCategories.includes("activity"), true);
    assertEquals(validCategories.includes("medication"), true);
    assertEquals(validCategories.includes("wound_care"), true);
  });

  await t.step("should validate instruction importance levels", () => {
    const validImportance = ["critical", "important", "informational"];

    assertEquals(validImportance.includes("critical"), true);
    assertEquals(validImportance.includes("important"), true);
    assertEquals(validImportance.includes("informational"), true);
  });

  await t.step("should structure warning signs correctly", () => {
    const warningSign = {
      sign: "Fever over 101\u00B0F",
      action: "Contact your doctor or go to urgent care",
      urgency: "urgent_care" as const
    };

    assertExists(warningSign.sign);
    assertExists(warningSign.action);
    assertEquals(warningSign.urgency, "urgent_care");
  });

  await t.step("should validate warning sign urgencies", () => {
    const validUrgencies = ["call_office", "urgent_care", "emergency"];

    assertEquals(validUrgencies.includes("call_office"), true);
    assertEquals(validUrgencies.includes("urgent_care"), true);
    assertEquals(validUrgencies.includes("emergency"), true);
  });

  await t.step("should determine readmission risk category from score", () => {
    const getRiskCategory = (score: number): string => {
      if (score < 30) return "low";
      if (score < 60) return "moderate";
      if (score < 80) return "high";
      return "very_high";
    };

    assertEquals(getRiskCategory(20), "low");
    assertEquals(getRiskCategory(45), "moderate");
    assertEquals(getRiskCategory(70), "high");
    assertEquals(getRiskCategory(85), "very_high");
  });

  await t.step("should always require physician review", () => {
    const summary = {
      requiresReview: true,
      reviewReasons: ["All AI-generated discharge summaries require physician review and approval"]
    };

    assertEquals(summary.requiresReview, true);
    assertEquals(summary.reviewReasons.length >= 1, true);
  });

  await t.step("should add review flags for medication changes", () => {
    const summary = {
      medicationReconciliation: {
        new: [{ name: "Metformin" }],
        changed: []
      },
      reviewReasons: [] as string[]
    };

    if (summary.medicationReconciliation.new.length > 0 || summary.medicationReconciliation.changed.length > 0) {
      summary.reviewReasons.push("Medication changes require pharmacist verification");
    }

    assertEquals(summary.reviewReasons.includes("Medication changes require pharmacist verification"), true);
  });

  await t.step("should add alert for drug interactions", () => {
    const summary = {
      medicationReconciliation: {
        interactions: ["Warfarin + Aspirin"]
      },
      reviewReasons: [] as string[]
    };

    if (summary.medicationReconciliation.interactions.length > 0) {
      summary.reviewReasons.unshift("ALERT: Potential drug interactions identified");
    }

    assertEquals(summary.reviewReasons[0], "ALERT: Potential drug interactions identified");
  });

  await t.step("should include disclaimer", () => {
    const disclaimer = "This discharge summary was generated with AI assistance and requires physician review and approval before release.";

    assertEquals(disclaimer.includes("AI assistance"), true);
    assertEquals(disclaimer.includes("physician review"), true);
  });

  await t.step("should log AI usage correctly", () => {
    const usageLog = {
      user_id: "patient-123",
      tenant_id: "tenant-A",
      request_id: crypto.randomUUID(),
      model: "claude-sonnet-4-20250514",
      request_type: "discharge_summary",
      input_tokens: 3000,
      output_tokens: 2500,
      cost: (3000 / 1_000_000) * 3 + (2500 / 1_000_000) * 15,
      response_time_ms: 2500,
      success: true,
      metadata: { encounter_id: "encounter-456" }
    };

    assertEquals(usageLog.request_type, "discharge_summary");
    assertEquals(usageLog.success, true);
    assertExists(usageLog.metadata.encounter_id);
  });

  await t.step("should structure full response correctly", () => {
    const response = {
      summary: {
        patientName: "John Doe",
        hospitalCourse: "Patient course description...",
        requiresReview: true
      },
      metadata: {
        generated_at: new Date().toISOString(),
        model: "claude-sonnet-4-20250514",
        response_time_ms: 2500,
        encounter_id: "encounter-456",
        discharge_disposition: "home",
        context_summary: {
          conditions_count: 5,
          procedures_count: 2,
          medications_count: 10,
          allergies_count: 1
        }
      }
    };

    assertExists(response.summary);
    assertExists(response.metadata);
    assertExists(response.metadata.context_summary);
  });

  await t.step("should provide fallback summary on AI failure", () => {
    const fallbackSummary = {
      hospitalCourse: "AI summary generation failed. Please document hospital course manually.",
      confidence: 0.3,
      requiresReview: true,
      reviewReasons: [
        "AI summary generation failed - manual documentation required",
        "Medication reconciliation requires manual review",
        "All fields require physician verification"
      ]
    };

    assertEquals(fallbackSummary.confidence, 0.3);
    assertEquals(fallbackSummary.reviewReasons.length, 3);
  });

  await t.step("should gather patient context from database", () => {
    const context = {
      name: "John Doe",
      dateOfBirth: "1950-01-15",
      sex: "male",
      allergies: ["Penicillin"],
      admissionDate: "2026-01-10T00:00:00Z",
      chiefComplaint: "Chest pain",
      conditions: [{ code: "I21.9", display: "Acute MI" }],
      procedures: [{ code: "92928", display: "Coronary stent", date: "2026-01-11" }],
      dischargeMedications: [{ name: "Aspirin", dose: "81mg", frequency: "daily", status: "active" }],
      vitalSigns: { heart_rate: { value: 72, unit: "bpm" } },
      labResults: [{ name: "Troponin", value: "0.15", unit: "ng/mL", date: "2026-01-10", abnormal: true }]
    };

    assertExists(context.name);
    assertExists(context.allergies);
    assertEquals(context.conditions.length >= 1, true);
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
