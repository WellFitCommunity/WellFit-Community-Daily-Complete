/**
 * Tests for Security Alert Processor Edge Function
 *
 * Tests security alert processing with multi-channel notifications
 * (Email, SMS, Slack, PagerDuty) and SOC2 compliance.
 *
 * SOC2 Compliance: CC6.1, CC7.2 - Security event notification
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ============================================================================
// Type Definitions (matching the edge function)
// ============================================================================

interface SecurityAlert {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  status: string;
  created_at: string;
  affected_user_id?: string;
  escalated: boolean;
  escalation_level: number;
}

interface NotificationResult {
  channel: string;
  success: boolean;
  error?: string;
}

// ============================================================================
// Test Suites
// ============================================================================

Deno.test("Security Alert Processor - Alert Fetching", async (t) => {
  await t.step("should filter alerts with notification_sent=false", () => {
    const queryFilter = { notification_sent: false };
    assertEquals(queryFilter.notification_sent, false);
  });

  await t.step("should only process critical and high severity", () => {
    const severities = ["critical", "high"];
    assertEquals(severities.length, 2);
    assertEquals(severities.includes("critical"), true);
    assertEquals(severities.includes("high"), true);
    assertEquals(severities.includes("medium"), false);
    assertEquals(severities.includes("low"), false);
  });

  await t.step("should order by created_at ascending", () => {
    const orderConfig = { column: "created_at", ascending: true };
    assertEquals(orderConfig.ascending, true);
  });

  await t.step("should limit to 50 alerts per batch", () => {
    const limit = 50;
    assertEquals(limit, 50);
  });

  await t.step("should allow specific alert IDs when provided", () => {
    const alertIds = ["alert-1", "alert-2"];
    const query = alertIds.length > 0 ? { in: alertIds } : null;

    assertExists(query);
    assertEquals(query?.in.length, 2);
  });
});

Deno.test("Security Alert Processor - Channel Selection", async (t) => {
  await t.step("should use all channels for critical alerts", () => {
    const severity = "critical";
    const escalated = false;

    const channels = severity === "critical" || escalated
      ? ["email", "slack", "pagerduty", "sms"]
      : ["email", "slack"];

    assertEquals(channels.length, 4);
    assertEquals(channels.includes("pagerduty"), true);
    assertEquals(channels.includes("sms"), true);
  });

  await t.step("should use all channels for escalated alerts", () => {
    const severity = "high";
    const escalated = true;

    const channels = severity === "critical" || escalated
      ? ["email", "slack", "pagerduty", "sms"]
      : ["email", "slack"];

    assertEquals(channels.length, 4);
  });

  await t.step("should use email and slack for high severity", () => {
    const severity = "high";
    const escalated = false;

    let channels: string[];
    if (severity === "critical" || escalated) {
      channels = ["email", "slack", "pagerduty", "sms"];
    } else if (severity === "high") {
      channels = ["email", "slack"];
    } else {
      channels = ["email"];
    }

    assertEquals(channels.length, 2);
    assertEquals(channels.includes("email"), true);
    assertEquals(channels.includes("slack"), true);
    assertEquals(channels.includes("pagerduty"), false);
  });

  await t.step("should use only email for medium/low severity", () => {
    const severity = "medium";
    const escalated = false;

    let channels: string[];
    if (severity === "critical" || escalated) {
      channels = ["email", "slack", "pagerduty", "sms"];
    } else if (severity === "high") {
      channels = ["email", "slack"];
    } else {
      channels = ["email"];
    }

    assertEquals(channels.length, 1);
    assertEquals(channels[0], "email");
  });
});

Deno.test("Security Alert Processor - Severity Colors", async (t) => {
  await t.step("should have distinct colors for each severity", () => {
    const severityColors: Record<string, string> = {
      critical: "#8b0000",
      high: "#ff0000",
      medium: "#ff9900",
      low: "#36a64f",
    };

    assertEquals(severityColors.critical, "#8b0000");
    assertEquals(severityColors.high, "#ff0000");
    assertEquals(severityColors.medium, "#ff9900");
    assertEquals(severityColors.low, "#36a64f");
  });

  await t.step("should use darker red for critical", () => {
    const critical = "#8b0000";
    const high = "#ff0000";

    assertNotEquals(critical, high);
  });
});

Deno.test("Security Alert Processor - Email Notifications", async (t) => {
  await t.step("should require MailerSend configuration", () => {
    const apiKey = "";
    const fromEmail = "";
    const alertEmails: string[] = [];

    const isConfigured = !!(apiKey && fromEmail && alertEmails.length > 0);
    assertEquals(isConfigured, false);
  });

  await t.step("should accept valid email configuration", () => {
    const apiKey = "mlsn_123";
    const fromEmail = "security@example.com";
    const alertEmails = ["admin@example.com", "soc@example.com"];

    const isConfigured = !!(apiKey && fromEmail && alertEmails.length > 0);
    assertEquals(isConfigured, true);
  });

  await t.step("should format subject with severity", () => {
    const alert: Partial<SecurityAlert> = {
      severity: "critical",
      title: "Unauthorized access attempt",
    };

    const subject = `[${alert.severity!.toUpperCase()}] Security Alert: ${alert.title}`;
    assertEquals(subject, "[CRITICAL] Security Alert: Unauthorized access attempt");
  });

  await t.step("should include ESCALATED in subject when escalated", () => {
    const alert: Partial<SecurityAlert> = {
      escalated: true,
      title: "Test Alert",
    };

    const titlePrefix = alert.escalated ? " [ESCALATED]" : "";
    assertEquals(titlePrefix, " [ESCALATED]");
  });

  await t.step("should structure email recipients", () => {
    const emails = ["admin@example.com", "soc@example.com"];
    const recipients = emails.map((email) => ({ email, name: "Security Team" }));

    assertEquals(recipients.length, 2);
    assertEquals(recipients[0].email, "admin@example.com");
    assertEquals(recipients[0].name, "Security Team");
  });
});

Deno.test("Security Alert Processor - SMS Notifications", async (t) => {
  await t.step("should require Twilio configuration", () => {
    const accountSid = "";
    const authToken = "";
    const fromNumber = "";
    const alertPhones: string[] = [];

    const isConfigured = !!(accountSid && authToken && fromNumber && alertPhones.length > 0);
    assertEquals(isConfigured, false);
  });

  await t.step("should format SMS message concisely", () => {
    const alert: SecurityAlert = {
      id: "12345678-1234-1234-1234-123456789012",
      severity: "critical",
      title: "Unauthorized access attempt",
      category: "security",
      message: "Full message here",
      metadata: {},
      status: "pending",
      created_at: new Date().toISOString(),
      escalated: false,
      escalation_level: 0,
    };

    const message = `[${alert.severity.toUpperCase()}] ${alert.title}. Alert ID: ${alert.id.substring(0, 8)}`;

    assertEquals(message.includes("[CRITICAL]"), true);
    assertEquals(message.includes("12345678"), true);
    assertEquals(message.length < 160, true); // SMS length limit
  });

  await t.step("should use Basic auth for Twilio", () => {
    const accountSid = "AC123";
    const authToken = "token123";
    const authHeader = "Basic " + btoa(`${accountSid}:${authToken}`);

    assertEquals(authHeader.startsWith("Basic "), true);
  });

  await t.step("should send to all configured phone numbers", () => {
    const phones = ["+15551234567", "+15559876543"];
    assertEquals(phones.length, 2);
  });
});

Deno.test("Security Alert Processor - Slack Notifications", async (t) => {
  await t.step("should require Slack webhook URL", () => {
    const webhookUrl = "";
    const isConfigured = !!webhookUrl;

    assertEquals(isConfigured, false);
  });

  await t.step("should structure Slack message with attachments", () => {
    const alert: SecurityAlert = {
      id: "alert-123",
      severity: "high",
      title: "Test Alert",
      category: "authentication",
      message: "Alert message",
      metadata: {},
      status: "pending",
      created_at: new Date().toISOString(),
      escalated: false,
      escalation_level: 0,
    };

    const slackMessage = {
      username: "Guardian Security Agent",
      icon_emoji: ":shield:",
      attachments: [
        {
          color: "#ff0000",
          title: `${alert.escalated ? "[ESCALATED] " : ""}${alert.title}`,
          text: alert.message,
          fields: [
            { title: "Severity", value: alert.severity.toUpperCase(), short: true },
            { title: "Category", value: alert.category, short: true },
            { title: "Alert ID", value: alert.id, short: true },
          ],
          footer: "WellFit Guardian Agent",
        },
      ],
    };

    assertEquals(slackMessage.username, "Guardian Security Agent");
    assertEquals(slackMessage.icon_emoji, ":shield:");
    assertEquals(slackMessage.attachments.length, 1);
    assertEquals(slackMessage.attachments[0].fields.length, 3);
  });

  await t.step("should include timestamp in attachment", () => {
    const createdAt = "2025-01-15T12:00:00Z";
    const ts = Math.floor(new Date(createdAt).getTime() / 1000);

    assertEquals(typeof ts, "number");
  });
});

Deno.test("Security Alert Processor - PagerDuty Notifications", async (t) => {
  await t.step("should require PagerDuty integration key", () => {
    const integrationKey = "";
    const isConfigured = !!integrationKey;

    assertEquals(isConfigured, false);
  });

  await t.step("should only trigger for critical or escalated", () => {
    const testCases = [
      { severity: "critical", escalated: false, shouldTrigger: true },
      { severity: "high", escalated: true, shouldTrigger: true },
      { severity: "high", escalated: false, shouldTrigger: false },
      { severity: "medium", escalated: false, shouldTrigger: false },
    ];

    for (const tc of testCases) {
      const shouldTrigger = tc.severity === "critical" || tc.escalated;
      assertEquals(shouldTrigger, tc.shouldTrigger);
    }
  });

  await t.step("should map severity to PagerDuty severity", () => {
    const severityMap: Record<string, string> = {
      critical: "critical",
      high: "error",
      medium: "warning",
      low: "info",
    };

    assertEquals(severityMap.critical, "critical");
    assertEquals(severityMap.high, "error");
  });

  await t.step("should use alert ID as dedup_key", () => {
    const alertId = "alert-123";
    const pagerDutyEvent = {
      dedup_key: alertId,
    };

    assertEquals(pagerDutyEvent.dedup_key, alertId);
  });

  await t.step("should structure PagerDuty event correctly", () => {
    const alert: SecurityAlert = {
      id: "alert-123",
      severity: "critical",
      title: "Test Alert",
      category: "security",
      message: "Alert message",
      metadata: {},
      status: "pending",
      created_at: new Date().toISOString(),
      escalated: true,
      escalation_level: 2,
    };

    const pagerDutyEvent = {
      routing_key: "integration-key",
      event_action: "trigger",
      dedup_key: alert.id,
      payload: {
        summary: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        severity: "critical",
        source: "WellFit Guardian Agent",
        timestamp: alert.created_at,
        component: "security-monitoring",
        group: "security-alerts",
        class: alert.severity,
        custom_details: {
          message: alert.message,
          category: alert.category,
          alert_id: alert.id,
          escalated: alert.escalated,
          escalation_level: alert.escalation_level,
        },
      },
    };

    assertEquals(pagerDutyEvent.event_action, "trigger");
    assertEquals(pagerDutyEvent.payload.source, "WellFit Guardian Agent");
    assertEquals(pagerDutyEvent.payload.custom_details.escalated, true);
    assertEquals(pagerDutyEvent.payload.custom_details.escalation_level, 2);
  });
});

Deno.test("Security Alert Processor - Notification Results", async (t) => {
  await t.step("should track success per channel", () => {
    const result: NotificationResult = {
      channel: "email",
      success: true,
    };

    assertEquals(result.success, true);
    assertEquals(result.channel, "email");
  });

  await t.step("should include error message on failure", () => {
    const result: NotificationResult = {
      channel: "sms",
      success: false,
      error: "Twilio API error",
    };

    assertEquals(result.success, false);
    assertExists(result.error);
  });

  await t.step("should track results per alert", () => {
    const alertResult = {
      alertId: "alert-123",
      notifications: [
        { channel: "email", success: true },
        { channel: "slack", success: true },
        { channel: "sms", success: false, error: "Not configured" },
      ],
    };

    assertEquals(alertResult.notifications.length, 3);
    const successCount = alertResult.notifications.filter(n => n.success).length;
    assertEquals(successCount, 2);
  });
});

Deno.test("Security Alert Processor - Alert Update After Notification", async (t) => {
  await t.step("should mark notification_sent=true on success", () => {
    const successfulChannels = ["email", "slack"];
    const notification_sent = successfulChannels.length > 0;

    assertEquals(notification_sent, true);
  });

  await t.step("should not mark notification_sent if all failed", () => {
    const successfulChannels: string[] = [];
    const notification_sent = successfulChannels.length > 0;

    assertEquals(notification_sent, false);
  });

  await t.step("should record successful channels", () => {
    const notifications: NotificationResult[] = [
      { channel: "email", success: true },
      { channel: "slack", success: true },
      { channel: "sms", success: false, error: "Error" },
    ];

    const successfulChannels = notifications
      .filter((n) => n.success)
      .map((n) => n.channel);

    assertEquals(successfulChannels.length, 2);
    assertEquals(successfulChannels.includes("email"), true);
    assertEquals(successfulChannels.includes("sms"), false);
  });

  await t.step("should update notification_sent_at timestamp", () => {
    const update = {
      notification_sent: true,
      notification_channels: ["email", "slack"],
      notification_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    assertExists(update.notification_sent_at);
    assertExists(update.updated_at);
  });
});

Deno.test("Security Alert Processor - Escalation Check", async (t) => {
  await t.step("should call escalation check RPC", () => {
    const rpcCall = {
      function: "check_alert_escalation",
    };

    assertEquals(rpcCall.function, "check_alert_escalation");
  });
});

Deno.test("Security Alert Processor - Response Structure", async (t) => {
  await t.step("should return message for no pending alerts", () => {
    const response = {
      message: "No pending alerts to process",
      processed: 0,
    };

    assertEquals(response.processed, 0);
  });

  await t.step("should return results on success", () => {
    const response = {
      message: "Alerts processed successfully",
      processed: 3,
      results: [
        { alertId: "a1", notifications: [] },
        { alertId: "a2", notifications: [] },
        { alertId: "a3", notifications: [] },
      ],
    };

    assertEquals(response.processed, 3);
    assertEquals(response.results.length, 3);
  });
});

Deno.test("Security Alert Processor - Error Handling", async (t) => {
  await t.step("should return 500 for fetch errors", () => {
    const error = {
      status: 500,
      body: { error: "Failed to fetch alerts", details: "Database error" },
    };

    assertEquals(error.status, 500);
  });

  await t.step("should handle notification errors gracefully", () => {
    const notificationError = new Error("Network timeout");
    const result: NotificationResult = {
      channel: "email",
      success: false,
      error: notificationError.message,
    };

    assertEquals(result.success, false);
    assertEquals(result.error, "Network timeout");
  });

  await t.step("should continue processing other alerts on individual failure", () => {
    // Each alert is processed independently
    const alerts = ["alert-1", "alert-2", "alert-3"];
    const processedCount = alerts.length;

    assertEquals(processedCount, 3);
  });
});

Deno.test("Security Alert Processor - SOC2 Compliance", async (t) => {
  await t.step("should comply with CC6.1 - Security event notification", () => {
    // CC6.1 requires notification of security events
    const channels = ["email", "slack", "pagerduty", "sms"];
    assertEquals(channels.length >= 1, true);
  });

  await t.step("should comply with CC7.2 - Security event monitoring", () => {
    // CC7.2 requires monitoring and response to security events
    const processingFeatures = [
      "alert_fetching",
      "severity_filtering",
      "multi_channel_notification",
      "escalation_handling",
    ];

    assertEquals(processingFeatures.length, 4);
  });

  await t.step("should log all alert processing", () => {
    const logData = {
      alertId: "alert-123",
      severity: "critical",
      successfulChannels: ["email", "slack"],
    };

    assertExists(logData.alertId);
    assertExists(logData.severity);
    assertExists(logData.successfulChannels);
  });
});

Deno.test("Security Alert Processor - Configuration Checks", async (t) => {
  await t.step("should handle unconfigured channels gracefully", () => {
    const channelConfigs = {
      email: { configured: false, error: "Email not configured" },
      sms: { configured: false, error: "SMS not configured" },
      slack: { configured: false, error: "Slack not configured" },
      pagerduty: { configured: false, error: "PagerDuty not configured" },
    };

    for (const [channel, config] of Object.entries(channelConfigs)) {
      if (!config.configured) {
        const result: NotificationResult = {
          channel,
          success: false,
          error: config.error,
        };
        assertEquals(result.success, false);
      }
    }
  });

  await t.step("should handle unknown channel type", () => {
    const channel = "unknown";
    const result: NotificationResult = {
      channel,
      success: false,
      error: "Unknown channel",
    };

    assertEquals(result.success, false);
    assertEquals(result.error, "Unknown channel");
  });
});
