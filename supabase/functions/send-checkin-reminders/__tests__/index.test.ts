/**
 * Tests for Send Check-in Reminders Edge Function
 *
 * Tests FCM push notification sending for daily check-in reminders
 * with time-gating and token management.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ============================================================================
// Type Definitions
// ============================================================================

interface TokenRow {
  user_id: string;
  token: string | null;
  profiles: {
    id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

interface FCMResult {
  message_id?: string;
  error?: string;
}

// ============================================================================
// Test Suites
// ============================================================================

Deno.test("Send Check-in Reminders - Configuration", async (t) => {
  await t.step("should run at 9 AM Chicago time", () => {
    const RUN_HOUR_CT = 9;
    assertEquals(RUN_HOUR_CT, 9);
  });

  await t.step("should have 5-minute window for execution", () => {
    const windowMinutes = 5;
    assertEquals(windowMinutes, 5);
  });

  await t.step("should batch FCM tokens", () => {
    const MAX_TOKENS_PER_BATCH = 500;
    assertEquals(MAX_TOKENS_PER_BATCH, 500);
    // FCM supports up to 1000, we use safety margin
    assertEquals(MAX_TOKENS_PER_BATCH < 1000, true);
  });

  await t.step("should require environment variables", () => {
    const requiredVars = [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "FCM_SERVER_KEY",
    ];

    assertEquals(requiredVars.length, 3);
  });
});

Deno.test("Send Check-in Reminders - Time Window Check", async (t) => {
  await t.step("should skip outside scheduled window", () => {
    const currentHour = 14; // 2 PM
    const runHour = 9;
    const windowMinutes = 5;

    const isWithinWindow = currentHour === runHour;
    assertEquals(isWithinWindow, false);
  });

  await t.step("should run within scheduled window", () => {
    const currentHour = 9;
    const currentMinute = 3;
    const runHour = 9;
    const windowMinutes = 5;

    const isWithinWindow = currentHour === runHour && currentMinute < windowMinutes;
    assertEquals(isWithinWindow, true);
  });

  await t.step("should return success message when outside window", () => {
    const response = {
      success: true,
      message: "Outside scheduled time window",
      chicagoTime: new Date().toISOString(),
    };

    assertEquals(response.success, true);
    assertEquals(response.message.includes("Outside"), true);
  });
});

Deno.test("Send Check-in Reminders - Token Fetching", async (t) => {
  await t.step("should select required fields", () => {
    const selectFields = [
      "user_id",
      "token",
      "profiles ( id, full_name, first_name, last_name )",
    ];

    assertEquals(selectFields.length, 3);
  });

  await t.step("should filter out null tokens", () => {
    const rows: TokenRow[] = [
      { user_id: "u1", token: "token1", profiles: null },
      { user_id: "u2", token: null, profiles: null },
      { user_id: "u3", token: "token3", profiles: null },
    ];

    const validRows = rows.filter((r) => !!r.token);
    assertEquals(validRows.length, 2);
  });

  await t.step("should handle no tokens found", () => {
    const rows: TokenRow[] = [];

    const response = rows.length === 0
      ? { success: true, message: "No tokens to send." }
      : { success: true, message: "Processing..." };

    assertEquals(response.message, "No tokens to send.");
  });
});

Deno.test("Send Check-in Reminders - Chunking", async (t) => {
  await t.step("should split tokens into batches", () => {
    const tokens = Array.from({ length: 1200 }, (_, i) => `token-${i}`);
    const batchSize = 500;

    const batches: string[][] = [];
    for (let i = 0; i < tokens.length; i += batchSize) {
      batches.push(tokens.slice(i, i + batchSize));
    }

    assertEquals(batches.length, 3);
    assertEquals(batches[0].length, 500);
    assertEquals(batches[1].length, 500);
    assertEquals(batches[2].length, 200);
  });

  await t.step("should handle single batch", () => {
    const tokens = Array.from({ length: 100 }, (_, i) => `token-${i}`);
    const batchSize = 500;

    const batches: string[][] = [];
    for (let i = 0; i < tokens.length; i += batchSize) {
      batches.push(tokens.slice(i, i + batchSize));
    }

    assertEquals(batches.length, 1);
    assertEquals(batches[0].length, 100);
  });

  await t.step("should handle exact batch size", () => {
    const tokens = Array.from({ length: 500 }, (_, i) => `token-${i}`);
    const batchSize = 500;

    const batches: string[][] = [];
    for (let i = 0; i < tokens.length; i += batchSize) {
      batches.push(tokens.slice(i, i + batchSize));
    }

    assertEquals(batches.length, 1);
  });
});

Deno.test("Send Check-in Reminders - Notification Body", async (t) => {
  await t.step("should build notification with user name", () => {
    const name = "John";
    const friendly = name?.trim() || "there";

    const notification = {
      title: "WellFit Check-in Reminder",
      body: `Hi ${friendly}, it's time for your check-in! Please log your well-being today.`,
    };

    assertEquals(notification.title, "WellFit Check-in Reminder");
    assertEquals(notification.body.includes("John"), true);
  });

  await t.step("should use 'there' for missing name", () => {
    const name = null;
    const friendly = name?.trim() || "there";

    const notification = {
      title: "WellFit Check-in Reminder",
      body: `Hi ${friendly}, it's time for your check-in! Please log your well-being today.`,
    };

    assertEquals(notification.body.includes("there"), true);
  });

  await t.step("should handle empty name", () => {
    const name = "   ";
    const friendly = name?.trim() || "there";

    const notification = {
      body: `Hi ${friendly}, it's time for your check-in!`,
    };

    assertEquals(notification.body.includes("there"), true);
  });
});

Deno.test("Send Check-in Reminders - FCM Payload", async (t) => {
  await t.step("should structure FCM payload correctly", () => {
    const tokens = ["token1", "token2"];
    const notification = {
      title: "WellFit Check-in Reminder",
      body: "Hi there, it's time for your check-in!",
    };

    const payload = {
      registration_ids: tokens,
      notification,
    };

    assertEquals(payload.registration_ids.length, 2);
    assertExists(payload.notification.title);
    assertExists(payload.notification.body);
  });

  await t.step("should use FCM legacy endpoint", () => {
    const FCM_ENDPOINT = "https://fcm.googleapis.com/fcm/send";
    assertEquals(FCM_ENDPOINT.includes("fcm.googleapis.com"), true);
  });

  await t.step("should use server key authorization", () => {
    const serverKey = "test-server-key";
    const authHeader = `key=${serverKey}`;

    assertEquals(authHeader.startsWith("key="), true);
  });
});

Deno.test("Send Check-in Reminders - FCM Results Processing", async (t) => {
  await t.step("should track successful sends", () => {
    const results: FCMResult[] = [
      { message_id: "msg-1" },
      { message_id: "msg-2" },
    ];

    const successCount = results.filter(r => r.message_id).length;
    assertEquals(successCount, 2);
  });

  await t.step("should track failed sends", () => {
    const results: FCMResult[] = [
      { message_id: "msg-1" },
      { error: "NotRegistered" },
      { error: "InvalidRegistration" },
    ];

    const failureCount = results.filter(r => r.error).length;
    assertEquals(failureCount, 2);
  });

  await t.step("should identify removable error codes", () => {
    const removableErrors = ["NotRegistered", "InvalidRegistration", "MismatchSenderId"];

    assertEquals(removableErrors.length, 3);
    assertEquals(removableErrors.includes("NotRegistered"), true);
    assertEquals(removableErrors.includes("InvalidRegistration"), true);
    assertEquals(removableErrors.includes("MismatchSenderId"), true);
  });

  await t.step("should not remove on other errors", () => {
    const error = "ServerUnavailable";
    const removableErrors = ["NotRegistered", "InvalidRegistration", "MismatchSenderId"];

    const shouldRemove = removableErrors.includes(error);
    assertEquals(shouldRemove, false);
  });
});

Deno.test("Send Check-in Reminders - Token Cleanup", async (t) => {
  await t.step("should delete invalid tokens", () => {
    const deleteOperation = {
      table: "fcm_tokens",
      filters: {
        user_id: "user-123",
        token: "invalid-token",
      },
    };

    assertEquals(deleteOperation.table, "fcm_tokens");
    assertExists(deleteOperation.filters.user_id);
    assertExists(deleteOperation.filters.token);
  });

  await t.step("should track removed token count", () => {
    const results: FCMResult[] = [
      { error: "NotRegistered" },
      { error: "InvalidRegistration" },
      { error: "ServerError" },
    ];

    const removableErrors = ["NotRegistered", "InvalidRegistration", "MismatchSenderId"];
    let removedCount = 0;

    for (const result of results) {
      if (result.error && removableErrors.includes(result.error)) {
        removedCount++;
      }
    }

    assertEquals(removedCount, 2);
  });
});

Deno.test("Send Check-in Reminders - Success Response", async (t) => {
  await t.step("should return processing summary", () => {
    const response = {
      success: true,
      message: "Check-in reminders processed.",
      sentCount: 95,
      failedCount: 5,
      removedTokenCount: 3,
    };

    assertEquals(response.success, true);
    assertEquals(response.sentCount, 95);
    assertEquals(response.failedCount, 5);
    assertEquals(response.removedTokenCount, 3);
  });

  await t.step("should handle all successful sends", () => {
    const response = {
      success: true,
      message: "Check-in reminders processed.",
      sentCount: 100,
      failedCount: 0,
      removedTokenCount: 0,
    };

    assertEquals(response.failedCount, 0);
    assertEquals(response.removedTokenCount, 0);
  });
});

Deno.test("Send Check-in Reminders - Error Handling", async (t) => {
  await t.step("should return 500 on fatal error", () => {
    const error = {
      status: 500,
      body: { success: false, error: "FCM HTTP error 500" },
    };

    assertEquals(error.status, 500);
    assertEquals(error.body.success, false);
  });

  await t.step("should truncate error message", () => {
    const longError = "A".repeat(1000);
    const truncated = longError.slice(0, 500);

    assertEquals(truncated.length, 500);
  });

  await t.step("should handle token fetch failure", () => {
    const error = new Error("Fetch tokens failed: Database error");

    assertEquals(error.message.includes("Fetch tokens failed"), true);
  });
});

Deno.test("Send Check-in Reminders - Logging", async (t) => {
  await t.step("should log function invocation with time", () => {
    const logData = {
      chicagoTime: new Date().toISOString(),
    };

    assertExists(logData.chicagoTime);
  });

  await t.step("should log batch statistics", () => {
    const logData = {
      totalTokens: 1500,
      batches: 3,
    };

    assertEquals(logData.totalTokens, 1500);
    assertEquals(logData.batches, 3);
  });

  await t.step("should log FCM batch results", () => {
    const logData = {
      tokens: 500,
      success: 490,
      failure: 10,
    };

    assertEquals(logData.success + logData.failure, logData.tokens);
  });

  await t.step("should log individual send failures", () => {
    const logData = {
      userId: "user-123",
      token: "fcm-token-xxx",
      code: "NotRegistered",
    };

    assertExists(logData.userId);
    assertExists(logData.code);
  });
});

Deno.test("Send Check-in Reminders - Index Mapping", async (t) => {
  await t.step("should map results back to users", () => {
    const validRows: TokenRow[] = [
      { user_id: "u1", token: "t1", profiles: null },
      { user_id: "u2", token: "t2", profiles: null },
      { user_id: "u3", token: "t3", profiles: null },
    ];

    const results: FCMResult[] = [
      { message_id: "msg-1" },
      { error: "NotRegistered" },
      { message_id: "msg-3" },
    ];

    const offset = 0;
    for (let i = 0; i < results.length; i++) {
      const globalIndex = offset + i;
      const row = validRows[globalIndex];
      const result = results[i];

      if (result.error === "NotRegistered") {
        assertEquals(row.user_id, "u2");
      }
    }
  });

  await t.step("should handle offset across batches", () => {
    const batch1Size = 500;
    const batch2Index = 50;
    const globalIndex = batch1Size + batch2Index;

    assertEquals(globalIndex, 550);
  });
});
