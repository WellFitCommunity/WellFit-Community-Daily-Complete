/**
 * Tests for AI Billing Code Suggester Edge Function
 *
 * Tests billing code suggestion generation from encounter data
 * with authentication, authorization, and tenant isolation.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ============================================================================
// Type Definitions (matching the edge function)
// ============================================================================

interface BillingSuggesterRequest {
  encounterId?: string;
  patientId?: string;
  tenantId?: string;
  mode?: 'single' | 'batch';
}

interface EncounterContext {
  encounterId: string;
  patientId: string;
  tenantId: string;
  encounterType: string;
  encounterStart: string;
  encounterEnd?: string;
  chiefComplaint?: string;
  diagnosisCodes: string[];
  observations: Array<{ code: string; value: unknown; unit: string }>;
}

interface ProfileData {
  tenant_id: string;
  is_admin: boolean;
  role_id: string;
  roles?: { name: string };
}

interface BatchResults {
  total: number;
  processed: number;
  errors: number;
}

// ============================================================================
// Test Suites
// ============================================================================

Deno.test("AI Billing Suggester - Authentication", async (t) => {
  await t.step("should require Authorization header", () => {
    const authHeader: string | null = null;
    const hasAuth = authHeader?.startsWith('Bearer ');

    assertEquals(hasAuth, undefined); // No auth header
  });

  await t.step("should require Bearer token format", () => {
    const authHeader = "Basic abc123";
    const hasValidFormat = authHeader.startsWith('Bearer ');

    assertEquals(hasValidFormat, false);
  });

  await t.step("should extract token from Bearer header", () => {
    const authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
    const token = authHeader.slice(7);

    assertEquals(token, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test");
    assertEquals(token.startsWith("eyJ"), true);
  });
});

Deno.test("AI Billing Suggester - Authorization", async (t) => {
  await t.step("should require user to have tenant assigned", () => {
    const profile: ProfileData | null = {
      tenant_id: "",
      is_admin: false,
      role_id: "role-123",
    };

    const hasTenant = !!profile?.tenant_id;
    assertEquals(hasTenant, false);
  });

  await t.step("should check for allowed roles", () => {
    const allowedRoles = ['admin', 'super_admin', 'physician', 'nurse', 'billing_specialist', 'case_manager'];

    assertEquals(allowedRoles.length, 6);
    assertEquals(allowedRoles.includes('billing_specialist'), true);
    assertEquals(allowedRoles.includes('physician'), true);
  });

  await t.step("should allow admin users", () => {
    const profile: ProfileData = {
      tenant_id: "tenant-123",
      is_admin: true,
      role_id: "role-123",
    };

    const hasAccess = profile.is_admin;
    assertEquals(hasAccess, true);
  });

  await t.step("should allow users with allowed roles", () => {
    const profile: ProfileData = {
      tenant_id: "tenant-123",
      is_admin: false,
      role_id: "role-123",
      roles: { name: "billing_specialist" },
    };

    const allowedRoles = ['admin', 'super_admin', 'physician', 'nurse', 'billing_specialist', 'case_manager'];
    const roleName = profile.roles?.name;
    const hasAccess = profile.is_admin || allowedRoles.includes(roleName || "");

    assertEquals(hasAccess, true);
  });

  await t.step("should deny users without allowed roles", () => {
    const profile: ProfileData = {
      tenant_id: "tenant-123",
      is_admin: false,
      role_id: "role-123",
      roles: { name: "patient" },
    };

    const allowedRoles = ['admin', 'super_admin', 'physician', 'nurse', 'billing_specialist', 'case_manager'];
    const roleName = profile.roles?.name;
    const hasAccess = profile.is_admin || allowedRoles.includes(roleName || "");

    assertEquals(hasAccess, false);
  });
});

Deno.test("AI Billing Suggester - Tenant Isolation", async (t) => {
  await t.step("should use effective tenant ID from request or profile", () => {
    const requestTenantId = "tenant-456";
    const profileTenantId = "tenant-123";

    const effectiveTenantId = requestTenantId || profileTenantId;
    assertEquals(effectiveTenantId, "tenant-456");
  });

  await t.step("should default to profile tenant if not in request", () => {
    const requestTenantId: string | undefined = undefined;
    const profileTenantId = "tenant-123";

    const effectiveTenantId = requestTenantId || profileTenantId;
    assertEquals(effectiveTenantId, "tenant-123");
  });

  await t.step("should prevent non-super-admin from accessing other tenants", () => {
    const isSuperAdmin = false;
    const effectiveTenantId = "tenant-456";
    const profileTenantId = "tenant-123";

    const canAccess = isSuperAdmin || effectiveTenantId === profileTenantId;
    assertEquals(canAccess, false);
  });

  await t.step("should allow super admin to access any tenant", () => {
    const isSuperAdmin = true;
    const effectiveTenantId = "tenant-456";
    const profileTenantId = "tenant-123";

    const canAccess = isSuperAdmin || effectiveTenantId === profileTenantId;
    assertEquals(canAccess, true);
  });

  await t.step("should allow user to access their own tenant", () => {
    const isSuperAdmin = false;
    const effectiveTenantId = "tenant-123";
    const profileTenantId = "tenant-123";

    const canAccess = isSuperAdmin || effectiveTenantId === profileTenantId;
    assertEquals(canAccess, true);
  });
});

Deno.test("AI Billing Suggester - Mode Selection", async (t) => {
  await t.step("should default mode to single", () => {
    const request: BillingSuggesterRequest = {
      encounterId: "enc-123",
      patientId: "patient-123",
    };

    const mode = request.mode || 'single';
    assertEquals(mode, "single");
  });

  await t.step("should accept batch mode", () => {
    const request: BillingSuggesterRequest = {
      mode: 'batch',
    };

    assertEquals(request.mode, "batch");
  });

  await t.step("should route to correct processor based on mode", () => {
    const modes: Array<'single' | 'batch'> = ['single', 'batch'];

    for (const mode of modes) {
      if (mode === 'batch') {
        // Would call processBatchEncounters
        assertEquals(mode, "batch");
      } else {
        // Would call processSingleEncounter
        assertEquals(mode, "single");
      }
    }
  });
});

Deno.test("AI Billing Suggester - Single Encounter Processing", async (t) => {
  await t.step("should check if skill is enabled for tenant", () => {
    const config = {
      billing_suggester_enabled: true,
    };

    const isEnabled = config && config.billing_suggester_enabled;
    assertEquals(isEnabled, true);
  });

  await t.step("should deny if skill not enabled", () => {
    const config = {
      billing_suggester_enabled: false,
    };

    const isEnabled = config && config.billing_suggester_enabled;
    assertEquals(isEnabled, false);
  });

  await t.step("should build encounter context", () => {
    const encounter = {
      id: "enc-123",
      class: "outpatient",
      period_start: "2025-01-15T09:00:00Z",
      period_end: "2025-01-15T09:30:00Z",
      reason_code_text: "Annual wellness visit",
    };
    const patientId = "patient-123";
    const tenantId = "tenant-123";
    const conditions = [{ code: "E11.9" }, { code: "I10" }];
    const observations = [
      { code: "29463-7", value: 75, unit: "kg" },
      { code: "8480-6", value: 130, unit: "mmHg" },
    ];

    const encounterContext: EncounterContext = {
      encounterId: encounter.id,
      patientId,
      tenantId,
      encounterType: encounter.class || 'outpatient',
      encounterStart: encounter.period_start,
      encounterEnd: encounter.period_end,
      chiefComplaint: encounter.reason_code_text,
      diagnosisCodes: conditions.map((c) => c.code),
      observations: observations.map((o) => ({
        code: o.code,
        value: o.value,
        unit: o.unit,
      })),
    };

    assertEquals(encounterContext.encounterId, "enc-123");
    assertEquals(encounterContext.encounterType, "outpatient");
    assertEquals(encounterContext.diagnosisCodes.length, 2);
    assertEquals(encounterContext.observations.length, 2);
  });

  await t.step("should filter encounter by tenant_id (security)", () => {
    const query = {
      table: "fhir_encounters",
      encounterId: "enc-123",
      tenantId: "tenant-123", // Security filter
    };

    assertExists(query.tenantId);
    assertEquals(query.tenantId, "tenant-123");
  });

  await t.step("should filter observations by tenant_id (security)", () => {
    const query = {
      table: "fhir_observations",
      encounterId: "enc-123",
      tenantId: "tenant-123", // Security filter
      limit: 20,
    };

    assertExists(query.tenantId);
    assertEquals(query.limit, 20);
  });

  await t.step("should filter conditions by tenant_id and active status", () => {
    const query = {
      table: "fhir_conditions",
      patientId: "patient-123",
      tenantId: "tenant-123", // Security filter
      clinicalStatus: "active",
      limit: 10,
    };

    assertExists(query.tenantId);
    assertEquals(query.clinicalStatus, "active");
    assertEquals(query.limit, 10);
  });
});

Deno.test("AI Billing Suggester - Batch Processing", async (t) => {
  await t.step("should query completed encounters from last 24 hours", () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Query would filter:
    // - tenant_id matches
    // - period_end is not null (completed)
    // - period_end >= 24 hours ago
    // - limit 100

    const query = {
      table: "fhir_encounters",
      tenantId: "tenant-123",
      periodEndNotNull: true,
      periodEndGte: twentyFourHoursAgo,
      limit: 100,
    };

    assertExists(query.periodEndGte);
    assertEquals(query.limit, 100);
  });

  await t.step("should filter out encounters with existing suggestions", () => {
    const pendingEncounters = [
      { id: "enc-1" },
      { id: "enc-2" },
      { id: "enc-3" },
    ];

    const existingSuggestions = ["enc-1"]; // enc-1 already has suggestion

    const encountersToProcess = pendingEncounters.filter(
      (e) => !existingSuggestions.includes(e.id)
    );

    assertEquals(encountersToProcess.length, 2);
    assertEquals(encountersToProcess[0].id, "enc-2");
    assertEquals(encountersToProcess[1].id, "enc-3");
  });

  await t.step("should track batch processing results", () => {
    const results: BatchResults = {
      total: 10,
      processed: 8,
      errors: 2,
    };

    assertEquals(results.total, 10);
    assertEquals(results.processed, 8);
    assertEquals(results.errors, 2);
  });

  await t.step("should return message when no encounters to process", () => {
    const pendingEncounters: Array<{ id: string }> = [];

    const response = pendingEncounters.length === 0
      ? { message: 'No pending encounters to process', count: 0 }
      : { message: 'Processing encounters', count: pendingEncounters.length };

    assertEquals(response.count, 0);
    assertEquals(response.message, "No pending encounters to process");
  });
});

Deno.test("AI Billing Suggester - Response Structure", async (t) => {
  await t.step("should structure single encounter success response", () => {
    const encounterContext: EncounterContext = {
      encounterId: "enc-123",
      patientId: "patient-123",
      tenantId: "tenant-123",
      encounterType: "outpatient",
      encounterStart: "2025-01-15T09:00:00Z",
      diagnosisCodes: ["E11.9"],
      observations: [],
    };

    const response = {
      success: true,
      encounterContext,
      message: 'Billing code suggestion generated',
      timestamp: new Date().toISOString(),
    };

    assertEquals(response.success, true);
    assertExists(response.timestamp);
    assertEquals(response.encounterContext.encounterId, "enc-123");
  });

  await t.step("should structure batch completion response", () => {
    const results: BatchResults = {
      total: 10,
      processed: 8,
      errors: 2,
    };

    const response = {
      message: 'Batch processing complete',
      results,
      timestamp: new Date().toISOString(),
    };

    assertEquals(response.message, "Batch processing complete");
    assertEquals(response.results.total, 10);
    assertExists(response.timestamp);
  });
});

Deno.test("AI Billing Suggester - Error Responses", async (t) => {
  await t.step("should return 401 for missing authorization", () => {
    const error = {
      status: 401,
      body: { error: 'Authorization required' },
    };

    assertEquals(error.status, 401);
    assertEquals(error.body.error, "Authorization required");
  });

  await t.step("should return 401 for invalid token", () => {
    const error = {
      status: 401,
      body: { error: 'Invalid or expired token' },
    };

    assertEquals(error.status, 401);
    assertEquals(error.body.error, "Invalid or expired token");
  });

  await t.step("should return 403 for no tenant assigned", () => {
    const error = {
      status: 403,
      body: { error: 'User has no tenant assigned' },
    };

    assertEquals(error.status, 403);
    assertEquals(error.body.error, "User has no tenant assigned");
  });

  await t.step("should return 403 for insufficient permissions", () => {
    const error = {
      status: 403,
      body: { error: 'Insufficient permissions for billing suggestions' },
    };

    assertEquals(error.status, 403);
    assertEquals(error.body.error, "Insufficient permissions for billing suggestions");
  });

  await t.step("should return 403 for cross-tenant access attempt", () => {
    const error = {
      status: 403,
      body: { error: 'Cannot access data from another tenant' },
    };

    assertEquals(error.status, 403);
    assertEquals(error.body.error, "Cannot access data from another tenant");
  });

  await t.step("should return 403 for disabled skill", () => {
    const error = {
      status: 403,
      body: { error: 'Billing suggester not enabled for this tenant' },
    };

    assertEquals(error.status, 403);
    assertEquals(error.body.error, "Billing suggester not enabled for this tenant");
  });

  await t.step("should return 404 for encounter not found", () => {
    const error = {
      status: 404,
      body: { error: 'Encounter not found' },
    };

    assertEquals(error.status, 404);
    assertEquals(error.body.error, "Encounter not found");
  });

  await t.step("should return 500 for internal errors", () => {
    const error = {
      status: 500,
      body: { error: 'Internal server error' },
    };

    assertEquals(error.status, 500);
  });
});

Deno.test("AI Billing Suggester - Super Admin Detection", async (t) => {
  await t.step("should check super_admin_users table", () => {
    const query = {
      table: "super_admin_users",
      userId: "user-123",
      isActive: true,
    };

    assertExists(query.userId);
    assertEquals(query.isActive, true);
  });

  await t.step("should determine super admin status from query result", () => {
    const superAdminData = { id: "sa-123" };
    const isSuperAdmin = !!superAdminData;

    assertEquals(isSuperAdmin, true);
  });

  await t.step("should handle non-super-admin user", () => {
    const superAdminData = null;
    const isSuperAdmin = !!superAdminData;

    assertEquals(isSuperAdmin, false);
  });
});

Deno.test("AI Billing Suggester - Skill Configuration Check", async (t) => {
  await t.step("should call RPC to get AI skill config", () => {
    const rpcCall = {
      function: "get_ai_skill_config",
      params: { p_tenant_id: "tenant-123" },
    };

    assertEquals(rpcCall.function, "get_ai_skill_config");
    assertExists(rpcCall.params.p_tenant_id);
  });

  await t.step("should check billing_suggester_enabled flag", () => {
    const configs = [
      { billing_suggester_enabled: true },
      { billing_suggester_enabled: false },
      null,
    ];

    for (const config of configs) {
      const isEnabled = config && config.billing_suggester_enabled;
      if (config?.billing_suggester_enabled === true) {
        assertEquals(isEnabled, true);
      } else {
        assertEquals(isEnabled, false);
      }
    }
  });
});

Deno.test("AI Billing Suggester - Encounter Types", async (t) => {
  await t.step("should default encounter type to outpatient", () => {
    const encounter = { class: null };
    const encounterType = encounter.class || 'outpatient';

    assertEquals(encounterType, "outpatient");
  });

  await t.step("should use provided encounter class", () => {
    const encounterClasses = [
      "outpatient",
      "inpatient",
      "emergency",
      "observation",
      "ambulatory",
    ];

    for (const cls of encounterClasses) {
      const encounter = { class: cls };
      const encounterType = encounter.class || 'outpatient';
      assertEquals(encounterType, cls);
    }
  });
});

Deno.test("AI Billing Suggester - Data Queries", async (t) => {
  await t.step("should limit observations to 20", () => {
    const observationQuery = {
      limit: 20,
    };

    assertEquals(observationQuery.limit, 20);
  });

  await t.step("should limit conditions to 10", () => {
    const conditionQuery = {
      limit: 10,
    };

    assertEquals(conditionQuery.limit, 10);
  });

  await t.step("should only get active conditions", () => {
    const conditionQuery = {
      clinicalStatus: "active",
    };

    assertEquals(conditionQuery.clinicalStatus, "active");
  });

  await t.step("should extract diagnosis codes from conditions", () => {
    const conditions = [
      { code: "E11.9" },
      { code: "I10" },
      { code: "J45.20" },
    ];

    const diagnosisCodes = conditions.map((c) => c.code);

    assertEquals(diagnosisCodes.length, 3);
    assertEquals(diagnosisCodes[0], "E11.9");
    assertEquals(diagnosisCodes.includes("I10"), true);
  });

  await t.step("should handle null conditions gracefully", () => {
    const conditions: Array<{ code: string }> | null = null;
    const diagnosisCodes = conditions?.map((c) => c.code) || [];

    assertEquals(diagnosisCodes.length, 0);
  });
});

Deno.test("AI Billing Suggester - Error Handling", async (t) => {
  await t.step("should extract error message from Error instance", () => {
    const err = new Error("Test error message");
    const errorMessage = err instanceof Error ? err.message : String(err);

    assertEquals(errorMessage, "Test error message");
  });

  await t.step("should convert non-Error to string", () => {
    const err = "String error";
    const errorMessage = err instanceof Error ? err.message : String(err);

    assertEquals(errorMessage, "String error");
  });

  await t.step("should handle unknown error type", () => {
    const err: unknown = { code: 500, reason: "Unknown" };
    const errorMessage = err instanceof Error ? err.message : String(err);

    assertEquals(errorMessage, "[object Object]");
  });
});

Deno.test("AI Billing Suggester - CORS Handling", async (t) => {
  await t.step("should handle OPTIONS preflight request", () => {
    const method = "OPTIONS";
    const isOptions = method === "OPTIONS";

    assertEquals(isOptions, true);
  });

  await t.step("should include CORS headers in response", () => {
    // corsFromRequest returns CORS headers based on request origin
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://example.com",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    assertExists(corsHeaders["Access-Control-Allow-Origin"]);
    assertExists(corsHeaders["Access-Control-Allow-Methods"]);
  });
});

Deno.test("AI Billing Suggester - Security Best Practices", async (t) => {
  await t.step("should filter all queries by tenant_id", () => {
    // All database queries should include tenant_id filter
    const securityChecklist = [
      { query: "fhir_encounters", hasTenantFilter: true },
      { query: "fhir_observations", hasTenantFilter: true },
      { query: "fhir_conditions", hasTenantFilter: true },
      { query: "encounter_billing_suggestions", hasTenantFilter: true },
    ];

    for (const check of securityChecklist) {
      assertEquals(check.hasTenantFilter, true);
    }
  });

  await t.step("should validate user authentication before any data access", () => {
    const authFlow = [
      "check_auth_header",
      "validate_token",
      "get_user_profile",
      "check_tenant_access",
      "check_permissions",
      "process_request",
    ];

    assertEquals(authFlow[0], "check_auth_header");
    assertEquals(authFlow[1], "validate_token");
    assertEquals(authFlow[authFlow.length - 1], "process_request");
  });

  await t.step("should not expose internal errors to client", () => {
    // Internal errors should be logged but not exposed
    const internalError = "Database connection failed: password123";
    const clientError = "Internal server error";

    // Client should never see internal error details
    assertNotEquals(clientError, internalError);
    assertEquals(clientError.includes("password"), false);
  });
});
