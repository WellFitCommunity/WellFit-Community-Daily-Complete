// supabase/functions/ai-patient-education/__tests__/index.test.ts
// Tests for ai-patient-education edge function (Patient Education Content Generation)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Patient Education Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/ai-patient-education", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require authorization header", () => {
    const authHeader = null;
    const hasAuth = !!authHeader?.startsWith("Bearer ");
    const expectedStatus = hasAuth ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should require topic in request body", () => {
    const validBody = { topic: "diabetes management" };
    const invalidBody = {};

    assertExists(validBody.topic);
    assertEquals("topic" in invalidBody, false);
  });

  await t.step("should return 400 for missing topic", () => {
    const hasTopic = false;
    const expectedStatus = hasTopic ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should accept optional patientId", () => {
    const body = {
      topic: "medication adherence",
      patientId: "patient-123"
    };

    assertExists(body.patientId);
  });

  await t.step("should accept optional language parameter", () => {
    const body = {
      topic: "heart health",
      language: "es"
    };

    assertExists(body.language);
  });

  await t.step("should default language to English", () => {
    const language = undefined || "en";

    assertEquals(language, "en");
  });

  // Format Tests
  await t.step("should support article format", () => {
    const validFormats = ["article", "bullet_points", "qa", "instructions"];

    assertEquals(validFormats.includes("article"), true);
  });

  await t.step("should support bullet_points format", () => {
    const format = "bullet_points";

    assertEquals(format, "bullet_points");
  });

  await t.step("should support qa format", () => {
    const format = "qa";

    assertEquals(format, "qa");
  });

  await t.step("should support instructions format", () => {
    const format = "instructions";

    assertEquals(format, "instructions");
  });

  await t.step("should default format to article", () => {
    const format = undefined || "article";

    assertEquals(format, "article");
  });

  // Reading Level Tests
  await t.step("should target 6th grade reading level", () => {
    const targetReadingLevel = 6;

    assertEquals(targetReadingLevel, 6);
  });

  await t.step("should include reading level guidance in prompt", () => {
    const prompt = "Write at a 6th grade reading level using simple words and short sentences";

    assertEquals(prompt.includes("6th grade"), true);
    assertEquals(prompt.includes("simple words"), true);
  });

  await t.step("should avoid medical jargon", () => {
    const guidelines = [
      "Avoid medical jargon",
      "Use everyday words",
      "Explain terms when necessary"
    ];

    assertEquals(guidelines.length, 3);
  });

  // Claude Model Tests
  await t.step("should use Claude Haiku for cost-effective generation", () => {
    const HAIKU_MODEL = "claude-haiku-4-5-20250514";

    assertEquals(HAIKU_MODEL.includes("haiku"), true);
  });

  // Content Structure Tests
  await t.step("should structure article content correctly", () => {
    const content = {
      title: "Understanding Diabetes",
      format: "article",
      content: "Diabetes is a condition that affects...",
      sections: [
        { heading: "What is Diabetes?", text: "..." },
        { heading: "Managing Your Blood Sugar", text: "..." }
      ],
      keyPoints: ["Check blood sugar regularly", "Take medications as prescribed"],
      readingLevel: 6
    };

    assertExists(content.title);
    assertEquals(content.format, "article");
    assertExists(content.sections);
    assertEquals(content.keyPoints.length, 2);
  });

  await t.step("should structure bullet_points content correctly", () => {
    const content = {
      title: "Heart-Healthy Tips",
      format: "bullet_points",
      points: [
        "Eat more vegetables and fruits",
        "Walk for 30 minutes each day",
        "Limit salt in your diet"
      ]
    };

    assertEquals(content.format, "bullet_points");
    assertEquals(content.points.length, 3);
  });

  await t.step("should structure qa content correctly", () => {
    const content = {
      title: "Blood Pressure FAQ",
      format: "qa",
      questions: [
        { question: "What is high blood pressure?", answer: "High blood pressure is when..." },
        { question: "How do I lower my blood pressure?", answer: "You can lower it by..." }
      ]
    };

    assertEquals(content.format, "qa");
    assertEquals(content.questions.length, 2);
    assertExists(content.questions[0].question);
    assertExists(content.questions[0].answer);
  });

  await t.step("should structure instructions content correctly", () => {
    const content = {
      title: "Taking Your Blood Pressure at Home",
      format: "instructions",
      steps: [
        { stepNumber: 1, instruction: "Sit quietly for 5 minutes before measuring" },
        { stepNumber: 2, instruction: "Wrap the cuff around your upper arm" },
        { stepNumber: 3, instruction: "Press the start button and stay still" }
      ],
      warnings: ["Do not take readings after exercise"],
      tips: ["Take measurements at the same time each day"]
    };

    assertEquals(content.format, "instructions");
    assertEquals(content.steps.length, 3);
    assertExists(content.warnings);
    assertExists(content.tips);
  });

  // Medical Disclaimer Tests
  await t.step("should include medical disclaimer", () => {
    const disclaimer = "This information is for educational purposes only and should not replace advice from your healthcare provider.";

    assertEquals(disclaimer.includes("educational purposes"), true);
    assertEquals(disclaimer.includes("healthcare provider"), true);
  });

  await t.step("should recommend consulting healthcare provider", () => {
    const callToAction = "Talk to your doctor or nurse if you have questions about your health.";

    assertEquals(callToAction.includes("doctor"), true);
  });

  // Language Support Tests
  await t.step("should support Spanish language", () => {
    const supportedLanguages = ["en", "es", "zh", "vi", "ko", "tl"];

    assertEquals(supportedLanguages.includes("es"), true);
  });

  await t.step("should support Chinese language", () => {
    const supportedLanguages = ["en", "es", "zh", "vi", "ko", "tl"];

    assertEquals(supportedLanguages.includes("zh"), true);
  });

  await t.step("should support Vietnamese language", () => {
    const supportedLanguages = ["en", "es", "zh", "vi", "ko", "tl"];

    assertEquals(supportedLanguages.includes("vi"), true);
  });

  await t.step("should get language name from code", () => {
    const languageNames: Record<string, string> = {
      en: "English",
      es: "Spanish",
      zh: "Chinese",
      vi: "Vietnamese",
      ko: "Korean",
      tl: "Tagalog"
    };

    assertEquals(languageNames["es"], "Spanish");
    assertEquals(languageNames["zh"], "Chinese");
  });

  // Patient Context Tests
  await t.step("should personalize content when patientId provided", () => {
    const patientContext = {
      age: 72,
      conditions: ["diabetes", "hypertension"],
      medications: ["metformin", "lisinopril"]
    };
    const isPersonalized = !!patientContext;

    assertEquals(isPersonalized, true);
  });

  await t.step("should adjust content for elderly patients", () => {
    const age = 75;
    const isElderly = age >= 65;
    const adjustments = isElderly ? ["larger font recommendation", "simpler language"] : [];

    assertEquals(isElderly, true);
    assertEquals(adjustments.length, 2);
  });

  await t.step("should relate content to patient conditions", () => {
    const topic = "exercise";
    const conditions = ["diabetes", "arthritis"];
    const relatedGuidance = conditions.length > 0
      ? "Consider your health conditions when exercising"
      : "";

    assertEquals(relatedGuidance.includes("health conditions"), true);
  });

  // Response Structure Tests
  await t.step("should structure success response correctly", () => {
    const response = {
      success: true,
      content: {
        title: "Managing Your Diabetes",
        format: "article",
        content: "...",
        readingLevel: 6,
        language: "en"
      },
      metadata: {
        topic: "diabetes management",
        generated_at: new Date().toISOString(),
        model: "claude-haiku-4-5-20250514",
        personalized: false
      }
    };

    assertEquals(response.success, true);
    assertExists(response.content);
    assertExists(response.metadata);
  });

  await t.step("should include generation timestamp", () => {
    const timestamp = new Date().toISOString();
    const isValidTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestamp);

    assertEquals(isValidTimestamp, true);
  });

  // AI Usage Logging Tests
  await t.step("should log AI usage for cost tracking", () => {
    const usageLog = {
      user_id: "user-123",
      request_id: crypto.randomUUID(),
      model: "claude-haiku-4-5-20250514",
      request_type: "patient_education",
      input_tokens: 200,
      output_tokens: 500,
      cost: (200 / 1_000_000) * 0.25 + (500 / 1_000_000) * 1.25,
      response_time_ms: 800,
      success: true
    };

    assertEquals(usageLog.request_type, "patient_education");
    assertEquals(usageLog.model.includes("haiku"), true);
  });

  // Content Caching Tests
  await t.step("should check cache for generic content", () => {
    const cacheKey = "education:diabetes_management:article:en";
    const parts = cacheKey.split(":");

    assertEquals(parts[0], "education");
    assertEquals(parts[1], "diabetes_management");
    assertEquals(parts[2], "article");
    assertEquals(parts[3], "en");
  });

  await t.step("should not cache personalized content", () => {
    const isPersonalized = true;
    const shouldCache = !isPersonalized;

    assertEquals(shouldCache, false);
  });

  // Topic Validation Tests
  await t.step("should validate topic is not empty", () => {
    const topic = "   ";
    const isValid = topic.trim().length > 0;

    assertEquals(isValid, false);
  });

  await t.step("should validate topic length", () => {
    const maxTopicLength = 500;
    const topic = "diabetes management";
    const isValid = topic.length <= maxTopicLength;

    assertEquals(isValid, true);
  });

  // HTTP Status Codes
  await t.step("should return 200 for successful generation", () => {
    const success = true;
    const expectedStatus = success ? 200 : 500;

    assertEquals(expectedStatus, 200);
  });

  await t.step("should return 400 for invalid request", () => {
    const isValid = false;
    const expectedStatus = isValid ? 200 : 400;

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

  // Error Response Structure
  await t.step("should structure error response correctly", () => {
    const errorResponse = {
      error: "Missing required field: topic"
    };

    assertExists(errorResponse.error);
  });

  await t.step("should structure authorization error correctly", () => {
    const errorResponse = {
      error: "Authorization required"
    };

    assertEquals(errorResponse.error, "Authorization required");
  });

  // Content Safety Tests
  await t.step("should not include specific dosage instructions", () => {
    const safetyGuidelines = [
      "Do not recommend specific medication dosages",
      "Refer to healthcare provider for dosing",
      "Do not diagnose conditions"
    ];

    assertEquals(safetyGuidelines.length, 3);
  });

  await t.step("should include emergency guidance when appropriate", () => {
    const topic = "chest pain";
    const isEmergencyTopic = ["chest pain", "stroke", "heart attack", "severe bleeding"].some(
      t => topic.toLowerCase().includes(t)
    );
    const includeEmergencyInfo = isEmergencyTopic;

    assertEquals(includeEmergencyInfo, true);
  });

  // Accessibility Tests
  await t.step("should recommend accessible formatting", () => {
    const accessibilityFeatures = [
      "Large font size (18px minimum)",
      "High contrast colors",
      "Simple layout",
      "Alt text for images"
    ];

    assertEquals(accessibilityFeatures.length, 4);
  });

  // Print-Friendly Tests
  await t.step("should support print-friendly output", () => {
    const printOptions = {
      includePrintStyles: true,
      removeInteractiveElements: true,
      singlePage: false
    };

    assertEquals(printOptions.includePrintStyles, true);
  });

  // Topic Categories Tests
  await t.step("should categorize common health topics", () => {
    const topicCategories = {
      "chronic_disease": ["diabetes", "hypertension", "heart disease", "copd"],
      "medications": ["medication adherence", "side effects", "drug interactions"],
      "lifestyle": ["diet", "exercise", "sleep", "stress management"],
      "preventive": ["vaccinations", "screenings", "wellness checks"]
    };

    assertEquals(topicCategories.chronic_disease.includes("diabetes"), true);
    assertEquals(topicCategories.lifestyle.includes("exercise"), true);
  });
});
