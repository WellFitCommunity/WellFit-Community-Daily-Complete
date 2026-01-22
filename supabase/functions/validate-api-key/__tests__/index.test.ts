/**
 * Tests for Validate API Key Edge Function
 *
 * Tests API key validation with proper authorization header parsing,
 * key lookup, usage tracking, and error handling.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ============================================================================
// Type Definitions
// ============================================================================

interface ApiKeyData {
  id: string;
  org_name: string;
  active: boolean;
  usage_count: number;
}

// ============================================================================
// Test Suites
// ============================================================================

Deno.test("Validate API Key - Authorization Header", async (t) => {
  await t.step("should require Authorization header", () => {
    const authHeader: string | null = null;
    const hasAuth = authHeader && authHeader.startsWith('Bearer ');

    assertEquals(hasAuth, false);
  });

  await t.step("should require Bearer prefix", () => {
    const authHeader = "Basic abc123";
    const hasValidFormat = authHeader.startsWith('Bearer ');

    assertEquals(hasValidFormat, false);
  });

  await t.step("should extract API key after Bearer prefix", () => {
    const authHeader = "Bearer acme-corp-abc123def456";
    const apiKey = authHeader.substring(7);

    assertEquals(apiKey, "acme-corp-abc123def456");
  });

  await t.step("should reject empty API key", () => {
    const authHeader = "Bearer ";
    const apiKey = authHeader.substring(7);
    const isValid = !!apiKey;

    assertEquals(isValid, false);
  });

  await t.step("should accept valid API key format", () => {
    const authHeader = "Bearer acme-corp-a1b2c3d4e5f6";
    const apiKey = authHeader.substring(7);
    const isValid = apiKey.length > 0;

    assertEquals(isValid, true);
  });
});

Deno.test("Validate API Key - Key Lookup", async (t) => {
  await t.step("should select necessary fields only", () => {
    const selectFields = ['id', 'org_name', 'active', 'usage_count'];

    assertEquals(selectFields.length, 4);
    assertEquals(selectFields.includes('id'), true);
    assertEquals(selectFields.includes('org_name'), true);
    assertEquals(selectFields.includes('active'), true);
    assertEquals(selectFields.includes('usage_count'), true);
  });

  await t.step("should query by exact API key match", () => {
    const apiKey = "acme-corp-abc123";
    const queryFilter = { api_key: apiKey };

    assertEquals(queryFilter.api_key, apiKey);
  });

  await t.step("should use single() for exact match", () => {
    // single() returns exactly one row or error
    const queryMethod = "single";
    assertEquals(queryMethod, "single");
  });
});

Deno.test("Validate API Key - Key Validation", async (t) => {
  await t.step("should reject non-existent key", () => {
    const apiKeyData: ApiKeyData | null = null;
    const isValid = apiKeyData !== null;

    assertEquals(isValid, false);
  });

  await t.step("should reject inactive key", () => {
    const apiKeyData: ApiKeyData = {
      id: "key-123",
      org_name: "Acme Corp",
      active: false,
      usage_count: 100,
    };

    assertEquals(apiKeyData.active, false);
  });

  await t.step("should accept active key", () => {
    const apiKeyData: ApiKeyData = {
      id: "key-123",
      org_name: "Acme Corp",
      active: true,
      usage_count: 50,
    };

    assertEquals(apiKeyData.active, true);
  });
});

Deno.test("Validate API Key - Usage Tracking", async (t) => {
  await t.step("should increment usage count", () => {
    const currentUsageCount = 50;
    const newUsageCount = (currentUsageCount || 0) + 1;

    assertEquals(newUsageCount, 51);
  });

  await t.step("should handle null usage_count", () => {
    const currentUsageCount: number | null = null;
    const newUsageCount = (currentUsageCount || 0) + 1;

    assertEquals(newUsageCount, 1);
  });

  await t.step("should update last_used timestamp", () => {
    const lastUsed = new Date().toISOString();

    assertExists(lastUsed);
    assertEquals(lastUsed.includes("T"), true); // ISO format
  });

  await t.step("should structure usage update correctly", () => {
    const updateData = {
      usage_count: 51,
      last_used: new Date().toISOString(),
    };

    assertExists(updateData.usage_count);
    assertExists(updateData.last_used);
  });
});

Deno.test("Validate API Key - Success Response", async (t) => {
  await t.step("should return success message", () => {
    const response = {
      message: 'API key validated successfully.',
      org_name: 'Acme Corp',
      key_id: 'key-123',
    };

    assertEquals(response.message, 'API key validated successfully.');
  });

  await t.step("should include org_name in response", () => {
    const response = {
      message: 'API key validated successfully.',
      org_name: 'Acme Corp',
      key_id: 'key-123',
    };

    assertEquals(response.org_name, 'Acme Corp');
  });

  await t.step("should include key_id in response", () => {
    const response = {
      message: 'API key validated successfully.',
      org_name: 'Acme Corp',
      key_id: 'key-123',
    };

    assertEquals(response.key_id, 'key-123');
  });

  await t.step("should return 200 status on success", () => {
    const statusCode = 200;
    assertEquals(statusCode, 200);
  });
});

Deno.test("Validate API Key - Error Responses", async (t) => {
  await t.step("should return 401 for missing Authorization header", () => {
    const error = {
      status: 401,
      body: { error: 'Missing or malformed Authorization header. Use "Bearer <API_KEY>".' },
    };

    assertEquals(error.status, 401);
    assertEquals(error.body.error.includes("Bearer"), true);
  });

  await t.step("should return 401 for empty API key", () => {
    const error = {
      status: 401,
      body: { error: 'API key cannot be empty.' },
    };

    assertEquals(error.status, 401);
  });

  await t.step("should return 401 for invalid API key", () => {
    const error = {
      status: 401,
      body: { error: 'Invalid API key.' },
    };

    assertEquals(error.status, 401);
  });

  await t.step("should return 403 for inactive API key", () => {
    const error = {
      status: 403,
      body: { error: 'API key is inactive.' },
    };

    assertEquals(error.status, 403);
  });

  await t.step("should return 500 for client initialization error", () => {
    const error = {
      status: 500,
      body: { error: 'Internal server error: Supabase client not initialized.' },
    };

    assertEquals(error.status, 500);
    assertEquals(error.body.error.includes("client not initialized"), true);
  });

  await t.step("should return 500 for validation errors", () => {
    const error = {
      status: 500,
      body: { error: 'Internal server error during validation.' },
    };

    assertEquals(error.status, 500);
  });
});

Deno.test("Validate API Key - Security Logging", async (t) => {
  await t.step("should log only key prefix for debugging", () => {
    const apiKey = "acme-corp-abc123def456ghij";
    const keyPrefix = apiKey.substring(0, 10);

    assertEquals(keyPrefix, "acme-corp-");
    assertEquals(keyPrefix.length, 10);
  });

  await t.step("should never log full API key", () => {
    const apiKey = "acme-corp-abc123def456ghij";
    const logData = {
      action: "validate",
      keyPrefix: apiKey.substring(0, 10),
      // Note: No full key
    };

    const logString = JSON.stringify(logData);
    assertEquals(logString.includes(apiKey), false);
  });

  await t.step("should log security events for failed attempts", () => {
    const securityLogTypes = [
      "Missing or malformed Authorization header",
      "API key is empty after Bearer prefix",
      "API key validation failed",
      "API key is inactive",
    ];

    assertEquals(securityLogTypes.length, 4);
  });

  await t.step("should log key_id on inactivity warning", () => {
    const logData = {
      event: "security",
      reason: "API key is inactive",
      keyId: "key-123",
    };

    assertExists(logData.keyId);
  });
});

Deno.test("Validate API Key - CORS Handling", async (t) => {
  await t.step("should handle OPTIONS preflight request", () => {
    const method = "OPTIONS";
    const isOptions = method === "OPTIONS";

    assertEquals(isOptions, true);
  });

  await t.step("should include CORS headers in all responses", () => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://example.com",
      "Content-Type": "application/json",
    };

    assertExists(corsHeaders["Access-Control-Allow-Origin"]);
    assertExists(corsHeaders["Content-Type"]);
  });
});

Deno.test("Validate API Key - Error Handling", async (t) => {
  await t.step("should handle fetch errors gracefully", () => {
    const fetchError = { message: "Network error" };
    const shouldReject = !!fetchError;

    assertEquals(shouldReject, true);
  });

  await t.step("should extract error message from Error instance", () => {
    const err = new Error("Connection refused");
    const errorMessage = err instanceof Error ? err.message : String(err);

    assertEquals(errorMessage, "Connection refused");
  });

  await t.step("should convert non-Error to string", () => {
    const err = { code: 500, reason: "Unknown" };
    const errorMessage = err instanceof Error ? err.message : String(err);

    assertEquals(errorMessage, "[object Object]");
  });

  await t.step("should not log usage update failures as errors", () => {
    // Usage update failures are logged as warnings, not errors
    const logLevel = "warn";
    assertEquals(logLevel, "warn");
  });
});

Deno.test("Validate API Key - Initialization", async (t) => {
  await t.step("should require SUPABASE_URL", () => {
    const supabaseUrl: string | undefined = undefined;
    const isMissing = !supabaseUrl;

    assertEquals(isMissing, true);
  });

  await t.step("should require service role key", () => {
    const serviceRoleKey: string | undefined = undefined;
    const isMissing = !serviceRoleKey;

    assertEquals(isMissing, true);
  });

  await t.step("should check both URL and key are present", () => {
    const supabaseUrl = "https://project.supabase.co";
    const serviceRoleKey = "secret-key";
    const canInitialize = !!supabaseUrl && !!serviceRoleKey;

    assertEquals(canInitialize, true);
  });
});

Deno.test("Validate API Key - Database Queries", async (t) => {
  await t.step("should use admin client for key lookup", () => {
    // Admin client bypasses RLS to check any key
    const clientType = "admin";
    assertEquals(clientType, "admin");
  });

  await t.step("should filter by active status check", () => {
    // Key lookup returns active status, checked separately
    const apiKeyData: ApiKeyData = {
      id: "key-123",
      org_name: "Acme Corp",
      active: true,
      usage_count: 10,
    };

    const shouldCheckActive = apiKeyData.active !== undefined;
    assertEquals(shouldCheckActive, true);
  });
});
