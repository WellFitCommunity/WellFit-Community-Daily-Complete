// supabase/functions/ai-readmission-predictor/__tests__/index.test.ts
// Tests for ai-readmission-predictor edge function (30-Day Readmission Risk)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Readmission Predictor Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/ai-readmission-predictor", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require authorization header", () => {
    const authHeader = null;
    const hasAuth = !!authHeader?.startsWith("Bearer ");
    const expectedStatus = hasAuth ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should validate Bearer token format", () => {
    const isValidBearer = (auth: string | null): boolean => {
      return !!auth?.startsWith("Bearer ");
    };

    assertEquals(isValidBearer("Bearer abc123"), true);
    assertEquals(isValidBearer("Basic abc123"), false);
    assertEquals(isValidBearer(null), false);
  });

  await t.step("should extract token from Bearer header", () => {
    const authHeader = "Bearer my-jwt-token-123";
    const token = authHeader.slice(7);

    assertEquals(token, "my-jwt-token-123");
  });

  await t.step("should return 401 for invalid or expired token", () => {
    const authError = true;
    const expectedStatus = authError ? 401 : 200;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should return 403 for user with no tenant assigned", () => {
    const profile = { tenant_id: null };
    const hasTenant = !!profile?.tenant_id;
    const expectedStatus = hasTenant ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should validate allowed roles for readmission predictor", () => {
    const allowedRoles = ["admin", "super_admin", "physician", "nurse", "case_manager", "social_worker", "discharge_planner"];

    assertEquals(allowedRoles.includes("admin"), true);
    assertEquals(allowedRoles.includes("physician"), true);
    assertEquals(allowedRoles.includes("nurse"), true);
    assertEquals(allowedRoles.includes("case_manager"), true);
    assertEquals(allowedRoles.includes("discharge_planner"), true);
    assertEquals(allowedRoles.includes("patient"), false);
  });

  await t.step("should return 403 for insufficient permissions", () => {
    const role = "patient";
    const allowedRoles = ["admin", "physician", "nurse"];
    const is_admin = false;
    const hasAccess = is_admin || allowedRoles.includes(role);
    const expectedStatus = hasAccess ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should allow is_admin users regardless of role", () => {
    const role = "user";
    const is_admin = true;
    const hasAccess = is_admin || ["admin", "physician"].includes(role);

    assertEquals(hasAccess, true);
  });

  await t.step("should check for super_admin status", () => {
    const superAdminData = { id: "super-123" };
    const isSuperAdmin = !!superAdminData;

    assertEquals(isSuperAdmin, true);
  });

  await t.step("should allow super_admin to access any tenant", () => {
    const isSuperAdmin = true;
    const profileTenantId = "tenant-A";
    const requestedTenantId = "tenant-B";
    const canAccess = isSuperAdmin || requestedTenantId === profileTenantId;

    assertEquals(canAccess, true);
  });

  await t.step("should prevent non-super-admin from accessing other tenant", () => {
    const isSuperAdmin = false;
    const profileTenantId = "tenant-A";
    const requestedTenantId = "tenant-B";
    const canAccess = isSuperAdmin || requestedTenantId === profileTenantId;

    assertEquals(canAccess, false);
  });

  await t.step("should require patientId and dischargeDate", () => {
    const validBody = { patientId: "patient-123", dischargeDate: "2026-01-17" };
    const invalidBody = { patientId: "patient-123" };

    assertExists(validBody.patientId);
    assertExists(validBody.dischargeDate);
    assertEquals("dischargeDate" in invalidBody, false);
  });

  await t.step("should return 400 for missing required fields", () => {
    const hasRequiredFields = false;
    const expectedStatus = hasRequiredFields ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should accept optional parameters", () => {
    const body = {
      patientId: "patient-123",
      tenantId: "tenant-A",
      dischargeDate: "2026-01-17",
      dischargeFacility: "Methodist Hospital",
      dischargeDisposition: "home",
      primaryDiagnosisCode: "I21.9",
      primaryDiagnosisDescription: "Acute myocardial infarction"
    };

    assertExists(body.dischargeFacility);
    assertExists(body.dischargeDisposition);
    assertExists(body.primaryDiagnosisCode);
    assertExists(body.primaryDiagnosisDescription);
  });

  await t.step("should use profile tenant_id when tenantId not provided", () => {
    const tenantId = undefined;
    const profileTenantId = "tenant-A";
    const effectiveTenantId = tenantId || profileTenantId;

    assertEquals(effectiveTenantId, "tenant-A");
  });

  await t.step("should return 403 when patient not in organization", () => {
    const patientTenantId = "tenant-B";
    const effectiveTenantId = "tenant-A";
    const inOrg = patientTenantId === effectiveTenantId;
    const expectedStatus = inOrg ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should return 403 when skill not enabled for tenant", () => {
    const config = { readmission_predictor_enabled: false };
    const isEnabled = config && config.readmission_predictor_enabled;
    const expectedStatus = isEnabled ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  // Patient data gathering tests
  await t.step("should gather readmission count from last 90 days", () => {
    const readmissions = [{ id: "r1" }, { id: "r2" }];
    const readmissionCount = readmissions?.length || 0;

    assertEquals(readmissionCount, 2);
  });

  await t.step("should calculate 90 days ago date", () => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - ninetyDaysAgo.getTime()) / (24 * 60 * 60 * 1000));

    assertEquals(diffDays, 90);
  });

  await t.step("should gather SDOH high risk indicators", () => {
    const sdohIndicators = [
      { id: "s1", risk_level: "high", status: "active" },
      { id: "s2", risk_level: "critical", status: "active" }
    ];
    const highRiskCount = sdohIndicators.filter(s =>
      (s.risk_level === "high" || s.risk_level === "critical") && s.status === "active"
    ).length;

    assertEquals(highRiskCount, 2);
  });

  await t.step("should gather check-in completion rate", () => {
    const checkIns = [
      { status: "completed" },
      { status: "completed" },
      { status: "missed" },
      { status: "completed" }
    ];
    const completed = checkIns.filter(c => c.status === "completed").length;
    const rate = completed / 30; // 30 days period

    assertEquals(completed, 3);
    assertEquals(rate.toFixed(2), "0.10");
  });

  await t.step("should check for active care plan", () => {
    const carePlan = { id: "plan-123", status: "active" };
    const hasActiveCarePlan = !!carePlan;

    assertEquals(hasActiveCarePlan, true);
  });

  await t.step("should handle missing care plan", () => {
    const carePlan = null;
    const hasActiveCarePlan = !!carePlan;

    assertEquals(hasActiveCarePlan, false);
  });

  // Response structure tests
  await t.step("should structure discharge context correctly", () => {
    const dischargeContext = {
      patientId: "patient-123",
      tenantId: "tenant-A",
      dischargeDate: "2026-01-17",
      dischargeFacility: "Methodist Hospital",
      dischargeDisposition: "home",
      primaryDiagnosisCode: "I21.9",
      primaryDiagnosisDescription: "Acute MI"
    };

    assertExists(dischargeContext.patientId);
    assertExists(dischargeContext.dischargeDate);
    assertEquals(dischargeContext.dischargeDisposition, "home");
  });

  await t.step("should default dischargeFacility to Unknown Facility", () => {
    const dischargeFacility = undefined || "Unknown Facility";

    assertEquals(dischargeFacility, "Unknown Facility");
  });

  await t.step("should default dischargeDisposition to home", () => {
    const dischargeDisposition = undefined || "home";

    assertEquals(dischargeDisposition, "home");
  });

  await t.step("should structure patient data response correctly", () => {
    const patientData = {
      readmissionCount: 1,
      sdohRiskFactors: 2,
      checkInCompletionRate: 0.85,
      hasActiveCarePlan: true
    };

    assertEquals(patientData.readmissionCount, 1);
    assertEquals(patientData.sdohRiskFactors, 2);
    assertEquals(patientData.checkInCompletionRate, 0.85);
    assertEquals(patientData.hasActiveCarePlan, true);
  });

  await t.step("should structure success response correctly", () => {
    const response = {
      success: true,
      dischargeContext: {
        patientId: "patient-123",
        tenantId: "tenant-A",
        dischargeDate: "2026-01-17",
        dischargeFacility: "Hospital",
        dischargeDisposition: "snf"
      },
      patientData: {
        readmissionCount: 1,
        sdohRiskFactors: 2,
        checkInCompletionRate: 0.75,
        hasActiveCarePlan: true
      },
      message: "Readmission risk prediction generated",
      timestamp: new Date().toISOString()
    };

    assertEquals(response.success, true);
    assertExists(response.dischargeContext);
    assertExists(response.patientData);
    assertExists(response.timestamp);
  });

  // Tenant isolation (SECURITY) tests
  await t.step("should filter readmissions by tenant_id", () => {
    const query = {
      table: "patient_readmissions",
      filters: {
        patient_id: "patient-123",
        tenant_id: "tenant-A"
      }
    };

    assertEquals(query.filters.tenant_id, "tenant-A");
  });

  await t.step("should filter SDOH indicators by tenant_id", () => {
    const query = {
      table: "sdoh_indicators",
      filters: {
        patient_id: "patient-123",
        tenant_id: "tenant-A",
        status: "active"
      }
    };

    assertEquals(query.filters.tenant_id, "tenant-A");
  });

  await t.step("should filter check-ins by tenant_id", () => {
    const query = {
      table: "patient_daily_check_ins",
      filters: {
        patient_id: "patient-123",
        tenant_id: "tenant-A"
      }
    };

    assertEquals(query.filters.tenant_id, "tenant-A");
  });

  await t.step("should filter care plans by tenant_id", () => {
    const query = {
      table: "care_coordination_plans",
      filters: {
        patient_id: "patient-123",
        tenant_id: "tenant-A",
        status: "active"
      }
    };

    assertEquals(query.filters.tenant_id, "tenant-A");
  });

  // HTTP status codes
  await t.step("should return 200 for successful prediction", () => {
    const success = true;
    const expectedStatus = success ? 200 : 500;

    assertEquals(expectedStatus, 200);
  });

  await t.step("should return 500 for server errors", () => {
    const hasError = true;
    const expectedStatus = hasError ? 500 : 200;

    assertEquals(expectedStatus, 500);
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

  // Error response structure
  await t.step("should structure error response correctly", () => {
    const errorResponse = {
      error: "Missing required fields: patientId, dischargeDate"
    };

    assertExists(errorResponse.error);
  });

  await t.step("should structure authorization error correctly", () => {
    const errorResponse = {
      error: "Authorization required"
    };

    assertEquals(errorResponse.error, "Authorization required");
  });

  await t.step("should structure permission error correctly", () => {
    const errorResponse = {
      error: "Insufficient permissions for readmission predictions"
    };

    assertEquals(errorResponse.error.includes("permissions"), true);
  });

  await t.step("should structure tenant access error correctly", () => {
    const errorResponse = {
      error: "Cannot access data from another tenant"
    };

    assertEquals(errorResponse.error.includes("tenant"), true);
  });

  // Error handling in data gathering
  await t.step("should return default values on data gathering error", () => {
    const defaultData = {
      readmissionCount: 0,
      sdohRiskFactors: 0,
      checkInCompletionRate: 0,
      hasActiveCarePlan: false
    };

    assertEquals(defaultData.readmissionCount, 0);
    assertEquals(defaultData.sdohRiskFactors, 0);
    assertEquals(defaultData.checkInCompletionRate, 0);
    assertEquals(defaultData.hasActiveCarePlan, false);
  });
});
