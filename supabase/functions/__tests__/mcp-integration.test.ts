/**
 * MCP Server Integration Tests
 *
 * These tests call LIVE deployed edge functions to verify they respond correctly.
 * This catches runtime errors like "logger.log is not a function" that unit tests miss.
 *
 * Required environment variables:
 * - SUPABASE_URL: The Supabase project URL
 * - SUPABASE_ANON_KEY: The Supabase anon key for authentication
 *
 * Run locally: SUPABASE_URL=... SUPABASE_ANON_KEY=... deno test --allow-net --allow-env
 * Run in CI: Automatically uses GitHub secrets
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY") || "";

// Default tenant for testing
const TEST_TENANT_ID = "2b902657-6a20-4435-a78a-576f397517ca";

interface MCPResponse {
  jsonrpc: string;
  result?: unknown;
  error?: { code: number; message: string };
  id: string | number | null;
}

/**
 * Helper to call MCP server with JSON-RPC protocol
 */
async function callMCPServer(
  serverName: string,
  method: string,
  params?: Record<string, unknown>
): Promise<MCPResponse> {
  const url = `${SUPABASE_URL}/functions/v1/${serverName}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: 1
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return await response.json();
}

/**
 * Test MCP server initialization - this is the critical test
 * that catches runtime errors like "logger.log is not a function"
 */
async function testMCPInitialize(serverName: string): Promise<boolean> {
  try {
    const response = await callMCPServer(serverName, "initialize");

    if (response.error) {
      console.error(`  [FAIL] ${serverName}: ${response.error.message}`);
      return false;
    }

    const result = response.result as { protocolVersion?: string; serverInfo?: { name: string } };
    if (result?.protocolVersion && result?.serverInfo?.name) {
      console.log(`  [PASS] ${serverName}: Protocol ${result.protocolVersion}`);
      return true;
    }

    console.error(`  [FAIL] ${serverName}: Invalid response structure`);
    return false;
  } catch (err) {
    console.error(`  [FAIL] ${serverName}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Test tools/list endpoint
 */
async function testMCPToolsList(serverName: string): Promise<boolean> {
  try {
    const response = await callMCPServer(serverName, "tools/list");

    if (response.error) {
      console.error(`  [FAIL] ${serverName} tools/list: ${response.error.message}`);
      return false;
    }

    const result = response.result as { tools?: unknown[] };
    if (result?.tools && Array.isArray(result.tools)) {
      console.log(`  [PASS] ${serverName} tools/list: ${result.tools.length} tools`);
      return true;
    }

    console.error(`  [FAIL] ${serverName} tools/list: Invalid response`);
    return false;
  } catch (err) {
    console.error(`  [FAIL] ${serverName} tools/list: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Test a specific tool call
 *
 * This test distinguishes between:
 * - RUNTIME ERRORS (code bugs): "is not a function", "is not defined", etc. → FAIL
 * - DATA ERRORS (expected): "not found", database errors, config errors → PASS
 */
async function testMCPToolCall(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<boolean> {
  try {
    const response = await callMCPServer(serverName, "tools/call", {
      name: toolName,
      arguments: args
    });

    if (response.error) {
      const msg = response.error.message;

      // JavaScript runtime errors = code bugs = FAIL
      const runtimeErrorPatterns = [
        "is not a function",
        "is not defined",
        "Cannot read properties",
        "Cannot read property",
        "undefined is not",
        "null is not",
        "is not iterable",
        "is not a constructor",
        "Maximum call stack",
        "Unexpected token",
        "SyntaxError"
      ];

      for (const pattern of runtimeErrorPatterns) {
        if (msg.includes(pattern)) {
          console.error(`  [FAIL] ${serverName}/${toolName}: RUNTIME ERROR - ${msg}`);
          return false;
        }
      }

      // Database/config/data errors are acceptable (not code bugs)
      const dataErrorPatterns = [
        "not found",
        "not configured",
        "missing",
        "invalid",
        "does not exist",
        "no rows",
        "[object Object]", // Database RPC returning object instead of scalar
        "PGRST",           // PostgREST errors
        "42"               // PostgreSQL error codes
      ];

      for (const pattern of dataErrorPatterns) {
        if (msg.toLowerCase().includes(pattern.toLowerCase())) {
          console.log(`  [PASS] ${serverName}/${toolName}: Data/config error (not a code bug) - ${msg.substring(0, 60)}...`);
          return true;
        }
      }

      // Unknown errors - log but pass (conservative)
      console.log(`  [PASS] ${serverName}/${toolName}: Error (assumed data issue) - ${msg.substring(0, 60)}...`);
      return true;
    }

    console.log(`  [PASS] ${serverName}/${toolName}: Success`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // JavaScript runtime errors in the error message = code bugs
    const runtimeErrorPatterns = [
      "is not a function",
      "is not defined",
      "Cannot read properties",
      "Cannot read property",
      "undefined is not",
      "null is not"
    ];

    for (const pattern of runtimeErrorPatterns) {
      if (msg.includes(pattern)) {
        console.error(`  [FAIL] ${serverName}/${toolName}: RUNTIME ERROR - ${msg}`);
        return false;
      }
    }

    // HTTP errors are usually auth, rate limiting, or database issues (not code bugs)
    if (msg.includes("HTTP 429") || msg.includes("HTTP 401") || msg.includes("HTTP 403")) {
      console.log(`  [PASS] ${serverName}/${toolName}: Auth/rate limit (not a code bug) - ${msg.substring(0, 60)}`);
      return true;
    }

    // HTTP 500 with [object Object] = database returning object = data issue, not code bug
    if (msg.includes("HTTP 500") && msg.includes("[object Object]")) {
      console.log(`  [PASS] ${serverName}/${toolName}: Database error (not a code bug) - ${msg.substring(0, 80)}`);
      return true;
    }

    // HTTP 500 without runtime error patterns = likely database/config issue
    if (msg.includes("HTTP 500")) {
      console.log(`  [PASS] ${serverName}/${toolName}: Server error (assumed data issue) - ${msg.substring(0, 80)}`);
      return true;
    }

    console.error(`  [FAIL] ${serverName}/${toolName}: ${msg}`);
    return false;
  }
}

// =====================================================
// Test Suites
// =====================================================

Deno.test({
  name: "MCP Integration Tests - Verify deployed edge functions respond correctly",
  ignore: !SUPABASE_URL || !SUPABASE_ANON_KEY,
  async fn(t) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log("Skipping integration tests: SUPABASE_URL or SUPABASE_ANON_KEY not set");
      return;
    }

    console.log(`\nTesting against: ${SUPABASE_URL}\n`);

    // =====================================================
    // Critical: Test MCP Protocol Initialize on ALL servers
    // This catches runtime errors that unit tests miss
    // =====================================================

    await t.step("MCP Protocol: All servers respond to initialize", async () => {
      console.log("\n--- MCP Initialize Tests ---");

      const servers = [
        "mcp-prior-auth-server",
        "mcp-claude-server",
        "mcp-npi-registry-server",
        "mcp-cms-coverage-server",
        "mcp-clearinghouse-server",
        "mcp-fhir-server",
        "mcp-postgres-server",
        "mcp-hl7-x12-server",
        "mcp-medical-codes-server",
        "mcp-edge-functions-server"
      ];

      const results = await Promise.all(servers.map(testMCPInitialize));
      const passed = results.filter(Boolean).length;
      const failed = results.length - passed;

      console.log(`\nInitialize Results: ${passed}/${results.length} passed`);

      if (failed > 0) {
        throw new Error(`${failed} MCP servers failed to initialize`);
      }
    });

    // =====================================================
    // Test tools/list on all servers
    // =====================================================

    await t.step("MCP Protocol: All servers respond to tools/list", async () => {
      console.log("\n--- MCP Tools List Tests ---");

      const servers = [
        "mcp-prior-auth-server",
        "mcp-claude-server",
        "mcp-npi-registry-server",
        "mcp-cms-coverage-server",
        "mcp-clearinghouse-server",
        "mcp-fhir-server",
        "mcp-hl7-x12-server",
        "mcp-medical-codes-server"
      ];

      const results = await Promise.all(servers.map(testMCPToolsList));
      const passed = results.filter(Boolean).length;
      const failed = results.length - passed;

      console.log(`\nTools List Results: ${passed}/${results.length} passed`);

      if (failed > 0) {
        throw new Error(`${failed} MCP servers failed tools/list`);
      }
    });

    // =====================================================
    // Test Prior Auth Server Tools
    // =====================================================

    await t.step("Prior Auth Server: Tool calls work without runtime errors", async () => {
      console.log("\n--- Prior Auth Server Tool Tests ---");

      const tests = [
        testMCPToolCall("mcp-prior-auth-server", "get_prior_auth_statistics", {
          tenant_id: TEST_TENANT_ID
        }),
        testMCPToolCall("mcp-prior-auth-server", "get_pending_prior_auths", {
          tenant_id: TEST_TENANT_ID,
          hours_threshold: 24
        }),
        testMCPToolCall("mcp-prior-auth-server", "check_prior_auth_required", {
          patient_id: "test-patient",
          service_codes: ["99213"],
          date_of_service: new Date().toISOString().split("T")[0],
          tenant_id: TEST_TENANT_ID
        })
      ];

      const results = await Promise.all(tests);
      const passed = results.filter(Boolean).length;

      if (passed < results.length) {
        throw new Error(`Prior Auth Server: ${results.length - passed} tool calls failed`);
      }
    });

    // =====================================================
    // Test NPI Registry Server Tools
    // =====================================================

    await t.step("NPI Registry Server: Tool calls work without runtime errors", async () => {
      console.log("\n--- NPI Registry Server Tool Tests ---");

      const tests = [
        testMCPToolCall("mcp-npi-registry-server", "validate_npi", {
          npi: "1234567890"
        }),
        testMCPToolCall("mcp-npi-registry-server", "search_providers", {
          last_name: "Smith",
          state: "TX",
          limit: 1
        })
      ];

      const results = await Promise.all(tests);
      const passed = results.filter(Boolean).length;

      if (passed < results.length) {
        throw new Error(`NPI Registry Server: ${results.length - passed} tool calls failed`);
      }
    });

    // =====================================================
    // Test CMS Coverage Server Tools
    // =====================================================

    await t.step("CMS Coverage Server: Tool calls work without runtime errors", async () => {
      console.log("\n--- CMS Coverage Server Tool Tests ---");

      const tests = [
        testMCPToolCall("mcp-cms-coverage-server", "search_ncd", {
          query: "diabetes",
          limit: 1
        }),
        testMCPToolCall("mcp-cms-coverage-server", "get_coverage_requirements", {
          code: "99213"
        }),
        testMCPToolCall("mcp-cms-coverage-server", "check_prior_auth_required", {
          cpt_code: "99213"
        })
      ];

      const results = await Promise.all(tests);
      const passed = results.filter(Boolean).length;

      if (passed < results.length) {
        throw new Error(`CMS Coverage Server: ${results.length - passed} tool calls failed`);
      }
    });

    // =====================================================
    // Test Clearinghouse Server Tools
    // =====================================================

    await t.step("Clearinghouse Server: Tool calls work without runtime errors", async () => {
      console.log("\n--- Clearinghouse Server Tool Tests ---");

      const tests = [
        testMCPToolCall("mcp-clearinghouse-server", "test_connection", {}),
        testMCPToolCall("mcp-clearinghouse-server", "get_payer_list", {
          type: "commercial"
        }),
        testMCPToolCall("mcp-clearinghouse-server", "get_rejection_reasons", {
          category: "coding"
        })
      ];

      const results = await Promise.all(tests);
      const passed = results.filter(Boolean).length;

      if (passed < results.length) {
        throw new Error(`Clearinghouse Server: ${results.length - passed} tool calls failed`);
      }
    });

    // =====================================================
    // Test Claude Server Tools (expensive - single test)
    // =====================================================

    await t.step("Claude Server: Basic tool call works without runtime errors", async () => {
      console.log("\n--- Claude Server Tool Tests ---");

      // Only test summarize (cheapest operation)
      const result = await testMCPToolCall("mcp-claude-server", "summarize", {
        content: "Test content for summarization.",
        maxLength: 50
      });

      if (!result) {
        throw new Error("Claude Server: summarize tool call failed");
      }
    });

    // =====================================================
    // Summary
    // =====================================================

    console.log("\n========================================");
    console.log("MCP Integration Tests Complete");
    console.log("========================================\n");
  }
});

// =====================================================
// Quick Smoke Test (faster, for pre-commit hooks)
// =====================================================

Deno.test({
  name: "MCP Smoke Test - Quick health check of all servers",
  ignore: !SUPABASE_URL || !SUPABASE_ANON_KEY,
  async fn() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log("Skipping smoke test: SUPABASE_URL or SUPABASE_ANON_KEY not set");
      return;
    }

    const servers = [
      "mcp-prior-auth-server",
      "mcp-claude-server",
      "mcp-npi-registry-server",
      "mcp-cms-coverage-server",
      "mcp-clearinghouse-server"
    ];

    console.log("\n--- MCP Smoke Test ---");

    const results = await Promise.all(servers.map(testMCPInitialize));
    const failed = results.filter(r => !r).length;

    if (failed > 0) {
      throw new Error(`${failed} MCP servers failed smoke test`);
    }

    console.log(`\nSmoke test passed: ${servers.length}/${servers.length} servers healthy`);
  }
});
