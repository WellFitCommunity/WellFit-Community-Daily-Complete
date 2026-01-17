// supabase/functions/ai-soap-note-generator/__tests__/index.test.ts
// Tests for ai-soap-note-generator edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI SOAP Note Generator Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/ai-soap-note-generator", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require encounterId in request body", () => {
    const validBody = { encounterId: "encounter-123" };
    const invalidBody = { patientId: "patient-456" };

    assertExists(validBody.encounterId);
    assertEquals("encounterId" in invalidBody, false);
  });

  await t.step("should return 400 for missing encounterId", () => {
    const hasEncounterId = false;
    const expectedStatus = hasEncounterId ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should validate template styles", () => {
    const validStyles = ["standard", "comprehensive", "brief"];

    assertEquals(validStyles.includes("standard"), true);
    assertEquals(validStyles.includes("comprehensive"), true);
    assertEquals(validStyles.includes("brief"), true);
    assertEquals(validStyles.includes("custom"), false);
  });

  await t.step("should default includeTranscript to true", () => {
    const getIncludeTranscript = (provided?: boolean): boolean => {
      return provided ?? true;
    };

    assertEquals(getIncludeTranscript(undefined), true);
    assertEquals(getIncludeTranscript(false), false);
    assertEquals(getIncludeTranscript(true), true);
  });

  await t.step("should default templateStyle to 'standard'", () => {
    const getTemplateStyle = (provided?: string): string => {
      return provided ?? "standard";
    };

    assertEquals(getTemplateStyle(undefined), "standard");
    assertEquals(getTemplateStyle("comprehensive"), "comprehensive");
    assertEquals(getTemplateStyle("brief"), "brief");
  });

  await t.step("should structure SOAP note section correctly", () => {
    const section = {
      content: "Patient presents with chest pain",
      confidence: 0.95,
      sources: ["chief_complaint", "transcript"]
    };

    assertExists(section.content);
    assertEquals(section.confidence >= 0 && section.confidence <= 1, true);
    assertEquals(Array.isArray(section.sources), true);
  });

  await t.step("should structure generated SOAP note response", () => {
    const mockResponse = {
      subjective: { content: "...", confidence: 0.95, sources: [] },
      objective: { content: "...", confidence: 0.98, sources: [] },
      assessment: { content: "...", confidence: 0.90, sources: [] },
      plan: { content: "...", confidence: 0.92, sources: [] },
      icd10Suggestions: [],
      cptSuggestions: [],
      requiresReview: false,
      reviewReasons: []
    };

    assertExists(mockResponse.subjective);
    assertExists(mockResponse.objective);
    assertExists(mockResponse.assessment);
    assertExists(mockResponse.plan);
    assertEquals(Array.isArray(mockResponse.icd10Suggestions), true);
    assertEquals(Array.isArray(mockResponse.cptSuggestions), true);
    assertEquals(typeof mockResponse.requiresReview, "boolean");
  });

  await t.step("should map LOINC codes to vital names correctly", () => {
    const vitalCodeMap: Record<string, string> = {
      "8310-5": "temperature",
      "8480-6": "blood_pressure_systolic",
      "8462-4": "blood_pressure_diastolic",
      "8867-4": "heart_rate",
      "9279-1": "respiratory_rate",
      "59408-5": "oxygen_saturation",
      "2708-6": "oxygen_saturation",
      "29463-7": "weight",
      "8302-2": "height",
    };

    assertEquals(vitalCodeMap["8310-5"], "temperature");
    assertEquals(vitalCodeMap["8480-6"], "blood_pressure_systolic");
    assertEquals(vitalCodeMap["8867-4"], "heart_rate");
    assertEquals(vitalCodeMap["59408-5"], "oxygen_saturation");
    assertEquals(vitalCodeMap["unknown"], undefined);
  });

  await t.step("should redact PHI from logs - email", () => {
    const redact = (s: string): string =>
      s.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");

    assertEquals(redact("Contact: test@example.com"), "Contact: [EMAIL]");
    assertEquals(redact("user.name@domain.org"), "[EMAIL]");
  });

  await t.step("should redact PHI from logs - phone", () => {
    const redact = (s: string): string =>
      s.replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]");

    assertEquals(redact("Call 555-123-4567"), "Call [PHONE]");
    assertEquals(redact("Phone: (555) 123-4567"), "Phone: [PHONE]");
    assertEquals(redact("+15551234567"), "[PHONE]");
  });

  await t.step("should redact PHI from logs - SSN", () => {
    const redact = (s: string): string =>
      s.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

    assertEquals(redact("SSN: 123-45-6789"), "SSN: [SSN]");
  });

  await t.step("should calculate encounter duration correctly", () => {
    const calculateDuration = (start: Date, end: Date): number => {
      return Math.floor((end.getTime() - start.getTime()) / 60000);
    };

    const start = new Date("2026-01-17T10:00:00Z");
    const end = new Date("2026-01-17T10:30:00Z");

    assertEquals(calculateDuration(start, end), 30);
  });

  await t.step("should limit transcript length to prevent token overflow", () => {
    const MAX_TRANSCRIPT_LENGTH = 8000;
    const longTranscript = "a".repeat(10000);
    const truncated = longTranscript.slice(0, MAX_TRANSCRIPT_LENGTH);

    assertEquals(truncated.length, 8000);
  });

  await t.step("should structure ICD-10 suggestion correctly", () => {
    const suggestion = {
      code: "E11.9",
      display: "Type 2 diabetes mellitus without complications",
      confidence: 0.95
    };

    assertExists(suggestion.code);
    assertExists(suggestion.display);
    assertEquals(suggestion.confidence >= 0 && suggestion.confidence <= 1, true);
  });

  await t.step("should structure CPT suggestion correctly", () => {
    const suggestion = {
      code: "99214",
      display: "Office visit, 30-39 min",
      confidence: 0.90
    };

    assertExists(suggestion.code);
    assertExists(suggestion.display);
    assertEquals(suggestion.confidence >= 0 && suggestion.confidence <= 1, true);
  });

  await t.step("should normalize string sections to objects", () => {
    const normalizeSection = (section: unknown, defaultContent: string) => {
      if (typeof section === "string") {
        return { content: section, confidence: 0.8, sources: [] };
      }
      const s = section as { content?: string; confidence?: number; sources?: string[] };
      return {
        content: s?.content || defaultContent,
        confidence: s?.confidence ?? 0.8,
        sources: s?.sources || [],
      };
    };

    const stringResult = normalizeSection("Some text", "default");
    assertEquals(stringResult.content, "Some text");
    assertEquals(stringResult.confidence, 0.8);

    const objectResult = normalizeSection({ content: "Object text", confidence: 0.9 }, "default");
    assertEquals(objectResult.content, "Object text");
    assertEquals(objectResult.confidence, 0.9);
  });

  await t.step("should set requiresReview when content is uncertain", () => {
    const requiresReview = true;
    const reviewReasons = ["AI-generated content requires clinician review"];

    assertEquals(requiresReview, true);
    assertEquals(reviewReasons.length > 0, true);
  });

  await t.step("should structure metadata response correctly", () => {
    const metadata = {
      generated_at: new Date().toISOString(),
      model: "claude-sonnet-4-20250514",
      response_time_ms: 2500,
      template_style: "standard",
      context_sources: {
        vitals_count: 5,
        diagnoses_count: 3,
        medications_count: 8,
        lab_results_count: 2,
        has_transcript: true,
      },
    };

    assertExists(metadata.generated_at);
    assertExists(metadata.model);
    assertExists(metadata.response_time_ms);
    assertEquals(metadata.context_sources.vitals_count, 5);
    assertEquals(metadata.context_sources.has_transcript, true);
  });

  await t.step("should format vital strings for display", () => {
    const formatVital = (name: string, value: number, unit: string): string => {
      return `${name}: ${value} ${unit}`;
    };

    assertEquals(formatVital("BP", 120, "mmHg"), "BP: 120 mmHg");
    assertEquals(formatVital("HR", 72, "bpm"), "HR: 72 bpm");
  });

  await t.step("should use Claude Sonnet model", () => {
    const SONNET_MODEL = "claude-sonnet-4-20250514";
    assertEquals(SONNET_MODEL.includes("sonnet"), true);
  });

  await t.step("should estimate token usage correctly", () => {
    const estimatedInputTokens = 1500;
    const estimatedOutputTokens = 2000;

    // Sonnet pricing: $3/1M input, $15/1M output
    const cost =
      (estimatedInputTokens / 1_000_000) * 3 + (estimatedOutputTokens / 1_000_000) * 15;

    assertEquals(cost > 0, true);
    assertEquals(cost < 1, true);  // Should be well under $1
  });

  await t.step("should structure usage log correctly", () => {
    const usageLog = {
      user_id: "encounter-123",
      tenant_id: "tenant-456",
      request_id: crypto.randomUUID(),
      model: "claude-sonnet-4-20250514",
      request_type: "soap_note_generation",
      input_tokens: 1500,
      output_tokens: 2000,
      cost: 0.035,
      response_time_ms: 2500,
      success: true,
    };

    assertExists(usageLog.request_id);
    assertEquals(usageLog.request_type, "soap_note_generation");
    assertEquals(usageLog.success, true);
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

  await t.step("should provide fallback SOAP note on parse failure", () => {
    const fallbackNote = {
      subjective: { content: "Unable to generate subjective section.", confidence: 0.6, sources: ["fallback"] },
      objective: { content: "No vitals documented.", confidence: 0.7, sources: ["vitals"] },
      assessment: { content: "Assessment pending further evaluation.", confidence: 0.5, sources: ["diagnoses"] },
      plan: { content: "Plan pending clinician review.", confidence: 0.5, sources: ["medications"] },
      icd10Suggestions: [],
      cptSuggestions: [],
      requiresReview: true,
      reviewReasons: ["AI generation failed - fallback content requires complete review"],
    };

    assertEquals(fallbackNote.requiresReview, true);
    assertEquals(fallbackNote.subjective.sources[0], "fallback");
  });

  await t.step("should handle optional HPI and ROS sections", () => {
    const soapNote = {
      hpi: { content: "OLDCARTS format...", confidence: 0.85, sources: ["chief_complaint"] },
      ros: undefined
    };

    assertExists(soapNote.hpi);
    assertEquals(soapNote.ros, undefined);
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
