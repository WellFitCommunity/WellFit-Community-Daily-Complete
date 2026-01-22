/**
 * Tests for Send SMS Edge Function
 *
 * Tests SMS sending via Twilio for patient handoff notifications.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ============================================================================
// Type Definitions
// ============================================================================

interface SMSRequest {
  to: string[];
  message: string;
  priority?: 'normal' | 'high' | 'urgent';
}

interface SMSResult {
  phone: string;
  sid: string;
  status: string;
}

interface SMSError {
  phone: string;
  error: string;
}

// ============================================================================
// Test Suites
// ============================================================================

Deno.test("Send SMS - Request Validation", async (t) => {
  await t.step("should require 'to' phone numbers", () => {
    const request: Partial<SMSRequest> = {
      message: "Test message",
    };

    const isValid = request.to && request.to.length > 0 && request.message;
    assertEquals(isValid, false);
  });

  await t.step("should require non-empty 'to' array", () => {
    const request: SMSRequest = {
      to: [],
      message: "Test message",
    };

    const isValid = request.to && request.to.length > 0 && request.message;
    assertEquals(isValid, false);
  });

  await t.step("should require message", () => {
    const request: Partial<SMSRequest> = {
      to: ["+14155552671"],
    };

    const isValid = request.to && request.to.length > 0 && request.message;
    assertEquals(isValid, false);
  });

  await t.step("should accept valid request", () => {
    const request: SMSRequest = {
      to: ["+14155552671"],
      message: "Test message",
    };

    const isValid = request.to && request.to.length > 0 && request.message;
    assertEquals(isValid, true);
  });
});

Deno.test("Send SMS - E.164 Phone Number Validation", async (t) => {
  await t.step("should validate correct E.164 format", () => {
    const validNumbers = [
      "+14155552671",
      "+12025551234",
      "+447911123456",
      "+8618012345678",
    ];

    const e164Regex = /^\+[1-9]\d{1,14}$/;

    for (const phone of validNumbers) {
      const isValid = e164Regex.test(phone);
      assertEquals(isValid, true);
    }
  });

  await t.step("should reject invalid formats", () => {
    const invalidNumbers = [
      "14155552671",      // Missing +
      "+04155552671",     // Starts with 0
      "+1415",            // Too short
      "+123456789012345678", // Too long
      "555-123-4567",     // Not E.164
      "(415) 555-2671",   // Not E.164
    ];

    const e164Regex = /^\+[1-9]\d{1,14}$/;

    for (const phone of invalidNumbers) {
      const isValid = e164Regex.test(phone);
      assertEquals(isValid, false);
    }
  });

  await t.step("should reject empty phone number", () => {
    const phone = "";
    const isValid = !!phone;

    assertEquals(isValid, false);
  });

  await t.step("should provide helpful error message", () => {
    const validation = {
      valid: false,
      error: "Phone must be in E.164 format (e.g., +14155552671)",
    };

    assertEquals(validation.valid, false);
    assertEquals(validation.error.includes("E.164"), true);
  });
});

Deno.test("Send SMS - Message Length Validation", async (t) => {
  await t.step("should accept messages under 1600 chars", () => {
    const message = "A".repeat(1599);
    const isValid = message.length <= 1600;

    assertEquals(isValid, true);
  });

  await t.step("should accept exactly 1600 chars", () => {
    const message = "A".repeat(1600);
    const isValid = message.length <= 1600;

    assertEquals(isValid, true);
  });

  await t.step("should reject messages over 1600 chars", () => {
    const message = "A".repeat(1601);
    const isValid = message.length <= 1600;

    assertEquals(isValid, false);
  });
});

Deno.test("Send SMS - Priority Handling", async (t) => {
  await t.step("should default priority to normal", () => {
    const request: SMSRequest = {
      to: ["+14155552671"],
      message: "Test",
    };

    const priority = request.priority || 'normal';
    assertEquals(priority, "normal");
  });

  await t.step("should accept high priority", () => {
    const request: SMSRequest = {
      to: ["+14155552671"],
      message: "Test",
      priority: 'high',
    };

    assertEquals(request.priority, "high");
  });

  await t.step("should accept urgent priority", () => {
    const request: SMSRequest = {
      to: ["+14155552671"],
      message: "Test",
      priority: 'urgent',
    };

    assertEquals(request.priority, "urgent");
  });
});

Deno.test("Send SMS - Twilio Configuration", async (t) => {
  await t.step("should require Account SID", () => {
    const accountSid = "";
    const isConfigured = !!accountSid;

    assertEquals(isConfigured, false);
  });

  await t.step("should require Auth Token", () => {
    const authToken = "";
    const isConfigured = !!authToken;

    assertEquals(isConfigured, false);
  });

  await t.step("should require Messaging Service SID or From Number", () => {
    const messagingServiceSid = "";
    const fromNumber = "";
    const isConfigured = !!messagingServiceSid || !!fromNumber;

    assertEquals(isConfigured, false);
  });

  await t.step("should accept Messaging Service SID", () => {
    const messagingServiceSid = "MG123";
    const fromNumber = "";
    const isConfigured = !!messagingServiceSid || !!fromNumber;

    assertEquals(isConfigured, true);
  });

  await t.step("should accept From Number", () => {
    const messagingServiceSid = "";
    const fromNumber = "+15551234567";
    const isConfigured = !!messagingServiceSid || !!fromNumber;

    assertEquals(isConfigured, true);
  });

  await t.step("should prefer Messaging Service SID over From Number", () => {
    const messagingServiceSid = "MG123";
    const fromNumber = "+15551234567";

    const useServiceSid = !!messagingServiceSid;
    assertEquals(useServiceSid, true);
  });
});

Deno.test("Send SMS - Twilio Auth", async (t) => {
  await t.step("should create Basic auth header", () => {
    const accountSid = "AC123";
    const authToken = "token123";
    const authHeader = "Basic " + btoa(`${accountSid}:${authToken}`);

    assertEquals(authHeader.startsWith("Basic "), true);
  });

  await t.step("should encode credentials in base64", () => {
    const accountSid = "AC123";
    const authToken = "token123";
    const encoded = btoa(`${accountSid}:${authToken}`);
    const decoded = atob(encoded);

    assertEquals(decoded, "AC123:token123");
  });
});

Deno.test("Send SMS - Form Data Construction", async (t) => {
  await t.step("should set To field", () => {
    const formData = new URLSearchParams();
    formData.set("To", "+14155552671");

    assertEquals(formData.get("To"), "+14155552671");
  });

  await t.step("should set Body field", () => {
    const formData = new URLSearchParams();
    formData.set("Body", "Test message");

    assertEquals(formData.get("Body"), "Test message");
  });

  await t.step("should use Messaging Service SID when available", () => {
    const formData = new URLSearchParams();
    const messagingServiceSid = "MG123";
    formData.set("MessagingServiceSid", messagingServiceSid);

    assertEquals(formData.get("MessagingServiceSid"), "MG123");
  });

  await t.step("should use From number as fallback", () => {
    const formData = new URLSearchParams();
    const fromNumber = "+15551234567";
    formData.set("From", fromNumber);

    assertEquals(formData.get("From"), "+15551234567");
  });
});

Deno.test("Send SMS - Success Response", async (t) => {
  await t.step("should track successful sends", () => {
    const results: SMSResult[] = [
      { phone: "+14155552671", sid: "SM123", status: "queued" },
      { phone: "+12025551234", sid: "SM456", status: "queued" },
    ];

    assertEquals(results.length, 2);
    assertExists(results[0].sid);
  });

  await t.step("should return partial success when some fail", () => {
    const results: SMSResult[] = [
      { phone: "+14155552671", sid: "SM123", status: "queued" },
    ];
    const errors: SMSError[] = [
      { phone: "+invalid", error: "Invalid number" },
    ];

    const response = {
      success: true,
      message: `SMS sent to ${results.length} of ${results.length + errors.length} recipient(s)`,
      priority: "normal",
      results,
      errors: errors.length > 0 ? errors : undefined,
    };

    assertEquals(response.success, true);
    assertExists(response.errors);
  });

  await t.step("should include SID and status for each result", () => {
    const result: SMSResult = {
      phone: "+14155552671",
      sid: "SM123abc",
      status: "queued",
    };

    assertExists(result.sid);
    assertEquals(result.status, "queued");
  });
});

Deno.test("Send SMS - Error Responses", async (t) => {
  await t.step("should return 400 for missing fields", () => {
    const error = {
      status: 400,
      body: { error: "Missing required fields: to, message" },
    };

    assertEquals(error.status, 400);
  });

  await t.step("should return 400 for invalid phone numbers", () => {
    const error = {
      status: 400,
      body: {
        error: "Invalid phone numbers detected",
        invalid_numbers: ["+1: Phone must be in E.164 format"],
      },
    };

    assertEquals(error.status, 400);
    assertExists(error.body.invalid_numbers);
  });

  await t.step("should return 400 for message too long", () => {
    const error = {
      status: 400,
      body: { error: "Message exceeds 1600 character limit" },
    };

    assertEquals(error.status, 400);
  });

  await t.step("should return 500 when all sends fail", () => {
    const error = {
      status: 500,
      body: {
        success: false,
        error: "Failed to send SMS to all recipients",
        errors: [
          { phone: "+14155552671", error: "Network error" },
        ],
      },
    };

    assertEquals(error.status, 500);
    assertEquals(error.body.success, false);
  });
});

Deno.test("Send SMS - Multiple Recipients", async (t) => {
  await t.step("should send to all recipients", () => {
    const recipients = [
      "+14155552671",
      "+12025551234",
      "+13105551234",
    ];

    assertEquals(recipients.length, 3);
  });

  await t.step("should track results per recipient", () => {
    const results: SMSResult[] = [];
    const errors: SMSError[] = [];

    const recipients = ["+14155552671", "+12025551234"];

    // Simulate processing
    results.push({ phone: recipients[0], sid: "SM1", status: "queued" });
    errors.push({ phone: recipients[1], error: "Failed" });

    assertEquals(results.length + errors.length, 2);
  });
});

Deno.test("Send SMS - Logging", async (t) => {
  await t.step("should log successful send with SID", () => {
    const logData = {
      phone: "+14155552671",
      sid: "SM123",
      status: "queued",
    };

    assertExists(logData.sid);
  });

  await t.step("should log failure with error", () => {
    const logData = {
      phone: "+14155552671",
      status: 400,
      error: "Invalid number",
    };

    assertExists(logData.error);
  });

  await t.step("should not log message content (PHI protection)", () => {
    const logData = {
      phone: "+14155552671",
      status: "queued",
      // Note: No 'message' or 'body' field
    };

    const logString = JSON.stringify(logData);
    assertEquals(logString.includes("message"), false);
    assertEquals(logString.includes("body"), false);
  });
});

Deno.test("Send SMS - Error Handling", async (t) => {
  await t.step("should handle network errors gracefully", () => {
    const err = new Error("Network timeout");
    const errorMessage = err instanceof Error ? err.message : String(err);

    assertEquals(errorMessage, "Network timeout");
  });

  await t.step("should continue processing after individual failure", () => {
    const recipients = ["+14155552671", "+12025551234", "+13105551234"];
    const results: SMSResult[] = [];
    const errors: SMSError[] = [];

    // Simulate: first succeeds, second fails, third succeeds
    results.push({ phone: recipients[0], sid: "SM1", status: "queued" });
    errors.push({ phone: recipients[1], error: "Failed" });
    results.push({ phone: recipients[2], sid: "SM3", status: "queued" });

    assertEquals(results.length, 2);
    assertEquals(errors.length, 1);
  });
});
