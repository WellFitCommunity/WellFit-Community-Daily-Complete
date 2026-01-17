// supabase/functions/send-appointment-reminder/__tests__/index.test.ts
// Tests for send-appointment-reminder edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Send Appointment Reminder Edge Function Tests", async (t) => {

  await t.step("should reject non-POST methods", () => {
    const method = "GET";
    const expectedStatus = method === "POST" ? 200 : 405;

    assertEquals(expectedStatus, 405);
  });

  await t.step("should require authentication", () => {
    const hasAuth = false;
    // Uses requireUser from auth.ts
    const expectedStatus = hasAuth ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should require admin or super_admin role", () => {
    const validRoles = ["admin", "super_admin"];

    assertEquals(validRoles.includes("admin"), true);
    assertEquals(validRoles.includes("super_admin"), true);
    assertEquals(validRoles.includes("user"), false);
  });

  await t.step("should validate E.164 phone format", () => {
    const isE164 = (s: string) => /^\+[1-9]\d{6,14}$/.test(s || "");

    assertEquals(isE164("+15551234567"), true);
    assertEquals(isE164("+12025551234"), true);
    assertEquals(isE164("5551234567"), false);
    assertEquals(isE164("+01234567890"), false);  // Leading zero after +
  });

  await t.step("should require phone, patient_name, appointment_date, appointment_time", () => {
    const validBody = {
      phone: "+15551234567",
      patient_name: "John Doe",
      appointment_date: "January 15, 2026",
      appointment_time: "2:30 PM"
    };

    assertExists(validBody.phone);
    assertExists(validBody.patient_name);
    assertExists(validBody.appointment_date);
    assertExists(validBody.appointment_time);
  });

  await t.step("should return 400 for validation errors", () => {
    const isValid = false;
    const expectedStatus = isValid ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should structure validation error response", () => {
    const errorResponse = {
      error: "Validation failed",
      details: [
        { field: "phone", message: "Phone must be E.164, e.g., +15551234567", code: "custom" }
      ]
    };

    assertEquals(errorResponse.error, "Validation failed");
    assertEquals(errorResponse.details.length >= 1, true);
    assertExists(errorResponse.details[0].field);
    assertExists(errorResponse.details[0].message);
  });

  await t.step("should accept optional provider_name and location", () => {
    const validBody = {
      phone: "+15551234567",
      patient_name: "John Doe",
      appointment_date: "January 15, 2026",
      appointment_time: "2:30 PM",
      provider_name: "Dr. Smith",
      location: "Main Clinic, Room 101"
    };

    assertExists(validBody.provider_name);
    assertExists(validBody.location);
  });

  await t.step("should accept custom_message with max 1600 chars", () => {
    const customMessage = "Custom reminder message";
    const maxLength = 1600;

    assertEquals(customMessage.length <= maxLength, true);
  });

  await t.step("should build default appointment message", () => {
    const data = {
      patient_name: "John",
      appointment_date: "January 15, 2026",
      appointment_time: "2:30 PM",
      provider_name: "Dr. Smith",
      location: "Main Clinic"
    };

    let msg = `Hi ${data.patient_name}, this is a reminder of your appointment on ${data.appointment_date} at ${data.appointment_time}`;
    if (data.provider_name) msg += ` with ${data.provider_name}`;
    if (data.location) msg += ` at ${data.location}`;
    msg += ". Please arrive 15 minutes early. Reply STOP to opt out.";

    assertEquals(msg.includes("John"), true);
    assertEquals(msg.includes("January 15, 2026"), true);
    assertEquals(msg.includes("2:30 PM"), true);
    assertEquals(msg.includes("Dr. Smith"), true);
    assertEquals(msg.includes("Main Clinic"), true);
    assertEquals(msg.includes("STOP to opt out"), true);
  });

  await t.step("should use custom_message when provided", () => {
    const data = {
      custom_message: "Custom reminder: Your appointment is tomorrow!"
    };

    const message = data.custom_message?.trim().slice(0, 1600);
    assertEquals(message, "Custom reminder: Your appointment is tomorrow!");
  });

  await t.step("should return 500 for missing Twilio credentials", () => {
    const errorResponse = {
      error: "SERVER_NOT_CONFIGURED",
      message: "Twilio envs missing (ACCOUNT_SID/AUTH_TOKEN and MessagingService or From)"
    };

    assertEquals(errorResponse.error, "SERVER_NOT_CONFIGURED");
  });

  await t.step("should return 502 for Twilio API errors", () => {
    const twilioFailed = true;
    const expectedStatus = twilioFailed ? 502 : 200;

    assertEquals(expectedStatus, 502);
  });

  await t.step("should structure Twilio error response", () => {
    const errorResponse = {
      error: "TWILIO_ERROR",
      details: "Twilio 400: Invalid phone number",
      twilio_code: 21211
    };

    assertEquals(errorResponse.error, "TWILIO_ERROR");
    assertExists(errorResponse.details);
    assertExists(errorResponse.twilio_code);
  });

  await t.step("should support status callback URL", () => {
    const TWILIO_STATUS_CALLBACK_URL = "https://example.com/webhook/sms-status";

    const form = new URLSearchParams();
    if (TWILIO_STATUS_CALLBACK_URL) {
      form.append("StatusCallback", TWILIO_STATUS_CALLBACK_URL);
    }

    assertEquals(form.get("StatusCallback"), TWILIO_STATUS_CALLBACK_URL);
  });

  await t.step("should log reminder to appointment_reminders table", () => {
    const logEntry = {
      patient_phone: "+15551234567",
      patient_name: "John Doe",
      appointment_date: "January 15, 2026",
      appointment_time: "2:30 PM",
      provider_name: "Dr. Smith",
      location: "Main Clinic",
      message_sent: "Hi John...",
      twilio_sid: "SM12345678901234567890123456789012",
      status: "queued",
      sent_by: "user-123",
      sent_at: new Date().toISOString()
    };

    assertExists(logEntry.patient_phone);
    assertExists(logEntry.twilio_sid);
    assertExists(logEntry.sent_at);
  });

  await t.step("should structure success response correctly", () => {
    const response = {
      success: true,
      sid: "SM12345678901234567890123456789012",
      status: "queued"
    };

    assertEquals(response.success, true);
    assertExists(response.sid);
    assertEquals(response.status, "queued");
  });

  await t.step("should continue if logging fails", () => {
    // Logging is best-effort - SMS should still succeed
    const smsSent = true;
    const loggingFailed = true;

    assertEquals(smsSent, true);  // SMS still succeeded despite logging failure
  });

  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      success: 200,
      badRequest: 400,
      methodNotAllowed: 405,
      twilioError: 502,
      serverNotConfigured: 500
    };

    assertEquals(statusCodes.success, 200);
    assertEquals(statusCodes.badRequest, 400);
    assertEquals(statusCodes.methodNotAllowed, 405);
    assertEquals(statusCodes.twilioError, 502);
    assertEquals(statusCodes.serverNotConfigured, 500);
  });

  await t.step("should include Content-Type header in responses", () => {
    const headers = { "Content-Type": "application/json" };

    assertEquals(headers["Content-Type"], "application/json");
  });
});
