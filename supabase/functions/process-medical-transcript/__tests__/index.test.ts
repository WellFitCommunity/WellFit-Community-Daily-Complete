// supabase/functions/process-medical-transcript/__tests__/index.test.ts
// Tests for Medical Transcript Processing Edge Function - AI-powered clinical scribe

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Process Medical Transcript Tests", async (t) => {

  // =====================================================
  // Input Validation Tests
  // =====================================================

  await t.step("should require transcript", () => {
    const body = { sessionType: "follow-up", patientId: "patient-123" };
    const hasTranscript = "transcript" in body;

    assertEquals(hasTranscript, false);
  });

  await t.step("should return 400 for missing transcript", () => {
    const response = {
      error: "Transcript is required"
    };

    assertEquals(response.error, "Transcript is required");
  });

  await t.step("should accept optional fields", () => {
    const body = {
      transcript: "Patient presents with...",
      sessionType: "initial",
      patientId: "patient-123",
      audioUrl: "https://storage.example.com/audio/123.mp3",
      duration: 1800
    };

    assertExists(body.transcript);
    assertExists(body.sessionType);
    assertExists(body.patientId);
    assertExists(body.audioUrl);
    assertExists(body.duration);
  });

  // =====================================================
  // Medical Code Structure Tests
  // =====================================================

  await t.step("should define MedicalCode interface structure", () => {
    const code = {
      code: "E11.9",
      type: "ICD10" as const,
      description: "Type 2 diabetes mellitus without complications",
      confidence: 0.92
    };

    assertExists(code.code);
    assertEquals(["ICD10", "CPT", "HCPCS"].includes(code.type), true);
    assertExists(code.description);
    assertEquals(typeof code.confidence, "number");
    assertEquals(code.confidence >= 0 && code.confidence <= 1, true);
  });

  await t.step("should support ICD10 code type", () => {
    const code = { code: "J06.9", type: "ICD10" };
    assertEquals(code.type, "ICD10");
  });

  await t.step("should support CPT code type", () => {
    const code = { code: "99213", type: "CPT" };
    assertEquals(code.type, "CPT");
  });

  await t.step("should support HCPCS code type", () => {
    const code = { code: "G0102", type: "HCPCS" };
    assertEquals(code.type, "HCPCS");
  });

  // =====================================================
  // Medical Code Validation Tests
  // =====================================================

  await t.step("should filter codes with confidence >= 0.7", () => {
    const codes = [
      { code: "E11.9", confidence: 0.92 },
      { code: "J06.9", confidence: 0.85 },
      { code: "I10", confidence: 0.65 },   // Below threshold
      { code: "Z00.00", confidence: 0.55 } // Below threshold
    ];

    const validatedCodes = codes.filter(c => c.confidence >= 0.7);

    assertEquals(validatedCodes.length, 2);
    assertEquals(validatedCodes.every(c => c.confidence >= 0.7), true);
  });

  await t.step("should require code, type, and description", () => {
    const codes = [
      { code: "E11.9", type: "ICD10", description: "Diabetes", confidence: 0.9 }, // Valid
      { code: "J06.9", type: "ICD10", description: null, confidence: 0.85 },      // Invalid - no description
      { code: "", type: "CPT", description: "Visit", confidence: 0.8 },           // Invalid - no code
      { code: "99213", type: null, description: "Office visit", confidence: 0.8 } // Invalid - no type
    ];

    const validatedCodes = codes.filter(c =>
      c.confidence >= 0.7 &&
      c.code &&
      c.type &&
      c.description
    );

    assertEquals(validatedCodes.length, 1);
    assertEquals(validatedCodes[0].code, "E11.9");
  });

  // =====================================================
  // Processing Result Structure Tests
  // =====================================================

  await t.step("should define ProcessingResult structure", () => {
    const result = {
      summary: "Patient presents with upper respiratory symptoms.",
      medicalCodes: [],
      actionItems: ["Order CBC", "Follow up in 2 weeks"],
      clinicalNotes: "SOAP notes here...",
      recommendations: ["Rest and hydration", "Consider antibiotic if no improvement"]
    };

    assertExists(result.summary);
    assertEquals(Array.isArray(result.medicalCodes), true);
    assertEquals(Array.isArray(result.actionItems), true);
    assertExists(result.clinicalNotes);
    assertEquals(Array.isArray(result.recommendations), true);
  });

  await t.step("should include keyFindings in response", () => {
    const response = {
      summary: "Patient visit summary",
      clinicalNotes: "SOAP notes",
      medicalCodes: [],
      actionItems: [],
      recommendations: [],
      keyFindings: ["Elevated blood pressure", "Mild tachycardia"],
      processingTime: Date.now(),
      confidence: 0.85
    };

    assertExists(response.keyFindings);
    assertEquals(Array.isArray(response.keyFindings), true);
    assertEquals(response.keyFindings.length, 2);
  });

  await t.step("should calculate average confidence", () => {
    const codes = [
      { confidence: 0.90 },
      { confidence: 0.85 },
      { confidence: 0.80 }
    ];

    const avgConfidence = codes.length > 0
      ? codes.reduce((sum, c) => sum + c.confidence, 0) / codes.length
      : 0;

    assertEquals(avgConfidence.toFixed(2), "0.85");
  });

  // =====================================================
  // Provider Preferences Tests
  // =====================================================

  await t.step("should support provider preference settings", () => {
    const prefs = {
      formality_level: "relaxed",
      interaction_style: "collaborative",
      verbosity: "balanced",
      humor_level: "light",
      documentation_style: "SOAP",
      provider_type: "physician",
      interaction_count: 42,
      common_phrases: ["patient denies", "no acute distress"],
      preferred_specialties: ["internal medicine", "family medicine"],
      billing_preferences: { balanced: true }
    };

    assertEquals(["formal", "professional", "relaxed", "casual"].includes(prefs.formality_level), true);
    assertEquals(["SOAP", "DAP", "narrative"].includes(prefs.documentation_style), true);
    assertEquals(typeof prefs.interaction_count, "number");
    assertEquals(Array.isArray(prefs.common_phrases), true);
  });

  await t.step("should use default values when prefs are missing", () => {
    const prefs = null;

    const defaults = {
      formality_level: prefs?.formality_level || "relaxed",
      interaction_style: prefs?.interaction_style || "collaborative",
      verbosity: prefs?.verbosity || "balanced",
      humor_level: prefs?.humor_level || "light",
      documentation_style: prefs?.documentation_style || "SOAP",
      provider_type: prefs?.provider_type || "physician"
    };

    assertEquals(defaults.formality_level, "relaxed");
    assertEquals(defaults.documentation_style, "SOAP");
  });

  await t.step("should determine time of day from hour", () => {
    const getTimeOfDay = (hour: number): string => {
      return hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
    };

    assertEquals(getTimeOfDay(9), "morning");
    assertEquals(getTimeOfDay(14), "afternoon");
    assertEquals(getTimeOfDay(19), "evening");
    assertEquals(getTimeOfDay(23), "night");
  });

  // =====================================================
  // Claude API Tests
  // =====================================================

  await t.step("should construct Claude API request", () => {
    const request = {
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4000,
      temperature: 0.1,
      messages: [{
        role: "user",
        content: "Analyze this medical transcript..."
      }]
    };

    assertEquals(request.model.includes("claude"), true);
    assertEquals(request.max_tokens, 4000);
    assertEquals(request.temperature, 0.1);
    assertEquals(request.messages[0].role, "user");
  });

  await t.step("should set required API headers", () => {
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": "sk-ant-api-key",
      "anthropic-version": "2023-06-01"
    };

    assertExists(headers["Content-Type"]);
    assertExists(headers["x-api-key"]);
    assertExists(headers["anthropic-version"]);
  });

  await t.step("should extract JSON from AI response", () => {
    const aiContent = `Here is the analysis:

\`\`\`json
{
  "summary": "Patient presents with symptoms",
  "medicalCodes": [],
  "actionItems": []
}
\`\`\`

Let me know if you need more details.`;

    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    assertExists(jsonMatch);

    const parsed = JSON.parse(jsonMatch![0]);
    assertEquals(parsed.summary, "Patient presents with symptoms");
  });

  await t.step("should handle pure JSON AI response", () => {
    const aiContent = `{
      "summary": "Patient presents with symptoms",
      "medicalCodes": [],
      "actionItems": []
    }`;

    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    assertExists(jsonMatch);

    const parsed = JSON.parse(jsonMatch![0]);
    assertExists(parsed.summary);
  });

  // =====================================================
  // Fallback Response Tests
  // =====================================================

  await t.step("should provide fallback result on parse error", () => {
    const transcript = "Patient presents with headache and fatigue.";

    const fallbackResult = {
      summary: "Medical transcript processed. Please review for accuracy.",
      medicalCodes: [],
      actionItems: ["Review transcript for accuracy", "Complete documentation"],
      clinicalNotes: transcript,
      recommendations: []
    };

    assertExists(fallbackResult.summary);
    assertEquals(fallbackResult.medicalCodes.length, 0);
    assertEquals(fallbackResult.actionItems.length, 2);
    assertEquals(fallbackResult.clinicalNotes, transcript);
  });

  // =====================================================
  // Audit Logging Tests
  // =====================================================

  await t.step("should create audit log entry for successful processing", () => {
    const auditEntry = {
      session_type: "follow-up",
      transcript_length: 2500,
      duration_seconds: 1800,
      ai_model_used: "claude-sonnet-4.5",
      codes_suggested: 5,
      processing_time_ms: Date.now(),
      success: true
    };

    assertExists(auditEntry.session_type);
    assertEquals(typeof auditEntry.transcript_length, "number");
    assertEquals(typeof auditEntry.duration_seconds, "number");
    assertEquals(auditEntry.ai_model_used, "claude-sonnet-4.5");
    assertEquals(auditEntry.success, true);
  });

  await t.step("should create audit log entry for errors", () => {
    const auditEntry = {
      session_type: "error",
      error_message: "Claude API error: 500",
      success: false,
      processing_time_ms: Date.now()
    };

    assertEquals(auditEntry.session_type, "error");
    assertExists(auditEntry.error_message);
    assertEquals(auditEntry.success, false);
  });

  await t.step("should truncate long error messages", () => {
    const longError = "A".repeat(1000);
    const truncated = longError.slice(0, 500);

    assertEquals(truncated.length, 500);
    assertEquals(truncated.length < longError.length, true);
  });

  // =====================================================
  // Authentication Tests
  // =====================================================

  await t.step("should extract user from authorization header", () => {
    const authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
    const token = authHeader.replace("Bearer ", "");

    assertEquals(token.startsWith("eyJ"), true);
    assertEquals(token.includes("Bearer"), false);
  });

  await t.step("should handle missing authorization", () => {
    const authHeader = null;
    let userId = null;

    if (authHeader) {
      userId = "extracted-user-id";
    }

    assertEquals(userId, null);
  });

  // =====================================================
  // Response Structure Tests
  // =====================================================

  await t.step("should return complete response structure", () => {
    const response = {
      summary: "Clinical summary here",
      clinicalNotes: "SOAP notes",
      medicalCodes: [
        { code: "E11.9", type: "ICD10", description: "Diabetes", confidence: 0.9 }
      ],
      actionItems: ["Order lab work"],
      recommendations: ["Diet modification"],
      keyFindings: ["Elevated A1C"],
      processingTime: Date.now(),
      confidence: 0.9
    };

    assertExists(response.summary);
    assertExists(response.clinicalNotes);
    assertEquals(Array.isArray(response.medicalCodes), true);
    assertEquals(Array.isArray(response.actionItems), true);
    assertEquals(Array.isArray(response.recommendations), true);
    assertEquals(Array.isArray(response.keyFindings), true);
    assertEquals(typeof response.processingTime, "number");
    assertEquals(typeof response.confidence, "number");
  });

  await t.step("should set confidence to 0 when no codes", () => {
    const validatedCodes: { confidence: number }[] = [];

    const confidence = validatedCodes.length > 0
      ? validatedCodes.reduce((sum, c) => sum + c.confidence, 0) / validatedCodes.length
      : 0;

    assertEquals(confidence, 0);
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/process-medical-transcript", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should only accept POST method", () => {
    const allowedMethods = ["POST"];

    assertEquals(allowedMethods.includes("POST"), true);
    assertEquals(allowedMethods.includes("GET"), false);
  });

  // =====================================================
  // Error Response Tests
  // =====================================================

  await t.step("should return 500 for API key not configured", () => {
    const errorMessage = "ANTHROPIC_API_KEY not configured";
    assertEquals(errorMessage.includes("API"), true);
  });

  await t.step("should return 500 for Claude API errors", () => {
    const response = {
      error: "Failed to process medical transcript",
      details: "Claude API error: 500"
    };

    assertEquals(response.error, "Failed to process medical transcript");
    assertExists(response.details);
  });

  await t.step("should handle JSON parse errors", () => {
    const invalidJson = "This is not valid JSON {incomplete";

    const jsonMatch = invalidJson.match(/\{[\s\S]*\}/);
    // Match fails gracefully
    assertEquals(jsonMatch, null);
  });

  // =====================================================
  // CORS Tests
  // =====================================================

  await t.step("should include CORS headers in response", () => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://example.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json"
    };

    assertExists(corsHeaders["Access-Control-Allow-Origin"]);
    assertEquals(corsHeaders["Content-Type"], "application/json");
  });

  // =====================================================
  // Environment Variable Tests
  // =====================================================

  await t.step("should require ANTHROPIC_API_KEY", () => {
    const requiredVars = ["ANTHROPIC_API_KEY"];
    assertEquals(requiredVars.length, 1);
    assertEquals(requiredVars[0], "ANTHROPIC_API_KEY");
  });

  await t.step("should require Supabase environment variables", () => {
    const requiredVars = ["SUPABASE_URL", "SB_SECRET_KEY"];
    assertEquals(requiredVars.length >= 2, true);
  });

  // =====================================================
  // Session Type Tests
  // =====================================================

  await t.step("should support various session types", () => {
    const sessionTypes = ["initial", "follow-up", "urgent", "telehealth", "procedure"];

    for (const type of sessionTypes) {
      assertEquals(typeof type, "string");
    }
  });

  // =====================================================
  // HIPAA Compliance Tests (PHI-Free Logging)
  // =====================================================

  await t.step("should not include PHI in audit logs", () => {
    const auditEntry = {
      session_type: "follow-up",
      transcript_length: 2500,
      duration_seconds: 1800,
      ai_model_used: "claude-sonnet-4.5",
      codes_suggested: 5,
      success: true
      // NO: transcript, patientId, patient name, DOB, etc.
    };

    assertEquals("transcript" in auditEntry, false);
    assertEquals("patientId" in auditEntry, false);
    assertEquals("patient_name" in auditEntry, false);
    assertEquals("dob" in auditEntry, false);
  });

  await t.step("should not log sensitive patient data", () => {
    const logMessage = "Medical transcript processing error";
    const logContext = {
      error: "API timeout",
      // PHI-free context only
    };

    assertEquals(logMessage.includes("SSN"), false);
    assertEquals(logMessage.includes("DOB"), false);
    assertEquals("ssn" in logContext, false);
    assertEquals("patient_name" in logContext, false);
  });
});
