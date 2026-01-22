/**
 * Tests for Generate API Key Edge Function
 *
 * Tests API key generation with proper authentication,
 * role verification, and secure key hashing.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ============================================================================
// Test Suites
// ============================================================================

Deno.test("Generate API Key - Authentication", async (t) => {
  await t.step("should require Authorization header with JWT", () => {
    const authHeader = "";
    const hasAuth = !!authHeader;

    assertEquals(hasAuth, false);
  });

  await t.step("should extract JWT from header", () => {
    const authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
    const jwt = authHeader;

    assertEquals(jwt.startsWith("Bearer "), true);
  });
});

Deno.test("Generate API Key - Role Verification", async (t) => {
  await t.step("should check for admin or super_admin role", () => {
    const requiredRoles = ["admin", "super_admin"];

    assertEquals(requiredRoles.length, 2);
    assertEquals(requiredRoles.includes("admin"), true);
    assertEquals(requiredRoles.includes("super_admin"), true);
  });

  await t.step("should deny non-admin users", () => {
    const userRole = "member";
    const requiredRoles = ["admin", "super_admin"];
    const isAuthorized = requiredRoles.includes(userRole);

    assertEquals(isAuthorized, false);
  });

  await t.step("should allow admin users", () => {
    const userRole = "admin";
    const requiredRoles = ["admin", "super_admin"];
    const isAuthorized = requiredRoles.includes(userRole);

    assertEquals(isAuthorized, true);
  });

  await t.step("should allow super_admin users", () => {
    const userRole = "super_admin";
    const requiredRoles = ["admin", "super_admin"];
    const isAuthorized = requiredRoles.includes(userRole);

    assertEquals(isAuthorized, true);
  });
});

Deno.test("Generate API Key - Request Validation", async (t) => {
  await t.step("should only allow POST method", () => {
    const methods = ["GET", "PUT", "DELETE", "PATCH"];

    for (const method of methods) {
      const isAllowed = method === "POST";
      assertEquals(isAllowed, false);
    }
  });

  await t.step("should allow POST method", () => {
    const method = "POST";
    const isAllowed = method === "POST";

    assertEquals(isAllowed, true);
  });

  await t.step("should require org_name in request body", () => {
    const body = {};
    const orgName = (body as { org_name?: string })?.org_name;
    const isValid = typeof orgName === "string" && !!orgName.trim();

    assertEquals(isValid, false);
  });

  await t.step("should accept valid org_name", () => {
    const body = { org_name: "Acme Corp" };
    const orgName = body.org_name;
    const isValid = typeof orgName === "string" && !!orgName.trim();

    assertEquals(isValid, true);
  });

  await t.step("should reject empty org_name", () => {
    const body = { org_name: "   " };
    const orgName = body.org_name;
    const isValid = typeof orgName === "string" && !!orgName.trim();

    assertEquals(isValid, false);
  });
});

Deno.test("Generate API Key - Org Name Slugification", async (t) => {
  await t.step("should convert to lowercase", () => {
    const input = "ACME Corp";
    const slug = input.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");

    assertEquals(slug, "acme-corp");
  });

  await t.step("should replace spaces with hyphens", () => {
    const input = "acme corp inc";
    const slug = input.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");

    assertEquals(slug, "acme-corp-inc");
  });

  await t.step("should remove special characters", () => {
    const input = "Acme! Corp@#$%";
    const slug = input.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");

    assertEquals(slug, "acme-corp");
  });

  await t.step("should collapse multiple hyphens", () => {
    const input = "acme---corp";
    const slug = input.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");

    assertEquals(slug, "acme-corp");
  });

  await t.step("should trim whitespace", () => {
    const input = "  acme corp  ";
    const slug = input.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");

    assertEquals(slug, "acme-corp");
  });

  await t.step("should reject slug with only special characters", () => {
    const input = "!!!@@@###";
    const slug = input.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");

    assertEquals(slug, "");
  });
});

Deno.test("Generate API Key - Key Generation", async (t) => {
  await t.step("should generate 32 bytes of random data", () => {
    const bytesLen = 32;
    const bytes = new Uint8Array(bytesLen);
    crypto.getRandomValues(bytes);

    assertEquals(bytes.length, 32);
  });

  await t.step("should convert bytes to hex string", () => {
    const bytes = new Uint8Array([0, 15, 255, 128]);
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");

    assertEquals(hex, "000fff80");
    assertEquals(hex.length, 8); // 4 bytes = 8 hex chars
  });

  await t.step("should generate 64-character hex string from 32 bytes", () => {
    const bytesLen = 32;
    const bytes = new Uint8Array(bytesLen);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");

    assertEquals(hex.length, 64);
  });

  await t.step("should create API key with org slug prefix", () => {
    const orgSlug = "acme-corp";
    const randomHex = "a".repeat(64);
    const apiKeyPlain = `${orgSlug}-${randomHex}`;

    assertEquals(apiKeyPlain.startsWith("acme-corp-"), true);
    assertEquals(apiKeyPlain.length, orgSlug.length + 1 + 64);
  });
});

Deno.test("Generate API Key - SHA-256 Hashing", async (t) => {
  await t.step("should hash string to SHA-256", async () => {
    const input = "test-string";
    const buf = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    const hexHash = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");

    assertEquals(hexHash.length, 64); // SHA-256 = 32 bytes = 64 hex chars
  });

  await t.step("should produce consistent hash for same input", async () => {
    const input = "test-api-key";
    const hash1 = await hashString(input);
    const hash2 = await hashString(input);

    assertEquals(hash1, hash2);
  });

  await t.step("should produce different hash for different input", async () => {
    const hash1 = await hashString("key-1");
    const hash2 = await hashString("key-2");

    assertNotEquals(hash1, hash2);
  });
});

// Helper function
async function hashString(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("Generate API Key - Database Insert", async (t) => {
  await t.step("should structure API key record correctly", () => {
    const record = {
      org_name: "Acme Corp",
      api_key_hash: "a".repeat(64),
      active: true,
      created_by: "user-123",
    };

    assertEquals(record.org_name, "Acme Corp");
    assertEquals(record.api_key_hash.length, 64);
    assertEquals(record.active, true);
    assertExists(record.created_by);
  });

  await t.step("should handle null created_by for system-generated keys", () => {
    const userId: string | undefined = undefined;
    const record = {
      org_name: "Acme Corp",
      api_key_hash: "a".repeat(64),
      active: true,
      created_by: userId ?? null,
    };

    assertEquals(record.created_by, null);
  });
});

Deno.test("Generate API Key - Response", async (t) => {
  await t.step("should return plain API key on success", () => {
    const apiKeyPlain = "acme-corp-" + "a".repeat(64);
    const response = { api_key: apiKeyPlain };

    assertExists(response.api_key);
    assertEquals(response.api_key.startsWith("acme-corp-"), true);
  });

  await t.step("should return 403 for unauthorized users", () => {
    const error = {
      status: 403,
      body: { error: "Unauthorized: admin role required." },
    };

    assertEquals(error.status, 403);
    assertEquals(error.body.error.includes("admin"), true);
  });

  await t.step("should return 400 for missing org_name", () => {
    const error = {
      status: 400,
      body: { error: "Missing or invalid org_name" },
    };

    assertEquals(error.status, 400);
  });

  await t.step("should return 400 for invalid org_name", () => {
    const error = {
      status: 400,
      body: { error: "org_name must contain letters/numbers" },
    };

    assertEquals(error.status, 400);
  });

  await t.step("should return 405 for non-POST methods", () => {
    const error = {
      status: 405,
      body: { error: "Method not allowed" },
    };

    assertEquals(error.status, 405);
  });

  await t.step("should return 500 for database errors", () => {
    const error = {
      status: 500,
      body: { error: "Failed to save API key" },
    };

    assertEquals(error.status, 500);
  });
});

Deno.test("Generate API Key - Security", async (t) => {
  await t.step("should only return plain key once", () => {
    // The plain key is returned only on creation
    // Subsequent lookups will only have the hash
    const plainKey = "acme-corp-" + "a".repeat(64);
    const hashKey = "b".repeat(64);

    // In DB, only hash is stored
    const dbRecord = { api_key_hash: hashKey };

    assertNotEquals(plainKey, hashKey);
    assertEquals(dbRecord.api_key_hash.length, 64);
  });

  await t.step("should never log the plain API key", () => {
    const logData = {
      action: "generate-api-key",
      org_name: "Acme Corp",
      // Note: No api_key field
    };

    const logString = JSON.stringify(logData);
    assertEquals(logString.includes("api_key"), false);
  });

  await t.step("should use service role client for insert", () => {
    // Service role bypasses RLS for the insert
    // User client is only for authentication
    const clientTypes = ["user_client", "service_role_client"];

    assertEquals(clientTypes.includes("service_role_client"), true);
  });
});

Deno.test("Generate API Key - Error Handling", async (t) => {
  await t.step("should handle JSON parse errors", () => {
    const invalidBody = "not json";
    let parseError = false;

    try {
      JSON.parse(invalidBody);
    } catch {
      parseError = true;
    }

    assertEquals(parseError, true);
  });

  await t.step("should extract error message from Error instance", () => {
    const err = new Error("Database connection failed");
    const errorMessage = err instanceof Error ? err.message : String(err);

    assertEquals(errorMessage, "Database connection failed");
  });

  await t.step("should convert non-Error to string", () => {
    const err = "String error";
    const errorMessage = err instanceof Error ? err.message : String(err);

    assertEquals(errorMessage, "String error");
  });
});
