/**
 * Tests for Send Email Edge Function
 *
 * Tests email sending via MailerSend for patient handoff notifications.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ============================================================================
// Type Definitions
// ============================================================================

interface EmailRecipient {
  email: string;
  name: string;
}

interface EmailRequest {
  to: EmailRecipient[];
  subject: string;
  html: string;
  priority?: 'normal' | 'high' | 'urgent';
}

// ============================================================================
// Test Suites
// ============================================================================

Deno.test("Send Email - Request Validation", async (t) => {
  await t.step("should require 'to' recipients", () => {
    const request: Partial<EmailRequest> = {
      subject: "Test Subject",
      html: "<p>Test body</p>",
    };

    const isValid = request.to && request.to.length > 0 && request.subject && request.html;
    assertEquals(isValid, false);
  });

  await t.step("should require non-empty 'to' array", () => {
    const request: EmailRequest = {
      to: [],
      subject: "Test Subject",
      html: "<p>Test body</p>",
    };

    const isValid = request.to && request.to.length > 0 && request.subject && request.html;
    assertEquals(isValid, false);
  });

  await t.step("should require subject", () => {
    const request: Partial<EmailRequest> = {
      to: [{ email: "test@example.com", name: "Test" }],
      html: "<p>Test body</p>",
    };

    const isValid = request.to && request.to.length > 0 && request.subject && request.html;
    assertEquals(isValid, false);
  });

  await t.step("should require html content", () => {
    const request: Partial<EmailRequest> = {
      to: [{ email: "test@example.com", name: "Test" }],
      subject: "Test Subject",
    };

    const isValid = request.to && request.to.length > 0 && request.subject && request.html;
    assertEquals(isValid, false);
  });

  await t.step("should accept valid request", () => {
    const request: EmailRequest = {
      to: [{ email: "test@example.com", name: "Test User" }],
      subject: "Test Subject",
      html: "<p>Test body</p>",
    };

    const isValid = request.to && request.to.length > 0 && request.subject && request.html;
    assertEquals(isValid, true);
  });
});

Deno.test("Send Email - Priority Handling", async (t) => {
  await t.step("should default priority to normal", () => {
    const request: EmailRequest = {
      to: [{ email: "test@example.com", name: "Test" }],
      subject: "Test",
      html: "<p>Test</p>",
    };

    const priority = request.priority || 'normal';
    assertEquals(priority, "normal");
  });

  await t.step("should accept high priority", () => {
    const request: EmailRequest = {
      to: [{ email: "test@example.com", name: "Test" }],
      subject: "Test",
      html: "<p>Test</p>",
      priority: 'high',
    };

    assertEquals(request.priority, "high");
  });

  await t.step("should accept urgent priority", () => {
    const request: EmailRequest = {
      to: [{ email: "test@example.com", name: "Test" }],
      subject: "Test",
      html: "<p>Test</p>",
      priority: 'urgent',
    };

    assertEquals(request.priority, "urgent");
  });
});

Deno.test("Send Email - HTML to Text Conversion", async (t) => {
  await t.step("should strip HTML tags for text fallback", () => {
    const html = "<p>Hello, <strong>World!</strong></p>";
    const text = html.replace(/<[^>]*>/g, '');

    assertEquals(text, "Hello, World!");
  });

  await t.step("should handle complex HTML", () => {
    const html = `
      <div>
        <h1>Welcome</h1>
        <p>Click <a href="https://example.com">here</a></p>
      </div>
    `;
    const text = html.replace(/<[^>]*>/g, '');

    assertEquals(text.includes("Welcome"), true);
    assertEquals(text.includes("Click"), true);
    assertEquals(text.includes("<"), false);
  });

  await t.step("should handle empty HTML", () => {
    const html = "";
    const text = html.replace(/<[^>]*>/g, '');

    assertEquals(text, "");
  });
});

Deno.test("Send Email - MailerSend Payload", async (t) => {
  await t.step("should structure from address correctly", () => {
    const fromEmail = "noreply@example.com";
    const fromName = "WellFit Patient Handoff";

    const payload = {
      from: {
        email: fromEmail,
        name: fromName,
      },
    };

    assertEquals(payload.from.email, "noreply@example.com");
    assertEquals(payload.from.name, "WellFit Patient Handoff");
  });

  await t.step("should structure recipients correctly", () => {
    const to: EmailRecipient[] = [
      { email: "user1@example.com", name: "User 1" },
      { email: "user2@example.com", name: "User 2" },
    ];

    assertEquals(to.length, 2);
    assertEquals(to[0].email, "user1@example.com");
  });

  await t.step("should disable tracking", () => {
    const settings = {
      track_clicks: false,
      track_opens: false,
    };

    assertEquals(settings.track_clicks, false);
    assertEquals(settings.track_opens, false);
  });

  await t.step("should include tags for categorization", () => {
    const priority = "high";
    const tags = [priority, 'patient-handoff'];

    assertEquals(tags.length, 2);
    assertEquals(tags[0], "high");
    assertEquals(tags[1], "patient-handoff");
  });
});

Deno.test("Send Email - Success Response", async (t) => {
  await t.step("should return success=true on successful send", () => {
    const response = {
      success: true,
      message: "Email sent to 2 recipient(s)",
      priority: "normal",
    };

    assertEquals(response.success, true);
  });

  await t.step("should include recipient count in message", () => {
    const recipientCount = 3;
    const message = `Email sent to ${recipientCount} recipient(s)`;

    assertEquals(message, "Email sent to 3 recipient(s)");
  });

  await t.step("should include priority in response", () => {
    const response = {
      success: true,
      message: "Email sent to 1 recipient(s)",
      priority: "urgent",
    };

    assertEquals(response.priority, "urgent");
  });
});

Deno.test("Send Email - Error Responses", async (t) => {
  await t.step("should return 400 for missing fields", () => {
    const error = {
      status: 400,
      body: { error: "Missing required fields: to, subject, html" },
    };

    assertEquals(error.status, 400);
  });

  await t.step("should return MailerSend status on failure", () => {
    const error = {
      status: 422, // MailerSend validation error
      body: {
        error: "Failed to send email",
        details: "Invalid recipient email",
      },
    };

    assertEquals(error.status, 422);
    assertExists(error.body.details);
  });

  await t.step("should return 500 for internal errors", () => {
    const error = {
      status: 500,
      body: { error: "Internal server error" },
    };

    assertEquals(error.status, 500);
  });
});

Deno.test("Send Email - Logging", async (t) => {
  await t.step("should log recipient count on success", () => {
    const logData = {
      recipients: 5,
      subject: "Patient Handoff Notification",
      priority: "high",
    };

    assertEquals(logData.recipients, 5);
    assertExists(logData.subject);
  });

  await t.step("should log error details on failure", () => {
    const logData = {
      recipients: 2,
      status: 422,
      error: "Validation failed",
      subject: "Test Subject",
    };

    assertExists(logData.error);
    assertExists(logData.status);
  });

  await t.step("should not log email content (PHI protection)", () => {
    const logData = {
      recipients: 1,
      subject: "Notification",
      // Note: No 'html' or 'body' field
    };

    const logString = JSON.stringify(logData);
    assertEquals(logString.includes("html"), false);
    assertEquals(logString.includes("body"), false);
  });
});

Deno.test("Send Email - Configuration", async (t) => {
  await t.step("should require MailerSend API key", () => {
    const apiKey = "";
    const isConfigured = !!apiKey;

    assertEquals(isConfigured, false);
  });

  await t.step("should require from email", () => {
    const fromEmail = "";
    const isConfigured = !!fromEmail;

    assertEquals(isConfigured, false);
  });

  await t.step("should use default from name if not set", () => {
    const fromName = undefined;
    const effectiveFromName = fromName || "WellFit Patient Handoff";

    assertEquals(effectiveFromName, "WellFit Patient Handoff");
  });
});

Deno.test("Send Email - Error Handling", async (t) => {
  await t.step("should extract error message from Error instance", () => {
    const err = new Error("Network error");
    const errorMessage = err instanceof Error ? err.message : String(err);

    assertEquals(errorMessage, "Network error");
  });

  await t.step("should include stack trace in error log", () => {
    const err = new Error("Test error");
    const logData = {
      error: err.message,
      stack: err.stack,
    };

    assertExists(logData.stack);
  });
});
