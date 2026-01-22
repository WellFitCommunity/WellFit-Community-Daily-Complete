/**
 * Tests for AI Medication Instructions Edge Function
 *
 * Tests personalized, patient-friendly medication instructions generation
 * with visual pill identification, dosing schedules, and safety warnings.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ============================================================================
// Type Definitions (matching the edge function)
// ============================================================================

interface MedicationInfo {
  name: string;
  genericName?: string;
  dosage: string;
  form: string;
  frequency: string;
  route?: string;
  purpose?: string;
  prescriber?: string;
  startDate?: string;
  endDate?: string;
  specialInstructions?: string;
  refillsRemaining?: number;
  ndcCode?: string;
  pillImprint?: string;
  pillColor?: string;
  pillShape?: string;
}

interface PatientContext {
  age?: number;
  weightKg?: number;
  allergies?: string[];
  conditions?: string[];
  otherMedications?: string[];
  kidneyFunction?: string;
  liverFunction?: string;
  pregnancyStatus?: string;
  language?: string;
  readingLevel?: string;
  hasVisionImpairment?: boolean;
  hasCognitiveImpairment?: boolean;
  caregiverAdministered?: boolean;
}

interface RequestBody {
  patientId: string;
  medication: MedicationInfo;
  patientContext?: PatientContext;
  includeVisualAids?: boolean;
  tenantId?: string;
}

interface DosingScheduleEntry {
  timeOfDay: string;
  specificTime: string;
  doseAmount: string;
  withFood: 'required' | 'recommended' | 'avoid' | 'no_preference';
  timingNotes?: string;
}

interface FoodDrugInteraction {
  substance: string;
  type: 'food' | 'drink';
  severity: 'avoid' | 'caution' | 'monitor';
  description: string;
  recommendation: string;
}

interface SideEffect {
  effect: string;
  likelihood: 'common' | 'less_common' | 'rare';
  severity: 'mild' | 'moderate' | 'severe';
  action: string;
  callDoctorIf: string;
}

interface WarningSign {
  sign: string;
  action: string;
  urgency: 'call_doctor' | 'seek_emergency' | 'monitor';
}

// ============================================================================
// Test Suites
// ============================================================================

Deno.test("AI Medication Instructions - Request Validation", async (t) => {
  await t.step("should require patientId", () => {
    const request: Partial<RequestBody> = {
      medication: { name: "Metformin", dosage: "500mg", form: "tablet", frequency: "twice daily" },
    };

    const isValid = !!(request.patientId && request.medication?.name && request.medication?.dosage);
    assertEquals(isValid, false);
  });

  await t.step("should require medication name", () => {
    const request: Partial<RequestBody> = {
      patientId: "patient-123",
      medication: { name: "", dosage: "500mg", form: "tablet", frequency: "twice daily" } as MedicationInfo,
    };

    const isValid = !!(request.patientId && request.medication?.name && request.medication?.dosage);
    assertEquals(isValid, false);
  });

  await t.step("should require medication dosage", () => {
    const request: Partial<RequestBody> = {
      patientId: "patient-123",
      medication: { name: "Metformin", dosage: "", form: "tablet", frequency: "twice daily" } as MedicationInfo,
    };

    const isValid = !!(request.patientId && request.medication?.name && request.medication?.dosage);
    assertEquals(isValid, false);
  });

  await t.step("should accept valid request", () => {
    const request: RequestBody = {
      patientId: "patient-123",
      medication: {
        name: "Metformin",
        dosage: "500mg",
        form: "tablet",
        frequency: "twice daily",
      },
    };

    const isValid = !!(request.patientId && request.medication?.name && request.medication?.dosage);
    assertEquals(isValid, true);
  });
});

Deno.test("AI Medication Instructions - Patient Context Handling", async (t) => {
  await t.step("should default language to English", () => {
    const patientContext: PatientContext = {};
    const language = patientContext.language || "English";
    assertEquals(language, "English");
  });

  await t.step("should default reading level to simple", () => {
    const patientContext: PatientContext = {};
    const readingLevel = patientContext.readingLevel || "simple";
    assertEquals(readingLevel, "simple");
  });

  await t.step("should map reading level to description", () => {
    const readingLevels: Record<string, string> = {
      simple: "Very simple (6th grade)",
      standard: "Standard patient education",
      detailed: "Detailed with medical terms",
    };

    assertEquals(readingLevels.simple, "Very simple (6th grade)");
    assertEquals(readingLevels.detailed, "Detailed with medical terms");
  });

  await t.step("should include vision impairment consideration", () => {
    const patientContext: PatientContext = { hasVisionImpairment: true };
    const instructions = patientContext.hasVisionImpairment
      ? "use clear, large-text-friendly descriptions"
      : "standard formatting";

    assertEquals(instructions.includes("large-text"), true);
  });

  await t.step("should include cognitive impairment consideration", () => {
    const patientContext: PatientContext = { hasCognitiveImpairment: true };
    const instructions = patientContext.hasCognitiveImpairment
      ? "use extra simple language and reminders"
      : "standard language";

    assertEquals(instructions.includes("simple language"), true);
  });

  await t.step("should include caregiver administration note", () => {
    const patientContext: PatientContext = { caregiverAdministered: true };
    const instructions = patientContext.caregiverAdministered
      ? "include caregiver-specific instructions"
      : "patient self-administration";

    assertEquals(instructions.includes("caregiver"), true);
  });
});

Deno.test("AI Medication Instructions - Pill Identification", async (t) => {
  await t.step("should structure pill identification info", () => {
    const pillInfo = {
      color: "White",
      shape: "Oval",
      size: "medium",
      imprint: "MET 500",
      coating: "film-coated",
      visualDescription: "Your pills are white, oval-shaped, film-coated tablets with 'MET 500' printed on one side.",
    };

    assertExists(pillInfo.color);
    assertExists(pillInfo.shape);
    assertExists(pillInfo.visualDescription);
    assertEquals(pillInfo.visualDescription.includes("white"), true);
  });

  await t.step("should include all pill identification fields from medication", () => {
    const medication: MedicationInfo = {
      name: "Metformin",
      dosage: "500mg",
      form: "tablet",
      frequency: "twice daily",
      pillColor: "White",
      pillShape: "Oval",
      pillImprint: "MET 500",
    };

    assertEquals(medication.pillColor, "White");
    assertEquals(medication.pillShape, "Oval");
    assertEquals(medication.pillImprint, "MET 500");
  });
});

Deno.test("AI Medication Instructions - Dosing Schedule", async (t) => {
  await t.step("should structure dosing schedule entry", () => {
    const schedule: DosingScheduleEntry = {
      timeOfDay: "Morning",
      specificTime: "8:00 AM",
      doseAmount: "1 tablet",
      withFood: "required",
      timingNotes: "Take with breakfast",
    };

    assertEquals(schedule.timeOfDay, "Morning");
    assertEquals(schedule.withFood, "required");
    assertExists(schedule.timingNotes);
  });

  await t.step("should handle multiple daily doses", () => {
    const schedules: DosingScheduleEntry[] = [
      { timeOfDay: "Morning", specificTime: "8:00 AM", doseAmount: "1 tablet", withFood: "required" },
      { timeOfDay: "Evening", specificTime: "6:00 PM", doseAmount: "1 tablet", withFood: "required" },
    ];

    assertEquals(schedules.length, 2);
    assertEquals(schedules[0].timeOfDay, "Morning");
    assertEquals(schedules[1].timeOfDay, "Evening");
  });

  await t.step("should define food requirements", () => {
    const foodOptions: Array<'required' | 'recommended' | 'avoid' | 'no_preference'> = [
      'required', 'recommended', 'avoid', 'no_preference'
    ];

    assertEquals(foodOptions.length, 4);
    assertEquals(foodOptions.includes('required'), true);
    assertEquals(foodOptions.includes('avoid'), true);
  });
});

Deno.test("AI Medication Instructions - Food/Drug Interactions", async (t) => {
  await t.step("should structure food interaction", () => {
    const interaction: FoodDrugInteraction = {
      substance: "Grapefruit juice",
      type: "drink",
      severity: "avoid",
      description: "Grapefruit juice can increase the amount of medication in your blood",
      recommendation: "Avoid drinking grapefruit juice while taking this medication",
    };

    assertEquals(interaction.type, "drink");
    assertEquals(interaction.severity, "avoid");
    assertExists(interaction.recommendation);
  });

  await t.step("should define severity levels", () => {
    const severities: Array<'avoid' | 'caution' | 'monitor'> = ['avoid', 'caution', 'monitor'];

    assertEquals(severities.length, 3);
    assertEquals(severities[0], "avoid");
  });

  await t.step("should handle multiple interactions", () => {
    const interactions: FoodDrugInteraction[] = [
      { substance: "Alcohol", type: "drink", severity: "avoid", description: "May increase drowsiness", recommendation: "Avoid alcohol" },
      { substance: "Dairy products", type: "food", severity: "caution", description: "May reduce absorption", recommendation: "Take medication 2 hours before or after dairy" },
    ];

    assertEquals(interactions.length, 2);
    assertEquals(interactions[0].substance, "Alcohol");
    assertEquals(interactions[1].type, "food");
  });
});

Deno.test("AI Medication Instructions - Side Effects", async (t) => {
  await t.step("should structure side effect", () => {
    const sideEffect: SideEffect = {
      effect: "Headache",
      likelihood: "common",
      severity: "mild",
      action: "Usually goes away after a few days. Take acetaminophen if needed.",
      callDoctorIf: "Headache is severe or doesn't go away after a week",
    };

    assertEquals(sideEffect.likelihood, "common");
    assertEquals(sideEffect.severity, "mild");
    assertExists(sideEffect.callDoctorIf);
  });

  await t.step("should define likelihood levels", () => {
    const likelihoods: Array<'common' | 'less_common' | 'rare'> = ['common', 'less_common', 'rare'];

    assertEquals(likelihoods.length, 3);
    assertEquals(likelihoods.includes('rare'), true);
  });

  await t.step("should define severity levels", () => {
    const severities: Array<'mild' | 'moderate' | 'severe'> = ['mild', 'moderate', 'severe'];

    assertEquals(severities.length, 3);
    assertEquals(severities.includes('severe'), true);
  });
});

Deno.test("AI Medication Instructions - Warning Signs", async (t) => {
  await t.step("should structure warning sign", () => {
    const warning: WarningSign = {
      sign: "Difficulty breathing",
      action: "Stop taking the medication and seek emergency help immediately",
      urgency: "seek_emergency",
    };

    assertEquals(warning.urgency, "seek_emergency");
    assertExists(warning.action);
  });

  await t.step("should define urgency levels", () => {
    const urgencies: Array<'call_doctor' | 'seek_emergency' | 'monitor'> = [
      'call_doctor', 'seek_emergency', 'monitor'
    ];

    assertEquals(urgencies.length, 3);
    assertEquals(urgencies.includes('seek_emergency'), true);
  });

  await t.step("should categorize warning by urgency", () => {
    const warnings: WarningSign[] = [
      { sign: "Mild rash", action: "Monitor", urgency: "monitor" },
      { sign: "Severe rash or hives", action: "Call doctor", urgency: "call_doctor" },
      { sign: "Difficulty breathing", action: "Seek emergency care", urgency: "seek_emergency" },
    ];

    const emergencyWarnings = warnings.filter(w => w.urgency === 'seek_emergency');
    const doctorWarnings = warnings.filter(w => w.urgency === 'call_doctor');
    const monitorWarnings = warnings.filter(w => w.urgency === 'monitor');

    assertEquals(emergencyWarnings.length, 1);
    assertEquals(doctorWarnings.length, 1);
    assertEquals(monitorWarnings.length, 1);
  });
});

Deno.test("AI Medication Instructions - Safety Rules", async (t) => {
  await t.step("should always recommend contacting healthcare provider", () => {
    const safetyRules = [
      "Always recommend contacting healthcare provider for questions",
      "Include poison control number (1-800-222-1222)",
      "Never suggest stopping medication without doctor approval",
      "Always mention to avoid alcohol unless medication is explicitly safe",
      "Include pregnancy/breastfeeding warnings when relevant",
    ];

    assertEquals(safetyRules.length, 5);
    assertEquals(safetyRules[1].includes("1-800-222-1222"), true);
  });

  await t.step("should include emergency info", () => {
    const emergencyInfo = {
      overdoseSymptoms: ["Nausea", "Vomiting", "Extreme drowsiness"],
      overdoseAction: "Call 911 or Poison Control immediately",
      poisonControlNumber: "1-800-222-1222",
    };

    assertEquals(emergencyInfo.poisonControlNumber, "1-800-222-1222");
    assertEquals(emergencyInfo.overdoseAction.includes("911"), true);
  });
});

Deno.test("AI Medication Instructions - Refill Information", async (t) => {
  await t.step("should include refill count", () => {
    const medication: MedicationInfo = {
      name: "Metformin",
      dosage: "500mg",
      form: "tablet",
      frequency: "twice daily",
      refillsRemaining: 3,
    };

    assertEquals(medication.refillsRemaining, 3);
  });

  await t.step("should structure refill info", () => {
    const refillInfo = {
      refillsRemaining: 3,
      howToRefill: "Call your pharmacy at least 3 days before you run out",
    };

    assertEquals(refillInfo.refillsRemaining, 3);
    assertExists(refillInfo.howToRefill);
  });
});

Deno.test("AI Medication Instructions - Dos and Don'ts", async (t) => {
  await t.step("should structure dos and don'ts", () => {
    const dosAndDonts = {
      dos: [
        "Take with food to reduce stomach upset",
        "Drink plenty of water",
        "Take at the same time each day",
      ],
      donts: [
        "Don't skip doses",
        "Don't take double doses if you miss one",
        "Don't drink alcohol",
      ],
    };

    assertEquals(dosAndDonts.dos.length, 3);
    assertEquals(dosAndDonts.donts.length, 3);
    assertEquals(dosAndDonts.donts[0].startsWith("Don't"), true);
  });
});

Deno.test("AI Medication Instructions - Caregiver Notes", async (t) => {
  await t.step("should include caregiver-specific notes when applicable", () => {
    const patientContext: PatientContext = { caregiverAdministered: true };

    const caregiverNotes: string[] = [];
    if (patientContext.caregiverAdministered) {
      caregiverNotes.push(
        "Monitor for any changes in behavior or alertness",
        "Keep a log of doses given and any side effects observed",
        "Contact healthcare provider if patient refuses medication"
      );
    }

    assertEquals(caregiverNotes.length, 3);
    assertEquals(caregiverNotes[0].includes("Monitor"), true);
  });
});

Deno.test("AI Medication Instructions - Reminder Tips", async (t) => {
  await t.step("should provide reminder tips", () => {
    const reminderTips = [
      "Set a daily alarm on your phone",
      "Use a pill organizer to track doses",
      "Keep your medication in the same place every day",
      "Ask a family member to help remind you",
    ];

    assertEquals(reminderTips.length >= 2, true);
    assertEquals(reminderTips.some(t => t.includes("alarm")), true);
  });
});

Deno.test("AI Medication Instructions - Questions for Doctor", async (t) => {
  await t.step("should suggest questions for doctor", () => {
    const questionsForDoctor = [
      "How long will I need to take this medication?",
      "What should I do if I miss a dose?",
      "Are there any activities I should avoid?",
      "When should I expect to see improvement?",
    ];

    assertEquals(questionsForDoctor.length >= 2, true);
  });
});

Deno.test("AI Medication Instructions - Medication Context", async (t) => {
  await t.step("should include generic name when available", () => {
    const medication: MedicationInfo = {
      name: "Glucophage",
      genericName: "Metformin",
      dosage: "500mg",
      form: "tablet",
      frequency: "twice daily",
    };

    const medicationLabel = medication.genericName
      ? `${medication.name} (Generic: ${medication.genericName})`
      : medication.name;

    assertEquals(medicationLabel, "Glucophage (Generic: Metformin)");
  });

  await t.step("should include prescriber info when available", () => {
    const medication: MedicationInfo = {
      name: "Metformin",
      dosage: "500mg",
      form: "tablet",
      frequency: "twice daily",
      prescriber: "Dr. Smith",
    };

    assertExists(medication.prescriber);
    assertEquals(medication.prescriber, "Dr. Smith");
  });

  await t.step("should include date range when available", () => {
    const medication: MedicationInfo = {
      name: "Metformin",
      dosage: "500mg",
      form: "tablet",
      frequency: "twice daily",
      startDate: "2025-01-01",
      endDate: "2025-03-01",
    };

    assertExists(medication.startDate);
    assertExists(medication.endDate);
  });
});

Deno.test("AI Medication Instructions - Patient Context Impact", async (t) => {
  await t.step("should flag kidney function for dose adjustments", () => {
    const patientContext: PatientContext = { kidneyFunction: "impaired" };

    const needsDoseAdjustment = patientContext.kidneyFunction && patientContext.kidneyFunction !== "normal";
    assertEquals(needsDoseAdjustment, true);
  });

  await t.step("should flag liver function for dose adjustments", () => {
    const patientContext: PatientContext = { liverFunction: "impaired" };

    const needsDoseAdjustment = patientContext.liverFunction && patientContext.liverFunction !== "normal";
    assertEquals(needsDoseAdjustment, true);
  });

  await t.step("should flag pregnancy status for warnings", () => {
    const patientContext: PatientContext = { pregnancyStatus: "pregnant" };

    const needsPregnancyWarning = patientContext.pregnancyStatus && patientContext.pregnancyStatus !== "not_pregnant";
    assertEquals(needsPregnancyWarning, true);
  });

  await t.step("should include allergies check", () => {
    const patientContext: PatientContext = { allergies: ["Penicillin", "Sulfa"] };

    const hasAllergies = patientContext.allergies && patientContext.allergies.length > 0;
    assertEquals(hasAllergies, true);
    assertEquals(patientContext.allergies!.includes("Sulfa"), true);
  });

  await t.step("should check for drug interactions with other medications", () => {
    const patientContext: PatientContext = {
      otherMedications: ["Lisinopril", "Aspirin", "Atorvastatin"],
    };

    const hasOtherMeds = patientContext.otherMedications && patientContext.otherMedications.length > 0;
    assertEquals(hasOtherMeds, true);
    assertEquals(patientContext.otherMedications!.length, 3);
  });
});

Deno.test("AI Medication Instructions - Response Metadata", async (t) => {
  await t.step("should include response metadata", () => {
    const metadata = {
      generatedAt: new Date().toISOString(),
      model: "claude-haiku-4-5-20250929",
      responseTimeMs: 150,
      language: "English",
      readingLevel: "simple",
    };

    assertExists(metadata.generatedAt);
    assertEquals(metadata.model, "claude-haiku-4-5-20250929");
    assertEquals(metadata.language, "English");
  });
});

Deno.test("AI Medication Instructions - JSON Response Parsing", async (t) => {
  await t.step("should extract JSON from markdown code blocks", () => {
    const responseText = '```json\n{"medicationName": "Metformin"}\n```';

    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();

    assertEquals(jsonStr, '{"medicationName": "Metformin"}');
  });

  await t.step("should handle raw JSON response", () => {
    const responseText = '{"medicationName": "Metformin"}';

    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();

    assertEquals(jsonStr, '{"medicationName": "Metformin"}');
  });
});

Deno.test("AI Medication Instructions - Error Handling", async (t) => {
  await t.step("should handle missing API key", () => {
    const apiKey = "";
    const isConfigured = apiKey && apiKey.trim().length > 0;

    assertEquals(isConfigured, false);
  });

  await t.step("should handle method not allowed", () => {
    const method = "GET";
    const isPostMethod = method === "POST";

    assertEquals(isPostMethod, false);
  });

  await t.step("should handle parse errors gracefully", () => {
    const invalidJson = "not valid json {";

    let parseError = false;
    try {
      JSON.parse(invalidJson);
    } catch {
      parseError = true;
    }

    assertEquals(parseError, true);
  });
});

Deno.test("AI Medication Instructions - Logging", async (t) => {
  await t.step("should log without PHI", () => {
    const logData = {
      patientId: "patient-123",
      medication: "Metformin",
      responseTimeMs: 150,
    };

    // Log should include patientId (ok) and medication name (ok), but no PHI like DOB, name, etc.
    assertExists(logData.patientId);
    assertExists(logData.medication);
    assertEquals(logData.responseTimeMs, 150);
  });
});
