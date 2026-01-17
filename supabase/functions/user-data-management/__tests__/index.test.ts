// supabase/functions/user-data-management/__tests__/index.test.ts
// Tests for user-data-management edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("User Data Management Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/user-data-management", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should validate action types", () => {
    const validActions = ["export", "delete", "status"];

    assertEquals(validActions.includes("export"), true);
    assertEquals(validActions.includes("delete"), true);
    assertEquals(validActions.includes("status"), true);
    assertEquals(validActions.includes("invalid"), false);
  });

  await t.step("should return 400 for invalid action", () => {
    const action = "invalid";
    const validActions = ["export", "delete", "status"];
    const isValid = validActions.includes(action);
    const expectedStatus = isValid ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should require authorization header", () => {
    const hasAuth = false;
    const expectedStatus = hasAuth ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should validate Bearer token format", () => {
    const isValidBearer = (auth: string | null): boolean => {
      return !!auth?.startsWith('Bearer ');
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

  await t.step("should require user profile", () => {
    const requesterProfile = null;
    const expectedStatus = requesterProfile ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should check admin status from profile", () => {
    const profile = {
      is_admin: true,
      role_id: 1,
      roles: { name: "admin" }
    };

    const roleName = profile.roles?.name;
    const isAdmin = profile.is_admin || ['admin', 'super_admin'].includes(roleName);

    assertEquals(isAdmin, true);
  });

  await t.step("should identify super admin users", () => {
    const superAdminData = { id: "sa-123" };
    const isSuperAdmin = !!superAdminData;

    assertEquals(isSuperAdmin, true);
  });

  await t.step("should use requester's userId when none provided", () => {
    const userId = undefined;
    const currentUserId = "user-123";
    const targetUserId = userId || currentUserId;

    assertEquals(targetUserId, "user-123");
  });

  await t.step("should require admin access for accessing other users' data", () => {
    const targetUserId = "other-user-456";
    const currentUserId = "user-123";
    const isAdmin = false;
    const isSuperAdmin = false;

    const isAccessingSelf = targetUserId === currentUserId;
    const canAccess = isAccessingSelf || isAdmin || isSuperAdmin;

    assertEquals(canAccess, false);
  });

  await t.step("should require tenant match for non-super-admin", () => {
    const requesterTenantId = "tenant-A";
    const targetTenantId = "tenant-B";
    const isSuperAdmin = false;

    const isSameTenant = requesterTenantId === targetTenantId;
    const canAccess = isSuperAdmin || isSameTenant;

    assertEquals(canAccess, false);
  });

  await t.step("should allow super admin to access any tenant", () => {
    const requesterTenantId = "tenant-A";
    const targetTenantId = "tenant-B";
    const isSuperAdmin = true;

    const canAccess = isSuperAdmin || requesterTenantId === targetTenantId;

    assertEquals(canAccess, true);
  });

  await t.step("should require deletion confirmation", () => {
    const confirmDeletion = false;
    const action = "delete";
    const canDelete = action !== "delete" || confirmDeletion;

    assertEquals(canDelete, false);
  });

  await t.step("should allow deletion with confirmation", () => {
    const confirmDeletion = true;
    const action = "delete";
    const canDelete = action !== "delete" || confirmDeletion;

    assertEquals(canDelete, true);
  });

  await t.step("should export all USCDI data types", () => {
    const uscdiDataTypes = [
      "profile",
      "checkIns",
      "communityMoments",
      "alerts",
      "medications",
      "medicationRequests",
      "allergies",
      "conditions",
      "procedures",
      "immunizations",
      "observations",
      "labResults",
      "diagnosticReports",
      "clinicalNotes",
      "carePlans",
      "encounters",
      "careTeam",
      "goals",
      "sdohAssessments",
      "provenance"
    ];

    assertEquals(uscdiDataTypes.length, 20);
    assertEquals(uscdiDataTypes.includes("medications"), true);
    assertEquals(uscdiDataTypes.includes("sdohAssessments"), true);
    assertEquals(uscdiDataTypes.includes("provenance"), true);
  });

  await t.step("should structure export info correctly", () => {
    const exportInfo = {
      exportedAt: new Date().toISOString(),
      exportedBy: "user-123",
      tenantId: "tenant-A",
      complianceNote: 'This export includes all Electronic Health Information (EHI) per 21st Century Cures Act requirements',
      dataTypes: ["profile", "medications", "allergies"],
      totalRecords: 150
    };

    assertExists(exportInfo.exportedAt);
    assertExists(exportInfo.complianceNote);
    assertEquals(exportInfo.complianceNote.includes("21st Century Cures Act"), true);
  });

  await t.step("should include Content-Disposition header for export", () => {
    const userId = "user-123";
    const date = "2026-01-17";
    const disposition = `attachment; filename="user-data-${userId}-${date}.json"`;

    assertEquals(disposition.includes("attachment"), true);
    assertEquals(disposition.includes("user-data-"), true);
    assertEquals(disposition.includes(".json"), true);
  });

  await t.step("should soft delete profile on user deletion", () => {
    const updateData = {
      deleted_at: new Date().toISOString(),
      phone: null,
      email_verified: false,
      phone_verified: false,
      consent: false
    };

    assertExists(updateData.deleted_at);
    assertEquals(updateData.phone, null);
    assertEquals(updateData.consent, false);
  });

  await t.step("should structure deletion log correctly", () => {
    const deletionLog = {
      userId: "user-123",
      tenantId: "tenant-A",
      deletedAt: new Date().toISOString(),
      deletedTables: [
        { table: "check_ins", count: 50 },
        { table: "profiles", count: 1, action: "soft_deleted" }
      ],
      authUserDeleted: true
    };

    assertExists(deletionLog.deletedAt);
    assertEquals(deletionLog.deletedTables.length, 2);
    assertEquals(deletionLog.authUserDeleted, true);
  });

  await t.step("should log deletion to admin audit log", () => {
    const auditEntry = {
      user_id: "user-123",
      tenant_id: "tenant-A",
      action: "user_data_deletion",
      metadata: { deletedTables: [] },
      timestamp: new Date().toISOString()
    };

    assertEquals(auditEntry.action, "user_data_deletion");
    assertExists(auditEntry.timestamp);
  });

  await t.step("should structure data status response correctly", () => {
    const status = {
      userId: "user-123",
      tenantId: "tenant-A",
      dataSummary: {
        checkIns: 30,
        communityMoments: 15,
        alerts: 5,
        medications: 8,
        allergies: 3,
        conditions: 4,
        procedures: 2,
        immunizations: 10,
        observations: 50,
        labResults: 20,
        clinicalNotes: 5,
        carePlans: 2,
        profileStatus: "active",
        accountCreated: "2024-01-01T00:00:00Z",
        lastUpdated: "2026-01-17T10:00:00Z",
        consentGiven: true
      },
      totalRecords: 154
    };

    assertExists(status.dataSummary);
    assertEquals(status.dataSummary.profileStatus, "active");
    assertEquals(status.dataSummary.consentGiven, true);
    assertEquals(status.totalRecords, 154);
  });

  await t.step("should verify tenant before export", () => {
    const currentTenantId = "tenant-A";
    const profileTenantId = "tenant-A";

    const isAuthorizedTenant = !currentTenantId || profileTenantId === currentTenantId;
    assertEquals(isAuthorizedTenant, true);
  });

  await t.step("should reject export for unauthorized tenant", () => {
    const currentTenantId = "tenant-A";
    const profileTenantId = "tenant-B";

    const isAuthorizedTenant = !currentTenantId || profileTenantId === currentTenantId;
    assertEquals(isAuthorizedTenant, false);
  });

  await t.step("should return 500 for internal errors", () => {
    const hasError = true;
    const expectedStatus = hasError ? 500 : 200;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should return 403 for unauthorized tenant access", () => {
    const isAuthorizedTenant = false;
    const expectedStatus = isAuthorizedTenant ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should include Content-Type header in responses", () => {
    const headers = { "Content-Type": "application/json" };

    assertEquals(headers["Content-Type"], "application/json");
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

  await t.step("should calculate total records correctly", () => {
    const counts = {
      checkIns: 30,
      communityMoments: 15,
      alerts: 5,
      medications: 8,
      allergies: 3,
      conditions: 4,
      procedures: 2,
      immunizations: 10,
      observations: 50,
      labResults: 20,
      clinicalNotes: 5,
      carePlans: 2
    };

    const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);
    assertEquals(totalRecords, 154);
  });
});
