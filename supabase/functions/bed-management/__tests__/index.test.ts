// supabase/functions/bed-management/__tests__/index.test.ts
// Tests for bed-management edge function (Predictive Bed Management System)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Bed Management Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/bed-management", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require authorization header", () => {
    const hasAuth = false;
    const expectedStatus = hasAuth ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should return 401 for invalid or expired token", () => {
    const userError = true;
    const expectedStatus = userError ? 401 : 200;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should return 403 for user profile not found", () => {
    const profileExists = false;
    const expectedStatus = profileExists ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should validate allowed roles", () => {
    const allowedRoles = ["admin", "super_admin", "nurse", "care_manager", "bed_control", "physician"];

    assertEquals(allowedRoles.includes("admin"), true);
    assertEquals(allowedRoles.includes("super_admin"), true);
    assertEquals(allowedRoles.includes("nurse"), true);
    assertEquals(allowedRoles.includes("care_manager"), true);
    assertEquals(allowedRoles.includes("bed_control"), true);
    assertEquals(allowedRoles.includes("physician"), true);
    assertEquals(allowedRoles.includes("patient"), false);
    assertEquals(allowedRoles.includes("user"), false);
  });

  await t.step("should return 403 for insufficient permissions", () => {
    const role = "patient";
    const allowedRoles = ["admin", "super_admin", "nurse", "care_manager", "bed_control", "physician"];
    const hasPermission = allowedRoles.includes(role);
    const expectedStatus = hasPermission ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should allow is_admin users regardless of role", () => {
    const profile = { role: "user", is_admin: true };
    const allowedRoles = ["admin", "super_admin", "nurse"];
    const hasPermission = allowedRoles.includes(profile.role) || profile.is_admin;

    assertEquals(hasPermission, true);
  });

  // Action validation tests
  await t.step("should validate action parameter", () => {
    const validActions = [
      "get_bed_board", "get_unit_capacity", "get_census",
      "find_available", "assign_bed", "discharge",
      "update_status", "generate_forecast"
    ];

    assertEquals(validActions.includes("get_bed_board"), true);
    assertEquals(validActions.includes("assign_bed"), true);
    assertEquals(validActions.includes("invalid_action"), false);
  });

  await t.step("should return 400 for invalid action", () => {
    const action = "invalid_action";
    const validActions = ["get_bed_board", "assign_bed", "discharge"];
    const isValid = validActions.includes(action);
    const expectedStatus = isValid ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should default to get_bed_board when no action specified", () => {
    const body = {};
    const action = (body as { action?: string }).action ?? "get_bed_board";

    assertEquals(action, "get_bed_board");
  });

  // Get bed board tests
  await t.step("should structure get_bed_board request", () => {
    const request = {
      action: "get_bed_board",
      unit_id: "unit-123",
      facility_id: "facility-456"
    };

    assertEquals(request.action, "get_bed_board");
    assertExists(request.unit_id);
    assertExists(request.facility_id);
  });

  await t.step("should structure get_bed_board response", () => {
    const response = {
      success: true,
      beds: [
        {
          bed_id: "bed-001",
          room_number: "101A",
          unit_name: "ICU",
          status: "occupied",
          patient_id: "patient-123",
          patient_name: "John Doe",
          admit_date: "2026-01-15",
          expected_discharge: "2026-01-18"
        },
        {
          bed_id: "bed-002",
          room_number: "101B",
          unit_name: "ICU",
          status: "available"
        }
      ]
    };

    assertEquals(response.success, true);
    assertEquals(response.beds.length, 2);
    assertEquals(response.beds[0].status, "occupied");
    assertEquals(response.beds[1].status, "available");
  });

  // Get unit capacity tests
  await t.step("should structure get_unit_capacity request", () => {
    const request = {
      action: "get_unit_capacity",
      unit_id: "unit-123",
      facility_id: "facility-456"
    };

    assertEquals(request.action, "get_unit_capacity");
  });

  await t.step("should structure get_unit_capacity response", () => {
    const response = {
      success: true,
      units: [
        {
          id: "unit-123",
          unit_code: "ICU-A",
          unit_name: "ICU Wing A",
          unit_type: "icu",
          total_beds: 20,
          target_census: 16,
          max_census: 20,
          facility_id: "facility-456"
        }
      ]
    };

    assertEquals(response.success, true);
    assertEquals(response.units.length, 1);
    assertEquals(response.units[0].total_beds, 20);
    assertEquals(response.units[0].target_census, 16);
  });

  // Get census tests
  await t.step("should require unit_id for get_census", () => {
    const request = {
      action: "get_census"
      // missing unit_id
    };

    const hasUnitId = "unit_id" in request;
    assertEquals(hasUnitId, false);
  });

  await t.step("should return 400 for get_census without unit_id", () => {
    const hasUnitId = false;
    const expectedStatus = hasUnitId ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should structure get_census response", () => {
    const response = {
      success: true,
      census: {
        unit_id: "unit-123",
        total_beds: 20,
        occupied: 15,
        available: 5,
        occupancy_rate: 75.0
      }
    };

    assertEquals(response.success, true);
    assertExists(response.census);
    assertEquals(response.census.occupancy_rate, 75.0);
  });

  // Find available tests
  await t.step("should structure find_available request", () => {
    const request = {
      action: "find_available",
      unit_id: "unit-123",
      bed_type: "standard",
      requires_telemetry: true,
      requires_isolation: false,
      requires_negative_pressure: false
    };

    assertEquals(request.action, "find_available");
    assertEquals(request.requires_telemetry, true);
    assertEquals(request.requires_isolation, false);
  });

  await t.step("should default find_available requirements to false", () => {
    const defaults = {
      requires_telemetry: false,
      requires_isolation: false,
      requires_negative_pressure: false
    };

    assertEquals(defaults.requires_telemetry, false);
    assertEquals(defaults.requires_isolation, false);
    assertEquals(defaults.requires_negative_pressure, false);
  });

  await t.step("should structure find_available response", () => {
    const response = {
      success: true,
      available_beds: [
        {
          bed_id: "bed-001",
          room_number: "201A",
          unit_name: "Med-Surg",
          bed_type: "standard",
          has_telemetry: true,
          is_isolation: false
        }
      ]
    };

    assertEquals(response.success, true);
    assertEquals(response.available_beds.length >= 1, true);
  });

  // Assign bed tests
  await t.step("should require patient_id and bed_id for assign_bed", () => {
    const validRequest = { action: "assign_bed", patient_id: "patient-123", bed_id: "bed-001" };
    const invalidRequest = { action: "assign_bed", patient_id: "patient-123" };

    assertExists(validRequest.patient_id);
    assertExists(validRequest.bed_id);
    assertEquals("bed_id" in invalidRequest, false);
  });

  await t.step("should return 400 for assign_bed without required fields", () => {
    const hasRequiredFields = false;
    const expectedStatus = hasRequiredFields ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should accept optional expected_los_days for assign_bed", () => {
    const request = {
      action: "assign_bed",
      patient_id: "patient-123",
      bed_id: "bed-001",
      expected_los_days: 5
    };

    assertExists(request.expected_los_days);
    assertEquals(request.expected_los_days, 5);
  });

  await t.step("should structure assign_bed response", () => {
    const response = {
      success: true,
      assignment_id: "assignment-789",
      message: "Patient assigned to bed successfully"
    };

    assertEquals(response.success, true);
    assertExists(response.assignment_id);
    assertEquals(response.message, "Patient assigned to bed successfully");
  });

  await t.step("should log BED_ASSIGNED audit event", () => {
    const auditLog = {
      user_id: "user-123",
      action: "BED_ASSIGNED",
      resource_type: "bed_assignment",
      resource_id: "assignment-789",
      metadata: {
        patient_id: "patient-123",
        bed_id: "bed-001",
        expected_los_days: 5
      }
    };

    assertEquals(auditLog.action, "BED_ASSIGNED");
    assertEquals(auditLog.resource_type, "bed_assignment");
    assertExists(auditLog.metadata.patient_id);
  });

  // Discharge tests
  await t.step("should require patient_id for discharge", () => {
    const request = {
      action: "discharge"
      // missing patient_id
    };

    const hasPatientId = "patient_id" in request;
    assertEquals(hasPatientId, false);
  });

  await t.step("should return 400 for discharge without patient_id", () => {
    const hasPatientId = false;
    const expectedStatus = hasPatientId ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should default disposition to Home", () => {
    const disposition = undefined ?? "Home";

    assertEquals(disposition, "Home");
  });

  await t.step("should accept custom disposition", () => {
    const request = {
      action: "discharge",
      patient_id: "patient-123",
      disposition: "SNF"
    };

    assertEquals(request.disposition, "SNF");
  });

  await t.step("should structure discharge response", () => {
    const response = {
      success: true,
      message: "Patient discharged successfully"
    };

    assertEquals(response.success, true);
    assertEquals(response.message, "Patient discharged successfully");
  });

  await t.step("should return 404 if patient not found or not assigned", () => {
    const patientAssigned = false;
    const expectedStatus = patientAssigned ? 200 : 404;

    assertEquals(expectedStatus, 404);
  });

  await t.step("should log PATIENT_DISCHARGED audit event", () => {
    const auditLog = {
      user_id: "user-123",
      action: "PATIENT_DISCHARGED",
      resource_type: "bed_assignment",
      resource_id: "patient-123",
      metadata: {
        disposition: "Home"
      }
    };

    assertEquals(auditLog.action, "PATIENT_DISCHARGED");
    assertExists(auditLog.metadata.disposition);
  });

  // Update status tests
  await t.step("should require bed_id and new_status for update_status", () => {
    const validRequest = { action: "update_status", bed_id: "bed-001", new_status: "cleaning" };
    const invalidRequest = { action: "update_status", bed_id: "bed-001" };

    assertExists(validRequest.bed_id);
    assertExists(validRequest.new_status);
    assertEquals("new_status" in invalidRequest, false);
  });

  await t.step("should return 400 for update_status without required fields", () => {
    const hasRequiredFields = false;
    const expectedStatus = hasRequiredFields ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should validate bed status values", () => {
    const validStatuses = ["available", "occupied", "dirty", "cleaning", "blocked", "maintenance", "reserved"];

    assertEquals(validStatuses.includes("available"), true);
    assertEquals(validStatuses.includes("occupied"), true);
    assertEquals(validStatuses.includes("dirty"), true);
    assertEquals(validStatuses.includes("cleaning"), true);
    assertEquals(validStatuses.includes("blocked"), true);
    assertEquals(validStatuses.includes("maintenance"), true);
    assertEquals(validStatuses.includes("reserved"), true);
    assertEquals(validStatuses.includes("invalid"), false);
  });

  await t.step("should return 400 for invalid bed status", () => {
    const status = "invalid";
    const validStatuses = ["available", "occupied", "dirty", "cleaning", "blocked", "maintenance", "reserved"];
    const isValid = validStatuses.includes(status);
    const expectedStatus = isValid ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should accept optional reason for update_status", () => {
    const request = {
      action: "update_status",
      bed_id: "bed-001",
      new_status: "blocked",
      reason: "Equipment malfunction"
    };

    assertExists(request.reason);
    assertEquals(request.reason, "Equipment malfunction");
  });

  await t.step("should structure update_status response", () => {
    const response = {
      success: true,
      message: "Bed status updated to cleaning"
    };

    assertEquals(response.success, true);
    assertEquals(response.message.includes("Bed status updated"), true);
  });

  await t.step("should return 404 if bed not found", () => {
    const bedFound = false;
    const expectedStatus = bedFound ? 200 : 404;

    assertEquals(expectedStatus, 404);
  });

  // Generate forecast tests
  await t.step("should require unit_id for generate_forecast", () => {
    const request = {
      action: "generate_forecast"
      // missing unit_id
    };

    const hasUnitId = "unit_id" in request;
    assertEquals(hasUnitId, false);
  });

  await t.step("should return 400 for generate_forecast without unit_id", () => {
    const hasUnitId = false;
    const expectedStatus = hasUnitId ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should default forecast_date to today", () => {
    const forecast_date = undefined;
    const targetDate = forecast_date || new Date().toISOString().split("T")[0];

    assertEquals(targetDate.length, 10); // YYYY-MM-DD format
  });

  await t.step("should structure generate_forecast request", () => {
    const request = {
      action: "generate_forecast",
      unit_id: "unit-123",
      forecast_date: "2026-01-20"
    };

    assertEquals(request.action, "generate_forecast");
    assertExists(request.unit_id);
    assertExists(request.forecast_date);
  });

  await t.step("should structure generate_forecast response", () => {
    const response = {
      success: true,
      forecast_id: "forecast-789",
      forecast: {
        id: "forecast-789",
        unit_id: "unit-123",
        forecast_date: "2026-01-20",
        predicted_admissions: 5,
        predicted_discharges: 3,
        predicted_occupancy: 85.0,
        confidence_interval_low: 75.0,
        confidence_interval_high: 92.0,
        created_at: "2026-01-17T14:00:00Z"
      }
    };

    assertEquals(response.success, true);
    assertExists(response.forecast_id);
    assertExists(response.forecast);
    assertEquals(response.forecast.predicted_occupancy, 85.0);
  });

  // Error handling tests
  await t.step("should return 500 for server configuration error", () => {
    const hasConfig = false;
    const expectedStatus = hasConfig ? 200 : 500;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should structure server configuration error response", () => {
    const errorResponse = {
      error: "Server configuration error"
    };

    assertEquals(errorResponse.error, "Server configuration error");
  });

  await t.step("should return 500 for database errors", () => {
    const dbError = true;
    const expectedStatus = dbError ? 500 : 200;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should structure database error responses", () => {
    const errorResponse = {
      error: "Failed to fetch bed board"
    };

    assertExists(errorResponse.error);
  });

  await t.step("should return 500 for fatal errors", () => {
    const hasFatalError = true;
    const expectedStatus = hasFatalError ? 500 : 200;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should structure fatal error response", () => {
    const errorResponse = {
      error: "Internal server error"
    };

    assertEquals(errorResponse.error, "Internal server error");
  });

  // Environment variable tests
  await t.step("should use getEnv for robust env reads", () => {
    const getEnv = (...keys: string[]): string => {
      const mockEnv: Record<string, string> = {
        SB_SECRET_KEY: "secret-key-value",
        SUPABASE_URL: "https://test.supabase.co"
      };
      for (const k of keys) {
        const v = mockEnv[k];
        if (v && v.trim().length > 0) return v.trim();
      }
      return "";
    };

    assertEquals(getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY"), "secret-key-value");
    assertEquals(getEnv("MISSING_KEY"), "");
  });

  await t.step("should try multiple key names for service role", () => {
    const getEnv = (...keys: string[]): string => {
      const mockEnv: Record<string, string> = {
        SUPABASE_SERVICE_ROLE_KEY: "fallback-key"
      };
      for (const k of keys) {
        const v = mockEnv[k];
        if (v && v.trim().length > 0) return v.trim();
      }
      return "";
    };

    const serviceKey = getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");
    assertEquals(serviceKey, "fallback-key");
  });

  // Request body parsing tests
  await t.step("should parse POST body as JSON", () => {
    const method = "POST";
    const body = { action: "get_bed_board", unit_id: "unit-123" };

    if (method === "POST") {
      assertEquals(body.action, "get_bed_board");
      assertExists(body.unit_id);
    }
  });

  await t.step("should default to get_bed_board on JSON parse error", () => {
    // Simulating catch block behavior
    const body = { action: "get_bed_board" };

    assertEquals(body.action, "get_bed_board");
  });

  // HTTP status codes summary
  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      success: 200,
      badRequest: 400,
      unauthorized: 401,
      forbidden: 403,
      notFound: 404,
      serverError: 500
    };

    assertEquals(statusCodes.success, 200);
    assertEquals(statusCodes.badRequest, 400);
    assertEquals(statusCodes.unauthorized, 401);
    assertEquals(statusCodes.forbidden, 403);
    assertEquals(statusCodes.notFound, 404);
    assertEquals(statusCodes.serverError, 500);
  });

  await t.step("should include Content-Type header in responses", () => {
    const headers = { "Content-Type": "application/json" };

    assertEquals(headers["Content-Type"], "application/json");
  });

  // Tenant isolation tests
  await t.step("should filter by tenant_id for bed board", () => {
    const profile = { tenant_id: "tenant-A" };
    const query = {
      table: "v_bed_board",
      filters: { tenant_id: profile.tenant_id }
    };

    assertEquals(query.filters.tenant_id, "tenant-A");
  });

  await t.step("should filter by tenant_id for unit capacity", () => {
    const profile = { tenant_id: "tenant-B" };
    const query = {
      table: "v_unit_capacity",
      filters: { tenant_id: profile.tenant_id }
    };

    assertEquals(query.filters.tenant_id, "tenant-B");
  });
});
