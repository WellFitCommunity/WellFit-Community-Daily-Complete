// supabase/functions/send-consecutive-missed-alerts/index.ts
// Unified function that sends graduated alerts for consecutive missed check-ins:
// - Day 3: Firebase push notification (sweet reminder)
// - Day 5: SMS text message
// - Day 7: Email to caregiver/emergency contact

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import {
  createLogger,
  getChicagoTime,
  isWithinWindowChicago,
  validateEnvVars,
  type DatabaseTypes,
} from "../shared/types.ts";
import {
  buildCaregiverAlertEmail,
  buildDay5SMSMessage,
  buildDay3PushNotification,
} from "../shared/emailTemplates.ts";

// --- Config ---
const RUN_HOUR_CT = 10; // 10:00–10:05 AM CT
const FCM_ENDPOINT = "https://fcm.googleapis.com/fcm/send";
const DAY_3_THRESHOLD = 3;
const DAY_5_THRESHOLD = 5;
const DAY_7_THRESHOLD = 7;
const ALERT_COOLDOWN_HOURS = 23; // Don't send duplicate alerts within 23 hours

// --- Setup ---
const logger = createLogger("send-consecutive-missed-alerts");
validateEnvVars([
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FCM_SERVER_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
]);

const supabase = createClient<DatabaseTypes>(
  SUPABASE_URL!,
  SB_SECRET_KEY!
);

const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY")!;

// --- Types ---
type UserMissedData = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  emergency_email: string | null;
  caregiver_first_name: string | null;
  caregiver_last_name: string | null;
  caregiver_phone: string | null;
  consecutive_missed_days: number;
  last_checkin_at: string | null;
};

type AlertResult = {
  userId: string;
  alertType: "push" | "sms" | "email";
  consecutiveDays: number;
  success: boolean;
  error?: string;
};

// --- Helper Functions ---

/**
 * Check if an alert was recently sent to prevent duplicates
 */
async function wasAlertRecentlySent(
  userId: string,
  alertType: "push" | "sms" | "email"
): Promise<boolean> {
  const cutoff = new Date(Date.now() - ALERT_COOLDOWN_HOURS * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("consecutive_missed_checkins_log")
    .select("id")
    .eq("user_id", userId)
    .eq("alert_type", alertType)
    .gte("alert_sent_at", cutoff.toISOString())
    .eq("alert_successful", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn("Error checking alert cooldown", { userId, alertType, error: error.message });
    return false; // Fail open - allow alert if check fails
  }

  return !!data;
}

/**
 * Log that an alert was sent (or failed)
 */
async function logAlert(
  userId: string,
  consecutiveDays: number,
  alertType: "push" | "sms" | "email",
  success: boolean,
  errorMessage?: string
) {
  const { error } = await supabase.from("consecutive_missed_checkins_log").insert({
    user_id: userId,
    consecutive_days: consecutiveDays,
    alert_type: alertType,
    alert_successful: success,
    error_message: errorMessage || null,
    alert_sent_at: new Date().toISOString(),
  });

  if (error) {
    logger.error("Failed to log alert", {
      userId,
      alertType,
      error: error.message,
    });
  }
}

/**
 * Send Day 3 push notification via Firebase
 */
async function sendDay3Push(user: UserMissedData): Promise<AlertResult> {
  const result: AlertResult = {
    userId: user.user_id,
    alertType: "push",
    consecutiveDays: user.consecutive_missed_days,
    success: false,
  };

  try {
    // Check cooldown
    const recentlySent = await wasAlertRecentlySent(user.user_id, "push");
    if (recentlySent) {
      logger.info("Day 3 push already sent recently", { userId: user.user_id });
      result.success = true; // Not an error, just skipping
      return result;
    }

    // Get FCM tokens for this user
    const { data: tokens, error: tokenError } = await supabase
      .from("fcm_tokens")
      .select("token")
      .eq("user_id", user.user_id)
      .not("token", "is", null);

    if (tokenError) throw new Error(`Token fetch failed: ${tokenError.message}`);
    if (!tokens || tokens.length === 0) {
      logger.info("No FCM tokens found for user", { userId: user.user_id });
      result.error = "No FCM tokens";
      await logAlert(user.user_id, user.consecutive_missed_days, "push", false, "No FCM tokens");
      return result;
    }

    // Build notification
    const notification = buildDay3PushNotification({ firstName: user.first_name });
    const tokenStrings = tokens.map((t) => t.token).filter(Boolean) as string[];

    // Send via FCM
    const payload = {
      registration_ids: tokenStrings,
      notification: {
        title: notification.title,
        body: notification.body,
        icon: "/icon-192x192.png",
        badge: "/icon-72x72.png",
        click_action: "/check-in",
      },
      data: {
        type: "consecutive_missed_reminder",
        days: String(user.consecutive_missed_days),
      },
    };

    const res = await fetch(FCM_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `key=${FCM_SERVER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const fcmResult = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`FCM error ${res.status}: ${JSON.stringify(fcmResult).slice(0, 300)}`);
    }

    logger.info("Day 3 push sent", {
      userId: user.user_id,
      tokenCount: tokenStrings.length,
      success: fcmResult.success,
    });

    result.success = true;
    await logAlert(user.user_id, user.consecutive_missed_days, "push", true);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    result.error = errorMessage.slice(0, 500);
    logger.error("Day 3 push failed", { userId: user.user_id, error: result.error });
    await logAlert(user.user_id, user.consecutive_missed_days, "push", false, result.error);
  }

  return result;
}

/**
 * Send Day 5 SMS via Twilio
 */
async function sendDay5SMS(user: UserMissedData): Promise<AlertResult> {
  const result: AlertResult = {
    userId: user.user_id,
    alertType: "sms",
    consecutiveDays: user.consecutive_missed_days,
    success: false,
  };

  try {
    // Check cooldown
    const recentlySent = await wasAlertRecentlySent(user.user_id, "sms");
    if (recentlySent) {
      logger.info("Day 5 SMS already sent recently", { userId: user.user_id });
      result.success = true;
      return result;
    }

    // Validate phone number
    if (!user.phone) {
      logger.info("No phone number for user", { userId: user.user_id });
      result.error = "No phone number";
      await logAlert(user.user_id, user.consecutive_missed_days, "sms", false, "No phone");
      return result;
    }

    // Build message
    const message = buildDay5SMSMessage({
      firstName: user.first_name,
      consecutiveDays: user.consecutive_missed_days,
    });

    // Send via send-sms Edge Function
    const { error: smsError } = await supabase.functions.invoke("send-sms", {
      body: {
        to: [user.phone],
        message,
        priority: "normal",
      },
    });

    if (smsError) throw new Error(`SMS send failed: ${smsError.message}`);

    logger.info("Day 5 SMS sent", { userId: user.user_id, phone: user.phone });
    result.success = true;
    await logAlert(user.user_id, user.consecutive_missed_days, "sms", true);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    result.error = errorMessage.slice(0, 500);
    logger.error("Day 5 SMS failed", { userId: user.user_id, error: result.error });
    await logAlert(user.user_id, user.consecutive_missed_days, "sms", false, result.error);
  }

  return result;
}

/**
 * Send Day 7 email to caregiver/emergency contact
 */
async function sendDay7Email(user: UserMissedData): Promise<AlertResult> {
  const result: AlertResult = {
    userId: user.user_id,
    alertType: "email",
    consecutiveDays: user.consecutive_missed_days,
    success: false,
  };

  try {
    // Check cooldown
    const recentlySent = await wasAlertRecentlySent(user.user_id, "email");
    if (recentlySent) {
      logger.info("Day 7 email already sent recently", { userId: user.user_id });
      result.success = true;
      return result;
    }

    // Validate emergency email
    if (!user.emergency_email) {
      logger.info("No emergency email for user", { userId: user.user_id });
      result.error = "No emergency email";
      await logAlert(user.user_id, user.consecutive_missed_days, "email", false, "No emergency email");
      return result;
    }

    // Build email
    const emailContent = buildCaregiverAlertEmail({
      patientFirstName: user.first_name,
      patientLastName: user.last_name,
      caregiverFirstName: user.caregiver_first_name,
      consecutiveDays: user.consecutive_missed_days,
      lastCheckinDate: user.last_checkin_at,
    });

    // Send via send-email Edge Function
    const { error: emailError } = await supabase.functions.invoke("send-email", {
      body: {
        to: [
          {
            email: user.emergency_email,
            name: user.caregiver_first_name
              ? `${user.caregiver_first_name} ${user.caregiver_last_name || ""}`.trim()
              : "Caregiver",
          },
        ],
        subject: emailContent.subject,
        html: emailContent.html,
        priority: "high",
      },
    });

    if (emailError) throw new Error(`Email send failed: ${emailError.message}`);

    logger.info("Day 7 email sent", {
      userId: user.user_id,
      email: user.emergency_email,
    });

    result.success = true;
    await logAlert(user.user_id, user.consecutive_missed_days, "email", true);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    result.error = errorMessage.slice(0, 500);
    logger.error("Day 7 email failed", { userId: user.user_id, error: result.error });
    await logAlert(user.user_id, user.consecutive_missed_days, "email", false, result.error);
  }

  return result;
}

/**
 * Process alerts for users based on consecutive missed days
 */
async function processAlerts(users: UserMissedData[]): Promise<AlertResult[]> {
  const results: AlertResult[] = [];

  for (const user of users) {
    const days = user.consecutive_missed_days;

    // Day 7: Email to caregiver (highest priority)
    if (days >= DAY_7_THRESHOLD) {
      const emailResult = await sendDay7Email(user);
      results.push(emailResult);
    }
    // Day 5: SMS reminder
    else if (days >= DAY_5_THRESHOLD) {
      const smsResult = await sendDay5SMS(user);
      results.push(smsResult);
    }
    // Day 3: Push notification
    else if (days >= DAY_3_THRESHOLD) {
      const pushResult = await sendDay3Push(user);
      results.push(pushResult);
    }
  }

  return results;
}

// --- Main Handler ---
serve(async (req) => {
  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method === "OPTIONS") return handleOptions(req);

  try {
    logger.info("Function invoked", { chicagoTime: getChicagoTime().toISOString() });

    // Time-gate to run once per day
    if (!isWithinWindowChicago(RUN_HOUR_CT, 5)) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Outside scheduled time window",
          chicagoTime: getChicagoTime().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Refresh materialized view to get latest consecutive days
    logger.info("Refreshing consecutive missed days view");
    const { error: refreshError } = await supabase.rpc("refresh_consecutive_missed_days");
    if (refreshError) {
      logger.warn("Failed to refresh view (may not exist yet)", {
        error: refreshError.message,
      });
      // Continue anyway - view might get created by migration
    }

    // Step 2: Fetch users who need alerts (3+ consecutive days)
    const { data: users, error: fetchError } = await supabase
      .from("user_consecutive_missed_days")
      .select("*")
      .gte("consecutive_missed_days", DAY_3_THRESHOLD);

    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`);
    }

    if (!users || users.length === 0) {
      logger.info("No users found with consecutive missed check-ins");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No users need alerts",
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info("Found users needing alerts", { count: users.length });

    // Step 3: Process alerts for each user
    const results = await processAlerts(users as UserMissedData[]);

    // Step 4: Summarize results
    const summary = {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      byType: {
        push: results.filter((r) => r.alertType === "push" && r.success).length,
        sms: results.filter((r) => r.alertType === "sms" && r.success).length,
        email: results.filter((r) => r.alertType === "email" && r.success).length,
      },
    };

    logger.info("Alert processing complete", summary);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Consecutive missed alerts processed",
        summary,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Function error", { message: errorMessage.slice(0, 500) });
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
