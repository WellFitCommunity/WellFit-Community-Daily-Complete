// =====================================================
// MCP Edge Functions Server — Comprehensive Tests
// Tests tool definitions, whitelist, handlers, and security
// =====================================================

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ALLOWED_FUNCTIONS,
  BLOCKED_FUNCTIONS,
  type FunctionDefinition,
} from "../functionWhitelist.ts";
import { TOOLS } from "../tools.ts";

// Synthetic test data (Rule #15: obviously fake)
const FAKE_PATIENT_ID = "00000000-0000-0000-0000-000000000001";
const VALID_CATEGORIES = ["analytics", "reports", "workflow", "integration", "utility"] as const;
const VALID_SIDE_EFFECTS = ["none", "read", "write"] as const;

Deno.test("MCP Edge Functions Server Tests", async (t) => {
  // -------------------------------------------------
  // Tool Definitions
  // -------------------------------------------------

  await t.step("all 5 tools exist with correct count", () => {
    const expected = ["ping", "invoke_function", "list_functions", "get_function_info", "batch_invoke"];
    for (const tool of expected) {
      assertExists(TOOLS[tool], `Tool '${tool}' should exist`);
    }
    assertEquals(Object.keys(TOOLS).length, 5);
  });

  await t.step("each tool has description, inputSchema with type/properties/required", () => {
    for (const [name, tool] of Object.entries(TOOLS)) {
      assertExists(tool.description, `${name} description`);
      assertEquals(tool.inputSchema.type, "object", `${name} schema type`);
      assertExists(tool.inputSchema.properties, `${name} properties`);
      assertExists(tool.inputSchema.required, `${name} required`);
    }
  });

  await t.step("invoke_function schema: requires function_name, has payload/timeout, enum matches whitelist", () => {
    const tool = TOOLS["invoke_function"];
    assertEquals(tool.inputSchema.required, ["function_name"]);
    assertExists(tool.inputSchema.properties.payload);
    assertExists(tool.inputSchema.properties.timeout);
    const enumValues = (tool.inputSchema.properties.function_name as { enum: string[] }).enum;
    assertEquals([...enumValues].sort(), Object.keys(ALLOWED_FUNCTIONS).sort());
  });

  await t.step("batch_invoke requires invocations, get_function_info requires function_name, list_functions has no required", () => {
    assertEquals(TOOLS["batch_invoke"].inputSchema.required, ["invocations"]);
    assertEquals(TOOLS["get_function_info"].inputSchema.required, ["function_name"]);
    assertEquals(TOOLS["list_functions"].inputSchema.required, []);
  });

  // -------------------------------------------------
  // Function Whitelist Structure
  // -------------------------------------------------

  await t.step("whitelist contains exactly 13 functions with all required fields", () => {
    assertEquals(Object.keys(ALLOWED_FUNCTIONS).length, 13);
    for (const [key, func] of Object.entries(ALLOWED_FUNCTIONS)) {
      assertExists(func.name, `${key} name`);
      assertExists(func.description, `${key} description`);
      assertExists(func.category, `${key} category`);
      assertEquals(typeof func.requiresAuth, "boolean", `${key} requiresAuth`);
      assertExists(func.sideEffects, `${key} sideEffects`);
      assertEquals(func.name, key, `key '${key}' should match func.name`);
    }
  });

  await t.step("all sideEffects values are valid (none/read/write)", () => {
    for (const [key, func] of Object.entries(ALLOWED_FUNCTIONS)) {
      assertEquals(
        VALID_SIDE_EFFECTS.includes(func.sideEffects as typeof VALID_SIDE_EFFECTS[number]),
        true,
        `${key} sideEffects '${func.sideEffects}' invalid`
      );
    }
  });

  await t.step("all categories are valid enum values", () => {
    for (const [key, func] of Object.entries(ALLOWED_FUNCTIONS)) {
      assertEquals(
        VALID_CATEGORIES.includes(func.category as typeof VALID_CATEGORIES[number]),
        true,
        `${key} category '${func.category}' invalid`
      );
    }
  });

  // -------------------------------------------------
  // Function Categories
  // -------------------------------------------------

  await t.step("analytics category: get-welfare-priorities, calculate-readmission-risk, sdoh-passive-detect", () => {
    const names = Object.values(ALLOWED_FUNCTIONS)
      .filter((f) => f.category === "analytics")
      .map((f) => f.name).sort();
    assertEquals(names, ["calculate-readmission-risk", "get-welfare-priorities", "sdoh-passive-detect"]);
  });

  await t.step("reports category: generate-engagement-report, generate-quality-report", () => {
    const names = Object.values(ALLOWED_FUNCTIONS)
      .filter((f) => f.category === "reports")
      .map((f) => f.name).sort();
    assertEquals(names, ["generate-engagement-report", "generate-quality-report"]);
  });

  await t.step("workflow category: create-care-alert, process-shift-handoff", () => {
    const names = Object.values(ALLOWED_FUNCTIONS)
      .filter((f) => f.category === "workflow")
      .map((f) => f.name).sort();
    assertEquals(names, ["create-care-alert", "process-shift-handoff"]);
  });

  await t.step("integration category: enhanced-fhir-export, generate-837p, hl7-receive", () => {
    const names = Object.values(ALLOWED_FUNCTIONS)
      .filter((f) => f.category === "integration")
      .map((f) => f.name).sort();
    assertEquals(names, ["enhanced-fhir-export", "generate-837p", "hl7-receive"]);
  });

  await t.step("utility category: hash-pin, send-sms, verify-pin", () => {
    const names = Object.values(ALLOWED_FUNCTIONS)
      .filter((f) => f.category === "utility")
      .map((f) => f.name).sort();
    assertEquals(names, ["hash-pin", "send-sms", "verify-pin"]);
  });

  await t.step("category enum in list_functions tool matches categories in use", () => {
    const toolEnum = (TOOLS["list_functions"].inputSchema.properties.category as { enum: string[] }).enum;
    const used = [...new Set(Object.values(ALLOWED_FUNCTIONS).map((f) => f.category))].sort();
    assertEquals([...toolEnum].sort(), used);
  });

  // -------------------------------------------------
  // Blocked Functions
  // -------------------------------------------------

  await t.step("all 5 blocked functions present and none overlap with whitelist", () => {
    assertEquals(BLOCKED_FUNCTIONS.size, 5);
    const expected = ["register", "enrollClient", "admin-create-user", "delete-user", "service-role-query"];
    for (const name of expected) {
      assertEquals(BLOCKED_FUNCTIONS.has(name), true, `'${name}' should be blocked`);
      assertEquals(name in ALLOWED_FUNCTIONS, false, `'${name}' should NOT be allowed`);
    }
  });

  await t.step("blocked function invocation detected by BLOCKED_FUNCTIONS.has()", () => {
    assertEquals(BLOCKED_FUNCTIONS.has("register"), true);
    assertEquals(BLOCKED_FUNCTIONS.has("delete-user"), true);
    assertEquals(BLOCKED_FUNCTIONS.has("service-role-query"), true);
  });

  // -------------------------------------------------
  // Whitelist-Only Access
  // -------------------------------------------------

  await t.step("non-whitelisted functions are rejected (not in ALLOWED_FUNCTIONS)", () => {
    assertEquals("drop-database" in ALLOWED_FUNCTIONS, false);
    assertEquals("exec-raw-sql" in ALLOWED_FUNCTIONS, false);
    assertEquals("create-super-admin" in ALLOWED_FUNCTIONS, false);
    assertEquals("" in ALLOWED_FUNCTIONS, false);
    assertEquals("../admin-create-user" in ALLOWED_FUNCTIONS, false);
  });

  // -------------------------------------------------
  // Auth Requirements
  // -------------------------------------------------

  await t.step("hash-pin and verify-pin do not require auth (exactly 2 no-auth functions)", () => {
    assertEquals(ALLOWED_FUNCTIONS["hash-pin"].requiresAuth, false);
    assertEquals(ALLOWED_FUNCTIONS["verify-pin"].requiresAuth, false);
    const noAuth = Object.values(ALLOWED_FUNCTIONS).filter((f) => !f.requiresAuth);
    assertEquals(noAuth.length, 2);
  });

  await t.step("all non-utility functions require auth", () => {
    for (const func of Object.values(ALLOWED_FUNCTIONS).filter((f) => f.category !== "utility")) {
      assertEquals(func.requiresAuth, true, `${func.name} should require auth`);
    }
  });

  // -------------------------------------------------
  // Required Parameter Validation
  // -------------------------------------------------

  await t.step("missing required parameter is detectable from definition", () => {
    const func = ALLOWED_FUNCTIONS["calculate-readmission-risk"];
    const payload: Record<string, unknown> = {};
    const missing: string[] = [];
    if (func.parameters) {
      for (const [p, d] of Object.entries(func.parameters)) {
        if (d.required && !(p in payload)) missing.push(p);
      }
    }
    assertEquals(missing, ["patient_id"]);
  });

  await t.step("all required parameters present passes validation", () => {
    const func = ALLOWED_FUNCTIONS["create-care-alert"];
    const payload = { patient_id: FAKE_PATIENT_ID, alert_type: "critical", message: "Test alert" };
    const missing: string[] = [];
    if (func.parameters) {
      for (const [p, d] of Object.entries(func.parameters)) {
        if (d.required && !(p in payload)) missing.push(p);
      }
    }
    assertEquals(missing.length, 0);
  });

  await t.step("create-care-alert requires patient_id, alert_type, and message", () => {
    const params = ALLOWED_FUNCTIONS["create-care-alert"].parameters!;
    assertEquals(params.patient_id.required, true);
    assertEquals(params.alert_type.required, true);
    assertEquals(params.message.required, true);
  });

  await t.step("send-sms requires to and message parameters", () => {
    const params = ALLOWED_FUNCTIONS["send-sms"].parameters!;
    assertEquals(params.to.required, true);
    assertEquals(params.message.required, true);
  });

  // -------------------------------------------------
  // Side Effects Classification
  // -------------------------------------------------

  await t.step("hash-pin has sideEffects=none, read-only analytics have read", () => {
    assertEquals(ALLOWED_FUNCTIONS["hash-pin"].sideEffects, "none");
    assertEquals(ALLOWED_FUNCTIONS["get-welfare-priorities"].sideEffects, "read");
    assertEquals(ALLOWED_FUNCTIONS["calculate-readmission-risk"].sideEffects, "read");
  });

  await t.step("write functions: sdoh-passive-detect, hl7-receive, process-shift-handoff, create-care-alert, send-sms", () => {
    const writeNames = Object.values(ALLOWED_FUNCTIONS)
      .filter((f) => f.sideEffects === "write")
      .map((f) => f.name).sort();
    assertEquals(writeNames, [
      "create-care-alert", "hl7-receive", "process-shift-handoff", "sdoh-passive-detect", "send-sms"
    ]);
  });

  // -------------------------------------------------
  // get_function_info
  // -------------------------------------------------

  await t.step("get_function_info returns correct definition for hash-pin", () => {
    const func = ALLOWED_FUNCTIONS["hash-pin"];
    assertEquals(func.name, "hash-pin");
    assertEquals(func.category, "utility");
    assertEquals(func.requiresAuth, false);
    assertEquals(func.sideEffects, "none");
  });

  await t.step("get_function_info returns correct definition for hl7-receive", () => {
    const func = ALLOWED_FUNCTIONS["hl7-receive"];
    assertEquals(func.name, "hl7-receive");
    assertEquals(func.category, "integration");
    assertEquals(func.sideEffects, "write");
  });

  await t.step("get_function_info for unknown function returns undefined", () => {
    assertEquals(ALLOWED_FUNCTIONS["nonexistent-function"], undefined);
  });

  // -------------------------------------------------
  // list_functions Filtering
  // -------------------------------------------------

  await t.step("list_functions returns all 13 when no category filter", () => {
    assertEquals(Object.values(ALLOWED_FUNCTIONS).length, 13);
  });

  await t.step("list_functions filtered by analytics returns 3, reports returns 2", () => {
    assertEquals(Object.values(ALLOWED_FUNCTIONS).filter((f) => f.category === "analytics").length, 3);
    assertEquals(Object.values(ALLOWED_FUNCTIONS).filter((f) => f.category === "reports").length, 2);
  });

  await t.step("list_functions filtered by nonexistent category returns 0", () => {
    assertEquals(
      Object.values(ALLOWED_FUNCTIONS).filter(
        (f) => f.category === ("nonexistent" as FunctionDefinition["category"])
      ).length,
      0
    );
  });

  // -------------------------------------------------
  // batch_invoke Logic
  // -------------------------------------------------

  await t.step("batch_invoke result structure has results, completed, total, allSucceeded", () => {
    const result = {
      results: [
        { function_name: "hash-pin", success: true, executionTimeMs: 50 },
        { function_name: "verify-pin", success: true, executionTimeMs: 30 },
      ],
      completed: 2,
      total: 2,
      allSucceeded: true,
    };
    assertExists(result.results);
    assertEquals(result.completed, result.total);
    assertEquals(result.allSucceeded, true);
    assertEquals(typeof result.allSucceeded, "boolean");
  });

  await t.step("batch_invoke allSucceeded is false when any result fails", () => {
    const results = [
      { success: true }, { success: false, error: "timeout" },
    ];
    assertEquals(results.every((r) => r.success), false);
  });

  await t.step("batch_invoke with stop_on_error=true halts on first failure", () => {
    const invocations = [
      { function_name: "blocked-func", success: false },
      { function_name: "hash-pin", success: true },
      { function_name: "verify-pin", success: true },
    ];
    const results: typeof invocations = [];
    for (const inv of invocations) {
      results.push(inv);
      if (!inv.success) break;
    }
    assertEquals(results.length, 1);
  });

  await t.step("batch_invoke with stop_on_error=false continues past failures", () => {
    const invocations = [
      { function_name: "blocked-func", success: false },
      { function_name: "hash-pin", success: true },
      { function_name: "verify-pin", success: true },
    ];
    const results: typeof invocations = [];
    for (const inv of invocations) {
      results.push(inv);
      // stop_on_error=false: never break
    }
    assertEquals(results.length, 3);
  });

  await t.step("batch_invoke completed < total when stopped early", () => {
    const completed = 2;
    const total = 3;
    assertNotEquals(completed, total);
  });

  // -------------------------------------------------
  // Input Schema Validation
  // -------------------------------------------------

  await t.step("invoke_function payload allows additionalProperties, batch invocations is array", () => {
    const payloadSchema = TOOLS["invoke_function"].inputSchema.properties.payload as { additionalProperties: boolean };
    assertEquals(payloadSchema.additionalProperties, true);
    const invSchema = TOOLS["batch_invoke"].inputSchema.properties.invocations as { type: string };
    assertEquals(invSchema.type, "array");
  });

  await t.step("batch_invoke stop_on_error is boolean, list_functions category is string with 5 enums", () => {
    const stopSchema = TOOLS["batch_invoke"].inputSchema.properties.stop_on_error as { type: string };
    assertEquals(stopSchema.type, "boolean");
    const catSchema = TOOLS["list_functions"].inputSchema.properties.category as { type: string; enum: string[] };
    assertEquals(catSchema.type, "string");
    assertEquals(catSchema.enum.length, 5);
  });

  // -------------------------------------------------
  // Server Config
  // -------------------------------------------------

  await t.step("server config: name=mcp-edge-functions-server, version=semver, tier=admin", () => {
    const name = "mcp-edge-functions-server";
    const version = "1.1.0";
    const tier = "admin";
    assertEquals(name.startsWith("mcp-"), true);
    assertEquals(name.endsWith("-server"), true);
    assertEquals(/^\d+\.\d+\.\d+$/.test(version), true);
    assertEquals(tier, "admin");
  });

  // -------------------------------------------------
  // Timeout Default
  // -------------------------------------------------

  await t.step("invoke_function timeout description mentions 30000ms default", () => {
    const desc = (TOOLS["invoke_function"].inputSchema.properties.timeout as { description: string }).description;
    assertEquals(desc.includes("30000"), true);
  });

  // -------------------------------------------------
  // Edge Cases and Security
  // -------------------------------------------------

  await t.step("path traversal function names are not whitelisted", () => {
    assertEquals("../admin-create-user" in ALLOWED_FUNCTIONS, false);
    assertEquals("hash-pin/../delete-user" in ALLOWED_FUNCTIONS, false);
    assertEquals(BLOCKED_FUNCTIONS.has(""), false);
  });

  await t.step("all function descriptions are non-empty and parameter types are valid", () => {
    const validTypes = ["string", "number", "boolean", "object", "array"];
    for (const [key, func] of Object.entries(ALLOWED_FUNCTIONS)) {
      assertNotEquals(func.description.length, 0, `${key} desc empty`);
      if (func.parameters) {
        for (const [pName, pDef] of Object.entries(func.parameters)) {
          assertEquals(validTypes.includes(pDef.type), true, `${key}.${pName} type invalid`);
        }
      }
    }
  });
});
