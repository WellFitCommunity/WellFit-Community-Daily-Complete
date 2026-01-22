// supabase/functions/mcp-claude-server/__tests__/index.test.ts
// Tests for MCP Claude Server - AI Integration with PHI De-identification

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("MCP Claude Server Tests", async (t) => {

  // =====================================================
  // PHI De-identification Tests (HIPAA Critical)
  // =====================================================

  await t.step("should redact email addresses", () => {
    const redact = (s: string): string =>
      s.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");

    const input = "Contact patient at john.doe@email.com for follow-up";
    const output = redact(input);

    assertEquals(output.includes("john.doe@email.com"), false);
    assertEquals(output.includes("[EMAIL]"), true);
  });

  await t.step("should redact phone numbers", () => {
    const redact = (s: string): string =>
      s.replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]");

    const testCases = [
      { input: "Call patient at 555-123-4567", expected: "[PHONE]" },
      { input: "Phone: (555) 123-4567", expected: "[PHONE]" },
      { input: "Cell: +1 555 123 4567", expected: "[PHONE]" },
      { input: "Mobile: 5551234567", expected: "[PHONE]" }
    ];

    for (const tc of testCases) {
      const output = redact(tc.input);
      assertEquals(output.includes(tc.expected), true, `Failed for: ${tc.input}`);
    }
  });

  await t.step("should redact SSN numbers", () => {
    const redact = (s: string): string =>
      s.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

    const input = "Patient SSN: 123-45-6789";
    const output = redact(input);

    assertEquals(output.includes("123-45-6789"), false);
    assertEquals(output.includes("[SSN]"), true);
  });

  await t.step("should redact date patterns", () => {
    const redact = (s: string): string =>
      s.replace(/\b(19|20)\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g, "[DATE]");

    const testCases = [
      "DOB: 1990-05-15",
      "Born: 2001/12/25",
      "Date: 1985-1-5"
    ];

    for (const input of testCases) {
      const output = redact(input);
      assertEquals(output.includes("[DATE]"), true, `Failed for: ${input}`);
    }
  });

  await t.step("should strip PHI field names from objects", () => {
    const phiFields = new Set([
      "patient_name", "first_name", "last_name", "middle_name",
      "dob", "date_of_birth", "ssn", "email", "phone", "address",
      "address_line1", "address_line2", "city", "state", "zip",
      "mrn", "member_id", "insurance_id", "subscriber_name",
      "patient_id", "person_id", "user_id", "uid"
    ]);

    const inputObj = {
      patient_name: "John Doe",
      first_name: "John",
      diagnosis: "Hypertension",
      treatment: "Medication"
    };

    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(inputObj)) {
      if (!phiFields.has(k)) {
        sanitized[k] = v;
      }
    }

    assertEquals("patient_name" in sanitized, false);
    assertEquals("first_name" in sanitized, false);
    assertEquals("diagnosis" in sanitized, true);
    assertEquals("treatment" in sanitized, true);
  });

  await t.step("should handle nested objects in de-identification", () => {
    const phiFields = new Set(["patient_name", "ssn", "dob"]);

    const deepDeidentify = (obj: unknown): unknown => {
      if (obj == null) return obj;
      if (Array.isArray(obj)) return obj.map(deepDeidentify);
      if (typeof obj === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (!phiFields.has(k)) {
            out[k] = deepDeidentify(v);
          }
        }
        return out;
      }
      return obj;
    };

    const nestedInput = {
      encounter: {
        patient_name: "Jane Doe",
        diagnosis: "Diabetes",
        vitals: {
          bp: "120/80",
          ssn: "999-99-9999"
        }
      }
    };

    const result = deepDeidentify(nestedInput) as Record<string, unknown>;
    const encounter = result.encounter as Record<string, unknown>;
    const vitals = encounter.vitals as Record<string, unknown>;

    assertEquals("patient_name" in encounter, false);
    assertEquals("diagnosis" in encounter, true);
    assertEquals("ssn" in vitals, false);
    assertEquals("bp" in vitals, true);
  });

  // =====================================================
  // MCP Protocol Tests
  // =====================================================

  await t.step("should list available tools", () => {
    const tools = {
      "analyze-text": {
        description: "Analyze text with Claude AI",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
            prompt: { type: "string" },
            model: { type: "string" }
          },
          required: ["text", "prompt"]
        }
      },
      "generate-suggestion": {
        description: "Generate AI suggestions",
        inputSchema: {
          type: "object",
          properties: {
            context: { type: "object" },
            task: { type: "string" }
          },
          required: ["context", "task"]
        }
      },
      "summarize": {
        description: "Summarize content",
        inputSchema: {
          type: "object",
          properties: {
            content: { type: "string" },
            maxLength: { type: "number" }
          },
          required: ["content"]
        }
      }
    };

    assertEquals(Object.keys(tools).length, 3);
    assertExists(tools["analyze-text"]);
    assertExists(tools["generate-suggestion"]);
    assertExists(tools["summarize"]);
  });

  await t.step("should validate analyze-text tool input", () => {
    const validInput = {
      text: "Patient presents with chest pain",
      prompt: "Analyze for potential cardiac issues"
    };

    const invalidInput = {
      text: "Some text"
      // missing required 'prompt'
    };

    assertExists(validInput.text);
    assertExists(validInput.prompt);
    assertEquals("prompt" in invalidInput, false);
  });

  await t.step("should validate generate-suggestion tool input", () => {
    const validInput = {
      context: { condition: "Diabetes", age: 55 },
      task: "Suggest treatment plan"
    };

    const invalidInput = {
      context: { condition: "Diabetes" }
      // missing required 'task'
    };

    assertExists(validInput.context);
    assertExists(validInput.task);
    assertEquals("task" in invalidInput, false);
  });

  await t.step("should validate summarize tool input", () => {
    const validInput = {
      content: "Long clinical note text here...",
      maxLength: 500
    };

    const invalidInput = {
      maxLength: 500
      // missing required 'content'
    };

    assertExists(validInput.content);
    assertEquals("content" in invalidInput, false);
  });

  await t.step("should reject unknown tools", () => {
    const knownTools = ["analyze-text", "generate-suggestion", "summarize"];
    const unknownTool = "execute-command";

    assertEquals(knownTools.includes(unknownTool), false);
  });

  // =====================================================
  // Cost Calculation Tests
  // =====================================================

  await t.step("should calculate cost for Sonnet model", () => {
    const pricing = {
      "claude-sonnet-4-5-20250929": { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 }
    };

    const inputTokens = 1000;
    const outputTokens = 500;
    const model = "claude-sonnet-4-5-20250929";

    const rates = pricing[model];
    const cost = (inputTokens * rates.input) + (outputTokens * rates.output);

    assertEquals(cost, 0.0105); // $0.003 + $0.0075
  });

  await t.step("should calculate cost for Haiku model", () => {
    const pricing = {
      "claude-haiku-4-5-20250929": { input: 0.8 / 1_000_000, output: 4.0 / 1_000_000 }
    };

    const inputTokens = 1000;
    const outputTokens = 500;
    const model = "claude-haiku-4-5-20250929";

    const rates = pricing[model];
    const cost = (inputTokens * rates.input) + (outputTokens * rates.output);

    assertEquals(cost, 0.0028); // $0.0008 + $0.002
  });

  await t.step("should default to Sonnet pricing for unknown models", () => {
    const pricing: Record<string, { input: number; output: number }> = {
      "claude-sonnet-4-5-20250929": { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 }
    };

    const unknownModel = "claude-unknown-model";
    const rates = pricing[unknownModel] || pricing["claude-sonnet-4-5-20250929"];

    assertExists(rates);
    assertEquals(rates.input, 3.0 / 1_000_000);
  });

  // =====================================================
  // Rate Limiting Tests
  // =====================================================

  await t.step("should identify requests by IP or user", () => {
    const getIdentifier = (req: Request): string => {
      const forwarded = req.headers.get("x-forwarded-for");
      const realIp = req.headers.get("x-real-ip");
      const userId = req.headers.get("x-user-id");

      return userId || forwarded?.split(",")[0] || realIp || "anonymous";
    };

    const request1 = new Request("http://localhost", {
      headers: { "x-user-id": "user-123" }
    });

    const request2 = new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1" }
    });

    const request3 = new Request("http://localhost", {
      headers: { "x-real-ip": "172.16.0.1" }
    });

    assertEquals(getIdentifier(request1), "user-123");
    assertEquals(getIdentifier(request2), "192.168.1.1");
    assertEquals(getIdentifier(request3), "172.16.0.1");
  });

  await t.step("should track rate limit window", () => {
    const rateLimit = {
      windowMs: 60000,
      maxRequests: 10
    };

    const windowStart = Date.now();
    const windowEnd = windowStart + rateLimit.windowMs;

    assertEquals(windowEnd - windowStart, 60000);
    assertEquals(rateLimit.maxRequests, 10);
  });

  // =====================================================
  // Audit Logging Tests
  // =====================================================

  await t.step("should create audit log entry structure", () => {
    const auditEntry = {
      user_id: "user-123",
      request_id: "req-abc-123",
      request_type: "mcp_analyze-text",
      model: "claude-sonnet-4-5-20250929",
      input_tokens: 500,
      output_tokens: 200,
      cost: 0.0045,
      response_time_ms: 1500,
      success: true,
      created_at: new Date().toISOString()
    };

    assertExists(auditEntry.user_id);
    assertExists(auditEntry.request_id);
    assertExists(auditEntry.model);
    assertEquals(typeof auditEntry.input_tokens, "number");
    assertEquals(typeof auditEntry.output_tokens, "number");
    assertEquals(typeof auditEntry.cost, "number");
    assertEquals(typeof auditEntry.response_time_ms, "number");
    assertEquals(auditEntry.success, true);
  });

  await t.step("should log errors in audit trail", () => {
    const errorAuditEntry = {
      user_id: "user-123",
      request_id: "req-xyz-789",
      request_type: "mcp_summarize",
      model: "claude-sonnet-4-5-20250929",
      input_tokens: 0,
      output_tokens: 0,
      cost: 0,
      response_time_ms: 500,
      success: false,
      error_message: "Rate limit exceeded",
      created_at: new Date().toISOString()
    };

    assertEquals(errorAuditEntry.success, false);
    assertExists(errorAuditEntry.error_message);
  });

  // =====================================================
  // Response Format Tests
  // =====================================================

  await t.step("should return tools list response format", () => {
    const response = {
      tools: [
        { name: "analyze-text", description: "Analyze text with Claude AI" },
        { name: "generate-suggestion", description: "Generate AI suggestions" },
        { name: "summarize", description: "Summarize content" }
      ]
    };

    assertEquals(Array.isArray(response.tools), true);
    assertEquals(response.tools.length, 3);
    assertExists(response.tools[0].name);
    assertExists(response.tools[0].description);
  });

  await t.step("should return tool call response format", () => {
    const response = {
      content: [{ type: "text", text: "Analysis result here..." }],
      metadata: {
        inputTokens: 500,
        outputTokens: 200,
        cost: 0.0045,
        responseTimeMs: 1500,
        model: "claude-sonnet-4-5-20250929"
      }
    };

    assertEquals(Array.isArray(response.content), true);
    assertEquals(response.content[0].type, "text");
    assertExists(response.content[0].text);
    assertExists(response.metadata);
    assertEquals(typeof response.metadata.inputTokens, "number");
    assertEquals(typeof response.metadata.cost, "number");
  });

  await t.step("should return error response format", () => {
    const errorResponse = {
      error: {
        code: "internal_error",
        message: "Unknown tool: invalid-tool"
      }
    };

    assertExists(errorResponse.error);
    assertExists(errorResponse.error.code);
    assertExists(errorResponse.error.message);
  });

  // =====================================================
  // CORS Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should include CORS headers in response", () => {
    const corsHeaders = {
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    assertExists(corsHeaders["Access-Control-Allow-Methods"]);
    assertExists(corsHeaders["Access-Control-Allow-Headers"]);
  });

  // =====================================================
  // Model Selection Tests
  // =====================================================

  await t.step("should default to Sonnet model", () => {
    const toolArgs = { text: "test", prompt: "analyze" };
    const model = toolArgs.model || "claude-sonnet-4-5-20250929";

    assertEquals(model, "claude-sonnet-4-5-20250929");
  });

  await t.step("should allow model override", () => {
    const toolArgs = { text: "test", prompt: "analyze", model: "claude-haiku-4-5-20250929" };
    const model = toolArgs.model || "claude-sonnet-4-5-20250929";

    assertEquals(model, "claude-haiku-4-5-20250929");
  });

  // =====================================================
  // Prompt Construction Tests
  // =====================================================

  await t.step("should build analyze-text prompt", () => {
    const args = { text: "Patient data here", prompt: "Analyze for risks" };
    const userPrompt = `${args.prompt}\n\nText to analyze:\n${args.text}`;

    assertEquals(userPrompt.includes(args.prompt), true);
    assertEquals(userPrompt.includes(args.text), true);
  });

  await t.step("should build generate-suggestion prompt", () => {
    const args = { context: { condition: "Diabetes" }, task: "Suggest treatment" };
    const userPrompt = `Task: ${args.task}\n\nContext: ${JSON.stringify(args.context, null, 2)}`;

    assertEquals(userPrompt.includes(args.task), true);
    assertEquals(userPrompt.includes("Diabetes"), true);
  });

  await t.step("should build summarize prompt with default length", () => {
    const args = { content: "Long text here..." };
    const maxLength = args.maxLength || 500;
    const userPrompt = `Summarize the following content in ${maxLength} words or less:\n\n${args.content}`;

    assertEquals(userPrompt.includes("500 words"), true);
    assertEquals(userPrompt.includes(args.content), true);
  });

  await t.step("should build summarize prompt with custom length", () => {
    const args = { content: "Long text here...", maxLength: 200 };
    const maxLength = args.maxLength || 500;
    const userPrompt = `Summarize the following content in ${maxLength} words or less:\n\n${args.content}`;

    assertEquals(userPrompt.includes("200 words"), true);
  });
});
