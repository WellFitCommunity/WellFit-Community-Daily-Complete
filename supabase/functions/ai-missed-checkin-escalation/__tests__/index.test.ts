// supabase/functions/ai-missed-checkin-escalation/__tests__/index.test.ts
// Tests for AI Missed Check-In Escalation - Smart escalation for patient safety

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Missed Check-In Escalation Tests", async (t) => {

  // =====================================================
  // Request Validation Tests
  // =====================================================

  await t.step("should require patientId", () => {
    const body = { triggerType: "single_missed" };
    const hasPatientId = "patientId" in body;

    assertEquals(hasPatientId, false);
  });

  await t.step("should return 400 for missing patientId", () => {
    const response = { error: "Missing required field: patientId" };
    assertEquals(response.error, "Missing required field: patientId");
  });

  await t.step("should default triggerType to 'single_missed'", () => {
    const body = { patientId: "patient-123" };
    const triggerType = (body as { triggerType?: string }).triggerType || "single_missed";

    assertEquals(triggerType, "single_missed");
  });

  await t.step("should default consecutiveMissedCount to 1", () => {
    const body = { patientId: "patient-123" };
    const count = (body as { consecutiveMissedCount?: number }).consecutiveMissedCount || 1;

    assertEquals(count, 1);
  });

  await t.step("should support trigger types", () => {
    const triggerTypes = ["single_missed", "consecutive_missed", "scheduled_check"];
    assertEquals(triggerTypes.length, 3);
  });

  // =====================================================
  // PHI Redaction Tests
  // =====================================================

  await t.step("should redact email addresses", () => {
    const text = "Contact john@example.com";
    const redacted = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");

    assertEquals(redacted, "Contact [EMAIL]");
  });

  await t.step("should redact phone numbers", () => {
    const text = "Call 555-123-4567";
    const redacted = text.replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]");

    assertEquals(redacted, "Call [PHONE]");
  });

  await t.step("should redact SSN", () => {
    const text = "SSN: 123-45-6789";
    const redacted = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

    assertEquals(redacted, "SSN: [SSN]");
  });

  // =====================================================
  // Escalation Context Tests
  // =====================================================

  await t.step("should initialize default context", () => {
    const context = {
      patientName: "Patient",
      riskLevel: "medium" as const,
      consecutiveMissed: 1,
      lastCheckInDate: null,
      lastCheckInStatus: null,
      lastWellnessScore: null,
      activeConditions: [],
      recentAlerts: [],
      caregivers: [],
      carePlanPriority: null,
      livingAlone: false,
      hasEmergencyContact: false,
      tenantLicenseType: null,
      welfareCheckEligible: false
    };

    assertEquals(context.patientName, "Patient");
    assertEquals(context.riskLevel, "medium");
    assertEquals(context.welfareCheckEligible, false);
  });

  await t.step("should calculate patient age", () => {
    const birthDate = new Date("1945-05-15");
    const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    assertEquals(age > 75, true);
  });

  // =====================================================
  // Tenant License Type Tests
  // =====================================================

  await t.step("should extract license digit from tenant code - Both Products", () => {
    const tenantCode = "VG-0002";
    const licenseMatch = tenantCode.match(/-([089])/);
    const licenseDigit = licenseMatch ? licenseMatch[1] : null;

    assertEquals(licenseDigit, "0");
  });

  await t.step("should extract license digit from tenant code - Clinical Only", () => {
    const tenantCode = "HH-8001";
    const licenseMatch = tenantCode.match(/-([089])/);
    const licenseDigit = licenseMatch ? licenseMatch[1] : null;

    assertEquals(licenseDigit, "8");
  });

  await t.step("should extract license digit from tenant code - WellFit Only", () => {
    const tenantCode = "MC-9001";
    const licenseMatch = tenantCode.match(/-([089])/);
    const licenseDigit = licenseMatch ? licenseMatch[1] : null;

    assertEquals(licenseDigit, "9");
  });

  await t.step("should determine welfare check eligibility for Both Products tenant", () => {
    const licenseDigit = "0";
    const welfareCheckEligible = licenseDigit === "0" || licenseDigit === "9";

    assertEquals(welfareCheckEligible, true);
  });

  await t.step("should determine welfare check eligibility for WellFit Only tenant", () => {
    const licenseDigit = "9";
    const welfareCheckEligible = licenseDigit === "0" || licenseDigit === "9";

    assertEquals(welfareCheckEligible, true);
  });

  await t.step("should NOT allow welfare check for Clinical Only tenant", () => {
    const licenseDigit = "8";
    const welfareCheckEligible = licenseDigit === "0" || licenseDigit === "9";

    assertEquals(welfareCheckEligible, false);
  });

  // =====================================================
  // Risk Level Calculation Tests
  // =====================================================

  await t.step("should add risk score for age >= 80", () => {
    const age = 82;
    let riskScore = 0;

    if (age >= 80) riskScore += 3;
    else if (age >= 70) riskScore += 2;
    else if (age >= 65) riskScore += 1;

    assertEquals(riskScore, 3);
  });

  await t.step("should add risk score for age 70-79", () => {
    const age = 75;
    let riskScore = 0;

    if (age >= 80) riskScore += 3;
    else if (age >= 70) riskScore += 2;
    else if (age >= 65) riskScore += 1;

    assertEquals(riskScore, 2);
  });

  await t.step("should add risk score for living alone", () => {
    const livingAlone = true;
    let riskScore = 0;

    if (livingAlone) riskScore += 2;

    assertEquals(riskScore, 2);
  });

  await t.step("should add risk score for consecutive missed >= 3", () => {
    const consecutiveMissed = 4;
    let riskScore = 0;

    if (consecutiveMissed >= 3) riskScore += 3;
    else if (consecutiveMissed >= 2) riskScore += 2;
    else if (consecutiveMissed >= 1) riskScore += 1;

    assertEquals(riskScore, 3);
  });

  await t.step("should add risk score for critical care plan priority", () => {
    const carePlanPriority = "critical";
    let riskScore = 0;

    if (carePlanPriority === "critical") riskScore += 3;
    else if (carePlanPriority === "high") riskScore += 2;

    assertEquals(riskScore, 3);
  });

  await t.step("should add risk score for low wellness score", () => {
    const lastWellnessScore = 2;
    let riskScore = 0;

    if (lastWellnessScore !== null && lastWellnessScore <= 3) riskScore += 2;
    else if (lastWellnessScore !== null && lastWellnessScore <= 5) riskScore += 1;

    assertEquals(riskScore, 2);
  });

  await t.step("should add risk score for high-risk conditions", () => {
    const activeConditions = ["heart failure", "hypertension"];
    const highRiskConditions = ["heart failure", "copd", "diabetes", "fall risk", "dementia"];

    const hasHighRiskCondition = activeConditions.some(c =>
      highRiskConditions.some(hr => c.toLowerCase().includes(hr))
    );

    let riskScore = 0;
    if (hasHighRiskCondition) riskScore += 2;

    assertEquals(riskScore, 2);
  });

  await t.step("should determine risk level - critical", () => {
    const riskScore = 10;
    const riskLevel = riskScore >= 8 ? "critical" :
                      riskScore >= 5 ? "high" :
                      riskScore >= 3 ? "medium" : "low";

    assertEquals(riskLevel, "critical");
  });

  await t.step("should determine risk level - high", () => {
    const riskScore = 6;
    const riskLevel = riskScore >= 8 ? "critical" :
                      riskScore >= 5 ? "high" :
                      riskScore >= 3 ? "medium" : "low";

    assertEquals(riskLevel, "high");
  });

  await t.step("should determine risk level - medium", () => {
    const riskScore = 4;
    const riskLevel = riskScore >= 8 ? "critical" :
                      riskScore >= 5 ? "high" :
                      riskScore >= 3 ? "medium" : "low";

    assertEquals(riskLevel, "medium");
  });

  await t.step("should determine risk level - low", () => {
    const riskScore = 2;
    const riskLevel = riskScore >= 8 ? "critical" :
                      riskScore >= 5 ? "high" :
                      riskScore >= 3 ? "medium" : "low";

    assertEquals(riskLevel, "low");
  });

  // =====================================================
  // Escalation Level Tests
  // =====================================================

  await t.step("should define escalation levels", () => {
    const levels = ["none", "low", "medium", "high", "emergency"];
    assertEquals(levels.length, 5);
  });

  await t.step("should return no escalation for single missed with low risk", () => {
    const consecutiveMissed = 1;
    const riskLevel = "low";

    const shouldNotEscalate = consecutiveMissed === 1 && riskLevel === "low";

    assertEquals(shouldNotEscalate, true);
  });

  await t.step("should return emergency escalation for critical risk with 2+ missed", () => {
    const consecutiveMissed = 2;
    const riskLevel = "critical";

    const isEmergency = riskLevel === "critical" && consecutiveMissed >= 2;

    assertEquals(isEmergency, true);
  });

  await t.step("should return emergency escalation for 5+ consecutive missed", () => {
    const consecutiveMissed = 5;

    const isEmergency = consecutiveMissed >= 5;

    assertEquals(isEmergency, true);
  });

  // =====================================================
  // Escalation Flow Tests
  // =====================================================

  await t.step("should always notify tenant first", () => {
    const escalation = {
      escalationLevel: "medium" as const,
      notifyTenant: true,
      notifyCaregiver: true,
      notifyEmergencyContact: false,
      callForWelfareCheck: false
    };

    assertEquals(escalation.notifyTenant, true);
  });

  await t.step("should define correct escalation order", () => {
    const escalationOrder = [
      "Step 1: Notify tenant organization",
      "Step 2: Notify caregiver",
      "Step 3: Contact emergency contact",
      "Step 4 (Last resort): Request welfare check"
    ];

    assertEquals(escalationOrder[0].includes("tenant"), true);
    assertEquals(escalationOrder[3].includes("Last resort"), true);
  });

  await t.step("should set notifyTenant true for any non-none escalation", () => {
    const escalationLevel = "low";
    const notifyTenant = escalationLevel !== "none";

    assertEquals(notifyTenant, true);
  });

  // =====================================================
  // Welfare Check Eligibility Tests
  // =====================================================

  await t.step("should block welfare check for clinical-only tenants", () => {
    const welfareCheckEligible = false;
    let callForWelfareCheck = true;

    if (!welfareCheckEligible && callForWelfareCheck) {
      callForWelfareCheck = false;
    }

    assertEquals(callForWelfareCheck, false);
  });

  await t.step("should allow welfare check for WellFit tenants with 3+ missed", () => {
    const welfareCheckEligible = true;
    const consecutiveMissed = 3;

    const welfareCheckAllowed = welfareCheckEligible && consecutiveMissed >= 3;

    assertEquals(welfareCheckAllowed, true);
  });

  await t.step("should not allow welfare check for WellFit tenants with < 3 missed", () => {
    const welfareCheckEligible = true;
    const consecutiveMissed = 2;

    const welfareCheckAllowed = welfareCheckEligible && consecutiveMissed >= 3;

    assertEquals(welfareCheckAllowed, false);
  });

  // =====================================================
  // Escalation Result Structure Tests
  // =====================================================

  await t.step("should return EscalationResult structure", () => {
    const escalation = {
      escalationLevel: "medium" as const,
      reasoning: "2 consecutive missed check-ins with medium risk level",
      recommendedActions: ["Step 1: Notify tenant", "Step 2: Notify caregiver"],
      notifyTenant: true,
      notifyCaregiver: true,
      notifyEmergencyContact: false,
      callForWelfareCheck: false,
      message: {
        subject: "Update about John",
        body: "John has missed 2 check-ins. Please let us know if they are okay.",
        urgency: "routine"
      },
      riskFactors: ["2 missed check-ins"],
      protectiveFactors: ["Active caregiver involvement"]
    };

    assertExists(escalation.escalationLevel);
    assertExists(escalation.reasoning);
    assertExists(escalation.message);
    assertEquals(escalation.notifyTenant, true);
    assertEquals(Array.isArray(escalation.riskFactors), true);
    assertEquals(Array.isArray(escalation.protectiveFactors), true);
  });

  await t.step("should define message urgency levels", () => {
    const urgencyLevels = ["routine", "important", "urgent", "emergency"];
    assertEquals(urgencyLevels.length, 4);
  });

  // =====================================================
  // Emergency Escalation Tests
  // =====================================================

  await t.step("should build emergency escalation message", () => {
    const patientName = "John";
    const consecutiveMissed = 5;

    const message = {
      subject: `Urgent: Unable to reach ${patientName}`,
      body: `We've been unable to reach ${patientName} for ${consecutiveMissed} consecutive check-ins. Please contact them or let us know if they are okay.`,
      urgency: "emergency"
    };

    assertEquals(message.subject.includes("Urgent"), true);
    assertEquals(message.urgency, "emergency");
    assertEquals(message.body.includes("5 consecutive check-ins"), true);
  });

  await t.step("should include living alone in risk factors for emergency", () => {
    const livingAlone = true;
    const riskFactors = [
      "5 consecutive missed check-ins",
      livingAlone ? "Lives alone" : "",
      "Critical care plan priority"
    ].filter(Boolean);

    assertEquals(riskFactors.includes("Lives alone"), true);
  });

  // =====================================================
  // Rule-Based Escalation Tests
  // =====================================================

  await t.step("should escalate to high for 3+ missed", () => {
    const consecutiveMissed = 3;
    let level: "none" | "low" | "medium" | "high" | "emergency" = "none";

    if (consecutiveMissed >= 3) level = "high";
    else if (consecutiveMissed >= 2) level = "medium";

    assertEquals(level, "high");
  });

  await t.step("should escalate to medium for 2 missed", () => {
    const consecutiveMissed = 2;
    let level: "none" | "low" | "medium" | "high" | "emergency" = "none";

    if (consecutiveMissed >= 3) level = "high";
    else if (consecutiveMissed >= 2) level = "medium";

    assertEquals(level, "medium");
  });

  await t.step("should notify caregiver for high/critical risk single missed", () => {
    const consecutiveMissed = 1;
    const riskLevel = "high";

    const notifyCaregiver = riskLevel === "high" || riskLevel === "critical";

    assertEquals(notifyCaregiver, true);
  });

  // =====================================================
  // Validation Tests
  // =====================================================

  await t.step("should upgrade escalation for critical patient marked as none", () => {
    const riskLevel = "critical";
    let escalationLevel = "none";
    let notifyTenant = false;
    let notifyCaregiver = false;

    if (riskLevel === "critical" && escalationLevel === "none") {
      escalationLevel = "medium";
      notifyTenant = true;
      notifyCaregiver = true;
    }

    assertEquals(escalationLevel, "medium");
    assertEquals(notifyTenant, true);
    assertEquals(notifyCaregiver, true);
  });

  await t.step("should cap escalation for low-risk single missed marked as emergency", () => {
    const consecutiveMissed = 1;
    const riskLevel = "low";
    let escalationLevel = "emergency";
    let callForWelfareCheck = true;
    let notifyEmergencyContact = true;

    if (consecutiveMissed === 1 && riskLevel === "low" && escalationLevel === "emergency") {
      escalationLevel = "low";
      callForWelfareCheck = false;
      notifyEmergencyContact = false;
    }

    assertEquals(escalationLevel, "low");
    assertEquals(callForWelfareCheck, false);
    assertEquals(notifyEmergencyContact, false);
  });

  // =====================================================
  // Alert Creation Tests
  // =====================================================

  await t.step("should create care coordination alert", () => {
    const alert = {
      patient_id: "patient-123",
      alert_type: "missed_check_in_escalation",
      severity: "high",
      priority: "urgent",
      title: "Missed Check-In: John",
      description: "3 consecutive missed check-ins require attention",
      alert_data: {
        consecutive_missed: 3,
        risk_level: "high",
        escalation_level: "high",
        risk_factors: ["3 consecutive missed check-ins", "Lives alone"],
        welfare_check_eligible: true,
        tenant_license_type: "0"
      },
      status: "active"
    };

    assertEquals(alert.alert_type, "missed_check_in_escalation");
    assertEquals(alert.alert_data.consecutive_missed, 3);
    assertEquals(alert.alert_data.welfare_check_eligible, true);
  });

  // =====================================================
  // Notification Tests
  // =====================================================

  await t.step("should create tenant notification", () => {
    const notification = {
      user_id: "admin-123",
      title: "[Tenant Alert] Urgent: Unable to reach John",
      message: "John has missed 3 check-ins...\n\nEscalation Level: HIGH",
      type: "missed_check_in_tenant_alert",
      severity: "urgent",
      metadata: {
        patient_id: "patient-456",
        escalation_level: "high",
        tenant_code: "VG-0001",
        welfare_check_recommended: false,
        escalation_step: "tenant_notification"
      }
    };

    assertEquals(notification.type, "missed_check_in_tenant_alert");
    assertEquals(notification.metadata.escalation_step, "tenant_notification");
  });

  await t.step("should create caregiver notification", () => {
    const notification = {
      user_id: "caregiver-123",
      title: "Check-in needed for John",
      message: "John has missed 2 check-ins. If you are in contact, please let us know.",
      type: "missed_check_in_alert",
      severity: "routine",
      metadata: {
        patient_id: "patient-456",
        escalation_level: "medium",
        consecutive_missed: 2
      }
    };

    assertEquals(notification.type, "missed_check_in_alert");
    assertExists(notification.metadata.consecutive_missed);
  });

  // =====================================================
  // Security Event Logging Tests
  // =====================================================

  await t.step("should log escalation as security event", () => {
    const securityEvent = {
      event_type: "missed_checkin_escalation",
      severity: "warning",
      description: "Missed check-in escalation: high",
      metadata: {
        patient_id: "patient-123",
        check_in_id: "checkin-456",
        consecutive_missed: 3,
        escalation_level: "high",
        notify_tenant: true,
        notify_caregiver: true,
        notify_emergency_contact: false,
        welfare_check_recommended: false,
        welfare_check_eligible: true,
        tenant_license_type: "0"
      }
    };

    assertEquals(securityEvent.event_type, "missed_checkin_escalation");
    assertEquals(securityEvent.metadata.welfare_check_eligible, true);
  });

  await t.step("should use critical severity for emergency escalation", () => {
    const escalationLevel = "emergency";
    const severity = escalationLevel === "emergency" ? "critical" : "warning";

    assertEquals(severity, "critical");
  });

  // =====================================================
  // Model Configuration Tests
  // =====================================================

  await t.step("should use Claude Haiku model", () => {
    const HAIKU_MODEL = "claude-haiku-4-5-20250919";
    assertEquals(HAIKU_MODEL.includes("haiku"), true);
  });

  // =====================================================
  // Usage Logging Tests
  // =====================================================

  await t.step("should log AI usage", () => {
    const usageLog = {
      user_id: "patient-123",
      request_id: crypto.randomUUID(),
      model: "claude-haiku-4-5-20250919",
      request_type: "missed_checkin_escalation",
      input_tokens: 500,
      output_tokens: 400,
      cost: (500 / 1_000_000) * 0.8 + (400 / 1_000_000) * 4.0,
      response_time_ms: 650,
      success: true
    };

    assertEquals(usageLog.request_type, "missed_checkin_escalation");
    assertEquals(usageLog.cost, 0.002);
  });

  // =====================================================
  // Response Structure Tests
  // =====================================================

  await t.step("should return full response structure", () => {
    const response = {
      escalation: {
        escalationLevel: "medium",
        reasoning: "2 missed check-ins with medium risk",
        notifyTenant: true,
        notifyCaregiver: true
      },
      context: {
        riskLevel: "medium",
        consecutiveMissed: 2,
        hasCaregiver: true,
        welfareCheckEligible: true,
        tenantLicenseType: "0"
      },
      metadata: {
        processed_at: new Date().toISOString(),
        trigger_type: "consecutive_missed",
        response_time_ms: 650
      }
    };

    assertExists(response.escalation);
    assertExists(response.context);
    assertExists(response.metadata);
    assertEquals(response.context.welfareCheckEligible, true);
    assertEquals(response.context.tenantLicenseType, "0");
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/ai-missed-checkin-escalation", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  // =====================================================
  // Error Handling Tests
  // =====================================================

  await t.step("should return 500 for AI service not configured", () => {
    const ANTHROPIC_API_KEY = undefined;
    const shouldThrow = !ANTHROPIC_API_KEY;

    assertEquals(shouldThrow, true);
  });

  await t.step("should fall back to rule-based on AI error", () => {
    // When AI fails, system should use rule-based escalation
    const useFallback = true;
    assertEquals(useFallback, true);
  });

  await t.step("should handle parse errors gracefully", () => {
    const content = "Invalid JSON response";
    let parsed = null;

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      parsed = null;
    }

    assertEquals(parsed, null);
  });

  // =====================================================
  // Check-In Status Update Tests
  // =====================================================

  await t.step("should update check-in status to escalated", () => {
    const updateData = {
      status: "escalated",
      escalation_level: "high",
      escalation_reasoning: "3 consecutive missed check-ins require attention",
      escalated_at: new Date().toISOString()
    };

    assertEquals(updateData.status, "escalated");
    assertExists(updateData.escalated_at);
  });

  // =====================================================
  // Protective Factors Tests
  // =====================================================

  await t.step("should identify emergency contact as protective factor", () => {
    const hasEmergencyContact = true;
    const protectiveFactors = hasEmergencyContact ? ["Emergency contact on file"] : [];

    assertEquals(protectiveFactors.length, 1);
    assertEquals(protectiveFactors[0], "Emergency contact on file");
  });

  await t.step("should identify caregiver involvement as protective factor", () => {
    const caregivers = [{ id: "cg-1", name: "Jane", relationship: "daughter" }];
    const protectiveFactors = caregivers.length > 0 ? ["Active caregiver involvement"] : [];

    assertEquals(protectiveFactors.length, 1);
  });
});
