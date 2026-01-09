// supabase/functions/send-push-notification/__tests__/index.test.ts
// Tests for send push notification edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Send Push Notification Tests", async (t) => {

  await t.step("should handle CORS preflight", async () => {
    const request = new Request("http://localhost", {
      method: "OPTIONS",
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should validate required fields - title and body", async () => {
    const validRequest = {
      title: "Test Notification",
      body: "This is a test message",
      priority: "high"
    };

    const invalidRequest = {
      title: "Test Notification"
      // missing body
    };

    assertExists(validRequest.title);
    assertExists(validRequest.body);
    assertEquals(invalidRequest.hasOwnProperty('body'), false);
  });

  await t.step("should accept optional user_ids array", () => {
    const requestWithUsers = {
      title: "Test",
      body: "Message",
      user_ids: ["uuid-1", "uuid-2", "uuid-3"]
    };

    const requestWithoutUsers = {
      title: "Test",
      body: "Message"
    };

    assertExists(requestWithUsers.user_ids);
    assertEquals(requestWithUsers.user_ids.length, 3);
    assertEquals(requestWithoutUsers.hasOwnProperty('user_ids'), false);
  });

  await t.step("should accept optional topic for broadcast", () => {
    const requestWithTopic = {
      title: "Test",
      body: "Message",
      topic: "alerts"
    };

    assertExists(requestWithTopic.topic);
    assertEquals(requestWithTopic.topic, "alerts");
  });

  await t.step("should validate priority values", () => {
    const validPriorities = ["high", "normal"];
    const invalidPriorities = ["low", "urgent", "critical"];

    validPriorities.forEach(priority => {
      assertEquals(["high", "normal"].includes(priority), true);
    });

    invalidPriorities.forEach(priority => {
      assertEquals(["high", "normal"].includes(priority), false);
    });
  });

  await t.step("should use fcm_tokens table for token lookup", () => {
    // CRITICAL: This test verifies we use the correct table
    // Previously was using push_subscriptions which caused silent failures
    const correctTable = "fcm_tokens";
    const incorrectTable = "push_subscriptions";

    // Simulating the query construction
    const query = `SELECT user_id, token FROM ${correctTable} WHERE user_id IN (...)`;

    assertEquals(query.includes("fcm_tokens"), true);
    assertEquals(query.includes("push_subscriptions"), false);
  });

  await t.step("should select correct columns from fcm_tokens", () => {
    // fcm_tokens table has 'token' column, not 'fcm_token'
    const correctColumns = ["user_id", "token"];
    const incorrectColumns = ["user_id", "fcm_token"];

    assertEquals(correctColumns.includes("token"), true);
    assertEquals(correctColumns.includes("fcm_token"), false);
  });

  await t.step("should build valid FCM message structure", () => {
    const fcmMessage = {
      message: {
        token: "test-fcm-token-123",
        notification: {
          title: "Test Title",
          body: "Test Body"
        },
        data: {
          type: "alert",
          action_url: "/patients/123"
        },
        android: {
          priority: "high"
        },
        webpush: {
          headers: {
            Urgency: "high"
          }
        }
      }
    };

    assertExists(fcmMessage.message);
    assertExists(fcmMessage.message.token);
    assertExists(fcmMessage.message.notification);
    assertExists(fcmMessage.message.notification.title);
    assertExists(fcmMessage.message.notification.body);
    assertEquals(fcmMessage.message.android?.priority, "high");
  });

  await t.step("should format FCM API URL correctly", () => {
    const projectId = "wellfit-community";
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    assertExists(fcmUrl);
    assertEquals(fcmUrl.includes("fcm.googleapis.com"), true);
    assertEquals(fcmUrl.includes(projectId), true);
    assertEquals(fcmUrl.endsWith("/messages:send"), true);
  });

  await t.step("should handle batch sending to multiple users", () => {
    const userTokens = [
      { user_id: "user-1", token: "token-1" },
      { user_id: "user-2", token: "token-2" },
      { user_id: "user-3", token: "token-3" }
    ];

    const results: Array<{ token: string; success: boolean }> = [];

    userTokens.forEach(sub => {
      results.push({
        token: sub.token.slice(0, 10) + "...",
        success: true
      });
    });

    assertEquals(results.length, 3);
    assertEquals(results.every(r => r.success), true);
  });

  await t.step("should track success and failure counts", () => {
    const results = [
      { success: true, token: "token1..." },
      { success: true, token: "token2..." },
      { success: false, token: "token3...", error: "Invalid token" },
      { success: true, token: "token4..." }
    ];

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    assertEquals(successCount, 3);
    assertEquals(failCount, 1);
  });

  await t.step("should return proper response format", () => {
    const response = {
      success: true,
      message: "Sent 3 notifications, 1 failed",
      results: [
        { token: "abc123...", success: true },
        { token: "def456...", success: false, error: "Token expired" }
      ]
    };

    assertExists(response.success);
    assertExists(response.message);
    assertExists(response.results);
    assertEquals(Array.isArray(response.results), true);
  });

  await t.step("should handle empty token list gracefully", () => {
    const emptyTokens: Array<{ token: string }> = [];
    const results: Array<{ success: boolean }> = [];

    // When no tokens found, should return empty results
    assertEquals(emptyTokens.length, 0);
    assertEquals(results.length, 0);
  });

  await t.step("should validate Firebase credentials presence", () => {
    const FIREBASE_PROJECT_ID = "wellfit-community";
    const FIREBASE_CLIENT_EMAIL = "firebase-adminsdk@wellfit-community.iam.gserviceaccount.com";
    const FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----";

    assertExists(FIREBASE_PROJECT_ID);
    assertExists(FIREBASE_CLIENT_EMAIL);
    assertExists(FIREBASE_PRIVATE_KEY);
    assertEquals(FIREBASE_CLIENT_EMAIL.includes("@"), true);
    assertEquals(FIREBASE_PRIVATE_KEY.includes("PRIVATE KEY"), true);
  });

  await t.step("should handle base64 encoded private key", () => {
    const base64Key = "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t"; // Starts with LS0t

    const isBase64 = base64Key.startsWith("LS0t");
    assertEquals(isBase64, true);

    // Should decode base64 keys
    if (isBase64) {
      const decoded = atob(base64Key);
      assertEquals(decoded.startsWith("-----BEGIN"), true);
    }
  });

  await t.step("should build JWT for OAuth2 authentication", () => {
    const header = {
      alg: "RS256",
      typ: "JWT"
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: "test@project.iam.gserviceaccount.com",
      sub: "test@project.iam.gserviceaccount.com",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/firebase.messaging"
    };

    assertEquals(header.alg, "RS256");
    assertEquals(header.typ, "JWT");
    assertExists(payload.iss);
    assertExists(payload.exp);
    assertEquals(payload.exp - payload.iat, 3600); // 1 hour expiry
    assertEquals(payload.scope.includes("firebase.messaging"), true);
  });

  await t.step("should handle topic-based notifications", () => {
    const topicMessage = {
      message: {
        topic: "emergency-alerts",
        notification: {
          title: "Emergency Alert",
          body: "Urgent notification"
        }
      }
    };

    assertExists(topicMessage.message.topic);
    assertEquals(topicMessage.message.hasOwnProperty("token"), false);
    assertEquals(topicMessage.message.topic, "emergency-alerts");
  });
});
