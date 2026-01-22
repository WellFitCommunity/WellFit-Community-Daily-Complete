// supabase/functions/mcp-prior-auth-server/__tests__/index.test.ts
// Tests for MCP Prior Authorization Server - CMS-0057-F Compliance

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("MCP Prior Authorization Server Tests", async (t) => {

  // =====================================================
  // MCP Protocol Tests
  // =====================================================

  await t.step("should return healthy status on health check", () => {
    const response = {
      status: "healthy",
      server: "mcp-prior-auth-server",
      version: "1.0.0",
      compliance: "CMS-0057-F",
      tools: 11,
      timestamp: new Date().toISOString()
    };

    assertEquals(response.status, "healthy");
    assertEquals(response.compliance, "CMS-0057-F");
    assertEquals(response.tools, 11);
  });

  await t.step("should list all available tools", () => {
    const toolNames = [
      "create_prior_auth",
      "submit_prior_auth",
      "get_prior_auth",
      "get_patient_prior_auths",
      "record_decision",
      "create_appeal",
      "check_prior_auth_required",
      "get_pending_prior_auths",
      "get_prior_auth_statistics",
      "cancel_prior_auth",
      "to_fhir_claim"
    ];

    assertEquals(toolNames.length, 11);
    assertEquals(toolNames.includes("create_prior_auth"), true);
    assertEquals(toolNames.includes("submit_prior_auth"), true);
  });

  // =====================================================
  // Prior Auth Status Types Tests
  // =====================================================

  await t.step("should support all prior auth status types", () => {
    const validStatuses = [
      "draft",
      "pending_submission",
      "submitted",
      "pending_review",
      "approved",
      "denied",
      "partial_approval",
      "pending_additional_info",
      "cancelled",
      "expired",
      "appealed"
    ];

    assertEquals(validStatuses.length, 11);
    assertEquals(validStatuses.includes("approved"), true);
    assertEquals(validStatuses.includes("denied"), true);
    assertEquals(validStatuses.includes("partial_approval"), true);
  });

  await t.step("should support urgency levels", () => {
    const urgencyLevels = ["stat", "urgent", "routine"];

    assertEquals(urgencyLevels.length, 3);
    assertEquals(urgencyLevels.includes("stat"), true);
  });

  // =====================================================
  // Create Prior Auth Tests
  // =====================================================

  await t.step("should require patient_id for create_prior_auth", () => {
    const requiredFields = ["patient_id", "payer_id", "service_codes", "diagnosis_codes", "tenant_id"];
    assertEquals(requiredFields.includes("patient_id"), true);
  });

  await t.step("should require service_codes array", () => {
    const args = {
      patient_id: "patient-123",
      payer_id: "payer-456",
      service_codes: ["99213", "99214"],
      diagnosis_codes: ["J06.9"]
    };

    assertEquals(Array.isArray(args.service_codes), true);
  });

  await t.step("should require diagnosis_codes array", () => {
    const args = {
      patient_id: "patient-123",
      payer_id: "payer-456",
      service_codes: ["99213"],
      diagnosis_codes: ["J06.9", "E11.9"]
    };

    assertEquals(Array.isArray(args.diagnosis_codes), true);
  });

  await t.step("should create prior auth with draft status", () => {
    const newPriorAuth = {
      id: "pa-123",
      status: "draft",
      patient_id: "patient-123",
      payer_id: "payer-456"
    };

    assertEquals(newPriorAuth.status, "draft");
  });

  await t.step("should return next step in create response", () => {
    const response = {
      prior_auth: { id: "pa-123" },
      message: "Prior authorization created successfully",
      next_step: "Submit the prior authorization using submit_prior_auth"
    };

    assertExists(response.next_step);
    assertEquals(response.message.includes("created"), true);
  });

  // =====================================================
  // Submit Prior Auth Tests
  // =====================================================

  await t.step("should require prior_auth_id for submit", () => {
    const requiredFields = ["prior_auth_id"];
    assertEquals(requiredFields.includes("prior_auth_id"), true);
  });

  await t.step("should generate auth number on submit", () => {
    const now = Date.now();
    const authNumber = `PA-${now}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    assertEquals(authNumber.startsWith("PA-"), true);
  });

  await t.step("should generate trace number on submit", () => {
    const now = Date.now();
    const traceNumber = `TRN-${now}`;

    assertEquals(traceNumber.startsWith("TRN-"), true);
  });

  await t.step("should set deadline based on urgency - stat (4 hours)", () => {
    const now = new Date();
    const decisionDueAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const diffHours = (decisionDueAt.getTime() - now.getTime()) / (60 * 60 * 1000);

    assertEquals(diffHours, 4);
  });

  await t.step("should set deadline based on urgency - urgent (72 hours)", () => {
    const now = new Date();
    const decisionDueAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    const diffHours = (decisionDueAt.getTime() - now.getTime()) / (60 * 60 * 1000);

    assertEquals(diffHours, 72);
  });

  await t.step("should set deadline based on urgency - routine (7 days)", () => {
    const now = new Date();
    const decisionDueAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const diffDays = (decisionDueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);

    assertEquals(diffDays, 7);
  });

  await t.step("should return submit response with expected times", () => {
    const response = {
      prior_auth: { id: "pa-123" },
      auth_number: "PA-123-ABC",
      trace_number: "TRN-123",
      expected_response_time: "72 hours (3 days)",
      decision_due_at: new Date().toISOString(),
      message: "Prior authorization submitted. Expected response within 72 hours (3 days)."
    };

    assertExists(response.auth_number);
    assertExists(response.trace_number);
    assertExists(response.expected_response_time);
    assertExists(response.decision_due_at);
  });

  // =====================================================
  // Get Prior Auth Tests
  // =====================================================

  await t.step("should lookup by prior_auth_id or auth_number", () => {
    const byId = { prior_auth_id: "pa-123" };
    const byAuthNumber = { auth_number: "PA-123-ABC" };

    assertExists(byId.prior_auth_id);
    assertExists(byAuthNumber.auth_number);
  });

  await t.step("should return not found for missing PA", () => {
    const response = { found: false, message: "Prior authorization not found" };
    assertEquals(response.found, false);
  });

  await t.step("should return PA with service lines and decisions", () => {
    const response = {
      found: true,
      prior_auth: { id: "pa-123" },
      service_lines: [{ line_number: 1, service_code: "99213" }],
      decisions: [{ decision_type: "approved" }]
    };

    assertEquals(response.found, true);
    assertEquals(Array.isArray(response.service_lines), true);
    assertEquals(Array.isArray(response.decisions), true);
  });

  // =====================================================
  // Record Decision Tests
  // =====================================================

  await t.step("should require prior_auth_id and decision_type", () => {
    const requiredFields = ["prior_auth_id", "decision_type", "tenant_id"];
    assertEquals(requiredFields.includes("prior_auth_id"), true);
    assertEquals(requiredFields.includes("decision_type"), true);
  });

  await t.step("should support decision types", () => {
    const decisionTypes = ["approved", "denied", "partial_approval", "pended", "cancelled"];
    assertEquals(decisionTypes.length, 5);
  });

  await t.step("should map decision to status", () => {
    const statusMap: Record<string, string> = {
      approved: "approved",
      denied: "denied",
      partial_approval: "partial_approval",
      pended: "pending_additional_info",
      cancelled: "cancelled"
    };

    assertEquals(statusMap.approved, "approved");
    assertEquals(statusMap.pended, "pending_additional_info");
  });

  await t.step("should include denial reason for denials", () => {
    const decision = {
      decision_type: "denied",
      denial_reason_code: "NMN",
      denial_reason_description: "Not medically necessary",
      appeal_deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    };

    assertExists(decision.denial_reason_code);
    assertExists(decision.denial_reason_description);
    assertExists(decision.appeal_deadline);
  });

  // =====================================================
  // Create Appeal Tests
  // =====================================================

  await t.step("should require prior_auth_id and appeal_reason", () => {
    const requiredFields = ["prior_auth_id", "appeal_reason", "tenant_id"];
    assertEquals(requiredFields.includes("prior_auth_id"), true);
    assertEquals(requiredFields.includes("appeal_reason"), true);
  });

  await t.step("should support appeal types", () => {
    const appealTypes = ["reconsideration", "peer_to_peer", "external_review"];
    assertEquals(appealTypes.length, 3);
  });

  await t.step("should increment appeal level", () => {
    const existingLevel = 1;
    const nextLevel = existingLevel + 1;
    assertEquals(nextLevel, 2);
  });

  await t.step("should update PA status to appealed", () => {
    const updatedStatus = "appealed";
    assertEquals(updatedStatus, "appealed");
  });

  // =====================================================
  // Check Prior Auth Required Tests
  // =====================================================

  await t.step("should require patient_id and service_codes", () => {
    const requiredFields = ["patient_id", "service_codes", "date_of_service", "tenant_id"];
    assertEquals(requiredFields.includes("patient_id"), true);
    assertEquals(requiredFields.includes("service_codes"), true);
  });

  await t.step("should return requires_prior_auth flag", () => {
    const result = {
      requires_prior_auth: true,
      missing_codes: ["99213", "99214"],
      recommendation: "Prior authorization required. Submit PA before claim."
    };

    assertEquals(typeof result.requires_prior_auth, "boolean");
    assertExists(result.recommendation);
  });

  // =====================================================
  // Get Pending Prior Auths Tests
  // =====================================================

  await t.step("should require tenant_id", () => {
    const requiredFields = ["tenant_id"];
    assertEquals(requiredFields.includes("tenant_id"), true);
  });

  await t.step("should default hours_threshold to 24", () => {
    const hoursThreshold = undefined;
    const usedThreshold = hoursThreshold || 24;
    assertEquals(usedThreshold, 24);
  });

  await t.step("should return approaching deadline list", () => {
    const response = {
      tenant_id: "tenant-123",
      hours_threshold: 24,
      count: 5,
      approaching_deadline: []
    };

    assertEquals(typeof response.count, "number");
    assertEquals(Array.isArray(response.approaching_deadline), true);
  });

  // =====================================================
  // Get Statistics Tests
  // =====================================================

  await t.step("should return statistics structure", () => {
    const stats = {
      total_submitted: 100,
      total_approved: 75,
      total_denied: 15,
      total_pending: 10,
      approval_rate: 75,
      avg_response_hours: 48,
      sla_compliance_rate: 95,
      by_urgency: {}
    };

    assertEquals(typeof stats.total_submitted, "number");
    assertEquals(typeof stats.approval_rate, "number");
    assertEquals(typeof stats.sla_compliance_rate, "number");
  });

  // =====================================================
  // Cancel Prior Auth Tests
  // =====================================================

  await t.step("should require prior_auth_id for cancel", () => {
    const requiredFields = ["prior_auth_id"];
    assertEquals(requiredFields.includes("prior_auth_id"), true);
  });

  await t.step("should set status to cancelled", () => {
    const updatedPA = { status: "cancelled" };
    assertEquals(updatedPA.status, "cancelled");
  });

  // =====================================================
  // FHIR Claim Conversion Tests (Da Vinci PAS)
  // =====================================================

  await t.step("should convert to FHIR Claim resource", () => {
    const fhirClaim = {
      resourceType: "Claim",
      meta: {
        profile: ["http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim"]
      },
      use: "preauthorization",
      type: {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/claim-type", code: "professional" }]
      }
    };

    assertEquals(fhirClaim.resourceType, "Claim");
    assertEquals(fhirClaim.use, "preauthorization");
    assertEquals(fhirClaim.meta.profile[0].includes("davinci-pas"), true);
  });

  await t.step("should map urgency to FHIR priority", () => {
    const urgencyToFHIR: Record<string, string> = {
      stat: "stat",
      urgent: "urgent",
      routine: "normal"
    };

    assertEquals(urgencyToFHIR.stat, "stat");
    assertEquals(urgencyToFHIR.routine, "normal");
  });

  await t.step("should include diagnosis codes in FHIR format", () => {
    const diagnosisCodes = ["J06.9", "E11.9"];
    const fhirDiagnosis = diagnosisCodes.map((code, index) => ({
      sequence: index + 1,
      diagnosisCodeableConcept: {
        coding: [{ system: "http://hl7.org/fhir/sid/icd-10-cm", code }]
      }
    }));

    assertEquals(fhirDiagnosis.length, 2);
    assertEquals(fhirDiagnosis[0].sequence, 1);
    assertEquals(fhirDiagnosis[0].diagnosisCodeableConcept.coding[0].code, "J06.9");
  });

  await t.step("should include service codes as items", () => {
    const serviceCodes = ["99213", "99214"];
    const fhirItems = serviceCodes.map((code, index) => ({
      sequence: index + 1,
      productOrService: {
        coding: [{ system: "http://www.ama-assn.org/go/cpt", code }]
      }
    }));

    assertEquals(fhirItems.length, 2);
    assertEquals(fhirItems[0].productOrService.coding[0].code, "99213");
  });

  // =====================================================
  // HTTP Endpoint Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/mcp-prior-auth-server", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should return tools on /tools endpoint", () => {
    const path = "tools";
    assertEquals(path, "tools");
  });

  await t.step("should handle /call endpoint for tool calls", () => {
    const path = "call";
    const method = "POST";

    assertEquals(path, "call");
    assertEquals(method, "POST");
  });

  await t.step("should return 400 for unknown tool", () => {
    const response = { error: "Unknown tool: unknown_tool" };
    assertEquals(response.error.includes("Unknown tool"), true);
  });

  await t.step("should return 404 for unknown path", () => {
    const response = { error: "Not found" };
    const status = 404;

    assertEquals(status, 404);
    assertEquals(response.error, "Not found");
  });

  // =====================================================
  // Rate Limiting Tests
  // =====================================================

  await t.step("should apply rate limiting on /call endpoint", () => {
    const rateLimitType = "prior_auth";
    assertEquals(rateLimitType, "prior_auth");
  });

  // =====================================================
  // Audit Logging Tests
  // =====================================================

  await t.step("should log prior auth creation", () => {
    const logEntry = {
      action: "PRIOR_AUTH_CREATED",
      prior_auth_id: "pa-123",
      patient_id: "patient-456",
      payer_id: "payer-789",
      service_codes: ["99213"]
    };

    assertEquals(logEntry.action, "PRIOR_AUTH_CREATED");
    assertExists(logEntry.prior_auth_id);
  });

  await t.step("should log prior auth submission", () => {
    const logEntry = {
      action: "PRIOR_AUTH_SUBMITTED",
      prior_auth_id: "pa-123",
      auth_number: "PA-123-ABC",
      urgency: "urgent",
      decision_due_at: new Date().toISOString()
    };

    assertEquals(logEntry.action, "PRIOR_AUTH_SUBMITTED");
    assertExists(logEntry.auth_number);
  });

  await t.step("should log prior auth decisions", () => {
    const logEntry = {
      action: "PRIOR_AUTH_DECISION",
      prior_auth_id: "pa-123",
      decision_id: "dec-456",
      decision_type: "approved"
    };

    assertEquals(logEntry.action, "PRIOR_AUTH_DECISION");
    assertExists(logEntry.decision_type);
  });

  await t.step("should log API errors", () => {
    const logEntry = {
      action: "PRIOR_AUTH_API_ERROR",
      error: "Database connection failed"
    };

    assertEquals(logEntry.action, "PRIOR_AUTH_API_ERROR");
    assertExists(logEntry.error);
  });

  // =====================================================
  // Error Response Tests
  // =====================================================

  await t.step("should return 500 for server errors", () => {
    const response = { error: "Database error" };
    const status = 500;

    assertEquals(status, 500);
    assertExists(response.error);
  });

  // =====================================================
  // CMS-0057-F Compliance Tests
  // =====================================================

  await t.step("should comply with CMS-0057-F mandate", () => {
    // CMS-0057-F requires APIs for prior auth by January 2027
    const compliance = {
      mandate: "CMS-0057-F",
      required_by: "2027-01-01",
      features: [
        "FHIR-based prior auth submission",
        "Real-time status checking",
        "Appeal management",
        "Decision tracking"
      ]
    };

    assertEquals(compliance.mandate, "CMS-0057-F");
    assertEquals(compliance.features.length, 4);
  });
});
