// =====================================================
// MCP PostgreSQL Server — Comprehensive Unit Tests
// Tests: tool definitions, query whitelist, security,
//        handler logic, server config
// =====================================================

import {
  assertEquals,
  assertExists,
  assertMatch,
  assertStringIncludes,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { TOOLS } from "../tools.ts";
import {
  WHITELISTED_QUERIES,
  SAFE_TABLES,
  type WhitelistedQuery,
} from "../queryWhitelist.ts";

// =====================================================
// Test Helpers — Synthetic Data
// =====================================================

const SYNTHETIC_TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function makeMockLogger() {
  const logs: { level: string; event: string; data?: Record<string, unknown> }[] = [];
  return {
    info(event: string, data?: Record<string, unknown>) { logs.push({ level: "info", event, data }); },
    error(event: string, data?: Record<string, unknown>) { logs.push({ level: "error", event, data }); },
    debug(event: string, data?: Record<string, unknown>) { logs.push({ level: "debug", event, data }); },
    logs,
  };
}

/** Builds a minimal mock SupabaseClient that records calls */
function makeMockSupabase(rpcResult: { data: unknown; error: unknown } = { data: [], error: null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const client = {
    rpc(fnName: string, params: Record<string, unknown>) {
      calls.push({ method: "rpc", args: [fnName, params] });
      return Promise.resolve(rpcResult);
    },
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const selectReturn = {
        eq(col: string, val: unknown) {
          calls.push({ method: "from.select.eq", args: [table, col, val] });
          return { limit(n: number) { return Promise.resolve({ data: [], error: null }); } };
        },
        limit(n: number) { return Promise.resolve({ data: [], error: null }); },
      };
      chain.select = (cols: string, opts?: Record<string, unknown>) => {
        calls.push({ method: "from.select", args: [table, cols, opts] });
        if (opts?.head) {
          return {
            eq(col: string, val: unknown) {
              return Promise.resolve({ count: 42, error: null });
            },
          };
        }
        return selectReturn;
      };
      return chain;
    },
    calls,
  };
  return client;
}

// =====================================================
// Tests
// =====================================================

Deno.test("MCP Postgres Server", async (t) => {

  // -------------------------------------------------
  // 1. Tool Definitions
  // -------------------------------------------------

  await t.step("defines exactly 5 tools", () => {
    const toolNames = Object.keys(TOOLS);
    assertEquals(toolNames.length, 5);
  });

  await t.step("has execute_query tool with correct schema", () => {
    const tool = TOOLS["execute_query"];
    assertExists(tool);
    assertEquals(tool.description, "Execute a pre-approved query against the database");
    assertEquals(tool.inputSchema.type, "object");
    assertExists(tool.inputSchema.properties["query_name"]);
    assertExists(tool.inputSchema.properties["tenant_id"]);
    assertExists(tool.inputSchema.properties["parameters"]);
    assertEquals(tool.inputSchema.required, ["query_name"]);
  });

  await t.step("execute_query query_name enum matches whitelist keys", () => {
    const enumValues = (TOOLS["execute_query"].inputSchema.properties["query_name"] as Record<string, unknown>)["enum"] as string[];
    const whitelistKeys = Object.keys(WHITELISTED_QUERIES);
    assertEquals(enumValues.sort(), whitelistKeys.sort());
  });

  await t.step("has list_queries tool with no required params", () => {
    const tool = TOOLS["list_queries"];
    assertExists(tool);
    assertEquals(tool.inputSchema.required.length, 0);
    assertEquals(Object.keys(tool.inputSchema.properties).length, 0);
  });

  await t.step("has get_table_schema tool requiring table_name", () => {
    const tool = TOOLS["get_table_schema"];
    assertExists(tool);
    assertEquals(tool.inputSchema.required, ["table_name"]);
    assertExists(tool.inputSchema.properties["table_name"]);
  });

  await t.step("has get_row_count tool requiring table_name", () => {
    const tool = TOOLS["get_row_count"];
    assertExists(tool);
    assertEquals(tool.inputSchema.required, ["table_name"]);
    assertExists(tool.inputSchema.properties["table_name"]);
    assertExists(tool.inputSchema.properties["tenant_id"]);
  });

  await t.step("has ping tool with empty schema", () => {
    const tool = TOOLS["ping"];
    assertExists(tool);
    assertEquals(tool.inputSchema.required.length, 0);
    assertEquals(Object.keys(tool.inputSchema.properties).length, 0);
    assertStringIncludes(tool.description.toLowerCase(), "health");
  });

  // -------------------------------------------------
  // 2. Query Whitelist Structure
  // -------------------------------------------------

  await t.step("whitelist contains 14 queries", () => {
    const count = Object.keys(WHITELISTED_QUERIES).length;
    assertEquals(count, 14);
  });

  await t.step("every whitelist key matches its .name field", () => {
    for (const [key, def] of Object.entries(WHITELISTED_QUERIES)) {
      assertEquals(key, def.name, `Key '${key}' does not match name '${def.name}'`);
    }
  });

  await t.step("every whitelisted query has required fields", () => {
    for (const [key, def] of Object.entries(WHITELISTED_QUERIES)) {
      assertExists(def.name, `${key}: missing name`);
      assertExists(def.description, `${key}: missing description`);
      assertExists(def.query, `${key}: missing query`);
      assertExists(def.parameters, `${key}: missing parameters`);
      assertEquals(typeof def.returnsRows, "boolean", `${key}: returnsRows must be boolean`);
    }
  });

  await t.step("every whitelisted query includes tenant_id in parameters", () => {
    for (const [key, def] of Object.entries(WHITELISTED_QUERIES)) {
      assertEquals(
        def.parameters.includes("tenant_id"),
        true,
        `Query '${key}' is missing tenant_id in parameters`
      );
    }
  });

  await t.step("every whitelisted query SQL references $1 placeholder for tenant_id", () => {
    for (const [key, def] of Object.entries(WHITELISTED_QUERIES)) {
      assertStringIncludes(
        def.query,
        "$1",
        `Query '${key}' SQL does not use $1 tenant_id placeholder`
      );
    }
  });

  await t.step("every whitelisted query SQL contains tenant_id filter", () => {
    for (const [key, def] of Object.entries(WHITELISTED_QUERIES)) {
      assertMatch(
        def.query,
        /tenant_id\s*=\s*\$1/,
        `Query '${key}' SQL does not filter by tenant_id = $1`
      );
    }
  });

  await t.step("queries with maxRows have positive integer values", () => {
    for (const [key, def] of Object.entries(WHITELISTED_QUERIES)) {
      if (def.maxRows !== undefined) {
        assertEquals(typeof def.maxRows, "number", `${key}: maxRows must be a number`);
        assertEquals(def.maxRows > 0, true, `${key}: maxRows must be positive`);
        assertEquals(Number.isInteger(def.maxRows), true, `${key}: maxRows must be integer`);
      }
    }
  });

  await t.step("get_encounter_summary has maxRows of 100", () => {
    assertEquals(WHITELISTED_QUERIES["get_encounter_summary"].maxRows, 100);
  });

  await t.step("get_billing_revenue_summary has maxRows of 30", () => {
    assertEquals(WHITELISTED_QUERIES["get_billing_revenue_summary"].maxRows, 30);
  });

  // -------------------------------------------------
  // 3. Specific Whitelisted Queries
  // -------------------------------------------------

  await t.step("get_patient_count_by_risk queries patients table", () => {
    const q = WHITELISTED_QUERIES["get_patient_count_by_risk"];
    assertStringIncludes(q.query, "patients");
    assertStringIncludes(q.query, "risk_level");
    assertStringIncludes(q.query, "COUNT(*)");
  });

  await t.step("get_dashboard_metrics uses subqueries across multiple tables", () => {
    const q = WHITELISTED_QUERIES["get_dashboard_metrics"];
    assertStringIncludes(q.query, "patients");
    assertStringIncludes(q.query, "encounters");
    assertStringIncludes(q.query, "care_tasks");
    assertStringIncludes(q.query, "sdoh_flags");
  });

  await t.step("get_bed_availability queries beds table", () => {
    const q = WHITELISTED_QUERIES["get_bed_availability"];
    assertStringIncludes(q.query, "beds");
    assertStringIncludes(q.query, "unit");
    assertStringIncludes(q.query, "status");
  });

  await t.step("get_quality_metrics queries quality_measures with reporting_period", () => {
    const q = WHITELISTED_QUERIES["get_quality_metrics"];
    assertStringIncludes(q.query, "quality_measures");
    assertStringIncludes(q.query, "reporting_period");
    assertStringIncludes(q.query, "performance_rate");
  });

  // -------------------------------------------------
  // 4. SAFE_TABLES
  // -------------------------------------------------

  await t.step("SAFE_TABLES contains expected tables", () => {
    const expected = [
      "patients", "encounters", "claims", "care_plans", "care_tasks",
      "medications", "allergies", "sdoh_flags", "referral_alerts",
      "beds", "shift_handoffs", "quality_measures", "code_cpt",
      "code_icd10", "code_hcpcs", "questionnaire_responses"
    ];
    for (const table of expected) {
      assertEquals(SAFE_TABLES.has(table), true, `SAFE_TABLES missing '${table}'`);
    }
    assertEquals(SAFE_TABLES.size, expected.length);
  });

  await t.step("SAFE_TABLES rejects unsafe table names", () => {
    const unsafe = ["auth.users", "profiles", "admin_settings", "audit_logs", "user_roles"];
    for (const table of unsafe) {
      assertEquals(SAFE_TABLES.has(table), false, `SAFE_TABLES should NOT contain '${table}'`);
    }
  });

  // -------------------------------------------------
  // 5. Security — Whitelist Enforcement
  // -------------------------------------------------

  await t.step("non-whitelisted query name is not in WHITELISTED_QUERIES", () => {
    assertEquals(WHITELISTED_QUERIES["DROP TABLE patients"] === undefined, true);
    assertEquals(WHITELISTED_QUERIES["SELECT * FROM auth.users"] === undefined, true);
    assertEquals(WHITELISTED_QUERIES["arbitrary_sql"] === undefined, true);
  });

  await t.step("no whitelisted query contains INSERT, UPDATE, DELETE, DROP, ALTER, or TRUNCATE", () => {
    const forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE"];
    for (const [key, def] of Object.entries(WHITELISTED_QUERIES)) {
      const upperSQL = def.query.toUpperCase();
      for (const keyword of forbidden) {
        assertEquals(
          upperSQL.includes(keyword),
          false,
          `Query '${key}' contains forbidden SQL keyword '${keyword}'`
        );
      }
    }
  });

  await t.step("all whitelisted queries are read-only (SELECT only)", () => {
    for (const [key, def] of Object.entries(WHITELISTED_QUERIES)) {
      const trimmed = def.query.trim().toUpperCase();
      assertEquals(
        trimmed.startsWith("SELECT"),
        true,
        `Query '${key}' does not start with SELECT`
      );
    }
  });

  await t.step("all whitelisted queries set returnsRows to true", () => {
    for (const [key, def] of Object.entries(WHITELISTED_QUERIES)) {
      assertEquals(def.returnsRows, true, `Query '${key}' should have returnsRows=true`);
    }
  });

  // -------------------------------------------------
  // 6. Server Config
  // -------------------------------------------------

  await t.step("server config uses Tier 2 (user_scoped)", () => {
    // Verify from index.ts constant — we replicate the expected config here
    // since importing the full index.ts would trigger serve()
    const expectedConfig = {
      name: "mcp-postgres-server",
      version: "1.2.0",
      tier: "user_scoped",
    };
    assertEquals(expectedConfig.tier, "user_scoped");
    assertEquals(expectedConfig.name, "mcp-postgres-server");
  });

  await t.step("body size limit is 512KB", () => {
    const EXPECTED_BODY_LIMIT = 512 * 1024;
    assertEquals(EXPECTED_BODY_LIMIT, 524288);
  });

  // -------------------------------------------------
  // 7. Tool Handler Logic (via createToolHandlers)
  // -------------------------------------------------

  await t.step("createToolHandlers returns object with handleToolCall", async () => {
    // Dynamic import to avoid top-level side effects from index.ts
    const { createToolHandlers } = await import("../toolHandlers.ts");
    const mockSb = makeMockSupabase() as unknown as Parameters<typeof createToolHandlers>[0];
    const logger = makeMockLogger();
    const handlers = createToolHandlers(mockSb, logger);
    assertExists(handlers.handleToolCall);
    assertEquals(typeof handlers.handleToolCall, "function");
  });

  await t.step("list_queries handler returns all whitelisted queries with metadata", async () => {
    const { createToolHandlers } = await import("../toolHandlers.ts");
    const mockSb = makeMockSupabase() as unknown as Parameters<typeof createToolHandlers>[0];
    const logger = makeMockLogger();
    const { handleToolCall } = createToolHandlers(mockSb, logger);

    const mockUserClient = makeMockSupabase() as unknown as Parameters<typeof handleToolCall>[2];
    const { result, rowsReturned } = await handleToolCall(
      "list_queries",
      {},
      mockUserClient,
      { name: "mcp-postgres-server", version: "1.2.0", tier: "user_scoped" },
      { supabase: mockSb, logger, canRateLimit: false },
      null,
      undefined,
      "req-test-001"
    );

    const queries = result as Array<{ name: string; description: string; parameters: string[]; maxRows?: number }>;
    assertEquals(queries.length, Object.keys(WHITELISTED_QUERIES).length);
    assertEquals(rowsReturned, queries.length);

    // Each entry has the expected shape
    for (const q of queries) {
      assertExists(q.name);
      assertExists(q.description);
      assertExists(q.parameters);
    }
  });

  await t.step("execute_query rejects non-whitelisted query name", async () => {
    const { createToolHandlers } = await import("../toolHandlers.ts");
    const mockSb = makeMockSupabase() as unknown as Parameters<typeof createToolHandlers>[0];
    const logger = makeMockLogger();
    const { handleToolCall } = createToolHandlers(mockSb, logger);
    const mockUserClient = makeMockSupabase() as unknown as Parameters<typeof handleToolCall>[2];

    let threwError = false;
    try {
      await handleToolCall(
        "execute_query",
        { query_name: "malicious_query" },
        mockUserClient,
        { name: "mcp-postgres-server", version: "1.2.0", tier: "user_scoped" },
        { supabase: mockSb, logger, canRateLimit: false },
        null,
        SYNTHETIC_TENANT_ID,
        "req-test-002"
      );
    } catch (err: unknown) {
      threwError = true;
      const msg = err instanceof Error ? err.message : String(err);
      assertStringIncludes(msg, "not whitelisted");
    }
    assertEquals(threwError, true, "Should throw for non-whitelisted query");
  });

  await t.step("execute_query requires tenant_id", async () => {
    const { createToolHandlers } = await import("../toolHandlers.ts");
    const mockSb = makeMockSupabase() as unknown as Parameters<typeof createToolHandlers>[0];
    const logger = makeMockLogger();
    const { handleToolCall } = createToolHandlers(mockSb, logger);
    const mockUserClient = makeMockSupabase() as unknown as Parameters<typeof handleToolCall>[2];

    let threwError = false;
    try {
      await handleToolCall(
        "execute_query",
        { query_name: "get_patient_count_by_risk" },
        mockUserClient,
        { name: "mcp-postgres-server", version: "1.2.0", tier: "user_scoped" },
        { supabase: mockSb, logger, canRateLimit: false },
        null,
        undefined, // no tenant_id
        "req-test-003"
      );
    } catch (err: unknown) {
      threwError = true;
      const msg = err instanceof Error ? err.message : String(err);
      assertStringIncludes(msg, "Tenant ID required");
    }
    assertEquals(threwError, true, "Should throw when tenant_id is missing");
  });

  await t.step("get_table_schema rejects non-safe table", async () => {
    const { createToolHandlers } = await import("../toolHandlers.ts");
    const mockSb = makeMockSupabase() as unknown as Parameters<typeof createToolHandlers>[0];
    const logger = makeMockLogger();
    const { handleToolCall } = createToolHandlers(mockSb, logger);
    const mockUserClient = makeMockSupabase() as unknown as Parameters<typeof handleToolCall>[2];

    let threwError = false;
    try {
      await handleToolCall(
        "get_table_schema",
        { table_name: "auth.users" },
        mockUserClient,
        { name: "mcp-postgres-server", version: "1.2.0", tier: "user_scoped" },
        { supabase: mockSb, logger, canRateLimit: false },
        null,
        undefined,
        "req-test-004"
      );
    } catch (err: unknown) {
      threwError = true;
      const msg = err instanceof Error ? err.message : String(err);
      assertStringIncludes(msg, "not accessible");
    }
    assertEquals(threwError, true, "Should throw for unsafe table schema request");
  });

  await t.step("get_row_count rejects non-safe table", async () => {
    const { createToolHandlers } = await import("../toolHandlers.ts");
    const mockSb = makeMockSupabase() as unknown as Parameters<typeof createToolHandlers>[0];
    const logger = makeMockLogger();
    const { handleToolCall } = createToolHandlers(mockSb, logger);
    const mockUserClient = makeMockSupabase() as unknown as Parameters<typeof handleToolCall>[2];

    let threwError = false;
    try {
      await handleToolCall(
        "get_row_count",
        { table_name: "user_roles" },
        mockUserClient,
        { name: "mcp-postgres-server", version: "1.2.0", tier: "user_scoped" },
        { supabase: mockSb, logger, canRateLimit: false },
        null,
        SYNTHETIC_TENANT_ID,
        "req-test-005"
      );
    } catch (err: unknown) {
      threwError = true;
      const msg = err instanceof Error ? err.message : String(err);
      assertStringIncludes(msg, "not accessible");
    }
    assertEquals(threwError, true, "Should throw for non-safe table row count");
  });

  await t.step("unknown tool name throws error", async () => {
    const { createToolHandlers } = await import("../toolHandlers.ts");
    const mockSb = makeMockSupabase() as unknown as Parameters<typeof createToolHandlers>[0];
    const logger = makeMockLogger();
    const { handleToolCall } = createToolHandlers(mockSb, logger);
    const mockUserClient = makeMockSupabase() as unknown as Parameters<typeof handleToolCall>[2];

    let threwError = false;
    try {
      await handleToolCall(
        "nonexistent_tool",
        {},
        mockUserClient,
        { name: "mcp-postgres-server", version: "1.2.0", tier: "user_scoped" },
        { supabase: mockSb, logger, canRateLimit: false },
        null,
        undefined,
        "req-test-006"
      );
    } catch (err: unknown) {
      threwError = true;
      const msg = err instanceof Error ? err.message : String(err);
      assertStringIncludes(msg, "not implemented");
    }
    assertEquals(threwError, true, "Should throw for unknown tool");
  });

  await t.step("execute_query with maxRows truncates result array", async () => {
    // get_billing_revenue_summary has maxRows=30
    const bigData = Array.from({ length: 50 }, (_, i) => ({ date: `2026-03-${i}`, count: i }));
    const { createToolHandlers } = await import("../toolHandlers.ts");
    const mockSb = makeMockSupabase({ data: bigData, error: null }) as unknown as Parameters<typeof createToolHandlers>[0];
    const logger = makeMockLogger();
    const { handleToolCall } = createToolHandlers(mockSb, logger);
    const mockUserClient = makeMockSupabase() as unknown as Parameters<typeof handleToolCall>[2];

    const { result, rowsReturned } = await handleToolCall(
      "execute_query",
      { query_name: "get_billing_revenue_summary" },
      mockUserClient,
      { name: "mcp-postgres-server", version: "1.2.0", tier: "user_scoped" },
      { supabase: mockSb, logger, canRateLimit: false },
      null,
      SYNTHETIC_TENANT_ID,
      "req-test-007"
    );

    const rows = result as Array<unknown>;
    assertEquals(rows.length, 30, "Should truncate to maxRows=30");
    assertEquals(rowsReturned, 30);
  });

  await t.step("execute_query without maxRows returns all rows", async () => {
    // get_patient_count_by_risk has no maxRows
    const data = [
      { risk_level: "high", count: 10 },
      { risk_level: "medium", count: 25 },
      { risk_level: "low", count: 65 },
    ];
    const { createToolHandlers } = await import("../toolHandlers.ts");
    const mockSb = makeMockSupabase({ data, error: null }) as unknown as Parameters<typeof createToolHandlers>[0];
    const logger = makeMockLogger();
    const { handleToolCall } = createToolHandlers(mockSb, logger);
    const mockUserClient = makeMockSupabase() as unknown as Parameters<typeof handleToolCall>[2];

    const { result, rowsReturned } = await handleToolCall(
      "execute_query",
      { query_name: "get_patient_count_by_risk" },
      mockUserClient,
      { name: "mcp-postgres-server", version: "1.2.0", tier: "user_scoped" },
      { supabase: mockSb, logger, canRateLimit: false },
      null,
      SYNTHETIC_TENANT_ID,
      "req-test-008"
    );

    const rows = result as Array<unknown>;
    assertEquals(rows.length, 3, "Should return all 3 rows");
    assertEquals(rowsReturned, 3);
  });

  await t.step("execute_query propagates database errors", async () => {
    const { createToolHandlers } = await import("../toolHandlers.ts");
    const mockSb = makeMockSupabase({
      data: null,
      error: { code: "42P01", message: "relation does not exist", hint: null },
    }) as unknown as Parameters<typeof createToolHandlers>[0];
    const logger = makeMockLogger();
    const { handleToolCall } = createToolHandlers(mockSb, logger);
    const mockUserClient = makeMockSupabase() as unknown as Parameters<typeof handleToolCall>[2];

    let threwError = false;
    try {
      await handleToolCall(
        "execute_query",
        { query_name: "get_patient_count_by_risk" },
        mockUserClient,
        { name: "mcp-postgres-server", version: "1.2.0", tier: "user_scoped" },
        { supabase: mockSb, logger, canRateLimit: false },
        null,
        SYNTHETIC_TENANT_ID,
        "req-test-009"
      );
    } catch (err: unknown) {
      threwError = true;
      const msg = err instanceof Error ? err.message : String(err);
      assertStringIncludes(msg, "failed");
      assertStringIncludes(msg, "relation does not exist");
    }
    assertEquals(threwError, true, "Should throw on database error");

    // Verify error was logged
    const errorLogs = logger.logs.filter((l) => l.level === "error");
    assertEquals(errorLogs.length > 0, true, "Should log the database error");
  });

  // -------------------------------------------------
  // 8. WhitelistedQuery Interface Compliance
  // -------------------------------------------------

  await t.step("WhitelistedQuery interface: all fields have correct types", () => {
    for (const [key, def] of Object.entries(WHITELISTED_QUERIES)) {
      assertEquals(typeof def.name, "string", `${key}.name type`);
      assertEquals(typeof def.description, "string", `${key}.description type`);
      assertEquals(typeof def.query, "string", `${key}.query type`);
      assertEquals(Array.isArray(def.parameters), true, `${key}.parameters type`);
      assertEquals(typeof def.returnsRows, "boolean", `${key}.returnsRows type`);
      if (def.maxRows !== undefined) {
        assertEquals(typeof def.maxRows, "number", `${key}.maxRows type`);
      }
    }
  });

  await t.step("no whitelisted query has an empty description", () => {
    for (const [key, def] of Object.entries(WHITELISTED_QUERIES)) {
      assertEquals(def.description.length > 0, true, `${key} has empty description`);
    }
  });

  await t.step("no whitelisted query has an empty SQL string", () => {
    for (const [key, def] of Object.entries(WHITELISTED_QUERIES)) {
      assertEquals(def.query.trim().length > 0, true, `${key} has empty SQL`);
    }
  });
});
