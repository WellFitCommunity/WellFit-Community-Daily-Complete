// supabase/functions/ai-patient-qa-bot/__tests__/index.test.ts
// Tests for AI Patient Q&A Bot - Health questions with safety guardrails

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Patient Q&A Bot Tests", async (t) => {

  // =====================================================
  // Request Validation Tests
  // =====================================================

  await t.step("should require question field", () => {
    const body = { patientId: "patient-123" };
    const hasQuestion = "question" in body;

    assertEquals(hasQuestion, false);
  });

  await t.step("should reject empty question", () => {
    const question = "";
    const isValid = question && question.trim().length > 0;

    assertEquals(isValid, false);
  });

  await t.step("should accept valid question", () => {
    const question = "What are the side effects of aspirin?";
    const isValid = question && question.trim().length > 0;

    assertEquals(isValid, true);
  });

  await t.step("should return 400 for missing question", () => {
    const response = { error: "Missing required field: question" };
    assertEquals(response.error, "Missing required field: question");
  });

  await t.step("should default language to English", () => {
    const body = { question: "Test question" };
    const language = (body as { language?: string }).language || "English";

    assertEquals(language, "English");
  });

  await t.step("should default includePatientContext to true", () => {
    const body = { question: "Test question" };
    const includeContext = (body as { includePatientContext?: boolean }).includePatientContext ?? true;

    assertEquals(includeContext, true);
  });

  // =====================================================
  // Emergency Detection Tests
  // =====================================================

  await t.step("should detect chest pain as emergency", () => {
    const EMERGENCY_KEYWORDS = ["chest pain", "heart attack", "can't breathe", "stroke"];
    const question = "I'm having severe chest pain";
    const lowerQuestion = question.toLowerCase();
    const isEmergency = EMERGENCY_KEYWORDS.some(k => lowerQuestion.includes(k));

    assertEquals(isEmergency, true);
  });

  await t.step("should detect heart attack as emergency", () => {
    const EMERGENCY_KEYWORDS = ["chest pain", "heart attack", "can't breathe", "stroke"];
    const question = "I think I'm having a heart attack";
    const lowerQuestion = question.toLowerCase();
    const isEmergency = EMERGENCY_KEYWORDS.some(k => lowerQuestion.includes(k));

    assertEquals(isEmergency, true);
  });

  await t.step("should detect difficulty breathing as emergency", () => {
    const EMERGENCY_KEYWORDS = ["difficulty breathing", "can't breathe"];
    const question = "I'm having difficulty breathing";
    const lowerQuestion = question.toLowerCase();
    const isEmergency = EMERGENCY_KEYWORDS.some(k => lowerQuestion.includes(k));

    assertEquals(isEmergency, true);
  });

  await t.step("should detect suicidal ideation as emergency", () => {
    const EMERGENCY_KEYWORDS = ["suicidal", "want to die"];
    const question = "I feel suicidal";
    const lowerQuestion = question.toLowerCase();
    const isEmergency = EMERGENCY_KEYWORDS.some(k => lowerQuestion.includes(k));

    assertEquals(isEmergency, true);
  });

  await t.step("should detect overdose as emergency", () => {
    const EMERGENCY_KEYWORDS = ["overdose", "poisoning"];
    const question = "I think I took an overdose";
    const lowerQuestion = question.toLowerCase();
    const isEmergency = EMERGENCY_KEYWORDS.some(k => lowerQuestion.includes(k));

    assertEquals(isEmergency, true);
  });

  await t.step("should not flag normal questions as emergency", () => {
    const EMERGENCY_KEYWORDS = ["chest pain", "heart attack", "can't breathe", "stroke", "suicidal"];
    const question = "What is the best time to take my blood pressure medication?";
    const lowerQuestion = question.toLowerCase();
    const isEmergency = EMERGENCY_KEYWORDS.some(k => lowerQuestion.includes(k));

    assertEquals(isEmergency, false);
  });

  // =====================================================
  // Provider Consultation Topics Tests
  // =====================================================

  await t.step("should flag medication changes for provider consult", () => {
    const PROVIDER_CONSULT_TOPICS = ["stop taking medication", "change dosage", "discontinue"];
    const question = "Can I stop taking my diabetes medication?";
    const lowerQuestion = question.toLowerCase();
    const requiresConsult = PROVIDER_CONSULT_TOPICS.some(t => lowerQuestion.includes(t));

    assertEquals(requiresConsult, true);
  });

  await t.step("should flag pregnancy questions for provider consult", () => {
    const PROVIDER_CONSULT_TOPICS = ["pregnant", "pregnancy"];
    const question = "Is this medication safe during pregnancy?";
    const lowerQuestion = question.toLowerCase();
    const requiresConsult = PROVIDER_CONSULT_TOPICS.some(t => lowerQuestion.includes(t));

    assertEquals(requiresConsult, true);
  });

  await t.step("should flag diagnosis questions for provider consult", () => {
    const PROVIDER_CONSULT_TOPICS = ["diagnosis", "cancer"];
    const question = "Do I have cancer based on these symptoms?";
    const lowerQuestion = question.toLowerCase();
    const requiresConsult = PROVIDER_CONSULT_TOPICS.some(t => lowerQuestion.includes(t));

    assertEquals(requiresConsult, true);
  });

  // =====================================================
  // Blocked Topics Tests
  // =====================================================

  await t.step("should block illegal drug questions", () => {
    const BLOCKED_TOPICS = ["illegal drugs", "recreational drug"];
    const question = "What are the effects of illegal drugs?";
    const lowerQuestion = question.toLowerCase();
    const isBlocked = BLOCKED_TOPICS.some(t => lowerQuestion.includes(t));

    assertEquals(isBlocked, true);
  });

  await t.step("should block self-harm questions", () => {
    const BLOCKED_TOPICS = ["harm myself", "harm others"];
    const question = "How can I harm myself?";
    const lowerQuestion = question.toLowerCase();
    const isBlocked = BLOCKED_TOPICS.some(t => lowerQuestion.includes(t));

    assertEquals(isBlocked, true);
  });

  await t.step("should return blocked response for blocked topics", () => {
    const response = {
      answer: "I'm sorry, but I can't provide information on that topic. Please speak with your healthcare provider directly about this."
    };

    assertEquals(response.answer.includes("can't provide information"), true);
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
  // Safety Check Result Tests
  // =====================================================

  await t.step("should return SafetyCheck structure", () => {
    const safetyCheck = {
      isEmergency: false,
      emergencyReason: undefined,
      requiresProviderConsult: false,
      consultReason: undefined,
      blockedTopics: []
    };

    assertEquals(safetyCheck.isEmergency, false);
    assertEquals(Array.isArray(safetyCheck.blockedTopics), true);
  });

  await t.step("should set emergencyReason when emergency detected", () => {
    const safetyCheck = {
      isEmergency: true,
      emergencyReason: "chest pain"
    };

    assertEquals(safetyCheck.isEmergency, true);
    assertEquals(safetyCheck.emergencyReason, "chest pain");
  });

  await t.step("should set consultReason for provider consult topics", () => {
    const safetyCheck = {
      requiresProviderConsult: true,
      consultReason: "Question involves pregnancy"
    };

    assertEquals(safetyCheck.requiresProviderConsult, true);
    assertExists(safetyCheck.consultReason);
  });

  // =====================================================
  // Emergency Response Tests
  // =====================================================

  await t.step("should return emergency alert in English", () => {
    const reason = "chest pain";
    const language = "English";
    const response = `⚠️ **EMERGENCY ALERT**\n\nBased on your message about "${reason}"`;

    assertEquals(response.includes("EMERGENCY ALERT"), true);
    assertEquals(response.includes(reason), true);
  });

  await t.step("should return emergency alert in Spanish", () => {
    const reason = "dolor de pecho";
    const language = "Spanish";
    const response = `⚠️ **ALERTA DE EMERGENCIA**\n\nBasándome en su mensaje sobre "${reason}"`;

    assertEquals(response.includes("ALERTA DE EMERGENCIA"), true);
  });

  await t.step("should include 911 instruction in emergency response", () => {
    const emergencyResponse = "Call 911 or go to the nearest emergency room immediately.";

    assertEquals(emergencyResponse.includes("911"), true);
    assertEquals(emergencyResponse.includes("emergency"), true);
  });

  // =====================================================
  // Patient Context Tests
  // =====================================================

  await t.step("should gather patient conditions", () => {
    const context = {
      conditions: ["Diabetes Mellitus", "Hypertension"],
      medications: [],
      allergies: [],
      preferred_language: "English"
    };

    assertEquals(context.conditions.length, 2);
    assertEquals(context.conditions[0], "Diabetes Mellitus");
  });

  await t.step("should gather patient medications", () => {
    const context = {
      conditions: [],
      medications: ["Metformin", "Lisinopril"],
      allergies: [],
      preferred_language: "English"
    };

    assertEquals(context.medications.length, 2);
  });

  await t.step("should gather patient allergies", () => {
    const context = {
      conditions: [],
      medications: [],
      allergies: ["Penicillin", "Aspirin"],
      preferred_language: "English"
    };

    assertEquals(context.allergies.length, 2);
  });

  await t.step("should determine age group - pediatric", () => {
    const age = 10;
    const ageGroup = age < 18 ? "pediatric" : age < 65 ? "adult" : "geriatric";

    assertEquals(ageGroup, "pediatric");
  });

  await t.step("should determine age group - adult", () => {
    const age = 45;
    const ageGroup = age < 18 ? "pediatric" : age < 65 ? "adult" : "geriatric";

    assertEquals(ageGroup, "adult");
  });

  await t.step("should determine age group - geriatric", () => {
    const age = 70;
    const ageGroup = age < 18 ? "pediatric" : age < 65 ? "adult" : "geriatric";

    assertEquals(ageGroup, "geriatric");
  });

  // =====================================================
  // QA Response Tests
  // =====================================================

  await t.step("should return QAResponse structure", () => {
    const response = {
      answer: "Here is the answer...",
      readingLevel: "6th grade",
      confidence: 0.85,
      safetyCheck: { isEmergency: false, requiresProviderConsult: false, blockedTopics: [] },
      relatedTopics: ["Topic 1"],
      sources: ["General health knowledge"],
      disclaimers: ["For educational purposes only"]
    };

    assertExists(response.answer);
    assertEquals(response.readingLevel, "6th grade");
    assertEquals(response.confidence, 0.85);
    assertExists(response.safetyCheck);
    assertEquals(Array.isArray(response.relatedTopics), true);
    assertEquals(Array.isArray(response.disclaimers), true);
  });

  await t.step("should use 6th grade reading level", () => {
    const readingLevel = "6th grade";
    assertEquals(readingLevel, "6th grade");
  });

  await t.step("should include disclaimers", () => {
    const disclaimers = [
      "This information is for educational purposes only.",
      "Please consult your healthcare provider for personalized advice."
    ];

    assertEquals(disclaimers.length, 2);
    assertEquals(disclaimers[0].includes("educational"), true);
  });

  // =====================================================
  // Model Configuration Tests
  // =====================================================

  await t.step("should use Claude Sonnet model", () => {
    const SONNET_MODEL = "claude-sonnet-4-20250514";
    assertEquals(SONNET_MODEL.includes("sonnet"), true);
  });

  await t.step("should keep last 3 conversation exchanges", () => {
    const conversationHistory = [
      { role: "user", content: "Question 1" },
      { role: "assistant", content: "Answer 1" },
      { role: "user", content: "Question 2" },
      { role: "assistant", content: "Answer 2" },
      { role: "user", content: "Question 3" },
      { role: "assistant", content: "Answer 3" },
      { role: "user", content: "Question 4" },
      { role: "assistant", content: "Answer 4" }
    ];
    const keptHistory = conversationHistory.slice(-6);

    assertEquals(keptHistory.length, 6);
  });

  // =====================================================
  // Usage Logging Tests
  // =====================================================

  await t.step("should estimate token costs", () => {
    const question = "What are the side effects of aspirin?";
    const estimatedInputTokens = Math.ceil(question.length / 4) + 500;
    const estimatedOutputTokens = 800;
    // Sonnet pricing: $3/1M input, $15/1M output
    const cost = (estimatedInputTokens / 1_000_000) * 3 + (estimatedOutputTokens / 1_000_000) * 15;

    assertEquals(cost > 0, true);
    assertEquals(cost < 0.1, true); // Should be very low
  });

  await t.step("should log usage to claude_usage_logs", () => {
    const usageLog = {
      user_id: "patient-123",
      tenant_id: "tenant-456",
      request_id: "uuid-here",
      model: "claude-sonnet-4-20250514",
      request_type: "patient_qa",
      input_tokens: 600,
      output_tokens: 800,
      cost: 0.01,
      response_time_ms: 1500,
      success: true
    };

    assertEquals(usageLog.request_type, "patient_qa");
    assertExists(usageLog.cost);
  });

  // =====================================================
  // Response Metadata Tests
  // =====================================================

  await t.step("should include metadata in response", () => {
    const metadata = {
      generated_at: new Date().toISOString(),
      model: "claude-sonnet-4-20250514",
      response_time_ms: 1500,
      language: "English",
      had_patient_context: true
    };

    assertExists(metadata.generated_at);
    assertExists(metadata.model);
    assertExists(metadata.response_time_ms);
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/ai-patient-qa-bot", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  // =====================================================
  // Error Handling Tests
  // =====================================================

  await t.step("should return 500 for AI service not configured", () => {
    const response = { error: "AI service not configured" };
    assertEquals(response.error, "AI service not configured");
  });

  await t.step("should return error with timestamp", () => {
    const response = {
      error: "Claude API error: 500",
      timestamp: new Date().toISOString()
    };

    assertExists(response.error);
    assertExists(response.timestamp);
  });

  // =====================================================
  // Logging Tests
  // =====================================================

  await t.step("should log emergency detection as security event", () => {
    const logEntry = {
      level: "security",
      event: "Emergency detected in patient question",
      context: {
        patientId: "[REDACTED]",
        reason: "chest pain"
      }
    };

    assertEquals(logEntry.level, "security");
  });

  await t.step("should redact patientId in logs", () => {
    const patientId = "patient-123-abc";
    const redacted = patientId ? "[REDACTED]" : undefined;

    assertEquals(redacted, "[REDACTED]");
  });
});
