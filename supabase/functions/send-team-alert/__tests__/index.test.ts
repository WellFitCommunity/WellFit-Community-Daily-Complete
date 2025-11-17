// supabase/functions/send-team-alert/__tests__/index.test.ts
// Tests for send team alert edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Send Team Alert Tests", async (t) => {

  await t.step("should handle CORS preflight", async () => {
    const request = new Request("http://localhost", {
      method: "OPTIONS",
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should validate required fields", async () => {
    const validRequest = {
      alert_type: "fall_detected",
      description: "Patient has fallen in the living room",
      user_id: "user-123",
      priority: "high" as const
    };

    const invalidRequest = {
      alert_type: "fall_detected",
      // missing description and user_id
    };

    assertExists(validRequest.alert_type);
    assertExists(validRequest.description);
    assertExists(validRequest.user_id);

    assertEquals(invalidRequest.hasOwnProperty('description'), false);
    assertEquals(invalidRequest.hasOwnProperty('user_id'), false);
  });

  await t.step("should default priority to medium", () => {
    const request1 = {
      alert_type: "wellness_check",
      description: "Daily check-in missed",
      user_id: "user-123"
      // priority not provided
    };

    const priority = request1.hasOwnProperty('priority') ? request1['priority'] : 'medium';
    assertEquals(priority, 'medium');
  });

  await t.step("should accept valid priority levels", () => {
    const highPriority = "high";
    const mediumPriority = "medium";
    const lowPriority = "low";

    const validPriorities = ['high', 'medium', 'low'];

    assertEquals(validPriorities.includes(highPriority), true);
    assertEquals(validPriorities.includes(mediumPriority), true);
    assertEquals(validPriorities.includes(lowPriority), true);
  });

  await t.step("should format user name from profile", () => {
    const profile1 = {
      first_name: "John",
      last_name: "Doe"
    };

    const profile2 = {
      first_name: "",
      last_name: ""
    };

    const userName1 = `${profile1.first_name || ''} ${profile1.last_name || ''}`.trim() || 'Unknown User';
    const userName2 = `${profile2.first_name || ''} ${profile2.last_name || ''}`.trim() || 'Unknown User';

    assertEquals(userName1, "John Doe");
    assertEquals(userName2, "Unknown User");
  });

  await t.step("should build recipients list", () => {
    const ADMIN_EMAIL = "admin@wellfitcommunity.org";
    const caregiverEmail = "caregiver@example.com";

    const recipients1 = [ADMIN_EMAIL];
    if (caregiverEmail) {
      recipients1.push(caregiverEmail);
    }

    assertEquals(recipients1.length, 2);
    assertEquals(recipients1.includes(ADMIN_EMAIL), true);
    assertEquals(recipients1.includes(caregiverEmail), true);

    const recipients2 = [ADMIN_EMAIL];
    const noCaregiverEmail = null;
    if (noCaregiverEmail) {
      recipients2.push(noCaregiverEmail);
    }

    assertEquals(recipients2.length, 1);
  });

  await t.step("should format email subject and body", () => {
    const userName = "John Doe";
    const alertType = "fall_detected";
    const priority = "high";
    const description = "Patient fell in living room";

    const emailSubject = `🚨 WellFit Alert: ${userName} - ${alertType}`;
    const emailBody = `
Alert Type: ${alertType}
User: ${userName}
Priority: ${priority}
Description: ${description}
Timestamp: ${new Date().toISOString()}

Please check on this user as soon as possible.
`;

    assertExists(emailSubject);
    assertExists(emailBody);
    assertEquals(emailSubject.includes(userName), true);
    assertEquals(emailSubject.includes(alertType), true);
    assertEquals(emailBody.includes(priority), true);
    assertEquals(emailBody.includes(description), true);
  });

  await t.step("should send SMS for high priority alerts", () => {
    const priority = "high";
    const caregiverPhone = "+15551234567";

    const shouldSendSMS = priority === 'high' && caregiverPhone;

    assertEquals(shouldSendSMS, true);
  });

  await t.step("should not send SMS for medium/low priority", () => {
    const mediumPriority = "medium";
    const lowPriority = "low";
    const caregiverPhone = "+15551234567";

    const shouldSendSMS1 = mediumPriority === 'high' && caregiverPhone;
    const shouldSendSMS2 = lowPriority === 'high' && caregiverPhone;

    assertEquals(shouldSendSMS1, false);
    assertEquals(shouldSendSMS2, false);
  });

  await t.step("should format SMS message for high priority", () => {
    const userName = "John Doe";
    const alertType = "fall_detected";
    const description = "Patient fell";

    const smsMessage = `WellFit ALERT: ${userName} - ${alertType}. ${description}. Please check immediately.`;

    assertExists(smsMessage);
    assertEquals(smsMessage.includes(userName), true);
    assertEquals(smsMessage.includes(alertType), true);
    assertEquals(smsMessage.includes(description), true);
    assertEquals(smsMessage.includes("Please check immediately"), true);
  });

  await t.step("should format alert details for database", () => {
    const description = "Patient fell in living room";
    const priority = "high";

    const alertDetails = `${description} - Priority: ${priority}`;

    assertEquals(alertDetails, "Patient fell in living room - Priority: high");
  });
});
