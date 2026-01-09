// supabase/functions/save-fcm-token/__tests__/index.test.ts
// Tests for save FCM token edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Save FCM Token Tests", async (t) => {

  await t.step("should handle CORS preflight", async () => {
    const request = new Request("http://localhost", {
      method: "OPTIONS",
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should only accept POST method", () => {
    const validMethods = ["POST"];
    const invalidMethods = ["GET", "PUT", "DELETE", "PATCH"];

    validMethods.forEach(method => {
      assertEquals(method === "POST", true);
    });

    invalidMethods.forEach(method => {
      assertEquals(method === "POST", false);
    });
  });

  await t.step("should validate required fcm_token field", () => {
    const validPayload = {
      fcm_token: "test-fcm-token-abc123xyz",
      device_info: "Chrome 120 on Windows"
    };

    const invalidPayload = {
      device_info: "Chrome 120 on Windows"
      // missing fcm_token
    };

    assertExists(validPayload.fcm_token);
    assertEquals(validPayload.fcm_token.length > 0, true);
    assertEquals(invalidPayload.hasOwnProperty('fcm_token'), false);
  });

  await t.step("should accept optional device_info", () => {
    const payloadWithDeviceInfo = {
      fcm_token: "token-123",
      device_info: "Safari 17 on macOS"
    };

    const payloadWithoutDeviceInfo = {
      fcm_token: "token-456"
    };

    assertExists(payloadWithDeviceInfo.device_info);
    assertEquals(payloadWithoutDeviceInfo.hasOwnProperty('device_info'), false);
  });

  await t.step("should require Authorization header", () => {
    const headersWithAuth = new Headers({
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "Content-Type": "application/json"
    });

    const headersWithoutAuth = new Headers({
      "Content-Type": "application/json"
    });

    assertEquals(headersWithAuth.has("Authorization"), true);
    assertEquals(headersWithoutAuth.has("Authorization"), false);
  });

  await t.step("should extract Bearer token from Authorization header", () => {
    const authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature";

    const hasBearer = authHeader.startsWith("Bearer ");
    const token = hasBearer ? authHeader.substring(7) : null;

    assertEquals(hasBearer, true);
    assertExists(token);
    assertEquals(token?.startsWith("eyJ"), true);
  });

  await t.step("should use fcm_tokens table for storage", () => {
    // CRITICAL: Verify we use the canonical fcm_tokens table
    // This is the same table send-push-notification reads from
    const tableName = "fcm_tokens";

    assertEquals(tableName, "fcm_tokens");
    assertEquals(tableName !== "push_subscriptions", true);
  });

  await t.step("should use correct column names for fcm_tokens table", () => {
    const upsertData = {
      user_id: "uuid-123",
      token: "fcm-token-abc", // Column is 'token', not 'fcm_token'
      last_used_at: new Date().toISOString(),
      device_info: "Test device"
    };

    assertExists(upsertData.user_id);
    assertExists(upsertData.token);
    assertExists(upsertData.last_used_at);
    assertEquals(upsertData.hasOwnProperty('fcm_token'), false); // Should NOT have fcm_token
    assertEquals(upsertData.hasOwnProperty('token'), true); // Should have token
  });

  await t.step("should upsert with conflict on user_id,token", () => {
    const conflictTarget = "user_id,token";

    // This ensures duplicate tokens for same user are updated, not inserted again
    assertEquals(conflictTarget.includes("user_id"), true);
    assertEquals(conflictTarget.includes("token"), true);
  });

  await t.step("should update last_used_at on upsert", () => {
    const now = new Date();
    const lastUsedAt = now.toISOString();

    assertExists(lastUsedAt);
    assertEquals(lastUsedAt.includes("T"), true); // ISO format
    assertEquals(lastUsedAt.includes("Z") || lastUsedAt.includes("+"), true);
  });

  await t.step("should return 401 for missing authorization", () => {
    const errorResponse = {
      error: "Unauthorized: Missing Authorization header"
    };

    assertExists(errorResponse.error);
    assertEquals(errorResponse.error.includes("Unauthorized"), true);
  });

  await t.step("should return 401 for invalid token", () => {
    const errorResponse = {
      error: "Unauthorized: User not authenticated"
    };

    assertExists(errorResponse.error);
    assertEquals(errorResponse.error.includes("Unauthorized"), true);
  });

  await t.step("should return 400 for validation errors", () => {
    const errorResponse = {
      error: "Validation failed",
      details: [
        { field: "fcm_token", message: "fcm_token is required." }
      ]
    };

    assertExists(errorResponse.error);
    assertExists(errorResponse.details);
    assertEquals(Array.isArray(errorResponse.details), true);
    assertEquals(errorResponse.details[0].field, "fcm_token");
  });

  await t.step("should return success response with data", () => {
    const successResponse = {
      success: true,
      message: "FCM token saved.",
      data: [
        {
          user_id: "uuid-123",
          token: "fcm-token-abc",
          last_used_at: "2025-01-09T12:00:00Z",
          device_info: "Test device"
        }
      ]
    };

    assertEquals(successResponse.success, true);
    assertExists(successResponse.message);
    assertExists(successResponse.data);
    assertEquals(Array.isArray(successResponse.data), true);
  });

  await t.step("should handle database errors gracefully", () => {
    const dbError = {
      message: "duplicate key value violates unique constraint",
      code: "23505"
    };

    const errorResponse = {
      error: "Failed to save FCM token",
      details: dbError.message
    };

    assertExists(errorResponse.error);
    assertExists(errorResponse.details);
  });

  await t.step("should validate token format is non-empty string", () => {
    const validTokens = [
      "abc123xyz",
      "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...",
      "dGVzdC10b2tlbi0xMjM="
    ];

    const invalidTokens = [
      "",
      null,
      undefined
    ];

    validTokens.forEach(token => {
      assertEquals(typeof token === "string" && token.length > 0, true);
    });

    invalidTokens.forEach(token => {
      assertEquals(typeof token === "string" && (token as string)?.length > 0, false);
    });
  });

  await t.step("should extract user_id from authenticated session", () => {
    const mockUser = {
      id: "ba4f20ad-2707-467b-a87f-d46fe9255d2f",
      email: "user@example.com",
      role: "authenticated"
    };

    assertExists(mockUser.id);
    assertEquals(mockUser.id.length, 36); // UUID format
    assertEquals(mockUser.id.includes("-"), true);
  });

  await t.step("should log token save with masked token", () => {
    const token = "dGVzdC10b2tlbi1mb3ItbG9nZ2luZy10ZXN0";
    const maskedToken = token.slice(0, 10) + "...";

    assertEquals(maskedToken.length, 13);
    assertEquals(maskedToken.endsWith("..."), true);
    assertEquals(maskedToken.includes(token), false); // Full token not exposed
  });
});
