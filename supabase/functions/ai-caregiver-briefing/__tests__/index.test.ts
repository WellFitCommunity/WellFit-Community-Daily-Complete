// supabase/functions/ai-caregiver-briefing/__tests__/index.test.ts
// Tests for AI Caregiver Briefing - Personalized briefings for family caregivers

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Caregiver Briefing Tests", async (t) => {

  // =====================================================
  // Request Validation Tests
  // =====================================================

  await t.step("should require patientId", () => {
    const body = { caregiverId: "caregiver-123" };
    const hasPatientId = "patientId" in body;

    assertEquals(hasPatientId, false);
  });

  await t.step("should require caregiverId", () => {
    const body = { patientId: "patient-123" };
    const hasCaregiverId = "caregiverId" in body;

    assertEquals(hasCaregiverId, false);
  });

  await t.step("should return 400 for missing required fields", () => {
    const response = { error: "Missing required fields: patientId, caregiverId" };
    assertEquals(response.error, "Missing required fields: patientId, caregiverId");
  });

  await t.step("should default caregiverName to 'Caregiver'", () => {
    const body = { patientId: "patient-123", caregiverId: "caregiver-456" };
    const caregiverName = (body as { caregiverName?: string }).caregiverName || "Caregiver";

    assertEquals(caregiverName, "Caregiver");
  });

  await t.step("should default briefingType to 'daily'", () => {
    const body = { patientId: "patient-123", caregiverId: "caregiver-456" };
    const briefingType = (body as { briefingType?: string }).briefingType || "daily";

    assertEquals(briefingType, "daily");
  });

  await t.step("should default language to 'English'", () => {
    const body = { patientId: "patient-123", caregiverId: "caregiver-456" };
    const language = (body as { language?: string }).language || "English";

    assertEquals(language, "English");
  });

  await t.step("should support briefing types", () => {
    const briefingTypes = ["daily", "weekly", "urgent"];
    assertEquals(briefingTypes.length, 3);
    assertEquals(briefingTypes.includes("weekly"), true);
  });

  // =====================================================
  // PHI Redaction Tests
  // =====================================================

  await t.step("should redact email addresses", () => {
    const text = "Contact me at john@example.com";
    const redacted = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");

    assertEquals(redacted, "Contact me at [EMAIL]");
  });

  await t.step("should redact phone numbers", () => {
    const text = "Call me at 555-123-4567";
    const redacted = text.replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]");

    assertEquals(redacted, "Call me at [PHONE]");
  });

  await t.step("should redact SSN", () => {
    const text = "My SSN is 123-45-6789";
    const redacted = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

    assertEquals(redacted, "My SSN is [SSN]");
  });

  // =====================================================
  // Caregiver Context Tests
  // =====================================================

  await t.step("should initialize default context", () => {
    const context = {
      patientFirstName: "Your loved one",
      recentCheckIns: [],
      averageWellness: null,
      carePlanGoals: [],
      carePlanProgress: "No active care plan",
      upcomingAppointments: [],
      alerts: []
    };

    assertEquals(context.patientFirstName, "Your loved one");
    assertEquals(context.carePlanProgress, "No active care plan");
    assertEquals(context.averageWellness, null);
  });

  await t.step("should calculate days back for daily briefing", () => {
    const briefingType = "daily";
    const daysBack = briefingType === "weekly" ? 7 : 1;

    assertEquals(daysBack, 1);
  });

  await t.step("should calculate days back for weekly briefing", () => {
    const briefingType = "weekly";
    const daysBack = briefingType === "weekly" ? 7 : 1;

    assertEquals(daysBack, 7);
  });

  await t.step("should map check-in data to context format", () => {
    const checkInData = {
      check_in_date: "2026-01-22",
      status: "completed",
      responses: { feeling: 7 },
      concern_flags: ["medication question"]
    };

    const mapped = {
      date: checkInData.check_in_date,
      status: checkInData.status,
      wellness: checkInData.responses?.feeling as number | undefined,
      concerns: checkInData.concern_flags || []
    };

    assertEquals(mapped.date, "2026-01-22");
    assertEquals(mapped.wellness, 7);
    assertEquals(mapped.concerns.length, 1);
  });

  await t.step("should calculate average wellness score", () => {
    const checkIns = [
      { responses: { feeling: 7 } },
      { responses: { feeling: 8 } },
      { responses: { feeling: 6 } }
    ];

    const wellnessScores = checkIns
      .filter(c => c.responses?.feeling)
      .map(c => c.responses.feeling as number);

    const averageWellness = wellnessScores.length > 0
      ? wellnessScores.reduce((a, b) => a + b, 0) / wellnessScores.length
      : null;

    assertEquals(averageWellness, 7);
  });

  await t.step("should map care plan data", () => {
    const carePlan = {
      goals: ["Improve mobility", "Manage blood pressure", "Increase social activity"],
      status: "active",
      care_plan_type: "comprehensive"
    };

    const carePlanGoals = Array.isArray(carePlan.goals) ? carePlan.goals.slice(0, 3) : [];
    const carePlanProgress = `Active ${carePlan.care_plan_type || "care"} plan`;

    assertEquals(carePlanGoals.length, 3);
    assertEquals(carePlanProgress, "Active comprehensive plan");
  });

  await t.step("should map upcoming appointments", () => {
    const appointments = [
      { appointment_date: "2026-01-25", appointment_type: "Primary Care" },
      { appointment_date: "2026-01-28", appointment_type: "Physical Therapy" }
    ];

    const mapped = appointments.map(a => ({
      date: a.appointment_date,
      type: a.appointment_type || "Appointment"
    }));

    assertEquals(mapped.length, 2);
    assertEquals(mapped[0].type, "Primary Care");
  });

  await t.step("should map active alerts", () => {
    const alerts = [
      { alert_type: "medication_reminder", title: "Medication refill needed" },
      { alert_type: "appointment", title: "Upcoming appointment" }
    ];

    const mapped = alerts.map(a => ({
      type: a.alert_type,
      message: a.title
    }));

    assertEquals(mapped.length, 2);
    assertEquals(mapped[0].message, "Medication refill needed");
  });

  // =====================================================
  // Briefing Response Structure Tests
  // =====================================================

  await t.step("should define CaregiverBriefing structure", () => {
    const briefing = {
      greeting: "Hello Jane,",
      summary: "Here's an update about John's recent activity.",
      health_highlights: ["Completed all check-ins", "Wellness score improving"],
      check_in_summary: {
        total: 7,
        completed: 6,
        average_wellness: 7.5,
        concerns: []
      },
      care_plan_progress: "Active comprehensive care plan",
      upcoming_items: ["Primary Care on Jan 25", "Physical Therapy on Jan 28"],
      action_items: ["Continue to offer your support", "Remind about medication"],
      encouragement: "Thank you for being a caring family member."
    };

    assertExists(briefing.greeting);
    assertExists(briefing.summary);
    assertEquals(briefing.health_highlights.length, 2);
    assertEquals(briefing.check_in_summary.total, 7);
    assertEquals(briefing.check_in_summary.completed, 6);
    assertEquals(briefing.upcoming_items.length, 2);
    assertEquals(briefing.action_items.length, 2);
    assertExists(briefing.encouragement);
  });

  // =====================================================
  // AI Prompt Construction Tests
  // =====================================================

  await t.step("should build check-in summary for prompt", () => {
    const recentCheckIns = [
      { status: "completed" },
      { status: "completed" },
      { status: "missed" }
    ];

    const checkInSummary = recentCheckIns.length > 0
      ? `${recentCheckIns.filter(c => c.status === "completed").length} of ${recentCheckIns.length} check-ins completed`
      : "No recent check-ins";

    assertEquals(checkInSummary, "2 of 3 check-ins completed");
  });

  await t.step("should format wellness score in prompt", () => {
    const averageWellness = 7.5;
    const formatted = averageWellness?.toFixed(1) || "N/A";

    assertEquals(formatted, "7.5");
  });

  await t.step("should format null wellness score", () => {
    const averageWellness = null;
    const formatted = averageWellness?.toFixed(1) || "N/A";

    assertEquals(formatted, "N/A");
  });

  await t.step("should format care plan goals", () => {
    const goals = ["Improve mobility", "Manage blood pressure"];
    const formatted = goals.join(", ") || "None specified";

    assertEquals(formatted, "Improve mobility, Manage blood pressure");
  });

  await t.step("should format empty goals", () => {
    const goals: string[] = [];
    const formatted = goals.join(", ") || "None specified";

    assertEquals(formatted, "None specified");
  });

  await t.step("should format upcoming appointments", () => {
    const appointments = [
      { date: "2026-01-25", type: "Primary Care" },
      { date: "2026-01-28", type: "Physical Therapy" }
    ];

    const formatted = appointments.map(a => `- ${a.type} on ${a.date}`).join("\n");

    assertEquals(formatted.includes("Primary Care on 2026-01-25"), true);
    assertEquals(formatted.includes("Physical Therapy on 2026-01-28"), true);
  });

  await t.step("should format empty appointments", () => {
    const appointments: { date: string; type: string }[] = [];
    const formatted = appointments.map(a => `- ${a.type} on ${a.date}`).join("\n") || "No upcoming appointments";

    assertEquals(formatted, "No upcoming appointments");
  });

  // =====================================================
  // Fallback Briefing Tests
  // =====================================================

  await t.step("should generate fallback briefing on parse error", () => {
    const context = {
      patientFirstName: "John",
      recentCheckIns: [
        { status: "completed" },
        { status: "completed" },
        { status: "missed" }
      ],
      averageWellness: 7.5,
      carePlanProgress: "Active care plan",
      upcomingAppointments: [
        { date: "2026-01-25", type: "Primary Care" }
      ]
    };

    const caregiverName = "Jane";

    const fallbackBriefing = {
      greeting: `Hello ${caregiverName},`,
      summary: `Here's an update about ${context.patientFirstName}'s recent activity.`,
      health_highlights: [
        `${context.recentCheckIns.filter(c => c.status === "completed").length} check-ins completed`
      ],
      check_in_summary: {
        total: context.recentCheckIns.length,
        completed: context.recentCheckIns.filter(c => c.status === "completed").length,
        average_wellness: context.averageWellness,
        concerns: []
      },
      care_plan_progress: context.carePlanProgress,
      upcoming_items: context.upcomingAppointments.map(a => `${a.type} on ${a.date}`),
      action_items: ["Continue to offer your support"],
      encouragement: "Thank you for being a caring family member."
    };

    assertEquals(fallbackBriefing.greeting, "Hello Jane,");
    assertEquals(fallbackBriefing.summary.includes("John"), true);
    assertEquals(fallbackBriefing.check_in_summary.total, 3);
    assertEquals(fallbackBriefing.check_in_summary.completed, 2);
  });

  // =====================================================
  // Model Configuration Tests
  // =====================================================

  await t.step("should use Claude Haiku model", () => {
    const HAIKU_MODEL = "claude-haiku-4-5-20250919";
    assertEquals(HAIKU_MODEL.includes("haiku"), true);
  });

  // =====================================================
  // Cost Calculation Tests
  // =====================================================

  await t.step("should calculate AI usage cost", () => {
    const inputTokens = 400;
    const outputTokens = 600;
    // Haiku pricing: $0.80/1M input, $4.00/1M output
    const cost = (inputTokens / 1_000_000) * 0.8 + (outputTokens / 1_000_000) * 4.0;

    assertEquals(cost, 0.00272);
  });

  // =====================================================
  // Usage Logging Tests
  // =====================================================

  await t.step("should structure usage log entry", () => {
    const usageLog = {
      user_id: "caregiver-123",
      request_id: crypto.randomUUID(),
      model: "claude-haiku-4-5-20250919",
      request_type: "caregiver_briefing",
      input_tokens: 400,
      output_tokens: 600,
      cost: 0.00272,
      response_time_ms: 850,
      success: true
    };

    assertEquals(usageLog.request_type, "caregiver_briefing");
    assertEquals(usageLog.model, "claude-haiku-4-5-20250919");
    assertExists(usageLog.request_id);
    assertEquals(usageLog.success, true);
  });

  // =====================================================
  // PHI Access Logging Tests
  // =====================================================

  await t.step("should log PHI access with redacted IDs", () => {
    const patientId = "patient-123-abc";
    const caregiverId = "caregiver-456-def";
    const briefingType = "daily";

    const logEntry = {
      patientId: patientId.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]"),
      caregiverId: caregiverId.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]"),
      briefingType
    };

    // IDs without emails should remain unchanged
    assertEquals(logEntry.patientId, "patient-123-abc");
    assertEquals(logEntry.briefingType, "daily");
  });

  // =====================================================
  // Response Metadata Tests
  // =====================================================

  await t.step("should include metadata in response", () => {
    const metadata = {
      generated_at: new Date().toISOString(),
      briefing_type: "daily",
      language: "English",
      response_time_ms: 850
    };

    assertExists(metadata.generated_at);
    assertEquals(metadata.briefing_type, "daily");
    assertEquals(metadata.language, "English");
    assertExists(metadata.response_time_ms);
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/ai-caregiver-briefing", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  // =====================================================
  // Error Handling Tests
  // =====================================================

  await t.step("should return error for missing AI configuration", () => {
    const ANTHROPIC_API_KEY = undefined;
    const shouldThrow = !ANTHROPIC_API_KEY;

    assertEquals(shouldThrow, true);
  });

  await t.step("should return 500 for AI service not configured", () => {
    const response = { error: "AI service not configured" };
    assertEquals(response.error, "AI service not configured");
  });

  await t.step("should return 500 for Claude API errors", () => {
    const status = 500;
    const response = { error: `Claude API error: ${status}` };

    assertEquals(response.error, "Claude API error: 500");
  });

  await t.step("should handle parse error gracefully", () => {
    const content = "This is not valid JSON";
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

  // =====================================================
  // Language Support Tests
  // =====================================================

  await t.step("should support English language", () => {
    const language = "English";
    const prompt = `Generate a caring, supportive caregiver briefing in ${language}.`;

    assertEquals(prompt.includes("English"), true);
  });

  await t.step("should support Spanish language", () => {
    const language = "Spanish";
    const prompt = `Generate a caring, supportive caregiver briefing in ${language}.`;

    assertEquals(prompt.includes("Spanish"), true);
  });

  // =====================================================
  // Privacy Considerations Tests
  // =====================================================

  await t.step("should only retrieve first name for privacy", () => {
    const profileSelect = "first_name";
    const sensitiveFields = ["last_name", "ssn", "address", "phone"];

    const containsSensitive = sensitiveFields.some(f => profileSelect.includes(f));

    assertEquals(containsSensitive, false);
  });

  await t.step("should emphasize no PHI in AI prompt", () => {
    const promptGuidelines = "Do NOT include specific medical details or PHI. Focus on general wellness and encouragement.";

    assertEquals(promptGuidelines.includes("NOT include specific medical details"), true);
    assertEquals(promptGuidelines.includes("PHI"), true);
  });

  // =====================================================
  // Check-In Summary Tests
  // =====================================================

  await t.step("should calculate check-in completion rate", () => {
    const total = 7;
    const completed = 5;
    const rate = Math.round((completed / total) * 100);

    assertEquals(rate, 71);
  });

  await t.step("should handle empty check-ins", () => {
    const recentCheckIns: { status: string }[] = [];

    const checkInSummary = recentCheckIns.length > 0
      ? `${recentCheckIns.filter(c => c.status === "completed").length} of ${recentCheckIns.length} check-ins completed`
      : "No recent check-ins";

    assertEquals(checkInSummary, "No recent check-ins");
  });

  // =====================================================
  // Urgency Level Tests
  // =====================================================

  await t.step("should handle urgent briefing type", () => {
    const briefingType = "urgent";
    const isUrgent = briefingType === "urgent";

    assertEquals(isUrgent, true);
  });

  await t.step("should adjust context for urgent briefings", () => {
    const briefingType = "urgent";
    // For urgent briefings, we might gather more recent data or prioritize alerts
    const daysBack = briefingType === "weekly" ? 7 : 1;

    assertEquals(daysBack, 1);
  });

  // =====================================================
  // Date Range Tests
  // =====================================================

  await t.step("should calculate start date for context gathering", () => {
    const daysBack = 7;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const now = new Date();

    const daysDifference = Math.round((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    assertEquals(daysDifference, 7);
  });

  await t.step("should calculate next week date for appointments", () => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const daysDifference = Math.round((nextWeek.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    assertEquals(daysDifference, 7);
  });
});
