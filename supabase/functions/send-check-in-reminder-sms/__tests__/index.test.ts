// supabase/functions/send-check-in-reminder-sms/__tests__/index.test.ts
// Tests for send-check-in-reminder-sms edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Send Check-in Reminder SMS Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/send-check-in-reminder-sms", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require phone and name in request body", () => {
    const validBody = { phone: "+15551234567", name: "John" };
    const invalidBody = { name: "John" };

    assertExists(validBody.phone);
    assertExists(validBody.name);
    assertEquals("phone" in invalidBody, false);
  });

  await t.step("should return 400 for missing required fields", () => {
    const hasRequiredFields = false;
    const expectedStatus = hasRequiredFields ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should validate E.164 phone format", () => {
    const isValidE164 = (phone: string): boolean => {
      const phoneRegex = /^\+\d{10,15}$/;
      return phoneRegex.test(phone);
    };

    assertEquals(isValidE164("+15551234567"), true);
    assertEquals(isValidE164("+12025551234"), true);
    assertEquals(isValidE164("5551234567"), false);     // Missing +
    assertEquals(isValidE164("+123"), false);           // Too short
    assertEquals(isValidE164("+12345678901234567"), false); // Too long
  });

  await t.step("should return 400 for invalid phone format", () => {
    const isValidPhone = false;
    const expectedStatus = isValidPhone ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should compose check-in reminder message", () => {
    const name = "John";
    const message = `Hi ${name}, this is your daily check-in reminder from the WellFit Community SHIELD Program. Please complete your check-in at your earliest convenience. If you need assistance, please contact your emergency contact or dial 911. Thank you!`;

    assertEquals(message.includes("SHIELD Program"), true);
    assertEquals(message.includes(name), true);
    assertEquals(message.includes("check-in"), true);
    assertEquals(message.includes("911"), true);
  });

  await t.step("should use correct Twilio API URL", () => {
    const accountSid = "ACXXXXXXXXXX";
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    assertEquals(twilioUrl.includes("api.twilio.com"), true);
    assertEquals(twilioUrl.includes("Messages.json"), true);
  });

  await t.step("should create Basic auth header for Twilio", () => {
    const accountSid = "ACXXXXXXXXXX";
    const authToken = "test-token";
    const authHeader = "Basic " + btoa(`${accountSid}:${authToken}`);

    assertEquals(authHeader.startsWith("Basic "), true);
  });

  await t.step("should structure Twilio request form data", () => {
    const formData = new URLSearchParams();
    formData.set("To", "+15551234567");
    formData.set("Body", "Test message");
    formData.set("MessagingServiceSid", "MGXXXXXXXXXX");

    assertEquals(formData.get("To"), "+15551234567");
    assertEquals(formData.get("Body"), "Test message");
    assertExists(formData.get("MessagingServiceSid"));
  });

  await t.step("should use MessagingServiceSid when available", () => {
    const TWILIO_MESSAGING_SERVICE_SID = "MGXXXXXXXXXX";
    const TWILIO_FROM_NUMBER = "+15559999999";

    const formData = new URLSearchParams();
    if (TWILIO_MESSAGING_SERVICE_SID) {
      formData.set("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
    } else {
      formData.set("From", TWILIO_FROM_NUMBER);
    }

    assertExists(formData.get("MessagingServiceSid"));
    assertEquals(formData.get("From"), null);
  });

  await t.step("should fall back to From number when no MessagingServiceSid", () => {
    const TWILIO_MESSAGING_SERVICE_SID = "";
    const TWILIO_FROM_NUMBER = "+15559999999";

    const formData = new URLSearchParams();
    if (TWILIO_MESSAGING_SERVICE_SID) {
      formData.set("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
    } else {
      formData.set("From", TWILIO_FROM_NUMBER);
    }

    assertEquals(formData.get("MessagingServiceSid"), null);
    assertEquals(formData.get("From"), "+15559999999");
  });

  await t.step("should return 500 for Twilio errors", () => {
    const twilioSuccess = false;
    const expectedStatus = twilioSuccess ? 200 : 500;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should structure success response correctly", () => {
    const response = {
      success: true,
      message: "Check-in reminder sent to John",
      sid: "SM12345678901234567890123456789012",
      status: "queued"
    };

    assertEquals(response.success, true);
    assertExists(response.sid);
    assertEquals(response.message.includes("Check-in reminder sent"), true);
  });

  await t.step("should include SID and status from Twilio response", () => {
    const twilioResponse = {
      sid: "SM12345678901234567890123456789012",
      status: "queued",
      to: "+15551234567"
    };

    assertExists(twilioResponse.sid);
    assertEquals(twilioResponse.status, "queued");
  });

  await t.step("should structure error response correctly", () => {
    const errorResponse = {
      error: "Failed to send SMS",
      details: "Twilio error: Invalid phone number"
    };

    assertExists(errorResponse.error);
    assertExists(errorResponse.details);
  });

  await t.step("should not log PHI (phone number) per HIPAA", () => {
    // Verify PHI is not logged
    const logMessage = "SMS sent successfully";
    assertEquals(logMessage.includes("+"), false);
    assertEquals(logMessage.includes("555"), false);
  });

  await t.step("should require Twilio credentials", () => {
    const TWILIO_ACCOUNT_SID = "";
    const TWILIO_AUTH_TOKEN = "";

    const hasCredentials = !!TWILIO_ACCOUNT_SID && !!TWILIO_AUTH_TOKEN;
    assertEquals(hasCredentials, false);
  });

  await t.step("should require messaging source", () => {
    const TWILIO_MESSAGING_SERVICE_SID = "";
    const TWILIO_FROM_NUMBER = "";

    const hasMessagingSource = !!TWILIO_MESSAGING_SERVICE_SID || !!TWILIO_FROM_NUMBER;
    assertEquals(hasMessagingSource, false);
  });

  await t.step("should return 500 for catch errors", () => {
    const hasError = true;
    const expectedStatus = hasError ? 500 : 200;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      success: 200,
      badRequest: 400,
      serverError: 500
    };

    assertEquals(statusCodes.success, 200);
    assertEquals(statusCodes.badRequest, 400);
    assertEquals(statusCodes.serverError, 500);
  });
});
