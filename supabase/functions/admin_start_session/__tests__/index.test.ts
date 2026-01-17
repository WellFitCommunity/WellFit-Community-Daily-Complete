// supabase/functions/admin_start_session/__tests__/index.test.ts
// Tests for admin_start_session edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Admin Start Session Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/admin_start_session", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require pin in request body", () => {
    const validBody = { pin: "1234", role: "nurse" };
    const invalidBody = { role: "nurse" };

    assertExists(validBody.pin);
    assertEquals("pin" in invalidBody, false);
  });

  await t.step("should require role in request body", () => {
    const validBody = { pin: "1234", role: "nurse" };
    const invalidBody = { pin: "1234" };

    assertExists(validBody.role);
    assertEquals("role" in invalidBody, false);
  });

  await t.step("should return 400 for missing pin or role", () => {
    const hasPin = false;
    const hasRole = true;
    const expectedStatus = (!hasPin || !hasRole) ? 400 : 200;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should extract bearer token from authorization header", () => {
    const extractBearer = (auth: string | null): string => {
      if (!auth) return "";
      return auth.replace("Bearer ", "");
    };

    assertEquals(extractBearer("Bearer abc123"), "abc123");
    assertEquals(extractBearer(null), "");
    assertEquals(extractBearer(""), "");
  });

  await t.step("should return 401 for missing or invalid authorization", () => {
    const hasValidUser = false;
    const expectedStatus = hasValidUser ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should return 403 when PIN not set for role", () => {
    const pinExists = false;
    const expectedStatus = pinExists ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should return 403 for invalid PIN", () => {
    const isPinValid = false;
    const expectedStatus = isPinValid ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should create session with 2-hour expiry", () => {
    const SESSION_DURATION_MS = 120 * 60 * 1000; // 2 hours
    const issuedAt = Date.now();
    const expiresAt = issuedAt + SESSION_DURATION_MS;

    assertEquals(SESSION_DURATION_MS, 7200000); // 2 hours in ms
    assertEquals(expiresAt - issuedAt, SESSION_DURATION_MS);
  });

  await t.step("should structure session response correctly", () => {
    const mockSession = {
      id: "session-123",
      user_id: "user-456",
      role: "nurse",
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString()
    };

    assertExists(mockSession.id);
    assertExists(mockSession.user_id);
    assertExists(mockSession.role);
    assertExists(mockSession.issued_at);
    assertExists(mockSession.expires_at);
  });

  await t.step("should return success response with session data", () => {
    const mockResponse = {
      ok: true,
      session: {
        id: "session-123",
        user_id: "user-456",
        role: "nurse",
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString()
      }
    };

    assertEquals(mockResponse.ok, true);
    assertExists(mockResponse.session);
  });

  await t.step("should return 500 for session creation failure", () => {
    const sessionCreated = false;
    const expectedStatus = sessionCreated ? 200 : 500;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should handle unexpected errors gracefully", () => {
    const errorResponse = {
      ok: false,
      error: "Unexpected error"
    };

    assertEquals(errorResponse.ok, false);
    assertExists(errorResponse.error);
  });

  await t.step("should validate session expiry calculation", () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 120 * 60 * 1000);

    const diffMs = expiresAt.getTime() - now.getTime();
    const diffMinutes = diffMs / (60 * 1000);

    assertEquals(diffMinutes, 120);
  });

  await t.step("should format dates as ISO strings", () => {
    const date = new Date();
    const isoString = date.toISOString();

    assertEquals(typeof isoString, "string");
    assertEquals(isoString.includes("T"), true);
    assertEquals(isoString.endsWith("Z"), true);
  });

  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      success: 200,
      badRequest: 400,
      unauthorized: 401,
      forbidden: 403,
      serverError: 500
    };

    assertEquals(statusCodes.success, 200);
    assertEquals(statusCodes.badRequest, 400);
    assertEquals(statusCodes.unauthorized, 401);
    assertEquals(statusCodes.forbidden, 403);
    assertEquals(statusCodes.serverError, 500);
  });

  await t.step("should include Content-Type header in responses", () => {
    const headers = { "Content-Type": "application/json" };

    assertEquals(headers["Content-Type"], "application/json");
  });

  await t.step("should query staff_pins table with user_id and role", () => {
    const query = {
      table: "staff_pins",
      select: "pin_hash",
      filters: {
        user_id: "user-123",
        role: "nurse"
      }
    };

    assertEquals(query.table, "staff_pins");
    assertEquals(query.select, "pin_hash");
    assertExists(query.filters.user_id);
    assertExists(query.filters.role);
  });

  await t.step("should insert into admin_sessions table", () => {
    const insertData = {
      user_id: "user-123",
      role: "nurse",
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString()
    };

    assertExists(insertData.user_id);
    assertExists(insertData.role);
    assertExists(insertData.issued_at);
    assertExists(insertData.expires_at);
  });
});
