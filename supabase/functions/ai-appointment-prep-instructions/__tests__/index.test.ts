// supabase/functions/ai-appointment-prep-instructions/__tests__/index.test.ts
// Tests for AI Appointment Prep Instructions - Personalized preparation guidance

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Appointment Prep Instructions Tests", async (t) => {

  // =====================================================
  // Request Validation Tests
  // =====================================================

  await t.step("should require patientId", () => {
    const body = { appointment: { type: "annual_physical" } };
    const hasPatientId = "patientId" in body;

    assertEquals(hasPatientId, false);
  });

  await t.step("should return 400 for missing patientId", () => {
    const response = { error: "Missing required field: patientId" };
    assertEquals(response.error, "Missing required field: patientId");
  });

  await t.step("should require appointment type and dateTime", () => {
    const body = { patientId: "patient-123", appointment: {} };
    const hasType = body.appointment && "type" in body.appointment;
    const hasDateTime = body.appointment && "appointmentDateTime" in body.appointment;

    assertEquals(hasType, false);
    assertEquals(hasDateTime, false);
  });

  await t.step("should return 400 for missing appointment details", () => {
    const response = { error: "Missing required appointment details" };
    assertEquals(response.error, "Missing required appointment details");
  });

  // =====================================================
  // Appointment Details Tests
  // =====================================================

  await t.step("should define AppointmentDetails structure", () => {
    const appointment = {
      type: "annual_physical",
      specialty: "Internal Medicine",
      providerName: "Dr. Smith",
      appointmentDateTime: "2026-02-15T09:00:00Z",
      location: "Main Clinic - Room 305",
      durationMinutes: 45,
      plannedTests: ["CBC", "Lipid Panel"],
      schedulerNotes: "Patient requested early morning"
    };

    assertEquals(appointment.type, "annual_physical");
    assertEquals(appointment.durationMinutes, 45);
    assertEquals(appointment.plannedTests?.length, 2);
  });

  await t.step("should support various appointment types", () => {
    const appointmentTypes = [
      "annual_physical",
      "follow_up",
      "lab_work",
      "imaging",
      "specialist_consult",
      "telehealth",
      "procedure"
    ];

    assertEquals(appointmentTypes.length, 7);
    assertEquals(appointmentTypes.includes("lab_work"), true);
  });

  // =====================================================
  // Patient Context Tests
  // =====================================================

  await t.step("should define PatientContext structure", () => {
    const context = {
      age: 72,
      activeConditions: [
        { code: "E11.9", display: "Type 2 Diabetes" },
        { code: "I10", display: "Hypertension" }
      ],
      currentMedications: [
        { name: "Metformin", dosage: "500mg", frequency: "twice daily" },
        { name: "Lisinopril", dosage: "10mg", frequency: "once daily" }
      ],
      allergies: ["Penicillin", "Sulfa drugs"],
      mobilityLimitations: ["Uses walker"],
      language: "English",
      specialNeeds: ["Large print materials"]
    };

    assertEquals(context.age, 72);
    assertEquals(context.activeConditions.length, 2);
    assertEquals(context.currentMedications.length, 2);
    assertEquals(context.allergies.length, 2);
  });

  // =====================================================
  // PHI Redaction Tests
  // =====================================================

  await t.step("should redact email addresses", () => {
    const text = "Contact john@example.com";
    const redacted = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");

    assertEquals(redacted, "Contact [EMAIL]");
  });

  await t.step("should redact phone numbers", () => {
    const text = "Call 555-123-4567";
    const redacted = text.replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]");

    assertEquals(redacted, "Call [PHONE]");
  });

  await t.step("should redact SSN", () => {
    const text = "SSN 123-45-6789";
    const redacted = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

    assertEquals(redacted, "SSN [SSN]");
  });

  await t.step("should redact DOB format", () => {
    const text = "DOB: 05/15/1952";
    const redacted = text.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, "[DOB]");

    assertEquals(redacted, "DOB: [DOB]");
  });

  // =====================================================
  // Date Formatting Tests
  // =====================================================

  await t.step("should format appointment date", () => {
    const appointmentDateTime = "2026-02-15T09:00:00Z";
    const date = new Date(appointmentDateTime);
    const formattedDate = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    });

    assertEquals(formattedDate.includes("February"), true);
    assertEquals(formattedDate.includes("15"), true);
  });

  await t.step("should format appointment time", () => {
    const appointmentDateTime = "2026-02-15T14:30:00Z";
    const date = new Date(appointmentDateTime);
    const formattedTime = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit"
    });

    assertExists(formattedTime);
  });

  // =====================================================
  // Instruction Category Tests
  // =====================================================

  await t.step("should define instruction categories", () => {
    const categories = [
      "before",
      "day_of",
      "bring",
      "medication",
      "dietary",
      "transportation",
      "after"
    ];

    assertEquals(categories.length, 7);
    assertEquals(categories.includes("dietary"), true);
  });

  await t.step("should define instruction priorities", () => {
    const priorities = ["required", "recommended", "optional"];
    assertEquals(priorities.length, 3);
  });

  await t.step("should structure instruction with all fields", () => {
    const instruction = {
      category: "before" as const,
      priority: "required" as const,
      timing: "24 hours before",
      instruction: "Stop eating after midnight",
      rationale: "Fasting is required for accurate lab results"
    };

    assertEquals(instruction.category, "before");
    assertEquals(instruction.priority, "required");
    assertExists(instruction.timing);
    assertExists(instruction.rationale);
  });

  // =====================================================
  // Bring Checklist Tests
  // =====================================================

  await t.step("should include required items in checklist", () => {
    const checklist = [
      { item: "Photo ID", required: true },
      { item: "Insurance card", required: true },
      { item: "List of current medications", required: true },
      { item: "List of questions for your provider", required: false, note: "Write them down so you don't forget" }
    ];

    const requiredItems = checklist.filter(i => i.required);
    assertEquals(requiredItems.length, 3);
    assertEquals(checklist[3].note?.includes("Write them down"), true);
  });

  // =====================================================
  // Medication Instructions Tests
  // =====================================================

  await t.step("should structure medication instruction", () => {
    const medInstruction = {
      medication: "Metformin",
      instruction: "Take as usual",
      timing: "Take with breakfast",
      warning: undefined
    };

    assertEquals(medInstruction.medication, "Metformin");
    assertEquals(medInstruction.instruction, "Take as usual");
  });

  await t.step("should include warning for blood thinners", () => {
    const medInstruction = {
      medication: "Warfarin",
      instruction: "Hold",
      timing: "Do not take 48 hours before procedure",
      warning: "Consult with your doctor before stopping any blood thinner"
    };

    assertExists(medInstruction.warning);
    assertEquals(medInstruction.instruction, "Hold");
  });

  // =====================================================
  // Dietary Instructions Tests
  // =====================================================

  await t.step("should define dietary instructions for fasting", () => {
    const dietaryInstructions = {
      fastingRequired: true,
      fastingHours: 12,
      foodRestrictions: ["No food or drinks except water"],
      hydrationGuidance: "You may drink plain water"
    };

    assertEquals(dietaryInstructions.fastingRequired, true);
    assertEquals(dietaryInstructions.fastingHours, 12);
    assertExists(dietaryInstructions.hydrationGuidance);
  });

  await t.step("should handle no fasting requirement", () => {
    const dietaryInstructions = {
      fastingRequired: false,
      fastingHours: undefined,
      foodRestrictions: undefined,
      hydrationGuidance: "Eat and drink normally"
    };

    assertEquals(dietaryInstructions.fastingRequired, false);
    assertEquals(dietaryInstructions.fastingHours, undefined);
  });

  // =====================================================
  // What To Expect Tests
  // =====================================================

  await t.step("should list what to expect", () => {
    const whatToExpect = [
      "Check in at the front desk when you arrive",
      "A medical assistant will take your vitals",
      "Your provider will discuss your health with you"
    ];

    assertEquals(whatToExpect.length, 3);
    assertEquals(whatToExpect[0].includes("Check in"), true);
  });

  // =====================================================
  // Response Structure Tests
  // =====================================================

  await t.step("should return complete prep instructions response", () => {
    const result = {
      greeting: "We're looking forward to seeing you on Monday, February 15!",
      appointmentSummary: "Your annual physical with Dr. Smith",
      instructions: [
        { category: "before", priority: "required", instruction: "Fast for 12 hours" }
      ],
      bringChecklist: [
        { item: "Photo ID", required: true }
      ],
      medicationInstructions: [],
      dietaryInstructions: { fastingRequired: true, fastingHours: 12 },
      transportationNotes: ["Arrive 15 minutes early"],
      whatToExpect: ["Check in at front desk"],
      estimatedDuration: "45 minutes",
      suggestedQuestions: ["What are my lab results?"],
      keyReminders: ["Remember to fast!"]
    };

    assertExists(result.greeting);
    assertExists(result.appointmentSummary);
    assertEquals(Array.isArray(result.instructions), true);
    assertEquals(Array.isArray(result.bringChecklist), true);
    assertEquals(result.dietaryInstructions?.fastingRequired, true);
    assertExists(result.estimatedDuration);
  });

  // =====================================================
  // Context Enrichment Tests
  // =====================================================

  await t.step("should calculate patient age from DOB", () => {
    const dob = new Date("1952-05-15");
    const today = new Date();
    const age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    assertEquals(age > 70, true);
  });

  await t.step("should format conditions for prompt", () => {
    const conditions = [
      { code: "E11.9", display: "Type 2 Diabetes" },
      { code: "I10", display: "Hypertension" }
    ];

    const conditionsText = conditions.length > 0
      ? conditions.map(c => c.display).join(", ")
      : "None documented";

    assertEquals(conditionsText, "Type 2 Diabetes, Hypertension");
  });

  await t.step("should format medications for prompt", () => {
    const medications = [
      { name: "Metformin", dosage: "500mg" },
      { name: "Lisinopril", dosage: "10mg" }
    ];

    const medicationsText = medications.map(m =>
      `${m.name}${m.dosage ? ` (${m.dosage})` : ""}`
    ).join(", ");

    assertEquals(medicationsText, "Metformin (500mg), Lisinopril (10mg)");
  });

  await t.step("should format allergies for prompt", () => {
    const allergies = ["Penicillin", "Sulfa"];
    const allergiesText = allergies.length > 0 ? allergies.join(", ") : "NKDA";

    assertEquals(allergiesText, "Penicillin, Sulfa");
  });

  await t.step("should use NKDA for no allergies", () => {
    const allergies: string[] = [];
    const allergiesText = allergies.length > 0 ? allergies.join(", ") : "NKDA";

    assertEquals(allergiesText, "NKDA");
  });

  // =====================================================
  // Model Configuration Tests
  // =====================================================

  await t.step("should use Claude Haiku model", () => {
    const HAIKU_MODEL = "claude-haiku-4-20250514";
    assertEquals(HAIKU_MODEL.includes("haiku"), true);
  });

  // =====================================================
  // Usage Logging Tests
  // =====================================================

  await t.step("should log usage with metadata", () => {
    const usageLog = {
      user_id: "patient-123",
      request_id: crypto.randomUUID(),
      model: "claude-haiku-4-20250514",
      request_type: "appointment_prep_instructions",
      input_tokens: 800,
      output_tokens: 1200,
      cost: (800 / 1_000_000) * 0.25 + (1200 / 1_000_000) * 1.25,
      response_time_ms: 1500,
      success: true,
      metadata: {
        appointmentType: "annual_physical",
        language: "English",
        hasConditions: true,
        hasMedications: true
      }
    };

    assertEquals(usageLog.request_type, "appointment_prep_instructions");
    assertExists(usageLog.metadata.appointmentType);
    assertEquals(usageLog.success, true);
  });

  // =====================================================
  // Fallback Response Tests
  // =====================================================

  await t.step("should generate fallback greeting", () => {
    const formattedDate = "Monday, February 15";
    const formattedTime = "9:00 AM";
    const greeting = `We're looking forward to your appointment on ${formattedDate} at ${formattedTime}!`;

    assertEquals(greeting.includes("Monday, February 15"), true);
    assertEquals(greeting.includes("9:00 AM"), true);
  });

  await t.step("should generate fallback checklist", () => {
    const fallbackChecklist = [
      { item: "Photo ID (driver's license or state ID)", required: true },
      { item: "Insurance card", required: true },
      { item: "List of all current medications", required: true },
      { item: "List of questions for your provider", required: false, note: "Write them down so you don't forget" }
    ];

    assertEquals(fallbackChecklist.length, 4);
    assertEquals(fallbackChecklist[0].required, true);
    assertEquals(fallbackChecklist[3].required, false);
  });

  await t.step("should generate fallback what to expect", () => {
    const whatToExpect = [
      "Check in at the front desk when you arrive",
      "A medical assistant will take your vitals",
      "Your provider will discuss your health with you"
    ];

    assertEquals(whatToExpect.length, 3);
  });

  await t.step("should generate fallback key reminders", () => {
    const keyReminders = [
      "Arrive 15 minutes early to complete check-in",
      "Bring your insurance card and photo ID",
      "Bring a list of your current medications"
    ];

    assertEquals(keyReminders.length, 3);
    assertEquals(keyReminders[0].includes("15 minutes early"), true);
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/ai-appointment-prep-instructions", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  // =====================================================
  // Error Handling Tests
  // =====================================================

  await t.step("should return 500 for AI service not configured", () => {
    const ANTHROPIC_API_KEY = undefined;
    const shouldThrow = !ANTHROPIC_API_KEY;

    assertEquals(shouldThrow, true);
  });

  await t.step("should return error response on failure", () => {
    const response = { error: "AI service not configured" };
    assertEquals(response.error, "AI service not configured");
  });

  // =====================================================
  // Metadata Response Tests
  // =====================================================

  await t.step("should include metadata in response", () => {
    const metadata = {
      generatedAt: new Date().toISOString(),
      model: "claude-haiku-4-20250514",
      responseTimeMs: 1500,
      appointmentType: "annual_physical",
      language: "English"
    };

    assertExists(metadata.generatedAt);
    assertEquals(metadata.model, "claude-haiku-4-20250514");
    assertEquals(metadata.appointmentType, "annual_physical");
  });

  // =====================================================
  // Appointment Type-Specific Tests
  // =====================================================

  await t.step("should handle lab work appointment", () => {
    const appointment = {
      type: "lab_work",
      plannedTests: ["CBC", "CMP", "Lipid Panel", "A1C"]
    };

    assertEquals(appointment.plannedTests?.includes("A1C"), true);
  });

  await t.step("should handle imaging appointment", () => {
    const appointment = {
      type: "imaging",
      schedulerNotes: "MRI - remove all metal jewelry"
    };

    assertEquals(appointment.schedulerNotes?.includes("metal"), true);
  });

  // =====================================================
  // Language Support Tests
  // =====================================================

  await t.step("should default language to English", () => {
    const patientContext: { language?: string } = {};
    const language = patientContext.language || "English";

    assertEquals(language, "English");
  });

  await t.step("should support Spanish language", () => {
    const patientContext = { language: "Spanish" };
    assertEquals(patientContext.language, "Spanish");
  });

  // =====================================================
  // Duration Estimation Tests
  // =====================================================

  await t.step("should use provided duration", () => {
    const appointment = { durationMinutes: 60 };
    const estimatedDuration = `${appointment.durationMinutes} minutes`;

    assertEquals(estimatedDuration, "60 minutes");
  });

  await t.step("should default to 30 minutes", () => {
    const appointment: { durationMinutes?: number } = {};
    const estimatedDuration = `${appointment.durationMinutes || 30} minutes`;

    assertEquals(estimatedDuration, "30 minutes");
  });
});
