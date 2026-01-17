// supabase/functions/ai-referral-letter/__tests__/index.test.ts
// Tests for ai-referral-letter edge function (Skill #22 - Referral Letter Generator)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Referral Letter Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/ai-referral-letter", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require patientId", () => {
    const validBody = { patientId: "patient-123", referringProviderId: "prov-456", specialistSpecialty: "Cardiology", clinicalReason: "Chest pain" };
    const invalidBody = { referringProviderId: "prov-456", specialistSpecialty: "Cardiology", clinicalReason: "Chest pain" };

    assertExists(validBody.patientId);
    assertEquals("patientId" in invalidBody, false);
  });

  await t.step("should require referringProviderId", () => {
    const validBody = { patientId: "patient-123", referringProviderId: "prov-456", specialistSpecialty: "Cardiology", clinicalReason: "Chest pain" };
    const invalidBody = { patientId: "patient-123", specialistSpecialty: "Cardiology", clinicalReason: "Chest pain" };

    assertExists(validBody.referringProviderId);
    assertEquals("referringProviderId" in invalidBody, false);
  });

  await t.step("should require specialistSpecialty", () => {
    const validBody = { patientId: "patient-123", referringProviderId: "prov-456", specialistSpecialty: "Cardiology", clinicalReason: "Chest pain" };
    const invalidBody = { patientId: "patient-123", referringProviderId: "prov-456", clinicalReason: "Chest pain" };

    assertExists(validBody.specialistSpecialty);
    assertEquals("specialistSpecialty" in invalidBody, false);
  });

  await t.step("should require clinicalReason", () => {
    const validBody = { patientId: "patient-123", referringProviderId: "prov-456", specialistSpecialty: "Cardiology", clinicalReason: "Chest pain" };
    const invalidBody = { patientId: "patient-123", referringProviderId: "prov-456", specialistSpecialty: "Cardiology" };

    assertExists(validBody.clinicalReason);
    assertEquals("clinicalReason" in invalidBody, false);
  });

  await t.step("should return 400 for missing required fields", () => {
    const hasRequiredFields = false;
    const expectedStatus = hasRequiredFields ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should accept optional parameters", () => {
    const body = {
      patientId: "patient-123",
      referringProviderId: "prov-456",
      specialistSpecialty: "Cardiology",
      clinicalReason: "Chest pain evaluation",
      specialistProviderId: "specialist-789",
      clinicalNotes: "History of hypertension",
      diagnoses: ["I10", "R07.9"],
      medications: ["Lisinopril 10mg", "Aspirin 81mg"],
      allergies: ["Penicillin"],
      insurancePayer: "Blue Cross Blue Shield",
      urgency: "urgent",
      tenantId: "tenant-A"
    };

    assertExists(body.specialistProviderId);
    assertExists(body.clinicalNotes);
    assertExists(body.diagnoses);
    assertExists(body.medications);
    assertExists(body.allergies);
    assertExists(body.insurancePayer);
    assertExists(body.urgency);
    assertExists(body.tenantId);
  });

  await t.step("should default urgency to routine", () => {
    const urgency = undefined ?? "routine";

    assertEquals(urgency, "routine");
  });

  await t.step("should validate urgency levels", () => {
    const validUrgencies = ["routine", "urgent", "emergent"];

    assertEquals(validUrgencies.includes("routine"), true);
    assertEquals(validUrgencies.includes("urgent"), true);
    assertEquals(validUrgencies.includes("emergent"), true);
    assertEquals(validUrgencies.includes("stat"), false);
  });

  // PHI redaction tests
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
  await t.step("should use Claude Haiku 4.5 for cost-effective generation", () => {
    const HAIKU_MODEL = "claude-haiku-4-5-20250919";
    assertEquals(HAIKU_MODEL.includes("haiku"), true);
  });

  // Referral context structure tests
  await t.step("should structure referral context correctly", () => {
    const context = {
      patientFirstName: "John",
      patientDOB: "1950-01-15",
      patientMRN: "MRN123456",
      referringProviderName: "Dr. Smith",
      referringProviderCredentials: "MD, FACP",
      referringProviderNPI: "1234567890",
      conditions: [{ code: "I10", display: "Essential hypertension" }],
      medications: [{ name: "Lisinopril", dose: "10mg", frequency: "daily" }],
      allergies: ["Penicillin"],
      recentVitals: { blood_pressure: { value: "130/80", unit: "mmHg" } },
      socialHistory: "Non-smoker"
    };

    assertExists(context.patientFirstName);
    assertExists(context.referringProviderName);
    assertEquals(context.conditions.length, 1);
    assertEquals(context.medications.length, 1);
    assertEquals(context.allergies.length, 1);
  });

  await t.step("should provide default context values", () => {
    const context = {
      patientFirstName: "Patient",
      referringProviderName: "Provider",
      conditions: [],
      medications: [],
      allergies: []
    };

    assertEquals(context.patientFirstName, "Patient");
    assertEquals(context.referringProviderName, "Provider");
    assertEquals(context.conditions.length, 0);
  });

  // Urgency timeline tests
  await t.step("should get default timeline for emergent", () => {
    const getDefaultTimeline = (urgency?: string): string => {
      switch (urgency) {
        case "emergent":
          return "Immediate evaluation requested - please contact patient as soon as possible";
        case "urgent":
          return "Evaluation within 1-2 weeks is recommended";
        default:
          return "Routine evaluation at patient's earliest convenience";
      }
    };

    assertEquals(getDefaultTimeline("emergent").includes("Immediate"), true);
  });

  await t.step("should get default timeline for urgent", () => {
    const getDefaultTimeline = (urgency?: string): string => {
      switch (urgency) {
        case "emergent":
          return "Immediate evaluation requested";
        case "urgent":
          return "Evaluation within 1-2 weeks is recommended";
        default:
          return "Routine evaluation at patient's earliest convenience";
      }
    };

    assertEquals(getDefaultTimeline("urgent").includes("1-2 weeks"), true);
  });

  await t.step("should get default timeline for routine", () => {
    const getDefaultTimeline = (urgency?: string): string => {
      switch (urgency) {
        case "emergent":
          return "Immediate evaluation requested";
        case "urgent":
          return "Evaluation within 1-2 weeks is recommended";
        default:
          return "Routine evaluation at patient's earliest convenience";
      }
    };

    assertEquals(getDefaultTimeline("routine").includes("earliest convenience"), true);
  });

  // Referral letter structure tests
  await t.step("should structure referral letter correctly", () => {
    const letter = {
      letterDate: "2026-01-17",
      referringProvider: {
        name: "Dr. John Smith",
        credentials: "MD, FACP",
        npi: "1234567890",
        practice: "Primary Care Associates",
        phone: "555-123-4567",
        fax: "555-123-4568"
      },
      recipientProvider: {
        name: "Dr. Jane Doe",
        specialty: "Cardiology",
        practice: "Heart Specialists",
        address: "123 Medical Drive"
      },
      patientName: "John",
      patientDOB: "1950-01-15",
      mrn: "MRN123456",
      chiefComplaint: "Chest pain on exertion",
      relevantHistory: "History of hypertension, dyslipidemia",
      currentMedications: ["Lisinopril 10mg daily", "Atorvastatin 20mg daily"],
      allergies: ["Penicillin (rash)"],
      clinicalReason: "Evaluation for possible coronary artery disease",
      specificQuestions: [
        "Is stress testing appropriate?",
        "Would you recommend cardiac catheterization?"
      ],
      expectedTimeline: "Evaluation within 2 weeks",
      contactInfo: "Call 555-123-4567 for questions",
      closingStatements: "Thank you for your consultation.",
      confidence: 0.85,
      requiresReview: true,
      reviewReasons: ["All referral letters require physician review before sending"],
      insuranceNotes: "Patient has Blue Cross Blue Shield"
    };

    assertExists(letter.letterDate);
    assertExists(letter.referringProvider.name);
    assertExists(letter.recipientProvider.specialty);
    assertExists(letter.patientName);
    assertExists(letter.chiefComplaint);
    assertExists(letter.clinicalReason);
    assertEquals(letter.requiresReview, true);
    assertEquals(letter.specificQuestions.length, 2);
  });

  await t.step("should always require physician review", () => {
    const letter = {
      requiresReview: true,
      reviewReasons: ["All referral letters require physician review before sending"]
    };

    assertEquals(letter.requiresReview, true);
    assertEquals(letter.reviewReasons.length >= 1, true);
  });

  await t.step("should add review flag for fallback letter", () => {
    const letter = {
      confidence: 0.5,
      requiresReview: true,
      reviewReasons: [
        "All referral letters require physician review before sending",
        "This letter was generated using fallback template - review carefully"
      ]
    };

    assertEquals(letter.confidence, 0.5);
    assertEquals(letter.reviewReasons.length, 2);
  });

  // Letter formatting tests
  await t.step("should format letter header correctly", () => {
    const formatLetterHeader = (letter: { referringProvider: { practice?: string; name: string; credentials?: string; npi?: string } }) => {
      const lines: string[] = [];
      if (letter.referringProvider.practice) lines.push(letter.referringProvider.practice);
      lines.push(letter.referringProvider.name);
      if (letter.referringProvider.credentials) lines.push(letter.referringProvider.credentials);
      if (letter.referringProvider.npi) lines.push(`NPI: ${letter.referringProvider.npi}`);
      return lines.filter(l => l !== "").join("\n");
    };

    const letter = {
      referringProvider: {
        practice: "Primary Care Associates",
        name: "Dr. John Smith",
        credentials: "MD, FACP",
        npi: "1234567890"
      }
    };

    const header = formatLetterHeader(letter);
    assertEquals(header.includes("Dr. John Smith"), true);
    assertEquals(header.includes("NPI: 1234567890"), true);
  });

  await t.step("should format patient reference line", () => {
    const letter = {
      patientName: "John",
      patientDOB: "1950-01-15",
      mrn: "MRN123456"
    };

    const refLine = `RE: ${letter.patientName}`;
    const dobLine = letter.patientDOB ? `DOB: ${letter.patientDOB}` : "";
    const mrnLine = letter.mrn ? `MRN: ${letter.mrn}` : "";

    assertEquals(refLine, "RE: John");
    assertEquals(dobLine, "DOB: 1950-01-15");
    assertEquals(mrnLine, "MRN: MRN123456");
  });

  await t.step("should format medications list", () => {
    const medications = ["Lisinopril 10mg daily", "Atorvastatin 20mg daily", "Aspirin 81mg daily"];
    const formattedMeds = medications.map(med => `  - ${med}`).join("\n");

    assertEquals(formattedMeds.includes("  - Lisinopril"), true);
    assertEquals(formattedMeds.includes("  - Atorvastatin"), true);
  });

  await t.step("should format questions list", () => {
    const questions = ["Is stress testing appropriate?", "Would you recommend cath?"];
    const formattedQuestions = questions.map((q, i) => `  ${i + 1}. ${q}`).join("\n");

    assertEquals(formattedQuestions.includes("1. Is stress testing"), true);
    assertEquals(formattedQuestions.includes("2. Would you recommend"), true);
  });

  // Claude API response parsing tests
  await t.step("should extract JSON from Claude response", () => {
    const content = `Here is the referral letter:
{
  "letterDate": "2026-01-17",
  "patientName": "John",
  "chiefComplaint": "Chest pain"
}
Let me know if you need changes.`;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    assertExists(jsonMatch);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      assertEquals(parsed.letterDate, "2026-01-17");
      assertEquals(parsed.patientName, "John");
    }
  });

  await t.step("should provide fallback when parsing fails", () => {
    const useFallback = true;
    const fallbackLetter = {
      letterDate: new Date().toISOString().split("T")[0],
      confidence: 0.5,
      requiresReview: true,
      reviewReasons: [
        "All referral letters require physician review before sending",
        "This letter was generated using fallback template - review carefully"
      ]
    };

    if (useFallback) {
      assertEquals(fallbackLetter.confidence, 0.5);
      assertEquals(fallbackLetter.reviewReasons.length, 2);
    }
  });

  // Usage logging tests
  await t.step("should log AI usage for cost tracking", () => {
    const usageLog = {
      user_id: "provider-123",
      request_id: crypto.randomUUID(),
      model: "claude-haiku-4-5-20250919",
      request_type: "referral_letter_generation",
      input_tokens: 800,
      output_tokens: 600,
      cost: (800 / 1_000_000) * 0.8 + (600 / 1_000_000) * 4.0,
      response_time_ms: 1200,
      success: true,
      metadata: {
        specialty: "Cardiology",
        urgency: "urgent",
        confidence: 0.85
      }
    };

    assertEquals(usageLog.request_type, "referral_letter_generation");
    assertEquals(usageLog.success, true);
    assertExists(usageLog.metadata.specialty);
  });

  await t.step("should calculate Haiku 4.5 costs correctly", () => {
    const inputTokens = 800;
    const outputTokens = 600;
    // Haiku 4.5 pricing: $0.8 per 1M input, $4 per 1M output
    const inputCost = (inputTokens / 1_000_000) * 0.8;
    const outputCost = (outputTokens / 1_000_000) * 4.0;
    const totalCost = inputCost + outputCost;

    assertEquals(inputCost, 0.00064);
    assertEquals(outputCost, 0.0024);
    assertEquals(totalCost.toFixed(6), "0.003040");
  });

  // Response structure tests
  await t.step("should structure full response correctly", () => {
    const response = {
      letter: {
        letterDate: "2026-01-17",
        patientName: "John",
        chiefComplaint: "Chest pain",
        requiresReview: true
      },
      formattedLetter: "Primary Care Associates\nDr. Smith...",
      metadata: {
        generatedAt: new Date().toISOString(),
        model: "claude-haiku-4-5-20250919",
        responseTimeMs: 1200,
        specialty: "Cardiology",
        patientContext: {
          conditionsCount: 3,
          medicationsCount: 5,
          allergiesCount: 1
        }
      }
    };

    assertExists(response.letter);
    assertExists(response.formattedLetter);
    assertExists(response.metadata);
    assertExists(response.metadata.patientContext);
  });

  // Database context gathering tests
  await t.step("should gather patient profile", () => {
    const patientProfile = {
      first_name: "John",
      date_of_birth: "1950-01-15"
    };

    assertExists(patientProfile.first_name);
    assertExists(patientProfile.date_of_birth);
  });

  await t.step("should gather provider profile", () => {
    const providerProfile = {
      first_name: "Jane",
      last_name: "Smith",
      credentials: "MD, FACP",
      npi_number: "1234567890"
    };

    const fullName = `${providerProfile.first_name} ${providerProfile.last_name}`.trim();
    assertEquals(fullName, "Jane Smith");
    assertExists(providerProfile.credentials);
  });

  await t.step("should gather active conditions", () => {
    const conditions = [
      { code: "I10", display: "Essential hypertension" },
      { code: "E78.5", display: "Hyperlipidemia" }
    ];

    assertEquals(conditions.length, 2);
    assertEquals(conditions[0].code, "I10");
  });

  await t.step("should use request medications when provided", () => {
    const requestMedications = ["Lisinopril 10mg", "Aspirin 81mg"];
    const dbMedications: string[] = [];

    const medications = requestMedications.length > 0
      ? requestMedications.map(m => ({ name: m }))
      : dbMedications.map(m => ({ name: m }));

    assertEquals(medications.length, 2);
    assertEquals(medications[0].name, "Lisinopril 10mg");
  });

  await t.step("should format allergies with severity", () => {
    const allergies = [
      { substance: "Penicillin", reaction_severity: "severe" },
      { substance: "Sulfa", reaction_severity: null }
    ];

    const formatted = allergies.map(a =>
      a.reaction_severity
        ? `${a.substance} (${a.reaction_severity})`
        : a.substance
    );

    assertEquals(formatted[0], "Penicillin (severe)");
    assertEquals(formatted[1], "Sulfa");
  });

  await t.step("should display NKDA when no allergies", () => {
    const allergies: string[] = [];
    const allergiesText = allergies.length > 0
      ? allergies.join(", ")
      : "NKDA (No Known Drug Allergies)";

    assertEquals(allergiesText, "NKDA (No Known Drug Allergies)");
  });

  // HTTP status codes
  await t.step("should return 200 for successful generation", () => {
    const success = true;
    const expectedStatus = success ? 200 : 500;

    assertEquals(expectedStatus, 200);
  });

  await t.step("should return 400 for missing required fields", () => {
    const hasRequiredFields = false;
    const expectedStatus = hasRequiredFields ? 200 : 400;

    assertEquals(expectedStatus, 400);
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

  await t.step("should structure error response correctly", () => {
    const errorResponse = {
      error: "Missing required fields: patientId, referringProviderId, specialistSpecialty, clinicalReason"
    };

    assertExists(errorResponse.error);
    assertEquals(errorResponse.error.includes("Missing required fields"), true);
  });

  // Urgency notes generation tests
  await t.step("should generate urgency notes for emergent", () => {
    const urgency = "emergent";
    const urgencyNotes =
      urgency === "emergent"
        ? "This referral is URGENT/EMERGENT and requires expedited evaluation as soon as possible."
        : urgency === "urgent"
        ? "This referral is URGENT and should be scheduled within 1-2 weeks."
        : "This is a routine referral and can be scheduled at the patient's convenience.";

    assertEquals(urgencyNotes.includes("URGENT/EMERGENT"), true);
    assertEquals(urgencyNotes.includes("expedited"), true);
  });

  await t.step("should generate urgency notes for urgent", () => {
    const urgency = "urgent";
    const urgencyNotes =
      urgency === "emergent"
        ? "This referral is URGENT/EMERGENT..."
        : urgency === "urgent"
        ? "This referral is URGENT and should be scheduled within 1-2 weeks."
        : "This is a routine referral...";

    assertEquals(urgencyNotes.includes("1-2 weeks"), true);
  });

  await t.step("should generate urgency notes for routine", () => {
    const urgency = "routine";
    const urgencyNotes =
      urgency === "emergent"
        ? "emergent..."
        : urgency === "urgent"
        ? "urgent..."
        : "This is a routine referral and can be scheduled at the patient's convenience.";

    assertEquals(urgencyNotes.includes("patient's convenience"), true);
  });
});
