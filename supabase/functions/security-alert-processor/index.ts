/**
 * Security Alert Processor Edge Function
 *
 * Processes pending security alerts and sends notifications via:
 * - Email (MailerSend)
 * - SMS (Twilio)
 * - Slack (Webhook)
 * - Internal in-app notification (security_notifications table) — replaces
 *   the former external PagerDuty Events API integration. The project's
 *   "PagerDuty" was never the external SaaS — it was an internal UI-only
 *   notification panel. Writing to security_notifications feeds that panel.
 *
 * This function should be called:
 * - By cron job every minute
 * - By database webhook on new alert creation
 *
 * SOC2 Compliance: CC6.1, CC7.2 - Security event notification
 */

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

// Environment variables — use imports directly, no shadowing (adversarial audit lesson #5)
const INTERNAL_URL = SUPABASE_URL;
const SERVICE_KEY = SB_SECRET_KEY;
const MAILERSEND_API_KEY = Deno.env.get("MAILERSEND_API_KEY");
const MAILERSEND_FROM_EMAIL = Deno.env.get("MAILERSEND_FROM_EMAIL");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");
const SLACK_SECURITY_WEBHOOK_URL = Deno.env.get("SLACK_SECURITY_WEBHOOK_URL");
// PAGERDUTY_INTEGRATION_KEY removed 2026-04-21 — the "pagerduty" channel now
// writes to security_notifications (internal in-app panel) instead of calling
// events.pagerduty.com. The original project's PagerDuty was never the external
// SaaS product.
const SECURITY_ALERT_EMAILS = Deno.env.get("SECURITY_ALERT_EMAILS")?.split(",") || [];
const SECURITY_ALERT_PHONES = Deno.env.get("SECURITY_ALERT_PHONES")?.split(",") || [];

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

serve(async (req) => {
  const logger = createLogger("security-alert-processor", req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Validate cron secret — this function should only be called by cron or webhook.
    // Accept EITHER a valid X-Cron-Secret header OR a Bearer token that equals
    // CRON_SECRET / SB_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY (legacy).
    // The previous version accepted ANY Bearer token, which opened a spam channel.
    const headerSecret = req.headers.get("X-Cron-Secret");
    const bearerToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
    const candidateSecret = headerSecret ?? bearerToken;

    const acceptedSecrets = [
      Deno.env.get("CRON_SECRET"),
      Deno.env.get("SB_SECRET_KEY"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    ].filter((s): s is string => typeof s === "string" && s.length > 0);

    const isAuthorized =
      typeof candidateSecret === "string" &&
      candidateSecret.length > 0 &&
      acceptedSecrets.some((s) => s === candidateSecret);

    if (!isAuthorized) {
      logger.warn("Unauthorized invocation rejected", {
        hasHeaderSecret: Boolean(headerSecret),
        hasBearerToken: Boolean(bearerToken),
      });
      return new Response(
        JSON.stringify({ error: "Unauthorized — cron secret required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(INTERNAL_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Parse request body for specific alert or process all pending
    let alertIds: string[] = [];
    try {
      const body = await req.json();
      if (body.alert_id) {
        alertIds = [body.alert_id];
      } else if (body.alert_ids) {
        alertIds = body.alert_ids;
      }
    } catch {
      // No body - process all pending alerts
    }

    // Fetch pending alerts that haven't been notified
    let query = supabase
      .from("security_alerts")
      .select("*")
      .eq("notification_sent", false)
      .in("severity", ["critical", "high"]) // Only notify on critical/high
      .order("created_at", { ascending: true })
      .limit(50);

    if (alertIds.length > 0) {
      query = query.in("id", alertIds);
    }

    const { data: alerts, error: fetchError } = await query;

    if (fetchError) {
      logger.error("Failed to fetch alerts", { error: fetchError.message });
      return new Response(
        JSON.stringify({ error: "Failed to fetch alerts", details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending alerts to process", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info("Processing security alerts", { count: alerts.length });

    const results: { alertId: string; notifications: NotificationResult[] }[] = [];

    // Process each alert
    for (const alert of alerts as SecurityAlert[]) {
      const notifications: NotificationResult[] = [];

      // Determine channels based on severity
      const channels = getChannelsForSeverity(alert.severity, alert.escalated);

      // Send to each channel
      for (const channel of channels) {
        try {
          let result: NotificationResult;

          switch (channel) {
            case "email":
              result = await sendEmailNotification(alert);
              break;
            case "sms":
              result = await sendSMSNotification(alert);
              break;
            case "slack":
              result = await sendSlackNotification(alert);
              break;
            case "pagerduty":
              // Internal in-app notification (replaces former external PagerDuty SaaS call).
              // Writes to security_notifications so the in-app panel surfaces the alert.
              result = await sendInternalNotification(supabase, alert);
              break;
            default:
              result = { channel, success: false, error: "Unknown channel" };
          }

          notifications.push(result);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          notifications.push({
            channel,
            success: false,
            error: errorMessage,
          });
        }
      }

      // Update alert with notification status
      const successfulChannels = notifications
        .filter((n) => n.success)
        .map((n) => n.channel);

      await supabase
        .from("security_alerts")
        .update({
          notification_sent: successfulChannels.length > 0,
          notification_channels: successfulChannels,
          notification_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", alert.id);

      results.push({ alertId: alert.id, notifications });

      logger.info("Alert processed", {
        alertId: alert.id,
        severity: alert.severity,
        successfulChannels,
      });
    }

    // Also check for alerts that need escalation
    await checkEscalations(supabase, logger);

    return new Response(
      JSON.stringify({
        message: "Alerts processed successfully",
        processed: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Fatal error in security-alert-processor", {
      error: errorMessage,
    });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Determine notification channels based on severity and escalation
 */
function getChannelsForSeverity(severity: string, escalated: boolean): string[] {
  if (severity === "critical" || escalated) {
    return ["email", "slack", "pagerduty", "sms"];
  } else if (severity === "high") {
    return ["email", "slack"];
  }
  return ["email"];
}

/**
 * Send email notification via MailerSend
 */
async function sendEmailNotification(alert: SecurityAlert): Promise<NotificationResult> {
  if (!MAILERSEND_API_KEY || !MAILERSEND_FROM_EMAIL || SECURITY_ALERT_EMAILS.length === 0) {
    return { channel: "email", success: false, error: "Email not configured" };
  }

  const severityColors: Record<string, string> = {
    critical: "#8b0000",
    high: "#ff0000",
    medium: "#ff9900",
    low: "#36a64f",
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: ${severityColors[alert.severity]}; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #666; }
        .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        .badge { display: inline-block; padding: 5px 15px; border-radius: 3px; background: ${severityColors[alert.severity]}; color: white; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Security Alert${alert.escalated ? " [ESCALATED]" : ""}</h1>
        <span class="badge">${alert.severity.toUpperCase()}</span>
      </div>
      <div class="content">
        <div class="field">
          <div class="label">Alert Title</div>
          <div>${alert.title}</div>
        </div>
        <div class="field">
          <div class="label">Description</div>
          <div>${alert.message}</div>
        </div>
        <div class="field">
          <div class="label">Category</div>
          <div>${alert.category}</div>
        </div>
        <div class="field">
          <div class="label">Timestamp</div>
          <div>${new Date(alert.created_at).toLocaleString()}</div>
        </div>
        <div class="field">
          <div class="label">Alert ID</div>
          <div>${alert.id}</div>
        </div>
      </div>
      <div class="footer">
        <p>This is an automated security alert from WellFit Guardian Agent.</p>
        <p>Please investigate this alert in the SOC2 Security Dashboard.</p>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MAILERSEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: {
          email: MAILERSEND_FROM_EMAIL,
          name: "WellFit Security",
        },
        to: SECURITY_ALERT_EMAILS.map((email) => ({ email, name: "Security Team" })),
        subject: `[${alert.severity.toUpperCase()}] Security Alert: ${alert.title}`,
        html: htmlContent,
        text: `${alert.severity.toUpperCase()} Security Alert: ${alert.title}\n\n${alert.message}`,
        tags: [alert.severity, "security-alert"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { channel: "email", success: false, error: errorText };
    }

    return { channel: "email", success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      channel: "email",
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send SMS notification via Twilio
 */
async function sendSMSNotification(alert: SecurityAlert): Promise<NotificationResult> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER || SECURITY_ALERT_PHONES.length === 0) {
    return { channel: "sms", success: false, error: "SMS not configured" };
  }

  const message = `[${alert.severity.toUpperCase()}] ${alert.title}. Alert ID: ${alert.id.substring(0, 8)}`;

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    for (const phone of SECURITY_ALERT_PHONES) {
      const formData = new URLSearchParams();
      formData.set("To", phone);
      formData.set("From", TWILIO_FROM_NUMBER);
      formData.set("Body", message);

      const response = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { channel: "sms", success: false, error: errorText };
      }
    }

    return { channel: "sms", success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      channel: "sms",
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send Slack notification via webhook
 */
async function sendSlackNotification(alert: SecurityAlert): Promise<NotificationResult> {
  if (!SLACK_SECURITY_WEBHOOK_URL) {
    return { channel: "slack", success: false, error: "Slack not configured" };
  }

  const severityColors: Record<string, string> = {
    critical: "#8b0000",
    high: "#ff0000",
    medium: "#ff9900",
    low: "#36a64f",
  };

  const slackMessage = {
    username: "Guardian Security Agent",
    icon_emoji: ":shield:",
    attachments: [
      {
        color: severityColors[alert.severity],
        title: `${alert.escalated ? "[ESCALATED] " : ""}${alert.title}`,
        text: alert.message,
        fields: [
          { title: "Severity", value: alert.severity.toUpperCase(), short: true },
          { title: "Category", value: alert.category, short: true },
          { title: "Alert ID", value: alert.id, short: true },
          { title: "Time", value: new Date(alert.created_at).toLocaleString(), short: true },
        ],
        footer: "WellFit Guardian Agent",
        ts: Math.floor(new Date(alert.created_at).getTime() / 1000),
      },
    ],
  };

  try {
    const response = await fetch(SLACK_SECURITY_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackMessage),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { channel: "slack", success: false, error: errorText };
    }

    return { channel: "slack", success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      channel: "slack",
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send internal in-app notification by inserting into security_notifications.
 *
 * Replaces the former external PagerDuty Events API integration. The project's
 * "PagerDuty" was always an internal UI panel, not the external SaaS product
 * (confirmed 2026-04-20). This function writes to security_notifications so
 * clinicians and admins on the dashboard see the alert in real time via the
 * existing in-app notification panel.
 */
async function sendInternalNotification(
  supabase: ReturnType<typeof createClient>,
  alert: SecurityAlert
): Promise<NotificationResult> {
  // Only route critical/escalated to the in-app panel to avoid noise —
  // lower-severity alerts are already covered by email/Slack.
  if (alert.severity !== "critical" && !alert.escalated) {
    return { channel: "pagerduty", success: false, error: "Internal notification only for critical/escalated" };
  }

  try {
    const { error } = await supabase.from("security_notifications").insert({
      type: "guardian_alert",
      severity: alert.severity,
      title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      message: alert.message,
      link: `/guardian/alerts/${alert.id}`,
      metadata: {
        alert_id: alert.id,
        category: alert.category,
        escalated: alert.escalated,
        escalation_level: alert.escalation_level,
        source: "security-alert-processor",
      },
    });

    if (error) {
      return { channel: "pagerduty", success: false, error: error.message };
    }

    return { channel: "pagerduty", success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { channel: "pagerduty", success: false, error: errorMessage };
  }
}

/**
 * Check and process escalations
 */
async function checkEscalations(
  supabase: ReturnType<typeof createClient>,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    // Call database function to check escalations
    const { error } = await supabase.rpc("check_alert_escalation");

    if (error) {
      logger.error("Escalation check failed", { error: error.message });
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Escalation check exception", {
      error: errorMessage,
    });
  }
}
