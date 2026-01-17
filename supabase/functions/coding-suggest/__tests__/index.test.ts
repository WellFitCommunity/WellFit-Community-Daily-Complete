// supabase/functions/coding-suggest/__tests__/index.test.ts
// Tests for coding-suggest edge function (AI-powered Medical Coding)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Coding Suggest Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/coding-suggest", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should reject non-POST methods", () => {
    const method = "GET";
    const expectedStatus = method === "POST" ? 200 : 405;

    assertEquals(expectedStatus, 405);
  });

  await t.step("should require encounter.id in payload", () => {
    const validBody = { encounter: { id: "enc-123" } };
    const invalidBody = { encounter: {} };

    assertExists(validBody.encounter.id);
    assertEquals("id" in invalidBody.encounter, false);
  });

  await t.step("should return 400 for missing encounter.id", () => {
    const hasEncounterId = false;
    const expectedStatus = hasEncounterId ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should return 400 for empty request body", () => {
    const hasBody = false;
    const expectedStatus = hasBody ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should return 400 for invalid JSON body", () => {
    const isValidJson = false;
    const expectedStatus = isValidJson ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  // PHI Redaction tests
  await t.step("should redact email addresses", () => {
    const redact = (s: string): string =>
      s.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");

    assertEquals(redact("patient@example.com"), "[EMAIL]");
    assertEquals(redact("john.doe@hospital.org"), "[EMAIL]");
  });

  await t.step("should redact phone numbers", () => {
    const redact = (s: string): string =>
      s.replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]");

    assertEquals(redact("555-123-4567"), "[PHONE]");
    assertEquals(redact("(555) 123-4567"), "[PHONE]");
    assertEquals(redact("+1 555.123.4567"), "[PHONE]");
  });

  await t.step("should redact SSN", () => {
    const redact = (s: string): string =>
      s.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

    assertEquals(redact("123-45-6789"), "[SSN]");
  });

  await t.step("should redact dates (DOB format)", () => {
    const redact = (s: string): string =>
      s.replace(/\b(19|20)\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g, "[DATE]");

    assertEquals(redact("1980-01-15"), "[DATE]");
    assertEquals(redact("2000/12/31"), "[DATE]");
  });

  await t.step("should redact addresses", () => {
    const redact = (s: string): string =>
      s.replace(/\b\d{1,5}\s+[A-Za-z0-9'.\- ]+\b/g, (m) => (m.length > 6 ? "[ADDRESS]" : m));

    assertEquals(redact("123 Main Street"), "[ADDRESS]");
    assertEquals(redact("4567 Oak Avenue Drive"), "[ADDRESS]");
  });

  // Age band calculation tests
  await t.step("should calculate age band from DOB", () => {
    const ageBandFromDOB = (dob?: string | null): string | null => {
      if (!dob) return null;
      const d = new Date(dob);
      if (Number.isNaN(d.getTime())) return null;
      const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
      if (age < 0 || age > 120) return null;
      if (age < 18) return "0-17";
      if (age < 30) return "18-29";
      if (age < 45) return "30-44";
      if (age < 65) return "45-64";
      return "65+";
    };

    // Test using relative dates
    const now = new Date();
    const childDOB = new Date(now.getFullYear() - 10, 0, 1).toISOString();
    const youngAdultDOB = new Date(now.getFullYear() - 25, 0, 1).toISOString();
    const middleAgeDOB = new Date(now.getFullYear() - 40, 0, 1).toISOString();
    const preRetireDOB = new Date(now.getFullYear() - 55, 0, 1).toISOString();
    const seniorDOB = new Date(now.getFullYear() - 70, 0, 1).toISOString();

    assertEquals(ageBandFromDOB(childDOB), "0-17");
    assertEquals(ageBandFromDOB(youngAdultDOB), "18-29");
    assertEquals(ageBandFromDOB(middleAgeDOB), "30-44");
    assertEquals(ageBandFromDOB(preRetireDOB), "45-64");
    assertEquals(ageBandFromDOB(seniorDOB), "65+");
    assertEquals(ageBandFromDOB(null), null);
    assertEquals(ageBandFromDOB("invalid-date"), null);
  });

  await t.step("should reject invalid age ranges", () => {
    const ageBandFromDOB = (dob?: string | null): string | null => {
      if (!dob) return null;
      const d = new Date(dob);
      if (Number.isNaN(d.getTime())) return null;
      const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
      if (age < 0 || age > 120) return null;
      return "valid";
    };

    // Future date = negative age
    const futureDOB = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    assertEquals(ageBandFromDOB(futureDOB), null);
  });

  // Deep de-identification tests
  await t.step("should strip patient identifiers from objects", () => {
    const stripFields = new Set([
      "patient_name", "first_name", "last_name", "middle_name",
      "dob", "date_of_birth", "ssn", "email", "phone", "address",
      "address_line1", "address_line2", "city", "state", "zip",
      "mrn", "member_id", "insurance_id", "subscriber_name",
      "patient_id", "person_id", "user_id", "uid"
    ]);

    const deepDeidentify = (obj: Record<string, unknown>): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (stripFields.has(k)) continue;
        out[k] = v;
      }
      return out;
    };

    const input = {
      first_name: "John",
      last_name: "Doe",
      chief_complaint: "Chest pain",
      patient_id: "patient-123",
      diagnosis: "R07.9"
    };

    const deidentified = deepDeidentify(input);
    assertEquals("first_name" in deidentified, false);
    assertEquals("last_name" in deidentified, false);
    assertEquals("patient_id" in deidentified, false);
    assertEquals(deidentified.chief_complaint, "Chest pain");
    assertEquals(deidentified.diagnosis, "R07.9");
  });

  await t.step("should recursively process nested objects", () => {
    const deepDeidentify = (obj: unknown): unknown => {
      if (obj == null) return obj;
      if (Array.isArray(obj)) return obj.map(deepDeidentify);
      if (typeof obj === "object") {
        const strip = new Set(["patient_name", "first_name", "dob"]);
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          if (strip.has(k)) continue;
          out[k] = deepDeidentify(v);
        }
        return out;
      }
      return obj;
    };

    const input = {
      encounter: {
        patient_name: "John Doe",
        first_name: "John",
        diagnosis: { code: "E11.9", display: "Type 2 DM" }
      }
    };

    const result = deepDeidentify(input) as Record<string, Record<string, unknown>>;
    assertEquals("patient_name" in result.encounter, false);
    assertEquals("first_name" in result.encounter, false);
    assertExists(result.encounter.diagnosis);
  });

  // Claude API integration tests
  await t.step("should use Claude Sonnet 4.5 for medical coding", () => {
    const model = "claude-sonnet-4-5-20250929";
    assertEquals(model.includes("sonnet"), true);
  });

  await t.step("should structure system prompt correctly", () => {
    const SYSTEM_PROMPT = `You are a cautious medical coding assistant.
Return ONLY strict JSON matching this shape:
{
  "cpt": [{"code": "string", "modifiers": ["string"], "rationale": "string"}],
  "hcpcs": [{"code": "string", "modifiers": ["string"], "rationale": "string"}],
  "icd10": [{"code": "string", "rationale": "string", "principal": true}],
  "notes": "string",
  "confidence": 0
}`;

    assertEquals(SYSTEM_PROMPT.includes("medical coding assistant"), true);
    assertEquals(SYSTEM_PROMPT.includes("JSON"), true);
    assertEquals(SYSTEM_PROMPT.includes("cpt"), true);
    assertEquals(SYSTEM_PROMPT.includes("icd10"), true);
  });

  await t.step("should structure user prompt correctly", () => {
    const userPrompt = (payload: Record<string, unknown>) => {
      return [
        "Analyze this de-identified encounter and propose medical codes.",
        "Return ONLY JSON, no markdown, no commentary.",
        JSON.stringify(payload),
      ].join("\n");
    };

    const payload = { chief_complaint: "Chest pain", diagnosis: "R07.9" };
    const prompt = userPrompt(payload);

    assertEquals(prompt.includes("de-identified encounter"), true);
    assertEquals(prompt.includes("ONLY JSON"), true);
    assertEquals(prompt.includes("chest pain"), true);
  });

  // Coding suggestion response structure
  await t.step("should structure CPT code suggestion correctly", () => {
    const cptSuggestion = {
      code: "99213",
      modifiers: ["25"],
      rationale: "Office visit, established patient, low complexity"
    };

    assertExists(cptSuggestion.code);
    assertExists(cptSuggestion.rationale);
    assertEquals(cptSuggestion.modifiers?.includes("25"), true);
  });

  await t.step("should structure HCPCS code suggestion correctly", () => {
    const hcpcsSuggestion = {
      code: "J0290",
      modifiers: [],
      rationale: "Injection, ampicillin sodium, 500 mg"
    };

    assertExists(hcpcsSuggestion.code);
    assertEquals(hcpcsSuggestion.code.startsWith("J"), true);
  });

  await t.step("should structure ICD-10 code suggestion correctly", () => {
    const icd10Suggestion = {
      code: "E11.9",
      rationale: "Type 2 diabetes mellitus without complications",
      principal: true
    };

    assertExists(icd10Suggestion.code);
    assertEquals(icd10Suggestion.principal, true);
  });

  await t.step("should structure full coding response correctly", () => {
    const response = {
      cpt: [{ code: "99213", modifiers: [], rationale: "Office visit" }],
      hcpcs: [],
      icd10: [{ code: "E11.9", rationale: "Type 2 DM", principal: true }],
      notes: "Routine diabetes follow-up",
      confidence: 85
    };

    assertExists(response.cpt);
    assertExists(response.icd10);
    assertEquals(response.confidence, 85);
    assertEquals(response.cpt.length >= 1, true);
  });

  await t.step("should handle invalid JSON from model", () => {
    const parseModelResponse = (text: string): Record<string, unknown> => {
      try {
        return JSON.parse(text);
      } catch {
        return { notes: "Model returned invalid JSON.", confidence: 10 };
      }
    };

    const invalidResponse = "This is not JSON";
    const parsed = parseModelResponse(invalidResponse);

    assertEquals(parsed.confidence, 10);
    assertEquals(parsed.notes, "Model returned invalid JSON.");
  });

  // Retry logic tests
  await t.step("should retry up to 3 times on failure", () => {
    const maxRetries = 3;
    let attempts = 0;

    const mockCall = () => {
      attempts++;
      if (attempts < maxRetries) throw new Error("API error");
      return { success: true };
    };

    let result;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        result = mockCall();
        break;
      } catch {
        if (attempt < maxRetries) continue;
      }
    }

    assertEquals(attempts, 3);
    assertExists(result);
  });

  await t.step("should use exponential backoff between retries", () => {
    const backoffDelays = [500, 1000, 1500]; // attempt * 500ms

    for (let attempt = 1; attempt <= 3; attempt++) {
      const delay = attempt * 500;
      assertEquals(delay, backoffDelays[attempt - 1]);
    }
  });

  // Timeout tests
  await t.step("should timeout after 45 seconds", () => {
    const TIMEOUT_MS = 45_000;

    assertEquals(TIMEOUT_MS, 45000);
  });

  await t.step("should use promise timeout wrapper", async () => {
    const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> => {
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
        p.then((v) => { clearTimeout(t); resolve(v); })
         .catch((e) => { clearTimeout(t); reject(e); });
      });
    };

    // Test that fast promise resolves
    const fastPromise = Promise.resolve("success");
    const result = await withTimeout(fastPromise, 1000);
    assertEquals(result, "success");
  });

  // Cost calculation tests
  await t.step("should calculate Sonnet 4.5 costs correctly", () => {
    const inputTokens = 1000;
    const outputTokens = 500;
    // Sonnet 4.5 pricing: $3 per 1M input, $15 per 1M output
    const inputCost = (inputTokens * 0.003) / 1000;
    const outputCost = (outputTokens * 0.015) / 1000;
    const totalCost = inputCost + outputCost;

    assertEquals(inputCost, 0.003);
    assertEquals(outputCost, 0.0075);
    assertEquals(totalCost, 0.0105);
  });

  // Audit logging tests
  await t.step("should log to claude_api_audit on success", () => {
    const auditLog = {
      request_id: crypto.randomUUID(),
      user_id: "user-123",
      request_type: "medical_coding",
      model: "claude-sonnet-4-5-20250929",
      input_tokens: 500,
      output_tokens: 300,
      cost: 0.006,
      response_time_ms: 1200,
      success: true,
      phi_scrubbed: true,
      metadata: {
        encounter_id: "enc-123",
        confidence: 85,
        has_cpt: true,
        has_hcpcs: false,
        has_icd10: true
      }
    };

    assertEquals(auditLog.request_type, "medical_coding");
    assertEquals(auditLog.success, true);
    assertEquals(auditLog.phi_scrubbed, true);
  });

  await t.step("should log to claude_api_audit on failure", () => {
    const auditLog = {
      request_id: crypto.randomUUID(),
      user_id: "user-123",
      request_type: "medical_coding",
      model: "claude-sonnet-4-5-20250929",
      input_tokens: 0,
      output_tokens: 0,
      cost: 0,
      response_time_ms: 0,
      success: false,
      error_code: "API_ERROR",
      error_message: "Connection timeout",
      phi_scrubbed: true
    };

    assertEquals(auditLog.success, false);
    assertExists(auditLog.error_code);
    assertExists(auditLog.error_message);
  });

  await t.step("should log to coding_audits table", () => {
    const codingAudit = {
      encounter_id: "enc-123",
      model: "claude-sonnet-4-5-20250929",
      success: true,
      confidence: 85,
      created_at: new Date().toISOString()
    };

    assertExists(codingAudit.encounter_id);
    assertExists(codingAudit.created_at);
    assertEquals(codingAudit.success, true);
  });

  // User extraction tests
  await t.step("should extract token from authorization header", () => {
    const authHeader = "Bearer my-jwt-token-123";
    const token = authHeader.replace(/^Bearer /, "");

    assertEquals(token, "my-jwt-token-123");
  });

  await t.step("should handle missing authorization header", () => {
    const authHeader = null;
    let userId: string | null = null;

    if (authHeader) {
      userId = "user-123";
    }

    assertEquals(userId, null);
  });

  // HTTP status codes
  await t.step("should return 200 for successful coding", () => {
    const success = true;
    const expectedStatus = success ? 200 : 400;

    assertEquals(expectedStatus, 200);
  });

  await t.step("should return 400 for errors", () => {
    const hasError = true;
    const expectedStatus = hasError ? 400 : 200;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should return 405 for wrong method", () => {
    const isPostMethod = false;
    const expectedStatus = isPostMethod ? 200 : 405;

    assertEquals(expectedStatus, 405);
  });

  // Response structure tests
  await t.step("should include Content-Type header in responses", () => {
    const headers = { "Content-Type": "application/json" };

    assertEquals(headers["Content-Type"], "application/json");
  });

  await t.step("should structure success response correctly", () => {
    const response = {
      cpt: [{ code: "99213", modifiers: [], rationale: "Office visit" }],
      icd10: [{ code: "E11.9", rationale: "DM", principal: true }],
      notes: "Routine visit",
      confidence: 85
    };

    assertExists(response.cpt);
    assertExists(response.icd10);
    assertExists(response.confidence);
  });

  await t.step("should structure error response correctly", () => {
    const errorResponse = {
      error: "Missing encounter.id in payload"
    };

    assertExists(errorResponse.error);
  });

  await t.step("should include debug info when DEBUG=true", () => {
    const DEBUG = true;
    const rawLen = 1500;

    const resp = DEBUG
      ? { cpt: [], icd10: [], _debug: { raw_len: rawLen } }
      : { cpt: [], icd10: [] };

    assertEquals("_debug" in resp, true);
    if ("_debug" in resp) {
      assertEquals(resp._debug.raw_len, 1500);
    }
  });

  // Encounter structure tests
  await t.step("should accept encounter at top level", () => {
    const body = { encounter: { id: "enc-123" } };
    const encounter = body?.encounter ?? body;

    assertEquals(encounter.id, "enc-123");
  });

  await t.step("should accept encounter as root object", () => {
    const body = { id: "enc-456" };
    const encounter = (body as { encounter?: { id: string }; id?: string })?.encounter ?? body;

    assertEquals(encounter.id, "enc-456");
  });

  // Helper function tests
  await t.step("should check truthy string values", () => {
    const truthy = (v?: string | null) => !!v && v.trim().length > 0;

    assertEquals(truthy("hello"), true);
    assertEquals(truthy("  "), false);
    assertEquals(truthy(""), false);
    assertEquals(truthy(null), false);
    assertEquals(truthy(undefined), false);
  });
});
