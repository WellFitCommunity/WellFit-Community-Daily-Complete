// supabase/functions/process-appointment-reminders/index.ts
// Automated appointment reminder processor - called by scheduler/cron

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { withCORS } from "../_shared/auth.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("process-appointment-reminders");

// -------------- Utils --------------
const getEnv = (k: string, ...alts: string[]) => {
  for (const key of [k, ...alts]) {
    const v = Deno.env.get(key);
    if (v && v.trim()) return v.trim();
  }
  return "";
};
const isE164 = (s: string) => /^\+[1-9]\d{6,14}$/.test(s || "");
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...extra } });

// -------------- Env --------------
const TWILIO_ACCOUNT_SID = getEnv("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = getEnv("TWILIO_AUTH_TOKEN");
const TWILIO_MESSAGING_SERVICE_SID = getEnv("TWILIO_MESSAGING_SERVICE_SID");
const TWILIO_FROM_NUMBER = getEnv("TWILIO_FROM_NUMBER");
const FIREBASE_SERVER_KEY = getEnv("FIREBASE_SERVER_KEY");

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");

// Cron secret for security (optional - allows calling without auth if secret matches)
const CRON_SECRET = getEnv("CRON_SECRET");

// -------------- Types --------------
interface AppointmentNeedingReminder {
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string | null;
  patient_email: string | null;
  provider_name: string;
  appointment_time: string;
  duration_minutes: number;
  encounter_type: string;
  reason_for_visit: string | null;
  tenant_id: string | null;
  sms_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  dnd_start_time: string | null;
  dnd_end_time: string | null;
  timezone: string;
}

interface ReminderResult {
  appointmentId: string;
  patientName: string;
  smsSent: boolean;
  smsSid?: string;
  pushSent: boolean;
  emailSent: boolean;
  status: "sent" | "partial" | "failed" | "skipped";
  skipReason?: string;
}

type ReminderType = "24h" | "1h" | "15m";

// -------------- Supabase Client --------------
const makeSupabase = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

// -------------- DND Check --------------
function isInDndWindow(
  dndStartTime: string | null,
  dndEndTime: string | null,
  timezone: string = "America/Chicago"
): boolean {
  if (!dndStartTime || !dndEndTime) return false;

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const currentTime = formatter.format(now);
    const [currentHour, currentMinute] = currentTime.split(":").map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = dndStartTime.split(":").map(Number);
    const [endHour, endMinute] = dndEndTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
  } catch {
    return false;
  }
}

// -------------- Message Builder --------------
function buildReminderMessage(
  reminderType: ReminderType,
  patientName: string,
  providerName: string,
  appointmentTime: string,
  timezone: string
): string {
  const firstName = patientName.split(" ")[0];
  const date = new Date(appointmentTime);

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const formattedDate = dateFormatter.format(date);
  const formattedTime = timeFormatter.format(date);

  switch (reminderType) {
    case "24h":
      return `Hi ${firstName}, this is a reminder that you have a telehealth appointment tomorrow (${formattedDate}) at ${formattedTime} with ${providerName}. Please ensure you have a stable internet connection and a quiet space for your visit.`;
    case "1h":
      return `Hi ${firstName}, your telehealth appointment with ${providerName} is in 1 hour at ${formattedTime}. Please be ready to join the video call.`;
    case "15m":
      return `Hi ${firstName}, your telehealth appointment with ${providerName} starts in 15 minutes. Please join the video call now.`;
    default:
      return `Hi ${firstName}, you have a telehealth appointment with ${providerName} on ${formattedDate} at ${formattedTime}.`;
  }
}

// -------------- Twilio SMS --------------
async function sendSMS(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { ok: false, error: "Twilio credentials missing" };
  }
  if (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM_NUMBER) {
    return { ok: false, error: "Twilio routing not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const form = new URLSearchParams({ To: to, Body: body });

  if (TWILIO_MESSAGING_SERVICE_SID) {
    form.append("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
  } else {
    form.append("From", TWILIO_FROM_NUMBER);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const text = await res.text();
    if (!res.ok) {
      try {
        const err = JSON.parse(text);
        return { ok: false, error: `Twilio ${err?.status}: ${err?.message}` };
      } catch {
        return { ok: false, error: `Twilio ${res.status}: ${text}` };
      }
    }

    const j = JSON.parse(text);
    return { ok: true, sid: j.sid };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Twilio error: ${msg}` };
  }
}

// -------------- Firebase Push --------------
async function sendPushNotification(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  if (!FIREBASE_SERVER_KEY) {
    return { ok: false, error: "Firebase server key missing" };
  }

  // Get FCM tokens for user
  const { data: tokens, error: tokenErr } = await supabase
    .from("fcm_tokens")
    .select("token")
    .eq("user_id", userId);

  if (tokenErr || !tokens || tokens.length === 0) {
    return { ok: false, error: "No FCM tokens found for user" };
  }

  const fcmTokens = tokens.map((t: { token: string }) => t.token);

  try {
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${FIREBASE_SERVER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registration_ids: fcmTokens,
        notification: {
          title,
          body,
          sound: "default",
        },
        data: {
          type: "appointment_reminder",
          click_action: "OPEN_APPOINTMENTS",
        },
      }),
    });

    if (!res.ok) {
      return { ok: false, error: `FCM error: ${res.status}` };
    }

    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `FCM error: ${msg}` };
  }
}

// -------------- Process Single Reminder --------------
async function processReminder(
  supabase: SupabaseClient,
  apt: AppointmentNeedingReminder,
  reminderType: ReminderType
): Promise<ReminderResult> {
  const result: ReminderResult = {
    appointmentId: apt.appointment_id,
    patientName: apt.patient_name,
    smsSent: false,
    pushSent: false,
    emailSent: false,
    status: "failed",
  };

  // Check DND
  if (isInDndWindow(apt.dnd_start_time, apt.dnd_end_time, apt.timezone)) {
    result.status = "skipped";
    result.skipReason = "Patient is in Do Not Disturb window";
    logger.info("Skipping reminder - DND", { appointmentId: apt.appointment_id });
    return result;
  }

  const message = buildReminderMessage(
    reminderType,
    apt.patient_name,
    apt.provider_name,
    apt.appointment_time,
    apt.timezone
  );

  // Send SMS if enabled and phone available
  if (apt.sms_enabled && apt.patient_phone && isE164(apt.patient_phone)) {
    const smsResult = await sendSMS(apt.patient_phone, message);
    result.smsSent = smsResult.ok;
    result.smsSid = smsResult.sid;
    if (!smsResult.ok) {
      logger.warn("SMS send failed", {
        appointmentId: apt.appointment_id,
        error: smsResult.error,
      });
    }
  }

  // Send push notification if enabled
  if (apt.push_enabled) {
    const pushTitle =
      reminderType === "15m"
        ? "Appointment Starting Soon!"
        : reminderType === "1h"
        ? "Appointment in 1 Hour"
        : "Appointment Tomorrow";

    const pushResult = await sendPushNotification(
      supabase,
      apt.patient_id,
      pushTitle,
      message
    );
    result.pushSent = pushResult.ok;
    if (!pushResult.ok) {
      logger.warn("Push send failed", {
        appointmentId: apt.appointment_id,
        error: pushResult.error,
      });
    }
  }

  // Determine overall status
  if (result.smsSent || result.pushSent || result.emailSent) {
    if (
      (apt.sms_enabled && !result.smsSent) ||
      (apt.push_enabled && !result.pushSent) ||
      (apt.email_enabled && !result.emailSent)
    ) {
      result.status = "partial";
    } else {
      result.status = "sent";
    }
  } else {
    result.status = "failed";
  }

  // Mark reminder as sent
  const { error: markErr } = await supabase.rpc("mark_reminder_sent", {
    p_appointment_id: apt.appointment_id,
    p_reminder_type: reminderType,
    p_sms_sent: result.smsSent,
    p_sms_sid: result.smsSid || null,
    p_push_sent: result.pushSent,
    p_email_sent: result.emailSent,
  });

  if (markErr) {
    logger.error("Failed to mark reminder sent", {
      appointmentId: apt.appointment_id,
      error: markErr.message,
    });
  }

  return result;
}

// -------------- Main Handler --------------
const handler = async (req: Request): Promise<Response> => {
  // Allow GET for health checks, POST for actual processing
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  // For GET requests, just return health status
  if (req.method === "GET") {
    return json({
      status: "healthy",
      service: "process-appointment-reminders",
      timestamp: new Date().toISOString(),
    });
  }

  // Security: Verify cron secret or admin auth
  const authHeader = req.headers.get("Authorization");
  const cronSecretHeader = req.headers.get("X-Cron-Secret");

  if (CRON_SECRET && cronSecretHeader === CRON_SECRET) {
    // Valid cron secret - proceed
  } else if (authHeader?.startsWith("Bearer ")) {
    // Verify JWT - must be admin/super_admin
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return json({ error: "Server not configured" }, 500);
    }
    const supabase = makeSupabase();
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Check if admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return json({ error: "Forbidden - admin access required" }, 403);
    }
  } else {
    return json({ error: "Unauthorized" }, 401);
  }

  // Parse request body
  let reminderTypes: ReminderType[] = ["24h", "1h", "15m"];
  let batchSize = 100;

  try {
    const body = await req.json();
    if (body.reminder_types && Array.isArray(body.reminder_types)) {
      reminderTypes = body.reminder_types.filter((t: string) =>
        ["24h", "1h", "15m"].includes(t)
      );
    }
    if (body.batch_size && typeof body.batch_size === "number") {
      batchSize = Math.min(Math.max(body.batch_size, 1), 500);
    }
  } catch {
    // Use defaults
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return json({ error: "Server not configured" }, 500);
  }

  const supabase = makeSupabase();
  const results: {
    reminderType: ReminderType;
    processed: number;
    sent: number;
    failed: number;
    skipped: number;
    details: ReminderResult[];
  }[] = [];

  // Process each reminder type
  for (const reminderType of reminderTypes) {
    logger.info(`Processing ${reminderType} reminders`);

    // Get appointments needing this reminder type
    const { data: appointments, error: fetchErr } = await supabase.rpc(
      "get_appointments_needing_reminders",
      {
        p_reminder_type: reminderType,
        p_batch_size: batchSize,
      }
    );

    if (fetchErr) {
      logger.error(`Failed to fetch ${reminderType} appointments`, {
        error: fetchErr.message,
      });
      results.push({
        reminderType,
        processed: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        details: [],
      });
      continue;
    }

    const typeResults: ReminderResult[] = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const apt of appointments || []) {
      const result = await processReminder(supabase, apt, reminderType);
      typeResults.push(result);

      if (result.status === "sent" || result.status === "partial") {
        sent++;
      } else if (result.status === "skipped") {
        skipped++;
      } else {
        failed++;
      }
    }

    results.push({
      reminderType,
      processed: (appointments || []).length,
      sent,
      failed,
      skipped,
      details: typeResults,
    });

    logger.info(`Completed ${reminderType} reminders`, {
      processed: (appointments || []).length,
      sent,
      failed,
      skipped,
    });
  }

  return json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
};

// CORS wrapper with POST and GET
serve(withCORS(handler, ["POST", "GET", "OPTIONS"]));
