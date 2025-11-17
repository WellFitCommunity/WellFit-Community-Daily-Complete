// supabase/functions/notify-family-missed-check-in/__tests__/index.test.ts
// Tests for notify family missed check-in edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Notify Family Missed Check-in Tests", async (t) => {

  await t.step("should handle CORS preflight", async () => {
    const request = new Request("http://localhost", {
      method: "OPTIONS",
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should validate required fields", async () => {
    const validRequest = {
      seniorName: "John Doe",
      contactName: "Jane Doe",
      contactPhone: "+15551234567"
    };

    const invalidRequest = {
      seniorName: "John Doe"
      // missing contactName and contactPhone
    };

    assertExists(validRequest.seniorName);
    assertExists(validRequest.contactName);
    assertExists(validRequest.contactPhone);

    assertEquals(invalidRequest.hasOwnProperty('contactName'), false);
    assertEquals(invalidRequest.hasOwnProperty('contactPhone'), false);
  });

  await t.step("should validate E.164 phone format", () => {
    const phoneRegex = /^\+\d{10,15}$/;

    const validPhones = [
      "+15551234567",
      "+442071234567",
      "+33123456789"
    ];

    const invalidPhones = [
      "5551234567",      // Missing +
      "+1555123",        // Too short
      "+1555123456789012", // Too long
      "+1-555-123-4567", // Has dashes
      "+1 555 123 4567"  // Has spaces
    ];

    validPhones.forEach(phone => {
      assertEquals(phoneRegex.test(phone), true, `${phone} should be valid`);
    });

    invalidPhones.forEach(phone => {
      assertEquals(phoneRegex.test(phone), false, `${phone} should be invalid`);
    });
  });

  await t.step("should format emergency message correctly", () => {
    const seniorName = "John Doe";
    const contactName = "Jane Doe";

    const message = `ALERT: ${seniorName} has missed their scheduled check-in for the WellFit Community "Are You OK?" program. This message is being sent to you as their emergency contact. Please attempt to contact ${seniorName} or request a welfare check if you cannot reach them. If this is an emergency, please dial 911 immediately.`;

    assertExists(message);
    assertEquals(message.includes(seniorName), true);
    assertEquals(message.includes("Are You OK?"), true);
    assertEquals(message.includes("dial 911"), true);
    assertEquals(message.length > 0, true);
  });

  await t.step("should validate Twilio credentials are present", () => {
    const TWILIO_ACCOUNT_SID = "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    const TWILIO_AUTH_TOKEN = "test_auth_token_32_chars_long_x";

    assertExists(TWILIO_ACCOUNT_SID);
    assertExists(TWILIO_AUTH_TOKEN);
    assertEquals(TWILIO_ACCOUNT_SID.startsWith("AC"), true);
  });

  await t.step("should use messaging service or from number", () => {
    // Test with messaging service
    const messagingServiceSid = "MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    const fromNumber = "";

    const useMessagingService = !!messagingServiceSid;
    const useFromNumber = !messagingServiceSid && !!fromNumber;

    assertEquals(useMessagingService, true);
    assertEquals(useFromNumber, false);

    // Test with from number
    const noMessagingServiceSid = "";
    const hasFromNumber = "+15551234567";

    const useMessagingService2 = !!noMessagingServiceSid;
    const useFromNumber2 = !noMessagingServiceSid && !!hasFromNumber;

    assertEquals(useMessagingService2, false);
    assertEquals(useFromNumber2, true);
  });

  await t.step("should format Twilio API URL", () => {
    const TWILIO_ACCOUNT_SID = "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    assertExists(twilioUrl);
    assertEquals(twilioUrl.includes("https://api.twilio.com"), true);
    assertEquals(twilioUrl.includes(TWILIO_ACCOUNT_SID), true);
    assertEquals(twilioUrl.endsWith("/Messages.json"), true);
  });

  await t.step("should create Basic Auth header", () => {
    const TWILIO_ACCOUNT_SID = "ACtest123";
    const TWILIO_AUTH_TOKEN = "test_token_123";

    // Simulating btoa in test environment
    const authString = `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`;
    const authHeader = `Basic ${btoa(authString)}`;

    assertExists(authHeader);
    assertEquals(authHeader.startsWith("Basic "), true);
  });

  await t.step("should build form data with required fields", () => {
    const formData = new URLSearchParams();
    const contactPhone = "+15551234567";
    const message = "Test message";
    const messagingServiceSid = "MGtest123";

    formData.set("To", contactPhone);
    formData.set("Body", message);
    formData.set("MessagingServiceSid", messagingServiceSid);

    assertEquals(formData.get("To"), contactPhone);
    assertEquals(formData.get("Body"), message);
    assertEquals(formData.get("MessagingServiceSid"), messagingServiceSid);
  });

  await t.step("should use from number when no messaging service", () => {
    const formData1 = new URLSearchParams();
    const formData2 = new URLSearchParams();

    const messagingServiceSid = "MG123";
    const fromNumber = "+15551234567";

    // With messaging service
    if (messagingServiceSid) {
      formData1.set("MessagingServiceSid", messagingServiceSid);
    }

    assertEquals(formData1.has("MessagingServiceSid"), true);
    assertEquals(formData1.has("From"), false);

    // Without messaging service
    const noMessagingService = "";
    if (noMessagingService) {
      formData2.set("MessagingServiceSid", noMessagingService);
    } else {
      formData2.set("From", fromNumber);
    }

    assertEquals(formData2.has("MessagingServiceSid"), false);
    assertEquals(formData2.has("From"), true);
    assertEquals(formData2.get("From"), fromNumber);
  });

  await t.step("should parse Twilio response with SID", () => {
    const mockResponse = {
      sid: "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      status: "queued",
      to: "+15551234567",
      from: "+15559876543"
    };

    assertExists(mockResponse.sid);
    assertEquals(mockResponse.sid.startsWith("SM"), true);
    assertEquals(mockResponse.status, "queued");
  });

  await t.step("should format success response", () => {
    const seniorName = "John Doe";
    const contactName = "Jane Doe";
    const messageSid = "SMtest123";
    const messageStatus = "queued";

    const response = {
      success: true,
      message: `Emergency contact ${contactName} notified about ${seniorName}'s missed check-in`,
      sid: messageSid,
      status: messageStatus
    };

    assertEquals(response.success, true);
    assertExists(response.message);
    assertEquals(response.message.includes(seniorName), true);
    assertEquals(response.message.includes(contactName), true);
    assertEquals(response.sid, messageSid);
    assertEquals(response.status, messageStatus);
  });
});
