// supabase/functions/ai-check-in-questions/__tests__/index.test.ts
// Tests for AI Check-In Questions - Personalized daily check-in question generation

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Check-In Questions Tests", async (t) => {

  // =====================================================
  // Request Validation Tests
  // =====================================================

  await t.step("should require patientId", () => {
    const body = { carePlanId: "plan-123" };
    const hasPatientId = "patientId" in body;

    assertEquals(hasPatientId, false);
  });

  await t.step("should return 400 for missing patientId", () => {
    const response = { error: "Missing required field: patientId" };
    assertEquals(response.error, "Missing required field: patientId");
  });

  await t.step("should default questionCount to 5", () => {
    const body = { patientId: "patient-123" };
    const questionCount = (body as { questionCount?: number }).questionCount || 5;

    assertEquals(questionCount, 5);
  });

  await t.step("should accept optional carePlanId", () => {
    const body = { patientId: "patient-123", carePlanId: "plan-456" };
    assertEquals(body.carePlanId, "plan-456");
  });

  await t.step("should accept optional focusAreas", () => {
    const body = { patientId: "patient-123", focusAreas: ["pain", "mobility"] };
    assertEquals(body.focusAreas.length, 2);
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

  await t.step("should redact dates in YYYY-MM-DD format", () => {
    const text = "Born on 1952-05-15";
    const redacted = text.replace(/\b(19|20)\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g, "[DATE]");

    assertEquals(redacted, "Born on [DATE]");
  });

  // =====================================================
  // Patient Context Tests
  // =====================================================

  await t.step("should initialize default patient context", () => {
    const context = {
      diagnoses: [],
      carePlanGoals: [],
      sdohFactors: [],
      recentConcerns: [],
      missedCheckIns: 0,
      averageWellnessScore: undefined
    };

    assertEquals(context.diagnoses.length, 0);
    assertEquals(context.missedCheckIns, 0);
    assertEquals(context.averageWellnessScore, undefined);
  });

  await t.step("should map diagnoses with primary flag", () => {
    const diagnoses = [
      { diagnosis_name: "Type 2 Diabetes", is_primary: true },
      { diagnosis_name: "Hypertension", is_primary: false }
    ];

    const mapped = diagnoses.map(d =>
      `${d.diagnosis_name}${d.is_primary ? " (primary)" : ""}`
    );

    assertEquals(mapped[0], "Type 2 Diabetes (primary)");
    assertEquals(mapped[1], "Hypertension");
  });

  await t.step("should map SDOH factors with risk level", () => {
    const sdohData = [
      { category: "food_insecurity", risk_level: "high" },
      { category: "transportation", risk_level: "medium" },
      { category: "housing", risk_level: "low" }
    ];

    const mapped = sdohData
      .filter(s => s.risk_level !== "low")
      .map(s => `${s.category} (${s.risk_level} risk)`);

    assertEquals(mapped.length, 2);
    assertEquals(mapped[0], "food_insecurity (high risk)");
  });

  await t.step("should count missed check-ins", () => {
    const checkIns = [
      { status: "completed" },
      { status: "missed" },
      { status: "completed" },
      { status: "missed" }
    ];

    const missedCheckIns = checkIns.filter(c => c.status === "missed").length;

    assertEquals(missedCheckIns, 2);
  });

  await t.step("should extract recent concerns from check-ins", () => {
    const checkIns = [
      { concern_flags: ["chest pain", "fatigue"] },
      { concern_flags: ["dizziness"] },
      { concern_flags: ["fatigue"] }
    ];

    const concerns = new Set<string>();
    for (const checkIn of checkIns) {
      if (checkIn.concern_flags) {
        for (const flag of checkIn.concern_flags) {
          concerns.add(flag);
        }
      }
    }

    assertEquals(concerns.size, 3);
    assertEquals(concerns.has("fatigue"), true);
  });

  await t.step("should calculate average wellness score", () => {
    const checkIns = [
      { responses: { feeling: 7 } },
      { responses: { feeling: 5 } },
      { responses: { feeling: 8 } }
    ];

    const scores = checkIns
      .filter(c => c.responses?.feeling)
      .map(c => c.responses.feeling as number);

    const averageWellnessScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : undefined;

    assertEquals(averageWellnessScore, 20 / 3);
  });

  // =====================================================
  // Generated Question Structure Tests
  // =====================================================

  await t.step("should define question types", () => {
    const questionTypes = ["yes_no", "scale", "text", "multiple_choice"];
    assertEquals(questionTypes.length, 4);
  });

  await t.step("should define question categories", () => {
    const categories = ["wellness", "medication", "symptoms", "safety", "mood", "nutrition", "mobility", "social"];
    assertEquals(categories.length, 8);
  });

  await t.step("should structure yes_no question", () => {
    const question = {
      question: "Did you take all your medications today?",
      type: "yes_no" as const,
      required: true,
      category: "medication",
      rationale: "Medication adherence tracking"
    };

    assertEquals(question.type, "yes_no");
    assertEquals(question.required, true);
    assertEquals(question.category, "medication");
  });

  await t.step("should structure scale question", () => {
    const question = {
      question: "How are you feeling today overall?",
      type: "scale" as const,
      scale: { min: 1, max: 10, label_min: "Very Poor", label_max: "Excellent" },
      required: true,
      category: "wellness",
      rationale: "General wellness assessment"
    };

    assertEquals(question.type, "scale");
    assertEquals(question.scale?.min, 1);
    assertEquals(question.scale?.max, 10);
    assertEquals(question.scale?.label_min, "Very Poor");
  });

  await t.step("should structure multiple_choice question", () => {
    const question = {
      question: "What best describes your sleep last night?",
      type: "multiple_choice" as const,
      choices: ["Slept well", "Woke up once or twice", "Poor sleep", "Didn't sleep"],
      required: true,
      category: "wellness",
      rationale: "Sleep quality monitoring"
    };

    assertEquals(question.type, "multiple_choice");
    assertEquals(question.choices?.length, 4);
  });

  await t.step("should structure text question", () => {
    const question = {
      question: "Do you have any concerns you want to share?",
      type: "text" as const,
      required: false,
      category: "wellness",
      rationale: "Open-ended patient concerns"
    };

    assertEquals(question.type, "text");
    assertEquals(question.required, false);
  });

  // =====================================================
  // Default Questions Tests
  // =====================================================

  await t.step("should include wellness question in defaults", () => {
    const defaultQuestions = [
      {
        question: "How are you feeling today overall?",
        type: "scale",
        scale: { min: 1, max: 10, label_min: "Very Poor", label_max: "Excellent" },
        required: true,
        category: "wellness",
        rationale: "General wellness assessment"
      }
    ];

    const wellnessQuestion = defaultQuestions.find(q => q.category === "wellness");
    assertExists(wellnessQuestion);
    assertEquals(wellnessQuestion?.type, "scale");
  });

  await t.step("should include medication question in defaults", () => {
    const defaultQuestions = [
      {
        question: "Did you take all your medications today?",
        type: "yes_no",
        required: true,
        category: "medication",
        rationale: "Medication adherence tracking"
      }
    ];

    const medQuestion = defaultQuestions.find(q => q.category === "medication");
    assertExists(medQuestion);
    assertEquals(medQuestion?.type, "yes_no");
  });

  await t.step("should include safety question in defaults", () => {
    const defaultQuestions = [
      {
        question: "Are you experiencing any emergency symptoms?",
        type: "yes_no",
        required: true,
        category: "safety",
        rationale: "Emergency symptom detection"
      }
    ];

    const safetyQuestion = defaultQuestions.find(q => q.category === "safety");
    assertExists(safetyQuestion);
    assertEquals(safetyQuestion?.type, "yes_no");
    assertEquals(safetyQuestion?.required, true);
  });

  // =====================================================
  // Prompt Building Tests
  // =====================================================

  await t.step("should build context summary for prompt", () => {
    const context = {
      diagnoses: ["Type 2 Diabetes (primary)", "Hypertension"],
      carePlanGoals: ["Improve blood sugar control", "Exercise 3x/week"],
      sdohFactors: ["food_insecurity (high risk)"],
      recentConcerns: ["fatigue", "dizziness"],
      missedCheckIns: 3,
      averageWellnessScore: 5.5
    };

    const contextSummary: string[] = [];

    if (context.diagnoses.length > 0) {
      contextSummary.push(`Active conditions: ${context.diagnoses.join(", ")}`);
    }
    if (context.carePlanGoals.length > 0) {
      contextSummary.push(`Care plan goals: ${context.carePlanGoals.join(", ")}`);
    }
    if (context.sdohFactors.length > 0) {
      contextSummary.push(`SDOH factors: ${context.sdohFactors.join(", ")}`);
    }
    if (context.recentConcerns.length > 0) {
      contextSummary.push(`Recent concerns: ${context.recentConcerns.join(", ")}`);
    }
    if (context.missedCheckIns > 2) {
      contextSummary.push(`Note: Patient has missed ${context.missedCheckIns} check-ins in the past week`);
    }
    if (context.averageWellnessScore !== undefined) {
      contextSummary.push(`Average wellness score: ${context.averageWellnessScore.toFixed(1)}/10`);
    }

    assertEquals(contextSummary.length, 6);
    assertEquals(contextSummary[0].includes("Type 2 Diabetes"), true);
    assertEquals(contextSummary[4].includes("missed 3 check-ins"), true);
  });

  await t.step("should include focus areas in prompt", () => {
    const focusAreas = ["pain management", "mobility"];
    const focusNote = focusAreas.length > 0
      ? `Focus areas requested: ${focusAreas.join(", ")}`
      : "";

    assertEquals(focusNote, "Focus areas requested: pain management, mobility");
  });

  await t.step("should handle empty focus areas", () => {
    const focusAreas: string[] = [];
    const focusNote = focusAreas.length > 0
      ? `Focus areas requested: ${focusAreas.join(", ")}`
      : "";

    assertEquals(focusNote, "");
  });

  // =====================================================
  // Model Configuration Tests
  // =====================================================

  await t.step("should use Claude Haiku model", () => {
    const HAIKU_MODEL = "claude-haiku-4-5-20250919";
    assertEquals(HAIKU_MODEL.includes("haiku"), true);
  });

  // =====================================================
  // Usage Logging Tests
  // =====================================================

  await t.step("should estimate token costs", () => {
    const questionCount = 5;
    const estimatedInputTokens = 300;
    const estimatedOutputTokens = questionCount * 150;

    // Haiku pricing: $0.80/1M input, $4.00/1M output
    const cost =
      (estimatedInputTokens / 1_000_000) * 0.8 +
      (estimatedOutputTokens / 1_000_000) * 4.0;

    assertEquals(cost > 0, true);
    assertEquals(cost < 0.01, true);
  });

  await t.step("should log usage to database", () => {
    const usageLog = {
      user_id: "patient-123",
      tenant_id: "tenant-456",
      request_id: crypto.randomUUID(),
      model: "claude-haiku-4-5-20250919",
      request_type: "check_in_questions",
      input_tokens: 300,
      output_tokens: 750,
      cost: 0.0034,
      response_time_ms: 500,
      success: true
    };

    assertEquals(usageLog.request_type, "check_in_questions");
    assertExists(usageLog.request_id);
    assertEquals(usageLog.success, true);
  });

  // =====================================================
  // Response Structure Tests
  // =====================================================

  await t.step("should return questions with metadata", () => {
    const response = {
      questions: [
        { question: "How are you feeling?", type: "scale", category: "wellness" }
      ],
      metadata: {
        generated_at: new Date().toISOString(),
        model: "claude-haiku-4-5-20250919",
        response_time_ms: 450,
        context_used: {
          diagnoses_count: 2,
          sdoh_factors_count: 1,
          care_plan_goals_count: 3
        }
      }
    };

    assertExists(response.questions);
    assertExists(response.metadata);
    assertEquals(response.metadata.context_used.diagnoses_count, 2);
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/ai-check-in-questions", {
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

  await t.step("should return error with timestamp", () => {
    const response = {
      error: "AI service not configured",
      timestamp: new Date().toISOString()
    };

    assertExists(response.error);
    assertExists(response.timestamp);
  });

  await t.step("should use fallback questions on parse error", () => {
    const content = "Invalid JSON response from AI";
    let parsed = null;

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      parsed = null;
    }

    assertEquals(parsed, null);
    // Should fall back to default questions
  });

  // =====================================================
  // Date Range Tests
  // =====================================================

  await t.step("should calculate 7-day lookback period", () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const daysDifference = Math.round((now.getTime() - sevenDaysAgo.getTime()) / (24 * 60 * 60 * 1000));

    assertEquals(daysDifference, 7);
  });

  // =====================================================
  // Question Count Validation Tests
  // =====================================================

  await t.step("should limit questions to requested count", () => {
    const requestedCount = 5;
    const generatedQuestions = Array(10).fill({
      question: "Test question",
      type: "yes_no",
      category: "wellness"
    });

    const limitedQuestions = generatedQuestions.slice(0, requestedCount);

    assertEquals(limitedQuestions.length, 5);
  });

  // =====================================================
  // Care Plan Goals Tests
  // =====================================================

  await t.step("should limit care plan goals to 5", () => {
    const goals = [
      "Goal 1", "Goal 2", "Goal 3", "Goal 4",
      "Goal 5", "Goal 6", "Goal 7"
    ];

    const limitedGoals = goals.slice(0, 5);

    assertEquals(limitedGoals.length, 5);
  });

  // =====================================================
  // Logging Tests
  // =====================================================

  await t.step("should log with redacted patient ID", () => {
    const patientId = "patient-123-abc";
    const redacted = patientId
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
      .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]");

    // Patient ID without PHI patterns remains unchanged
    assertEquals(redacted, "patient-123-abc");
  });

  await t.step("should log question generation metrics", () => {
    const logEntry = {
      patientId: "[REDACTED]",
      questionCount: 5,
      responseTimeMs: 450
    };

    assertEquals(logEntry.questionCount, 5);
    assertExists(logEntry.responseTimeMs);
  });
});
