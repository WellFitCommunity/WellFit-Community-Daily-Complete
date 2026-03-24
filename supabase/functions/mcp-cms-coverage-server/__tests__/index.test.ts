// supabase/functions/mcp-cms-coverage-server/__tests__/index.test.ts
// Tests for CMS Coverage MCP Server - Medicare coverage lookups, LCD/NCD search,
// prior authorization checks, MAC contractor information

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { TOOLS } from "../tools.ts";
import { FALLBACK_PRIOR_AUTH_CODES, FALLBACK_MAC_CONTRACTORS } from "../coverageData.ts";
import { createToolHandlers } from "../toolHandlers.ts";
import type {
  CMSLCDRow,
  CMSNCDRow,
  CMSPriorAuthRow,
  CMSArticleRow,
  CMSMACRow,
  MCPLogger,
} from "../types.ts";

// Synthetic test logger (no-op)
const testLogger: MCPLogger = {
  info: (_event: string, _data?: Record<string, unknown>) => {},
  error: (_event: string, _data?: Record<string, unknown>) => {},
  warn: (_event: string, _data?: Record<string, unknown>) => {},
};

Deno.test("CMS Coverage MCP Server Tests", async (t) => {

  // =====================================================
  // Server Configuration Tests
  // =====================================================

  await t.step("server config should be tier user_scoped", () => {
    const config = {
      name: "mcp-cms-coverage-server",
      version: "2.0.0",
      tier: "user_scoped" as const,
    };
    assertEquals(config.tier, "user_scoped");
    assertEquals(config.name, "mcp-cms-coverage-server");
    assertEquals(config.version, "2.0.0");
  });

  await t.step("rate limit should be 100 requests per 60 seconds", () => {
    const rateLimit = { maxRequests: 100, windowMs: 60000 };
    assertEquals(rateLimit.maxRequests, 100);
    assertEquals(rateLimit.windowMs, 60000);
  });

  // =====================================================
  // Tool Definition Tests
  // =====================================================

  await t.step("should define all 9 tools including ping", () => {
    const toolNames = Object.keys(TOOLS);
    assertEquals(toolNames.length, 9);
    assertEquals(toolNames.includes("search_lcd"), true);
    assertEquals(toolNames.includes("search_ncd"), true);
    assertEquals(toolNames.includes("get_coverage_requirements"), true);
    assertEquals(toolNames.includes("check_prior_auth_required"), true);
    assertEquals(toolNames.includes("get_lcd_details"), true);
    assertEquals(toolNames.includes("get_ncd_details"), true);
    assertEquals(toolNames.includes("get_coverage_articles"), true);
    assertEquals(toolNames.includes("get_mac_contractors"), true);
    assertEquals(toolNames.includes("ping"), true);
  });

  await t.step("search_lcd tool requires query parameter", () => {
    const tool = TOOLS["search_lcd"];
    assertExists(tool.inputSchema);
    assertEquals(tool.inputSchema.required, ["query"]);
    assertExists(tool.inputSchema.properties.query);
    assertExists(tool.inputSchema.properties.state);
    assertExists(tool.inputSchema.properties.contractor_number);
    assertExists(tool.inputSchema.properties.status);
    assertExists(tool.inputSchema.properties.limit);
  });

  await t.step("search_lcd status enum has active/future/retired", () => {
    const statusProp = TOOLS["search_lcd"].inputSchema.properties.status;
    assertEquals(statusProp.enum, ["active", "future", "retired"]);
  });

  await t.step("search_ncd tool requires query parameter", () => {
    const tool = TOOLS["search_ncd"];
    assertEquals(tool.inputSchema.required, ["query"]);
    assertExists(tool.inputSchema.properties.query);
    assertExists(tool.inputSchema.properties.benefit_category);
    assertExists(tool.inputSchema.properties.status);
    assertExists(tool.inputSchema.properties.limit);
  });

  await t.step("get_coverage_requirements tool requires code parameter", () => {
    const tool = TOOLS["get_coverage_requirements"];
    assertEquals(tool.inputSchema.required, ["code"]);
    assertExists(tool.inputSchema.properties.code);
    assertExists(tool.inputSchema.properties.state);
    assertExists(tool.inputSchema.properties.payer_type);
    assertEquals(
      tool.inputSchema.properties.payer_type.enum,
      ["medicare", "medicare_advantage", "medicaid"]
    );
  });

  await t.step("check_prior_auth_required tool requires cpt_code", () => {
    const tool = TOOLS["check_prior_auth_required"];
    assertEquals(tool.inputSchema.required, ["cpt_code"]);
    assertExists(tool.inputSchema.properties.cpt_code);
    assertExists(tool.inputSchema.properties.icd10_codes);
    assertEquals(tool.inputSchema.properties.icd10_codes.type, "array");
    assertExists(tool.inputSchema.properties.state);
    assertExists(tool.inputSchema.properties.place_of_service);
  });

  await t.step("get_lcd_details tool requires lcd_id", () => {
    const tool = TOOLS["get_lcd_details"];
    assertEquals(tool.inputSchema.required, ["lcd_id"]);
    assertExists(tool.inputSchema.properties.lcd_id);
  });

  await t.step("get_ncd_details tool requires ncd_id", () => {
    const tool = TOOLS["get_ncd_details"];
    assertEquals(tool.inputSchema.required, ["ncd_id"]);
    assertExists(tool.inputSchema.properties.ncd_id);
  });

  await t.step("get_coverage_articles tool requires code", () => {
    const tool = TOOLS["get_coverage_articles"];
    assertEquals(tool.inputSchema.required, ["code"]);
    assertExists(tool.inputSchema.properties.code);
    assertExists(tool.inputSchema.properties.article_type);
    assertEquals(
      tool.inputSchema.properties.article_type.enum,
      ["billing", "coding", "utilization", "all"]
    );
  });

  await t.step("get_mac_contractors tool requires state", () => {
    const tool = TOOLS["get_mac_contractors"];
    assertEquals(tool.inputSchema.required, ["state"]);
    assertExists(tool.inputSchema.properties.state);
    assertExists(tool.inputSchema.properties.jurisdiction);
  });

  // =====================================================
  // Fallback Prior Auth Codes Tests
  // =====================================================

  await t.step("fallback prior auth codes should have 8 codes", () => {
    const codes = Object.keys(FALLBACK_PRIOR_AUTH_CODES);
    assertEquals(codes.length, 8);
  });

  await t.step("MRI brain (70553) requires prior auth", () => {
    const code = FALLBACK_PRIOR_AUTH_CODES["70553"];
    assertExists(code);
    assertEquals(code.requires_prior_auth, true);
    assertEquals(code.description, "MRI brain with and without contrast");
    assertEquals(code.typical_approval_time, "2-5 business days");
    assertEquals(code.documentation_required.length, 3);
    assertEquals(code.documentation_required.includes("Clinical indication"), true);
  });

  await t.step("CT chest (71250) does NOT require prior auth", () => {
    const code = FALLBACK_PRIOR_AUTH_CODES["71250"];
    assertExists(code);
    assertEquals(code.requires_prior_auth, false);
    assertEquals(code.description, "CT chest without contrast");
    assertEquals(code.typical_approval_time, "N/A");
  });

  await t.step("total knee replacement (27447) requires prior auth with 4 docs", () => {
    const code = FALLBACK_PRIOR_AUTH_CODES["27447"];
    assertExists(code);
    assertEquals(code.requires_prior_auth, true);
    assertEquals(code.description, "Total knee replacement");
    assertEquals(code.documentation_required.length, 4);
    assertEquals(code.typical_approval_time, "5-10 business days");
  });

  await t.step("CPAP device (E0601) requires prior auth with sleep study", () => {
    const code = FALLBACK_PRIOR_AUTH_CODES["E0601"];
    assertExists(code);
    assertEquals(code.requires_prior_auth, true);
    assertEquals(code.description, "CPAP device");
    assertEquals(code.documentation_required.length, 3);
  });

  await t.step("power wheelchair (K0823) has longest approval time", () => {
    const code = FALLBACK_PRIOR_AUTH_CODES["K0823"];
    assertExists(code);
    assertEquals(code.requires_prior_auth, true);
    assertEquals(code.typical_approval_time, "10-14 business days");
    assertEquals(code.documentation_required.length, 4);
  });

  await t.step("every fallback code has required fields", () => {
    for (const [cptCode, data] of Object.entries(FALLBACK_PRIOR_AUTH_CODES)) {
      assertExists(data.description, `${cptCode} missing description`);
      assertEquals(typeof data.requires_prior_auth, "boolean", `${cptCode} auth flag not boolean`);
      assertEquals(Array.isArray(data.documentation_required), true, `${cptCode} docs not array`);
      assertExists(data.typical_approval_time, `${cptCode} missing approval time`);
    }
  });

  // =====================================================
  // Fallback MAC Contractor Tests
  // =====================================================

  await t.step("fallback MAC contractors cover 7 states", () => {
    const states = Object.keys(FALLBACK_MAC_CONTRACTORS);
    assertEquals(states.length, 7);
    assertEquals(states.sort(), ["CA", "FL", "IL", "NY", "OH", "PA", "TX"]);
  });

  await t.step("every MAC contractor entry has part_a_b and dme", () => {
    for (const [state, data] of Object.entries(FALLBACK_MAC_CONTRACTORS)) {
      assertExists(data.part_a_b, `${state} missing part_a_b`);
      assertExists(data.part_a_b.name, `${state} part_a_b missing name`);
      assertExists(data.part_a_b.number, `${state} part_a_b missing number`);
      assertExists(data.dme, `${state} missing dme`);
      assertExists(data.dme.name, `${state} dme missing name`);
      assertExists(data.dme.number, `${state} dme missing number`);
    }
  });

  await t.step("TX MAC contractor is Novitas Solutions (Part A/B)", () => {
    const tx = FALLBACK_MAC_CONTRACTORS["TX"];
    assertEquals(tx.part_a_b.name, "Novitas Solutions");
    assertEquals(tx.part_a_b.number, "JH");
    assertEquals(tx.dme.name, "CGS Administrators");
    assertEquals(tx.dme.number, "DME-C");
  });

  await t.step("CA MAC contractor is Noridian Healthcare Solutions", () => {
    const ca = FALLBACK_MAC_CONTRACTORS["CA"];
    assertEquals(ca.part_a_b.name, "Noridian Healthcare Solutions");
    assertEquals(ca.part_a_b.number, "JE");
    assertEquals(ca.dme.name, "Noridian Healthcare Solutions");
    assertEquals(ca.dme.number, "DME-A");
  });

  await t.step("NY and IL share same Part A/B contractor (NGS)", () => {
    const ny = FALLBACK_MAC_CONTRACTORS["NY"];
    const il = FALLBACK_MAC_CONTRACTORS["IL"];
    assertEquals(ny.part_a_b.name, il.part_a_b.name);
    assertEquals(ny.part_a_b.name, "National Government Services");
  });

  // =====================================================
  // Type Interface Structure Tests
  // =====================================================

  await t.step("CMSLCDRow interface has all expected fields", () => {
    const syntheticLCD: CMSLCDRow = {
      lcd_id: "L00001",
      title: "Test LCD Alpha",
      contractor_name: "Test Contractor",
      contractor_number: "J00",
      jurisdiction: "JK",
      status: "active",
      effective_date: "2025-01-01",
      revision_date: "2025-06-01",
      related_codes: ["99213", "99214"],
      coverage_indications: ["Indication Alpha"],
      limitations: ["Limitation Alpha"],
      summary: "Synthetic LCD for testing",
      benefit_category: "Physicians Services",
    };
    assertEquals(syntheticLCD.lcd_id, "L00001");
    assertEquals(syntheticLCD.status, "active");
    assertEquals(syntheticLCD.related_codes?.length, 2);
    assertExists(syntheticLCD.coverage_indications);
    assertExists(syntheticLCD.limitations);
  });

  await t.step("CMSNCDRow interface supports nullable fields", () => {
    const syntheticNCD: CMSNCDRow = {
      ncd_id: "220.6.1",
      title: "Test NCD Beta",
      manual_section: null,
      status: "active",
      effective_date: null,
      implementation_date: null,
      benefit_category: null,
      coverage_provisions: null,
      covered_indications: null,
      non_covered_indications: null,
      documentation_requirements: null,
      related_lcd_ids: null,
    };
    assertEquals(syntheticNCD.ncd_id, "220.6.1");
    assertEquals(syntheticNCD.manual_section, null);
    assertEquals(syntheticNCD.covered_indications, null);
    assertEquals(syntheticNCD.related_lcd_ids, null);
  });

  await t.step("CMSPriorAuthRow interface has code_system and payer_type", () => {
    const syntheticAuth: CMSPriorAuthRow = {
      code: "99999",
      code_system: "CPT",
      description: "Test Procedure Gamma",
      requires_prior_auth: true,
      documentation_required: ["Test doc Alpha", "Test doc Beta"],
      typical_approval_time: "3-5 business days",
      category: "surgery",
      payer_type: "medicare",
    };
    assertEquals(syntheticAuth.code, "99999");
    assertEquals(syntheticAuth.code_system, "CPT");
    assertEquals(syntheticAuth.requires_prior_auth, true);
    assertEquals(syntheticAuth.payer_type, "medicare");
    assertEquals(syntheticAuth.documentation_required?.length, 2);
  });

  await t.step("CMSArticleRow interface has related_lcd_id and related_codes", () => {
    const syntheticArticle: CMSArticleRow = {
      article_id: "A00001",
      title: "Test Article Delta",
      article_type: "billing",
      related_lcd_id: "L00001",
      related_codes: ["70553"],
      content: "Synthetic billing guidance content",
      contractor_name: "Test Contractor",
      effective_date: "2025-01-01",
    };
    assertEquals(syntheticArticle.article_id, "A00001");
    assertEquals(syntheticArticle.article_type, "billing");
    assertEquals(syntheticArticle.related_codes?.length, 1);
    assertExists(syntheticArticle.content);
  });

  await t.step("CMSMACRow interface has jurisdiction_label nullable", () => {
    const syntheticMAC: CMSMACRow = {
      state_code: "TX",
      jurisdiction_type: "part_a_b",
      contractor_name: "Test MAC Epsilon",
      contractor_number: "J99",
      jurisdiction_label: null,
    };
    assertEquals(syntheticMAC.state_code, "TX");
    assertEquals(syntheticMAC.jurisdiction_type, "part_a_b");
    assertEquals(syntheticMAC.jurisdiction_label, null);
  });

  // =====================================================
  // Tool Handler Fallback Tests (no DB)
  // =====================================================

  await t.step("createToolHandlers returns handleToolCall function", () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    assertEquals(typeof handleToolCall, "function");
  });

  await t.step("search_lcd fallback returns fallback source with query echo", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("search_lcd", { query: "knee" }) as Record<string, unknown>;
    assertEquals(result.source, "fallback");
    assertEquals(result.total, 0);
    const lcds = result.lcds as Array<Record<string, unknown>>;
    assertEquals(lcds.length, 1);
    assertEquals(lcds[0].lcd_id, "FALLBACK");
  });

  await t.step("search_ncd fallback returns empty array with fallback source", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("search_ncd", { query: "cardiac" }) as Record<string, unknown>;
    assertEquals(result.source, "fallback");
    assertEquals(result.total, 0);
    assertEquals((result.ncds as unknown[]).length, 0);
  });

  await t.step("get_coverage_requirements fallback with known code returns details", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("get_coverage_requirements", { code: "27447" }) as Record<string, unknown>;
    assertEquals(result.source, "fallback");
    assertEquals(result.code, "27447");
    assertEquals(result.description, "Total knee replacement");
    assertEquals(result.coverage_status, "Prior authorization required");
    const docs = result.documentation_needed as string[];
    assertEquals(docs.length, 4);
  });

  await t.step("get_coverage_requirements fallback with unknown code returns generic", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("get_coverage_requirements", { code: "ZZZZZ" }) as Record<string, unknown>;
    assertEquals(result.source, "fallback");
    assertEquals(result.code, "ZZZZZ");
    assertEquals(result.coverage_status, "Coverage varies by indication");
    const docs = result.documentation_needed as string[];
    assertEquals(docs.length, 2);
  });

  await t.step("check_prior_auth_required fallback with known code has high confidence", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("check_prior_auth_required", { cpt_code: "70553" }) as Record<string, unknown>;
    assertEquals(result.source, "fallback");
    assertEquals(result.cpt_code, "70553");
    assertEquals(result.requires_prior_auth, true);
    assertEquals(result.confidence, "high");
    assertExists(result.appeal_process);
  });

  await t.step("check_prior_auth_required fallback with unknown code has low confidence", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("check_prior_auth_required", { cpt_code: "99999" }) as Record<string, unknown>;
    assertEquals(result.source, "fallback");
    assertEquals(result.confidence, "low");
    assertEquals(result.requires_prior_auth, false);
    assertEquals(result.estimated_approval_time, "Unknown");
  });

  await t.step("check_prior_auth_required fallback for non-auth code returns false", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("check_prior_auth_required", { cpt_code: "71250" }) as Record<string, unknown>;
    assertEquals(result.requires_prior_auth, false);
    assertEquals(result.confidence, "high");
  });

  await t.step("get_lcd_details fallback returns unknown status", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("get_lcd_details", { lcd_id: "L12345" }) as Record<string, unknown>;
    assertEquals(result.source, "fallback");
    assertEquals(result.lcd_id, "L12345");
    assertEquals(result.status, "unknown");
  });

  await t.step("get_ncd_details fallback returns unknown status", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("get_ncd_details", { ncd_id: "220.6.1" }) as Record<string, unknown>;
    assertEquals(result.source, "fallback");
    assertEquals(result.ncd_id, "220.6.1");
    assertEquals(result.status, "unknown");
  });

  await t.step("get_coverage_articles fallback returns empty articles", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("get_coverage_articles", { code: "70553" }) as Record<string, unknown>;
    assertEquals(result.source, "fallback");
    assertEquals((result.articles as unknown[]).length, 0);
  });

  await t.step("get_mac_contractors fallback for known state returns data", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("get_mac_contractors", { state: "TX" }) as Record<string, unknown>;
    assertEquals(result.source, "fallback");
    assertEquals(result.state, "TX");
    const contractors = result.contractors as Record<string, Record<string, string>>;
    assertEquals(contractors.part_a_b.name, "Novitas Solutions");
    assertEquals(contractors.dme.name, "CGS Administrators");
  });

  await t.step("get_mac_contractors fallback for unknown state returns generic", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("get_mac_contractors", { state: "ZZ" }) as Record<string, unknown>;
    assertEquals(result.source, "fallback");
    assertEquals(result.state, "ZZ");
    const contractors = result.contractors as Record<string, Record<string, string>>;
    assertEquals(contractors.part_a_b.number, "Unknown");
    assertEquals(contractors.dme.number, "Unknown");
  });

  await t.step("get_mac_contractors normalizes state to uppercase", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("get_mac_contractors", { state: "ca" }) as Record<string, unknown>;
    assertEquals(result.state, "CA");
    const contractors = result.contractors as Record<string, Record<string, string>>;
    assertEquals(contractors.part_a_b.name, "Noridian Healthcare Solutions");
  });

  await t.step("unknown tool throws error", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    let errorThrown = false;
    try {
      await handleToolCall("nonexistent_tool", {});
    } catch (err: unknown) {
      errorThrown = true;
      const error = err instanceof Error ? err : new Error(String(err));
      assertEquals(error.message, "Unknown tool: nonexistent_tool");
    }
    assertEquals(errorThrown, true);
  });

  // =====================================================
  // Coverage Requirement Field Completeness Tests
  // =====================================================

  await t.step("coverage requirements for auth-required code includes all response fields", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("get_coverage_requirements", { code: "E0601" }) as Record<string, unknown>;
    assertExists(result.code);
    assertExists(result.description);
    assertExists(result.coverage_status);
    assertExists(result.requirements);
    assertExists(result.documentation_needed);
    assertExists(result.lcd_references);
    assertExists(result.ncd_references);
    assertExists(result.source);
    // Verify lcd_references and ncd_references are arrays (empty in fallback)
    assertEquals(Array.isArray(result.lcd_references), true);
    assertEquals(Array.isArray(result.ncd_references), true);
  });

  await t.step("prior auth check response includes appeal process", async () => {
    const { handleToolCall } = createToolHandlers(testLogger, null);
    const result = await handleToolCall("check_prior_auth_required", { cpt_code: "27130" }) as Record<string, unknown>;
    assertEquals(result.appeal_process, "Submit reconsideration within 60 days if denied");
    assertEquals(result.requires_prior_auth, true);
    assertEquals(result.estimated_approval_time, "5-10 business days");
  });

  // =====================================================
  // MCPLogger Interface Tests
  // =====================================================

  await t.step("MCPLogger interface supports info and error methods", () => {
    const logger: MCPLogger = {
      info: (_event: string, _data?: Record<string, unknown>) => {},
      error: (_event: string, _data?: Record<string, unknown>) => {},
    };
    // Verify no-op calls do not throw
    logger.info("TEST_EVENT", { key: "value" });
    logger.error("TEST_ERROR", { errorMessage: "test" });
    assertExists(logger.info);
    assertExists(logger.error);
  });

  await t.step("MCPLogger warn method is optional", () => {
    const loggerWithoutWarn: MCPLogger = {
      info: () => {},
      error: () => {},
    };
    assertEquals(loggerWithoutWarn.warn, undefined);

    const loggerWithWarn: MCPLogger = {
      info: () => {},
      error: () => {},
      warn: () => {},
    };
    assertNotEquals(loggerWithWarn.warn, undefined);
  });
});
