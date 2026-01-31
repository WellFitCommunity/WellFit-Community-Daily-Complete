/**
 * MCP Auth Gate Tests
 *
 * Tests the admin-tier authorization gate for MCP servers.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getRequestId,
  ADMIN_ROLES,
  CLINICAL_ADMIN_ROLES,
} from "../mcpAuthGate.ts";

Deno.test("getRequestId extracts x-request-id header", () => {
  const req = new Request("https://example.com", {
    headers: { "x-request-id": "test-123" }
  });
  assertEquals(getRequestId(req), "test-123");
});

Deno.test("getRequestId extracts x-correlation-id as fallback", () => {
  const req = new Request("https://example.com", {
    headers: { "x-correlation-id": "corr-456" }
  });
  assertEquals(getRequestId(req), "corr-456");
});

Deno.test("getRequestId generates UUID when no header present", () => {
  const req = new Request("https://example.com");
  const requestId = getRequestId(req);
  assertExists(requestId);
  // UUID format: 8-4-4-4-12 hex chars
  assertEquals(requestId.length, 36);
  assertEquals(requestId.split("-").length, 5);
});

Deno.test("ADMIN_ROLES contains expected roles", () => {
  assertEquals(ADMIN_ROLES.includes("admin"), true);
  assertEquals(ADMIN_ROLES.includes("super_admin"), true);
  assertEquals(ADMIN_ROLES.includes("security_admin"), true);
  assertEquals(ADMIN_ROLES.length, 3);
});

Deno.test("CLINICAL_ADMIN_ROLES includes admin and clinical roles", () => {
  // Should include all admin roles
  for (const role of ADMIN_ROLES) {
    assertEquals(CLINICAL_ADMIN_ROLES.includes(role), true);
  }
  // Should include clinical roles
  assertEquals(CLINICAL_ADMIN_ROLES.includes("nurse"), true);
  assertEquals(CLINICAL_ADMIN_ROLES.includes("physician"), true);
  assertEquals(CLINICAL_ADMIN_ROLES.includes("care_manager"), true);
});

// Note: Full integration tests for verifyAdminAccess require Supabase credentials
// and are run separately in the CI pipeline
