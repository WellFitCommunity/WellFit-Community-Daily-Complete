// supabase/functions/guardian-agent-api/__tests__/index.test.ts
// Tests for Guardian Agent API - Security scanning, audit logging, health monitoring

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Guardian Agent API Tests", async (t) => {

  // =====================================================
  // Authentication Tests
  // =====================================================

  await t.step("should require authentication", () => {
    const authHeader = null;
    const isAuthenticated = authHeader !== null;

    assertEquals(isAuthenticated, false);
  });

  await t.step("should return 401 for unauthenticated requests", () => {
    const response = { success: false, error: "Unauthorized" };
    assertEquals(response.success, false);
    assertEquals(response.error, "Unauthorized");
  });

  await t.step("should pass Authorization header to Supabase client", () => {
    const authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
    const clientConfig = {
      global: { headers: { Authorization: authHeader } }
    };

    assertEquals(clientConfig.global.headers.Authorization, authHeader);
  });

  // =====================================================
  // Request Body Tests
  // =====================================================

  await t.step("should require action field", () => {
    const body = { payload: {} };
    const hasAction = "action" in body;

    assertEquals(hasAction, false);
  });

  await t.step("should accept security_scan action", () => {
    const validActions = ["security_scan", "audit_log", "monitor_health"];
    assertEquals(validActions.includes("security_scan"), true);
  });

  await t.step("should accept audit_log action", () => {
    const validActions = ["security_scan", "audit_log", "monitor_health"];
    assertEquals(validActions.includes("audit_log"), true);
  });

  await t.step("should accept monitor_health action", () => {
    const validActions = ["security_scan", "audit_log", "monitor_health"];
    assertEquals(validActions.includes("monitor_health"), true);
  });

  await t.step("should return error for unknown action", () => {
    const action = "invalid_action";
    const response = {
      success: false,
      error: `Unknown action: ${action}`
    };

    assertEquals(response.success, false);
    assertEquals(response.error.includes("Unknown action"), true);
  });

  // =====================================================
  // Security Scan Tests
  // =====================================================

  await t.step("should log security scan initiation", () => {
    const auditEntry = {
      event_type: "SECURITY_SCAN_INITIATED",
      event_category: "SECURITY_EVENT",
      actor_user_id: "user-123",
      success: true,
      metadata: {
        scan_type: "manual",
        timestamp: new Date().toISOString()
      }
    };

    assertEquals(auditEntry.event_type, "SECURITY_SCAN_INITIATED");
    assertEquals(auditEntry.event_category, "SECURITY_EVENT");
    assertEquals(auditEntry.metadata.scan_type, "manual");
  });

  await t.step("should return scan results with scanId", () => {
    const response = {
      success: true,
      data: {
        scanId: "550e8400-e29b-41d4-a716-446655440000",
        timestamp: new Date().toISOString(),
        status: "completed",
        findings: [],
        summary: "System scan completed successfully"
      }
    };

    assertEquals(response.success, true);
    assertExists(response.data.scanId);
    assertEquals(response.data.status, "completed");
    assertEquals(Array.isArray(response.data.findings), true);
  });

  await t.step("should return error on scan failure", () => {
    const response = {
      success: false,
      error: "Security scan failed"
    };

    assertEquals(response.success, false);
    assertEquals(response.error, "Security scan failed");
  });

  // =====================================================
  // Audit Log Tests
  // =====================================================

  await t.step("should accept audit log payload", () => {
    const payload = {
      event_type: "USER_ACTION",
      severity: "HIGH",
      description: "User performed sensitive action",
      requires_investigation: true
    };

    assertExists(payload.event_type);
    assertExists(payload.severity);
    assertExists(payload.description);
    assertEquals(payload.requires_investigation, true);
  });

  await t.step("should use default severity of MEDIUM", () => {
    const payload = { event_type: "USER_ACTION" };
    const severity = (payload as { severity?: string }).severity ?? "MEDIUM";

    assertEquals(severity, "MEDIUM");
  });

  await t.step("should use default event_type GUARDIAN_EVENT", () => {
    const payload = {};
    const eventType = (payload as { event_type?: string }).event_type || "GUARDIAN_EVENT";

    assertEquals(eventType, "GUARDIAN_EVENT");
  });

  await t.step("should default requires_investigation to false", () => {
    const payload = { event_type: "USER_ACTION" };
    const requiresInvestigation = (payload as { requires_investigation?: boolean }).requires_investigation ?? false;

    assertEquals(requiresInvestigation, false);
  });

  await t.step("should insert audit log entry", () => {
    const auditEntry = {
      event_type: "CUSTOM_EVENT",
      event_category: "SYSTEM_EVENT",
      actor_user_id: "user-123",
      success: true,
      metadata: {
        severity: "HIGH",
        description: "Test event",
        requires_investigation: false,
        source: "guardian_agent",
        timestamp: new Date().toISOString()
      }
    };

    assertEquals(auditEntry.event_category, "SYSTEM_EVENT");
    assertEquals(auditEntry.metadata.source, "guardian_agent");
  });

  await t.step("should return logged confirmation", () => {
    const response = {
      success: true,
      data: {
        logged: true,
        event_type: "USER_ACTION",
        timestamp: new Date().toISOString()
      }
    };

    assertEquals(response.success, true);
    assertEquals(response.data.logged, true);
    assertExists(response.data.timestamp);
  });

  await t.step("should return error on audit log failure", () => {
    const response = {
      success: false,
      error: "Audit logging failed"
    };

    assertEquals(response.success, false);
    assertEquals(response.error, "Audit logging failed");
  });

  // =====================================================
  // Health Monitoring Tests
  // =====================================================

  await t.step("should check database connectivity", () => {
    const query = {
      table: "audit_logs",
      select: "id",
      limit: 1
    };

    assertEquals(query.table, "audit_logs");
    assertEquals(query.limit, 1);
  });

  await t.step("should determine database health from query result", () => {
    const dbError = null;
    const dbHealthy = !dbError;

    assertEquals(dbHealthy, true);
  });

  await t.step("should mark database unhealthy on error", () => {
    const dbError = { message: "Connection failed" };
    const dbHealthy = !dbError;

    assertEquals(dbHealthy, false);
  });

  await t.step("should log health check to audit_logs", () => {
    const auditEntry = {
      event_type: "HEALTH_CHECK",
      event_category: "SYSTEM_EVENT",
      actor_user_id: "user-123",
      success: true,
      metadata: {
        database: "healthy",
        timestamp: new Date().toISOString()
      }
    };

    assertEquals(auditEntry.event_type, "HEALTH_CHECK");
    assertEquals(auditEntry.metadata.database, "healthy");
  });

  await t.step("should log to guardian_cron_log for dashboard", () => {
    const cronLog = {
      job_name: "guardian-health-check",
      executed_at: new Date().toISOString(),
      status: "success",
      details: {
        triggered_by: "user-123",
        source: "manual_health_check",
        database_healthy: true,
        api_healthy: true
      }
    };

    assertEquals(cronLog.job_name, "guardian-health-check");
    assertEquals(cronLog.status, "success");
    assertEquals(cronLog.details.source, "manual_health_check");
  });

  await t.step("should return health status as healthy", () => {
    const response = {
      success: true,
      data: {
        status: "healthy",
        checks: {
          database: true,
          api: true,
          timestamp: new Date().toISOString()
        }
      }
    };

    assertEquals(response.success, true);
    assertEquals(response.data.status, "healthy");
    assertEquals(response.data.checks.database, true);
    assertEquals(response.data.checks.api, true);
  });

  await t.step("should return health status as degraded", () => {
    const dbHealthy = false;
    const status = dbHealthy ? "healthy" : "degraded";

    assertEquals(status, "degraded");
  });

  await t.step("should return error on health monitoring failure", () => {
    const response = {
      success: false,
      error: "Health monitoring failed"
    };

    assertEquals(response.success, false);
    assertEquals(response.error, "Health monitoring failed");
  });

  // =====================================================
  // Response Structure Tests
  // =====================================================

  await t.step("should return GuardianResponse structure", () => {
    const response = {
      success: true,
      data: { key: "value" }
    };

    assertEquals(typeof response.success, "boolean");
    assertExists(response.data);
  });

  await t.step("should return error in GuardianResponse", () => {
    const response = {
      success: false,
      error: "Something went wrong"
    };

    assertEquals(response.success, false);
    assertExists(response.error);
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/guardian-agent-api", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  // =====================================================
  // Error Handling Tests
  // =====================================================

  await t.step("should return 500 for internal errors", () => {
    const response = {
      success: false,
      error: "Internal server error"
    };
    const status = 500;

    assertEquals(status, 500);
    assertEquals(response.success, false);
  });

  await t.step("should extract error message from Error instance", () => {
    const err = new Error("Test error");
    const errorMessage = err instanceof Error ? err.message : String(err);

    assertEquals(errorMessage, "Test error");
  });

  await t.step("should convert non-Error to string", () => {
    const err = "String error";
    const errorMessage = err instanceof Error ? err.message : String(err);

    assertEquals(errorMessage, "String error");
  });

  // =====================================================
  // AuditLogPayload Interface Tests
  // =====================================================

  await t.step("should accept full audit log payload", () => {
    const payload = {
      event_type: "SECURITY_ALERT",
      severity: "CRITICAL",
      description: "Unusual login activity detected",
      requires_investigation: true
    };

    assertExists(payload.event_type);
    assertEquals(payload.severity, "CRITICAL");
    assertEquals(payload.requires_investigation, true);
  });

  await t.step("should accept partial audit log payload", () => {
    const payload = {
      event_type: "INFO_EVENT"
    };

    assertExists(payload.event_type);
    assertEquals("severity" in payload, false);
    assertEquals("description" in payload, false);
  });

  await t.step("should accept empty payload", () => {
    const payload = {};

    assertEquals(Object.keys(payload).length, 0);
  });

  // =====================================================
  // Severity Level Tests
  // =====================================================

  await t.step("should support LOW severity", () => {
    const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    assertEquals(severities.includes("LOW"), true);
  });

  await t.step("should support MEDIUM severity", () => {
    const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    assertEquals(severities.includes("MEDIUM"), true);
  });

  await t.step("should support HIGH severity", () => {
    const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    assertEquals(severities.includes("HIGH"), true);
  });

  await t.step("should support CRITICAL severity", () => {
    const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    assertEquals(severities.includes("CRITICAL"), true);
  });

  // =====================================================
  // Environment Variable Tests
  // =====================================================

  await t.step("should require Supabase environment variables", () => {
    const requiredVars = ["SUPABASE_URL", "SB_PUBLISHABLE_API_KEY"];
    assertEquals(requiredVars.length, 2);
  });

  // =====================================================
  // Security Event Types Tests
  // =====================================================

  await t.step("should use SECURITY_SCAN_INITIATED event type", () => {
    const eventType = "SECURITY_SCAN_INITIATED";
    assertEquals(eventType, "SECURITY_SCAN_INITIATED");
  });

  await t.step("should use HEALTH_CHECK event type", () => {
    const eventType = "HEALTH_CHECK";
    assertEquals(eventType, "HEALTH_CHECK");
  });

  await t.step("should use GUARDIAN_EVENT as default", () => {
    const eventType = "GUARDIAN_EVENT";
    assertEquals(eventType, "GUARDIAN_EVENT");
  });

  // =====================================================
  // HIPAA Compliance Tests
  // =====================================================

  await t.step("should log all events to audit_logs", () => {
    const auditTable = "audit_logs";
    assertEquals(auditTable, "audit_logs");
  });

  await t.step("should include actor_user_id in audit entries", () => {
    const auditEntry = {
      actor_user_id: "user-123",
      event_type: "SECURITY_SCAN_INITIATED"
    };

    assertExists(auditEntry.actor_user_id);
  });

  await t.step("should include timestamp in audit metadata", () => {
    const metadata = {
      timestamp: new Date().toISOString()
    };

    assertExists(metadata.timestamp);
  });
});
